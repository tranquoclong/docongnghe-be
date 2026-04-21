import { Injectable } from '@nestjs/common'
import { PrismaService } from 'src/shared/services/prisma.service'
import { AIMessageRole, Prisma } from '@prisma/client'

@Injectable()
export class AIAssistantRepo {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Tạo AI conversation mới
   */
  createConversation(data: { userId: number; title?: string; context?: any }) {
    return this.prisma.aIConversation.create({
      data: {
        userId: data.userId,
        title: data.title,
        context: data.context || {},
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            avatar: true,
          },
        },
        _count: {
          select: {
            messages: true,
          },
        },
      },
    })
  }

  /**
   * Lấy conversation theo ID và verify ownership
   */
  getConversationById(conversationId: string, userId: number) {
    return this.prisma.aIConversation.findFirst({
      where: {
        id: conversationId,
        userId: userId,
        isActive: true,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            avatar: true,
          },
        },
        messages: {
          orderBy: {
            createdAt: 'asc',
          },
          select: {
            id: true,
            role: true,
            content: true,
            responseTime: true,
            model: true,
            error: true,
            createdAt: true,
          },
        },
      },
    })
  }

  /**
   * Lấy danh sách conversations của user với pagination
   */
  async getUserConversations(userId: number, page: number = 1, limit: number = 20) {
    const skip = (page - 1) * limit

    const [conversations, total] = await Promise.all([
      this.prisma.aIConversation.findMany({
        where: {
          userId: userId,
          isActive: true,
        },
        include: {
          _count: {
            select: {
              messages: true,
            },
          },
          messages: {
            take: 1,
            orderBy: {
              createdAt: 'desc',
            },
            select: {
              content: true,
              role: true,
              createdAt: true,
            },
          },
        },
        orderBy: {
          updatedAt: 'desc',
        },
        skip,
        take: limit,
      }),
      this.prisma.aIConversation.count({
        where: {
          userId: userId,
          isActive: true,
        },
      }),
    ])

    return {
      conversations: conversations.map((conv) => ({
        ...conv,
        lastMessage: conv.messages[0] || null,
        messages: undefined, // Remove messages array, keep only lastMessage
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasNext: page < Math.ceil(total / limit),
        hasPrev: page > 1,
      },
    }
  }

  /**
   * Tạo message mới trong conversation
   */
  async createMessage(data: {
    conversationId: string
    role: AIMessageRole
    content: string
    tokenCount?: number
    responseTime?: number
    model?: string
    error?: string
    contextUsed?: any
  }) {
    // Tạo message
    const message = await this.prisma.aIMessage.create({
      data: {
        conversationId: data.conversationId,
        role: data.role,
        content: data.content,
        tokenCount: data.tokenCount,
        responseTime: data.responseTime,
        model: data.model,
        error: data.error,
        contextUsed: data.contextUsed,
      },
      select: {
        id: true,
        role: true,
        content: true,
        responseTime: true,
        model: true,
        error: true,
        createdAt: true,
      },
    })

    // Update conversation updatedAt
    await this.prisma.aIConversation.update({
      where: { id: data.conversationId },
      data: { updatedAt: new Date() },
    })

    return message
  }

  /**
   * Update conversation
   */
  updateConversation(
    conversationId: string,
    data: Partial<{
      title: string
      context: any
      isActive: boolean
      isArchived: boolean
    }>,
  ) {
    return this.prisma.aIConversation.update({
      where: { id: conversationId },
      data: {
        ...data,
        updatedAt: new Date(),
      },
    })
  }

  /**
   * Soft delete conversation
   */
  deleteConversation(conversationId: string) {
    return this.prisma.aIConversation.update({
      where: { id: conversationId },
      data: {
        isActive: false,
        updatedAt: new Date(),
      },
    })
  }

  /**
   * Lấy archived conversations
   */
  async getArchivedConversations(userId: number, page: number = 1, limit: number = 20) {
    const skip = (page - 1) * limit

    const [conversations, total] = await Promise.all([
      this.prisma.aIConversation.findMany({
        where: {
          userId: userId,
          isActive: true,
          isArchived: true,
        },
        include: {
          _count: {
            select: {
              messages: true,
            },
          },
          messages: {
            take: 1,
            orderBy: {
              createdAt: 'desc',
            },
            select: {
              content: true,
              role: true,
              createdAt: true,
            },
          },
        },
        orderBy: {
          updatedAt: 'desc',
        },
        skip,
        take: limit,
      }),
      this.prisma.aIConversation.count({
        where: {
          userId: userId,
          isActive: true,
          isArchived: true,
        },
      }),
    ])

    return {
      conversations: conversations.map((conv) => ({
        ...conv,
        lastMessage: conv.messages[0] || null,
        messages: undefined,
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasNext: page < Math.ceil(total / limit),
        hasPrev: page > 1,
      },
    }
  }

  /**
   * Search messages trong conversations của user
   */
  async searchMessages(userId: number, query: string, page: number = 1, limit: number = 20) {
    const skip = (page - 1) * limit

    const [messages, total] = await Promise.all([
      this.prisma.aIMessage.findMany({
        where: {
          conversation: {
            userId: userId,
            isActive: true,
          },
          content: {
            contains: query,
            mode: 'insensitive',
          },
        },
        include: {
          conversation: {
            select: {
              id: true,
              title: true,
              createdAt: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
        skip,
        take: limit,
      }),
      this.prisma.aIMessage.count({
        where: {
          conversation: {
            userId: userId,
            isActive: true,
          },
          content: {
            contains: query,
            mode: 'insensitive',
          },
        },
      }),
    ])

    return {
      messages,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasNext: page < Math.ceil(total / limit),
        hasPrev: page > 1,
      },
    }
  }

  /**
   * Lấy thống kê conversations của user
   */
  async getUserStats(userId: number) {
    const [totalConversations, totalMessages, totalTokens, avgResponseTime, recentActivity] = await Promise.all([
      // Total active conversations
      this.prisma.aIConversation.count({
        where: {
          userId: userId,
          isActive: true,
        },
      }),
      // Total messages
      this.prisma.aIMessage.count({
        where: {
          conversation: {
            userId: userId,
            isActive: true,
          },
        },
      }),
      // Total tokens consumed
      this.prisma.aIMessage.aggregate({
        where: {
          conversation: {
            userId: userId,
            isActive: true,
          },
          role: AIMessageRole.ASSISTANT,
          tokenCount: {
            not: null,
          },
        },
        _sum: {
          tokenCount: true,
        },
      }),
      // Average response time
      this.prisma.aIMessage.aggregate({
        where: {
          conversation: {
            userId: userId,
            isActive: true,
          },
          role: AIMessageRole.ASSISTANT,
          responseTime: {
            not: null,
          },
        },
        _avg: {
          responseTime: true,
        },
      }),
      // Recent activity (last 7 days)
      this.prisma.aIMessage.count({
        where: {
          conversation: {
            userId: userId,
            isActive: true,
          },
          createdAt: {
            gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
          },
        },
      }),
    ])

    return {
      totalConversations,
      totalMessages,
      totalTokens: totalTokens._sum.tokenCount || 0,
      avgResponseTime: Math.round(avgResponseTime._avg.responseTime || 0),
      recentActivity,
    }
  }
}
