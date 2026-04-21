import { z } from 'zod'
import { createZodDto } from 'nestjs-zod'

// ===== AI CONVERSATION DTOs =====

export const CreateAIConversationSchema = z.object({
  context: z.record(z.string(), z.any()).optional(), // Context data cho AI
})

export class CreateAIConversationDto extends createZodDto(CreateAIConversationSchema) {}

export const UpdateAIConversationSchema = z.object({
  title: z.string().max(500).optional(),
  context: z.record(z.string(), z.any()).optional(),
})

export class UpdateAIConversationDto extends createZodDto(UpdateAIConversationSchema) {}

// ===== AI MESSAGE DTOs =====

export const SendAIMessageSchema = z.object({
  message: z
    .string()
    .min(1, 'Tin nhắn không được để trống')
    .max(2000, 'Tin nhắn không được quá 2000 ký tự')
    .transform((str) => str.trim()),
  context: z.record(z.string(), z.any()).optional(), // Additional context for this message
})

export class SendAIMessageDto extends createZodDto(SendAIMessageSchema) {}

// ===== QUERY DTOs =====

export const GetConversationsQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(50).default(20),
  archived: z.coerce.boolean().default(false),
})

export class GetConversationsQueryDto extends createZodDto(GetConversationsQuerySchema) {}

export const SearchMessagesQuerySchema = z.object({
  q: z.string().min(1, 'Từ khóa tìm kiếm không được để trống').max(200, 'Từ khóa không được quá 200 ký tự'),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(50).default(20),
})

export class SearchMessagesQueryDto extends createZodDto(SearchMessagesQuerySchema) {}

export const TestStreamingQuerySchema = z.object({
  message: z.string().min(1, 'Tin nhắn không được để trống').max(1000, 'Tin nhắn không được quá 1000 ký tự'),
})

export class TestStreamingQueryDto extends createZodDto(TestStreamingQuerySchema) {}

// ===== RESPONSE DTOs =====

export interface AIMessageResponse {
  id: string
  role: 'USER' | 'ASSISTANT' | 'SYSTEM'
  content: string
  responseTime?: number
  model?: string
  error?: string
  createdAt: Date
}

export interface AIConversationResponse {
  id: string
  userId: number
  title?: string
  context?: any
  isActive: boolean
  isArchived: boolean
  createdAt: Date
  updatedAt: Date
  user?: {
    id: number
    name: string
    email: string
    avatar?: string
  }
  messages?: AIMessageResponse[]
  lastMessage?: AIMessageResponse
  _count?: {
    messages: number
  }
}

export interface ConversationListResponse {
  conversations: AIConversationResponse[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
    hasNext: boolean
    hasPrev: boolean
  }
}

export interface SendMessageResponse {
  userMessage: AIMessageResponse
  aiMessage: AIMessageResponse
  responseTime: number
}

export interface SearchMessagesResponse {
  messages: (AIMessageResponse & {
    conversation: {
      id: string
      title?: string
      createdAt: Date
    }
  })[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
    hasNext: boolean
    hasPrev: boolean
  }
}

export interface UserStatsResponse {
  totalConversations: number
  totalMessages: number
  totalTokens: number
  avgResponseTime: number
  recentActivity: number
}

// ===== STREAMING INTERFACES =====

export interface StreamingCallbacks {
  onChunk: (chunk: string) => void
  onComplete: () => void
  onError: (error: string) => void
}

export interface StreamingEventData {
  type: 'start' | 'chunk' | 'complete' | 'error'
  message?: string
  content?: string
  fullContent?: string
  fullResponse?: string
  timestamp?: string
  userMessage?: string
  fallback?: string
}

// ===== VALIDATION SCHEMAS =====

export const ConversationIdParamSchema = z.object({
  id: z.string().min(1, 'ID conversation không hợp lệ').max(50, 'ID conversation quá dài'),
})

export class ConversationIdParamDto extends createZodDto(ConversationIdParamSchema) {}
