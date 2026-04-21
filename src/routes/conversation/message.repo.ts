import { Injectable } from '@nestjs/common'
import { MessageType, Prisma } from '@prisma/client'
import { SerializeAll } from 'src/shared/decorators/serialize.decorator'
import { PrismaService } from 'src/shared/services/prisma.service'

@Injectable()
@SerializeAll([
  'resolveCursor',
  'buildMessageQuery',
  'getSearchFacets',
  'getMessageInclude',
  'getMessageIncludeWithConversation',
  'normalizeMessage',
])
export class MessageRepository {
  constructor(private readonly prisma: PrismaService) {}

  // ===== MESSAGE CRUD =====

  async create(data: {
    conversationId: string
    fromUserId: number
    content?: string | null
    type: 'TEXT' | 'IMAGE' | 'VIDEO' | 'AUDIO' | 'FILE' | 'STICKER' | 'SYSTEM' | 'LOCATION' | 'CONTACT'
    replyToId?: string
    attachments?: Array<{
      type: 'IMAGE' | 'VIDEO' | 'AUDIO' | 'DOCUMENT'
      fileName: string
      fileUrl: string
      fileSize?: number
      mimeType?: string
      thumbnail?: string
      width?: number
      height?: number
      duration?: number
    }>
  }) {
    const message = await this.prisma.conversationMessage.create({
      data: {
        conversationId: data.conversationId,
        fromUserId: data.fromUserId,
        content: data.content,
        type: data.type,
        replyToId: data.replyToId,
        attachments: data.attachments
          ? {
              create: data.attachments,
            }
          : undefined,
      },
      include: this.getMessageInclude(),
    })

    return this.normalizeMessage(message)
  }

  async findById(id: string) {
    const message = await this.prisma.conversationMessage.findUnique({
      where: { id },
      include: this.getMessageInclude(),
    })

    return message ? this.normalizeMessage(message) : null
  }

  /**
   * Find conversation messages using pure cursor-based pagination
   * @param conversationId - Conversation ID
   * @param options - Pagination options
   * @returns Messages with cursor pagination metadata
   */
  async findConversationMessages(
    conversationId: string,
    options: {
      limit: number
      cursor?: string // Message ID to paginate from
      direction?: 'forward' | 'backward' // forward = newer messages, backward = older messages
      type?: string
    },
  ) {
    const { limit, cursor, direction = 'backward', type } = options

    const cursorWhere = await this.resolveCursor(cursor, direction)
    const messages = await this.buildMessageQuery(conversationId, type, cursorWhere, limit)

    const hasMore = messages.length > limit
    const resultMessages = hasMore ? messages.slice(0, limit) : messages
    const normalizedMessages = resultMessages.map((msg) => this.normalizeMessage(msg))

    const nextCursor = hasMore && resultMessages.length > 0 ? resultMessages[resultMessages.length - 1].id : null
    const prevCursor = resultMessages.length > 0 ? resultMessages[0].id : null

    return {
      data: normalizedMessages.reverse(),
      pagination: {
        limit,
        cursor,
        direction,
        hasMore,
        nextCursor,
        prevCursor,
      },
    }
  }

  /**
   * Resolve cursor to a createdAt filter for pagination
   * @param cursor - Message ID to paginate from
   * @param direction - Pagination direction
   * @returns Prisma where clause for createdAt filter
   */
  private async resolveCursor(
    cursor: string | undefined,
    direction: 'forward' | 'backward',
  ): Promise<Prisma.ConversationMessageWhereInput['createdAt']> {
    if (!cursor) {
      return undefined
    }

    const cursorMessage = await this.prisma.conversationMessage.findUnique({
      where: { id: cursor },
      select: { createdAt: true, id: true },
    })

    if (!cursorMessage) {
      throw new Error('Invalid cursor: Message not found')
    }

    // Backward = load older messages (createdAt < cursor)
    // Forward = load newer messages (createdAt > cursor)
    return direction === 'backward' ? { lt: cursorMessage.createdAt } : { gt: cursorMessage.createdAt }
  }

