import { CallHandler, ExecutionContext } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { of, throwError } from 'rxjs'
import { ZOD_RESPONSE_ONLY_KEY } from 'src/shared/decorators/zod-response-only.decorator'
import { z } from 'zod'
import { ZodOutputInterceptor } from '../zod-output.interceptor'

/**
 * ZOD OUTPUT INTERCEPTOR UNIT TESTS
 *
 * Module này test ZodOutputInterceptor - interceptor validate output với Zod schema
 * Đây là module CRITICAL vì đảm bảo response data tuân thủ API contract
 *
 * Test Coverage:
 * - Output validation với Zod schema
 * - Metadata reflection từ ZodResponseOnly decorator
 * - Valid schema parsing
 * - Invalid schema validation failures
 * - Error handling và warning logs
 * - No metadata scenarios
 */

describe('ZodOutputInterceptor', () => {
  let interceptor: ZodOutputInterceptor
  let mockReflector: jest.Mocked<Reflector>
  let mockExecutionContext: jest.Mocked<ExecutionContext>
  let mockCallHandler: jest.Mocked<CallHandler>
  let consoleWarnSpy: jest.SpyInstance
  let loggerWarnSpy: jest.SpyInstance

  beforeEach(() => {
    // Mock Reflector
    mockReflector = {
      get: jest.fn(),
      getAll: jest.fn(),
      getAllAndMerge: jest.fn(),
      getAllAndOverride: jest.fn(),
    } as any

    // Khởi tạo interceptor
    interceptor = new ZodOutputInterceptor(mockReflector)

    // Mock console.warn — also spy on Logger.warn for NestJS Logger
    consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation()
    loggerWarnSpy = jest.spyOn(interceptor['logger'], 'warn').mockImplementation()

    // Mock ExecutionContext
    mockExecutionContext = {
      getHandler: jest.fn().mockReturnValue(function testHandler() {}),
      getClass: jest.fn().mockReturnValue(class TestController {}),
      getArgs: jest.fn(),
      getArgByIndex: jest.fn(),
      switchToRpc: jest.fn(),
      switchToWs: jest.fn(),
      switchToHttp: jest.fn(),
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
  // VALID SCHEMA VALIDATION
  // ============================================

  describe('✅ Valid Schema Validation', () => {
    it('Nên validate và return data khi schema valid', (done) => {
      // Arrange: Chuẩn bị schema và data
      const schema = z.object({
        id: z.number(),
        name: z.string(),
      })
      const responseData = { id: 1, name: 'Test' }

      mockReflector.get.mockReturnValue({ type: schema })
      mockCallHandler.handle.mockReturnValue(of(responseData))

      // Act: Gọi intercept
      const result$ = interceptor.intercept(mockExecutionContext, mockCallHandler)

      // Assert: Verify validation success
      result$.subscribe({
        next: (value) => {
          expect(value).toEqual(responseData)
          expect(mockReflector.get).toHaveBeenCalledWith(ZOD_RESPONSE_ONLY_KEY, mockExecutionContext.getHandler())
          done()
        },
      })
    })

    it('Nên parse data với complex schema', (done) => {
      // Arrange: Chuẩn bị complex schema
      const schema = z.object({
        user: z.object({
          id: z.number(),
          email: z.string().email(),
        }),
        items: z.array(z.object({ id: z.number() })),
      })
      const responseData = {
        user: { id: 1, email: 'test@example.com' },
        items: [{ id: 1 }, { id: 2 }],
      }

      mockReflector.get.mockReturnValue({ type: schema })
      mockCallHandler.handle.mockReturnValue(of(responseData))

      // Act: Gọi intercept
      const result$ = interceptor.intercept(mockExecutionContext, mockCallHandler)

      // Assert: Verify complex validation
      result$.subscribe({
        next: (value) => {
          expect(value).toEqual(responseData)
          done()
        },
      })
    })

    it('Nên transform data theo schema defaults', (done) => {
      // Arrange: Schema với defaults
      const schema = z.object({
        id: z.number(),
        status: z.string().default('active'),
      })
      const responseData = { id: 1 }

      mockReflector.get.mockReturnValue({ type: schema })
      mockCallHandler.handle.mockReturnValue(of(responseData))

      // Act: Gọi intercept
      const result$ = interceptor.intercept(mockExecutionContext, mockCallHandler)

      // Assert: Verify defaults applied
      result$.subscribe({
        next: (value) => {
          expect(value).toEqual({ id: 1, status: 'active' })
          done()
        },
      })
    })
  })

  // ============================================
  // INVALID SCHEMA VALIDATION
  // ============================================

  describe('❌ Invalid Schema Validation', () => {
    it('Nên log warning và return original data khi validation fails', (done) => {
      // Arrange: Schema không match với data
      const schema = z.object({
        id: z.number(),
        name: z.string(),
      })
      const invalidData = { id: 'invalid', name: 123 } // Wrong types

      mockReflector.get.mockReturnValue({ type: schema })
      mockCallHandler.handle.mockReturnValue(of(invalidData))

      // Act: Gọi intercept
      const result$ = interceptor.intercept(mockExecutionContext, mockCallHandler)

      // Assert: Verify warning logged và data returned
      result$.subscribe({
        next: (value) => {
          expect(value).toEqual(invalidData)
          expect(loggerWarnSpy).toHaveBeenCalled()
          done()
        },
      })
    })

    it('Nên handle missing required fields', (done) => {
      // Arrange: Schema với required fields
      const schema = z.object({
        id: z.number(),
        name: z.string(),
        email: z.string(),
      })
      const incompleteData = { id: 1, name: 'Test' } // Missing email

      mockReflector.get.mockReturnValue({ type: schema })
      mockCallHandler.handle.mockReturnValue(of(incompleteData))

      // Act: Gọi intercept
      const result$ = interceptor.intercept(mockExecutionContext, mockCallHandler)

      // Assert: Verify warning và original data
      result$.subscribe({
        next: (value) => {
          expect(value).toEqual(incompleteData)
          expect(loggerWarnSpy).toHaveBeenCalled()
          done()
        },
      })
    })

    it('Nên handle type mismatch errors', (done) => {
      // Arrange: Schema expect number nhưng nhận string
      const schema = z.object({
        count: z.number(),
      })
      const wrongTypeData = { count: '123' }

      mockReflector.get.mockReturnValue({ type: schema })
      mockCallHandler.handle.mockReturnValue(of(wrongTypeData))

      // Act: Gọi intercept
      const result$ = interceptor.intercept(mockExecutionContext, mockCallHandler)

      // Assert: Verify error handling
      result$.subscribe({
        next: (value) => {
          expect(value).toEqual(wrongTypeData)
          expect(loggerWarnSpy).toHaveBeenCalled()
          done()
        },
      })
    })
  })

  // ============================================
  // NO METADATA SCENARIOS
  // ============================================

  describe('🔍 No Metadata Scenarios', () => {
    it('Nên return data unchanged khi không có metadata', (done) => {
      // Arrange: Không có ZodResponseOnly decorator
      mockReflector.get.mockReturnValue(undefined)
      const responseData = { id: 1, name: 'Test' }
      mockCallHandler.handle.mockReturnValue(of(responseData))

      // Act: Gọi intercept
      const result$ = interceptor.intercept(mockExecutionContext, mockCallHandler)

      // Assert: Verify data pass through
      result$.subscribe({
        next: (value) => {
          expect(value).toEqual(responseData)
          expect(loggerWarnSpy).not.toHaveBeenCalled()
          done()
        },
      })
    })

    it('Nên return data khi metadata không có type', (done) => {
      // Arrange: Metadata rỗng
      mockReflector.get.mockReturnValue({})
      const responseData = { data: 'test' }
      mockCallHandler.handle.mockReturnValue(of(responseData))

      // Act: Gọi intercept
      const result$ = interceptor.intercept(mockExecutionContext, mockCallHandler)

      // Assert: Verify data pass through
      result$.subscribe({
        next: (value) => {
          expect(value).toEqual(responseData)
          done()
        },
      })
    })

    it('Nên return data khi type không có parse method', (done) => {
      // Arrange: Type không phải Zod schema
      mockReflector.get.mockReturnValue({ type: {} })
      const responseData = { data: 'test' }
      mockCallHandler.handle.mockReturnValue(of(responseData))

      // Act: Gọi intercept
      const result$ = interceptor.intercept(mockExecutionContext, mockCallHandler)

      // Assert: Verify data pass through
      result$.subscribe({
        next: (value) => {
          expect(value).toEqual(responseData)
          done()
        },
      })
    })
  })

  // ============================================
  // ERROR PROPAGATION
  // ============================================

  describe('🔄 Error Propagation', () => {
    it('Nên propagate errors từ handler', (done) => {
      // Arrange: Handler throws error
      const error = new Error('Handler error')
      mockCallHandler.handle.mockReturnValue(throwError(() => error))

      // Act: Gọi intercept
      const result$ = interceptor.intercept(mockExecutionContext, mockCallHandler)

      // Assert: Verify error propagation
      result$.subscribe({
        error: (err) => {
          expect(err).toBe(error)
          done()
        },
      })
    })

    it('Nên không validate khi có error', (done) => {
      // Arrange: Error scenario
      const schema = z.object({ id: z.number() })
      mockReflector.get.mockReturnValue({ type: schema })
      const error = new Error('Test error')
      mockCallHandler.handle.mockReturnValue(throwError(() => error))

      // Act: Gọi intercept
      const result$ = interceptor.intercept(mockExecutionContext, mockCallHandler)

      // Assert: Verify không validate
      result$.subscribe({
        error: () => {
          expect(loggerWarnSpy).not.toHaveBeenCalled()
          done()
        },
      })
    })
  })

  // ============================================
  // REFLECTOR INTEGRATION
  // ============================================

  describe('📊 Reflector Integration', () => {
    it('Nên call reflector.get với đúng parameters', (done) => {
      // Arrange: Chuẩn bị schema
      const schema = z.object({ id: z.number() })
      mockReflector.get.mockReturnValue({ type: schema })
      mockCallHandler.handle.mockReturnValue(of({ id: 1 }))

      // Act: Gọi intercept
      const result$ = interceptor.intercept(mockExecutionContext, mockCallHandler)

      // Assert: Verify reflector.get called
      result$.subscribe({
        next: () => {
          expect(mockReflector.get).toHaveBeenCalledWith(ZOD_RESPONSE_ONLY_KEY, mockExecutionContext.getHandler())
          expect(mockReflector.get).toHaveBeenCalledTimes(1)
          done()
        },
      })
    })

    it('Nên lấy metadata từ handler', (done) => {
      // Arrange: Mock handler
      const mockHandler = jest.fn()
      mockExecutionContext.getHandler.mockReturnValue(mockHandler)
      mockReflector.get.mockReturnValue(undefined)
      mockCallHandler.handle.mockReturnValue(of({ data: 'test' }))

      // Act: Gọi intercept
      const result$ = interceptor.intercept(mockExecutionContext, mockCallHandler)

      // Assert: Verify getHandler called
      result$.subscribe({
        next: () => {
          expect(mockExecutionContext.getHandler).toHaveBeenCalled()
          expect(mockReflector.get).toHaveBeenCalledWith(ZOD_RESPONSE_ONLY_KEY, mockHandler)
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
      mockReflector.get.mockReturnValue(undefined)
      mockCallHandler.handle.mockReturnValue(of({ data: 'test' }))

      // Act: Gọi intercept
      const result$ = interceptor.intercept(mockExecutionContext, mockCallHandler)

      // Assert: Verify Observable
      expect(result$).toBeDefined()
      expect(typeof result$.subscribe).toBe('function')
    })

    it('Nên complete Observable sau khi process', (done) => {
      // Arrange: Chuẩn bị response
      mockReflector.get.mockReturnValue(undefined)
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
