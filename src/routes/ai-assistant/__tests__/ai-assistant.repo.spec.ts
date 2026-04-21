import { Test, TestingModule } from '@nestjs/testing'
import { AIMessageRole } from '@prisma/client'
import { PrismaService } from 'src/shared/services/prisma.service'
import { AIAssistantRepo } from '../ai-assistant.repo'

describe('AIAssistantRepo', () => {
  let repository: AIAssistantRepo

  // Mock PrismaService
  const mockPrismaService = {
    aIConversation: {
      create: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
    },
    aIMessage: {
      create: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      aggregate: jest.fn(),
    },
  }

  // Test data factory
  const createTestData = {
    conversation: (overrides = {}) => ({
      id: 'conv-1',
      userId: 1,
      title: 'Test Conversation',
      context: {},
      isActive: true,
      isArchived: false,
      createdAt: new Date('2024-01-01'),
      updatedAt: new Date('2024-01-01'),
      ...overrides,
    }),
    conversationWithUser: (overrides = {}) => ({
      id: 'conv-1',
      userId: 1,
      title: 'Test Conversation',
      context: {},
      isActive: true,
      isArchived: false,
      createdAt: new Date('2024-01-01'),
      updatedAt: new Date('2024-01-01'),
      user: {
        id: 1,
        name: 'Test User',
        email: 'test@example.com',
        avatar: null,
      },
      _count: {
        messages: 5,
      },
      ...overrides,
    }),
    message: (overrides = {}) => ({
      id: 'msg-1',
      conversationId: 'conv-1',
      role: AIMessageRole.USER,
      content: 'Test message',
      tokenCount: 10,
      responseTime: 500,
      model: 'claude-3-haiku',
      error: null,
      createdAt: new Date('2024-01-01'),
      ...overrides,
    }),
    messageWithConversation: (overrides = {}) => ({
      id: 'msg-1',
      conversationId: 'conv-1',
      role: AIMessageRole.USER,
      content: 'Test message',
      tokenCount: 10,
      responseTime: 500,
      model: 'claude-3-haiku',
      error: null,
      createdAt: new Date('2024-01-01'),
      conversation: {
        id: 'conv-1',
        title: 'Test Conversation',
        createdAt: new Date('2024-01-01'),
      },
      ...overrides,
    }),
  }

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AIAssistantRepo,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile()

    repository = module.get<AIAssistantRepo>(AIAssistantRepo)

    // Reset mocks
    jest.clearAllMocks()
  })

  describe('createConversation', () => {
    it('should create conversation successfully', async () => {
      // Arrange - Chuẩn bị dữ liệu
      const data = { userId: 1, title: 'New Conversation', context: { key: 'value' } }
      const mockConversation = createTestData.conversationWithUser({
        title: data.title,
        context: data.context,
      })

      mockPrismaService.aIConversation.create.mockResolvedValue(mockConversation)

      // Act - Thực hiện tạo conversation
      const result = await repository.createConversation(data)

      // Assert - Kiểm tra kết quả
      expect(result).toMatchObject({
        userId: 1,
        title: 'New Conversation',
        context: { key: 'value' },
      })
      expect(mockPrismaService.aIConversation.create).toHaveBeenCalled()
    })

    it('should create conversation with default empty context', async () => {
      // Arrange - Chuẩn bị dữ liệu
      const data = { userId: 1, title: 'New Conversation' }
      const mockConversation = createTestData.conversationWithUser({
        title: data.title,
        context: {},
      })

      mockPrismaService.aIConversation.create.mockResolvedValue(mockConversation)

      // Act - Thực hiện tạo conversation không truyền context
      const result = await repository.createConversation(data)

      // Assert - Kiểm tra kết quả
      expect(result).toMatchObject({
        userId: 1,
        title: 'New Conversation',
        context: {},
      })
    })
  })

  describe('getConversationById', () => {
    it('should get conversation by id successfully', async () => {
      // Arrange - Chuẩn bị dữ liệu
      const conversationId = 'conv-1'
      const userId = 1
      const mockConversation = createTestData.conversationWithUser({
        id: conversationId,
        userId,
        messages: [
          createTestData.message({ id: 'msg-1', role: AIMessageRole.USER }),
          createTestData.message({ id: 'msg-2', role: AIMessageRole.ASSISTANT }),
        ],
      })

      mockPrismaService.aIConversation.findFirst.mockResolvedValue(mockConversation)

      // Act - Thực hiện lấy conversation
      const result = await repository.getConversationById(conversationId, userId)

      // Assert - Kiểm tra kết quả
      expect(result).toMatchObject({
        id: conversationId,
        userId,
      })
      expect(mockPrismaService.aIConversation.findFirst).toHaveBeenCalled()
    })

    it('should return null when conversation not found', async () => {
      // Arrange - Chuẩn bị dữ liệu
      const conversationId = 'non-existent'
      const userId = 1

      mockPrismaService.aIConversation.findFirst.mockResolvedValue(null)

      // Act - Thực hiện lấy conversation
      const result = await repository.getConversationById(conversationId, userId)

      // Assert - Kiểm tra kết quả
      expect(result).toBeNull()
    })
  })

  describe('getUserConversations', () => {
    it('should get user conversations with pagination', async () => {
      // Arrange - Chuẩn bị dữ liệu
      const userId = 1
      const page = 1
      const limit = 20
      const mockConversations = [
        createTestData.conversationWithUser({
          id: 'conv-1',
          messages: [createTestData.message({ content: 'Last message 1' })],
        }),
        createTestData.conversationWithUser({
          id: 'conv-2',
          messages: [createTestData.message({ content: 'Last message 2' })],
        }),
      ]

      mockPrismaService.aIConversation.findMany.mockResolvedValue(mockConversations)
      mockPrismaService.aIConversation.count.mockResolvedValue(2)

      // Act - Thực hiện lấy conversations
      const result = await repository.getUserConversations(userId, page, limit)

      // Assert - Kiểm tra kết quả
      expect(result.conversations).toHaveLength(2)
      expect(result.conversations[0].lastMessage).toMatchObject({ content: 'Last message 1' })
      expect(result.conversations[0].messages).toBeUndefined()
      expect(result.pagination).toEqual({
        page: 1,
        limit: 20,
        total: 2,
        totalPages: 1,
        hasNext: false,
        hasPrev: false,
      })
    })

    it('should use default pagination values', async () => {
      // Arrange - Chuẩn bị dữ liệu
      const userId = 1
      const mockConversations = [createTestData.conversationWithUser({ messages: [] })]

      mockPrismaService.aIConversation.findMany.mockResolvedValue(mockConversations)
      mockPrismaService.aIConversation.count.mockResolvedValue(1)

      // Act - Thực hiện lấy conversations không truyền page và limit
      const result = await repository.getUserConversations(userId)

      // Assert - Kiểm tra kết quả
      expect(result.pagination.page).toBe(1)
      expect(result.pagination.limit).toBe(20)
    })

    it('should handle conversations without messages', async () => {
      // Arrange - Chuẩn bị dữ liệu
      const userId = 1
      const mockConversations = [createTestData.conversationWithUser({ messages: [] })]

      mockPrismaService.aIConversation.findMany.mockResolvedValue(mockConversations)
      mockPrismaService.aIConversation.count.mockResolvedValue(1)

      // Act - Thực hiện lấy conversations
      const result = await repository.getUserConversations(userId)

      // Assert - Kiểm tra kết quả
      expect(result.conversations[0].lastMessage).toBeNull()
    })
  })

  describe('createMessage', () => {
    it('should create message successfully', async () => {
      // Arrange - Chuẩn bị dữ liệu
      const data = {
        conversationId: 'conv-1',
        role: AIMessageRole.USER,
        content: 'Hello AI',
        tokenCount: 5,
        responseTime: 300,
        model: 'claude-3-haiku',
      }
      const mockMessage = createTestData.message(data)
      const mockConversation = createTestData.conversation()

      mockPrismaService.aIMessage.create.mockResolvedValue(mockMessage)
      mockPrismaService.aIConversation.update.mockResolvedValue(mockConversation)

      // Act - Thực hiện tạo message
      const result = await repository.createMessage(data)

      // Assert - Kiểm tra kết quả
      expect(result).toMatchObject({
        conversationId: 'conv-1',
        role: AIMessageRole.USER,
        content: 'Hello AI',
      })
      expect(mockPrismaService.aIMessage.create).toHaveBeenCalled()
      expect(mockPrismaService.aIConversation.update).toHaveBeenCalled()
    })

    it('should create message with optional fields', async () => {
      // Arrange - Chuẩn bị dữ liệu
      const data = {
        conversationId: 'conv-1',
        role: AIMessageRole.ASSISTANT,
        content: 'AI response',
        error: 'Some error',
        contextUsed: { key: 'value' },
      }
      const mockMessage = createTestData.message(data)
      const mockConversation = createTestData.conversation()

      mockPrismaService.aIMessage.create.mockResolvedValue(mockMessage)
      mockPrismaService.aIConversation.update.mockResolvedValue(mockConversation)

      // Act - Thực hiện tạo message với error và contextUsed
      const result = await repository.createMessage(data)

      // Assert - Kiểm tra kết quả
      expect(result).toMatchObject({
        conversationId: 'conv-1',
        role: AIMessageRole.ASSISTANT,
        content: 'AI response',
      })
    })
  })

  describe('updateConversation', () => {
    it('should update conversation successfully', async () => {
      // Arrange - Chuẩn bị dữ liệu
      const conversationId = 'conv-1'
      const data = { title: 'Updated Title', context: { updated: true } }
      const mockConversation = createTestData.conversation({ ...data })

      mockPrismaService.aIConversation.update.mockResolvedValue(mockConversation)

      // Act - Thực hiện cập nhật conversation
      const result = await repository.updateConversation(conversationId, data)

      // Assert - Kiểm tra kết quả
      expect(result).toMatchObject({
        title: 'Updated Title',
        context: { updated: true },
      })
      expect(mockPrismaService.aIConversation.update).toHaveBeenCalled()
    })

    it('should update conversation with isArchived flag', async () => {
      // Arrange - Chuẩn bị dữ liệu
      const conversationId = 'conv-1'
      const data = { isArchived: true }
      const mockConversation = createTestData.conversation({ isArchived: true })

      mockPrismaService.aIConversation.update.mockResolvedValue(mockConversation)

      // Act - Thực hiện archive conversation
      const result = await repository.updateConversation(conversationId, data)

      // Assert - Kiểm tra kết quả
      expect(result).toMatchObject({
        isArchived: true,
      })
    })
  })

  describe('deleteConversation', () => {
    it('should soft delete conversation successfully', async () => {
      // Arrange - Chuẩn bị dữ liệu
      const conversationId = 'conv-1'
      const mockConversation = createTestData.conversation({ isActive: false })

      mockPrismaService.aIConversation.update.mockResolvedValue(mockConversation)

      // Act - Thực hiện xóa conversation
      const result = await repository.deleteConversation(conversationId)

      // Assert - Kiểm tra kết quả
      expect(result).toMatchObject({
        isActive: false,
      })
      expect(mockPrismaService.aIConversation.update).toHaveBeenCalled()
    })
  })

  describe('getArchivedConversations', () => {
    it('should get archived conversations with pagination', async () => {
      // Arrange - Chuẩn bị dữ liệu
      const userId = 1
      const page = 1
      const limit = 20
      const mockConversations = [
        createTestData.conversationWithUser({
          id: 'conv-1',
          isArchived: true,
          messages: [createTestData.message({ content: 'Archived message' })],
        }),
      ]

      mockPrismaService.aIConversation.findMany.mockResolvedValue(mockConversations)
      mockPrismaService.aIConversation.count.mockResolvedValue(1)

      // Act - Thực hiện lấy archived conversations
      const result = await repository.getArchivedConversations(userId, page, limit)

      // Assert - Kiểm tra kết quả
      expect(result.conversations).toHaveLength(1)
      expect(result.conversations[0].lastMessage).toMatchObject({ content: 'Archived message' })
      expect(result.pagination).toEqual({
        page: 1,
        limit: 20,
        total: 1,
        totalPages: 1,
        hasNext: false,
        hasPrev: false,
      })
    })

    it('should use default pagination values', async () => {
      // Arrange - Chuẩn bị dữ liệu
      const userId = 1
      const mockConversations = [createTestData.conversationWithUser({ isArchived: true, messages: [] })]

      mockPrismaService.aIConversation.findMany.mockResolvedValue(mockConversations)
      mockPrismaService.aIConversation.count.mockResolvedValue(1)

      // Act - Thực hiện lấy archived conversations không truyền page và limit
      const result = await repository.getArchivedConversations(userId)

      // Assert - Kiểm tra kết quả
      expect(result.pagination.page).toBe(1)
      expect(result.pagination.limit).toBe(20)
    })
  })

  describe('searchMessages', () => {
    it('should search messages successfully', async () => {
      // Arrange - Chuẩn bị dữ liệu
      const userId = 1
      const query = 'test query'
      const page = 1
      const limit = 20
      const mockMessages = [
        createTestData.messageWithConversation({ content: 'This is a test query message' }),
        createTestData.messageWithConversation({ content: 'Another test query result' }),
      ]

      mockPrismaService.aIMessage.findMany.mockResolvedValue(mockMessages)
      mockPrismaService.aIMessage.count.mockResolvedValue(2)

      // Act - Thực hiện search messages
      const result = await repository.searchMessages(userId, query, page, limit)

      // Assert - Kiểm tra kết quả
      expect(result.messages).toHaveLength(2)
      expect(result.pagination).toEqual({
        page: 1,
        limit: 20,
        total: 2,
        totalPages: 1,
        hasNext: false,
        hasPrev: false,
      })
    })

    it('should use default pagination values', async () => {
      // Arrange - Chuẩn bị dữ liệu
      const userId = 1
      const query = 'test'
      const mockMessages = [createTestData.messageWithConversation()]

      mockPrismaService.aIMessage.findMany.mockResolvedValue(mockMessages)
      mockPrismaService.aIMessage.count.mockResolvedValue(1)

      // Act - Thực hiện search không truyền page và limit
      const result = await repository.searchMessages(userId, query)

      // Assert - Kiểm tra kết quả
      expect(result.pagination.page).toBe(1)
      expect(result.pagination.limit).toBe(20)
    })
  })

  describe('getUserStats', () => {
    it('should get user statistics successfully', async () => {
      // Arrange - Chuẩn bị dữ liệu
      const userId = 1

      // Mock các Promise.all calls
      mockPrismaService.aIConversation.count.mockResolvedValue(10)
      mockPrismaService.aIMessage.count
        .mockResolvedValueOnce(50) // totalMessages
        .mockResolvedValueOnce(5) // recentActivity

      mockPrismaService.aIMessage.aggregate
        .mockResolvedValueOnce({
          _sum: { tokenCount: 1000 },
        })
        .mockResolvedValueOnce({
          _avg: { responseTime: 500 },
        })

      // Act - Thực hiện lấy stats
      const result = await repository.getUserStats(userId)

      // Assert - Kiểm tra kết quả
      expect(result).toEqual({
        totalConversations: 10,
        totalMessages: 50,
        totalTokens: 1000,
        avgResponseTime: 500,
        recentActivity: 5,
      })
      expect(mockPrismaService.aIConversation.count).toHaveBeenCalled()
      expect(mockPrismaService.aIMessage.count).toHaveBeenCalledTimes(2)
      expect(mockPrismaService.aIMessage.aggregate).toHaveBeenCalledTimes(2)
    })

    it('should handle null token count', async () => {
      // Arrange - Chuẩn bị dữ liệu
      const userId = 1

      mockPrismaService.aIConversation.count.mockResolvedValue(5)
      mockPrismaService.aIMessage.count.mockResolvedValueOnce(20).mockResolvedValueOnce(2)

      mockPrismaService.aIMessage.aggregate
        .mockResolvedValueOnce({
          _sum: { tokenCount: null },
        })
        .mockResolvedValueOnce({
          _avg: { responseTime: 300 },
        })

      // Act - Thực hiện lấy stats
      const result = await repository.getUserStats(userId)

      // Assert - Kiểm tra kết quả
      expect(result.totalTokens).toBe(0)
    })

    it('should handle null response time', async () => {
      // Arrange - Chuẩn bị dữ liệu
      const userId = 1

      mockPrismaService.aIConversation.count.mockResolvedValue(5)
      mockPrismaService.aIMessage.count.mockResolvedValueOnce(20).mockResolvedValueOnce(2)

      mockPrismaService.aIMessage.aggregate
        .mockResolvedValueOnce({
          _sum: { tokenCount: 500 },
        })
        .mockResolvedValueOnce({
          _avg: { responseTime: null },
        })

      // Act - Thực hiện lấy stats
      const result = await repository.getUserStats(userId)

      // Assert - Kiểm tra kết quả
      expect(result.avgResponseTime).toBe(0)
    })
  })
})
