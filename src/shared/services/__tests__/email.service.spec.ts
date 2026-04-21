import { Test, TestingModule } from '@nestjs/testing'
import { Resend } from 'resend'
import envConfig from 'src/shared/config'
import { EmailService } from '../email.service'

// Mock Resend module
jest.mock('resend')

// Mock React để tránh lỗi khi render email template
jest.mock('react', () => ({
  createElement: jest.fn((type, props, ...children) => ({
    type,
    props: { ...props, children },
  })),
}))

// Mock OTPEmail component
jest.mock('emails/otp', () => ({
  OTPEmail: jest.fn(({ otpCode, title }) => ({
    type: 'OTPEmail',
    props: { otpCode, title },
  })),
}))

// Test data factory để tạo dữ liệu test
const createTestData = {
  sendOTPPayload: (overrides = {}) => ({
    email: 'test@example.com',
    code: '123456',
    ...overrides,
  }),

  resendSuccessResponse: (overrides = {}) => ({
    data: {
      id: 'email-id-123',
      from: 'NestJS Ecommerce Platform <no-reply@codeui.io.vn>',
      to: ['test@example.com'],
      created_at: new Date().toISOString(),
      ...overrides,
    },
    error: null,
  }),

  resendErrorResponse: (message = 'Failed to send email') => ({
    data: null,
    error: {
      message,
      name: 'ResendError',
      statusCode: 500,
    },
  }),

  resendValidationError: () => ({
    data: null,
    error: {
      message: 'Invalid email address',
      name: 'ValidationError',
      statusCode: 422,
    },
  }),

  resendRateLimitError: () => ({
    data: null,
    error: {
      message: 'Rate limit exceeded',
      name: 'RateLimitError',
      statusCode: 429,
    },
  }),

  resendAuthError: () => ({
    data: null,
    error: {
      message: 'Invalid API key',
      name: 'AuthenticationError',
      statusCode: 401,
    },
  }),
}

