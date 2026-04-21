import { Test, TestingModule } from '@nestjs/testing'
import { Server } from 'socket.io'
import { EnhancedChatGateway } from '../enhanced-chat.gateway'
import { ChatConnectionHandler } from '../handlers/chat-connection.handler'
import { AuthenticatedSocket } from '../websocket.interfaces'
import {
  ChatInteractionHandler,
  JoinConversationData,
  MarkAsReadData,
  ReactToMessageData,
} from '../handlers/chat-interaction.handler'
import {
  ChatMessageHandler,
  DeleteMessageData,
  EditMessageData,
  SendMessageData,
} from '../handlers/chat-message.handler'
import { ChatTypingHandler, TypingData } from '../handlers/chat-typing.handler'
import { ChatRedisService } from '../services/chat-redis.service'
import { ConversationRepository } from 'src/routes/conversation/conversation.repo'

/**
 * ENHANCED CHAT GATEWAY UNIT TESTS
 *
 * Test coverage cho WebSocket gateway chính
 * - Connection/disconnection lifecycle
 * - Message events delegation
 * - Typing events delegation
 * - Interaction events delegation
 * - Public methods
 * - Health check & shutdown
 */

describe('EnhancedChatGateway', () => {
  let gateway: EnhancedChatGateway
  let mockConnectionHandler: jest.Mocked<ChatConnectionHandler>
  let mockMessageHandler: jest.Mocked<ChatMessageHandler>
  let mockTypingHandler: jest.Mocked<ChatTypingHandler>
  let mockInteractionHandler: jest.Mocked<ChatInteractionHandler>
  let mockRedisService: jest.Mocked<ChatRedisService>
  let mockConversationRepo: jest.Mocked<ConversationRepository>
  let mockServer: jest.Mocked<Server>

  const CONVERSATION_ID = '550e8400-e29b-41d4-a716-446655440000'
  const MESSAGE_ID = '550e8400-e29b-41d4-a716-446655440001'

  const createMockSocket = (overrides = {}): any => ({
    id: 'socket-123',
    userId: 1,
    handshake: {
      auth: { authorization: 'Bearer token' },
    },
    emit: jest.fn(),
    join: jest.fn(),
    disconnect: jest.fn(),
    ...overrides,
  })

  const createMockAuthSocket = (overrides = {}): AuthenticatedSocket =>
    ({
      id: 'socket-123',
      userId: 1,
      handshake: {
        auth: { authorization: 'Bearer token' },
      },
      emit: jest.fn(),
      join: jest.fn(),
      disconnect: jest.fn(),
      ...overrides,
    }) as any

  beforeEach(async () => {
    // Mock handlers
    mockConnectionHandler = {
      handleConnection: jest.fn(),
      handleDisconnect: jest.fn(),
      isUserOnline: jest.fn(),
      getOnlineUsers: jest.fn(),
    } as any

    mockMessageHandler = {
      handleSendMessage: jest.fn(),
      handleEditMessage: jest.fn(),
      handleDeleteMessage: jest.fn(),
    } as any

    mockTypingHandler = {
      handleTypingStart: jest.fn(),
      handleTypingStop: jest.fn(),
      cleanupExpiredTypingIndicators: jest.fn(),
      removeUserFromAllTyping: jest.fn(),
    } as any

    mockInteractionHandler = {
      handleJoinConversation: jest.fn(),
      handleLeaveConversation: jest.fn(),
      handleMarkAsRead: jest.fn(),
      handleReactToMessage: jest.fn(),
      handleRemoveReaction: jest.fn(),
      notifyUserOnlineStatus: jest.fn(),
      notifyConversationUpdate: jest.fn(),
      notifyUser: jest.fn(),
      broadcastSystemMessage: jest.fn(),
    } as any

    mockRedisService = {
      healthCheck: jest.fn(),
    } as any

    mockConversationRepo = {
      getConversationMembers: jest.fn(),
      findUserConversationIds: jest.fn(),
    } as any

    mockServer = {
      emit: jest.fn(),
      to: jest.fn().mockReturnThis(),
    } as any

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EnhancedChatGateway,
        { provide: ChatConnectionHandler, useValue: mockConnectionHandler },
        { provide: ChatMessageHandler, useValue: mockMessageHandler },
        { provide: ChatTypingHandler, useValue: mockTypingHandler },
        { provide: ChatInteractionHandler, useValue: mockInteractionHandler },
        { provide: ChatRedisService, useValue: mockRedisService },
        { provide: ConversationRepository, useValue: mockConversationRepo },
      ],
    }).compile()

    gateway = module.get<EnhancedChatGateway>(EnhancedChatGateway)
    gateway.server = mockServer
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  // ===== CONNECTION MANAGEMENT =====

  describe('handleConnection', () => {
    it('should handle successful connection', async () => {
      const mockSocket = createMockSocket()
      const mockAuthSocket = createMockAuthSocket()
      mockConnectionHandler.handleConnection.mockResolvedValue(mockAuthSocket)

      await gateway.handleConnection(mockSocket)

      expect(mockConnectionHandler.handleConnection).toHaveBeenCalledWith(mockSocket)
      expect(mockInteractionHandler.notifyUserOnlineStatus).toHaveBeenCalledWith(mockServer, 1, true)
    })

    it('should not notify online status if authentication fails', async () => {
      const mockSocket = createMockSocket()
      mockConnectionHandler.handleConnection.mockResolvedValue(null)

      await gateway.handleConnection(mockSocket)

      expect(mockConnectionHandler.handleConnection).toHaveBeenCalledWith(mockSocket)
      expect(mockInteractionHandler.notifyUserOnlineStatus).not.toHaveBeenCalled()
    })

    it('should handle connection errors gracefully', async () => {
      const mockSocket = createMockSocket()
      mockConnectionHandler.handleConnection.mockRejectedValue(new Error('Connection failed'))

      await expect(gateway.handleConnection(mockSocket)).rejects.toThrow('Connection failed')
    })
  })

  describe('handleDisconnect', () => {
    it('should handle disconnection when user goes offline', async () => {
      const mockAuthSocket = createMockAuthSocket()
      mockConnectionHandler.handleDisconnect.mockResolvedValue(true)

      await gateway.handleDisconnect(mockAuthSocket)

      expect(mockConnectionHandler.handleDisconnect).toHaveBeenCalledWith(mockAuthSocket)
      expect(mockInteractionHandler.notifyUserOnlineStatus).toHaveBeenCalledWith(mockServer, 1, false)
      expect(mockTypingHandler.removeUserFromAllTyping).toHaveBeenCalledWith(mockServer, 1)
    })

    it('should not notify offline status if user still has other connections', async () => {
      const mockAuthSocket = createMockAuthSocket()
      mockConnectionHandler.handleDisconnect.mockResolvedValue(false)

      await gateway.handleDisconnect(mockAuthSocket)

      expect(mockConnectionHandler.handleDisconnect).toHaveBeenCalledWith(mockAuthSocket)
      expect(mockInteractionHandler.notifyUserOnlineStatus).not.toHaveBeenCalled()
      expect(mockTypingHandler.removeUserFromAllTyping).toHaveBeenCalledWith(mockServer, 1)
    })

    it('should handle disconnection without userId', async () => {
      const mockAuthSocket = createMockAuthSocket({ userId: undefined })

      await gateway.handleDisconnect(mockAuthSocket)

      expect(mockConnectionHandler.handleDisconnect).not.toHaveBeenCalled()
      expect(mockInteractionHandler.notifyUserOnlineStatus).not.toHaveBeenCalled()
    })
  })

  // ===== CONVERSATION EVENTS =====

  describe('handleJoinConversation', () => {
    it('should delegate to interaction handler', async () => {
      const mockAuthSocket = createMockAuthSocket()
      const data: JoinConversationData = { conversationId: CONVERSATION_ID }
      mockInteractionHandler.handleJoinConversation.mockResolvedValue(undefined)

      await gateway.handleJoinConversation(mockAuthSocket, data)

      expect(mockInteractionHandler.handleJoinConversation).toHaveBeenCalledWith(mockServer, mockAuthSocket, data)
    })
  })

  describe('handleLeaveConversation', () => {
    it('should delegate to interaction handler', async () => {
      const mockAuthSocket = createMockAuthSocket()
      const data: JoinConversationData = { conversationId: CONVERSATION_ID }
      mockInteractionHandler.handleLeaveConversation.mockResolvedValue(undefined)

      await gateway.handleLeaveConversation(mockAuthSocket, data)

      expect(mockInteractionHandler.handleLeaveConversation).toHaveBeenCalledWith(mockServer, mockAuthSocket, data)
    })
  })

  // ===== MESSAGE EVENTS =====

  describe('handleSendMessage', () => {
    it('should delegate to message handler', async () => {
      const mockAuthSocket = createMockAuthSocket()
      const data: SendMessageData = { conversationId: CONVERSATION_ID, content: 'Hello' }
      mockMessageHandler.handleSendMessage.mockResolvedValue(undefined)

      await gateway.handleSendMessage(mockAuthSocket, data)

      expect(mockMessageHandler.handleSendMessage).toHaveBeenCalledWith(mockServer, mockAuthSocket, data)
    })
  })

  describe('handleEditMessage', () => {
    it('should delegate to message handler', async () => {
      const mockAuthSocket = createMockAuthSocket()
      const data: EditMessageData = { messageId: MESSAGE_ID, content: 'Updated' }
      mockMessageHandler.handleEditMessage.mockResolvedValue(undefined)

      await gateway.handleEditMessage(mockAuthSocket, data)

      expect(mockMessageHandler.handleEditMessage).toHaveBeenCalledWith(mockServer, mockAuthSocket, data)
    })
  })

  describe('handleDeleteMessage', () => {
    it('should delegate to message handler', async () => {
      const mockAuthSocket = createMockAuthSocket()
      const data: DeleteMessageData = { messageId: MESSAGE_ID, forEveryone: false }
      mockMessageHandler.handleDeleteMessage.mockResolvedValue(undefined)

      await gateway.handleDeleteMessage(mockAuthSocket, data)

      expect(mockMessageHandler.handleDeleteMessage).toHaveBeenCalledWith(mockServer, mockAuthSocket, data)
    })
  })

  // ===== TYPING EVENTS =====

  describe('handleTypingStart', () => {
    it('should delegate to typing handler', async () => {
      const mockAuthSocket = createMockAuthSocket()
      const data: TypingData = { conversationId: CONVERSATION_ID }
      mockTypingHandler.handleTypingStart.mockResolvedValue(undefined)

      await gateway.handleTypingStart(mockAuthSocket, data)

      expect(mockTypingHandler.handleTypingStart).toHaveBeenCalledWith(mockServer, mockAuthSocket, data)
    })
  })

  describe('handleTypingStop', () => {
    it('should delegate to typing handler', async () => {
      const mockAuthSocket = createMockAuthSocket()
      const data: TypingData = { conversationId: CONVERSATION_ID }
      mockTypingHandler.handleTypingStop.mockResolvedValue(undefined)

      await gateway.handleTypingStop(mockAuthSocket, data)

      expect(mockTypingHandler.handleTypingStop).toHaveBeenCalledWith(mockServer, mockAuthSocket, data)
    })
  })

  // ===== MESSAGE INTERACTION EVENTS =====

  describe('handleMarkAsRead', () => {
    it('should delegate to interaction handler', async () => {
      const mockAuthSocket = createMockAuthSocket()
      const data: MarkAsReadData = { conversationId: CONVERSATION_ID, messageId: MESSAGE_ID }
      mockInteractionHandler.handleMarkAsRead.mockResolvedValue(undefined)

      await gateway.handleMarkAsRead(mockAuthSocket, data)

      expect(mockInteractionHandler.handleMarkAsRead).toHaveBeenCalledWith(mockServer, mockAuthSocket, data)
    })
  })

  describe('handleReactToMessage', () => {
    it('should delegate to interaction handler', async () => {
      const mockAuthSocket = createMockAuthSocket()
      const data: ReactToMessageData = { messageId: MESSAGE_ID, emoji: '👍' }
      mockInteractionHandler.handleReactToMessage.mockResolvedValue(undefined)

      await gateway.handleReactToMessage(mockAuthSocket, data)

      expect(mockInteractionHandler.handleReactToMessage).toHaveBeenCalledWith(mockServer, mockAuthSocket, data)
    })
  })

  describe('handleRemoveReaction', () => {
    it('should delegate to interaction handler', async () => {
      const mockAuthSocket = createMockAuthSocket()
      const data: ReactToMessageData = { messageId: MESSAGE_ID, emoji: '👍' }
      mockInteractionHandler.handleRemoveReaction.mockResolvedValue(undefined)

      await gateway.handleRemoveReaction(mockAuthSocket, data)

      expect(mockInteractionHandler.handleRemoveReaction).toHaveBeenCalledWith(mockServer, mockAuthSocket, data)
    })
  })

  // ===== PUBLIC METHODS =====

  describe('notifyConversationUpdate', () => {
    it('should delegate to interaction handler', () => {
      const conversationId = CONVERSATION_ID
      const updateType = 'member_added'
      const data = { memberId: 2 }

      gateway.notifyConversationUpdate(conversationId, updateType, data)

      expect(mockInteractionHandler.notifyConversationUpdate).toHaveBeenCalledWith(
        mockServer,
        conversationId,
        updateType,
        data,
      )
    })
  })

  describe('notifyUser', () => {
    it('should delegate to interaction handler', () => {
      const userId = 1
      const event = 'new_message'
      const data = { messageId: 123 }

      gateway.notifyUser(userId, event, data)

      expect(mockInteractionHandler.notifyUser).toHaveBeenCalledWith(mockServer, userId, event, data)
    })
  })

  describe('isUserOnline', () => {
    it('should check if user is online', async () => {
      mockConnectionHandler.isUserOnline.mockResolvedValue(true)

      const result = await gateway.isUserOnline(1)

      expect(mockConnectionHandler.isUserOnline).toHaveBeenCalledWith(1)
      expect(result).toBe(true)
    })

    it('should return false if user is offline', async () => {
      mockConnectionHandler.isUserOnline.mockResolvedValue(false)

      const result = await gateway.isUserOnline(1)

      expect(result).toBe(false)
    })
  })

  describe('getOnlineUsers', () => {
    it('should get list of online users', async () => {
      const onlineUsers = [1, 2, 3]
      mockConnectionHandler.getOnlineUsers.mockResolvedValue(onlineUsers)

      const result = await gateway.getOnlineUsers()

      expect(mockConnectionHandler.getOnlineUsers).toHaveBeenCalled()
      expect(result).toEqual(onlineUsers)
    })

    it('should return empty array if no users online', async () => {
      mockConnectionHandler.getOnlineUsers.mockResolvedValue([])

      const result = await gateway.getOnlineUsers()

      expect(result).toEqual([])
    })
  })

  describe('getOnlineUsersInConversation', () => {
    it('should get online users who are conversation members', async () => {
      const members = [
        { userId: 1, conversationId: CONVERSATION_ID, role: 'MEMBER', isActive: true },
        { userId: 2, conversationId: CONVERSATION_ID, role: 'MEMBER', isActive: true },
        { userId: 3, conversationId: CONVERSATION_ID, role: 'ADMIN', isActive: true },
      ]
      mockConversationRepo.getConversationMembers.mockResolvedValue(members as any)
      mockRedisService.areUsersOnline = jest.fn().mockResolvedValue(
        new Map([
          [1, true],
          [2, false],
          [3, true],
        ]),
      )

      const result = await gateway.getOnlineUsersInConversation(CONVERSATION_ID)

      expect(mockConversationRepo.getConversationMembers).toHaveBeenCalledWith(CONVERSATION_ID)
      expect(mockRedisService.areUsersOnline).toHaveBeenCalledWith([1, 2, 3])
      expect(result).toEqual([1, 3])
    })

    it('should return empty array when no members', async () => {
      mockConversationRepo.getConversationMembers.mockResolvedValue([])

      const result = await gateway.getOnlineUsersInConversation(CONVERSATION_ID)

      expect(result).toEqual([])
    })

    it('should handle errors gracefully', async () => {
      mockConversationRepo.getConversationMembers.mockRejectedValue(new Error('Redis error'))

      const result = await gateway.getOnlineUsersInConversation(CONVERSATION_ID)

      expect(result).toEqual([])
    })
  })

  describe('broadcastSystemMessage', () => {
    it('should broadcast system message', async () => {
      const conversationId = CONVERSATION_ID
      const content = 'User joined'
      const fromUserId = 1
      mockInteractionHandler.broadcastSystemMessage.mockResolvedValue({ success: true })

      const result = await gateway.broadcastSystemMessage(conversationId, content, fromUserId)

      expect(mockInteractionHandler.broadcastSystemMessage).toHaveBeenCalledWith(
        mockServer,
        conversationId,
        content,
        fromUserId,
      )
      expect(result).toEqual({ success: true })
    })

    it('should broadcast system message without fromUserId', async () => {
      const conversationId = CONVERSATION_ID
      const content = 'System notification'
      mockInteractionHandler.broadcastSystemMessage.mockResolvedValue({ success: true })

      const result = await gateway.broadcastSystemMessage(conversationId, content)

      expect(mockInteractionHandler.broadcastSystemMessage).toHaveBeenCalledWith(
        mockServer,
        conversationId,
        content,
        undefined,
      )
      expect(result).toEqual({ success: true })
    })
  })

  // ===== HEALTH CHECK & SHUTDOWN =====

  describe('healthCheck', () => {
    it('should return healthy status when Redis is healthy', async () => {
      mockRedisService.healthCheck.mockResolvedValue(true)

      const result = await gateway.healthCheck()

      expect(mockRedisService.healthCheck).toHaveBeenCalled()
      expect(result).toEqual({
        status: 'healthy',
        redis: true,
      })
    })

    it('should return degraded status when Redis is unhealthy', async () => {
      mockRedisService.healthCheck.mockResolvedValue(false)

      const result = await gateway.healthCheck()

      expect(result).toEqual({
        status: 'degraded',
        redis: false,
      })
    })
  })
})
