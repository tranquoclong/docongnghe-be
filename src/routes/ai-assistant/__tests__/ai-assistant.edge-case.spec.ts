import Anthropic from '@anthropic-ai/sdk'
import { Test, TestingModule } from '@nestjs/testing'
import { AIMessageRole } from '@prisma/client'
import { AIAssistantRepo } from '../ai-assistant.repo'
import { AIAssistantService } from '../ai-assistant.service'

describe('AIAssistantService — Edge Cases', () => {
  let service: AIAssistantService
  let mockRepo: jest.Mocked<AIAssistantRepo>
  let mockAnthropicClient: jest.Mocked<Anthropic>

  const createConversation = (overrides = {}) => ({
    id: 'conv-1',
    userId: 1,
    title: 'Test',
    context: {},
    isActive: true,
    isArchived: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    messages: [],
    ...overrides,
  })

  const createMessage = (overrides = {}) => ({
    id: 'msg-1',
    conversationId: 'conv-1',
    role: 'USER' as const,
    content: 'Hello',
    tokenCount: null,
    responseTime: null,
    model: null,
    error: null,
    createdAt: new Date(),
    contextUsed: null,
    ...overrides,
  })

  beforeEach(async () => {
    mockRepo = {
      createConversation: jest.fn(),
      getConversationById: jest.fn(),
      createMessage: jest.fn(),
      updateConversation: jest.fn(),
      deleteConversation: jest.fn(),
      getUserConversations: jest.fn(),
      getArchivedConversations: jest.fn(),
      searchMessages: jest.fn(),
      getUserStats: jest.fn(),
    } as any

    mockAnthropicClient = {
      messages: {
        create: jest.fn(),
        stream: jest.fn(),
      },
    } as any

    const module: TestingModule = await Test.createTestingModule({
      providers: [AIAssistantService, { provide: AIAssistantRepo, useValue: mockRepo }],
    }).compile()
    service = module.get<AIAssistantService>(AIAssistantService)
    ;(service as any).anthropic = mockAnthropicClient
  })

  afterEach(() => jest.clearAllMocks())

  describe('archiveConversation — edge cases', () => {
    it('should throw when conversation not found', async () => {
      mockRepo.getConversationById.mockResolvedValue(null)
      await expect(service.archiveConversation('invalid', 1)).rejects.toThrow('Conversation not found')
    })

    it('should archive successfully and return success', async () => {
      mockRepo.getConversationById.mockResolvedValue(createConversation() as any)
      mockRepo.updateConversation.mockResolvedValue({} as any)
      const result = await service.archiveConversation('conv-1', 1)
      expect(result).toEqual({ success: true })
      expect(mockRepo.updateConversation).toHaveBeenCalledWith('conv-1', { isArchived: true })
    })
  })

  describe('deleteConversation — edge cases', () => {
    it('should throw when conversation not found', async () => {
      mockRepo.getConversationById.mockResolvedValue(null)
      await expect(service.deleteConversation('invalid', 1)).rejects.toThrow('Conversation not found')
    })

    it('should delete successfully and return success', async () => {
      mockRepo.getConversationById.mockResolvedValue(createConversation() as any)
      mockRepo.deleteConversation.mockResolvedValue({} as any)
      const result = await service.deleteConversation('conv-1', 1)
      expect(result).toEqual({ success: true })
      expect(mockRepo.deleteConversation).toHaveBeenCalledWith('conv-1')
    })
  })

  describe('getConversationDetails — edge cases', () => {
    it('should throw when conversation not found', async () => {
      mockRepo.getConversationById.mockResolvedValue(null)
      await expect(service.getConversationDetails('invalid', 1)).rejects.toThrow('Conversation not found')
    })

    it('should return conversation when found', async () => {
      const conv = createConversation()
      mockRepo.getConversationById.mockResolvedValue(conv as any)
      const result = await service.getConversationDetails('conv-1', 1)
      expect(result).toEqual(conv)
    })
  })

  describe('searchMessages — edge cases', () => {
    it('should propagate repo errors', async () => {
      mockRepo.searchMessages.mockRejectedValue(new Error('DB error'))
      await expect(service.searchMessages(1, 'query')).rejects.toThrow('DB error')
    })

    it('should pass default pagination', async () => {
      mockRepo.searchMessages.mockResolvedValue({ data: [], totalItems: 0 } as any)
      await service.searchMessages(1, 'test')
      expect(mockRepo.searchMessages).toHaveBeenCalledWith(1, 'test', 1, 20)
    })
  })

  describe('getUserStats — edge cases', () => {
    it('should propagate repo errors', async () => {
      mockRepo.getUserStats.mockRejectedValue(new Error('DB error'))
      await expect(service.getUserStats(1)).rejects.toThrow('DB error')
    })
  })

  describe('createConversation — edge cases', () => {
    it('should propagate repo errors', async () => {
      mockRepo.createConversation.mockRejectedValue(new Error('DB error'))
      await expect(service.createConversation(1, {})).rejects.toThrow('DB error')
    })

    it('should pass empty context when not provided', async () => {
      mockRepo.createConversation.mockResolvedValue(createConversation() as any)
      await service.createConversation(1, {})
      expect(mockRepo.createConversation).toHaveBeenCalledWith({ userId: 1, context: {} })
    })
  })

  describe('generateResponse — keyword-based fallback responses', () => {
    it('should return product-related fallback for "sản phẩm" keyword', async () => {
      ;(mockAnthropicClient.messages.create as jest.Mock).mockRejectedValue(new Error('Network error'))
      const result = await service.generateResponse([], 'Tôi muốn mua sản phẩm')
      expect(result).toContain('sản phẩm')
    })

    it('should return order-related fallback for "đơn hàng" keyword', async () => {
      ;(mockAnthropicClient.messages.create as jest.Mock).mockRejectedValue(new Error('Network error'))
      const result = await service.generateResponse([], 'Kiểm tra đơn hàng')
      expect(result).toContain('đơn hàng')
    })

    it('should return price-related fallback for "giá" keyword', async () => {
      ;(mockAnthropicClient.messages.create as jest.Mock).mockRejectedValue(new Error('Network error'))
      const result = await service.generateResponse([], 'Giá bao nhiêu vậy')
      expect(result).toContain('Giá')
    })
  })

  describe('handleStreamingError — error classification', () => {
    it('should call onError with quota message for 429', () => {
      const callbacks = { onChunk: jest.fn(), onComplete: jest.fn(), onError: jest.fn() }
      ;(service as any).handleStreamingError({ status: 429 }, callbacks)
      expect(callbacks.onError).toHaveBeenCalledWith('Quota limit reached')
    })

    it('should call onError with auth message for 401', () => {
      const callbacks = { onChunk: jest.fn(), onComplete: jest.fn(), onError: jest.fn() }
      ;(service as any).handleStreamingError({ status: 401 }, callbacks)
      expect(callbacks.onError).toHaveBeenCalledWith('Authentication failed')
    })

    it('should call onError with generic message for other errors', () => {
      const callbacks = { onChunk: jest.fn(), onComplete: jest.fn(), onError: jest.fn() }
      ;(service as any).handleStreamingError({ message: 'Something broke' }, callbacks)
      expect(callbacks.onError).toHaveBeenCalledWith('Something broke')
    })

    it('should use default message when error has no message', () => {
      const callbacks = { onChunk: jest.fn(), onComplete: jest.fn(), onError: jest.fn() }
      ;(service as any).handleStreamingError({}, callbacks)
      expect(callbacks.onError).toHaveBeenCalledWith('Failed to initialize streaming')
    })
  })
})
