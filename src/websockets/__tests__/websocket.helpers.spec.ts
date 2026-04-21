import { Socket } from 'socket.io'
import { WS_ERROR_CODES } from '../websocket.interfaces'
import {
  emitError,
  emitValidationError,
  emitUnauthorizedError,
  emitInternalError,
  emitNotFoundError,
} from '../websocket.helpers'

describe('WebSocket Helpers', () => {
  let mockClient: jest.Mocked<Socket>

  beforeEach(() => {
    mockClient = {
      emit: jest.fn(),
    } as any
  })

  describe('emitError', () => {
    it('should emit error event with correct payload structure', () => {
      emitError(mockClient, 'send_message', WS_ERROR_CODES.VALIDATION_FAILED, 'Invalid input')

      expect(mockClient.emit).toHaveBeenCalledWith('error', {
        event: 'send_message',
        code: 'VALIDATION_FAILED',
        message: 'Invalid input',
        timestamp: expect.any(Date),
      })
    })

    it('should emit with different error codes', () => {
      const codes = Object.values(WS_ERROR_CODES)

      for (const code of codes) {
        mockClient.emit.mockClear()
        emitError(mockClient, 'test_event', code, 'Test message')

        expect(mockClient.emit).toHaveBeenCalledWith(
          'error',
          expect.objectContaining({ code }),
        )
      }
    })
  })

  describe('emitValidationError', () => {
    it('should emit VALIDATION_FAILED with prefixed message', () => {
      emitValidationError(mockClient, 'join_room', 'roomId is required')

      expect(mockClient.emit).toHaveBeenCalledWith('error', {
        event: 'join_room',
        code: 'VALIDATION_FAILED',
        message: 'Validation failed: roomId is required',
        timestamp: expect.any(Date),
      })
    })
  })

  describe('emitUnauthorizedError', () => {
    it('should emit UNAUTHORIZED with custom message', () => {
      emitUnauthorizedError(mockClient, 'send_message', 'Token expired')

      expect(mockClient.emit).toHaveBeenCalledWith('error', {
        event: 'send_message',
        code: 'UNAUTHORIZED',
        message: 'Token expired',
        timestamp: expect.any(Date),
      })
    })

    it('should use default message when none provided', () => {
      emitUnauthorizedError(mockClient, 'send_message')

      expect(mockClient.emit).toHaveBeenCalledWith('error',
        expect.objectContaining({ message: 'Unauthorized' }),
      )
    })
  })

  describe('emitInternalError', () => {
    it('should emit INTERNAL_ERROR with custom message', () => {
      emitInternalError(mockClient, 'process', 'Something broke')

      expect(mockClient.emit).toHaveBeenCalledWith('error',
        expect.objectContaining({
          code: 'INTERNAL_ERROR',
          message: 'Something broke',
        }),
      )
    })

    it('should use default message when none provided', () => {
      emitInternalError(mockClient, 'process')

      expect(mockClient.emit).toHaveBeenCalledWith('error',
        expect.objectContaining({ message: 'Internal server error' }),
      )
    })
  })

  describe('emitNotFoundError', () => {
    it('should emit NOT_FOUND with custom message', () => {
      emitNotFoundError(mockClient, 'get_conversation', 'Conversation not found')

      expect(mockClient.emit).toHaveBeenCalledWith('error',
        expect.objectContaining({
          code: 'NOT_FOUND',
          message: 'Conversation not found',
        }),
      )
    })

    it('should use default message when none provided', () => {
      emitNotFoundError(mockClient, 'get_conversation')

      expect(mockClient.emit).toHaveBeenCalledWith('error',
        expect.objectContaining({ message: 'Resource not found' }),
      )
    })
  })
})
