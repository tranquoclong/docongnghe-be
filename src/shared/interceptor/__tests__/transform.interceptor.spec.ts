import { CallHandler, ExecutionContext } from '@nestjs/common'
import { of, throwError } from 'rxjs'
import { TransformInterceptor } from '../transform.interceptor'

// Define response type với statusCode
interface TransformedResponse<T> {
  data: T
  statusCode: number
}

/**
 * TRANSFORM INTERCEPTOR UNIT TESTS
 *
 * Module này test TransformInterceptor - interceptor transform response data
 * Đây là module CRITICAL vì định nghĩa cấu trúc response trả về cho client
 *
 * Test Coverage:
 * - Response transformation với data và statusCode
 * - ExecutionContext handling
 * - Observable stream processing
 * - Different HTTP status codes
 * - Different data types (object, array, primitive)
 * - Error propagation
 * - Edge cases (null, undefined, empty)
 */

describe('TransformInterceptor', () => {
  let interceptor: TransformInterceptor<any>
  let mockExecutionContext: jest.Mocked<ExecutionContext>
  let mockCallHandler: jest.Mocked<CallHandler>
  let mockResponse: any

  beforeEach(() => {
    // Arrange: Khởi tạo interceptor
    interceptor = new TransformInterceptor()

    // Mock response object
    mockResponse = {
      statusCode: 200,
    }

    // Mock ExecutionContext
    mockExecutionContext = {
      switchToHttp: jest.fn().mockReturnValue({
        getResponse: jest.fn().mockReturnValue(mockResponse),
        getRequest: jest.fn(),
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

  // ============================================
  // RESPONSE TRANSFORMATION
  // ============================================

  describe('🔄 Response Transformation', () => {
    it('Nên transform response với data và statusCode 200', (done) => {
      // Arrange: Chuẩn bị response data
      const responseData = { id: 1, name: 'Test Product' }
      mockCallHandler.handle.mockReturnValue(of(responseData))

      // Act: Gọi intercept
      const result$ = interceptor.intercept(mockExecutionContext, mockCallHandler)

      // Assert: Verify transformed response
      result$.subscribe({
        next: (value: TransformedResponse<any>) => {
          expect(value).toEqual({
            data: responseData,
            statusCode: 200,
          })
          expect(value.data).toBe(responseData)
          expect(value.statusCode).toBe(200)
          done()
        },
      })
    })

    it('Nên transform response với statusCode 201 (Created)', (done) => {
      // Arrange: Chuẩn bị response với status 201
      mockResponse.statusCode = 201
      const responseData = { id: 1, message: 'Created' }
      mockCallHandler.handle.mockReturnValue(of(responseData))

      // Act: Gọi intercept
      const result$ = interceptor.intercept(mockExecutionContext, mockCallHandler)

      // Assert: Verify statusCode 201
      result$.subscribe({
        next: (value: TransformedResponse<any>) => {
          expect(value.statusCode).toBe(201)
          expect(value.data).toEqual(responseData)
          done()
        },
      })
    })

    it('Nên transform response với statusCode 204 (No Content)', (done) => {
      // Arrange: Chuẩn bị response với status 204
      mockResponse.statusCode = 204
      mockCallHandler.handle.mockReturnValue(of(null))

      // Act: Gọi intercept
      const result$ = interceptor.intercept(mockExecutionContext, mockCallHandler)

      // Assert: Verify statusCode 204
      result$.subscribe({
        next: (value: TransformedResponse<any>) => {
          expect(value.statusCode).toBe(204)
          expect(value.data).toBeNull()
          done()
        },
      })
    })

    it('Nên transform response với array data', (done) => {
      // Arrange: Chuẩn bị array response
      const responseData = [
        { id: 1, name: 'Product 1' },
        { id: 2, name: 'Product 2' },
      ]
      mockCallHandler.handle.mockReturnValue(of(responseData))

      // Act: Gọi intercept
      const result$ = interceptor.intercept(mockExecutionContext, mockCallHandler)

      // Assert: Verify array transformation
      result$.subscribe({
        next: (value: TransformedResponse<any>) => {
          expect(value.data).toEqual(responseData)
          expect(Array.isArray(value.data)).toBe(true)
          expect(value.data).toHaveLength(2)
          done()
        },
      })
    })

    it('Nên transform response với primitive data types', (done) => {
      // Arrange: Chuẩn bị primitive response
      const responseData = 'Success message'
      mockCallHandler.handle.mockReturnValue(of(responseData))

      // Act: Gọi intercept
      const result$ = interceptor.intercept(mockExecutionContext, mockCallHandler)

      // Assert: Verify primitive transformation
      result$.subscribe({
        next: (value: TransformedResponse<any>) => {
          expect(value.data).toBe(responseData)
          expect(typeof value.data).toBe('string')
          done()
        },
      })
    })

    it('Nên transform response với number data', (done) => {
      // Arrange: Chuẩn bị number response
      const responseData = 42
      mockCallHandler.handle.mockReturnValue(of(responseData))

      // Act: Gọi intercept
      const result$ = interceptor.intercept(mockExecutionContext, mockCallHandler)

      // Assert: Verify number transformation
      result$.subscribe({
        next: (value: TransformedResponse<any>) => {
          expect(value.data).toBe(42)
          expect(typeof value.data).toBe('number')
          done()
        },
      })
    })

    it('Nên transform response với boolean data', (done) => {
      // Arrange: Chuẩn bị boolean response
      const responseData = true
      mockCallHandler.handle.mockReturnValue(of(responseData))

      // Act: Gọi intercept
      const result$ = interceptor.intercept(mockExecutionContext, mockCallHandler)

      // Assert: Verify boolean transformation
      result$.subscribe({
        next: (value: TransformedResponse<any>) => {
          expect(value.data).toBe(true)
          expect(typeof value.data).toBe('boolean')
          done()
        },
      })
    })
  })

  // ============================================
  // EDGE CASES
  // ============================================

  describe('🔍 Edge Cases', () => {
    it('Nên handle null data', (done) => {
      // Arrange: Chuẩn bị null response
      mockCallHandler.handle.mockReturnValue(of(null))

      // Act: Gọi intercept
      const result$ = interceptor.intercept(mockExecutionContext, mockCallHandler)

      // Assert: Verify null handling
      result$.subscribe({
        next: (value: TransformedResponse<any>) => {
          expect(value.data).toBeNull()
          expect(value.statusCode).toBe(200)
          done()
        },
      })
    })

    it('Nên handle undefined data', (done) => {
      // Arrange: Chuẩn bị undefined response
      mockCallHandler.handle.mockReturnValue(of(undefined))

      // Act: Gọi intercept
      const result$ = interceptor.intercept(mockExecutionContext, mockCallHandler)

      // Assert: Verify undefined handling
      result$.subscribe({
        next: (value: TransformedResponse<any>) => {
          expect(value.data).toBeUndefined()
          expect(value.statusCode).toBe(200)
          done()
        },
      })
    })

    it('Nên handle empty object', (done) => {
      // Arrange: Chuẩn bị empty object
      mockCallHandler.handle.mockReturnValue(of({}))

      // Act: Gọi intercept
      const result$ = interceptor.intercept(mockExecutionContext, mockCallHandler)

      // Assert: Verify empty object handling
      result$.subscribe({
        next: (value: TransformedResponse<any>) => {
          expect(value.data).toEqual({})
          expect(Object.keys(value.data)).toHaveLength(0)
          done()
        },
      })
    })

    it('Nên handle empty array', (done) => {
      // Arrange: Chuẩn bị empty array
      mockCallHandler.handle.mockReturnValue(of([]))

      // Act: Gọi intercept
      const result$ = interceptor.intercept(mockExecutionContext, mockCallHandler)

      // Assert: Verify empty array handling
      result$.subscribe({
        next: (value: TransformedResponse<any>) => {
          expect(value.data).toEqual([])
          expect(value.data).toHaveLength(0)
          done()
        },
      })
    })

    it('Nên handle zero value', (done) => {
      // Arrange: Chuẩn bị zero value
      mockCallHandler.handle.mockReturnValue(of(0))

      // Act: Gọi intercept
      const result$ = interceptor.intercept(mockExecutionContext, mockCallHandler)

      // Assert: Verify zero handling
      result$.subscribe({
        next: (value: TransformedResponse<any>) => {
          expect(value.data).toBe(0)
          expect(value.statusCode).toBe(200)
          done()
        },
      })
    })

    it('Nên handle empty string', (done) => {
      // Arrange: Chuẩn bị empty string
      mockCallHandler.handle.mockReturnValue(of(''))

      // Act: Gọi intercept
      const result$ = interceptor.intercept(mockExecutionContext, mockCallHandler)

      // Assert: Verify empty string handling
      result$.subscribe({
        next: (value: TransformedResponse<any>) => {
          expect(value.data).toBe('')
          expect(value.statusCode).toBe(200)
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

      // Assert: Verify error propagation
      result$.subscribe({
        error: (err) => {
          expect(err).toBe(error)
          expect(err.message).toBe('Handler error')
          done()
        },
      })
    })

    it('Nên propagate HTTP exceptions', (done) => {
      // Arrange: Chuẩn bị HTTP exception
      const httpError = {
        statusCode: 404,
        message: 'Not Found',
      }
      mockCallHandler.handle.mockReturnValue(throwError(() => httpError))

      // Act: Gọi intercept
      const result$ = interceptor.intercept(mockExecutionContext, mockCallHandler)

      // Assert: Verify HTTP exception propagation
      result$.subscribe({
        error: (err) => {
          expect(err).toEqual(httpError)
          expect(err.statusCode).toBe(404)
          done()
        },
      })
    })
  })

  // ============================================
  // EXECUTION CONTEXT
  // ============================================

  describe('🎯 Execution Context', () => {
    it('Nên call switchToHttp() để lấy HTTP context', (done) => {
      // Arrange: Chuẩn bị response
      mockCallHandler.handle.mockReturnValue(of({ data: 'test' }))

      // Act: Gọi intercept
      const result$ = interceptor.intercept(mockExecutionContext, mockCallHandler)

      // Assert: Verify switchToHttp được gọi
      result$.subscribe({
        next: () => {
          expect(mockExecutionContext.switchToHttp).toHaveBeenCalled()
          done()
        },
      })
    })

    it('Nên call getResponse() để lấy response object', (done) => {
      // Arrange: Chuẩn bị response
      mockCallHandler.handle.mockReturnValue(of({ data: 'test' }))
      const getResponseSpy = jest.fn().mockReturnValue(mockResponse)
      mockExecutionContext.switchToHttp = jest.fn().mockReturnValue({
        getResponse: getResponseSpy,
        getRequest: jest.fn(),
      })

      // Act: Gọi intercept
      const result$ = interceptor.intercept(mockExecutionContext, mockCallHandler)

      // Assert: Verify getResponse được gọi
      result$.subscribe({
        next: () => {
          expect(getResponseSpy).toHaveBeenCalled()
          done()
        },
      })
    })

    it('Nên extract statusCode từ response object', (done) => {
      // Arrange: Chuẩn bị response với custom status
      mockResponse.statusCode = 202
      mockCallHandler.handle.mockReturnValue(of({ data: 'accepted' }))

      // Act: Gọi intercept
      const result$ = interceptor.intercept(mockExecutionContext, mockCallHandler)

      // Assert: Verify statusCode extraction
      result$.subscribe({
        next: (value: TransformedResponse<any>) => {
          expect(value.statusCode).toBe(202)
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

    it('Nên call handler.handle() để lấy Observable', (done) => {
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

    it('Nên complete Observable sau khi emit value', (done) => {
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
})
