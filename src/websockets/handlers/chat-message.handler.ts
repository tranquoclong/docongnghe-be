import { Injectable, Logger } from '@nestjs/common'
import { Server } from 'socket.io'
import { MessageService } from 'src/routes/conversation/message.service'
import { ConversationService } from 'src/routes/conversation/conversation.service'
import { ChatRedisService } from '../services/chat-redis.service'
import { AuthenticatedSocket } from '../websocket.interfaces'
import { emitValidationError, emitInternalError } from '../websocket.helpers'
import {
  SendMessageDataSchema,
  EditMessageDataSchema,
  DeleteMessageDataSchema,
  validateWebSocketData,
  SendMessageDataType,
  EditMessageDataType,
  DeleteMessageDataType,
} from '../websocket.schemas'

// Re-export types for backward compatibility
export type SendMessageData = SendMessageDataType
export type EditMessageData = EditMessageDataType
export type DeleteMessageData = DeleteMessageDataType

@Injectable()
export class ChatMessageHandler {
  private readonly logger = new Logger(ChatMessageHandler.name)

  constructor(
    private readonly messageService: MessageService,
    private readonly conversationService: ConversationService,
    private readonly redisService: ChatRedisService,
  ) {}

  /**
   * Xử lý gửi tin nhắn
   */
  async handleSendMessage(server: Server, client: AuthenticatedSocket, data: unknown): Promise<void> {
    // Validate input data
    const validation = validateWebSocketData(SendMessageDataSchema, data)
    if (!validation.success) {
      emitValidationError(client, 'send_message', validation.error!)
      return
    }

    const validData = validation.data!

    try {
      // Send message through service
      const message = await this.messageService.sendMessage(client.userId, {
        conversationId: validData.conversationId,
        content: validData.content,
        type: validData.type,
        replyToId: validData.replyToId,
        attachments: validData.attachments,
      })

      // Remove user from typing
      await this.redisService.removeUserTyping(validData.conversationId, client.userId)

      // Emit to conversation members
      server.to(`conversation:${validData.conversationId}`).emit('new_message', {
        message,
        tempId: validData.tempId,
        timestamp: new Date(),
      })

      // Send delivery confirmation to sender
      client.emit('message_sent', {
        message,
        tempId: validData.tempId,
        timestamp: new Date(),
      })

      // Send offline notifications
      await this.sendOfflineNotifications(server, validData.conversationId, message, client.userId)

      this.logger.debug(`Message sent by user ${client.userId} in conversation ${validData.conversationId}`)
    } catch (error) {
      this.logger.error(`Send message error: ${error.message}`)
      emitInternalError(client, 'send_message', error.message)
    }
  }

  /**
   * Xử lý chỉnh sửa tin nhắn
   */
  async handleEditMessage(server: Server, client: AuthenticatedSocket, data: unknown): Promise<void> {
    // Validate input data
    const validation = validateWebSocketData(EditMessageDataSchema, data)
    if (!validation.success) {
      emitValidationError(client, 'edit_message', validation.error!)
      return
    }

    const validData = validation.data!

    try {
      const message = await this.messageService.editMessage(validData.messageId, client.userId, validData.content)

      // Emit to conversation members
      server.to(`conversation:${message.conversationId}`).emit('message_edited', {
        message,
        timestamp: new Date(),
      })

      client.emit('message_edit_success', {
        message,
        timestamp: new Date(),
      })
    } catch (error) {
      this.logger.error(`Edit message error: ${error.message}`)
      emitInternalError(client, 'edit_message', error.message)
    }
  }

  /**
   * Xử lý xóa tin nhắn
   */
  async handleDeleteMessage(server: Server, client: AuthenticatedSocket, data: unknown): Promise<void> {
    // Validate input data
    const validation = validateWebSocketData(DeleteMessageDataSchema, data)
    if (!validation.success) {
      emitValidationError(client, 'delete_message', validation.error!)
      return
    }

    const validData = validation.data!

    try {
      const message = await this.messageService.deleteMessage(validData.messageId, client.userId, validData.forEveryone)

      // Emit to conversation members
      server.to(`conversation:${message.conversationId}`).emit('message_deleted', {
        message,
        forEveryone: validData.forEveryone,
        timestamp: new Date(),
      })

      client.emit('message_delete_success', {
        message,
        timestamp: new Date(),
      })
    } catch (error) {
      this.logger.error(`Delete message error: ${error.message}`)
      emitInternalError(client, 'delete_message', error.message)
    }
  }

  /**
   * Gửi thông báo offline (placeholder for notification service)
   */
  private async sendOfflineNotifications(
    server: Server,
    conversationId: string,
    message: { id: string; content?: string; fromUser?: { name: string }; [key: string]: unknown },
    senderId: number,
  ): Promise<void> {
    try {
      const conversation = await this.conversationService.getConversationById(conversationId, senderId)
      if (!conversation) return

      const eligibleMembers = conversation.members.filter(
        (member) => member.userId !== senderId && member.isActive && !member.isMuted,
      )

      if (eligibleMembers.length === 0) return

      const onlineStatusMap = await this.redisService.areUsersOnline(eligibleMembers.map((m) => m.userId))

      const offlineMembers: Array<{ userId: number; name: string }> = eligibleMembers
        .filter((member) => !onlineStatusMap.get(member.userId))
        .map((member) => ({
          userId: member.userId,
          name: member.user.name,
        }))

      if (offlineMembers.length > 0) {
        this.logger.log(
          `Would send push notification to ${offlineMembers.length} offline users for message: ${message.id}`,
        )

        // TODO: Integrate with push notification service
      }
    } catch (error) {
      this.logger.error(`Send offline notifications error: ${error.message}`)
    }
  }
}
