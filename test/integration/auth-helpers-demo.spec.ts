import { CACHE_MANAGER } from '@nestjs/cache-manager'
import { INestApplication } from '@nestjs/common'
import { Test, TestingModule } from '@nestjs/testing'
import request from 'supertest'
import { AppModule } from '../../src/app.module'
import { TypeOfVerificationCode } from '../../src/shared/constants/auth.constant'
import { EmailService } from '../../src/shared/services/email.service'
import { PrismaService } from '../../src/shared/services/prisma.service'
import {
  countUserDevices,
  countUserRefreshTokens,
  createAuthenticatedUser,
  createExpiredOTP,
  createUserDirectly,
  createUserWith2FA,
  enable2FA,
  resetDatabase,
  sendOTPAndGetCode,
  verifyDeviceIsActive,
  verifyOTPDeleted,
  verifyPasswordChanged,
  verifyRefreshTokenExists,
  verifyUserHas2FA,
} from '../helpers/test-helpers'

/**
 * DEMO: Auth Helpers Integration Tests
 *
 * Mục đích: Test các helper functions để đảm bảo chúng hoạt động đúng
 * trước khi sử dụng trong các integration tests thực tế
 */
describe('Auth Helpers Demo', () => {
  let app: INestApplication
  let prisma: PrismaService

  // Mock EmailService
  const mockEmailService = {
    sendOTP: jest.fn().mockResolvedValue({
      data: { id: 'test-email-id' },
      error: null,
    }),
  }

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue(global.__GLOBAL_PRISMA__)
      .overrideProvider(EmailService)
      .useValue(mockEmailService)
      .overrideProvider(CACHE_MANAGER)
      .useValue({
        get: jest.fn().mockResolvedValue(null),
        set: jest.fn().mockResolvedValue(undefined),
        del: jest.fn().mockResolvedValue(undefined),
      })
      .compile()

    app = moduleFixture.createNestApplication()
    prisma = moduleFixture.get<PrismaService>(PrismaService)

    await app.init()
  })

  beforeEach(async () => {
    await resetDatabase()
  })

  afterAll(async () => {
    await app.close()
  })

  // ==================== TEST HELPERS ====================

  describe('createAuthenticatedUser', () => {
    it('should create user and return tokens', async () => {
      const { userId, accessToken, refreshToken, deviceId } = await createAuthenticatedUser(
        app,
        'test@example.com',
        'password123',
      )

      expect(userId).toBeDefined()
      expect(accessToken).toBeDefined()
      expect(refreshToken).toBeDefined()
      expect(deviceId).toBeDefined()

      // Verify user exists in database
      const user = await prisma.user.findUnique({ where: { id: userId } })
      expect(user).toBeDefined()
      expect(user?.email).toBe('test@example.com')
    })
  })

  describe('enable2FA', () => {
    it('should enable 2FA and return secret + TOTP code', async () => {
      const { accessToken, userId } = await createAuthenticatedUser(app, 'test2fa@example.com', 'password123')

      const { secret, uri, totpCode } = await enable2FA(app, accessToken)

      expect(secret).toBeDefined()
      expect(uri).toContain('otpauth://totp/')
      expect(totpCode).toHaveLength(6)

      // Verify user has 2FA enabled
      const has2FA = await verifyUserHas2FA(userId)
      expect(has2FA).toBe(true)
    })
  })

  describe('sendOTPAndGetCode', () => {
    it('should send OTP and return code from database', async () => {
      const email = 'testotp@example.com'
      const code = await sendOTPAndGetCode(app, email, TypeOfVerificationCode.REGISTER)

      expect(code).toHaveLength(6)

      // Verify OTP exists in database
      const verificationCode = await prisma.verificationCode.findUnique({
        where: {
          email_type: { email, type: TypeOfVerificationCode.REGISTER },
        },
      })

      expect(verificationCode).toBeDefined()
      expect(verificationCode?.code).toBe(code)
    })
  })

  describe('createExpiredOTP', () => {
    it('should create expired OTP in database', async () => {
      const email = 'expired@example.com'
      const code = await createExpiredOTP(email, TypeOfVerificationCode.REGISTER)

      const verificationCode = await prisma.verificationCode.findUnique({
        where: {
          email_type: { email, type: TypeOfVerificationCode.REGISTER },
        },
      })

      expect(verificationCode).toBeDefined()
      expect(verificationCode!.expiresAt.getTime()).toBeLessThan(Date.now())
    })
  })

  describe('Verification Helpers', () => {
    it('should verify refresh token exists', async () => {
      const { refreshToken } = await createAuthenticatedUser(app, 'testtoken@example.com', 'password123')

      const exists = await verifyRefreshTokenExists(refreshToken)
      expect(exists).toBe(true)
    })

    it('should verify device is active', async () => {
      const { deviceId } = await createAuthenticatedUser(app, 'testdevice@example.com', 'password123')

      const isActive = await verifyDeviceIsActive(deviceId)
      expect(isActive).toBe(true)
    })
  })
})
