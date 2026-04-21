import { Socket } from 'socket.io'

// ===== ERROR RESPONSE =====

/**
 * Standardized WebSocket error response format
 */
export interface WebSocketErrorResponse {
  event: string
  code: string
  message: string
  timestamp: Date
}

// ===== ERROR CODES =====

export const WS_ERROR_CODES = {
  VALIDATION_FAILED: 'VALIDATION_FAILED',
  UNAUTHORIZED: 'UNAUTHORIZED',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  NOT_FOUND: 'NOT_FOUND',
  RATE_LIMITED: 'RATE_LIMITED',
} as const

export type WsErrorCode = (typeof WS_ERROR_CODES)[keyof typeof WS_ERROR_CODES]

// ===== AUTHENTICATED SOCKET =====

/**
 * Socket extended with authenticated user data.
 * userId and user are attached by ChatConnectionHandler after auth middleware validates the token.
 */
export interface AuthenticatedSocket extends Socket {
  userId: number
  user: SocketUserInfo
}

// ===== USER INFO =====

/**
 * User info stored on the socket and in Redis per-socket cache
 */
export interface SocketUserInfo {
  id: number
  name: string
  email: string
  avatar?: string
  status?: string
}

// ===== HANDLER METHOD SIGNATURES =====

/**
 * Standard handler method that processes a WebSocket event
 */
export type WebSocketEventHandler = (
  server: import('socket.io').Server,
  client: AuthenticatedSocket,
  data: unknown,
) => Promise<void>
