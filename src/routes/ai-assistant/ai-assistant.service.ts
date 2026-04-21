import { Injectable, Logger } from '@nestjs/common'
import envConfig from 'src/shared/config'
import Anthropic from '@anthropic-ai/sdk'
import { AIAssistantRepo } from './ai-assistant.repo'
import { AIMessageRole } from '@prisma/client'
import { CreateAIConversationDto, SendAIMessageDto, StreamingCallbacks } from './ai-assistant.dto'
import { DEFAULT_AI_CONFIG } from './ai-assistant.model'

interface AIConversationMessage {
  role: AIMessageRole
  content: string
}

@Injectable()
export class AIAssistantService {
  private readonly logger = new Logger(AIAssistantService.name)
  private readonly anthropic: Anthropic

  constructor(private readonly aiAssistantRepo: AIAssistantRepo) {
    const apiKey = envConfig.ANTHROPIC_API_KEY

    if (!apiKey) {
      this.logger.warn('⚠️  ANTHROPIC_API_KEY chưa được cấu hình trong file .env')
      this.logger.warn('⚠️  AI Assistant sẽ hoạt động với fallback responses')
    }

    this.anthropic = new Anthropic({
      apiKey: apiKey,
      timeout: DEFAULT_AI_CONFIG.timeout,
    })
  }

  /**
   * Tạo system prompt cho E-commerce AI Assistant
   */
  private getSystemPrompt(): string {
    return `Bạn là trợ lý ảo thông minh cho hệ thống E-commerce. Nhiệm vụ của bạn:

🛍️ HỖ TRỢ MUA SẮM:
- Tư vấn sản phẩm phù hợp với nhu cầu
- So sánh sản phẩm, giá cả, chất lượng
- Giải thích tính năng, thông số kỹ thuật
- Gợi ý sản phẩm tương tự hoặc phụ kiện

📦 HỖ TRỢ ĐỚN HÀNG:
- Hướng dẫn đặt hàng, thanh toán
- Tra cứu trạng thái đơn hàng
- Chính sách đổi trả, bảo hành
- Phí vận chuyển, thời gian giao hàng

💡 NGUYÊN TẮC TRẢ LỜI:
- Trả lời bằng tiếng Việt thân thiện, chuyên nghiệp
- Sử dụng emoji phù hợp để tạo cảm xúc
- Trả lời ngắn gọn, súc tích nhưng đầy đủ thông tin
- Ưu tiên giải pháp cụ thể, hữu ích
- Nếu không biết thông tin chính xác, hãy thành thật nói và gợi ý cách tìm hiểu

🚫 GIỚI HẠN:
- Chỉ tư vấn về mua sắm, sản phẩm, dịch vụ e-commerce
- Không thảo luận chủ đề ngoài phạm vi mua sắm
- Không đưa ra lời khuyên tài chính, y tế, pháp lý`
  }

  /**
   * Fallback responses khi không có Anthropic API key hoặc có lỗi
   */
  private getFallbackResponse(userMessage: string, errorType: string = 'general'): string {
    const lowerMessage = userMessage.toLowerCase()

    // Xử lý theo loại lỗi
    if (errorType === 'quota') {
      if (lowerMessage.includes('xin chào') || lowerMessage.includes('hello')) {
        return 'Xin chào! Tôi là trợ lý ảo của shop. Hiện tại hệ thống AI đang quá tải, nhưng tôi vẫn có thể hỗ trợ bạn với các câu hỏi cơ bản về sản phẩm và đơn hàng. Bạn cần hỗ trợ gì? 😊'
      }
      return 'Xin lỗi, hệ thống AI hiện đang quá tải. Vui lòng liên hệ bộ phận CSKH hoặc thử lại sau ít phút để được hỗ trợ tốt nhất! 💳😔'
    }

    if (errorType === 'auth') {
      return 'Xin lỗi, có lỗi xác thực với hệ thống AI. Vui lòng liên hệ quản trị viên để được hỗ trợ! 🔑😔'
    }

    // Responses thông thường
    if (lowerMessage.includes('xin chào') || lowerMessage.includes('hello')) {
      return 'Xin chào! Tôi là trợ lý ảo của shop. Hiện tại hệ thống AI đang bảo trì, nhưng tôi vẫn có thể hỗ trợ bạn với các câu hỏi cơ bản về sản phẩm và đơn hàng. Bạn cần tìm gì hôm nay? 😊'
    }

    if (lowerMessage.includes('sản phẩm') || lowerMessage.includes('mua')) {
      return 'Để tìm sản phẩm phù hợp, bạn có thể duyệt qua các danh mục sản phẩm hoặc sử dụng tính năng tìm kiếm. Nếu cần tư vấn chi tiết, đừng ngần ngại hỏi tôi! 🛍️'
    }

    if (lowerMessage.includes('đơn hàng') || lowerMessage.includes('order')) {
      return 'Bạn có thể kiểm tra đơn hàng trong mục "Đơn mua" trên tài khoản của mình. Nếu có vấn đề gì, hãy cho tôi biết mã đơn hàng để tôi hỗ trợ! 📦'
    }

    if (lowerMessage.includes('giá') || lowerMessage.includes('khuyến mãi')) {
      return 'Giá sản phẩm và các chương trình khuyến mãi được cập nhật liên tục. Bạn có thể xem chi tiết trên trang sản phẩm hoặc theo dõi mục "Khuyến mãi" để không bỏ lỡ ưu đãi! 💰'
    }

    return 'Xin lỗi, hiện tại hệ thống AI đang bảo trì. Tôi có thể hỗ trợ bạn với các câu hỏi cơ bản về sản phẩm, đơn hàng, thanh toán. Bạn cần hỗ trợ gì? 😔💫'
  }

