import { Injectable, Logger } from '@nestjs/common'
import { Server } from 'socket.io'
import { ConversationService } from 'src/routes/conversation/conversation.service'
import { ChatRedisService } from '../services/chat-redis.service'
import { AuthenticatedSocket } from '../websocket.interfaces'
import { emitValidationError } from '../websocket.helpers'
import { TypingDataSchema, validateWebSocketData, TypingDataType } from '../websocket.schemas'

// Re-export type for backward compatibility
export type TypingData = TypingDataType

@Injectable()
export class ChatTypingHandler {
  private readonly logger = new Logger(ChatTypingHandler.name)

  // Track typing timeouts to prevent memory leaks
  // Key format: `${conversationId}:${userId}`
  private typingTimeouts: Map<string, ReturnType<typeof setTimeout>> = new Map()

  constructor(
    private readonly conversationService: ConversationService,
    private readonly redisService: ChatRedisService,
  ) {}

  /**
   * Generate key for typing timeout map
   */
  private getTypingKey(conversationId: string, userId: number): string {
    return `${conversationId}:${userId}`
  }

  /**
   * Clear existing typing timeout for user in conversation
   */
  private clearTypingTimeout(conversationId: string, userId: number): void {
    const key = this.getTypingKey(conversationId, userId)
    const existingTimeout = this.typingTimeouts.get(key)
    if (existingTimeout) {
      clearTimeout(existingTimeout)
      this.typingTimeouts.delete(key)
    }
  }

  /**
   * Xử lý bắt đầu typing
   */
  async handleTypingStart(server: Server, client: AuthenticatedSocket, data: unknown): Promise<void> {
    // Validate input data
    const validation = validateWebSocketData(TypingDataSchema, data)
    if (!validation.success) {
      emitValidationError(client, 'typing_start', validation.error!)
      return
    }

    const validData = validation.data!

    try {
      // Verify user is member
      const isMember = await this.conversationService.isUserInConversation(validData.conversationId, client.userId)
      if (!isMember) return

      // Clear any existing timeout for this user/conversation (prevents duplicate timeouts)
      this.clearTypingTimeout(validData.conversationId, client.userId)

      // Add user to typing list in Redis (10 giây TTL)
      await this.redisService.setUserTyping(validData.conversationId, client.userId, 10)

      // Notify others in conversation (exclude sender)
      client.to(`conversation:${validData.conversationId}`).emit('user_typing', {
        conversationId: validData.conversationId,
        userId: client.userId,
        user: client.user,
        timestamp: new Date(),
      })

      // Auto-remove after 10 seconds (store reference for cleanup)
      const key = this.getTypingKey(validData.conversationId, client.userId)
      const timeoutId = setTimeout(() => {
        // Remove from map first
        this.typingTimeouts.delete(key)
        // Then handle stop
        void this.handleTypingStopInternal(server, client, validData.conversationId)
      }, 10000)

      this.typingTimeouts.set(key, timeoutId)
    } catch (error) {
      this.logger.error(`Typing start error: ${error.message}`)
    }
  }

  /**
   * Xử lý dừng typing
   */
  async handleTypingStop(server: Server, client: AuthenticatedSocket, data: unknown): Promise<void> {
    // Validate input data
    const validation = validateWebSocketData(TypingDataSchema, data)
    if (!validation.success) {
      emitValidationError(client, 'typing_stop', validation.error!)
      return
    }

    const validData = validation.data!
    await this.handleTypingStopInternal(server, client, validData.conversationId)
  }

  /**
   * Internal method to handle typing stop (used by both manual stop and auto-timeout)
   */
  private async handleTypingStopInternal(
    server: Server,
    client: AuthenticatedSocket,
    conversationId: string,
  ): Promise<void> {
    try {
      // Clear the auto-stop timeout if user manually stopped typing
      this.clearTypingTimeout(conversationId, client.userId)

      // Remove user from typing list in Redis
      await this.redisService.removeUserTyping(conversationId, client.userId)

      // Notify others that user stopped typing (exclude sender)
      client.to(`conversation:${conversationId}`).emit('user_stopped_typing', {
        conversationId,
        userId: client.userId,
        timestamp: new Date(),
      })
    } catch (error) {
      this.logger.error(`Typing stop error: ${error.message}`)
    }
  }

  /**
   * Remove user khỏi tất cả typing khi disconnect
   */
  async removeUserFromAllTyping(server: Server, userId: number): Promise<void> {
    try {
      // Clear all typing timeouts for this user (prevents memory leak on disconnect)
      const keysToDelete: string[] = []
      for (const [key, timeoutId] of this.typingTimeouts.entries()) {
        if (key.endsWith(`:${userId}`)) {
          clearTimeout(timeoutId)
          keysToDelete.push(key)
        }
      }
      keysToDelete.forEach((key) => this.typingTimeouts.delete(key))

      if (keysToDelete.length > 0) {
        this.logger.debug(`Cleared ${keysToDelete.length} typing timeouts for user ${userId}`)
      }

      // Remove từ Redis
      await this.redisService.removeUserFromAllTyping(userId)

      // Cleanup database typing indicators
      // Note: Database cleanup sẽ được handle bởi cleanup task

      this.logger.debug(`Removed user ${userId} from all typing indicators`)
    } catch (error) {
      this.logger.error(`Error removing user ${userId} from all typing:`, error)
    }
  }

  /**
   * Lấy danh sách users đang typing trong conversation
   */
  async getTypingUsers(conversationId: string): Promise<number[]> {
    try {
      return this.redisService.getTypingUsers(conversationId)
    } catch (error) {
      this.logger.error(`Error getting typing users for conversation ${conversationId}:`, error)
      return []
    }
  }

  /**
   * Cleanup expired typing indicators (call định kỳ)
   * Redis handles TTL-based expiry automatically, this is a no-op placeholder
   * for the periodic cleanup interval in EnhancedChatGateway.
   */
  async cleanupExpiredTypingIndicators(): Promise<void> {
    // Redis handles TTL-based expiry automatically — no database cleanup needed
    this.logger.debug('Typing indicator cleanup tick (Redis TTL handles expiry)')
  }

  /**
   * Get count of active typing timeouts (for monitoring/debugging)
   */
  getActiveTypingTimeoutsCount(): number {
    return this.typingTimeouts.size
  }
}
