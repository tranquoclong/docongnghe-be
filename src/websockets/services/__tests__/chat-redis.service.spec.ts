import { Test, TestingModule } from '@nestjs/testing'
import Redis from 'ioredis'
import { ChatRedisService } from '../chat-redis.service'
import { CHAT_REDIS } from '../../websocket.constants'

/**
 * CHAT REDIS SERVICE UNIT TESTS
 *
 * Test Coverage:
 * - Service initialization and Redis connection
 * - Online users management (add, remove, check, get)
 * - Socket user info management (set, get, remove)
 * - Typing indicators management (set, remove, get, cleanup)
 * - User conversations cache (cache, get, invalidate)
 * - Utility methods (health check, cleanup)
 */

// No need to mock ioredis - we inject a mock Redis instance via CHAT_REDIS token

describe('ChatRedisService', () => {
  let service: ChatRedisService
  let mockRedis: jest.Mocked<Redis>
  let mockPipelineInstance: Record<string, jest.Mock>

  beforeEach(async () => {
    // Reset mock
    jest.clearAllMocks()

    // Mock pipeline that collects commands and returns results via exec()
    mockPipelineInstance = {
      exists: jest.fn().mockReturnThis(),
      sadd: jest.fn().mockReturnThis(),
      srem: jest.fn().mockReturnThis(),
      set: jest.fn().mockReturnThis(),
      del: jest.fn().mockReturnThis(),
      exec: jest.fn().mockResolvedValue([]),
    }

    // Mock Redis instance
    mockRedis = {
      get: jest.fn(),
      set: jest.fn(),
      setex: jest.fn(),
      del: jest.fn(),
      exists: jest.fn(),
      sadd: jest.fn(),
      srem: jest.fn(),
      scard: jest.fn(),
      smembers: jest.fn(),
      expire: jest.fn(),
      keys: jest.fn(),
      scan: jest.fn(),
      ping: jest.fn(),
      quit: jest.fn(),
      on: jest.fn(),
      pipeline: jest.fn().mockReturnValue(mockPipelineInstance),
    } as any

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ChatRedisService,
        {
          provide: CHAT_REDIS,
          useValue: mockRedis,
        },
      ],
    }).compile()

    service = module.get<ChatRedisService>(ChatRedisService)
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  // ===== SERVICE INITIALIZATION =====

  describe('Service Initialization', () => {
    it('should be defined', () => {
      expect(service).toBeDefined()
    })

    it('should use the injected Redis instance', async () => {
      // Verify the service uses the injected Redis by calling a method
      mockRedis.ping.mockResolvedValue('PONG')
      const result = await service.healthCheck()
      expect(result).toBe(true)
      expect(mockRedis.ping).toHaveBeenCalled()
    })
  })

  // ===== ONLINE USERS MANAGEMENT =====

  describe('Online Users Management', () => {
    describe('addOnlineUser', () => {
      it('should add user with socket ID using SADD', async () => {
        // Arrange
        const userId = 1
        const socketId = 'socket-123'

        // Act
        await service.addOnlineUser(userId, socketId)

        // Assert
        expect(mockRedis.sadd).toHaveBeenCalledWith('chat:online_users:1', socketId)
        expect(mockRedis.expire).toHaveBeenCalledWith('chat:online_users:1', 3600)
      })

      it('should add another socket ID to existing user (SADD is idempotent)', async () => {
        // Arrange
        const userId = 1
        const newSocketId = 'socket-456'

        // Act
        await service.addOnlineUser(userId, newSocketId)

        // Assert
        expect(mockRedis.sadd).toHaveBeenCalledWith('chat:online_users:1', newSocketId)
        expect(mockRedis.expire).toHaveBeenCalledWith('chat:online_users:1', 3600)
      })

      it('should handle Redis error gracefully', async () => {
        // Arrange
        const userId = 1
        const socketId = 'socket-123'
        mockRedis.sadd.mockRejectedValue(new Error('Redis error'))

        // Act & Assert - should not throw
        await expect(service.addOnlineUser(userId, socketId)).resolves.toBeUndefined()
      })
    })

    describe('removeOnlineUser', () => {
      it('should remove socket ID and return true when user goes offline (SCARD=0)', async () => {
        // Arrange
        const userId = 1
        const socketId = 'socket-123'
        mockRedis.srem.mockResolvedValue(1)
        mockRedis.scard.mockResolvedValue(0)

        // Act
        const result = await service.removeOnlineUser(userId, socketId)

        // Assert
        expect(result).toBe(true)
        expect(mockRedis.srem).toHaveBeenCalledWith('chat:online_users:1', socketId)
        expect(mockRedis.scard).toHaveBeenCalledWith('chat:online_users:1')
        expect(mockRedis.del).toHaveBeenCalledWith('chat:online_users:1')
      })

      it('should remove socket ID and return false when user still has other sockets', async () => {
        // Arrange
        const userId = 1
        const socketId1 = 'socket-123'
        mockRedis.srem.mockResolvedValue(1)
        mockRedis.scard.mockResolvedValue(1) // still has another socket

        // Act
        const result = await service.removeOnlineUser(userId, socketId1)

        // Assert
        expect(result).toBe(false)
        expect(mockRedis.srem).toHaveBeenCalledWith('chat:online_users:1', socketId1)
        expect(mockRedis.del).not.toHaveBeenCalled()
      })

      it('should handle Redis error and return false', async () => {
        // Arrange
        const userId = 1
        const socketId = 'socket-123'
        mockRedis.srem.mockRejectedValue(new Error('Redis error'))

        // Act
        const result = await service.removeOnlineUser(userId, socketId)

        // Assert
        expect(result).toBe(false)
      })
    })

    describe('isUserOnline', () => {
      it('should return true when user is online', async () => {
        // Arrange
        const userId = 1
        mockRedis.exists.mockResolvedValue(1)

        // Act
        const result = await service.isUserOnline(userId)

        // Assert
        expect(result).toBe(true)
        expect(mockRedis.exists).toHaveBeenCalledWith('chat:online_users:1')
      })

      it('should return false when user is offline', async () => {
        // Arrange
        const userId = 1
        mockRedis.exists.mockResolvedValue(0)

        // Act
        const result = await service.isUserOnline(userId)

        // Assert
        expect(result).toBe(false)
      })

      it('should return false on Redis error', async () => {
        // Arrange
        const userId = 1
        mockRedis.exists.mockRejectedValue(new Error('Redis error'))

        // Act
        const result = await service.isUserOnline(userId)

        // Assert
        expect(result).toBe(false)
      })
    })

    describe('getOnlineUsers', () => {
      it('should return list of online user IDs', async () => {
        // Arrange - scan returns [nextCursor, keys], cursor '0' means done
        mockRedis.scan.mockResolvedValue(['0', ['chat:online_users:1', 'chat:online_users:2', 'chat:online_users:3']])

        // Act
        const result = await service.getOnlineUsers()

        // Assert
        expect(result).toEqual([1, 2, 3])
        expect(mockRedis.scan).toHaveBeenCalledWith('0', 'MATCH', 'chat:online_users:*', 'COUNT', 100)
      })

      it('should return empty array when no users online', async () => {
        // Arrange
        mockRedis.scan.mockResolvedValue(['0', []])

        // Act
        const result = await service.getOnlineUsers()

        // Assert
        expect(result).toEqual([])
      })

      it('should filter out invalid user IDs', async () => {
        // Arrange
        mockRedis.scan.mockResolvedValue([
          '0',
          ['chat:online_users:1', 'chat:online_users:invalid', 'chat:online_users:2'],
        ])

        // Act
        const result = await service.getOnlineUsers()

        // Assert
        expect(result).toEqual([1, 2])
      })

      it('should return empty array on Redis error', async () => {
        // Arrange
        mockRedis.scan.mockRejectedValue(new Error('Redis error'))

        // Act
        const result = await service.getOnlineUsers()

        // Assert
        expect(result).toEqual([])
      })
    })

    describe('getUserSocketIds', () => {
      it('should return socket IDs for user using SMEMBERS', async () => {
        // Arrange
        const userId = 1
        const socketIds = ['socket-123', 'socket-456']
        mockRedis.smembers.mockResolvedValue(socketIds)

        // Act
        const result = await service.getUserSocketIds(userId)

        // Assert
        expect(result).toEqual(socketIds)
        expect(mockRedis.smembers).toHaveBeenCalledWith('chat:online_users:1')
      })

      it('should return empty array when user has no sockets', async () => {
        // Arrange
        const userId = 1
        mockRedis.smembers.mockResolvedValue([])

        // Act
        const result = await service.getUserSocketIds(userId)

        // Assert
        expect(result).toEqual([])
      })

      it('should return empty array on Redis error', async () => {
        // Arrange
        const userId = 1
        mockRedis.smembers.mockRejectedValue(new Error('Redis error'))

        // Act
        const result = await service.getUserSocketIds(userId)

        // Assert
        expect(result).toEqual([])
      })
    })

    describe('areUsersOnline', () => {
      it('should return online status for multiple users using pipeline EXISTS', async () => {
        // Arrange
        const userIds = [1, 2, 3]
        mockPipelineInstance.exec.mockResolvedValue([
          [null, 1], // user 1 online
          [null, 0], // user 2 offline
          [null, 1], // user 3 online
        ])

        // Act
        const result = await service.areUsersOnline(userIds)

        // Assert
        expect(result.get(1)).toBe(true)
        expect(result.get(2)).toBe(false)
        expect(result.get(3)).toBe(true)
        expect(mockRedis.pipeline).toHaveBeenCalled()
      })

      it('should return empty Map for empty array without Redis call', async () => {
        // Act
        const result = await service.areUsersOnline([])

        // Assert
        expect(result.size).toBe(0)
        expect(mockRedis.pipeline).not.toHaveBeenCalled()
      })

      it('should default all users to offline on Redis error', async () => {
        // Arrange
        const userIds = [1, 2]
        mockPipelineInstance.exec.mockRejectedValue(new Error('Redis error'))

        // Act
        const result = await service.areUsersOnline(userIds)

        // Assert
        expect(result.get(1)).toBe(false)
        expect(result.get(2)).toBe(false)
      })

      it('should handle single user', async () => {
        // Arrange
        mockPipelineInstance.exec.mockResolvedValue([
          [null, 1], // user 42 online
        ])

        // Act
        const result = await service.areUsersOnline([42])

        // Assert
        expect(result.get(42)).toBe(true)
      })
    })
  })

  // ===== SOCKET USER INFO MANAGEMENT =====

  describe('Socket User Info Management', () => {
    describe('setSocketUser', () => {
      it('should set socket user info with TTL', async () => {
        // Arrange
        const socketId = 'socket-123'
        const userInfo = { id: 1, name: 'Test User', email: 'user@example.com' }

        // Act
        await service.setSocketUser(socketId, userInfo)

        // Assert
        expect(mockRedis.setex).toHaveBeenCalledWith('chat:user_sockets:socket-123', 3600, JSON.stringify(userInfo))
      })

      it('should handle Redis error gracefully', async () => {
        // Arrange
        const socketId = 'socket-123'
        const userInfo = { id: 1, name: 'Test User', email: 'user@example.com' }
        mockRedis.setex.mockRejectedValue(new Error('Redis error'))

        // Act & Assert - should not throw
        await expect(service.setSocketUser(socketId, userInfo)).resolves.toBeUndefined()
      })
    })

    describe('getSocketUser', () => {
      it('should return socket user info', async () => {
        // Arrange
        const socketId = 'socket-123'
        const userInfo = { userId: 1, email: 'user@example.com' }
        mockRedis.get.mockResolvedValue(JSON.stringify(userInfo))

        // Act
        const result = await service.getSocketUser(socketId)

        // Assert
        expect(result).toEqual(userInfo)
        expect(mockRedis.get).toHaveBeenCalledWith('chat:user_sockets:socket-123')
      })

      it('should return null when socket info does not exist', async () => {
        // Arrange
        const socketId = 'socket-123'
        mockRedis.get.mockResolvedValue(null)

        // Act
        const result = await service.getSocketUser(socketId)

        // Assert
        expect(result).toBeNull()
      })

      it('should return null on Redis error', async () => {
        // Arrange
        const socketId = 'socket-123'
        mockRedis.get.mockRejectedValue(new Error('Redis error'))

        // Act
        const result = await service.getSocketUser(socketId)

        // Assert
        expect(result).toBeNull()
      })
    })

    describe('removeSocket', () => {
      it('should remove socket info', async () => {
        // Arrange
        const socketId = 'socket-123'

        // Act
        await service.removeSocket(socketId)

        // Assert
        expect(mockRedis.del).toHaveBeenCalledWith('chat:user_sockets:socket-123')
      })

      it('should handle Redis error gracefully', async () => {
        // Arrange
        const socketId = 'socket-123'
        mockRedis.del.mockRejectedValue(new Error('Redis error'))

        // Act & Assert - should not throw
        await expect(service.removeSocket(socketId)).resolves.toBeUndefined()
      })
    })
  })

  // ===== TYPING INDICATORS MANAGEMENT =====

  describe('Typing Indicators Management', () => {
    describe('setUserTyping', () => {
      it('should add user to typing Set with default TTL using pipeline', async () => {
        // Arrange
        const conversationId = 'conv-123'
        const userId = 1

        // Act
        await service.setUserTyping(conversationId, userId)

        // Assert
        expect(mockRedis.pipeline).toHaveBeenCalled()
        expect(mockPipelineInstance.sadd).toHaveBeenCalledWith('chat:typing:conv-123', '1')
        expect(mockPipelineInstance.set).toHaveBeenCalledWith('chat:typing_exp:conv-123:1', '1', 'EX', 10)
        expect(mockPipelineInstance.exec).toHaveBeenCalled()
      })

      it('should add user to typing Set with custom TTL', async () => {
        // Arrange
        const conversationId = 'conv-123'
        const userId = 1
        const ttl = 30

        // Act
        await service.setUserTyping(conversationId, userId, ttl)

        // Assert
        expect(mockPipelineInstance.sadd).toHaveBeenCalledWith('chat:typing:conv-123', '1')
        expect(mockPipelineInstance.set).toHaveBeenCalledWith('chat:typing_exp:conv-123:1', '1', 'EX', ttl)
      })

      it('should handle Redis error gracefully', async () => {
        // Arrange
        const conversationId = 'conv-123'
        const userId = 1
        mockPipelineInstance.exec.mockRejectedValue(new Error('Redis error'))

        // Act & Assert - should not throw
        await expect(service.setUserTyping(conversationId, userId)).resolves.toBeUndefined()
      })
    })

    describe('removeUserTyping', () => {
      it('should remove user from typing Set and delete expiry key using pipeline', async () => {
        // Arrange
        const conversationId = 'conv-123'
        const userId = 1

        // Act
        await service.removeUserTyping(conversationId, userId)

        // Assert
        expect(mockRedis.pipeline).toHaveBeenCalled()
        expect(mockPipelineInstance.srem).toHaveBeenCalledWith('chat:typing:conv-123', '1')
        expect(mockPipelineInstance.del).toHaveBeenCalledWith('chat:typing_exp:conv-123:1')
        expect(mockPipelineInstance.exec).toHaveBeenCalled()
      })

      it('should handle Redis error gracefully', async () => {
        // Arrange
        const conversationId = 'conv-123'
        const userId = 1
        mockPipelineInstance.exec.mockRejectedValue(new Error('Redis error'))

        // Act & Assert - should not throw
        await expect(service.removeUserTyping(conversationId, userId)).resolves.toBeUndefined()
      })
    })

    describe('getTypingUsers', () => {
      it('should return active typing users filtered by expiry keys', async () => {
        // Arrange
        const conversationId = 'conv-123'
        mockRedis.smembers.mockResolvedValue(['1', '2', '3'])
        mockPipelineInstance.exec.mockResolvedValue([
          [null, 1], // user 1 expiry exists
          [null, 1], // user 2 expiry exists
          [null, 0], // user 3 expiry expired
        ])

        // Act
        const result = await service.getTypingUsers(conversationId)

        // Assert
        expect(result).toEqual([1, 2])
        expect(mockRedis.smembers).toHaveBeenCalledWith('chat:typing:conv-123')
        // Expired user 3 should be cleaned up
        expect(mockRedis.srem).toHaveBeenCalledWith('chat:typing:conv-123', '3')
      })

      it('should return empty array when no users typing', async () => {
        // Arrange
        const conversationId = 'conv-123'
        mockRedis.smembers.mockResolvedValue([])

        // Act
        const result = await service.getTypingUsers(conversationId)

        // Assert
        expect(result).toEqual([])
      })

      it('should return empty array on Redis error', async () => {
        // Arrange
        const conversationId = 'conv-123'
        mockRedis.smembers.mockRejectedValue(new Error('Redis error'))

        // Act
        const result = await service.getTypingUsers(conversationId)

        // Assert
        expect(result).toEqual([])
      })
    })

    describe('removeUserFromAllTyping', () => {
      it('should remove user from all typing Sets using pipeline', async () => {
        // Arrange
        const userId = 1
        mockRedis.scan.mockResolvedValue(['0', ['chat:typing:conv-123', 'chat:typing:conv-456']])

        // Act
        await service.removeUserFromAllTyping(userId)

        // Assert
        expect(mockRedis.scan).toHaveBeenCalledWith('0', 'MATCH', 'chat:typing:*', 'COUNT', 100)
        expect(mockPipelineInstance.srem).toHaveBeenCalledWith('chat:typing:conv-123', '1')
        expect(mockPipelineInstance.del).toHaveBeenCalledWith('chat:typing_exp:conv-123:1')
        expect(mockPipelineInstance.srem).toHaveBeenCalledWith('chat:typing:conv-456', '1')
        expect(mockPipelineInstance.del).toHaveBeenCalledWith('chat:typing_exp:conv-456:1')
        expect(mockPipelineInstance.exec).toHaveBeenCalled()
      })

      it('should handle empty typing conversations', async () => {
        // Arrange
        const userId = 1
        mockRedis.scan.mockResolvedValue(['0', []])

        // Act
        await service.removeUserFromAllTyping(userId)

        // Assert
        expect(mockRedis.scan).toHaveBeenCalledWith('0', 'MATCH', 'chat:typing:*', 'COUNT', 100)
        expect(mockRedis.pipeline).not.toHaveBeenCalled()
      })

      it('should handle Redis error gracefully', async () => {
        // Arrange
        const userId = 1
        mockRedis.scan.mockRejectedValue(new Error('Redis error'))

        // Act & Assert - should not throw
        await expect(service.removeUserFromAllTyping(userId)).resolves.toBeUndefined()
      })
    })
  })

  // ===== USER CONVERSATIONS CACHE =====

  describe('User Conversations Cache', () => {
    describe('cacheUserConversations', () => {
      it('should cache user conversations with TTL', async () => {
        // Arrange
        const userId = 1
        const conversationIds = ['conv-123', 'conv-456']

        // Act
        await service.cacheUserConversations(userId, conversationIds)

        // Assert
        expect(mockRedis.setex).toHaveBeenCalledWith('chat:user_conversations:1', 300, JSON.stringify(conversationIds))
      })

      it('should delete cache when conversation list is empty', async () => {
        // Arrange
        const userId = 1
        const conversationIds: string[] = []

        // Act
        await service.cacheUserConversations(userId, conversationIds)

        // Assert
        expect(mockRedis.del).toHaveBeenCalledWith('chat:user_conversations:1')
      })

      it('should handle Redis error gracefully', async () => {
        // Arrange
        const userId = 1
        const conversationIds = ['conv-123']
        mockRedis.setex.mockRejectedValue(new Error('Redis error'))

        // Act & Assert - should not throw
        await expect(service.cacheUserConversations(userId, conversationIds)).resolves.toBeUndefined()
      })
    })

    describe('getCachedUserConversations', () => {
      it('should return cached conversations', async () => {
        // Arrange
        const userId = 1
        const conversationIds = ['conv-123', 'conv-456']
        mockRedis.get.mockResolvedValue(JSON.stringify(conversationIds))

        // Act
        const result = await service.getCachedUserConversations(userId)

        // Assert
        expect(result).toEqual(conversationIds)
        expect(mockRedis.get).toHaveBeenCalledWith('chat:user_conversations:1')
      })

      it('should return null when cache does not exist', async () => {
        // Arrange
        const userId = 1
        mockRedis.get.mockResolvedValue(null)

        // Act
        const result = await service.getCachedUserConversations(userId)

        // Assert
        expect(result).toBeNull()
      })

      it('should return null on Redis error', async () => {
        // Arrange
        const userId = 1
        mockRedis.get.mockRejectedValue(new Error('Redis error'))

        // Act
        const result = await service.getCachedUserConversations(userId)

        // Assert
        expect(result).toBeNull()
      })
    })

    describe('invalidateUserConversations', () => {
      it('should invalidate user conversations cache', async () => {
        // Arrange
        const userId = 1

        // Act
        await service.invalidateUserConversations(userId)

        // Assert
        expect(mockRedis.del).toHaveBeenCalledWith('chat:user_conversations:1')
      })

      it('should handle Redis error gracefully', async () => {
        // Arrange
        const userId = 1
        mockRedis.del.mockRejectedValue(new Error('Redis error'))

        // Act & Assert - should not throw
        await expect(service.invalidateUserConversations(userId)).resolves.toBeUndefined()
      })
    })
  })

  // ===== UTILITY METHODS =====

  describe('Utility Methods', () => {
    describe('cleanup', () => {
      it('should complete cleanup without errors', () => {
        // Act & Assert - should not throw
        expect(() => service.cleanup()).not.toThrow()
      })
    })

    describe('healthCheck', () => {
      it('should return true when Redis is healthy', async () => {
        // Arrange
        mockRedis.ping.mockResolvedValue('PONG')

        // Act
        const result = await service.healthCheck()

        // Assert
        expect(result).toBe(true)
        expect(mockRedis.ping).toHaveBeenCalled()
      })

      it('should return false when Redis ping fails', async () => {
        // Arrange
        mockRedis.ping.mockRejectedValue(new Error('Connection failed'))

        // Act
        const result = await service.healthCheck()

        // Assert
        expect(result).toBe(false)
      })
    })
  })
})
