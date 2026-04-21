import { Injectable, Logger } from '@nestjs/common'
import { Server } from 'socket.io'
import { MessageService } from 'src/routes/conversation/message.service'
import { ConversationService } from 'src/routes/conversation/conversation.service'
import { ConversationRepository } from 'src/routes/conversation/conversation.repo'
import { AuthenticatedSocket } from '../websocket.interfaces'
import { emitValidationError, emitUnauthorizedError, emitInternalError } from '../websocket.helpers'
import {
  JoinConversationDataSchema,
  MarkAsReadDataSchema,
  ReactToMessageDataSchema,
  validateWebSocketData,
  JoinConversationDataType,
  MarkAsReadDataType,
  ReactToMessageDataType,
} from '../websocket.schemas'

// Re-export types for backward compatibility
export type JoinConversationData = JoinConversationDataType
export type MarkAsReadData = MarkAsReadDataType
export type ReactToMessageData = ReactToMessageDataType

@Injectable()
export class ChatInteractionHandler {
  private readonly logger = new Logger(ChatInteractionHandler.name)

  constructor(
    private readonly messageService: MessageService,
    private readonly conversationService: ConversationService,
    private readonly conversationRepo: ConversationRepository,
  ) {}

  /**
   * Xử lý join conversation
   */
  async handleJoinConversation(server: Server, client: AuthenticatedSocket, data: unknown): Promise<void> {
    // Validate input data
    const validation = validateWebSocketData(JoinConversationDataSchema, data)
    if (!validation.success) {
      emitValidationError(client, 'join_conversation', validation.error!)
      return
    }

    const validData = validation.data!

    try {
      // Verify user is member of conversation
      const isMember = await this.conversationService.isUserInConversation(validData.conversationId, client.userId)
      if (!isMember) {
        emitUnauthorizedError(client, 'join_conversation', 'Not a member of this conversation')
        return
      }

      // Join conversation room
      await client.join(`conversation:${validData.conversationId}`)

      // Notify others that user joined
      client.to(`conversation:${validData.conversationId}`).emit('user_joined_conversation', {
        conversationId: validData.conversationId,
        userId: client.userId,
        user: client.user,
        timestamp: new Date(),
      })

      // Send confirmation to user
      client.emit('joined_conversation', {
        conversationId: validData.conversationId,
        message: 'Successfully joined conversation',
        timestamp: new Date(),
      })

      this.logger.debug(`User ${client.userId} joined conversation ${validData.conversationId}`)
    } catch (error) {
      this.logger.error(`Join conversation error: ${error.message}`)
      emitInternalError(client, 'join_conversation', error.message)
    }
  }

  /**
   * Xử lý leave conversation
   */
  async handleLeaveConversation(server: Server, client: AuthenticatedSocket, data: unknown): Promise<void> {
    // Validate input data (reuse JoinConversationDataSchema since structure is same)
    const validation = validateWebSocketData(JoinConversationDataSchema, data)
    if (!validation.success) {
      emitValidationError(client, 'leave_conversation', validation.error!)
      return
    }

    const validData = validation.data!

    try {
      // Leave conversation room
      await client.leave(`conversation:${validData.conversationId}`)

      // Notify others that user left
      client.to(`conversation:${validData.conversationId}`).emit('user_left_conversation', {
        conversationId: validData.conversationId,
        userId: client.userId,
        user: client.user,
        timestamp: new Date(),
      })

      client.emit('left_conversation', {
        conversationId: validData.conversationId,
        message: 'Left conversation successfully',
        timestamp: new Date(),
      })

      this.logger.debug(`User ${client.userId} left conversation ${validData.conversationId}`)
    } catch (error) {
      this.logger.error(`Leave conversation error: ${error.message}`)
      emitInternalError(client, 'leave_conversation', error.message)
    }
  }

  /**
   * Xử lý mark as read
   */
  async handleMarkAsRead(server: Server, client: AuthenticatedSocket, data: unknown): Promise<void> {
    // Validate input data
    const validation = validateWebSocketData(MarkAsReadDataSchema, data)
    if (!validation.success) {
      emitValidationError(client, 'mark_as_read', validation.error!)
      return
    }

    const validData = validation.data!

    try {
      const result = await this.messageService.markAsRead(validData.conversationId, client.userId, validData.messageId)

      // Notify conversation members about read receipt (exclude sender)
      client.to(`conversation:${validData.conversationId}`).emit('messages_read', {
        conversationId: validData.conversationId,
        messageId: validData.messageId,
        userId: client.userId,
        user: client.user,
        readAt: new Date(),
        markedCount: result.markedCount,
      })

      client.emit('mark_as_read_success', {
        conversationId: validData.conversationId,
        markedCount: result.markedCount,
        timestamp: new Date(),
      })
    } catch (error) {
      this.logger.error(`Mark as read error: ${error.message}`)
      emitInternalError(client, 'mark_as_read', error.message)
    }
  }

