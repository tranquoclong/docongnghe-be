import Anthropic from '@anthropic-ai/sdk'
import { Test, TestingModule } from '@nestjs/testing'
import { AIMessageRole } from '@prisma/client'
import { AIAssistantRepo } from '../ai-assistant.repo'
import { AIAssistantService } from '../ai-assistant.service'

/**
 * AI ASSISTANT SERVICE UNIT TESTS
 *
 * Test Coverage:
 * - Send message to conversation
 * - Generate AI response
 * - Conversation title generation
 * - Fallback responses when API unavailable
 * - Error handling
 */

describe('AIAssistantService', () => {
  let service: AIAssistantService
  let mockAiAssistantRepo: jest.Mocked<AIAssistantRepo>
  let mockAnthropicClient: jest.Mocked<Anthropic>

  // Test data factories
  const createConversation = (overrides = {}) => ({
    id: 'conv-123',
    userId: 10,
    title: 'Test Conversation',
    context: {},
    isActive: true,
    isArchived: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    messages: [],
    ...overrides,
  })

  const createMessage = (overrides = {}) => ({
    id: 'msg-123',
    conversationId: 'conv-123',
    role: 'USER' as const,
    content: 'Hello, AI!',
    tokenCount: null,
    responseTime: null,
    model: null,
    error: null,
    createdAt: new Date(),
    contextUsed: null,
    ...overrides,
  })

  const createAnthropicResponse = (overrides = {}) => ({
    id: 'msg_123',
    type: 'message' as const,
    role: 'assistant' as const,
    content: [
      {
        type: 'text' as const,
        text: 'Hello! How can I help you today?',
      },
    ],
    model: 'claude-3-haiku-20240307',
    stop_reason: 'end_turn' as const,
    usage: {
      input_tokens: 10,
      output_tokens: 20,
    },
    ...overrides,
  })

  beforeEach(async () => {
    // Mock AIAssistantRepo
    mockAiAssistantRepo = {
      createConversation: jest.fn(),
      getConversationById: jest.fn(),
      createMessage: jest.fn(),
      updateConversation: jest.fn(),
      deleteConversation: jest.fn(),
      getUserConversations: jest.fn(),
      getArchivedConversations: jest.fn(),
      searchConversations: jest.fn(),
      getUserStats: jest.fn(),
    } as any

    // Mock Anthropic Client
    mockAnthropicClient = {
      messages: {
        create: jest.fn(),
        stream: jest.fn(),
      },
    } as any

    const module: TestingModule = await Test.createTestingModule({
      providers: [AIAssistantService, { provide: AIAssistantRepo, useValue: mockAiAssistantRepo }],
    }).compile()

    service = module.get<AIAssistantService>(AIAssistantService)

    // Inject mock Anthropic client
    ;(service as any).anthropic = mockAnthropicClient
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  // ============================================
  // SEND MESSAGE
  // ============================================

  describe('sendMessage', () => {
    it('should send message and get AI response successfully', async () => {
      // Arrange
      const userId = 10
      const conversationId = 'conv-123'
      const dto = { message: 'What is the return policy?' }
      const conversation = createConversation({ id: conversationId, messages: [] })
      const anthropicResponse = createAnthropicResponse()

      mockAiAssistantRepo.getConversationById.mockResolvedValue(conversation as any)
      ;(mockAnthropicClient.messages.create as jest.Mock).mockResolvedValue(anthropicResponse)
      mockAiAssistantRepo.createMessage.mockResolvedValue(createMessage() as any)
      mockAiAssistantRepo.updateConversation.mockResolvedValue({} as any)

      // Act
      const result = await service.sendMessage(conversationId, userId, dto)

      // Assert
      expect(result).toBeDefined()
      expect(result.userMessage).toBeDefined()
      expect(result.aiMessage).toBeDefined()
      expect(result.responseTime).toBeGreaterThanOrEqual(0)
      expect(mockAiAssistantRepo.createMessage).toHaveBeenCalledTimes(2) // User + AI message
    })

    it('should throw error when conversation not found', async () => {
      // Arrange
      const userId = 10
      const conversationId = 'invalid-conv'
      const dto = { message: 'Hello' }

      mockAiAssistantRepo.getConversationById.mockResolvedValue(null)

      // Act & Assert
      await expect(service.sendMessage(conversationId, userId, dto)).rejects.toThrow('Conversation not found')
    })

    it('should include conversation history in API request', async () => {
      // Arrange
      const userId = 10
      const conversationId = 'conv-123'
      const dto = { message: 'Continue our discussion' }
      const previousMessages = [
        { role: 'USER', content: 'Previous question' },
        { role: 'ASSISTANT', content: 'Previous answer' },
      ]
      const conversation = createConversation({ id: conversationId, messages: previousMessages })
      const anthropicResponse = createAnthropicResponse()

      mockAiAssistantRepo.getConversationById.mockResolvedValue(conversation as any)
      ;(mockAnthropicClient.messages.create as jest.Mock).mockResolvedValue(anthropicResponse)
      mockAiAssistantRepo.createMessage.mockResolvedValue(createMessage() as any)

      // Act
      await service.sendMessage(conversationId, userId, dto)

      // Assert
      expect(mockAnthropicClient.messages.create).toHaveBeenCalled()
      const callArgs = (mockAnthropicClient.messages.create as jest.Mock).mock.calls[0][0]
      expect(callArgs.messages).toHaveLength(3)
      expect(callArgs.messages[2].content).toBe(dto.message)
    })

    it('should update conversation title for first message', async () => {
      // Arrange
      const userId = 10
      const conversationId = 'conv-123'
      const dto = { message: 'What is your return policy?' }
      const conversation = createConversation({ id: conversationId, messages: [] })
      const anthropicResponse = createAnthropicResponse()

      mockAiAssistantRepo.getConversationById.mockResolvedValue(conversation as any)
      ;(mockAnthropicClient.messages.create as jest.Mock).mockResolvedValue(anthropicResponse)
      mockAiAssistantRepo.createMessage.mockResolvedValue(createMessage() as any)
      mockAiAssistantRepo.updateConversation.mockResolvedValue({} as any)

      // Act
      await service.sendMessage(conversationId, userId, dto)

      // Assert
      expect(mockAiAssistantRepo.updateConversation).toHaveBeenCalledWith(
        conversationId,
        expect.objectContaining({
          title: expect.any(String),
        }),
      )
    })

    it('should not update title for subsequent messages', async () => {
      // Arrange
      const userId = 10
      const conversationId = 'conv-123'
      const dto = { message: 'Another question' }
      const conversation = createConversation({
        id: conversationId,
        messages: [createMessage()], // Already has messages
      })
      const anthropicResponse = createAnthropicResponse()

      mockAiAssistantRepo.getConversationById.mockResolvedValue(conversation as any)
      ;(mockAnthropicClient.messages.create as jest.Mock).mockResolvedValue(anthropicResponse)
      mockAiAssistantRepo.createMessage.mockResolvedValue(createMessage() as any)

      // Act
      await service.sendMessage(conversationId, userId, dto)

      // Assert
      expect(mockAiAssistantRepo.updateConversation).not.toHaveBeenCalled()
    })
  })

  // ============================================
  // GENERATE RESPONSE
  // ============================================

  describe('generateResponse', () => {
    it('should generate AI response using Anthropic API', async () => {
      // Arrange
      const previousMessages = [
        { role: AIMessageRole.USER, content: 'Hello' },
        { role: AIMessageRole.ASSISTANT, content: 'Hi there!' },
      ]
      const userMessage = 'How are you?'
      const anthropicResponse = createAnthropicResponse()

      ;(mockAnthropicClient.messages.create as jest.Mock).mockResolvedValue(anthropicResponse)

      // Act
      const result = await service.generateResponse(previousMessages, userMessage)

      // Assert
      expect(result).toBe('Hello! How can I help you today?')
      expect(mockAnthropicClient.messages.create).toHaveBeenCalled()
    })

    it('should return fallback response when Anthropic API fails', async () => {
      // Arrange
      const previousMessages: { role: AIMessageRole; content: string }[] = []
      const userMessage = 'Hello'

      ;(mockAnthropicClient.messages.create as jest.Mock).mockRejectedValue(new Error('API unavailable'))

      // Act
      const result = await service.generateResponse(previousMessages, userMessage)

      // Assert
      expect(result).toContain('trợ lý ảo')
    })

    it('should handle empty response from Anthropic', async () => {
      // Arrange
      const previousMessages: { role: AIMessageRole; content: string }[] = []
      const userMessage = 'Hello'
      const emptyResponse = createAnthropicResponse({ content: [] })

      ;(mockAnthropicClient.messages.create as jest.Mock).mockResolvedValue(emptyResponse)

      // Act
      const result = await service.generateResponse(previousMessages, userMessage)

      // Assert
      expect(result).toContain('trợ lý ảo')
    })

    it('should return quota fallback response for 429 error', async () => {
      // Arrange
      const previousMessages: { role: AIMessageRole; content: string }[] = []
      const userMessage = 'xin chào'
      const quotaError = new Error('Rate limit exceeded')
      ;(quotaError as { status?: number }).status = 429
      ;(mockAnthropicClient.messages.create as jest.Mock).mockRejectedValue(quotaError)

      // Act
      const result = await service.generateResponse(previousMessages, userMessage)

      // Assert
      expect(result).toContain('quá tải')
      expect(result).toContain('Xin chào')
    })

    it('should return quota fallback response for quota error message', async () => {
      // Arrange
      const previousMessages: { role: AIMessageRole; content: string }[] = []
      const userMessage = 'Tôi muốn mua sản phẩm'
      const quotaError = new Error('Insufficient quota')

      ;(mockAnthropicClient.messages.create as jest.Mock).mockRejectedValue(quotaError)

      // Act
      const result = await service.generateResponse(previousMessages, userMessage)

      // Assert
      expect(result).toContain('quá tải')
    })

    it('should return auth fallback response for 401 error', async () => {
      // Arrange
      const previousMessages: { role: AIMessageRole; content: string }[] = []
      const userMessage = 'Hello'
      const authError = new Error('Invalid API key')
      ;(authError as { status?: number }).status = 401
      ;(mockAnthropicClient.messages.create as jest.Mock).mockRejectedValue(authError)

      // Act
      const result = await service.generateResponse(previousMessages, userMessage)

      // Assert
      expect(result).toContain('xác thực')
      expect(result).toContain('quản trị viên')
    })

    it('should return auth fallback response for api key error message', async () => {
      // Arrange
      const previousMessages: { role: AIMessageRole; content: string }[] = []
      const userMessage = 'Hello'
      const authError = new Error('Invalid api key provided')

      ;(mockAnthropicClient.messages.create as jest.Mock).mockRejectedValue(authError)

      // Act
      const result = await service.generateResponse(previousMessages, userMessage)

      // Assert
      expect(result).toContain('xác thực')
    })

    it('should return general fallback response for other errors', async () => {
      // Arrange
      const previousMessages: { role: AIMessageRole; content: string }[] = []
      const userMessage = 'Hello'
      const genericError = new Error('Network error')

      ;(mockAnthropicClient.messages.create as jest.Mock).mockRejectedValue(genericError)

      // Act
      const result = await service.generateResponse(previousMessages, userMessage)

      // Assert
      expect(result).toContain('bảo trì')
    })
  })

  // ============================================
  // GENERATE CONVERSATION TITLE
  // ============================================

  describe('generateConversationTitle', () => {
    it('should return short message as-is when length <= 50', async () => {
      // Arrange
      const shortMessage = 'Tôi muốn mua laptop'

      // Act
      const result = await service.generateConversationTitle(shortMessage)

      // Assert
      expect(result).toBe(shortMessage)
      expect(mockAnthropicClient.messages.create).not.toHaveBeenCalled()
    })

    it('should truncate long message when no API key', async () => {
      // Arrange
      const longMessage = 'Tôi muốn tìm hiểu về các sản phẩm laptop gaming có cấu hình cao và giá cả phải chăng'
      ;(service as any).anthropic = null // Simulate no API key

      // Act
      const result = await service.generateConversationTitle(longMessage)

      // Assert
      expect(result).toHaveLength(53) // 50 chars + '...'
      expect(result).toContain('...')
    })

    it('should generate title using Anthropic API for long message', async () => {
      // Arrange
      const longMessage = 'Tôi muốn tìm hiểu về các sản phẩm laptop gaming có cấu hình cao và giá cả phải chăng'
      const titleResponse = createAnthropicResponse({
        content: [{ type: 'text', text: 'Tư vấn laptop gaming' }],
      })

      ;(mockAnthropicClient.messages.create as jest.Mock).mockResolvedValue(titleResponse)

      // Act
      const result = await service.generateConversationTitle(longMessage)

      // Assert
      expect(result).toBe('Tư vấn laptop gaming')
      expect(mockAnthropicClient.messages.create).toHaveBeenCalled()
    })

    it('should truncate title if API returns long title', async () => {
      // Arrange
      const longMessage = 'Tôi muốn tìm hiểu về các sản phẩm laptop gaming có cấu hình cao'
      const titleResponse = createAnthropicResponse({
        content: [
          {
            type: 'text',
            text: 'Tư vấn về các sản phẩm laptop gaming có cấu hình cao và giá cả phải chăng cho sinh viên',
          },
        ],
      })

      ;(mockAnthropicClient.messages.create as jest.Mock).mockResolvedValue(titleResponse)

      // Act
      const result = await service.generateConversationTitle(longMessage)

      // Assert
      expect(result.length).toBeLessThanOrEqual(50)
    })

    it('should fallback to truncated message when API fails', async () => {
      // Arrange
      const longMessage = 'Tôi muốn tìm hiểu về các sản phẩm laptop gaming có cấu hình cao'

      ;(mockAnthropicClient.messages.create as jest.Mock).mockRejectedValue(new Error('API error'))

      // Act
      const result = await service.generateConversationTitle(longMessage)

      // Assert
      expect(result).toHaveLength(53) // 50 chars + '...'
      expect(result).toContain('...')
    })

    it('should fallback to truncated message when API returns empty content', async () => {
      // Arrange
      const longMessage = 'Tôi muốn tìm hiểu về các sản phẩm laptop gaming có cấu hình cao'
      const emptyResponse = createAnthropicResponse({ content: [] })

      ;(mockAnthropicClient.messages.create as jest.Mock).mockResolvedValue(emptyResponse)

      // Act
      const result = await service.generateConversationTitle(longMessage)

      // Assert
      expect(result).toHaveLength(53)
      expect(result).toContain('...')
    })
  })

  // ============================================
  // EDGE CASES
  // ============================================

  describe('Edge Cases', () => {
    it('should return fallback when no API key configured', async () => {
      // Arrange - simulate no API key
      const previousMessages: { role: AIMessageRole; content: string }[] = []
      const userMessage = 'xin chào'

      // Mock envConfig to return empty API key
      const originalEnv = process.env.ANTHROPIC_API_KEY
      process.env.ANTHROPIC_API_KEY = ''

      // The service checks envConfig.ANTHROPIC_API_KEY at runtime in generateResponse
      // Since we mock the client, we need to test the fallback path differently
      ;(mockAnthropicClient.messages.create as jest.Mock).mockRejectedValue(new Error('No API key'))

      const result = await service.generateResponse(previousMessages, userMessage)

      expect(result).toBeDefined()
      expect(typeof result).toBe('string')
      process.env.ANTHROPIC_API_KEY = originalEnv
    })

    it('should handle 500 server error from Anthropic', async () => {
      const previousMessages: { role: AIMessageRole; content: string }[] = []
      const userMessage = 'Hello'
      const serverError = new Error('Internal server error')
      ;(serverError as any).status = 500

      ;(mockAnthropicClient.messages.create as jest.Mock).mockRejectedValue(serverError)

      const result = await service.generateResponse(previousMessages, userMessage)

      // Should return general fallback (bảo trì)
      expect(result).toContain('bảo trì')
    })

    it('should handle timeout error from Anthropic', async () => {
      const previousMessages: { role: AIMessageRole; content: string }[] = []
      const userMessage = 'Hello'
      const timeoutError = new Error('Request timed out')
      ;(timeoutError as any).code = 'ETIMEDOUT'

      ;(mockAnthropicClient.messages.create as jest.Mock).mockRejectedValue(timeoutError)

      const result = await service.generateResponse(previousMessages, userMessage)

      expect(result).toBeDefined()
      expect(typeof result).toBe('string')
    })

    it('should handle empty conversation history', async () => {
      const userId = 10
      const conversationId = 'conv-123'
      const dto = { message: 'First message ever' }
      const conversation = createConversation({ id: conversationId, messages: [] })
      const anthropicResponse = createAnthropicResponse()

      mockAiAssistantRepo.getConversationById.mockResolvedValue(conversation as any)
      ;(mockAnthropicClient.messages.create as jest.Mock).mockResolvedValue(anthropicResponse)
      mockAiAssistantRepo.createMessage.mockResolvedValue(createMessage() as any)
      mockAiAssistantRepo.updateConversation.mockResolvedValue({} as any)

      const result = await service.sendMessage(conversationId, userId, dto)

      expect(result).toBeDefined()
      // Should update title since it's the first message
      expect(mockAiAssistantRepo.updateConversation).toHaveBeenCalled()
    })

    it('should throw error for non-existent conversation', async () => {
      const userId = 10
      const conversationId = 'non-existent'
      const dto = { message: 'Hello' }

      mockAiAssistantRepo.getConversationById.mockResolvedValue(null)

      await expect(service.sendMessage(conversationId, userId, dto)).rejects.toThrow('Conversation not found')
    })

    it('should handle concurrent sendMessage calls', async () => {
      const userId = 10
      const conversationId = 'conv-123'
      const conversation = createConversation({ id: conversationId, messages: [createMessage()] })
      const anthropicResponse = createAnthropicResponse()

      mockAiAssistantRepo.getConversationById.mockResolvedValue(conversation as any)
      ;(mockAnthropicClient.messages.create as jest.Mock).mockResolvedValue(anthropicResponse)
      mockAiAssistantRepo.createMessage.mockResolvedValue(createMessage() as any)

      const [result1, result2] = await Promise.all([
        service.sendMessage(conversationId, userId, { message: 'Message 1' }),
        service.sendMessage(conversationId, userId, { message: 'Message 2' }),
      ])

      expect(result1).toBeDefined()
      expect(result2).toBeDefined()
      expect(mockAiAssistantRepo.createMessage).toHaveBeenCalledTimes(4) // 2 user + 2 AI
    })

    it('should handle product-related fallback response', async () => {
      const previousMessages: { role: AIMessageRole; content: string }[] = []
      const userMessage = 'Tôi muốn mua sản phẩm laptop'

      ;(mockAnthropicClient.messages.create as jest.Mock).mockRejectedValue(new Error('API down'))

      const result = await service.generateResponse(previousMessages, userMessage)

      expect(result).toContain('sản phẩm')
    })

    it('should handle order-related fallback response', async () => {
      const previousMessages: { role: AIMessageRole; content: string }[] = []
      const userMessage = 'Kiểm tra đơn hàng của tôi'

      ;(mockAnthropicClient.messages.create as jest.Mock).mockRejectedValue(new Error('API down'))

      const result = await service.generateResponse(previousMessages, userMessage)

      expect(result).toContain('đơn hàng')
    })

    it('should handle price-related fallback response', async () => {
      const previousMessages: { role: AIMessageRole; content: string }[] = []
      const userMessage = 'Giá khuyến mãi hôm nay'

      ;(mockAnthropicClient.messages.create as jest.Mock).mockRejectedValue(new Error('API down'))

      const result = await service.generateResponse(previousMessages, userMessage)

      expect(result).toContain('Giá')
    })
  })
})
