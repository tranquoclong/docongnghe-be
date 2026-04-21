import { Test, TestingModule } from '@nestjs/testing'
import * as OTPAuth from 'otpauth'
import envConfig from 'src/shared/config'
import { TwoFactorService } from '../2fa.service'

// Mock OTPAuth
jest.mock('otpauth')

describe('TwoFactorService', () => {
  let service: TwoFactorService
  let mockTOTP: any
  let mockSecret: any

  // Test data factories
  const createTestData = {
    email: () => 'test@example.com',
    secret: () => 'JBSWY3DPEHPK3PXP',
    token: () => '123456',
    totpUri: () =>
      'otpauth://totp/test@example.com?secret=JBSWY3DPEHPK3PXP&issuer=Ecommerce&algorithm=SHA1&digits=6&period=30',
  }

  beforeEach(async () => {
    // Mock Secret class
    mockSecret = {
      base32: 'JBSWY3DPEHPK3PXP',
    }

    // Mock TOTP instance
    mockTOTP = {
      secret: mockSecret,
      toString: jest.fn().mockReturnValue(createTestData.totpUri()),
      validate: jest.fn(),
    }

    // Mock OTPAuth module
    jest.spyOn(OTPAuth, 'TOTP').mockImplementation(() => mockTOTP)
    jest.spyOn(OTPAuth, 'Secret').mockImplementation(() => mockSecret)

    const module: TestingModule = await Test.createTestingModule({
      providers: [TwoFactorService],
    }).compile()

    service = module.get<TwoFactorService>(TwoFactorService)
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  describe('generateTOTPSecret', () => {
    it('should generate TOTP secret and uri for email', () => {
      // Arrange - Chuẩn bị email
      const email = createTestData.email()

      // Act - Thực hiện generate TOTP secret
      const result = service.generateTOTPSecret(email)

      // Assert - Kiểm tra kết quả
      expect(result).toEqual({
        secret: 'JBSWY3DPEHPK3PXP',
        uri: createTestData.totpUri(),
      })
      expect(OTPAuth.TOTP).toHaveBeenCalledWith({
        issuer: envConfig.APP_NAME,
        label: email,
        algorithm: 'SHA1',
        digits: 6,
        period: 30,
        secret: mockSecret,
      })
      expect(mockTOTP.toString).toHaveBeenCalled()
    })

    it('should create new Secret when no secret provided', () => {
      // Arrange - Chuẩn bị email
      const email = 'user@example.com'

      // Act - Thực hiện generate TOTP secret
      service.generateTOTPSecret(email)

      // Assert - Kiểm tra Secret được tạo mới
      expect(OTPAuth.Secret).toHaveBeenCalled()
      expect(OTPAuth.TOTP).toHaveBeenCalledWith(
        expect.objectContaining({
          secret: mockSecret,
        }),
      )
    })

    it('should use correct TOTP configuration', () => {
      // Arrange - Chuẩn bị email
      const email = createTestData.email()

      // Act - Thực hiện generate TOTP secret
      service.generateTOTPSecret(email)

      // Assert - Kiểm tra TOTP configuration
      expect(OTPAuth.TOTP).toHaveBeenCalledWith({
        issuer: envConfig.APP_NAME,
        label: email,
        algorithm: 'SHA1',
        digits: 6,
        period: 30,
        secret: expect.any(Object),
      })
    })

    it('should return secret in base32 format', () => {
      // Arrange - Chuẩn bị email
      const email = createTestData.email()

      // Act - Thực hiện generate TOTP secret
      const result = service.generateTOTPSecret(email)

      // Assert - Kiểm tra secret format
      expect(result.secret).toBe(mockSecret.base32)
      expect(typeof result.secret).toBe('string')
    })

    it('should return uri as string', () => {
      // Arrange - Chuẩn bị email
      const email = createTestData.email()

      // Act - Thực hiện generate TOTP secret
      const result = service.generateTOTPSecret(email)

      // Assert - Kiểm tra uri format
      expect(result.uri).toBe(createTestData.totpUri())
      expect(typeof result.uri).toBe('string')
    })
  })

  describe('verifyTOTP', () => {
    it('should verify TOTP token successfully when valid', () => {
      // Arrange - Chuẩn bị valid token
      const email = createTestData.email()
      const secret = createTestData.secret()
      const token = createTestData.token()

      mockTOTP.validate.mockReturnValue(0) // delta = 0 means valid

      // Act - Thực hiện verify TOTP
      const result = service.verifyTOTP({ email, secret, token })

      // Assert - Kiểm tra kết quả
      expect(result).toBe(true)
      expect(OTPAuth.TOTP).toHaveBeenCalledWith({
        issuer: envConfig.APP_NAME,
        label: email,
        algorithm: 'SHA1',
        digits: 6,
        period: 30,
        secret,
      })
      expect(mockTOTP.validate).toHaveBeenCalledWith({
        token,
        window: 1,
      })
    })

    it('should return false when TOTP token is invalid', () => {
      // Arrange - Chuẩn bị invalid token
      const email = createTestData.email()
      const secret = createTestData.secret()
      const token = 'invalid-token'

      mockTOTP.validate.mockReturnValue(null) // delta = null means invalid

      // Act - Thực hiện verify TOTP
      const result = service.verifyTOTP({ email, secret, token })

      // Assert - Kiểm tra kết quả
      expect(result).toBe(false)
      expect(mockTOTP.validate).toHaveBeenCalledWith({
        token,
        window: 1,
      })
    })

    it('should use window 1 for validation', () => {
      // Arrange - Chuẩn bị token
      const email = createTestData.email()
      const secret = createTestData.secret()
      const token = createTestData.token()

      mockTOTP.validate.mockReturnValue(0)

      // Act - Thực hiện verify TOTP
      service.verifyTOTP({ email, secret, token })

      // Assert - Kiểm tra window parameter
      expect(mockTOTP.validate).toHaveBeenCalledWith(
        expect.objectContaining({
          window: 1,
        }),
      )
    })

    it('should create TOTP with provided secret', () => {
      // Arrange - Chuẩn bị token với custom secret
      const email = 'custom@example.com'
      const secret = 'CUSTOM_SECRET_BASE32'
      const token = '654321'

      mockTOTP.validate.mockReturnValue(0)

      // Act - Thực hiện verify TOTP
      service.verifyTOTP({ email, secret, token })

      // Assert - Kiểm tra TOTP được tạo với secret đúng
      expect(OTPAuth.TOTP).toHaveBeenCalledWith(
        expect.objectContaining({
          secret: 'CUSTOM_SECRET_BASE32',
        }),
      )
    })

    it('should return true when delta is positive (token from previous period)', () => {
      // Arrange - Chuẩn bị token từ period trước
      const email = createTestData.email()
      const secret = createTestData.secret()
      const token = createTestData.token()

      mockTOTP.validate.mockReturnValue(1) // delta = 1 means token from previous period

      // Act - Thực hiện verify TOTP
      const result = service.verifyTOTP({ email, secret, token })

      // Assert - Kiểm tra kết quả
      expect(result).toBe(true)
    })

    it('should return true when delta is negative (token from next period)', () => {
      // Arrange - Chuẩn bị token từ period sau
      const email = createTestData.email()
      const secret = createTestData.secret()
      const token = createTestData.token()

      mockTOTP.validate.mockReturnValue(-1) // delta = -1 means token from next period

      // Act - Thực hiện verify TOTP
      const result = service.verifyTOTP({ email, secret, token })

      // Assert - Kiểm tra kết quả
      expect(result).toBe(true)
    })

    it('should use correct algorithm SHA1', () => {
      // Arrange - Chuẩn bị token
      const email = createTestData.email()
      const secret = createTestData.secret()
      const token = createTestData.token()

      mockTOTP.validate.mockReturnValue(0)

      // Act - Thực hiện verify TOTP
      service.verifyTOTP({ email, secret, token })

      // Assert - Kiểm tra algorithm
      expect(OTPAuth.TOTP).toHaveBeenCalledWith(
        expect.objectContaining({
          algorithm: 'SHA1',
        }),
      )
    })

    it('should use 6 digits for TOTP', () => {
      // Arrange - Chuẩn bị token
      const email = createTestData.email()
      const secret = createTestData.secret()
      const token = createTestData.token()

      mockTOTP.validate.mockReturnValue(0)

      // Act - Thực hiện verify TOTP
      service.verifyTOTP({ email, secret, token })

      // Assert - Kiểm tra digits
      expect(OTPAuth.TOTP).toHaveBeenCalledWith(
        expect.objectContaining({
          digits: 6,
        }),
      )
    })

    it('should use 30 seconds period for TOTP', () => {
      // Arrange - Chuẩn bị token
      const email = createTestData.email()
      const secret = createTestData.secret()
      const token = createTestData.token()

      mockTOTP.validate.mockReturnValue(0)

      // Act - Thực hiện verify TOTP
      service.verifyTOTP({ email, secret, token })

      // Assert - Kiểm tra period
      expect(OTPAuth.TOTP).toHaveBeenCalledWith(
        expect.objectContaining({
          period: 30,
        }),
      )
    })
  })
})
