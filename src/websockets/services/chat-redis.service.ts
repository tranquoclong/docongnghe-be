import { Inject, Injectable, Logger } from '@nestjs/common'
import Redis from 'ioredis'
import { SocketUserInfo } from '../websocket.interfaces'
import { CHAT_REDIS } from '../websocket.constants'

@Injectable()
export class ChatRedisService {
  private readonly logger = new Logger(ChatRedisService.name)

  // Redis key prefixes
  private readonly KEYS = {
    ONLINE_USERS: 'chat:online_users', // Set: userId -> set of socket IDs
    USER_SOCKETS: 'chat:user_sockets', // String: socketId -> JSON of user info
    TYPING_USERS: 'chat:typing', // Set: conversationId -> set of user IDs
    TYPING_EXPIRY: 'chat:typing_exp', // String: conversationId:userId -> expiry marker
    USER_CONVERSATIONS: 'chat:user_conversations', // String: userId -> JSON of conversation IDs
  } as const

  private readonly TTL = {
    ONLINE_USER: 3600, // 1 hour
    SOCKET_USER: 3600, // 1 hour
    TYPING: 10, // 10 seconds
    USER_CONVERSATIONS: 300, // 5 minutes
  } as const

  constructor(@Inject(CHAT_REDIS) private readonly redis: Redis) {}

  // ===== ONLINE USERS MANAGEMENT =====

  /**
   * Thêm user online với socket ID (atomic SADD)
   */
  async addOnlineUser(userId: number, socketId: string): Promise<void> {
    try {
      const userKey = `${this.KEYS.ONLINE_USERS}:${userId}`
      await this.redis.sadd(userKey, socketId)
      await this.redis.expire(userKey, this.TTL.ONLINE_USER)
    } catch (error) {
      this.logger.error(`Error adding online user ${userId}:`, error)
    }
  }

  /**
   * Xóa user offline hoặc remove socket ID (atomic SREM)
   */
  async removeOnlineUser(userId: number, socketId: string): Promise<boolean> {
    try {
      const userKey = `${this.KEYS.ONLINE_USERS}:${userId}`
      await this.redis.srem(userKey, socketId)
      const remaining = await this.redis.scard(userKey)
      if (remaining === 0) {
        await this.redis.del(userKey)
        return true // User went offline
      }
      return false // User still online
    } catch (error) {
      this.logger.error(`Error removing online user ${userId}:`, error)
      return false
    }
  }

  /**
   * Kiểm tra user có online không
   */
  async isUserOnline(userId: number): Promise<boolean> {
    try {
      const userKey = `${this.KEYS.ONLINE_USERS}:${userId}`
      const exists = await this.redis.exists(userKey)
      return exists === 1
    } catch (error) {
      this.logger.error(`Error checking online status for user ${userId}:`, error)
      return false
    }
  }

  /**
   * Batch check if multiple users are online using Redis pipeline EXISTS (single round-trip)
   */
  async areUsersOnline(userIds: number[]): Promise<Map<number, boolean>> {
    const result = new Map<number, boolean>()

    if (userIds.length === 0) {
      return result
    }

    try {
      const pipeline = this.redis.pipeline()
      for (const id of userIds) {
        pipeline.exists(`${this.KEYS.ONLINE_USERS}:${id}`)
      }
      const values = await pipeline.exec()

      for (let i = 0; i < userIds.length; i++) {
        // pipeline.exec() returns [error, result][] — result of EXISTS is 0 or 1
        const [err, exists] = values![i]
        result.set(userIds[i], !err && exists === 1)
      }
    } catch (error) {
      this.logger.error('Error batch checking online status:', error)
      for (const id of userIds) {
        result.set(id, false)
      }
    }

    return result
  }

  /**
   * Lấy danh sách tất cả users online
   */
  async getOnlineUsers(): Promise<number[]> {
    try {
      const pattern = `${this.KEYS.ONLINE_USERS}:*`
      const keys = await this.scanKeys(pattern)

      return keys
        .map((key) => {
          const userId = key.split(':').pop()
          return parseInt(userId!, 10)
        })
        .filter((id) => !isNaN(id))
    } catch (error) {
      this.logger.error('Error getting online users:', error)
      return []
    }
  }