  /**
   * Chuyển đổi messages thành format cho Anthropic
   */
  private formatMessagesForAnthropic(
    messages: AIConversationMessage[],
  ): Array<{ role: 'user' | 'assistant'; content: string }> {
    return messages.map((msg) => ({
      role: msg.role === AIMessageRole.USER ? ('user' as const) : ('assistant' as const),
      content: msg.content,
    }))
  }

  /**
   * Tạo conversation title từ tin nhắn đầu tiên
   */
  async generateConversationTitle(firstMessage: string): Promise<string> {
    try {
      if (firstMessage.length <= 50) {
        return firstMessage
      }

      // Fallback nếu không có API key
      const apiKey = envConfig.ANTHROPIC_API_KEY
      if (!apiKey) {
        return firstMessage.slice(0, 50) + (firstMessage.length > 50 ? '...' : '')
      }

      const response = await this.anthropic.messages.create({
        model: DEFAULT_AI_CONFIG.model,
        max_tokens: 30,
        temperature: 0.3,
        system:
          'Hãy tạo một tiêu đề ngắn gọn (tối đa 50 ký tự) cho cuộc trò chuyện dựa trên tin nhắn đầu tiên của khách hàng về mua sắm. Chỉ trả về tiêu đề, không giải thích.',
        messages: [
          {
            role: 'user' as const,
            content: firstMessage,
          },
        ],
      })

      const title = response.content
        .filter((block): block is Anthropic.TextBlock => block.type === 'text')
        .map((block) => block.text)
        .join('')

      return title.slice(0, 50).trim() || firstMessage.slice(0, 50) + (firstMessage.length > 50 ? '...' : '')
    } catch (error) {
      this.logger.error('Error generating conversation title:', error)
      return firstMessage.slice(0, 50) + (firstMessage.length > 50 ? '...' : '')
    }
  }

  /**
   * Tạo conversation mới
   */
  async createConversation(userId: number, dto: CreateAIConversationDto) {
    try {
      // Tạo conversation trong database
      const conversation = await this.aiAssistantRepo.createConversation({
        userId,
        context: dto.context || {},
      })

      this.logger.log(`Created AI conversation ${conversation.id} for user ${userId}`)
      return conversation
    } catch (error) {
      this.logger.error('Error creating AI conversation:', error)
      throw error
    }
  }

  /**
   * Lấy danh sách conversations của user
   */
  async getUserConversations(userId: number, page: number = 1, limit: number = 20) {
    try {
      return await this.aiAssistantRepo.getUserConversations(userId, page, limit)
    } catch (error) {
      this.logger.error('Error getting user conversations:', error)
      throw error
    }
  }

  /**
   * Lấy danh sách archived conversations của user
   */
  async getArchivedConversations(userId: number, page: number = 1, limit: number = 20) {
    try {
      return await this.aiAssistantRepo.getArchivedConversations(userId, page, limit)
    } catch (error) {
      this.logger.error('Error getting archived conversations:', error)
      throw error
    }
  }

  /**
   * Lấy chi tiết conversation với messages
   */
  async getConversationDetails(conversationId: string, userId: number) {
    try {
      const conversation = await this.aiAssistantRepo.getConversationById(conversationId, userId)

      if (!conversation) {
        throw new Error('Conversation not found')
      }

      return conversation
    } catch (error) {
      this.logger.error('Error getting conversation details:', error)
      throw error
    }
  }

