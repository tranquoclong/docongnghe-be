import { ExecutionContext, UnauthorizedException } from '@nestjs/common'
import { Test, TestingModule } from '@nestjs/testing'
import envConfig from 'src/shared/config'
import { PaymentAPIKeyGuard } from '../payment-api-key.guard'

/**
 * PAYMENT API KEY GUARD UNIT TESTS
 *
 * Module này test authentication guard cho payment webhook
 * Đây là module CRITICAL vì bảo vệ webhook endpoint nhận payment từ gateway
 *
 * Test Coverage:
 * - Valid API key authentication
 * - Invalid API key rejection
 * - Missing API key rejection
 * - Malformed Authorization header
 * - Case sensitivity
 * - Security edge cases
 */

describe('PaymentAPIKeyGuard', () => {
  let guard: PaymentAPIKeyGuard
  let mockExecutionContext: jest.Mocked<ExecutionContext>

  // Test data factory
  const createMockRequest = (authHeader?: string) => ({
    headers: {
      authorization: authHeader,
    },
  })

  const createMockExecutionContext = (request: any): jest.Mocked<ExecutionContext> => {
    return {
      switchToHttp: jest.fn().mockReturnValue({
        getRequest: jest.fn().mockReturnValue(request),
      }),
      getHandler: jest.fn(),
      getClass: jest.fn(),
    } as any
  }

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [PaymentAPIKeyGuard],
    }).compile()

    guard = module.get<PaymentAPIKeyGuard>(PaymentAPIKeyGuard)
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  // ============================================
  // VALID API KEY
  // ============================================

  describe('✅ Valid API Key', () => {
    it('Nên cho phép request với valid API key', () => {
      // Arrange: Chuẩn bị request với valid API key
      const validApiKey = envConfig.PAYMENT_API_KEY
      const mockRequest = createMockRequest(`Bearer ${validApiKey}`)
      mockExecutionContext = createMockExecutionContext(mockRequest)

      // Act: Thực hiện canActivate
      const result = guard.canActivate(mockExecutionContext)

      // Assert: Verify return true
      expect(result).toBe(true)
    })

    it('Nên extract API key từ Authorization header với Bearer scheme', () => {
      // Arrange: Chuẩn bị request với Bearer token
      const validApiKey = envConfig.PAYMENT_API_KEY
      const mockRequest = createMockRequest(`Bearer ${validApiKey}`)
      mockExecutionContext = createMockExecutionContext(mockRequest)

      // Act: Thực hiện canActivate
      const result = guard.canActivate(mockExecutionContext)

      // Assert: Verify extraction thành công
      expect(result).toBe(true)
      expect(mockExecutionContext.switchToHttp).toHaveBeenCalled()
    })

    it('Nên return true ngay lập tức khi API key match', () => {
      // Arrange: Chuẩn bị request với exact match API key
      const validApiKey = envConfig.PAYMENT_API_KEY
      const mockRequest = createMockRequest(`Bearer ${validApiKey}`)
      mockExecutionContext = createMockExecutionContext(mockRequest)

      // Act: Thực hiện canActivate
      const result = guard.canActivate(mockExecutionContext)

      // Assert: Verify return true và không throw error
      expect(result).toBe(true)
      expect(() => guard.canActivate(mockExecutionContext)).not.toThrow()
    })
  })

  // ============================================
  // INVALID API KEY
  // ============================================

  describe('❌ Invalid API Key', () => {
    it('Nên reject request với invalid API key', () => {
      // Arrange: Chuẩn bị request với invalid API key
      const invalidApiKey = 'invalid-api-key-12345'
      const mockRequest = createMockRequest(`Bearer ${invalidApiKey}`)
      mockExecutionContext = createMockExecutionContext(mockRequest)

      // Act & Assert: Verify throw UnauthorizedException
      expect(() => guard.canActivate(mockExecutionContext)).toThrow(UnauthorizedException)
    })

    it('Nên reject request với empty API key', () => {
      // Arrange: Chuẩn bị request với empty API key
      const mockRequest = createMockRequest('Bearer ')
      mockExecutionContext = createMockExecutionContext(mockRequest)

      // Act & Assert: Verify throw UnauthorizedException
      expect(() => guard.canActivate(mockExecutionContext)).toThrow(UnauthorizedException)
    })

    it('Nên reject request với wrong API key format', () => {
      // Arrange: Chuẩn bị request với invalid format
      const mockRequest = createMockRequest('InvalidFormat')
      mockExecutionContext = createMockExecutionContext(mockRequest)

      // Act & Assert: Verify throw UnauthorizedException
      expect(() => guard.canActivate(mockExecutionContext)).toThrow(UnauthorizedException)
    })

    it('Nên reject request không có Bearer prefix', () => {
      // Arrange: Chuẩn bị request thiếu Bearer prefix
      const validApiKey = envConfig.PAYMENT_API_KEY
      const mockRequest = createMockRequest(validApiKey) // Missing "Bearer " prefix
      mockExecutionContext = createMockExecutionContext(mockRequest)

      // Act & Assert: Verify throw UnauthorizedException
      expect(() => guard.canActivate(mockExecutionContext)).toThrow(UnauthorizedException)
    })

    it('Nên reject request với API key chứa ký tự đặc biệt không hợp lệ', () => {
      // Arrange: Chuẩn bị request với special characters
      const invalidApiKey = 'invalid-key-with-@#$%'
      const mockRequest = createMockRequest(`Bearer ${invalidApiKey}`)
      mockExecutionContext = createMockExecutionContext(mockRequest)

      // Act & Assert: Verify throw UnauthorizedException
      expect(() => guard.canActivate(mockExecutionContext)).toThrow(UnauthorizedException)
    })
  })

  // ============================================
  // MISSING API KEY
  // ============================================

  describe('🚫 Missing API Key', () => {
    it('Nên reject request không có Authorization header', () => {
      // Arrange: Chuẩn bị request không có header
      const mockRequest = { headers: {} }
      mockExecutionContext = createMockExecutionContext(mockRequest)

      // Act & Assert: Verify throw UnauthorizedException
      expect(() => guard.canActivate(mockExecutionContext)).toThrow(UnauthorizedException)
    })

    it('Nên reject request với undefined Authorization header', () => {
      // Arrange: Chuẩn bị request với undefined header
      const mockRequest = createMockRequest(undefined)
      mockExecutionContext = createMockExecutionContext(mockRequest)

      // Act & Assert: Verify throw UnauthorizedException
      expect(() => guard.canActivate(mockExecutionContext)).toThrow(UnauthorizedException)
    })

    it('Nên reject request với null Authorization header', () => {
      // Arrange: Chuẩn bị request với null header
      const mockRequest = createMockRequest(null as any)
      mockExecutionContext = createMockExecutionContext(mockRequest)

      // Act & Assert: Verify throw UnauthorizedException
      expect(() => guard.canActivate(mockExecutionContext)).toThrow(UnauthorizedException)
    })

    it('Nên reject request với empty string Authorization header', () => {
      // Arrange: Chuẩn bị request với empty string
      const mockRequest = createMockRequest('')
      mockExecutionContext = createMockExecutionContext(mockRequest)

      // Act & Assert: Verify throw UnauthorizedException
      expect(() => guard.canActivate(mockExecutionContext)).toThrow(UnauthorizedException)
    })
  })

  // ============================================
  // SECURITY EDGE CASES
  // ============================================

  describe('🔒 Security Edge Cases', () => {
    it('Nên case-sensitive khi so sánh API key', () => {
      // Arrange: Chuẩn bị API key với uppercase
      const validApiKey = envConfig.PAYMENT_API_KEY
      const uppercaseApiKey = validApiKey.toUpperCase()
      const mockRequest = createMockRequest(`Bearer ${uppercaseApiKey}`)
      mockExecutionContext = createMockExecutionContext(mockRequest)

      // Act & Assert: Verify reject nếu case khác nhau
      if (validApiKey !== uppercaseApiKey) {
        expect(() => guard.canActivate(mockExecutionContext)).toThrow(UnauthorizedException)
      }
    })

    it('Nên reject API key với extra whitespace giữa Bearer và key', () => {
      // Arrange: Chuẩn bị request với extra space
      const validApiKey = envConfig.PAYMENT_API_KEY
      const mockRequest = createMockRequest(`Bearer  ${validApiKey}`) // Extra space after Bearer
      mockExecutionContext = createMockExecutionContext(mockRequest)

      // Act & Assert: Verify throw UnauthorizedException
      // split(' ')[1] will be empty string because of double space
      // split(' ') on "Bearer  key" gives ["Bearer", "", "key"]
      // So [1] is empty string, not the key
      expect(() => guard.canActivate(mockExecutionContext)).toThrow(UnauthorizedException)
    })

    it('Nên reject API key tương tự nhưng khác biệt', () => {
      // Arrange: Chuẩn bị similar API key
      const validApiKey = envConfig.PAYMENT_API_KEY
      const similarApiKey = validApiKey + 'x' // Add one character
      const mockRequest = createMockRequest(`Bearer ${similarApiKey}`)
      mockExecutionContext = createMockExecutionContext(mockRequest)

      // Act & Assert: Verify throw UnauthorizedException
      expect(() => guard.canActivate(mockExecutionContext)).toThrow(UnauthorizedException)
    })

    it('Nên handle multiple Bearer keywords trong header', () => {
      // Arrange: Chuẩn bị request với multiple Bearer
      const validApiKey = envConfig.PAYMENT_API_KEY
      const mockRequest = createMockRequest(`Bearer Bearer ${validApiKey}`)
      mockExecutionContext = createMockExecutionContext(mockRequest)

      // Act & Assert: Verify throw UnauthorizedException
      // Should take the part after first space, which is "Bearer" not the actual key
      expect(() => guard.canActivate(mockExecutionContext)).toThrow(UnauthorizedException)
    })

    it('Nên reject API key với leading/trailing spaces', () => {
      // Arrange: Chuẩn bị API key với spaces
      const validApiKey = envConfig.PAYMENT_API_KEY
      const mockRequest = createMockRequest(`Bearer  ${validApiKey} `)
      mockExecutionContext = createMockExecutionContext(mockRequest)

      // Act & Assert: Verify throw UnauthorizedException
      expect(() => guard.canActivate(mockExecutionContext)).toThrow(UnauthorizedException)
    })

    it('Nên accept request với lowercase bearer scheme', () => {
      // Arrange: Chuẩn bị request với lowercase "bearer"
      const validApiKey = envConfig.PAYMENT_API_KEY
      const mockRequest = createMockRequest(`bearer ${validApiKey}`)
      mockExecutionContext = createMockExecutionContext(mockRequest)

      // Act: Thực hiện canActivate
      const result = guard.canActivate(mockExecutionContext)

      // Assert: Verify accept vì implementation không case-sensitive cho scheme
      expect(result).toBe(true)
    })
  })

  // ============================================
  // INTEGRATION SCENARIOS
  // ============================================

  describe('🔄 Integration Scenarios', () => {
    it('Nên hoạt động đúng trong webhook payment flow', () => {
      // Arrange: Simulate real webhook request from payment gateway
      const validApiKey = envConfig.PAYMENT_API_KEY
      const webhookRequest = {
        headers: {
          authorization: `Bearer ${validApiKey}`,
          'content-type': 'application/json',
        },
        body: {
          id: 123456,
          gateway: 'VCB',
          amount: 500000,
        },
      }
      mockExecutionContext = createMockExecutionContext(webhookRequest)

      // Act: Thực hiện canActivate
      const result = guard.canActivate(mockExecutionContext)

      // Assert: Verify cho phép webhook request
      expect(result).toBe(true)
    })

    it('Nên reject unauthorized webhook attempts', () => {
      // Arrange: Simulate malicious webhook request
      const maliciousRequest = {
        headers: {
          authorization: 'Bearer hacker-api-key',
          'content-type': 'application/json',
        },
        body: {
          id: 999999,
          gateway: 'FAKE',
          amount: 9999999,
        },
      }
      mockExecutionContext = createMockExecutionContext(maliciousRequest)

      // Act & Assert: Verify reject malicious request
      expect(() => guard.canActivate(mockExecutionContext)).toThrow(UnauthorizedException)
    })

    it('Nên validate API key trước khi process webhook payload', () => {
      // Arrange: Chuẩn bị webhook request với invalid API key
      const invalidRequest = {
        headers: {
          authorization: 'Bearer wrong-key',
          'content-type': 'application/json',
        },
        body: {
          id: 123456,
          gateway: 'VCB',
          amount: 500000,
        },
      }
      mockExecutionContext = createMockExecutionContext(invalidRequest)

      // Act & Assert: Verify reject trước khi process body
      expect(() => guard.canActivate(mockExecutionContext)).toThrow(UnauthorizedException)
    })
  })

  // ============================================
  // EXECUTION CONTEXT HANDLING
  // ============================================

  describe('🎯 Execution Context Handling', () => {
    it('Nên extract request từ ExecutionContext đúng cách', () => {
      // Arrange: Chuẩn bị execution context
      const validApiKey = envConfig.PAYMENT_API_KEY
      const mockRequest = createMockRequest(`Bearer ${validApiKey}`)
      mockExecutionContext = createMockExecutionContext(mockRequest)

      // Act: Thực hiện canActivate
      guard.canActivate(mockExecutionContext)

      // Assert: Verify switchToHttp được gọi
      expect(mockExecutionContext.switchToHttp).toHaveBeenCalled()
    })

    it('Nên access headers từ request object', () => {
      // Arrange: Chuẩn bị request với headers
      const validApiKey = envConfig.PAYMENT_API_KEY
      const mockRequest = createMockRequest(`Bearer ${validApiKey}`)
      const getRequestSpy = jest.fn().mockReturnValue(mockRequest)
      mockExecutionContext = {
        switchToHttp: jest.fn().mockReturnValue({
          getRequest: getRequestSpy,
        }),
        getHandler: jest.fn(),
        getClass: jest.fn(),
      } as any

      // Act: Thực hiện canActivate
      guard.canActivate(mockExecutionContext)

      // Assert: Verify getRequest được gọi
      expect(getRequestSpy).toHaveBeenCalled()
    })
  })
})
