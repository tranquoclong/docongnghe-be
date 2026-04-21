import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets'
import { Server, Socket } from 'socket.io'
import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common'

// Import handlers
import { ChatConnectionHandler } from './handlers/chat-connection.handler'
import { ChatMessageHandler } from './handlers/chat-message.handler'
import { ChatTypingHandler } from './handlers/chat-typing.handler'
import { ChatInteractionHandler } from './handlers/chat-interaction.handler'
import { AuthenticatedSocket } from './websocket.interfaces'

// Import services
import { ChatRedisService } from './services/chat-redis.service'
import { ConversationRepository } from 'src/routes/conversation/conversation.repo'
import { TokenBucketRateLimiter, RateLimitConfig } from './utils/rate-limiter'

/**
 * Get CORS allowed origins - mirrors WebsocketAdapter configuration
 */
function getCorsOrigins(): string[] | boolean {
  const corsOrigins = process.env.CORS_ORIGINS
  if (corsOrigins) {
    return corsOrigins.split(',').map((origin) => origin.trim())
  }
  if (process.env.NODE_ENV === 'production') {
    return false
  }
  return ['http://localhost:3000', 'http://localhost:3001', 'http://127.0.0.1:3000', 'http://127.0.0.1:3001']
}

@Injectable()
@WebSocketGateway({
  namespace: '/chat',
  cors: {
    origin: getCorsOrigins(),
    credentials: true,
  },
  transports: ['websocket', 'polling'],
})
export class EnhancedChatGateway implements OnGatewayConnection, OnGatewayDisconnect, OnModuleDestroy {
  @WebSocketServer()
  server: Server

  private readonly logger = new Logger(EnhancedChatGateway.name)

  // Store interval reference for cleanup (fix memory leak)
  private cleanupIntervalId: ReturnType<typeof setInterval> | null = null
  private readonly rateLimiter: TokenBucketRateLimiter

  constructor(
    private readonly connectionHandler: ChatConnectionHandler,
    private readonly messageHandler: ChatMessageHandler,
    private readonly typingHandler: ChatTypingHandler,
    private readonly interactionHandler: ChatInteractionHandler,
    private readonly redisService: ChatRedisService,
    private readonly conversationRepo: ConversationRepository,
  ) {
    // Initialize rate limiter with default limits
    const rateLimits = new Map<string, RateLimitConfig>([
      ['send_message', { tokens: 10, intervalMs: 60_000 }],
      ['typing_start', { tokens: 30, intervalMs: 60_000 }],
      ['typing_stop', { tokens: 30, intervalMs: 60_000 }],
      ['react_to_message', { tokens: 20, intervalMs: 60_000 }],
      ['remove_reaction', { tokens: 20, intervalMs: 60_000 }],
      ['edit_message', { tokens: 10, intervalMs: 60_000 }],
      ['delete_message', { tokens: 10, intervalMs: 60_000 }],
    ])
    this.rateLimiter = new TokenBucketRateLimiter(rateLimits)

    // Cleanup expired typing indicators every 30 seconds
    // Store reference for proper cleanup on shutdown
    this.cleanupIntervalId = setInterval(() => {
      void this.typingHandler.cleanupExpiredTypingIndicators()
    }, 30000)

    this.logger.log('EnhancedChatGateway initialized with typing cleanup interval')
  }

  /**
   * Cleanup on module destroy - prevents memory leak
   */
  onModuleDestroy(): void {
    if (this.cleanupIntervalId) {
      clearInterval(this.cleanupIntervalId)
      this.cleanupIntervalId = null
      this.logger.log('Cleared typing cleanup interval')
    }
  }

  // ===== CONNECTION MANAGEMENT =====

  async handleConnection(client: Socket) {
    const authSocket = await this.connectionHandler.handleConnection(client)

    if (authSocket) {
      // Notify user's conversations about online status
      await this.interactionHandler.notifyUserOnlineStatus(this.server, authSocket.userId, true)
    }
  }

  async handleDisconnect(client: AuthenticatedSocket) {
    if (client.userId) {
      this.logger.debug(`Socket ${client.id} disconnected (user: ${client.userId})`)

      const userWentOffline = await this.connectionHandler.handleDisconnect(client)

      if (userWentOffline) {
        // Notify offline status only if user completely went offline
        await this.interactionHandler.notifyUserOnlineStatus(this.server, client.userId, false)
      }

      // Remove from typing indicators
      await this.typingHandler.removeUserFromAllTyping(this.server, client.userId)

      // Cleanup rate limiter state for disconnected socket
      this.rateLimiter.cleanup(client.id)
    }
  }

  /**
   * Check rate limit for a socket event. Returns true if allowed, false if rate limited.
   * Emits 'rate_limited' event to client when blocked.
   */
  private checkRateLimit(client: AuthenticatedSocket, eventName: string): boolean {
    const result = this.rateLimiter.consume(client.id, eventName)
    if (!result.allowed) {
      client.emit('rate_limited', {
        event: eventName,
        code: 'RATE_LIMITED',
        message: `Rate limit exceeded for ${eventName}. Try again later.`,
        retryAfterMs: result.retryAfterMs,
        timestamp: new Date(),
      })
      return false
    }
    return true
  }