  /**
   * Lấy socket IDs của user (atomic SMEMBERS)
   */
  async getUserSocketIds(userId: number): Promise<string[]> {
    try {
      const userKey = `${this.KEYS.ONLINE_USERS}:${userId}`
      return await this.redis.smembers(userKey)
    } catch (error) {
      this.logger.error(`Error getting socket IDs for user ${userId}:`, error)
      return []
    }
  }

  // ===== SOCKET USER INFO MANAGEMENT =====

  /**
   * Lưu thông tin user cho socket
   */
  async setSocketUser(socketId: string, userInfo: SocketUserInfo): Promise<void> {
    try {
      const socketKey = `${this.KEYS.USER_SOCKETS}:${socketId}`
      await this.redis.setex(socketKey, this.TTL.SOCKET_USER, JSON.stringify(userInfo))
    } catch (error) {
      this.logger.error(`Error setting socket user info for ${socketId}:`, error)
    }
  }

  /**
   * Lấy thông tin user từ socket ID
   */
  async getSocketUser(socketId: string): Promise<SocketUserInfo | null> {
    try {
      const socketKey = `${this.KEYS.USER_SOCKETS}:${socketId}`
      const userInfoJson = await this.redis.get(socketKey)
      return userInfoJson ? JSON.parse(userInfoJson) : null
    } catch (error) {
      this.logger.error(`Error getting socket user info for ${socketId}:`, error)
      return null
    }
  }

  /**
   * Xóa thông tin socket
   */
  async removeSocket(socketId: string): Promise<void> {
    try {
      const socketKey = `${this.KEYS.USER_SOCKETS}:${socketId}`
      await this.redis.del(socketKey)
    } catch (error) {
      this.logger.error(`Error removing socket ${socketId}:`, error)
    }
  }

  // ===== TYPING INDICATORS MANAGEMENT =====

  /**
   * Set user đang typing trong conversation (atomic SADD + per-user expiry key)
   */
  async setUserTyping(conversationId: string, userId: number, expiresInSeconds: number = 10): Promise<void> {
    try {
      const typingKey = `${this.KEYS.TYPING_USERS}:${conversationId}`
      const expiryKey = `${this.KEYS.TYPING_EXPIRY}:${conversationId}:${userId}`

      const pipeline = this.redis.pipeline()
      pipeline.sadd(typingKey, String(userId))
      pipeline.set(expiryKey, '1', 'EX', expiresInSeconds || this.TTL.TYPING)
      await pipeline.exec()
    } catch (error) {
      this.logger.error(`Error setting typing for user ${userId} in conversation ${conversationId}:`, error)
    }
  }

  /**
   * Remove user khỏi typing (atomic SREM + DEL expiry key)
   */
  async removeUserTyping(conversationId: string, userId: number): Promise<void> {
    try {
      const typingKey = `${this.KEYS.TYPING_USERS}:${conversationId}`
      const expiryKey = `${this.KEYS.TYPING_EXPIRY}:${conversationId}:${userId}`

      const pipeline = this.redis.pipeline()
      pipeline.srem(typingKey, String(userId))
      pipeline.del(expiryKey)
      await pipeline.exec()
    } catch (error) {
      this.logger.error(`Error removing typing for user ${userId} in conversation ${conversationId}:`, error)
    }
  }

  /**
   * Lấy danh sách users đang typing trong conversation (SMEMBERS + filter by expiry)
   */
  async getTypingUsers(conversationId: string): Promise<number[]> {
    try {
      const typingKey = `${this.KEYS.TYPING_USERS}:${conversationId}`
      const members = await this.redis.smembers(typingKey)

      if (members.length === 0) return []

      // Check which users still have valid expiry keys
      const pipeline = this.redis.pipeline()
      for (const member of members) {
        pipeline.exists(`${this.KEYS.TYPING_EXPIRY}:${conversationId}:${member}`)
      }
      const results = await pipeline.exec()

      const activeUsers: number[] = []
      const expiredUsers: string[] = []

      for (let i = 0; i < members.length; i++) {
        const [err, exists] = results![i]
        if (!err && exists === 1) {
          activeUsers.push(parseInt(members[i], 10))
        } else {
          expiredUsers.push(members[i])
        }
      }

      // Cleanup expired users from the Set
      if (expiredUsers.length > 0) {
        await this.redis.srem(typingKey, ...expiredUsers)
      }

      return activeUsers.filter((id) => !isNaN(id))
    } catch (error) {
      this.logger.error(`Error getting typing users for conversation ${conversationId}:`, error)
      return []
    }
  }