  /**
   * Build and execute the Prisma query for fetching messages
   * @param conversationId - Conversation ID
   * @param type - Optional message type filter
   * @param cursorWhere - Cursor-based createdAt filter
   * @param limit - Number of messages to fetch
   * @returns Array of messages from database
   */
  private buildMessageQuery(
    conversationId: string,
    type: string | undefined,
    cursorWhere: Prisma.ConversationMessageWhereInput['createdAt'],
    limit: number,
  ) {
    const where: Prisma.ConversationMessageWhereInput = {
      conversationId,
      isDeleted: false,
    }

    if (type) {
      where.type = type as MessageType
    }

    if (cursorWhere) {
      where.createdAt = cursorWhere
    }

    return this.prisma.conversationMessage.findMany({
      where,
      include: this.getMessageInclude(),
      orderBy: { createdAt: 'desc' },
      take: limit + 1,
    })
  }

  /**
   * Search messages using cursor-based pagination
   * @param conversationIds - Array of conversation IDs to search in
   * @param query - Search query string
   * @param options - Search and pagination options
   * @returns Search results with cursor pagination metadata
   */
  async searchMessages(
    conversationIds: string[],
    query: string,
    options: {
      limit: number
      cursor?: string // Message ID to paginate from
      type?: string
      fromUserId?: number
      dateFrom?: Date
      dateTo?: Date
    },
  ) {
    const { limit, cursor, type, fromUserId, dateFrom, dateTo } = options

    const where: Prisma.ConversationMessageWhereInput = {
      conversationId: { in: conversationIds },
      isDeleted: false,
      content: {
        contains: query,
        mode: 'insensitive',
      },
    }

    if (type) {
      where.type = type as MessageType
    }

    if (fromUserId) {
      where.fromUserId = fromUserId
    }

    // Build createdAt filter
    const createdAtFilter: any = {}
    if (dateFrom) createdAtFilter.gte = dateFrom
    if (dateTo) createdAtFilter.lte = dateTo

    // Cursor-based filtering
    if (cursor) {
      const cursorMessage = await this.prisma.conversationMessage.findUnique({
        where: { id: cursor },
        select: { createdAt: true, id: true },
      })

      if (cursorMessage) {
        // For search, always paginate backward (older results)
        createdAtFilter.lt = cursorMessage.createdAt
      }
    }

    // Apply createdAt filter if any conditions exist
    if (Object.keys(createdAtFilter).length > 0) {
      where.createdAt = createdAtFilter
    }

    const [messages, facets] = await Promise.all([
      this.prisma.conversationMessage.findMany({
        where,
        include: this.getMessageIncludeWithConversation(),
        orderBy: { createdAt: 'desc' },
        take: limit + 1, // Fetch one extra to check if there are more
      }),
      this.getSearchFacets(conversationIds, query),
    ])

    // Check if there are more messages
    const hasMore = messages.length > limit
    const resultMessages = hasMore ? messages.slice(0, limit) : messages

    // Normalize messages
    const normalizedMessages = resultMessages.map((msg) => this.normalizeMessage(msg))

    // Generate cursor for next page
    const nextCursor = hasMore && resultMessages.length > 0 ? resultMessages[resultMessages.length - 1].id : null

    return {
      data: normalizedMessages,
      pagination: {
        limit,
        cursor,
        hasMore,
        nextCursor,
      },
      facets,
    }
  }

  async update(
    id: string,
    data: {
      content?: string
      isEdited?: boolean
      editedAt?: Date
      isDeleted?: boolean
      deletedAt?: Date
      deletedForEveryone?: boolean
    },
  ) {
    const message = await this.prisma.conversationMessage.update({
      where: { id },
      data,
      include: this.getMessageInclude(),
    })

    return this.normalizeMessage(message)
  }

  async delete(id: string, forEveryone: boolean = false) {
    const updateData: any = {
      isDeleted: true,
      deletedAt: new Date(),
    }

    if (forEveryone) {
      updateData.deletedForEveryone = true
      updateData.content = null // Clear content for everyone
    }

    const message = await this.prisma.conversationMessage.update({
      where: { id },
      data: updateData,
      include: this.getMessageInclude(),
    })

    return this.normalizeMessage(message)
  }

  // ===== MESSAGE REACTIONS =====

