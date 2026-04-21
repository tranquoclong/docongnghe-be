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
    id: 1, name: 'CLIENT', description: 'Client role', isActive: true,
    createdById: null, updatedById: null, deletedById: null, deletedAt: null,
    createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), permissions: [],
    ...overrides,
  }),
}
describe('AuthService — Edge Cases', () => {
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
    mockHashingService = { hash: jest.fn(), compare: jest.fn() } as any
    mockTokenService = {
      signAccessToken: jest.fn(),
      signRefreshToken: jest.fn(),
      verifyAccessToken: jest.fn(),
      verifyRefreshToken: jest.fn(),
    } as any
    mockEmailService = { sendOTP: jest.fn() } as any
    mockTwoFactorService = { verifyTOTP: jest.fn(), generateTOTPSecret: jest.fn() } as any
    mockSharedUserRepo = { findUnique: jest.fn(), updateUser: jest.fn() } as any
    mockSharedRoleRepo = { getClientRoleId: jest.fn() } as any

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
    if (module) await module.close()
  })

  describe('register — edge cases', () => {
    const validData = {
      email: 'test@example.com', name: 'Test', phoneNumber: '0123456789',
      password: 'pass123', confirmPassword: 'pass123', code: '123456',
    }

    it('should throw EmailAlreadyExistsException when registering with existing email', async () => {
      const vc = createTestData.verificationCode({ expiresAt: new Date(Date.now() + 60000).toISOString() })
      mockAuthRepo.findUniqueVerificationCode.mockResolvedValue(vc)
      mockSharedRoleRepo.getClientRoleId.mockResolvedValue(1)
      mockHashingService.hash.mockResolvedValue('hashed')
      const uniqueError = new Error('Unique constraint failed')
      ;(uniqueError as any).code = 'P2002'
      mockAuthRepo.createUser.mockRejectedValue(uniqueError)
      mockIsUniqueConstraintPrismaError.mockReturnValue(true)

      await expect(service.register(validData)).rejects.toThrow(EmailAlreadyExistsException)
    })

    it('should throw InvalidOTPException when OTP code not found during register', async () => {
      mockAuthRepo.findUniqueVerificationCode.mockResolvedValue(null)
      await expect(service.register(validData)).rejects.toThrow()
    })

    it('should throw OTPExpiredException when OTP is expired during register', async () => {
      const expiredVc = createTestData.verificationCode({
        expiresAt: new Date(Date.now() - 60000).toISOString(),
      })
      mockAuthRepo.findUniqueVerificationCode.mockResolvedValue(expiredVc)
      await expect(service.register(validData)).rejects.toThrow()
    })
  })

  describe('sendOTP — edge cases', () => {
    it('should throw EmailAlreadyExistsException when REGISTER type and user exists', async () => {
      mockSharedUserRepo.findUnique.mockResolvedValue(createTestData.user())
      await expect(
        service.sendOTP({ email: 'test@example.com', type: TypeOfVerificationCode.REGISTER }),
      ).rejects.toThrow(EmailAlreadyExistsException)
    })

    it('should throw EmailNotFoundException when FORGOT_PASSWORD type and user not found', async () => {
      mockSharedUserRepo.findUnique.mockResolvedValue(null)
      await expect(
        service.sendOTP({ email: 'none@example.com', type: TypeOfVerificationCode.FORGOT_PASSWORD }),
      ).rejects.toThrow(EmailNotFoundException)
    })

    it('should throw FailedToSendOTPException when email service returns error', async () => {
      mockSharedUserRepo.findUnique.mockResolvedValue(null)
      mockAuthRepo.createVerificationCode.mockResolvedValue(createTestData.verificationCode())
      mockEmailService.sendOTP.mockResolvedValue({ data: null, error: { message: 'fail', name: 'err' } } as any)

      await expect(
        service.sendOTP({ email: 'new@example.com', type: TypeOfVerificationCode.REGISTER }),
      ).rejects.toThrow(FailedToSendOTPException)
    })
  })

  describe('login — 2FA edge cases', () => {
    const loginData = { email: 'test@example.com', password: 'pass123', userAgent: 'agent', ip: '127.0.0.1' }
    const userWith2FA = {
      ...createTestData.user(), totpSecret: 'secret123',
      role: createTestData.role({ id: 1, name: 'CLIENT' }),
    }

    it('should throw InvalidPasswordException when password is wrong', async () => {
      mockAuthRepo.findUniqueUserIncludeRole.mockResolvedValue(userWith2FA as any)
      mockHashingService.compare.mockResolvedValue(false)
      await expect(service.login(loginData)).rejects.toThrow(InvalidPasswordException)
    })

    it('should throw EmailNotFoundException when user does not exist', async () => {
      mockAuthRepo.findUniqueUserIncludeRole.mockResolvedValue(null)
      await expect(service.login(loginData)).rejects.toThrow(EmailNotFoundException)
    })

    it('should throw InvalidTOTPException when TOTP code is invalid', async () => {
      mockAuthRepo.findUniqueUserIncludeRole.mockResolvedValue(userWith2FA as any)
      mockHashingService.compare.mockResolvedValue(true)
      mockTwoFactorService.verifyTOTP.mockReturnValue(false)
      await expect(service.login({ ...loginData, totpCode: '999999' })).rejects.toThrow(InvalidTOTPException)
    })

    it('should throw TOTPNotEnabledException when user sends totpCode but 2FA not enabled', async () => {
      const userNo2FA = { ...createTestData.user(), totpSecret: null, role: createTestData.role() }
      mockAuthRepo.findUniqueUserIncludeRole.mockResolvedValue(userNo2FA as any)
      mockHashingService.compare.mockResolvedValue(true)
      await expect(service.login({ ...loginData, totpCode: '123456' })).rejects.toThrow(TOTPNotEnabledException)
    })

    it('should throw when 2FA enabled but neither totpCode nor code provided', async () => {
      mockAuthRepo.findUniqueUserIncludeRole.mockResolvedValue(userWith2FA as any)
      mockHashingService.compare.mockResolvedValue(true)
      await expect(service.login(loginData)).rejects.toThrow()
    })

    it('should throw when login OTP code is expired', async () => {
      const expiredVc = createTestData.verificationCode({
        type: TypeOfVerificationCode.LOGIN,
        expiresAt: new Date(Date.now() - 60000).toISOString(),
      })
      mockAuthRepo.findUniqueUserIncludeRole.mockResolvedValue(userWith2FA as any)
      mockHashingService.compare.mockResolvedValue(true)
      mockAuthRepo.findUniqueVerificationCode.mockResolvedValue(expiredVc)
      await expect(service.login({ ...loginData, code: '123456' })).rejects.toThrow()
    })

    it('should throw when login OTP code not found', async () => {
      mockAuthRepo.findUniqueUserIncludeRole.mockResolvedValue(userWith2FA as any)
      mockHashingService.compare.mockResolvedValue(true)
      mockAuthRepo.findUniqueVerificationCode.mockResolvedValue(null)
      await expect(service.login({ ...loginData, code: '123456' })).rejects.toThrow()
    })
  })

  describe('refreshToken — edge cases', () => {
    const refreshData = { refreshToken: 'valid-token', userAgent: 'agent', ip: '127.0.0.1' }

    it('should throw RefreshTokenAlreadyUsedException when token not in DB', async () => {
      mockTokenService.verifyRefreshToken.mockResolvedValue({ userId: 1, exp: Math.floor(Date.now() / 1000) + 3600 } as any)
      mockAuthRepo.findUniqueRefreshTokenIncludeUserRole.mockResolvedValue(null)
      await expect(service.refreshToken(refreshData)).rejects.toThrow(RefreshTokenAlreadyUsedException)
    })

    it('should throw UnauthorizedException when refresh token expired (JWT)', async () => {
      const expiredError = new JsonWebTokenError('jwt expired')
      expiredError.name = 'TokenExpiredError'
      mockTokenService.verifyRefreshToken.mockRejectedValue(expiredError)
      await expect(service.refreshToken(refreshData)).rejects.toThrow(UnauthorizedException)
    })

    it('should throw UnauthorizedException when refresh token is invalid (JWT)', async () => {
      mockTokenService.verifyRefreshToken.mockRejectedValue(new JsonWebTokenError('invalid token'))
      await expect(service.refreshToken(refreshData)).rejects.toThrow(UnauthorizedException)
    })

    it('should throw when remaining time is <= 0', async () => {
      const pastExp = Math.floor(Date.now() / 1000) - 10
      mockTokenService.verifyRefreshToken.mockResolvedValue({ userId: 1, exp: pastExp } as any)
      const mockUser = { ...createTestData.user(), role: createTestData.role() }
      mockAuthRepo.findUniqueRefreshTokenIncludeUserRole.mockResolvedValue({
        token: 'valid-token', userId: 1, deviceId: 1, expiresAt: new Date(), user: mockUser,
      } as any)
      mockAuthRepo.deleteRefreshToken.mockResolvedValue({} as any)
      await expect(service.refreshToken(refreshData)).rejects.toThrow(UnauthorizedException)
    })
  })

  describe('logout — edge cases', () => {
    it('should throw UnauthorizedException when token expired during logout', async () => {
      const expiredError = new JsonWebTokenError('jwt expired')
      expiredError.name = 'TokenExpiredError'
      mockTokenService.verifyRefreshToken.mockRejectedValue(expiredError)
      await expect(service.logout('expired-token')).rejects.toThrow('Refresh token has expired')
    })

    it('should throw UnauthorizedException when token already used/revoked', async () => {
      const notFoundError = new Error('Record not found')
      ;(notFoundError as any).code = 'P2025'
      mockTokenService.verifyRefreshToken.mockResolvedValue({ userId: 1 } as any)
      mockAuthRepo.deleteRefreshToken.mockRejectedValue(notFoundError)
      mockIsNotFoundPrismaError.mockReturnValue(true)
      await expect(service.logout('used-token')).rejects.toThrow('Refresh token has been used or revoked')
    })

    it('should throw generic UnauthorizedException for unexpected logout errors', async () => {
      mockTokenService.verifyRefreshToken.mockResolvedValue({ userId: 1 } as any)
      mockAuthRepo.deleteRefreshToken.mockRejectedValue(new Error('DB error'))
      mockIsNotFoundPrismaError.mockReturnValue(false)
      await expect(service.logout('token')).rejects.toThrow('An error occurred during logout device')
    })
  })

  describe('forgotPassword — edge cases', () => {
    it('should throw EmailNotFoundException when user not found', async () => {
      mockSharedUserRepo.findUnique.mockResolvedValue(null)
      await expect(service.forgotPassword({
        email: 'none@example.com', code: '123456', newPassword: 'new', confirmNewPassword: 'new',
      })).rejects.toThrow(EmailNotFoundException)
    })

    it('should throw when OTP is expired during forgot password', async () => {
      mockSharedUserRepo.findUnique.mockResolvedValue(createTestData.user())
      mockAuthRepo.findUniqueVerificationCode.mockResolvedValue(
        createTestData.verificationCode({ expiresAt: new Date(Date.now() - 60000).toISOString(), type: TypeOfVerificationCode.FORGOT_PASSWORD }),
      )
      await expect(service.forgotPassword({
        email: 'test@example.com', code: '123456', newPassword: 'new', confirmNewPassword: 'new',
      })).rejects.toThrow()
    })

    it('should throw when OTP not found during forgot password', async () => {
      mockSharedUserRepo.findUnique.mockResolvedValue(createTestData.user())
      mockAuthRepo.findUniqueVerificationCode.mockResolvedValue(null)
      await expect(service.forgotPassword({
        email: 'test@example.com', code: '123456', newPassword: 'new', confirmNewPassword: 'new',
      })).rejects.toThrow()
    })
  })

  describe('enableTwoFactorAuth — edge cases', () => {
    it('should throw EmailNotFoundException when user not found', async () => {
      mockSharedUserRepo.findUnique.mockResolvedValue(null)
      await expect(service.enableTwoFactorAuth(999)).rejects.toThrow(EmailNotFoundException)
    })

    it('should throw TOTPAlreadyEnabledException when 2FA already enabled', async () => {
      mockSharedUserRepo.findUnique.mockResolvedValue(createTestData.user({ totpSecret: 'existing' }))
      await expect(service.enableTwoFactorAuth(1)).rejects.toThrow(TOTPAlreadyEnabledException)
    })
  })

  describe('disableTwoFactorAuth — edge cases', () => {
    it('should throw TOTPNotEnabledException when 2FA not enabled', async () => {
      mockSharedUserRepo.findUnique.mockResolvedValue(createTestData.user({ totpSecret: null }))
      await expect(service.disableTwoFactorAuth({ userId: 1, totpCode: '123456' })).rejects.toThrow(TOTPNotEnabledException)
    })

    it('should throw InvalidTOTPException when TOTP code is invalid during disable', async () => {
      mockSharedUserRepo.findUnique.mockResolvedValue(createTestData.user({ totpSecret: 'secret' }))
      mockTwoFactorService.verifyTOTP.mockReturnValue(false)
      await expect(service.disableTwoFactorAuth({ userId: 1, totpCode: '999999' })).rejects.toThrow(InvalidTOTPException)
    })

    it('should throw InvalidOTPException when OTP code not found during disable', async () => {
      mockSharedUserRepo.findUnique.mockResolvedValue(createTestData.user({ totpSecret: 'secret' }))
      mockAuthRepo.findUniqueVerificationCode.mockResolvedValue(null)
      await expect(service.disableTwoFactorAuth({ userId: 1, code: '123456' })).rejects.toThrow()
    })

    it('should throw EmailNotFoundException when user not found during disable', async () => {
      mockSharedUserRepo.findUnique.mockResolvedValue(null)
      await expect(service.disableTwoFactorAuth({ userId: 999, totpCode: '123456' })).rejects.toThrow(EmailNotFoundException)
    })
  })
})