  /**
   * Gửi tin nhắn và tạo AI response
   */
  async sendMessage(conversationId: string, userId: number, dto: SendAIMessageDto) {
    try {
      const startTime = Date.now()

      // Verify conversation belongs to user
      const conversation = await this.aiAssistantRepo.getConversationById(conversationId, userId)
      if (!conversation) {
        throw new Error('Conversation not found')
      }

      // Tạo user message
      const userMessage = await this.aiAssistantRepo.createMessage({
        conversationId,
        role: AIMessageRole.USER,
        content: dto.message.trim(),
      })

      // Generate AI response
      const previousMessages = conversation.messages
      const aiResponseText = await this.generateResponse(previousMessages, dto.message)

      const responseTime = Date.now() - startTime

      // Tạo AI message
      const aiMessage = await this.aiAssistantRepo.createMessage({
        conversationId,
        role: AIMessageRole.ASSISTANT,
        content: aiResponseText,
        responseTime,
        model: DEFAULT_AI_CONFIG.model,
      })

      // Update conversation title nếu là tin nhắn đầu tiên
      if (conversation.messages.length === 0) {
        const title = await this.generateConversationTitle(dto.message)
        await this.aiAssistantRepo.updateConversation(conversationId, { title })
      }

      this.logger.log(`AI message created for conversation ${conversationId} in ${responseTime}ms`)

      return {
        userMessage,
        aiMessage,
        responseTime,
      }
    } catch (error) {
      this.logger.error('Error sending AI message:', error)
      throw error
    }
  }

  /**
   * Generate AI response sử dụng Anthropic Claude
   */
  async generateResponse(previousMessages: AIConversationMessage[], userMessage: string): Promise<string> {
    try {
      const apiKey = envConfig.ANTHROPIC_API_KEY

      // Kiểm tra API key trước khi gọi Anthropic
      if (!apiKey) {
        this.logger.log('🚫 Không có ANTHROPIC_API_KEY - sử dụng fallback')
        return this.getFallbackResponse(userMessage)
      }

      this.logger.log('🤖 Đang gọi Anthropic Claude API...')

      const allMessages = [...previousMessages, { role: AIMessageRole.USER, content: userMessage }]

      const response = await this.anthropic.messages.create({
        model: DEFAULT_AI_CONFIG.model,
        max_tokens: DEFAULT_AI_CONFIG.maxTokens,
        temperature: DEFAULT_AI_CONFIG.temperature,
        system: this.getSystemPrompt(),
        messages: this.formatMessagesForAnthropic(allMessages),
      })

      // Lấy text từ response
      const text = response.content
        .filter((block): block is Anthropic.TextBlock => block.type === 'text')
        .map((block) => block.text)
        .join('')

      this.logger.log('✅ Anthropic Claude API response thành công')
      return text || this.getFallbackResponse(userMessage, 'general')
    } catch (error: unknown) {
      this.logger.error('❌ Lỗi khi gọi Anthropic API:', error)

      const apiError = error as { status?: number; message?: string }

      // Kiểm tra loại lỗi cụ thể
      if (apiError.status === 429 || apiError.message?.includes('quota') || apiError.message?.includes('rate limit')) {
        this.logger.log('💳 Lỗi quota/rate limit Anthropic - sử dụng fallback response')
        return this.getFallbackResponse(userMessage, 'quota')
      }

      if (
        apiError.status === 401 ||
        apiError.message?.includes('authentication') ||
        apiError.message?.includes('api key')
      ) {
        this.logger.log('🔑 Lỗi authentication Anthropic - sử dụng fallback response')
        return this.getFallbackResponse(userMessage, 'auth')
      }

      // Fallback response cho các lỗi khác
      this.logger.log('🔧 Lỗi khác - sử dụng fallback response')
      return this.getFallbackResponse(userMessage, 'general')
    }
  }

  /**
   * Simulate streaming for fallback response when no API key
   */
  private simulateFallbackStreaming(
    userMessage: string,
    callbacks: StreamingCallbacks,
    signal?: AbortSignal,
  ): Promise<void> {
    return new Promise<void>((resolve) => {
      this.logger.log('🚫 Không có ANTHROPIC_API_KEY - sử dụng fallback streaming')
      const fallbackText = this.getFallbackResponse(userMessage)

      const words = fallbackText.split(' ')
      let resolved = false

      for (let i = 0; i < words.length; i++) {
        setTimeout(() => {
          if (resolved || (signal && signal.aborted)) {
            if (!resolved) {
              resolved = true
              resolve()
            }
            return
          }
          callbacks.onChunk(words[i] + ' ')
          if (i === words.length - 1) {
            resolved = true
            callbacks.onComplete()
            resolve()
          }
        }, i * 100)
      }

      if (signal) {
        signal.addEventListener(
          'abort',
          () => {
            if (!resolved) {
              resolved = true
              resolve()
            }
          },
          { once: true },
        )
      }
    })
  }