  addReaction(messageId: string, userId: number, emoji: string) {
    return this.prisma.messageReaction.upsert({
      where: {
        messageId_userId_emoji: {
          messageId,
          userId,
          emoji,
        },
      },
      create: {
        messageId,
        userId,
        emoji,
      },
      update: {
        createdAt: new Date(), // Update timestamp
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            avatar: true,
            status: true,
          },
        },
      },
    })
  }

  removeReaction(messageId: string, userId: number, emoji: string) {
    return this.prisma.messageReaction.delete({
      where: {
        messageId_userId_emoji: {
          messageId,
          userId,
          emoji,
        },
      },
    })
  }

  getMessageReactions(messageId: string) {
    return this.prisma.messageReaction.findMany({
      where: { messageId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            avatar: true,
            status: true,
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    })
  }

  async getReactionStats(messageId: string) {
    const reactions = await this.prisma.messageReaction.groupBy({
      by: ['emoji'],
      where: { messageId },
      _count: { emoji: true },
    })

    return reactions.reduce(
      (acc, reaction) => {
        acc[reaction.emoji] = reaction._count.emoji
        return acc
      },
      {} as Record<string, number>,
    )
  }

  // ===== READ RECEIPTS =====

  markAsRead(messageId: string, userId: number) {
    return this.prisma.messageReadReceipt.upsert({
      where: {
        messageId_userId: {
          messageId,
          userId,
        },
      },
      create: {
        messageId,
        userId,
      },
      update: {
        readAt: new Date(),
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            avatar: true,
            status: true,
          },
        },
      },
    })
  }

  async markConversationAsRead(conversationId: string, userId: number, upToMessageId?: string) {
    const whereClause: Prisma.ConversationMessageWhereInput = {
      conversationId,
      fromUserId: { not: userId }, // Don't mark own messages as read
      isDeleted: false,
    }

    if (upToMessageId) {
      const upToMessage = await this.prisma.conversationMessage.findUnique({
        where: { id: upToMessageId },
        select: { createdAt: true },
      })
      if (upToMessage) {
        whereClause.createdAt = { lte: upToMessage.createdAt }
      }
    }

    // Get all unread messages
    const messages = await this.prisma.conversationMessage.findMany({
      where: {
        ...whereClause,
        readReceipts: {
          none: { userId },
        },
      },
      select: { id: true },
      orderBy: { createdAt: 'asc' },
    })

    // Create read receipts for all unread messages
    if (messages.length > 0) {
      await this.prisma.messageReadReceipt.createMany({
        data: messages.map((msg) => ({
          messageId: msg.id,
          userId,
        })),
        skipDuplicates: true,
      })
    }

    return messages.length
  }

  async getReadReceipts(messageId: string) {
    return this.prisma.messageReadReceipt.findMany({
      where: { messageId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            avatar: true,
            status: true,
          },
        },
      },
      orderBy: { readAt: 'asc' },
    })
  }

  async getReadReceiptStats(messageId: string) {
    const count = await this.prisma.messageReadReceipt.count({
      where: { messageId },
    })

    const message = await this.prisma.conversationMessage.findUnique({
      where: { id: messageId },
      include: {
        conversation: {
          select: {
            _count: {
              select: {
                members: {
                  where: { isActive: true },
                },
              },
            },
          },
        },
      },
    })

    const totalMembers = message?.conversation._count.members || 0
    const authorId = message?.fromUserId
    const membersExcludingAuthor = authorId ? Math.max(0, totalMembers - 1) : totalMembers

    return {
      readCount: count,
      totalMembers: membersExcludingAuthor,
      readPercentage: membersExcludingAuthor > 0 ? (count / membersExcludingAuthor) * 100 : 0,
    }
  }

  // ===== UTILITY METHODS =====

  getLastMessage(conversationId: string) {
    return this.prisma.conversationMessage.findFirst({
      where: {
        conversationId,
        isDeleted: false,
      },
      orderBy: { createdAt: 'desc' },
      include: this.getMessageInclude(),
    })
  }

  getUnreadCount(conversationId: string, userId: number, lastReadAt?: Date) {
    return this.prisma.conversationMessage.count({
      where: {
        conversationId,
        fromUserId: { not: userId },
        createdAt: lastReadAt ? { gt: lastReadAt } : undefined,
        isDeleted: false,
      },
    })
  }

  async isMessageAuthor(messageId: string, userId: number): Promise<boolean> {
    const message = await this.prisma.conversationMessage.findUnique({
      where: { id: messageId },
      select: { fromUserId: true },
    })
    return message?.fromUserId === userId
  }

  async getMessageStats(conversationId: string) {
    const [total, byType, mediaCount] = await Promise.all([
      this.prisma.conversationMessage.count({
        where: { conversationId, isDeleted: false },
      }),
      this.prisma.conversationMessage.groupBy({
        by: ['type'],
        where: { conversationId, isDeleted: false },
        _count: { type: true },
      }),
      this.prisma.messageAttachment.count({
        where: {
          message: { conversationId },
        },
      }),
    ])

    return {
      total,
      byType: byType.reduce(
        (acc, item) => {
          acc[item.type] = item._count.type
          return acc
        },
        {} as Record<string, number>,
      ),
      mediaCount,
    }
  }

  // ===== PRIVATE HELPER METHODS =====

  private async getSearchFacets(conversationIds: string[], query: string) {
    const [byType, byUser, byConversation] = await Promise.all([
      // Facets by message type
      this.prisma.conversationMessage.groupBy({
        by: ['type'],
        where: {
          conversationId: { in: conversationIds },
          content: { contains: query, mode: 'insensitive' },
          isDeleted: false,
        },
        _count: { type: true },
      }),
      // Facets by user
      this.prisma.conversationMessage.groupBy({
        by: ['fromUserId'],
        where: {
          conversationId: { in: conversationIds },
          content: { contains: query, mode: 'insensitive' },
          isDeleted: false,
        },
        _count: { fromUserId: true },
      }),
      // Facets by conversation
      this.prisma.conversationMessage.groupBy({
        by: ['conversationId'],
        where: {
          conversationId: { in: conversationIds },
          content: { contains: query, mode: 'insensitive' },
          isDeleted: false,
        },
        _count: { conversationId: true },
      }),
    ])

    return {
      byType: byType.reduce(
        (acc, item) => {
          acc[item.type] = item._count.type
          return acc
        },
        {} as Record<string, number>,
      ),
      byUser: byUser.reduce(
        (acc, item) => {
          acc[item.fromUserId.toString()] = item._count.fromUserId
          return acc
        },
        {} as Record<string, number>,
      ),
      byConversation: byConversation.reduce(
        (acc, item) => {
          acc[item.conversationId] = item._count.conversationId
          return acc
        },
        {} as Record<string, number>,
      ),
    }
  }

  private getMessageInclude() {
    return {
      fromUser: {
        select: {
          id: true,
          name: true,
          email: true,
          avatar: true,
          status: true,
        },
      },
      replyTo: {
        select: {
          id: true,
          content: true,
          type: true,
          fromUserId: true,
          createdAt: true,
          isDeleted: true,
          deletedForEveryone: true,
          fromUser: {
            select: {
              id: true,
              name: true,
              email: true,
              avatar: true,
              status: true,
            },
          },
          attachments: {
            select: {
              id: true,
              type: true,
              fileName: true,
              fileUrl: true,
              thumbnail: true,
              width: true,
              height: true,
            },
          },
        },
      },
      attachments: {
        orderBy: { createdAt: 'asc' as const },
      },
      reactions: {
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              avatar: true,
              status: true,
            },
          },
        },
        orderBy: { createdAt: 'asc' as const },
      },
      readReceipts: {
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              avatar: true,
              status: true,
            },
          },
        },
        orderBy: { readAt: 'asc' as const },
      },
    }
  }

  private getMessageIncludeWithConversation() {
    return {
      ...this.getMessageInclude(),
      conversation: {
        select: {
          id: true,
          name: true,
          type: true,
          avatar: true,
        },
      },
    }
  }

  /**
   * Normalize message to ensure arrays are never undefined
   * Prisma returns undefined for empty relations, but Zod schema expects empty arrays
   */
  private normalizeMessage(message: any) {
    return {
      id: message.id,
      conversationId: message.conversationId,
      fromUserId: message.fromUserId,
      content: message.content,
      type: message.type,
      replyToId: message.replyToId,
      isEdited: message.isEdited,
      editedAt: message.editedAt,
      isDeleted: message.isDeleted,
      deletedAt: message.deletedAt,
      deletedForEveryone: message.deletedForEveryone,
      createdAt: message.createdAt,
      updatedAt: message.updatedAt,
      fromUser: message.fromUser,
      replyTo: message.replyTo
        ? {
            ...message.replyTo,
            attachments: message.replyTo.attachments || [],
          }
        : null,
      attachments: message.attachments || [],
      reactions: message.reactions || [],
      readReceipts: message.readReceipts || [],
      // Preserve conversation field if exists (for search results)
      conversation: message.conversation || undefined,
    }
  }
}