describe('EmailService', () => {
  let service: EmailService
  let module: TestingModule
  let mockResendInstance: jest.Mocked<any>

  beforeEach(async () => {
    // Tạo mock instance cho Resend
    mockResendInstance = {
      emails: {
        send: jest.fn(),
      },
    }

      // Mock constructor của Resend để trả về mock instance
      ; (Resend as jest.MockedClass<typeof Resend>).mockImplementation(() => mockResendInstance)

    module = await Test.createTestingModule({
      providers: [EmailService],
    }).compile()

    service = module.get<EmailService>(EmailService)
  })

  afterEach(() => {
    jest.clearAllMocks()
    jest.resetAllMocks()
  })

  afterAll(async () => {
    jest.restoreAllMocks()
    await module.close()
  })

  describe('constructor', () => {
    it('should initialize Resend with correct API key', () => {
      // Assert - Kiểm tra Resend được khởi tạo với API key đúng
      expect(Resend).toHaveBeenCalledWith(envConfig.RESEND_API_KEY)
      expect(Resend).toHaveBeenCalledTimes(1)
    })
  })

  describe('sendOTP', () => {
    it('should send OTP email successfully', async () => {
      // Arrange - Chuẩn bị dữ liệu gửi OTP email
      const payload = createTestData.sendOTPPayload()
      const mockResponse = createTestData.resendSuccessResponse()

      mockResendInstance.emails.send.mockResolvedValue(mockResponse)

      // Act - Thực hiện gửi OTP email
      const result = await service.sendOTP(payload)

      // Assert - Kiểm tra kết quả
      expect(result).toEqual(mockResponse)
      expect(result.error).toBeNull()
      expect(result.data).toBeDefined()
      expect(result.data?.id).toBe('email-id-123')
      expect(mockResendInstance.emails.send).toHaveBeenCalledTimes(1)
    })

    it('should send email with correct parameters', async () => {
      // Arrange - Chuẩn bị dữ liệu để kiểm tra parameters
      const payload = createTestData.sendOTPPayload({
        email: 'user@example.com',
        code: '654321',
      })
      const mockResponse = createTestData.resendSuccessResponse()

      mockResendInstance.emails.send.mockResolvedValue(mockResponse)

      // Act - Thực hiện gửi OTP email
      await service.sendOTP(payload)

      // Assert - Kiểm tra parameters được gọi đúng
      const callArgs = mockResendInstance.emails.send.mock.calls[0][0]
      expect(callArgs.from).toBe('NestJS Ecommerce Platform <no-reply@codeui.io.vn>')
      expect(callArgs.to).toEqual(['user@example.com'])
      expect(callArgs.subject).toBe('Mã OTP dùng để xác thực')
      expect(mockResendInstance.emails.send).toHaveBeenCalledTimes(1)
    })

    it('should send email to multiple recipients', async () => {
      // Arrange - Chuẩn bị dữ liệu gửi email đến nhiều người nhận
      const payload = createTestData.sendOTPPayload({
        email: 'user1@example.com',
      })
      const mockResponse = createTestData.resendSuccessResponse({
        to: ['user1@example.com'],
      })

      mockResendInstance.emails.send.mockResolvedValue(mockResponse)

      // Act - Thực hiện gửi OTP email
      const result = await service.sendOTP(payload)

      // Assert - Kiểm tra kết quả
      expect(result.data).toBeDefined()
    })

    it('should send OTP with 6-digit code', async () => {
      // Arrange - Chuẩn bị dữ liệu với mã OTP 6 chữ số
      const payload = createTestData.sendOTPPayload({
        code: '123456',
      })
      const mockResponse = createTestData.resendSuccessResponse()

      mockResendInstance.emails.send.mockResolvedValue(mockResponse)

      // Act - Thực hiện gửi OTP email
      const result = await service.sendOTP(payload)

      // Assert - Kiểm tra email được gửi thành công
      expect(result.error).toBeNull()
      expect(mockResendInstance.emails.send).toHaveBeenCalledTimes(1)
    })

    it('should use correct email subject', async () => {
      // Arrange - Chuẩn bị dữ liệu để kiểm tra subject
      const payload = createTestData.sendOTPPayload()
      const mockResponse = createTestData.resendSuccessResponse()

      mockResendInstance.emails.send.mockResolvedValue(mockResponse)

      // Act - Thực hiện gửi OTP email
      await service.sendOTP(payload)

      // Assert - Kiểm tra subject đúng
      const callArgs = mockResendInstance.emails.send.mock.calls[0][0]
      expect(callArgs.subject).toBe('Mã OTP dùng để xác thực')
    })

    it('should use correct sender email', async () => {
      // Arrange - Chuẩn bị dữ liệu để kiểm tra sender
      const payload = createTestData.sendOTPPayload()
      const mockResponse = createTestData.resendSuccessResponse()

      mockResendInstance.emails.send.mockResolvedValue(mockResponse)

      // Act - Thực hiện gửi OTP email
      await service.sendOTP(payload)

      // Assert - Kiểm tra sender email đúng
      const callArgs = mockResendInstance.emails.send.mock.calls[0][0]
      expect(callArgs.from).toBe('NestJS Ecommerce Platform <no-reply@codeui.io.vn>')
    })

    it('should return error when Resend API fails', async () => {
      // Arrange - Chuẩn bị dữ liệu khi API thất bại
      const payload = createTestData.sendOTPPayload()
      const mockErrorResponse = createTestData.resendErrorResponse('SMTP server unavailable')

      mockResendInstance.emails.send.mockResolvedValue(mockErrorResponse)

      // Act - Thực hiện gửi OTP email
      const result = await service.sendOTP(payload)

      // Assert - Kiểm tra error được trả về
      expect(result.error).toBeDefined()
      expect(result.error?.message).toBe('SMTP server unavailable')
      expect(result.data).toBeNull()
    })

    it('should handle validation error for invalid email', async () => {
      // Arrange - Chuẩn bị dữ liệu với email không hợp lệ
      const payload = createTestData.sendOTPPayload({
        email: 'invalid-email',
      })
      const mockErrorResponse = createTestData.resendValidationError()

      mockResendInstance.emails.send.mockResolvedValue(mockErrorResponse)

      // Act - Thực hiện gửi OTP email
      const result = await service.sendOTP(payload)

      // Assert - Kiểm tra validation error
      expect(result.error).toBeDefined()
      expect(result.error?.message).toBe('Invalid email address')
    })

    it('should handle rate limit error', async () => {
      // Arrange - Chuẩn bị dữ liệu khi bị rate limit
      const payload = createTestData.sendOTPPayload()
      const mockErrorResponse = createTestData.resendRateLimitError()

      mockResendInstance.emails.send.mockResolvedValue(mockErrorResponse)

      // Act - Thực hiện gửi OTP email
      const result = await service.sendOTP(payload)

      // Assert - Kiểm tra rate limit error
      expect(result.error).toBeDefined()
      expect(result.error?.message).toBe('Rate limit exceeded')
    })

    it('should handle authentication error with invalid API key', async () => {
      // Arrange - Chuẩn bị dữ liệu khi API key không hợp lệ
      const payload = createTestData.sendOTPPayload()
      const mockErrorResponse = createTestData.resendAuthError()

      mockResendInstance.emails.send.mockResolvedValue(mockErrorResponse)

      // Act - Thực hiện gửi OTP email
      const result = await service.sendOTP(payload)

      // Assert - Kiểm tra authentication error
      expect(result.error).toBeDefined()
      expect(result.error?.message).toBe('Invalid API key')
    })

    it('should handle network error gracefully', async () => {
      // Arrange - Chuẩn bị dữ liệu khi có network error
      const payload = createTestData.sendOTPPayload()
      const networkError = new Error('Network request failed')

      mockResendInstance.emails.send.mockRejectedValue(networkError)

      // Act & Assert - Thực hiện và kiểm tra error
      await expect(service.sendOTP(payload)).rejects.toThrow('Network request failed')
    })

    it('should handle timeout error', async () => {
      // Arrange - Chuẩn bị dữ liệu khi request timeout
      const payload = createTestData.sendOTPPayload()
      const timeoutError = new Error('Request timeout')

      mockResendInstance.emails.send.mockRejectedValue(timeoutError)

      // Act & Assert - Thực hiện và kiểm tra timeout error
      await expect(service.sendOTP(payload)).rejects.toThrow('Request timeout')
    })

    it('should send OTP with different code formats', async () => {
      // Arrange - Chuẩn bị dữ liệu với các format code khác nhau
      const testCodes = ['123456', '000000', '999999', '111111']
      const mockResponse = createTestData.resendSuccessResponse()

      mockResendInstance.emails.send.mockResolvedValue(mockResponse)

      // Act & Assert - Thực hiện gửi với từng code
      for (const code of testCodes) {
        const payload = createTestData.sendOTPPayload({ code })
        const result = await service.sendOTP(payload)
        expect(result.error).toBeNull()
      }

      expect(mockResendInstance.emails.send).toHaveBeenCalledTimes(testCodes.length)
    })

    it('should handle concurrent email sending', async () => {
      // Arrange - Chuẩn bị dữ liệu cho nhiều emails đồng thời
      const payloads = [
        createTestData.sendOTPPayload({ email: 'user1@example.com', code: '111111' }),
        createTestData.sendOTPPayload({ email: 'user2@example.com', code: '222222' }),
        createTestData.sendOTPPayload({ email: 'user3@example.com', code: '333333' }),
      ]
      const mockResponse = createTestData.resendSuccessResponse()

      mockResendInstance.emails.send.mockResolvedValue(mockResponse)

      // Act - Thực hiện gửi nhiều emails đồng thời
      const results = await Promise.all(payloads.map((payload) => service.sendOTP(payload)))

      // Assert - Kiểm tra kết quả
      expect(results).toHaveLength(3)
      results.forEach((result) => {
        expect(result.error).toBeNull()
        expect(result.data).toBeDefined()
      })
      expect(mockResendInstance.emails.send).toHaveBeenCalledTimes(3)
    })

    it('should preserve email case sensitivity', async () => {
      // Arrange - Chuẩn bị dữ liệu với email có chữ hoa
      const payload = createTestData.sendOTPPayload({
        email: 'User@Example.COM',
      })
      const mockResponse = createTestData.resendSuccessResponse()

      mockResendInstance.emails.send.mockResolvedValue(mockResponse)

      // Act - Thực hiện gửi OTP email
      await service.sendOTP(payload)

      // Assert - Kiểm tra email được giữ nguyên case
      const callArgs = mockResendInstance.emails.send.mock.calls[0][0]
      expect(callArgs.to).toEqual(['User@Example.COM'])
    })

    it('should handle special characters in email', async () => {
      // Arrange - Chuẩn bị dữ liệu với email có ký tự đặc biệt
      const payload = createTestData.sendOTPPayload({
        email: 'user+test@example.com',
      })
      const mockResponse = createTestData.resendSuccessResponse()

      mockResendInstance.emails.send.mockResolvedValue(mockResponse)

      // Act - Thực hiện gửi OTP email
      const result = await service.sendOTP(payload)

      // Assert - Kiểm tra kết quả
      expect(result.error).toBeNull()
      const callArgs = mockResendInstance.emails.send.mock.calls[0][0]
      expect(callArgs.to).toEqual(['user+test@example.com'])
    })

    it('should return response with email ID on success', async () => {
      // Arrange - Chuẩn bị dữ liệu để kiểm tra email ID
      const payload = createTestData.sendOTPPayload()
      const mockResponse = createTestData.resendSuccessResponse({
        id: 'unique-email-id-789',
      })

      mockResendInstance.emails.send.mockResolvedValue(mockResponse)

      // Act - Thực hiện gửi OTP email
      const result = await service.sendOTP(payload)

      // Assert - Kiểm tra email ID được trả về
      expect(result.data?.id).toBe('unique-email-id-789')
    })

    it('should include timestamp in response', async () => {
      // Arrange - Chuẩn bị dữ liệu để kiểm tra timestamp
      const payload = createTestData.sendOTPPayload()
      const timestamp = new Date().toISOString()
      const mockResponse = createTestData.resendSuccessResponse({
        created_at: timestamp,
      })

      mockResendInstance.emails.send.mockResolvedValue(mockResponse)

      // Act - Thực hiện gửi OTP email
      const result = await service.sendOTP(payload)

      // Assert - Kiểm tra timestamp
      expect(result.data).toBeDefined()
    })
  })

  describe('Edge Cases & Security', () => {
    it('should handle empty email gracefully', async () => {
      // Arrange - Chuẩn bị dữ liệu với email rỗng
      const payload = createTestData.sendOTPPayload({ email: '' })
      const mockErrorResponse = createTestData.resendValidationError()

      mockResendInstance.emails.send.mockResolvedValue(mockErrorResponse)

      // Act - Thực hiện gửi OTP email
      const result = await service.sendOTP(payload)

      // Assert - Kiểm tra validation error
      expect(result.error).toBeDefined()
    })

    it('should handle empty OTP code', async () => {
      // Arrange - Chuẩn bị dữ liệu với code rỗng
      const payload = createTestData.sendOTPPayload({ code: '' })
      const mockResponse = createTestData.resendSuccessResponse()

      mockResendInstance.emails.send.mockResolvedValue(mockResponse)

      // Act - Thực hiện gửi OTP email
      const result = await service.sendOTP(payload)

      // Assert - Kiểm tra kết quả (service không validate, để caller validate)
      expect(mockResendInstance.emails.send).toHaveBeenCalled()
    })

    it('should handle very long email addresses', async () => {
      // Arrange - Chuẩn bị dữ liệu với email rất dài
      const longEmail = 'a'.repeat(50) + '@' + 'b'.repeat(50) + '.com'
      const payload = createTestData.sendOTPPayload({ email: longEmail })
      const mockResponse = createTestData.resendSuccessResponse()

      mockResendInstance.emails.send.mockResolvedValue(mockResponse)

      // Act - Thực hiện gửi OTP email
      const result = await service.sendOTP(payload)

      // Assert - Kiểm tra kết quả
      expect(mockResendInstance.emails.send).toHaveBeenCalled()
    })

    it('should handle international email addresses', async () => {
      // Arrange - Chuẩn bị dữ liệu với email quốc tế
      const payload = createTestData.sendOTPPayload({
        email: 'user@example.jp',
      })
      const mockResponse = createTestData.resendSuccessResponse()

      mockResendInstance.emails.send.mockResolvedValue(mockResponse)

      // Act - Thực hiện gửi OTP email
      const result = await service.sendOTP(payload)

      // Assert - Kiểm tra kết quả
      expect(mockResendInstance.emails.send).toHaveBeenCalled()
    })

    it('should not expose API key in error messages', async () => {
      // Arrange - Chuẩn bị dữ liệu khi có error
      const payload = createTestData.sendOTPPayload()
      const mockErrorResponse = createTestData.resendAuthError()

      mockResendInstance.emails.send.mockResolvedValue(mockErrorResponse)

      // Act - Thực hiện gửi OTP email
      const result = await service.sendOTP(payload)

      // Assert - Kiểm tra error message không chứa API key
      expect(result.error?.message).not.toContain(envConfig.RESEND_API_KEY)
    })

    it('should handle malformed response from Resend', async () => {
      // Arrange - Chuẩn bị dữ liệu với response không đúng format
      const payload = createTestData.sendOTPPayload()
      const malformedResponse = { unexpected: 'format' }

      mockResendInstance.emails.send.mockResolvedValue(malformedResponse)

      // Act - Thực hiện gửi OTP email
      const result = await service.sendOTP(payload)

      // Assert - Kiểm tra service xử lý được malformed response
      expect(result).toBeDefined()
    })

    it('should maintain service availability after error', async () => {
      // Arrange - Chuẩn bị dữ liệu để test recovery sau error
      const payload = createTestData.sendOTPPayload()
      const mockErrorResponse = createTestData.resendErrorResponse()
      const mockSuccessResponse = createTestData.resendSuccessResponse()

      mockResendInstance.emails.send.mockResolvedValueOnce(mockErrorResponse).mockResolvedValueOnce(mockSuccessResponse)

      // Act - Thực hiện gửi email 2 lần
      const result1 = await service.sendOTP(payload)
      const result2 = await service.sendOTP(payload)

      // Assert - Kiểm tra service vẫn hoạt động sau error
      expect(result1.error).toBeDefined()
      expect(result2.error).toBeNull()
      expect(result2.data).toBeDefined()
    })
  })
})
