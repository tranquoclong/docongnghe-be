import { Socket } from 'socket.io'
import { WebSocketErrorResponse, WsErrorCode, WS_ERROR_CODES } from './websocket.interfaces'

/**
 * Emit a standardized error event to a client socket.
 *
 * @param client  - The socket to emit to
 * @param event   - The originating event name (e.g. 'send_message')
 * @param code    - One of the WS_ERROR_CODES constants
 * @param message - Human-readable error description
 */
export function emitError(client: Socket, event: string, code: WsErrorCode, message: string): void {
  const payload: WebSocketErrorResponse = {
    event,
    code,
    message,
    timestamp: new Date(),
  }
  client.emit('error', payload)
}

/**
 * Convenience: emit a VALIDATION_FAILED error
 */
export function emitValidationError(client: Socket, event: string, details: string): void {
  emitError(client, event, WS_ERROR_CODES.VALIDATION_FAILED, `Validation failed: ${details}`)
}

/**
 * Convenience: emit an UNAUTHORIZED error
 */
export function emitUnauthorizedError(client: Socket, event: string, message?: string): void {
  emitError(client, event, WS_ERROR_CODES.UNAUTHORIZED, message ?? 'Unauthorized')
}

/**
 * Convenience: emit an INTERNAL_ERROR
 */
export function emitInternalError(client: Socket, event: string, message?: string): void {
  emitError(client, event, WS_ERROR_CODES.INTERNAL_ERROR, message ?? 'Internal server error')
}

/**
 * Convenience: emit a NOT_FOUND error
 */
export function emitNotFoundError(client: Socket, event: string, message?: string): void {
  emitError(client, event, WS_ERROR_CODES.NOT_FOUND, message ?? 'Resource not found')
}