  // ===== CONVERSATION EVENTS =====

  @SubscribeMessage('join_conversation')
  async handleJoinConversation(@ConnectedSocket() client: AuthenticatedSocket, @MessageBody() data: unknown) {
    return this.interactionHandler.handleJoinConversation(this.server, client, data)
  }

  @SubscribeMessage('leave_conversation')
  async handleLeaveConversation(@ConnectedSocket() client: AuthenticatedSocket, @MessageBody() data: unknown) {
    return this.interactionHandler.handleLeaveConversation(this.server, client, data)
  }

  // ===== MESSAGE EVENTS =====

  @SubscribeMessage('send_message')
  async handleSendMessage(@ConnectedSocket() client: AuthenticatedSocket, @MessageBody() data: unknown) {
    if (!this.checkRateLimit(client, 'send_message')) return
    return this.messageHandler.handleSendMessage(this.server, client, data)
  }

  @SubscribeMessage('edit_message')
  async handleEditMessage(@ConnectedSocket() client: AuthenticatedSocket, @MessageBody() data: unknown) {
    if (!this.checkRateLimit(client, 'edit_message')) return
    return this.messageHandler.handleEditMessage(this.server, client, data)
  }

  @SubscribeMessage('delete_message')
  async handleDeleteMessage(@ConnectedSocket() client: AuthenticatedSocket, @MessageBody() data: unknown) {
    if (!this.checkRateLimit(client, 'delete_message')) return
    return this.messageHandler.handleDeleteMessage(this.server, client, data)
  }

  // ===== TYPING EVENTS =====

  @SubscribeMessage('typing_start')
  async handleTypingStart(@ConnectedSocket() client: AuthenticatedSocket, @MessageBody() data: unknown) {
    if (!this.checkRateLimit(client, 'typing_start')) return
    return this.typingHandler.handleTypingStart(this.server, client, data)
  }

  @SubscribeMessage('typing_stop')
  async handleTypingStop(@ConnectedSocket() client: AuthenticatedSocket, @MessageBody() data: unknown) {
    if (!this.checkRateLimit(client, 'typing_stop')) return
    return this.typingHandler.handleTypingStop(this.server, client, data)
  }

  // ===== MESSAGE INTERACTION EVENTS =====

  @SubscribeMessage('mark_as_read')
  async handleMarkAsRead(@ConnectedSocket() client: AuthenticatedSocket, @MessageBody() data: unknown) {
    return this.interactionHandler.handleMarkAsRead(this.server, client, data)
  }

  @SubscribeMessage('react_to_message')
  async handleReactToMessage(@ConnectedSocket() client: AuthenticatedSocket, @MessageBody() data: unknown) {
    if (!this.checkRateLimit(client, 'react_to_message')) return
    return this.interactionHandler.handleReactToMessage(this.server, client, data)
  }

  @SubscribeMessage('remove_reaction')
  async handleRemoveReaction(@ConnectedSocket() client: AuthenticatedSocket, @MessageBody() data: unknown) {
    if (!this.checkRateLimit(client, 'remove_reaction')) return
    return this.interactionHandler.handleRemoveReaction(this.server, client, data)
  }

  // ===== PUBLIC METHODS FOR EXTERNAL USE =====

  /**
   * Notify conversation members about updates
   */
  notifyConversationUpdate(conversationId: string, updateType: string, data: Record<string, unknown>): void {
    return this.interactionHandler.notifyConversationUpdate(this.server, conversationId, updateType, data)
  }

  /**
   * Send notification to specific user
   */
  notifyUser(userId: number, event: string, data: Record<string, unknown>): void {
    return this.interactionHandler.notifyUser(this.server, userId, event, data)
  }

  /**
   * Check if user is online
   */
  async isUserOnline(userId: number): Promise<boolean> {
    return this.connectionHandler.isUserOnline(userId)
  }

  /**
   * Get list of online users
   */
  async getOnlineUsers(): Promise<number[]> {
    return this.connectionHandler.getOnlineUsers()
  }

  /**
   * Get online users in specific conversation
   */
  async getOnlineUsersInConversation(conversationId: string): Promise<number[]> {
    try {
      // Get conversation member user IDs
      const members = await this.conversationRepo.getConversationMembers(conversationId)
      const memberUserIds = members.map((m) => m.userId)

      if (memberUserIds.length === 0) return []

      // Check which members are online
      const onlineStatusMap = await this.redisService.areUsersOnline(memberUserIds)

      // Return only members who are online
      return memberUserIds.filter((userId) => onlineStatusMap.get(userId))
    } catch (error) {
      this.logger.error(`Get online users in conversation error: ${error.message}`)
      return []
    }
  }

  /**
   * Broadcast system message to conversation
   */
  async broadcastSystemMessage(conversationId: string, content: string, fromUserId?: number): Promise<any> {
    return this.interactionHandler.broadcastSystemMessage(this.server, conversationId, content, fromUserId)
  }

  /**
   * Health check method
   */
  async healthCheck(): Promise<{ status: string; redis: boolean }> {
    const redisHealthy = await this.redisService.healthCheck()
    return {
      status: redisHealthy ? 'healthy' : 'degraded',
      redis: redisHealthy,
    }
  }
}
