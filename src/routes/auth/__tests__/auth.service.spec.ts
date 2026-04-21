import { UnauthorizedException } from '@nestjs/common'
import { JsonWebTokenError } from '@nestjs/jwt'
import { Test, TestingModule } from '@nestjs/testing'
import { TypeOfVerificationCode } from '../../../shared/constants/auth.constant'
import { InvalidPasswordException } from '../../../shared/error'
import { isNotFoundPrismaError, isUniqueConstraintPrismaError } from '../../../shared/helpers'
import { SharedRoleRepository } from '../../../shared/repositories/shared-role.repo'
import { SharedUserRepository } from '../../../shared/repositories/shared-user.repo'
import { TwoFactorService } from '../../../shared/services/2fa.service'
import { EmailService } from '../../../shared/services/email.service'
import { HashingService } from '../../../shared/services/hashing.service'
import { TokenService } from '../../../shared/services/token.service'
import {
  EmailAlreadyExistsException,
  EmailNotFoundException,
  FailedToSendOTPException,
  InvalidOTPException,
  InvalidTOTPAndCodeException,
  InvalidTOTPException,
  OTPExpiredException,
  RefreshTokenAlreadyUsedException,
  TOTPAlreadyEnabledException,
  TOTPNotEnabledException,
} from '../auth.error'
import { AuthRepository } from '../auth.repo'
import { AuthService } from '../auth.service'

jest.mock('../../../shared/helpers', () => ({
  isUniqueConstraintPrismaError: jest.fn(),
  isNotFoundPrismaError: jest.fn(),
  generateOTP: jest.fn(() => '123456'),
}))

const mockIsUniqueConstraintPrismaError = isUniqueConstraintPrismaError as jest.MockedFunction<
  typeof isUniqueConstraintPrismaError
>
const mockIsNotFoundPrismaError = isNotFoundPrismaError as jest.MockedFunction<typeof isNotFoundPrismaError>

// Simple test data factory để tránh memory leak
const createTestData = {
  verificationCode: (overrides = {}) => ({
    id: 1,
    email: 'test@example.com',
    code: '123456',
    type: TypeOfVerificationCode.REGISTER,
    expiresAt: new Date(Date.now() + 60000).toISOString(),
    createdAt: new Date().toISOString(),
    ...overrides,
  }),

  user: (overrides = {}) => ({
    id: 1,
    email: 'test@example.com',
    name: 'Test User',
    phoneNumber: '0123456789',
    password: 'hashedPassword123',
    roleId: 2,
    status: 'ACTIVE' as const,
    avatar: null,
    totpSecret: null,
    createdById: null,
    updatedById: null,
    deletedById: null,
    deletedAt: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  }),

  role: (overrides = {}) => ({
    id: 1,
    name: 'CLIENT',
    description: 'Client role',
    isActive: true,
    createdById: null,
    updatedById: null,
    deletedById: null,
    deletedAt: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    permissions: [],
    ...overrides,
  }),

  tokens: (overrides = {}) => ({
    accessToken: 'mock-access-token',
    refreshToken: 'mock-refresh-token',
    ...overrides,
  }),
}