  /**
   * Remove user khỏi tất cả conversations typing
   */
  async removeUserFromAllTyping(userId: number): Promise<void> {
    try {
      const typingPattern = `${this.KEYS.TYPING_USERS}:*`
      const typingKeys = await this.scanKeys(typingPattern)

      if (typingKeys.length === 0) return

      // Remove user from all typing Sets and delete expiry keys
      const pipeline = this.redis.pipeline()
      for (const key of typingKeys) {
        const conversationId = key.replace(`${this.KEYS.TYPING_USERS}:`, '')
        pipeline.srem(key, String(userId))
        pipeline.del(`${this.KEYS.TYPING_EXPIRY}:${conversationId}:${userId}`)
      }
      await pipeline.exec()
    } catch (error) {
      this.logger.error(`Error removing user ${userId} from all typing:`, error)
    }
  }

  // ===== USER CONVERSATIONS CACHE =====

  /**
   * Cache danh sách conversations của user
   */
  async cacheUserConversations(userId: number, conversationIds: string[]): Promise<void> {
    try {
      const userConversationsKey = `${this.KEYS.USER_CONVERSATIONS}:${userId}`

      if (conversationIds.length === 0) {
        await this.redis.del(userConversationsKey)
        return
      }

      // Store as JSON với TTL
      await this.redis.setex(userConversationsKey, this.TTL.USER_CONVERSATIONS, JSON.stringify(conversationIds))
    } catch (error) {
      this.logger.error(`Error caching conversations for user ${userId}:`, error)
    }
  }

  /**
   * Lấy cached conversations của user
   */
  async getCachedUserConversations(userId: number): Promise<string[] | null> {
    try {
      const userConversationsKey = `${this.KEYS.USER_CONVERSATIONS}:${userId}`
      const conversationsJson = await this.redis.get(userConversationsKey)
      return conversationsJson ? JSON.parse(conversationsJson) : null
    } catch (error) {
      this.logger.error(`Error getting cached conversations for user ${userId}:`, error)
      return null
    }
  }

  /**
   * Invalidate cache conversations của user
   */
  async invalidateUserConversations(userId: number): Promise<void> {
    try {
      const userConversationsKey = `${this.KEYS.USER_CONVERSATIONS}:${userId}`
      await this.redis.del(userConversationsKey)
    } catch (error) {
      this.logger.error(`Error invalidating conversations cache for user ${userId}:`, error)
    }
  }

  // ===== UTILITY METHODS =====

  /**
   * Scan keys using SCAN command instead of KEYS for production safety
   */
  private async scanKeys(pattern: string): Promise<string[]> {
    const keys: string[] = []
    let cursor = '0'
    do {
      const [nextCursor, foundKeys] = await this.redis.scan(cursor, 'MATCH', pattern, 'COUNT', 100)
      cursor = nextCursor
      keys.push(...foundKeys)
    } while (cursor !== '0')
    return keys
  }

  /**
   * Cleanup expired keys (có thể schedule định kỳ)
   */
  cleanup(): void {
    try {
      // Redis tự động xóa expired keys, nhưng có thể force cleanup nếu cần
      this.logger.debug('Redis cleanup completed')
    } catch (error) {
      this.logger.error('Error during Redis cleanup:', error)
    }
  }

  /**
   * Health check Redis connection
   */
  async healthCheck(): Promise<boolean> {
    try {
      const result = await this.redis.ping()
      return result === 'PONG'
    } catch (error) {
      this.logger.error('Redis health check failed:', error)
      return false
    }
  }
}
