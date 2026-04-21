import { CallHandler, ExecutionContext, Logger } from '@nestjs/common'
import { of, throwError } from 'rxjs'
import { LoggingInterceptor } from '../logging.interceptor'

/**
 * LOGGING INTERCEPTOR UNIT TESTS
 *
 * Module này test LoggingInterceptor - interceptor log response data
 * Đây là module CRITICAL vì giúp monitor và debug application
 *
 * Test Coverage:
 * - Response logging với tap operator
 * - Logger service integration
 * - Different data types logging
 * - Error propagation
 * - Observable stream processing
 */

describe('LoggingInterceptor', () => {
  let interceptor: LoggingInterceptor
  let mockExecutionContext: jest.Mocked<ExecutionContext>
  let mockCallHandler: jest.Mocked<CallHandler>
  let loggerLogSpy: jest.SpyInstance

  beforeEach(() => {
    // Arrange: Khởi tạo interceptor
    interceptor = new LoggingInterceptor()

    // Mock Logger.log
    loggerLogSpy = jest.spyOn(Logger.prototype, 'log').mockImplementation()

    // Mock ExecutionContext
    mockExecutionContext = {
      switchToHttp: jest.fn().mockReturnValue({
        getRequest: jest.fn().mockReturnValue({
          method: 'GET',
          url: '/api/test',
        }),
        getResponse: jest.fn(),
      }),
      getHandler: jest.fn(),
      getClass: jest.fn(),
      getArgs: jest.fn(),
      getArgByIndex: jest.fn(),
      switchToRpc: jest.fn(),
      switchToWs: jest.fn(),
      getType: jest.fn(),
    } as any

    // Mock CallHandler
    mockCallHandler = {
      handle: jest.fn(),
    } as any
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  // ============================================
  // LOGGING BEHAVIOR
  // ============================================

  describe('📝 Logging Behavior', () => {
    it('Nên log response body', (done) => {
      // Arrange: Chuẩn bị response data
      const responseData = { id: 1, name: 'Test' }
      mockCallHandler.handle.mockReturnValue(of(responseData))

      // Act: Gọi intercept
      const result$ = interceptor.intercept(mockExecutionContext, mockCallHandler)

      // Assert: Verify logging
      result$.subscribe({
        next: () => {
          expect(loggerLogSpy).toHaveBeenCalledWith({
            body: responseData,
          })
          done()
        },
      })
    })

    it('Nên log array response', (done) => {
      // Arrange: Chuẩn bị array response
      const responseData = [{ id: 1 }, { id: 2 }]
      mockCallHandler.handle.mockReturnValue(of(responseData))

      // Act: Gọi intercept
      const result$ = interceptor.intercept(mockExecutionContext, mockCallHandler)

      // Assert: Verify array logging
      result$.subscribe({
        next: () => {
          expect(loggerLogSpy).toHaveBeenCalledWith({
            body: responseData,
          })
          done()
        },
      })
    })

    it('Nên log primitive response', (done) => {
      // Arrange: Chuẩn bị primitive response
      const responseData = 'Success'
      mockCallHandler.handle.mockReturnValue(of(responseData))

      // Act: Gọi intercept
      const result$ = interceptor.intercept(mockExecutionContext, mockCallHandler)

      // Assert: Verify primitive logging
      result$.subscribe({
        next: () => {
          expect(loggerLogSpy).toHaveBeenCalledWith({
            body: responseData,
          })
          done()
        },
      })
    })

    it('Nên log null response', (done) => {
      // Arrange: Chuẩn bị null response
      mockCallHandler.handle.mockReturnValue(of(null))

      // Act: Gọi intercept
      const result$ = interceptor.intercept(mockExecutionContext, mockCallHandler)

      // Assert: Verify null logging
      result$.subscribe({
        next: () => {
          expect(loggerLogSpy).toHaveBeenCalledWith({
            body: null,
          })
          done()
        },
      })
    })

    it('Nên log undefined response', (done) => {
      // Arrange: Chuẩn bị undefined response
      mockCallHandler.handle.mockReturnValue(of(undefined))

      // Act: Gọi intercept
      const result$ = interceptor.intercept(mockExecutionContext, mockCallHandler)

      // Assert: Verify undefined logging
      result$.subscribe({
        next: () => {
          expect(loggerLogSpy).toHaveBeenCalledWith({
            body: undefined,
          })
          done()
        },
      })
    })

    it('Nên log empty object', (done) => {
      // Arrange: Chuẩn bị empty object
      mockCallHandler.handle.mockReturnValue(of({}))

      // Act: Gọi intercept
      const result$ = interceptor.intercept(mockExecutionContext, mockCallHandler)

      // Assert: Verify empty object logging
      result$.subscribe({
        next: () => {
          expect(loggerLogSpy).toHaveBeenCalledWith({
            body: {},
          })
          done()
        },
      })
    })
  })

  // ============================================
  // ERROR HANDLING
  // ============================================

  describe('❌ Error Handling', () => {
    it('Nên propagate errors từ handler', (done) => {
      // Arrange: Chuẩn bị error
      const error = new Error('Handler error')
      mockCallHandler.handle.mockReturnValue(throwError(() => error))

      // Act: Gọi intercept
      const result$ = interceptor.intercept(mockExecutionContext, mockCallHandler)

      // Assert: Verify error propagation (không log khi error)
      result$.subscribe({
        error: (err) => {
          expect(err).toBe(error)
          expect(loggerLogSpy).not.toHaveBeenCalled()
          done()
        },
      })
    })

    it('Nên không log khi có exception', (done) => {
      // Arrange: Chuẩn bị exception
      const exception = { statusCode: 500, message: 'Internal error' }
      mockCallHandler.handle.mockReturnValue(throwError(() => exception))

      // Act: Gọi intercept
      const result$ = interceptor.intercept(mockExecutionContext, mockCallHandler)

      // Assert: Verify không log
      result$.subscribe({
        error: () => {
          expect(loggerLogSpy).not.toHaveBeenCalled()
          done()
        },
      })
    })
  })

  // ============================================
  // OBSERVABLE BEHAVIOR
  // ============================================

  describe('🔄 Observable Behavior', () => {
    it('Nên return Observable stream', () => {
      // Arrange: Chuẩn bị response
      mockCallHandler.handle.mockReturnValue(of({ data: 'test' }))

      // Act: Gọi intercept
      const result$ = interceptor.intercept(mockExecutionContext, mockCallHandler)

      // Assert: Verify Observable
      expect(result$).toBeDefined()
      expect(typeof result$.subscribe).toBe('function')
    })

    it('Nên call handler.handle()', (done) => {
      // Arrange: Chuẩn bị response
      mockCallHandler.handle.mockReturnValue(of({ data: 'test' }))

      // Act: Gọi intercept
      const result$ = interceptor.intercept(mockExecutionContext, mockCallHandler)

      // Assert: Verify handle được gọi
      result$.subscribe({
        next: () => {
          expect(mockCallHandler.handle).toHaveBeenCalled()
          done()
        },
      })
    })

    it('Nên pass through response data không thay đổi', (done) => {
      // Arrange: Chuẩn bị response
      const responseData = { id: 1, name: 'Test' }
      mockCallHandler.handle.mockReturnValue(of(responseData))

      // Act: Gọi intercept
      const result$ = interceptor.intercept(mockExecutionContext, mockCallHandler)

      // Assert: Verify data không thay đổi
      result$.subscribe({
        next: (value) => {
          expect(value).toBe(responseData)
          done()
        },
      })
    })

    it('Nên complete Observable sau khi log', (done) => {
      // Arrange: Chuẩn bị response
      mockCallHandler.handle.mockReturnValue(of({ data: 'test' }))

      // Act: Gọi intercept
      const result$ = interceptor.intercept(mockExecutionContext, mockCallHandler)

      // Assert: Verify Observable completes
      result$.subscribe({
        next: () => {},
        complete: () => {
          done()
        },
      })
    })
  })

  // ============================================
  // LOGGER INTEGRATION
  // ============================================

  describe('📊 Logger Integration', () => {
    it('Nên sử dụng Logger instance', () => {
      // Assert: Verify logger được khởi tạo
      expect(interceptor['logger']).toBeDefined()
      expect(interceptor['logger']).toBeInstanceOf(Logger)
    })

    it('Nên log với đúng format', (done) => {
      // Arrange: Chuẩn bị response
      const responseData = { id: 1, message: 'Success' }
      mockCallHandler.handle.mockReturnValue(of(responseData))

      // Act: Gọi intercept
      const result$ = interceptor.intercept(mockExecutionContext, mockCallHandler)

      // Assert: Verify log format
      result$.subscribe({
        next: () => {
          expect(loggerLogSpy).toHaveBeenCalledTimes(1)
          expect(loggerLogSpy).toHaveBeenCalledWith(
            expect.objectContaining({
              body: responseData,
            }),
          )
          done()
        },
      })
    })

    it('Nên log mỗi response một lần', (done) => {
      // Arrange: Chuẩn bị response
      mockCallHandler.handle.mockReturnValue(of({ data: 'test' }))

      // Act: Gọi intercept
      const result$ = interceptor.intercept(mockExecutionContext, mockCallHandler)

      // Assert: Verify log được gọi đúng 1 lần
      result$.subscribe({
        next: () => {
          expect(loggerLogSpy).toHaveBeenCalledTimes(1)
          done()
        },
      })
    })
  })
})