describe('AuthService', () => {
  let service: AuthService
  let module: TestingModule
  let mockAuthRepo: jest.Mocked<AuthRepository>
  let mockHashingService: jest.Mocked<HashingService>
  let mockTokenService: jest.Mocked<TokenService>
  let mockEmailService: jest.Mocked<EmailService>
  let mockTwoFactorService: jest.Mocked<TwoFactorService>
  let mockSharedUserRepo: jest.Mocked<SharedUserRepository>
  let mockSharedRoleRepo: jest.Mocked<SharedRoleRepository>

  beforeEach(async () => {
    // Create mocks with proper typing - tối ưu hóa để tránh memory leak
    mockAuthRepo = {
      findUniqueVerificationCode: jest.fn(),
      createUser: jest.fn(),
      deleteVerificationCode: jest.fn(),
      createVerificationCode: jest.fn(),
      findUniqueUserIncludeRole: jest.fn(),
      createDevice: jest.fn(),
      createRefreshToken: jest.fn(),
      deleteRefreshToken: jest.fn(),
      updateDevice: jest.fn(),
      findUniqueRefreshTokenIncludeUserRole: jest.fn(),
    } as any

    mockHashingService = {
      hash: jest.fn(),
      compare: jest.fn(),
    } as any

    mockTokenService = {
      signAccessToken: jest.fn(),
      signRefreshToken: jest.fn(),
      verifyAccessToken: jest.fn(),
      verifyRefreshToken: jest.fn(),
      decodeRefreshToken: jest.fn(),
    } as any

    mockEmailService = {
      sendOTP: jest.fn(),
    } as any

    mockTwoFactorService = {
      verifyTOTP: jest.fn(),
      generateTOTPSecret: jest.fn(),
    } as any

    mockSharedUserRepo = {
      findUnique: jest.fn(),
      updateUser: jest.fn(),
    } as any

    mockSharedRoleRepo = {
      getClientRoleId: jest.fn(),
    } as any

    module = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: AuthRepository, useValue: mockAuthRepo },
        { provide: HashingService, useValue: mockHashingService },
        { provide: TokenService, useValue: mockTokenService },
        { provide: EmailService, useValue: mockEmailService },
        { provide: TwoFactorService, useValue: mockTwoFactorService },
        { provide: SharedUserRepository, useValue: mockSharedUserRepo },
        { provide: SharedRoleRepository, useValue: mockSharedRoleRepo },
      ],
    }).compile()

    service = module.get<AuthService>(AuthService)
  })

  afterEach(() => {
    jest.clearAllMocks()
    jest.resetAllMocks()
  })

  afterAll(async () => {
    jest.restoreAllMocks()
    if (module) {
      await module.close()
    }
  })

  describe('validateVerificationCode', () => {
    it('should validate verification code successfully', async () => {
      // Arrange - Chuẩn bị dữ liệu test
      const mockVerificationCode = createTestData.verificationCode({
        email: 'test@example.com',
        code: '123456',
        type: TypeOfVerificationCode.REGISTER,
        expiresAt: new Date(Date.now() + 60000).toISOString(), // 1 phút từ bây giờ
      })

      mockAuthRepo.findUniqueVerificationCode.mockResolvedValue(mockVerificationCode)

      // Act - Thực hiện test
      const result = await service.validateVerificationCode({
        email: 'test@example.com',
        code: '123456',
        type: TypeOfVerificationCode.REGISTER,
      })

      // Assert - Kiểm tra kết quả
      expect(result).toEqual(mockVerificationCode)
      expect(mockAuthRepo.findUniqueVerificationCode).toHaveBeenCalledWith({
        email_type: {
          email: 'test@example.com',
          type: TypeOfVerificationCode.REGISTER,
        },
      })
    })

    it('should throw error when verification code not found', async () => {
      // Arrange - Chuẩn bị dữ liệu test
      mockAuthRepo.findUniqueVerificationCode.mockResolvedValue(null)

      // Act & Assert - Thực hiện test và kiểm tra lỗi
      await expect(
        service.validateVerificationCode({
          email: 'test@example.com',
          code: '123456',
          type: TypeOfVerificationCode.REGISTER,
        }),
      ).rejects.toThrow()
    })

    it('should throw error when verification code is expired', async () => {
      // Arrange - Chuẩn bị mã xác thực đã hết hạn
      const expiredVerificationCode = createTestData.verificationCode({
        email: 'test@example.com',
        code: '123456',
        type: TypeOfVerificationCode.REGISTER,
        expiresAt: new Date(Date.now() - 60000).toISOString(), // 1 phút trước (đã hết hạn)
      })

      mockAuthRepo.findUniqueVerificationCode.mockResolvedValue(expiredVerificationCode)

      // Act & Assert - Thực hiện test và kiểm tra lỗi
      await expect(
        service.validateVerificationCode({
          email: 'test@example.com',
          code: '123456',
          type: TypeOfVerificationCode.REGISTER,
        }),
      ).rejects.toThrow()
    })
  })

  describe('register', () => {
    const validRegisterData = {
      email: 'test@example.com',
      name: 'Test User',
      phoneNumber: '0123456789',
      password: 'password123',
      confirmPassword: 'password123',
      code: '123456',
    }

    it('should register user successfully', async () => {
      // Arrange - Chuẩn bị dữ liệu test
      const mockVerificationCode = createTestData.verificationCode({
        email: validRegisterData.email,
        code: validRegisterData.code,
        type: TypeOfVerificationCode.REGISTER,
        expiresAt: new Date(Date.now() + 60000).toISOString(),
      })

      const mockUser = createTestData.user({
        email: validRegisterData.email,
        name: validRegisterData.name,
        phoneNumber: validRegisterData.phoneNumber,
      })

      const mockDeletedVerificationCode = createTestData.verificationCode({
        id: 1,
        email: validRegisterData.email,
        code: validRegisterData.code,
        type: TypeOfVerificationCode.REGISTER,
      })

      mockAuthRepo.findUniqueVerificationCode.mockResolvedValue(mockVerificationCode)
      mockSharedRoleRepo.getClientRoleId.mockResolvedValue(1)
      mockHashingService.hash.mockResolvedValue('hashedPassword')
      mockAuthRepo.createUser.mockResolvedValue(mockUser as any)
      mockAuthRepo.deleteVerificationCode.mockResolvedValue(mockDeletedVerificationCode as any)

      // Act - Thực hiện đăng ký
      const result = await service.register(validRegisterData)

      // Assert - Kiểm tra kết quả
      expect(result).toEqual(mockUser)
      expect(mockHashingService.hash).toHaveBeenCalledWith(validRegisterData.password)
      expect(mockAuthRepo.createUser).toHaveBeenCalledWith({
        email: validRegisterData.email,
        name: validRegisterData.name,
        phoneNumber: validRegisterData.phoneNumber,
        password: 'hashedPassword',
        roleId: 1,
      })
      expect(mockAuthRepo.deleteVerificationCode).toHaveBeenCalledWith({
        email_type: {
          email: validRegisterData.email,
          type: TypeOfVerificationCode.REGISTER,
        },
      })
    })

    it('should throw EmailAlreadyExistsException on unique constraint violation', async () => {
      // Arrange - Chuẩn bị dữ liệu test với lỗi unique constraint
      const mockVerificationCode = createTestData.verificationCode({
        email: validRegisterData.email,
        code: validRegisterData.code,
        type: TypeOfVerificationCode.REGISTER,
        expiresAt: new Date(Date.now() + 60000).toISOString(),
      })

      mockAuthRepo.findUniqueVerificationCode.mockResolvedValue(mockVerificationCode)
      mockSharedRoleRepo.getClientRoleId.mockResolvedValue(1)
      mockHashingService.hash.mockResolvedValue('hashedPassword')

      // Mock Prisma unique constraint error
      const uniqueError = new Error('Unique constraint failed')
      ;(uniqueError as any).code = 'P2002'
      mockAuthRepo.createUser.mockRejectedValue(uniqueError)
      mockIsUniqueConstraintPrismaError.mockReturnValue(true)

      // Act & Assert - Thực hiện test và kiểm tra lỗi
      await expect(service.register(validRegisterData)).rejects.toThrow(EmailAlreadyExistsException)
    })

    it('should rethrow error when error is not unique constraint violation', async () => {
      // Arrange - Chuẩn bị dữ liệu với lỗi khác
      const mockVerificationCode = createTestData.verificationCode({
        email: validRegisterData.email,
        code: validRegisterData.code,
        type: TypeOfVerificationCode.REGISTER,
        expiresAt: new Date(Date.now() + 60000).toISOString(),
      })

      mockAuthRepo.findUniqueVerificationCode.mockResolvedValue(mockVerificationCode)
      mockSharedRoleRepo.getClientRoleId.mockResolvedValue(1)
      mockHashingService.hash.mockResolvedValue('hashedPassword')

      const genericError = new Error('Database connection failed')
      mockAuthRepo.createUser.mockRejectedValue(genericError)
      mockIsUniqueConstraintPrismaError.mockReturnValue(false)

      // Act & Assert - Thực hiện test và kiểm tra lỗi được rethrow
      await expect(service.register(validRegisterData)).rejects.toThrow(genericError)
    })
  })

  describe('sendOTP', () => {
    it('should send OTP successfully for new user registration', async () => {
      // Arrange - Chuẩn bị dữ liệu gửi OTP cho user mới
      const otpData = {
        email: 'newuser@example.com',
        type: TypeOfVerificationCode.REGISTER,
      }

      mockSharedUserRepo.findUnique.mockResolvedValue(null) // User chưa tồn tại
      mockAuthRepo.createVerificationCode.mockResolvedValue(
        createTestData.verificationCode({
          email: otpData.email,
          type: otpData.type,
        }),
      )
      mockEmailService.sendOTP.mockResolvedValue({
        data: { id: 'test-id' },
        error: null,
      })

      // Act - Thực hiện gửi OTP
      const result = await service.sendOTP(otpData)

      // Assert - Kiểm tra kết quả
      expect(result).toEqual({ message: 'Gửi mã OTP thành công' })
      expect(mockSharedUserRepo.findUnique).toHaveBeenCalledWith({
        email: otpData.email,
      })
      expect(mockAuthRepo.createVerificationCode).toHaveBeenCalled()
      expect(mockEmailService.sendOTP).toHaveBeenCalled()
    })

    it('should throw error when user already exists for registration', async () => {
      // Arrange - Chuẩn bị dữ liệu với user đã tồn tại
      const otpData = {
        email: 'existing@example.com',
        type: TypeOfVerificationCode.REGISTER,
      }

      const existingUser = createTestData.user({
        email: otpData.email,
        name: 'Existing User',
      })

      mockSharedUserRepo.findUnique.mockResolvedValue(existingUser)

      // Act & Assert - Thực hiện test và kiểm tra lỗi
      await expect(service.sendOTP(otpData)).rejects.toThrow()
    })

    it('should throw EmailNotFoundException when user does not exist for forgot password', async () => {
      // Arrange - Chuẩn bị dữ liệu với user không tồn tại cho quên mật khẩu
      const otpData = {
        email: 'nonexistent@example.com',
        type: TypeOfVerificationCode.FORGOT_PASSWORD,
      }

      mockSharedUserRepo.findUnique.mockResolvedValue(null) // User không tồn tại

      // Act & Assert - Thực hiện test và kiểm tra lỗi
      await expect(service.sendOTP(otpData)).rejects.toThrow(EmailNotFoundException)
    })

    it('should send OTP successfully for forgot password', async () => {
      // Arrange - Chuẩn bị dữ liệu gửi OTP cho quên mật khẩu
      const otpData = {
        email: 'existing@example.com',
        type: TypeOfVerificationCode.FORGOT_PASSWORD,
      }

      const existingUser = createTestData.user({ email: otpData.email })

      mockSharedUserRepo.findUnique.mockResolvedValue(existingUser)
      mockAuthRepo.createVerificationCode.mockResolvedValue(
        createTestData.verificationCode({
          email: otpData.email,
          type: otpData.type,
        }),
      )
      mockEmailService.sendOTP.mockResolvedValue({
        data: { id: 'test-id' },
        error: null,
      })

      // Act - Thực hiện gửi OTP
      const result = await service.sendOTP(otpData)

      // Assert - Kiểm tra kết quả
      expect(result).toEqual({ message: 'Gửi mã OTP thành công' })
      expect(mockEmailService.sendOTP).toHaveBeenCalled()
    })

    it('should throw FailedToSendOTPException when email service fails', async () => {
      // Arrange - Chuẩn bị dữ liệu với lỗi gửi email
      const otpData = {
        email: 'test@example.com',
        type: TypeOfVerificationCode.REGISTER,
      }

      mockSharedUserRepo.findUnique.mockResolvedValue(null)
      mockAuthRepo.createVerificationCode.mockResolvedValue(createTestData.verificationCode())
      mockEmailService.sendOTP.mockResolvedValue({
        data: null,
        error: { message: 'Failed to send email', name: 'validation_error' },
      } as any)

      // Act & Assert - Thực hiện test và kiểm tra lỗi
      await expect(service.sendOTP(otpData)).rejects.toThrow(FailedToSendOTPException)
    })
  })

  describe('login', () => {
    const validLoginData = {
      email: 'test@example.com',
      password: 'password123',
      userAgent: 'test-agent',
      ip: '127.0.0.1',
    }

    it('should login successfully without 2FA', async () => {
      // Arrange - Chuẩn bị dữ liệu đăng nhập không có 2FA
      const mockUser = {
        ...createTestData.user(),
        totpSecret: null, // Không bật 2FA
        role: createTestData.role({
          id: 1,
          name: 'CLIENT',
        }),
      }

      const mockTokens = createTestData.tokens({
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
      })

      const mockDevice = { id: 1, userId: mockUser.id, userAgent: 'test-agent' }
      const mockRefreshToken = mockTokens.refreshToken

      mockAuthRepo.findUniqueUserIncludeRole.mockResolvedValue(mockUser as any)
      mockHashingService.compare.mockResolvedValue(true)
      mockAuthRepo.createDevice.mockResolvedValue(mockDevice as any)
      mockAuthRepo.createRefreshToken.mockResolvedValue({
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 3600000),
        token: mockRefreshToken,
        userId: mockUser.id,
        deviceId: mockDevice.id,
      } as any)
      mockTokenService.signAccessToken.mockImplementation(() => mockTokens.accessToken)
      mockTokenService.signRefreshToken.mockImplementation(() => mockRefreshToken)
      // Mock verifyRefreshToken để trả về exp time
      mockTokenService.verifyRefreshToken.mockResolvedValue({
        exp: Math.floor(Date.now() / 1000) + 3600,
        userId: mockUser.id,
      } as any)

      // Act - Thực hiện đăng nhập
      const result = await service.login(validLoginData)

      // Assert - Kiểm tra kết quả
      expect(result).toEqual(mockTokens)
      expect(mockAuthRepo.findUniqueUserIncludeRole).toHaveBeenCalledWith({
        email: validLoginData.email,
      })
      expect(mockHashingService.compare).toHaveBeenCalledWith(validLoginData.password, mockUser.password)
    })

    it('should throw EmailNotFoundException when user does not exist', async () => {
      // Arrange - Chuẩn bị dữ liệu với user không tồn tại
      mockAuthRepo.findUniqueUserIncludeRole.mockResolvedValue(null)

      // Act & Assert - Thực hiện test và kiểm tra lỗi
      await expect(service.login(validLoginData)).rejects.toThrow(EmailNotFoundException)
    })

    it('should throw TOTPNotEnabledException when user provides 2FA code but 2FA is not enabled', async () => {
      // Arrange - Chuẩn bị dữ liệu với mã 2FA nhưng chưa bật 2FA
      const loginDataWith2FA = {
        ...validLoginData,
        totpCode: '123456',
      }

      const mockUser = {
        ...createTestData.user(),
        totpSecret: null, // Chưa bật 2FA
        role: createTestData.role({ id: 1, name: 'CLIENT' }),
      }

      mockAuthRepo.findUniqueUserIncludeRole.mockResolvedValue(mockUser as any)
      mockHashingService.compare.mockResolvedValue(true)

      // Act & Assert - Thực hiện test và kiểm tra lỗi
      await expect(service.login(loginDataWith2FA)).rejects.toThrow(TOTPNotEnabledException)
    })

    it('should throw InvalidPasswordException when password is incorrect', async () => {
      // Arrange - Chuẩn bị dữ liệu với mật khẩu sai
      const mockUser = {
        ...createTestData.user(),
        role: createTestData.role({ id: 1, name: 'CLIENT' }),
      }

      mockAuthRepo.findUniqueUserIncludeRole.mockResolvedValue(mockUser as any)
      mockHashingService.compare.mockResolvedValue(false) // Mật khẩu không khớp

      // Act & Assert - Thực hiện test và kiểm tra lỗi
      await expect(service.login(validLoginData)).rejects.toThrow(InvalidPasswordException)
    })

    it('should throw InvalidTOTPAndCodeException when 2FA enabled but no code provided', async () => {
      // Arrange - Chuẩn bị dữ liệu với 2FA đã bật nhưng không gửi mã
      const mockUser = {
        ...createTestData.user(),
        totpSecret: 'secret123', // Đã bật 2FA
        role: createTestData.role({ id: 1, name: 'CLIENT' }),
      }

      mockAuthRepo.findUniqueUserIncludeRole.mockResolvedValue(mockUser as any)
      mockHashingService.compare.mockResolvedValue(true)

      // Act & Assert - Thực hiện test và kiểm tra lỗi
      await expect(service.login(validLoginData)).rejects.toThrow(InvalidTOTPAndCodeException)
    })

    it('should login successfully with valid TOTP code', async () => {
      // Arrange - Chuẩn bị dữ liệu đăng nhập với TOTP code hợp lệ
      const loginDataWithTOTP = {
        ...validLoginData,
        totpCode: '123456',
      }

      const mockUser = {
        ...createTestData.user(),
        totpSecret: 'secret123', // Đã bật 2FA
        role: createTestData.role({ id: 1, name: 'CLIENT' }),
      }

      const mockTokens = createTestData.tokens()
      const mockDevice = { id: 1, userId: mockUser.id, userAgent: 'test-agent' }

      mockAuthRepo.findUniqueUserIncludeRole.mockResolvedValue(mockUser as any)
      mockHashingService.compare.mockResolvedValue(true)
      mockTwoFactorService.verifyTOTP.mockReturnValue(true) // TOTP hợp lệ
      mockAuthRepo.createDevice.mockResolvedValue(mockDevice as any)
      mockTokenService.signAccessToken.mockImplementation(() => mockTokens.accessToken)
      mockTokenService.signRefreshToken.mockImplementation(() => mockTokens.refreshToken)
      mockTokenService.verifyRefreshToken.mockResolvedValue({
        exp: Math.floor(Date.now() / 1000) + 3600,
        userId: mockUser.id,
      } as any)
      mockAuthRepo.createRefreshToken.mockResolvedValue({} as any)

      // Act - Thực hiện đăng nhập
      const result = await service.login(loginDataWithTOTP)

      // Assert - Kiểm tra kết quả
      expect(result).toEqual(mockTokens)
      expect(mockTwoFactorService.verifyTOTP).toHaveBeenCalledWith({
        email: mockUser.email,
        secret: mockUser.totpSecret,
        token: loginDataWithTOTP.totpCode,
      })
    })

    it('should throw InvalidTOTPException when TOTP code is invalid', async () => {
      // Arrange - Chuẩn bị dữ liệu với TOTP code không hợp lệ
      const loginDataWithTOTP = {
        ...validLoginData,
        totpCode: '999999',
      }

      const mockUser = {
        ...createTestData.user(),
        totpSecret: 'secret123',
        role: createTestData.role({ id: 1, name: 'CLIENT' }),
      }

      mockAuthRepo.findUniqueUserIncludeRole.mockResolvedValue(mockUser as any)
      mockHashingService.compare.mockResolvedValue(true)
      mockTwoFactorService.verifyTOTP.mockReturnValue(false) // TOTP không hợp lệ

      // Act & Assert - Thực hiện test và kiểm tra lỗi
      await expect(service.login(loginDataWithTOTP)).rejects.toThrow(InvalidTOTPException)
    })

    it('should login successfully with valid OTP code when 2FA enabled', async () => {
      // Arrange - Chuẩn bị dữ liệu đăng nhập với OTP code hợp lệ
      const loginDataWithOTP = {
        ...validLoginData,
        code: '123456',
      }

      const mockUser = {
        ...createTestData.user(),
        totpSecret: 'secret123', // Đã bật 2FA
        role: createTestData.role({ id: 1, name: 'CLIENT' }),
      }

      const mockVerificationCode = createTestData.verificationCode({
        email: mockUser.email,
        code: loginDataWithOTP.code,
        type: TypeOfVerificationCode.LOGIN,
        expiresAt: new Date(Date.now() + 60000).toISOString(),
      })

      const mockTokens = createTestData.tokens()
      const mockDevice = { id: 1, userId: mockUser.id, userAgent: 'test-agent' }

      mockAuthRepo.findUniqueUserIncludeRole.mockResolvedValue(mockUser as any)
      mockHashingService.compare.mockResolvedValue(true)
      mockAuthRepo.findUniqueVerificationCode.mockResolvedValue(mockVerificationCode)
      mockAuthRepo.deleteVerificationCode.mockResolvedValue({} as any)
      mockAuthRepo.createDevice.mockResolvedValue(mockDevice as any)
      mockTokenService.signAccessToken.mockImplementation(() => mockTokens.accessToken)
      mockTokenService.signRefreshToken.mockImplementation(() => mockTokens.refreshToken)
      mockTokenService.verifyRefreshToken.mockResolvedValue({
        exp: Math.floor(Date.now() / 1000) + 3600,
        userId: mockUser.id,
      } as any)
      mockAuthRepo.createRefreshToken.mockResolvedValue({} as any)

      // Act - Thực hiện đăng nhập
      const result = await service.login(loginDataWithOTP)

      // Assert - Kiểm tra kết quả
      expect(result).toEqual(mockTokens)
      expect(mockAuthRepo.deleteVerificationCode).toHaveBeenCalledWith({
        email_type: {
          email: mockUser.email,
          type: TypeOfVerificationCode.LOGIN,
        },
      })
    })
  })

  describe('refreshToken', () => {
    const validRefreshTokenData = {
      refreshToken: 'valid-refresh-token',
      userAgent: 'test-agent',
      ip: '127.0.0.1',
    }

    it('should refresh token successfully', async () => {
      // Arrange - Chuẩn bị dữ liệu refresh token hợp lệ
      const mockUser = {
        ...createTestData.user(),
        role: createTestData.role({ id: 1, name: 'CLIENT' }),
      }

      const mockRefreshTokenInDb = {
        token: validRefreshTokenData.refreshToken,
        userId: mockUser.id,
        deviceId: 1,
        expiresAt: new Date(Date.now() + 3600000),
        user: mockUser,
      }

      const mockTokens = createTestData.tokens()
      const decodedToken = {
        userId: mockUser.id,
        exp: Math.floor(Date.now() / 1000) + 3600,
      }

      mockTokenService.verifyRefreshToken.mockResolvedValue(decodedToken as any)
      mockAuthRepo.findUniqueRefreshTokenIncludeUserRole.mockResolvedValue(mockRefreshTokenInDb as any)
      mockAuthRepo.updateDevice.mockResolvedValue({} as any)
      mockAuthRepo.deleteRefreshToken.mockResolvedValue({} as any)
      mockTokenService.signAccessToken.mockImplementation(() => mockTokens.accessToken)
      mockTokenService.signRefreshToken.mockImplementation(() => mockTokens.refreshToken)
      mockAuthRepo.createRefreshToken.mockResolvedValue({} as any)

      // Act - Thực hiện refresh token
      const result = await service.refreshToken(validRefreshTokenData)

      // Assert - Kiểm tra kết quả
      expect(result).toEqual(mockTokens)
      expect(mockAuthRepo.updateDevice).toHaveBeenCalledWith(1, {
        userAgent: validRefreshTokenData.userAgent,
        ip: validRefreshTokenData.ip,
      })
      expect(mockAuthRepo.deleteRefreshToken).toHaveBeenCalledWith({
        token: validRefreshTokenData.refreshToken,
      })
    })

    it('should throw RefreshTokenAlreadyUsedException when token not found in database', async () => {
      // Arrange - Chuẩn bị dữ liệu với token không tồn tại trong DB
      const decodedToken = {
        userId: 1,
        exp: Math.floor(Date.now() / 1000) + 3600,
      }

      mockTokenService.verifyRefreshToken.mockResolvedValue(decodedToken as any)
      mockAuthRepo.findUniqueRefreshTokenIncludeUserRole.mockResolvedValue(null)

      // Act & Assert - Thực hiện test và kiểm tra lỗi
      await expect(service.refreshToken(validRefreshTokenData)).rejects.toThrow(RefreshTokenAlreadyUsedException)
    })

    it('should throw UnauthorizedException when refresh token is expired', async () => {
      // Arrange - Chuẩn bị dữ liệu với token hết hạn
      const expiredError = new JsonWebTokenError('jwt expired')
      expiredError.name = 'TokenExpiredError'

      mockTokenService.verifyRefreshToken.mockRejectedValue(expiredError)

      // Act & Assert - Thực hiện test và kiểm tra lỗi
      await expect(service.refreshToken(validRefreshTokenData)).rejects.toThrow(UnauthorizedException)
      await expect(service.refreshToken(validRefreshTokenData)).rejects.toThrow('Refresh token has expired')
    })

    it('should throw UnauthorizedException when refresh token is invalid', async () => {
      // Arrange - Chuẩn bị dữ liệu với token không hợp lệ
      const invalidError = new JsonWebTokenError('invalid token')

      mockTokenService.verifyRefreshToken.mockRejectedValue(invalidError)

      // Act & Assert - Thực hiện test và kiểm tra lỗi
      await expect(service.refreshToken(validRefreshTokenData)).rejects.toThrow(UnauthorizedException)
      await expect(service.refreshToken(validRefreshTokenData)).rejects.toThrow('Invalid refresh token')
    })

    it('should throw UnauthorizedException for unexpected errors', async () => {
      // Arrange - Chuẩn bị dữ liệu với lỗi không mong đợi
      const unexpectedError = new Error('Unexpected database error')

      mockTokenService.verifyRefreshToken.mockRejectedValue(unexpectedError)

      // Act & Assert - Thực hiện test và kiểm tra lỗi fallback (throw class constructor)
      await expect(service.refreshToken(validRefreshTokenData)).rejects.toThrow(
        "Class constructor UnauthorizedException cannot be invoked without 'new'",
      )
    })
  })

  describe('logout', () => {
    const validRefreshToken = 'valid-refresh-token'

    it('should logout successfully', async () => {
      // Arrange - Chuẩn bị dữ liệu logout hợp lệ
      const mockDeletedRefreshToken = {
        token: validRefreshToken,
        userId: 1,
        deviceId: 1,
        expiresAt: new Date(),
      }

      mockTokenService.verifyRefreshToken.mockResolvedValue({ userId: 1 } as any)
      mockAuthRepo.deleteRefreshToken.mockResolvedValue(mockDeletedRefreshToken as any)
      mockAuthRepo.updateDevice.mockResolvedValue({} as any)

      // Act - Thực hiện logout
      const result = await service.logout(validRefreshToken)

      // Assert - Kiểm tra kết quả
      expect(result).toEqual({ message: 'Đăng xuất thành công' })
      expect(mockAuthRepo.deleteRefreshToken).toHaveBeenCalledWith({ token: validRefreshToken })
      expect(mockAuthRepo.updateDevice).toHaveBeenCalledWith(1, { isActive: false })
    })

    it('should throw UnauthorizedException when refresh token is expired during logout', async () => {
      // Arrange - Chuẩn bị dữ liệu với token hết hạn
      const expiredError = new JsonWebTokenError('jwt expired')
      expiredError.name = 'TokenExpiredError'

      mockTokenService.verifyRefreshToken.mockRejectedValue(expiredError)

      // Act & Assert - Thực hiện test và kiểm tra lỗi
      await expect(service.logout(validRefreshToken)).rejects.toThrow(UnauthorizedException)
      await expect(service.logout(validRefreshToken)).rejects.toThrow('Refresh token has expired')
    })

    it('should throw UnauthorizedException when refresh token is invalid during logout', async () => {
      // Arrange - Chuẩn bị dữ liệu với token không hợp lệ
      const invalidError = new JsonWebTokenError('invalid token')

      mockTokenService.verifyRefreshToken.mockRejectedValue(invalidError)

      // Act & Assert - Thực hiện test và kiểm tra lỗi
      await expect(service.logout(validRefreshToken)).rejects.toThrow(UnauthorizedException)
      await expect(service.logout(validRefreshToken)).rejects.toThrow('Invalid refresh token')
    })

    it('should throw UnauthorizedException when refresh token not found in database', async () => {
      // Arrange - Chuẩn bị dữ liệu với token không tồn tại trong DB
      const notFoundError = new Error('Record not found')
      ;(notFoundError as any).code = 'P2025'

      mockTokenService.verifyRefreshToken.mockResolvedValue({ userId: 1 } as any)
      mockAuthRepo.deleteRefreshToken.mockRejectedValue(notFoundError)
      mockIsNotFoundPrismaError.mockReturnValue(true)

      // Act & Assert - Thực hiện test và kiểm tra lỗi
      await expect(service.logout(validRefreshToken)).rejects.toThrow(UnauthorizedException)
      await expect(service.logout(validRefreshToken)).rejects.toThrow('Refresh token has been used or revoked')
    })

    it('should throw UnauthorizedException for unexpected errors during logout', async () => {
      // Arrange - Chuẩn bị dữ liệu với lỗi không mong đợi
      const unexpectedError = new Error('Database connection failed')

      mockTokenService.verifyRefreshToken.mockResolvedValue({ userId: 1 } as any)
      mockAuthRepo.deleteRefreshToken.mockRejectedValue(unexpectedError)
      mockIsNotFoundPrismaError.mockReturnValue(false)

      // Act & Assert - Thực hiện test và kiểm tra lỗi fallback
      await expect(service.logout(validRefreshToken)).rejects.toThrow(UnauthorizedException)
      await expect(service.logout(validRefreshToken)).rejects.toThrow('An error occurred during logout device')
    })
  })

  describe('forgotPassword', () => {
    const validForgotPasswordData = {
      email: 'test@example.com',
      code: '123456',
      newPassword: 'newPassword123',
      confirmNewPassword: 'newPassword123',
    }

    it('should reset password successfully', async () => {
      // Arrange - Chuẩn bị dữ liệu reset password hợp lệ
      const mockUser = createTestData.user({ email: validForgotPasswordData.email })
      const mockVerificationCode = createTestData.verificationCode({
        email: validForgotPasswordData.email,
        code: validForgotPasswordData.code,
        type: TypeOfVerificationCode.FORGOT_PASSWORD,
        expiresAt: new Date(Date.now() + 60000).toISOString(),
      })

      mockSharedUserRepo.findUnique.mockResolvedValue(mockUser)
      mockAuthRepo.findUniqueVerificationCode.mockResolvedValue(mockVerificationCode)
      mockHashingService.hash.mockResolvedValue('hashedNewPassword')
      mockSharedUserRepo.updateUser.mockResolvedValue({} as any)
      mockAuthRepo.deleteVerificationCode.mockResolvedValue({} as any)

      // Act - Thực hiện reset password
      const result = await service.forgotPassword(validForgotPasswordData)

      // Assert - Kiểm tra kết quả
      expect(result).toEqual({ message: 'Đổi mật khẩu thành công.' })
      expect(mockHashingService.hash).toHaveBeenCalledWith(validForgotPasswordData.newPassword)
      expect(mockSharedUserRepo.updateUser).toHaveBeenCalledWith(
        { id: mockUser.id },
        { password: 'hashedNewPassword', updatedById: mockUser.id },
      )
      expect(mockAuthRepo.deleteVerificationCode).toHaveBeenCalledWith({
        email_type: {
          email: validForgotPasswordData.email,
          type: TypeOfVerificationCode.FORGOT_PASSWORD,
        },
      })
    })

    it('should throw EmailNotFoundException when user does not exist', async () => {
      // Arrange - Chuẩn bị dữ liệu với user không tồn tại
      mockSharedUserRepo.findUnique.mockResolvedValue(null)

      // Act & Assert - Thực hiện test và kiểm tra lỗi
      await expect(service.forgotPassword(validForgotPasswordData)).rejects.toThrow(EmailNotFoundException)
    })
  })

  describe('enableTwoFactorAuth', () => {
    const userId = 1

    it('should enable 2FA successfully', async () => {
      // Arrange - Chuẩn bị dữ liệu enable 2FA
      const mockUser = createTestData.user({ id: userId, totpSecret: null })
      const mockTOTPData = {
        secret: 'JBSWY3DPEHPK3PXP',
        uri: 'otpauth://totp/TestApp:test@example.com?secret=JBSWY3DPEHPK3PXP&issuer=TestApp',
      }

      mockSharedUserRepo.findUnique.mockResolvedValue(mockUser)
      mockTwoFactorService.generateTOTPSecret.mockReturnValue(mockTOTPData)
      mockSharedUserRepo.updateUser.mockResolvedValue({} as any)

      // Act - Thực hiện enable 2FA
      const result = await service.enableTwoFactorAuth(userId)

      // Assert - Kiểm tra kết quả
      expect(result).toEqual(mockTOTPData)
      expect(mockTwoFactorService.generateTOTPSecret).toHaveBeenCalledWith(mockUser.email)
      expect(mockSharedUserRepo.updateUser).toHaveBeenCalledWith(
        { id: userId },
        { totpSecret: mockTOTPData.secret, updatedById: userId },
      )
    })

    it('should throw EmailNotFoundException when user does not exist', async () => {
      // Arrange - Chuẩn bị dữ liệu với user không tồn tại
      mockSharedUserRepo.findUnique.mockResolvedValue(null)

      // Act & Assert - Thực hiện test và kiểm tra lỗi
      await expect(service.enableTwoFactorAuth(userId)).rejects.toThrow(EmailNotFoundException)
    })

    it('should throw TOTPAlreadyEnabledException when 2FA is already enabled', async () => {
      // Arrange - Chuẩn bị dữ liệu với 2FA đã được bật
      const mockUser = createTestData.user({ id: userId, totpSecret: 'existing-secret' })

      mockSharedUserRepo.findUnique.mockResolvedValue(mockUser)

      // Act & Assert - Thực hiện test và kiểm tra lỗi
      await expect(service.enableTwoFactorAuth(userId)).rejects.toThrow(TOTPAlreadyEnabledException)
    })
  })

  describe('disableTwoFactorAuth', () => {
    const userId = 1

    it('should disable 2FA successfully with TOTP code', async () => {
      // Arrange - Chuẩn bị dữ liệu disable 2FA với TOTP code
      const disableData = {
        userId,
        totpCode: '123456',
      }

      const mockUser = createTestData.user({ id: userId, totpSecret: 'secret123' })

      mockSharedUserRepo.findUnique.mockResolvedValue(mockUser)
      mockTwoFactorService.verifyTOTP.mockReturnValue(true)
      mockSharedUserRepo.updateUser.mockResolvedValue({} as any)

      // Act - Thực hiện disable 2FA
      const result = await service.disableTwoFactorAuth(disableData)

      // Assert - Kiểm tra kết quả
      expect(result).toEqual({ message: 'Tắt 2FA thành công' })
      expect(mockTwoFactorService.verifyTOTP).toHaveBeenCalledWith({
        email: mockUser.email,
        secret: mockUser.totpSecret,
        token: disableData.totpCode,
      })
      expect(mockSharedUserRepo.updateUser).toHaveBeenCalledWith(
        { id: userId },
        { totpSecret: null, updatedById: userId },
      )
    })

    it('should disable 2FA successfully with OTP code', async () => {
      // Arrange - Chuẩn bị dữ liệu disable 2FA với OTP code
      const disableData = {
        userId,
        code: '123456',
      }

      const mockUser = createTestData.user({ id: userId, totpSecret: 'secret123' })
      const mockVerificationCode = createTestData.verificationCode({
        email: mockUser.email,
        code: disableData.code,
        type: TypeOfVerificationCode.DISABLE_2FA,
      })

      mockSharedUserRepo.findUnique.mockResolvedValue(mockUser)
      mockAuthRepo.findUniqueVerificationCode.mockResolvedValue(mockVerificationCode)
      mockSharedUserRepo.updateUser.mockResolvedValue({} as any)

      // Act - Thực hiện disable 2FA
      const result = await service.disableTwoFactorAuth(disableData)

      // Assert - Kiểm tra kết quả
      expect(result).toEqual({ message: 'Tắt 2FA thành công' })
      expect(mockAuthRepo.findUniqueVerificationCode).toHaveBeenCalledWith({
        email_type: {
          email: mockUser.email,
          type: TypeOfVerificationCode.DISABLE_2FA,
        },
      })
    })

    it('should throw EmailNotFoundException when user does not exist', async () => {
      // Arrange - Chuẩn bị dữ liệu với user không tồn tại
      const disableData = { userId, totpCode: '123456' }

      mockSharedUserRepo.findUnique.mockResolvedValue(null)

      // Act & Assert - Thực hiện test và kiểm tra lỗi
      await expect(service.disableTwoFactorAuth(disableData)).rejects.toThrow(EmailNotFoundException)
    })

    it('should throw TOTPNotEnabledException when 2FA is not enabled', async () => {
      // Arrange - Chuẩn bị dữ liệu với 2FA chưa được bật
      const disableData = { userId, totpCode: '123456' }
      const mockUser = createTestData.user({ id: userId, totpSecret: null })

      mockSharedUserRepo.findUnique.mockResolvedValue(mockUser)

      // Act & Assert - Thực hiện test và kiểm tra lỗi
      await expect(service.disableTwoFactorAuth(disableData)).rejects.toThrow(TOTPNotEnabledException)
    })

    it('should throw InvalidTOTPException when TOTP code is invalid', async () => {
      // Arrange - Chuẩn bị dữ liệu với TOTP code không hợp lệ
      const disableData = { userId, totpCode: '999999' }
      const mockUser = createTestData.user({ id: userId, totpSecret: 'secret123' })

      mockSharedUserRepo.findUnique.mockResolvedValue(mockUser)
      mockTwoFactorService.verifyTOTP.mockReturnValue(false)

      // Act & Assert - Thực hiện test và kiểm tra lỗi
      await expect(service.disableTwoFactorAuth(disableData)).rejects.toThrow(InvalidTOTPException)
    })

    it('should throw InvalidOTPException when OTP code not found for disable 2FA', async () => {
      const disableData = { userId, code: '123456' }
      const mockUser = createTestData.user({ id: userId, totpSecret: 'secret123' })

      mockSharedUserRepo.findUnique.mockResolvedValue(mockUser)
      mockAuthRepo.findUniqueVerificationCode.mockResolvedValue(null)

      await expect(service.disableTwoFactorAuth(disableData)).rejects.toThrow(InvalidOTPException)
    })
  })

  describe('Edge Cases', () => {
    describe('refreshToken - remainingTime expired', () => {
      const validRefreshTokenData = {
        refreshToken: 'valid-refresh-token',
        userAgent: 'test-agent',
        ip: '127.0.0.1',
      }

      it('should throw UnauthorizedException when remaining time is zero', async () => {
        const mockUser = {
          ...createTestData.user(),
          role: createTestData.role({ id: 1, name: 'CLIENT' }),
        }
        const mockRefreshTokenInDb = {
          token: validRefreshTokenData.refreshToken,
          userId: mockUser.id,
          deviceId: 1,
          expiresAt: new Date(Date.now() + 3600000),
          user: mockUser,
        }
        const decodedToken = {
          userId: mockUser.id,
          exp: Math.floor(Date.now() / 1000) - 1, // expired 1 second ago
        }

        mockTokenService.verifyRefreshToken.mockResolvedValue(decodedToken as any)
        mockAuthRepo.findUniqueRefreshTokenIncludeUserRole.mockResolvedValue(mockRefreshTokenInDb as any)
        mockAuthRepo.deleteRefreshToken.mockResolvedValue({} as any)

        await expect(service.refreshToken(validRefreshTokenData)).rejects.toThrow(UnauthorizedException)
        await expect(service.refreshToken(validRefreshTokenData)).rejects.toThrow('Refresh token has expired')
        expect(mockAuthRepo.deleteRefreshToken).toHaveBeenCalledWith({
          token: validRefreshTokenData.refreshToken,
        })
      })
    })

    describe('forgotPassword - invalid OTP', () => {
      const validForgotPasswordData = {
        email: 'test@example.com',
        code: '123456',
        newPassword: 'newPassword123',
        confirmNewPassword: 'newPassword123',
      }

      it('should throw InvalidOTPException when OTP code not found', async () => {
        const mockUser = createTestData.user({ email: validForgotPasswordData.email })
        mockSharedUserRepo.findUnique.mockResolvedValue(mockUser)
        mockAuthRepo.findUniqueVerificationCode.mockResolvedValue(null)

        await expect(service.forgotPassword(validForgotPasswordData)).rejects.toThrow(InvalidOTPException)
      })

      it('should throw OTPExpiredException when OTP is expired', async () => {
        const mockUser = createTestData.user({ email: validForgotPasswordData.email })
        const expiredVerificationCode = createTestData.verificationCode({
          email: validForgotPasswordData.email,
          code: validForgotPasswordData.code,
          type: TypeOfVerificationCode.FORGOT_PASSWORD,
          expiresAt: new Date(Date.now() - 60000).toISOString(), // expired 1 minute ago
        })

        mockSharedUserRepo.findUnique.mockResolvedValue(mockUser)
        mockAuthRepo.findUniqueVerificationCode.mockResolvedValue(expiredVerificationCode)

        await expect(service.forgotPassword(validForgotPasswordData)).rejects.toThrow(OTPExpiredException)
      })
    })

    describe('login - 2FA with OTP code and expired OTP', () => {
      it('should throw OTPExpiredException when OTP code is expired during 2FA login', async () => {
        const loginData = {
          email: 'test@example.com',
          password: 'password123',
          code: '123456',
          userAgent: 'test-agent',
          ip: '127.0.0.1',
        }
        const mockUser = {
          ...createTestData.user({ totpSecret: 'secret123' }),
          role: createTestData.role(),
        }
        const expiredVerificationCode = createTestData.verificationCode({
          expiresAt: new Date(Date.now() - 60000).toISOString(),
        })

        mockAuthRepo.findUniqueUserIncludeRole.mockResolvedValue(mockUser as any)
        mockHashingService.compare.mockResolvedValue(true)
        mockAuthRepo.findUniqueVerificationCode.mockResolvedValue(expiredVerificationCode)

        await expect(service.login(loginData)).rejects.toThrow(OTPExpiredException)
      })

      it('should throw InvalidOTPException when OTP code not found during 2FA login', async () => {
        const loginData = {
          email: 'test@example.com',
          password: 'password123',
          code: '123456',
          userAgent: 'test-agent',
          ip: '127.0.0.1',
        }
        const mockUser = {
          ...createTestData.user({ totpSecret: 'secret123' }),
          role: createTestData.role(),
        }

        mockAuthRepo.findUniqueUserIncludeRole.mockResolvedValue(mockUser as any)
        mockHashingService.compare.mockResolvedValue(true)
        mockAuthRepo.findUniqueVerificationCode.mockResolvedValue(null)

        await expect(service.login(loginData)).rejects.toThrow(InvalidOTPException)
      })
    })

    describe('sendOTP - edge cases', () => {
      it('should throw EmailAlreadyExistsException when registering with existing email', async () => {
        const body = { email: 'existing@example.com', type: TypeOfVerificationCode.REGISTER as any }
        mockSharedUserRepo.findUnique.mockResolvedValue(createTestData.user({ email: body.email }))

        await expect(service.sendOTP(body)).rejects.toThrow(EmailAlreadyExistsException)
      })

      it('should throw EmailNotFoundException when forgot password for non-existent email', async () => {
        const body = { email: 'nonexistent@example.com', type: TypeOfVerificationCode.FORGOT_PASSWORD as any }
        mockSharedUserRepo.findUnique.mockResolvedValue(null)

        await expect(service.sendOTP(body)).rejects.toThrow(EmailNotFoundException)
      })
    })

    describe('register - concurrent/duplicate registration', () => {
      it('should throw EmailAlreadyExistsException when concurrent register creates duplicate', async () => {
        const body = {
          email: 'test@example.com',
          name: 'Test',
          phoneNumber: '0123456789',
          password: 'password123',
          confirmPassword: 'password123',
          code: '123456',
        }
        const mockVerificationCode = createTestData.verificationCode()
        mockAuthRepo.findUniqueVerificationCode.mockResolvedValue(mockVerificationCode)
        mockSharedRoleRepo.getClientRoleId.mockResolvedValue(2)
        mockHashingService.hash.mockResolvedValue('hashedPassword')
        const prismaError = new Error('Unique constraint failed')
        mockAuthRepo.createUser.mockRejectedValue(prismaError)
        mockAuthRepo.deleteVerificationCode.mockResolvedValue({} as any)
        mockIsUniqueConstraintPrismaError.mockReturnValue(true)

        await expect(service.register(body)).rejects.toThrow(EmailAlreadyExistsException)
      })

      it('should rethrow non-unique-constraint errors during register', async () => {
        const body = {
          email: 'test@example.com',
          name: 'Test',
          phoneNumber: '0123456789',
          password: 'password123',
          confirmPassword: 'password123',
          code: '123456',
        }
        const mockVerificationCode = createTestData.verificationCode()
        mockAuthRepo.findUniqueVerificationCode.mockResolvedValue(mockVerificationCode)
        mockSharedRoleRepo.getClientRoleId.mockResolvedValue(2)
        mockHashingService.hash.mockResolvedValue('hashedPassword')
        const dbError = new Error('Database connection lost')
        mockAuthRepo.createUser.mockRejectedValue(dbError)
        mockAuthRepo.deleteVerificationCode.mockResolvedValue({} as any)
        mockIsUniqueConstraintPrismaError.mockReturnValue(false)

        await expect(service.register(body)).rejects.toThrow('Database connection lost')
      })
    })

    describe('login - edge cases with validate2FA', () => {
      it('should throw TOTPNotEnabledException when user sends totpCode but 2FA not enabled', async () => {
        const loginData = {
          email: 'test@example.com',
          password: 'password123',
          totpCode: '123456',
          userAgent: 'test-agent',
          ip: '127.0.0.1',
        }
        const mockUser = {
          ...createTestData.user({ totpSecret: null }),
          role: createTestData.role(),
        }
        mockAuthRepo.findUniqueUserIncludeRole.mockResolvedValue(mockUser as any)
        mockHashingService.compare.mockResolvedValue(true)

        await expect(service.login(loginData)).rejects.toThrow(TOTPNotEnabledException)
      })

      it('should throw TOTPNotEnabledException when user sends OTP code but 2FA not enabled', async () => {
        const loginData = {
          email: 'test@example.com',
          password: 'password123',
          code: '123456',
          userAgent: 'test-agent',
          ip: '127.0.0.1',
        }
        const mockUser = {
          ...createTestData.user({ totpSecret: null }),
          role: createTestData.role(),
        }
        mockAuthRepo.findUniqueUserIncludeRole.mockResolvedValue(mockUser as any)
        mockHashingService.compare.mockResolvedValue(true)

        await expect(service.login(loginData)).rejects.toThrow(TOTPNotEnabledException)
      })
    })

    describe('logout - edge cases', () => {
      it('should throw UnauthorizedException when refresh token not found in DB (revoked)', async () => {
        const refreshToken = 'revoked-token'
        mockTokenService.verifyRefreshToken.mockResolvedValue({ userId: 1 } as any)
        const prismaNotFoundError = new Error('Record not found')
        mockAuthRepo.deleteRefreshToken.mockRejectedValue(prismaNotFoundError)
        mockIsNotFoundPrismaError.mockReturnValue(true)

        await expect(service.logout(refreshToken)).rejects.toThrow(UnauthorizedException)
        await expect(service.logout(refreshToken)).rejects.toThrow('Refresh token has been used or revoked')
      })
    })

    describe('enableTwoFactorAuth - edge cases', () => {
      it('should throw EmailNotFoundException when user not found for enable 2FA', async () => {
        mockSharedUserRepo.findUnique.mockResolvedValue(null)

        await expect(service.enableTwoFactorAuth(999)).rejects.toThrow(EmailNotFoundException)
      })

      it('should throw TOTPAlreadyEnabledException when 2FA already enabled', async () => {
        const mockUser = createTestData.user({ totpSecret: 'existing-secret' })
        mockSharedUserRepo.findUnique.mockResolvedValue(mockUser)

        await expect(service.enableTwoFactorAuth(1)).rejects.toThrow(TOTPAlreadyEnabledException)
      })
    })

    describe('disableTwoFactorAuth - edge cases', () => {
      it('should throw EmailNotFoundException when user not found for disable 2FA', async () => {
        mockSharedUserRepo.findUnique.mockResolvedValue(null)

        await expect(service.disableTwoFactorAuth({ userId: 999, totpCode: '123456' })).rejects.toThrow(
          EmailNotFoundException,
        )
      })

      it('should throw TOTPNotEnabledException when 2FA not enabled for disable', async () => {
        const mockUser = createTestData.user({ totpSecret: null })
        mockSharedUserRepo.findUnique.mockResolvedValue(mockUser)

        await expect(service.disableTwoFactorAuth({ userId: 1, totpCode: '123456' })).rejects.toThrow(
          TOTPNotEnabledException,
        )
      })

      it('should throw InvalidTOTPException when TOTP code is wrong during disable', async () => {
        const mockUser = createTestData.user({ totpSecret: 'secret123' })
        mockSharedUserRepo.findUnique.mockResolvedValue(mockUser)
        mockTwoFactorService.verifyTOTP.mockReturnValue(false)

        await expect(service.disableTwoFactorAuth({ userId: 1, totpCode: 'wrong' })).rejects.toThrow(
          InvalidTOTPException,
        )
      })
    })
  })
})
