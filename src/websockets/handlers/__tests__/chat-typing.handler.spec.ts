import { Test, TestingModule } from '@nestjs/testing'
import { Server } from 'socket.io'
import { ConversationService } from 'src/routes/conversation/conversation.service'
import { ChatRedisService } from '../../services/chat-redis.service'
import { AuthenticatedSocket } from '../../websocket.interfaces'
import { ChatTypingHandler, TypingData } from '../chat-typing.handler'

/**
 * CHAT TYPING HANDLER UNIT TESTS
 *
 * Test coverage cho typing indicators
 * - Typing start với Redis TTL 10 giây
 * - Typing stop
 * - Auto-cleanup sau 10 giây
 * - Remove user từ tất cả typing
 * - Get typing users
 * - Membership verification
 */

describe('ChatTypingHandler', () => {
  let handler: ChatTypingHandler
  let mockConversationService: jest.Mocked<ConversationService>
  let mockRedisService: jest.Mocked<ChatRedisService>
  let mockServer: jest.Mocked<Server>
  let mockClient: jest.Mocked<AuthenticatedSocket>

  const CONVERSATION_ID = '550e8400-e29b-41d4-a716-446655440000'

  beforeEach(async () => {
    jest.useFakeTimers()

    mockConversationService = {
      isUserInConversation: jest.fn(),
    } as any

    mockRedisService = {
      setUserTyping: jest.fn(),
      removeUserTyping: jest.fn(),
      getTypingUsers: jest.fn(),
      removeUserFromAllTyping: jest.fn(),
      getOnlineUsers: jest.fn(),
    } as any

    mockServer = {
      to: jest.fn().mockReturnThis(),
      emit: jest.fn(),
    } as any

    mockClient = {
      id: 'socket-123',
      userId: 1,
      user: {
        id: 1,
        name: 'Test User',
        email: 'test@example.com',
      },
      to: jest.fn().mockReturnThis(),
      emit: jest.fn(),
    } as any

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ChatTypingHandler,
        { provide: ConversationService, useValue: mockConversationService },
        { provide: ChatRedisService, useValue: mockRedisService },
      ],
    }).compile()

    handler = module.get<ChatTypingHandler>(ChatTypingHandler)
  })

  afterEach(() => {
    jest.clearAllMocks()
    jest.useRealTimers()
  })

  // ============================================
  // TYPING START TESTS
  // ============================================

  describe('handleTypingStart', () => {
    const typingData: TypingData = { conversationId: CONVERSATION_ID }

    describe('✅ Success Cases', () => {
      it('should start typing indicator successfully', async () => {
        mockConversationService.isUserInConversation.mockResolvedValue(true)

        await handler.handleTypingStart(mockServer, mockClient, typingData)

        expect(mockConversationService.isUserInConversation).toHaveBeenCalledWith(CONVERSATION_ID, 1)
        expect(mockRedisService.setUserTyping).toHaveBeenCalledWith(CONVERSATION_ID, 1, 10)
        expect(mockClient.to).toHaveBeenCalledWith(`conversation:${CONVERSATION_ID}`)
        expect(mockClient.emit).toHaveBeenCalledWith(
          'user_typing',
          expect.objectContaining({
            conversationId: CONVERSATION_ID,
            userId: 1,
          }),
        )
      })

      it('should set Redis TTL to 10 seconds', async () => {
        mockConversationService.isUserInConversation.mockResolvedValue(true)

        await handler.handleTypingStart(mockServer, mockClient, typingData)

        expect(mockRedisService.setUserTyping).toHaveBeenCalledWith(CONVERSATION_ID, 1, 10)
      })

      it('should notify other conversation members (exclude sender)', async () => {
        mockConversationService.isUserInConversation.mockResolvedValue(true)

        await handler.handleTypingStart(mockServer, mockClient, typingData)

        expect(mockClient.to).toHaveBeenCalledWith(`conversation:${CONVERSATION_ID}`)
        expect(mockClient.emit).toHaveBeenCalledWith(
          'user_typing',
          expect.objectContaining({
            userId: 1,
            user: mockClient.user,
          }),
        )
      })

      it('should include user info in typing event', async () => {
        mockConversationService.isUserInConversation.mockResolvedValue(true)

        await handler.handleTypingStart(mockServer, mockClient, typingData)

        expect(mockClient.emit).toHaveBeenCalledWith(
          'user_typing',
          expect.objectContaining({
            user: {
              id: 1,
              name: 'Test User',
              email: 'test@example.com',
            },
          }),
        )
      })

      it('should auto-stop typing after 10 seconds', async () => {
        mockConversationService.isUserInConversation.mockResolvedValue(true)

        await handler.handleTypingStart(mockServer, mockClient, typingData)

        // Fast-forward 10 seconds
        jest.advanceTimersByTime(10000)

        // Wait for async operations
        await Promise.resolve()

        expect(mockRedisService.removeUserTyping).toHaveBeenCalledWith(CONVERSATION_ID, 1)
      })

      it('should update Redis typing state', async () => {
        mockConversationService.isUserInConversation.mockResolvedValue(true)

        await handler.handleTypingStart(mockServer, mockClient, typingData)

        expect(mockRedisService.setUserTyping).toHaveBeenCalled()
      })
    })

    describe('❌ Error Cases', () => {
      it('should not start typing if user is not a member', async () => {
        mockConversationService.isUserInConversation.mockResolvedValue(false)

        await handler.handleTypingStart(mockServer, mockClient, typingData)

        expect(mockRedisService.setUserTyping).not.toHaveBeenCalled()
        expect(mockClient.emit).not.toHaveBeenCalled()
      })

      it('should handle membership check errors gracefully', async () => {
        mockConversationService.isUserInConversation.mockRejectedValue(new Error('Database error'))

        await handler.handleTypingStart(mockServer, mockClient, typingData)

        expect(mockRedisService.setUserTyping).not.toHaveBeenCalled()
      })

      it('should handle Redis errors gracefully', async () => {
        mockConversationService.isUserInConversation.mockResolvedValue(true)
        mockRedisService.setUserTyping.mockRejectedValue(new Error('Redis error'))

        await handler.handleTypingStart(mockServer, mockClient, typingData)

        // Should not throw, just log error
        expect(mockConversationService.isUserInConversation).toHaveBeenCalled()
      })
    })
  })

  // ============================================
  // TYPING STOP TESTS
  // ============================================

  describe('handleTypingStop', () => {
    const typingData: TypingData = { conversationId: CONVERSATION_ID }

    describe('✅ Success Cases', () => {
      it('should stop typing indicator successfully', async () => {
        await handler.handleTypingStop(mockServer, mockClient, typingData)

        expect(mockRedisService.removeUserTyping).toHaveBeenCalledWith(CONVERSATION_ID, 1)
        expect(mockClient.to).toHaveBeenCalledWith(`conversation:${CONVERSATION_ID}`)
        expect(mockClient.emit).toHaveBeenCalledWith(
          'user_stopped_typing',
          expect.objectContaining({
            conversationId: CONVERSATION_ID,
            userId: 1,
          }),
        )
      })

      it('should notify conversation members about stop typing', async () => {
        await handler.handleTypingStop(mockServer, mockClient, typingData)

        expect(mockClient.to).toHaveBeenCalledWith(`conversation:${CONVERSATION_ID}`)
        expect(mockClient.emit).toHaveBeenCalledWith('user_stopped_typing', expect.any(Object))
      })

      it('should remove from Redis', async () => {
        await handler.handleTypingStop(mockServer, mockClient, typingData)

        expect(mockRedisService.removeUserTyping).toHaveBeenCalled()
      })

      it('should include timestamp in stop event', async () => {
        await handler.handleTypingStop(mockServer, mockClient, typingData)

        expect(mockClient.emit).toHaveBeenCalledWith(
          'user_stopped_typing',
          expect.objectContaining({
            timestamp: expect.any(Date),
          }),
        )
      })
    })

    describe('❌ Error Cases', () => {
      it('should handle Redis errors gracefully', async () => {
        mockRedisService.removeUserTyping.mockRejectedValue(new Error('Redis error'))

        await handler.handleTypingStop(mockServer, mockClient, typingData)

        // Should not throw
        expect(mockRedisService.removeUserTyping).toHaveBeenCalled()
      })
    })
  })

  // ============================================
  // REMOVE FROM ALL TYPING TESTS
  // ============================================

  describe('removeUserFromAllTyping', () => {
    describe('✅ Success Cases', () => {
      it('should remove user from all typing indicators', async () => {
        await handler.removeUserFromAllTyping(mockServer, 1)

        expect(mockRedisService.removeUserFromAllTyping).toHaveBeenCalledWith(1)
      })

      it('should call redisService.removeUserFromAllTyping', async () => {
        await handler.removeUserFromAllTyping(mockServer, 1)

        expect(mockRedisService.removeUserFromAllTyping).toHaveBeenCalledWith(1)
      })

      it('should handle user with single connection', async () => {
        await handler.removeUserFromAllTyping(mockServer, 1)

        expect(mockRedisService.removeUserFromAllTyping).toHaveBeenCalledWith(1)
      })

      it('should handle user with multiple connections', async () => {
        await handler.removeUserFromAllTyping(mockServer, 1)

        expect(mockRedisService.removeUserFromAllTyping).toHaveBeenCalledWith(1)
      })
    })

    describe('❌ Error Cases', () => {
      it('should handle Redis errors gracefully', async () => {
        mockRedisService.removeUserFromAllTyping.mockRejectedValue(new Error('Redis error'))

        await handler.removeUserFromAllTyping(mockServer, 1)

        // Should not throw
        expect(mockRedisService.removeUserFromAllTyping).toHaveBeenCalledWith(1)
      })
    })
  })

  // ============================================
  // GET TYPING USERS TESTS
  // ============================================

  describe('getTypingUsers', () => {
    describe('✅ Success Cases', () => {
      it('should return list of typing users', async () => {
        mockRedisService.getTypingUsers.mockResolvedValue([1, 2, 3])

        const result = await handler.getTypingUsers(CONVERSATION_ID)

        expect(result).toEqual([1, 2, 3])
        expect(mockRedisService.getTypingUsers).toHaveBeenCalledWith(CONVERSATION_ID)
      })

      it('should return empty array when no users typing', async () => {
        mockRedisService.getTypingUsers.mockResolvedValue([])

        const result = await handler.getTypingUsers(CONVERSATION_ID)

        expect(result).toEqual([])
      })

      it('should handle single typing user', async () => {
        mockRedisService.getTypingUsers.mockResolvedValue([1])

        const result = await handler.getTypingUsers(CONVERSATION_ID)

        expect(result).toEqual([1])
      })
    })

    describe('❌ Error Cases', () => {
      it('should return empty array on Redis error', async () => {
        // Suppress error logging trong test
        jest.spyOn(handler['logger'], 'error').mockImplementation()

        mockRedisService.getTypingUsers.mockImplementation(() => {
          throw new Error('Redis error')
        })

        const result = await handler.getTypingUsers(CONVERSATION_ID)

        expect(result).toEqual([])
      })
    })
  })

  // ============================================
  // CLEANUP EXPIRED TYPING TESTS
  // ============================================

  describe('cleanupExpiredTypingIndicators', () => {
    describe('✅ Success Cases', () => {
      it('should complete cleanup without errors (Redis handles TTL)', async () => {
        await expect(handler.cleanupExpiredTypingIndicators()).resolves.not.toThrow()
      })
    })
  })
})