  /**
   * Xử lý react to message
   */
  async handleReactToMessage(server: Server, client: AuthenticatedSocket, data: unknown): Promise<void> {
    // Validate input data
    const validation = validateWebSocketData(ReactToMessageDataSchema, data)
    if (!validation.success) {
      emitValidationError(client, 'react_to_message', validation.error!)
      return
    }

    const validData = validation.data!

    try {
      const result = await this.messageService.reactToMessage(validData.messageId, client.userId, validData.emoji)

      // Get message to find conversation
      const message = await this.messageService.getMessageById(validData.messageId, client.userId)

      // Emit to conversation members
      server.to(`conversation:${message.conversationId}`).emit('message_reaction_updated', {
        messageId: validData.messageId,
        action: result.action,
        emoji: validData.emoji,
        userId: client.userId,
        user: client.user,
        reaction: result.action === 'added' ? result.reaction : null,
        timestamp: new Date(),
      })

      client.emit('react_to_message_success', {
        messageId: validData.messageId,
        action: result.action,
        timestamp: new Date(),
      })
    } catch (error) {
      this.logger.error(`React to message error: ${error.message}`)
      emitInternalError(client, 'react_to_message', error.message)
    }
  }

  /**
   * Xử lý remove reaction
   */
  async handleRemoveReaction(server: Server, client: AuthenticatedSocket, data: unknown): Promise<void> {
    // Validate input data
    const validation = validateWebSocketData(ReactToMessageDataSchema, data)
    if (!validation.success) {
      emitValidationError(client, 'remove_reaction', validation.error!)
      return
    }

    const validData = validation.data!

    try {
      await this.messageService.removeReaction(validData.messageId, client.userId, validData.emoji)

      // Get message to find conversation
      const message = await this.messageService.getMessageById(validData.messageId, client.userId)

      // Emit to conversation members
      server.to(`conversation:${message.conversationId}`).emit('message_reaction_removed', {
        messageId: validData.messageId,
        emoji: validData.emoji,
        userId: client.userId,
        user: client.user,
        timestamp: new Date(),
      })

      client.emit('remove_reaction_success', {
        messageId: validData.messageId,
        emoji: validData.emoji,
        timestamp: new Date(),
      })
    } catch (error) {
      this.logger.error(`Remove reaction error: ${error.message}`)
      client.emit('error', {
        event: 'remove_reaction',
        message: error.message,
      })
    }
  }

  /**
   * Notify user online status to conversations
   */
  async notifyUserOnlineStatus(
    server: Server,
    userId: number,
    isOnline: boolean,
    conversationIds?: string[],
  ): Promise<void> {
    try {
      let conversations: string[] = []

      if (conversationIds) {
        conversations = conversationIds
      } else {
        // Use lightweight query to get only conversation IDs
        conversations = await this.conversationRepo.findUserConversationIds(userId)
      }

      const event = isOnline ? 'user_online' : 'user_offline'
      const eventData = {
        userId,
        timestamp: new Date(),
        ...(isOnline ? {} : { lastSeen: new Date() }),
      }

      // Notify all conversation members
      conversations.forEach((conversationId) => {
        server.to(`conversation:${conversationId}`).emit(event, {
          ...eventData,
          conversationId,
        })
      })
    } catch (error) {
      this.logger.error(`Notify online status error: ${error.message}`)
    }
  }

  /**
   * Broadcast system message to conversation
   */
  async broadcastSystemMessage(
    server: Server,
    conversationId: string,
    content: string,
    fromUserId?: number,
  ): Promise<any> {
    try {
      if (fromUserId) {
        // Persist system message with valid sender
        const systemMessage = await this.messageService.sendMessage(fromUserId, {
          conversationId,
          content,
          type: 'SYSTEM' as const,
        })

        // Broadcast persisted message to conversation members
        server.to(`conversation:${conversationId}`).emit('new_message', {
          message: systemMessage,
          timestamp: new Date(),
        })

        return systemMessage
      }

      // No sender - emit directly without persisting to database
      const systemEvent = {
        content,
        type: 'SYSTEM',
        conversationId,
        timestamp: new Date(),
      }

      server.to(`conversation:${conversationId}`).emit('new_message', {
        message: systemEvent,
        timestamp: new Date(),
      })

      return systemEvent
    } catch (error) {
      this.logger.error(`Broadcast system message error: ${error.message}`)
      throw error
    }
  }

  /**
   * Notify conversation update
   */
  notifyConversationUpdate(
    server: Server,
    conversationId: string,
    updateType: string,
    data: Record<string, unknown>,
  ): void {
    server.to(`conversation:${conversationId}`).emit('conversation_updated', {
      conversationId,
      type: updateType,
      data,
      timestamp: new Date(),
    })
  }

  /**
   * Send notification to specific user
   */
  notifyUser(server: Server, userId: number, event: string, data: Record<string, unknown>): void {
    server.to(`user:${userId}`).emit(event, {
      ...data,
      timestamp: new Date(),
    })
  }
}
