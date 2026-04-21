import { AIMessageRole, AIKnowledgeType } from '@prisma/client'

// ===== AI CONVERSATION MODELS =====

export interface AIConversation {
  id: string
  userId: number
  title?: string
  context?: Record<string, any>
  isActive: boolean
  isArchived: boolean
  createdAt: Date
  updatedAt: Date
}

export interface AIConversationWithUser extends AIConversation {
  user: {
    id: number
    name: string
    email: string
    avatar?: string
  }
}

export interface AIConversationWithMessages extends AIConversationWithUser {
  messages: AIMessage[]
  _count?: {
    messages: number
  }
}

export interface AIConversationListItem extends AIConversationWithUser {
  lastMessage?: AIMessage
  _count: {
    messages: number
  }
}

// ===== AI MESSAGE MODELS =====

export interface AIMessage {
  id: string
  conversationId: string
  role: AIMessageRole
  content: string
  tokenCount?: number
  responseTime?: number
  model?: string
  error?: string
  contextUsed?: Record<string, any>
  createdAt: Date
}

export interface AIMessageWithConversation extends AIMessage {
  conversation: {
    id: string
    title?: string
    createdAt: Date
  }
}

// ===== AI KNOWLEDGE MODELS =====

export interface AIKnowledge {
  id: string
  type: AIKnowledgeType
  title: string
  content: string
  keywords: string[]
  isActive: boolean
  priority: number
  productId?: number
  categoryId?: number
  createdById?: number
  updatedById?: number
  createdAt: Date
  updatedAt: Date
}

export interface AIKnowledgeWithRelations extends AIKnowledge {
  product?: {
    id: number
    name: string
  }
  category?: {
    id: number
    name: string
  }
  createdBy?: {
    id: number
    name: string
  }
  updatedBy?: {
    id: number
    name: string
  }
}

// ===== SERVICE INTERFACES =====

export interface CreateAIConversationData {
  userId: number
  title?: string
  context?: Record<string, any>
}

export interface CreateAIMessageData {
  conversationId: string
  role: AIMessageRole
  content: string
  tokenCount?: number
  responseTime?: number
  model?: string
  error?: string
  contextUsed?: Record<string, any>
}

export interface UpdateAIConversationData {
  title?: string
  context?: Record<string, any>
  isActive?: boolean
  isArchived?: boolean
}

// ===== PAGINATION INTERFACES =====

export interface PaginationParams {
  page: number
  limit: number
}

export interface PaginationMeta {
  page: number
  limit: number
  total: number
  totalPages: number
  hasNext: boolean
  hasPrev: boolean
}

export interface PaginatedResult<T> {
  data: T[]
  pagination: PaginationMeta
}

// ===== AI CONTEXT INTERFACES =====

export interface UserContext {
  userId: number
  recentProducts?: number[]
  recentCategories?: number[]
  recentOrders?: number[]
  preferences?: Record<string, any>
  location?: {
    province?: string
    district?: string
  }
}

export interface ProductContext {
  productId: number
  name: string
  price: number
  category: string
  brand?: string
  description?: string
  specifications?: Record<string, any>
}

export interface OrderContext {
  orderId: number
  status: string
  products: Array<{
    productId: number
    name: string
    quantity: number
    price: number
  }>
  totalAmount: number
  shippingAddress?: string
  estimatedDelivery?: Date
}

// ===== STREAMING INTERFACES =====

export interface StreamingResponse {
  type: 'start' | 'chunk' | 'complete' | 'error'
  data?: {
    content?: string
    fullContent?: string
    message?: string
    error?: string
    timestamp?: string
  }
}

export interface StreamingCallbacks {
  onStart?: () => void
  onChunk: (chunk: string) => void
  onComplete: () => void
  onError: (error: string) => void
}

// ===== AI ANALYTICS INTERFACES =====

export interface AIConversationStats {
  totalConversations: number
  totalMessages: number
  totalTokens: number
  avgResponseTime: number
  recentActivity: number
  topCategories?: Array<{
    category: string
    count: number
  }>
  errorRate?: number
}

export interface AIUsageMetrics {
  userId: number
  date: Date
  conversationsCreated: number
  messagesCount: number
  tokensUsed: number
  avgResponseTime: number
  errorCount: number
}

// ===== AI CONFIGURATION =====

export interface AIConfiguration {
  model: string
  maxTokens: number
  temperature: number
  timeout: number
  systemPrompt: string
  fallbackEnabled: boolean
  rateLimitPerUser?: number
  rateLimitWindow?: number
}

// ===== ERROR INTERFACES =====

export interface AIError {
  code: string
  message: string
  type: 'QUOTA_EXCEEDED' | 'AUTH_FAILED' | 'TIMEOUT' | 'INVALID_INPUT' | 'SYSTEM_ERROR'
  retryable: boolean
  fallbackUsed: boolean
}

// ===== EXPORT CONSTANTS =====

export const AI_MESSAGE_ROLES = {
  USER: 'USER' as const,
  ASSISTANT: 'ASSISTANT' as const,
  SYSTEM: 'SYSTEM' as const,
} as const

export const AI_KNOWLEDGE_TYPES = {
  PRODUCT: 'PRODUCT' as const,
  FAQ: 'FAQ' as const,
  POLICY: 'POLICY' as const,
  GUIDE: 'GUIDE' as const,
  PROMOTION: 'PROMOTION' as const,
  CATEGORY: 'CATEGORY' as const,
} as const

export const AI_ERROR_TYPES = {
  QUOTA_EXCEEDED: 'QUOTA_EXCEEDED' as const,
  AUTH_FAILED: 'AUTH_FAILED' as const,
  TIMEOUT: 'TIMEOUT' as const,
  INVALID_INPUT: 'INVALID_INPUT' as const,
  SYSTEM_ERROR: 'SYSTEM_ERROR' as const,
} as const

export const DEFAULT_AI_CONFIG: AIConfiguration = {
  model: 'claude-3-haiku-20240307',
  maxTokens: 200,
  temperature: 0.7,
  timeout: 15000,
  systemPrompt: '',
  fallbackEnabled: true,
  rateLimitPerUser: 100,
  rateLimitWindow: 3600, // 1 hour
}