  /**
   * Create Anthropic streaming request
   */
  private setupAnthropicStream(previousMessages: AIConversationMessage[], userMessage: string) {
    const allMessages = [...previousMessages, { role: AIMessageRole.USER, content: userMessage }]

    return this.anthropic.messages.stream({
      model: DEFAULT_AI_CONFIG.model,
      max_tokens: DEFAULT_AI_CONFIG.maxTokens,
      temperature: DEFAULT_AI_CONFIG.temperature,
      system: this.getSystemPrompt(),
      messages: this.formatMessagesForAnthropic(allMessages),
    })
  }

  /**
   * Classify and handle streaming errors
   */
  private handleStreamingError(error: unknown, callbacks: StreamingCallbacks): void {
    this.logger.error('❌ Lỗi khởi tạo streaming:', error)
    const apiError = error as { status?: number; message?: string }

    if (apiError.status === 429) {
      callbacks.onError('Quota limit reached')
    } else if (apiError.status === 401) {
      callbacks.onError('Authentication failed')
    } else {
      callbacks.onError(apiError.message || 'Failed to initialize streaming')
    }
  }

  /**
   * Generate streaming response cho real-time chat
   */
  generateStreamingResponse(
    previousMessages: AIConversationMessage[],
    userMessage: string,
    callbacks: StreamingCallbacks,
    signal?: AbortSignal,
  ): Promise<void> {
    return new Promise<void>((resolve) => {
      try {
        const apiKey = envConfig.ANTHROPIC_API_KEY

        if (!apiKey) {
          this.simulateFallbackStreaming(userMessage, callbacks, signal).then(resolve)
          return
        }

        this.logger.log('🤖 Đang khởi tạo Anthropic Claude Streaming...')

        const stream = this.setupAnthropicStream(previousMessages, userMessage)

        if (signal) {
          signal.addEventListener('abort', () => stream.abort(), { once: true })
        }

        this.logger.log('📡 Đang nhận streaming data từ Claude...')

        stream.on('text', (chunk: string) => {
          callbacks.onChunk(chunk)
        })

        stream.on('end', () => {
          this.logger.log('✅ Streaming hoàn tất')
          callbacks.onComplete()
          resolve()
        })

        stream.on('error', (error: Error) => {
          this.logger.error('❌ Lỗi streaming:', error)
          callbacks.onError(error.message || 'Streaming error')
          resolve()
        })
      } catch (error: unknown) {
        this.handleStreamingError(error, callbacks)
        resolve()
      }
    })
  }

  /**
   * Archive conversation
   */
  async archiveConversation(conversationId: string, userId: number) {
    try {
      const conversation = await this.aiAssistantRepo.getConversationById(conversationId, userId)
      if (!conversation) {
        throw new Error('Conversation not found')
      }

      await this.aiAssistantRepo.updateConversation(conversationId, { isArchived: true })

      this.logger.log(`Archived AI conversation ${conversationId}`)
      return { success: true }
    } catch (error) {
      this.logger.error('Error archiving conversation:', error)
      throw error
    }
  }

  /**
   * Delete conversation
   */
  async deleteConversation(conversationId: string, userId: number) {
    try {
      const conversation = await this.aiAssistantRepo.getConversationById(conversationId, userId)
      if (!conversation) {
        throw new Error('Conversation not found')
      }

      await this.aiAssistantRepo.deleteConversation(conversationId)

      this.logger.log(`Deleted AI conversation ${conversationId}`)
      return { success: true }
    } catch (error) {
      this.logger.error('Error deleting conversation:', error)
      throw error
    }
  }

  /**
   * Tìm kiếm tin nhắn trong các conversations của user
   */
  async searchMessages(userId: number, query: string, page: number = 1, limit: number = 20) {
    try {
      return await this.aiAssistantRepo.searchMessages(userId, query, page, limit)
    } catch (error) {
      this.logger.error('Error searching AI messages:', error)
      throw error
    }
  }

  /**
   * Lấy thống kê AI conversations của user
   */
  async getUserStats(userId: number) {
    try {
      return await this.aiAssistantRepo.getUserStats(userId)
    } catch (error) {
      this.logger.error('Error getting AI user stats:', error)
      throw error
    }
  }
}
