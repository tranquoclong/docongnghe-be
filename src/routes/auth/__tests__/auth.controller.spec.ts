import { Test, TestingModule } from '@nestjs/testing'
import { Response } from 'express'
import { UserStatus } from 'src/shared/constants/auth.constant'
import { AuthController } from '../auth.controller'
import { AuthService } from '../auth.service'
import { GoogleService } from '../google.service'

/**
 * AUTH CONTROLLER UNIT TESTS
 *
 * Module này test authentication controller cho Auth module
 * Đây là module CRITICAL vì handle tất cả authentication endpoints
 *
 * Test Coverage:
 * - POST /auth/register - User registration với OTP verification
 * - POST /auth/otp - Send OTP code
 * - POST /auth/login - Login với/không 2FA
 * - POST /auth/refresh-token - Refresh access token
 * - POST /auth/logout - Logout và invalidate tokens
 * - POST /auth/forgot-password - Forgot password flow
 * - POST /auth/2fa/enable - Enable 2FA
 * - POST /auth/2fa/disable - Disable 2FA
 * - GET /auth/google-link - Get Google OAuth URL
 * - GET /auth/google/callback - Handle Google OAuth callback
 */

describe('AuthController', () => {
  let controller: AuthController
  let mockAuthService: jest.Mocked<AuthService>
  let mockGoogleService: jest.Mocked<GoogleService>

  // ===== TEST DATA FACTORIES =====

  const createMockUser = (overrides = {}) => ({
    id: 1,
    email: 'test@example.com',
    name: 'Test User',
    phoneNumber: '0123456789',
    avatar: null,
    roleId: 2,
    status: UserStatus.ACTIVE,
    totpSecret: null,
    totpEnabled: false,
    createdById: null,
    updatedById: null,
    deletedById: null,
    deletedAt: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    isActive: true,
    ...overrides,
  })

  const createMockTokens = (overrides = {}) => ({
    accessToken: 'mock-access-token-123',
    refreshToken: 'mock-refresh-token-456',
    ...overrides,
  })

  const createMockMessageResponse = (message = 'Success') => ({
    message,
  })

  const createMockTwoFactorResponse = (overrides = {}) => ({
    secret: 'JBSWY3DPEHPK3PXP',
    uri: 'otpauth://totp/Ecommerce:test@example.com?secret=JBSWY3DPEHPK3PXP&issuer=Ecommerce',
    ...overrides,
  })

  const createMockResponse = (): Partial<Response> => ({
    redirect: jest.fn().mockReturnThis(),
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  })

  beforeEach(async () => {
    // Mock AuthService
    mockAuthService = {
      register: jest.fn(),
      sendOTP: jest.fn(),
      login: jest.fn(),
      refreshToken: jest.fn(),
      logout: jest.fn(),
      forgotPassword: jest.fn(),
      enableTwoFactorAuth: jest.fn(),
      disableTwoFactorAuth: jest.fn(),
    } as any

    // Mock GoogleService
    mockGoogleService = {
      getAuthorizationUrl: jest.fn(),
      googleCallback: jest.fn(),
    } as any

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        { provide: AuthService, useValue: mockAuthService },
        { provide: GoogleService, useValue: mockGoogleService },
      ],
    }).compile()

    controller = module.get<AuthController>(AuthController)
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  // ============================================
  // CONTROLLER INITIALIZATION
  // ============================================

  describe('🔧 Controller Initialization', () => {
    it('Nên khởi tạo controller thành công', () => {
      // Assert: Verify controller được khởi tạo
      expect(controller).toBeDefined()
    })

    it('Nên inject AuthService dependency', () => {
      // Assert: Verify AuthService được inject
      expect(controller['authService']).toBeDefined()
    })

    it('Nên inject GoogleService dependency', () => {
      // Assert: Verify GoogleService được inject
      expect(controller['googleService']).toBeDefined()
    })
  })

  // ============================================
  // POST /auth/register
  // ============================================

  describe('📝 POST /auth/register', () => {
    it('Nên register user thành công với valid data', async () => {
      // Arrange: Chuẩn bị dữ liệu registration
      const registerBody = {
        email: 'newuser@example.com',
        password: 'password123',
        confirmPassword: 'password123',
        name: 'New User',
        phoneNumber: '0987654321',
        code: '123456',
      }
      const mockUser = createMockUser({ email: registerBody.email, name: registerBody.name })
      mockAuthService.register.mockResolvedValue(mockUser)

      // Act: Thực hiện registration
      const result = await controller.register(registerBody as any)

      // Assert: Verify kết quả
      expect(result).toEqual(mockUser)
      expect(mockAuthService.register).toHaveBeenCalledWith(registerBody)
      expect(mockAuthService.register).toHaveBeenCalledTimes(1)
    })

    it('Nên register user với phoneNumber khác nhau', async () => {
      // Arrange: Chuẩn bị dữ liệu với phoneNumber khác
      const registerBody = {
        email: 'user2@example.com',
        password: 'pass456',
        confirmPassword: 'pass456',
        name: 'User Two',
        phoneNumber: '0123456789',
        code: '654321',
      }
      const mockUser = createMockUser({ email: registerBody.email, phoneNumber: registerBody.phoneNumber })
      mockAuthService.register.mockResolvedValue(mockUser)

      // Act: Thực hiện registration
      const result = await controller.register(registerBody as any)

      // Assert: Verify kết quả
      expect(result.phoneNumber).toBe(registerBody.phoneNumber)
      expect(mockAuthService.register).toHaveBeenCalledWith(registerBody)
    })

    it('Nên pass all registration data to service', async () => {
      // Arrange: Chuẩn bị full registration data
      const registerBody = {
        email: 'full@example.com',
        password: 'securepass123',
        confirmPassword: 'securepass123',
        name: 'Full Name',
        phoneNumber: '0999888777',
        code: '111222',
      }
      const mockUser = createMockUser()
      mockAuthService.register.mockResolvedValue(mockUser)

      // Act: Thực hiện registration
      await controller.register(registerBody as any)

      // Assert: Verify tất cả fields được pass
      expect(mockAuthService.register).toHaveBeenCalledWith(
        expect.objectContaining({
          email: registerBody.email,
          password: registerBody.password,
          confirmPassword: registerBody.confirmPassword,
          name: registerBody.name,
          phoneNumber: registerBody.phoneNumber,
          code: registerBody.code,
        }),
      )
    })
  })

  // ============================================
  // POST /auth/otp
  // ============================================

  describe('📧 POST /auth/otp', () => {
    it('Nên send OTP thành công', async () => {
      // Arrange: Chuẩn bị dữ liệu send OTP
      const otpBody = {
        email: 'test@example.com',
        type: 'REGISTER' as const,
      }
      const mockResponse = createMockMessageResponse('Gửi mã OTP thành công')
      mockAuthService.sendOTP.mockResolvedValue(mockResponse as any)

      // Act: Thực hiện send OTP
      const result = await controller.sendOTP(otpBody as any)

      // Assert: Verify kết quả
      expect(result).toEqual(mockResponse)
      expect(result.message).toBe('Gửi mã OTP thành công')
      expect(mockAuthService.sendOTP).toHaveBeenCalledWith(otpBody)
      expect(mockAuthService.sendOTP).toHaveBeenCalledTimes(1)
    })

    it('Nên send OTP cho FORGOT_PASSWORD type', async () => {
      // Arrange: Chuẩn bị dữ liệu forgot password OTP
      const otpBody = {
        email: 'forgot@example.com',
        type: 'FORGOT_PASSWORD' as const,
      }
      const mockResponse = createMockMessageResponse('Gửi mã OTP thành công')
      mockAuthService.sendOTP.mockResolvedValue(mockResponse as any)

      // Act: Thực hiện send OTP
      const result = await controller.sendOTP(otpBody as any)

      // Assert: Verify type được pass correctly
      expect(result).toEqual(mockResponse)
      expect(mockAuthService.sendOTP).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'FORGOT_PASSWORD',
        }),
      )
    })

    it('Nên send OTP cho LOGIN type', async () => {
      // Arrange: Chuẩn bị dữ liệu login OTP
      const otpBody = {
        email: 'login@example.com',
        type: 'LOGIN' as const,
      }
      const mockResponse = createMockMessageResponse('Gửi mã OTP thành công')
      mockAuthService.sendOTP.mockResolvedValue(mockResponse as any)

      // Act: Thực hiện send OTP
      const result = await controller.sendOTP(otpBody as any)

      // Assert: Verify kết quả
      expect(result).toEqual(mockResponse)
      expect(mockAuthService.sendOTP).toHaveBeenCalledWith(otpBody)
    })
  })

  // ============================================
  // POST /auth/login
  // ============================================

  describe('🔐 POST /auth/login', () => {
    it('Nên login thành công với email và password', async () => {
      // Arrange: Chuẩn bị dữ liệu login
      const loginBody = {
        email: 'user@example.com',
        password: 'password123',
      }
      const userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0'
      const ip = '192.168.1.100'
      const mockTokens = createMockTokens()
      mockAuthService.login.mockResolvedValue(mockTokens)

      // Act: Thực hiện login
      const result = await controller.login(loginBody as any, userAgent, ip)

      // Assert: Verify kết quả
      expect(result).toEqual(mockTokens)
      expect(mockAuthService.login).toHaveBeenCalledWith({
        ...loginBody,
        userAgent,
        ip,
      })
      expect(mockAuthService.login).toHaveBeenCalledTimes(1)
    })

    it('Nên login với 2FA TOTP code', async () => {
      // Arrange: Chuẩn bị dữ liệu login với 2FA
      const loginBody = {
        email: '2fa@example.com',
        password: 'securepass',
        totpCode: '123456',
      }
      const userAgent = 'Safari/17.0'
      const ip = '10.0.0.1'
      const mockTokens = createMockTokens()
      mockAuthService.login.mockResolvedValue(mockTokens)

      // Act: Thực hiện login với 2FA
      const result = await controller.login(loginBody as any, userAgent, ip)

      // Assert: Verify totpCode được pass
      expect(result).toEqual(mockTokens)
      expect(mockAuthService.login).toHaveBeenCalledWith(
        expect.objectContaining({
          totpCode: '123456',
        }),
      )
    })

    it('Nên login với email OTP code', async () => {
      // Arrange: Chuẩn bị dữ liệu login với OTP
      const loginBody = {
        email: 'otp@example.com',
        password: 'pass123',
        code: '654321',
      }
      const userAgent = 'Firefox/121.0'
      const ip = '172.16.0.1'
      const mockTokens = createMockTokens()
      mockAuthService.login.mockResolvedValue(mockTokens)

      // Act: Thực hiện login với OTP
      const result = await controller.login(loginBody as any, userAgent, ip)

      // Assert: Verify code được pass
      expect(result).toEqual(mockTokens)
      expect(mockAuthService.login).toHaveBeenCalledWith(
        expect.objectContaining({
          code: '654321',
        }),
      )
    })

    it('Nên pass userAgent và IP to service', async () => {
      // Arrange: Chuẩn bị dữ liệu
      const loginBody = {
        email: 'track@example.com',
        password: 'password',
      }
      const userAgent = 'PostmanRuntime/7.36.0'
      const ip = '203.0.113.42'
      const mockTokens = createMockTokens()
      mockAuthService.login.mockResolvedValue(mockTokens)

      // Act: Thực hiện login
      await controller.login(loginBody as any, userAgent, ip)

      // Assert: Verify userAgent và IP được pass
      expect(mockAuthService.login).toHaveBeenCalledWith({
        email: loginBody.email,
        password: loginBody.password,
        userAgent,
        ip,
      })
    })
  })

  // ============================================
  // POST /auth/refresh-token
  // ============================================

  describe('🔄 POST /auth/refresh-token', () => {
    it('Nên refresh token thành công', async () => {
      // Arrange: Chuẩn bị dữ liệu refresh token
      const refreshBody = {
        refreshToken: 'old-refresh-token-123',
      }
      const userAgent = 'Chrome/120.0'
      const ip = '192.168.1.50'
      const mockTokens = createMockTokens({
        accessToken: 'new-access-token',
        refreshToken: 'new-refresh-token',
      })
      mockAuthService.refreshToken.mockResolvedValue(mockTokens)

      // Act: Thực hiện refresh token
      const result = await controller.refreshToken(refreshBody as any, userAgent, ip)

      // Assert: Verify kết quả
      expect(result).toEqual(mockTokens)
      expect(mockAuthService.refreshToken).toHaveBeenCalledWith({
        ...refreshBody,
        userAgent,
        ip,
      })
      expect(mockAuthService.refreshToken).toHaveBeenCalledTimes(1)
    })

    it('Nên pass userAgent và IP to service', async () => {
      // Arrange: Chuẩn bị dữ liệu
      const refreshBody = {
        refreshToken: 'token-456',
      }
      const userAgent = 'Safari/17.2'
      const ip = '10.20.30.40'
      const mockTokens = createMockTokens()
      mockAuthService.refreshToken.mockResolvedValue(mockTokens)

      // Act: Thực hiện refresh
      await controller.refreshToken(refreshBody as any, userAgent, ip)

      // Assert: Verify userAgent và IP được pass
      expect(mockAuthService.refreshToken).toHaveBeenCalledWith(
        expect.objectContaining({
          userAgent,
          ip,
        }),
      )
    })

    it('Nên return new tokens sau khi refresh', async () => {
      // Arrange: Chuẩn bị dữ liệu
      const refreshBody = {
        refreshToken: 'old-token',
      }
      const newTokens = createMockTokens({
        accessToken: 'brand-new-access',
        refreshToken: 'brand-new-refresh',
      })
      mockAuthService.refreshToken.mockResolvedValue(newTokens)

      // Act: Thực hiện refresh
      const result = await controller.refreshToken(refreshBody as any, 'UA', '1.1.1.1')

      // Assert: Verify new tokens
      expect(result.accessToken).toBe('brand-new-access')
      expect(result.refreshToken).toBe('brand-new-refresh')
    })
  })

  // ============================================
  // POST /auth/logout
  // ============================================

  describe('🚪 POST /auth/logout', () => {
    it('Nên logout thành công', async () => {
      // Arrange: Chuẩn bị dữ liệu logout
      const logoutBody = {
        refreshToken: 'token-to-invalidate',
      }
      const mockResponse = createMockMessageResponse('Đăng xuất thành công')
      mockAuthService.logout.mockResolvedValue(mockResponse as any)

      // Act: Thực hiện logout
      const result = await controller.logout(logoutBody as any)

      // Assert: Verify kết quả
      expect(result).toEqual(mockResponse)
      expect(result.message).toBe('Đăng xuất thành công')
      expect(mockAuthService.logout).toHaveBeenCalledWith(logoutBody.refreshToken)
      expect(mockAuthService.logout).toHaveBeenCalledTimes(1)
    })

    it('Nên invalidate refresh token khi logout', async () => {
      // Arrange: Chuẩn bị dữ liệu
      const logoutBody = {
        refreshToken: 'active-token-123',
      }
      const mockResponse = createMockMessageResponse('Đăng xuất thành công')
      mockAuthService.logout.mockResolvedValue(mockResponse as any)

      // Act: Thực hiện logout
      await controller.logout(logoutBody as any)

      // Assert: Verify refresh token được pass để invalidate
      expect(mockAuthService.logout).toHaveBeenCalledWith('active-token-123')
    })
  })

  // ============================================
  // POST /auth/forgot-password
  // ============================================

  describe('🔑 POST /auth/forgot-password', () => {
    it('Nên xử lý forgot password thành công', async () => {
      // Arrange: Chuẩn bị dữ liệu forgot password
      const forgotBody = {
        email: 'forgot@example.com',
        code: '123456',
        newPassword: 'newSecurePass123',
        confirmNewPassword: 'newSecurePass123',
      }
      const mockResponse = createMockMessageResponse('Đổi mật khẩu thành công')
      mockAuthService.forgotPassword.mockResolvedValue(mockResponse as any)

      // Act: Thực hiện forgot password
      const result = await controller.forgotPassword(forgotBody as any)

      // Assert: Verify kết quả
      expect(result).toEqual(mockResponse)
      expect(result.message).toBe('Đổi mật khẩu thành công')
      expect(mockAuthService.forgotPassword).toHaveBeenCalledWith(forgotBody)
      expect(mockAuthService.forgotPassword).toHaveBeenCalledTimes(1)
    })

    it('Nên pass all forgot password data to service', async () => {
      // Arrange: Chuẩn bị full data
      const forgotBody = {
        email: 'user@test.com',
        code: '654321',
        newPassword: 'newPass456',
        confirmNewPassword: 'newPass456',
      }
      const mockResponse = createMockMessageResponse('Đổi mật khẩu thành công')
      mockAuthService.forgotPassword.mockResolvedValue(mockResponse as any)

      // Act: Thực hiện forgot password
      await controller.forgotPassword(forgotBody as any)

      // Assert: Verify tất cả fields được pass
      expect(mockAuthService.forgotPassword).toHaveBeenCalledWith(
        expect.objectContaining({
          email: forgotBody.email,
          code: forgotBody.code,
          newPassword: forgotBody.newPassword,
          confirmNewPassword: forgotBody.confirmNewPassword,
        }),
      )
    })
  })

  // ============================================
  // POST /auth/2fa/enable
  // ============================================

  describe('🔒 POST /auth/2fa/enable', () => {
    it('Nên enable 2FA thành công', async () => {
      // Arrange: Chuẩn bị dữ liệu enable 2FA
      const emptyBody = {}
      const userId = 1
      const mockResponse = createMockTwoFactorResponse()
      mockAuthService.enableTwoFactorAuth.mockResolvedValue(mockResponse)

      // Act: Thực hiện enable 2FA
      const result = await controller.enableTwoFactorAuth(emptyBody as any, userId)

      // Assert: Verify kết quả
      expect(result).toEqual(mockResponse)
      expect(result.secret).toBeDefined()
      expect(result.uri).toBeDefined()
      expect(mockAuthService.enableTwoFactorAuth).toHaveBeenCalledWith(userId)
      expect(mockAuthService.enableTwoFactorAuth).toHaveBeenCalledTimes(1)
    })

    it('Nên pass userId from @ActiveUser decorator', async () => {
      // Arrange: Chuẩn bị dữ liệu
      const emptyBody = {}
      const userId = 42
      const mockResponse = createMockTwoFactorResponse()
      mockAuthService.enableTwoFactorAuth.mockResolvedValue(mockResponse)

      // Act: Thực hiện enable 2FA
      await controller.enableTwoFactorAuth(emptyBody as any, userId)

      // Assert: Verify userId được pass correctly
      expect(mockAuthService.enableTwoFactorAuth).toHaveBeenCalledWith(42)
    })

    it('Nên return TOTP secret và QR code URI', async () => {
      // Arrange: Chuẩn bị dữ liệu
      const mockResponse = createMockTwoFactorResponse({
        secret: 'NEWSECRET123',
        uri: 'otpauth://totp/App:user@example.com?secret=NEWSECRET123',
      })
      mockAuthService.enableTwoFactorAuth.mockResolvedValue(mockResponse)

      // Act: Thực hiện enable 2FA
      const result = await controller.enableTwoFactorAuth({} as any, 1)

      // Assert: Verify response structure
      expect(result.secret).toBe('NEWSECRET123')
      expect(result.uri).toContain('otpauth://totp/')
    })
  })

  // ============================================
  // POST /auth/2fa/disable
  // ============================================

  describe('🔓 POST /auth/2fa/disable', () => {
    it('Nên disable 2FA với TOTP code', async () => {
      // Arrange: Chuẩn bị dữ liệu disable 2FA với TOTP
      const disableBody = {
        totpCode: '123456',
      }
      const userId = 1
      const mockResponse = createMockMessageResponse('Tắt xác thực 2 yếu tố thành công')
      mockAuthService.disableTwoFactorAuth.mockResolvedValue(mockResponse as any)

      // Act: Thực hiện disable 2FA
      const result = await controller.disableTwoFactorAuth(disableBody as any, userId)

      // Assert: Verify kết quả
      expect(result).toEqual(mockResponse)
      expect(result.message).toBe('Tắt xác thực 2 yếu tố thành công')
      expect(mockAuthService.disableTwoFactorAuth).toHaveBeenCalledWith({
        userId,
        ...disableBody,
      })
      expect(mockAuthService.disableTwoFactorAuth).toHaveBeenCalledTimes(1)
    })

    it('Nên disable 2FA với email OTP code', async () => {
      // Arrange: Chuẩn bị dữ liệu disable 2FA với OTP
      const disableBody = {
        code: '654321',
      }
      const userId = 2
      const mockResponse = createMockMessageResponse('Tắt xác thực 2 yếu tố thành công')
      mockAuthService.disableTwoFactorAuth.mockResolvedValue(mockResponse as any)

      // Act: Thực hiện disable 2FA
      const result = await controller.disableTwoFactorAuth(disableBody as any, userId)

      // Assert: Verify code được pass
      expect(result).toEqual(mockResponse)
      expect(mockAuthService.disableTwoFactorAuth).toHaveBeenCalledWith(
        expect.objectContaining({
          code: '654321',
        }),
      )
    })

    it('Nên pass userId from @ActiveUser decorator', async () => {
      // Arrange: Chuẩn bị dữ liệu
      const disableBody = {
        totpCode: '999888',
      }
      const userId = 99
      const mockResponse = createMockMessageResponse('Tắt xác thực 2 yếu tố thành công')
      mockAuthService.disableTwoFactorAuth.mockResolvedValue(mockResponse as any)

      // Act: Thực hiện disable 2FA
      await controller.disableTwoFactorAuth(disableBody as any, userId)

      // Assert: Verify userId được pass
      expect(mockAuthService.disableTwoFactorAuth).toHaveBeenCalledWith({
        userId: 99,
        totpCode: '999888',
      })
    })
  })

  // ============================================
  // GET /auth/google-link
  // ============================================

  describe('🔗 GET /auth/google-link', () => {
    it('Nên get Google authorization URL thành công', async () => {
      // Arrange: Chuẩn bị dữ liệu
      const userAgent = 'Chrome/120.0'
      const ip = '192.168.1.1'
      const mockUrl = {
        url: 'https://accounts.google.com/o/oauth2/v2/auth?client_id=xxx&redirect_uri=yyy&scope=profile+email&state=encoded',
      }
      mockGoogleService.getAuthorizationUrl.mockReturnValue(mockUrl)

      // Act: Thực hiện get authorization URL
      const result = controller.getAuthorizationUrl(userAgent, ip)

      // Assert: Verify kết quả
      expect(result).toEqual(mockUrl)
      expect(result.url).toContain('https://accounts.google.com')
      expect(mockGoogleService.getAuthorizationUrl).toHaveBeenCalledWith({
        userAgent,
        ip,
      })
      expect(mockGoogleService.getAuthorizationUrl).toHaveBeenCalledTimes(1)
    })

    it('Nên pass userAgent và IP to service', async () => {
      // Arrange: Chuẩn bị dữ liệu
      const userAgent = 'Safari/17.0'
      const ip = '10.0.0.1'
      const mockUrl = { url: 'https://google.com/oauth' }
      mockGoogleService.getAuthorizationUrl.mockReturnValue(mockUrl)

      // Act: Thực hiện get URL
      controller.getAuthorizationUrl(userAgent, ip)

      // Assert: Verify userAgent và IP được pass
      expect(mockGoogleService.getAuthorizationUrl).toHaveBeenCalledWith(
        expect.objectContaining({
          userAgent,
          ip,
        }),
      )
    })

    it('Nên return URL với state parameter', async () => {
      // Arrange: Chuẩn bị dữ liệu
      const mockUrl = {
        url: 'https://accounts.google.com/o/oauth2/v2/auth?state=base64encodedstate',
      }
      mockGoogleService.getAuthorizationUrl.mockReturnValue(mockUrl)

      // Act: Thực hiện get URL
      const result = controller.getAuthorizationUrl('UA', '1.1.1.1')

      // Assert: Verify URL contains state
      expect(result.url).toContain('state=')
    })
  })

  // ============================================
  // GET /auth/google/callback
  // ============================================

  describe('🔙 GET /auth/google/callback', () => {
    it('Nên handle Google callback thành công và redirect với tokens', async () => {
      // Arrange: Chuẩn bị dữ liệu callback
      const code = 'google-auth-code-123'
      const state = 'base64-encoded-state'
      const mockTokens = createMockTokens()
      const mockResponse = createMockResponse()
      mockGoogleService.googleCallback.mockResolvedValue(mockTokens)

      // Act: Thực hiện callback
      await controller.googleCallback(code, state, mockResponse as Response)

      // Assert: Verify redirect được gọi với tokens
      expect(mockGoogleService.googleCallback).toHaveBeenCalledWith({ code, state })
      expect(mockResponse.redirect).toHaveBeenCalled()
      const redirectUrl = (mockResponse.redirect as jest.Mock).mock.calls[0][0]
      expect(redirectUrl).toContain('accessToken=mock-access-token-123')
      expect(redirectUrl).toContain('refreshToken=mock-refresh-token-456')
    })

    it('Nên redirect với error message khi có lỗi', async () => {
      // Arrange: Chuẩn bị dữ liệu với error
      const code = 'invalid-code'
      const state = 'state'
      const mockResponse = createMockResponse()
      const error = new Error('Invalid authorization code')
      mockGoogleService.googleCallback.mockRejectedValue(error)

      // Act: Thực hiện callback với error
      await controller.googleCallback(code, state, mockResponse as Response)

      // Assert: Verify redirect với error message
      expect(mockResponse.redirect).toHaveBeenCalled()
      const redirectUrl = (mockResponse.redirect as jest.Mock).mock.calls[0][0]
      expect(redirectUrl).toContain('errorMessage=')
      expect(redirectUrl).toContain('Invalid authorization code')
    })

    it('Nên handle generic error và redirect', async () => {
      // Arrange: Chuẩn bị dữ liệu với generic error
      const code = 'code'
      const state = 'state'
      const mockResponse = createMockResponse()
      mockGoogleService.googleCallback.mockRejectedValue('Unknown error')

      // Act: Thực hiện callback
      await controller.googleCallback(code, state, mockResponse as Response)

      // Assert: Verify redirect với generic error message
      expect(mockResponse.redirect).toHaveBeenCalled()
      const redirectUrl = (mockResponse.redirect as jest.Mock).mock.calls[0][0]
      expect(redirectUrl).toContain('errorMessage=')
      expect(redirectUrl).toContain('Đã xảy ra lỗi')
    })

    it('Nên pass code và state to GoogleService', async () => {
      // Arrange: Chuẩn bị dữ liệu
      const code = 'auth-code-xyz'
      const state = 'encoded-state-abc'
      const mockTokens = createMockTokens()
      const mockResponse = createMockResponse()
      mockGoogleService.googleCallback.mockResolvedValue(mockTokens)

      // Act: Thực hiện callback
      await controller.googleCallback(code, state, mockResponse as Response)

      // Assert: Verify code và state được pass
      expect(mockGoogleService.googleCallback).toHaveBeenCalledWith({
        code: 'auth-code-xyz',
        state: 'encoded-state-abc',
      })
    })

    it('Nên format redirect URL correctly với tokens', async () => {
      // Arrange: Chuẩn bị dữ liệu
      const mockTokens = createMockTokens({
        accessToken: 'access-123',
        refreshToken: 'refresh-456',
      })
      const mockResponse = createMockResponse()
      mockGoogleService.googleCallback.mockResolvedValue(mockTokens)

      // Act: Thực hiện callback
      await controller.googleCallback('code', 'state', mockResponse as Response)

      // Assert: Verify redirect URL format
      const redirectUrl = (mockResponse.redirect as jest.Mock).mock.calls[0][0]
      expect(redirectUrl).toMatch(/\?accessToken=.+&refreshToken=.+/)
    })
  })

  // ===== RESPONSE STRUCTURE SNAPSHOTS =====

  describe('Response Structure Snapshots', () => {
    const fixedDate = '2024-01-01T00:00:00.000Z'

    it('should match register response structure', async () => {
      const mockResult = {
        ...createMockUser({ createdAt: fixedDate, updatedAt: fixedDate }),
        ...createMockTokens(),
      }
      mockAuthService.register.mockResolvedValue(mockResult as any)
      const result = await controller.register({
        email: 'test@example.com',
        name: 'Test User',
        password: 'Password123!',
        confirmPassword: 'Password123!',
        phoneNumber: '0123456789',
        code: '123456',
      })
      expect(result).toMatchSnapshot()
    })

    it('should match login response structure', async () => {
      const mockResult = {
        ...createMockUser({ createdAt: fixedDate, updatedAt: fixedDate }),
        ...createMockTokens(),
      }
      mockAuthService.login.mockResolvedValue(mockResult as any)
      const result = await controller.login(
        {
          email: 'test@example.com',
          password: 'Password123!',
        },
        'test-user-agent',
        '127.0.0.1',
      )
      expect(result).toMatchSnapshot()
    })

    it('should match message response structure', async () => {
      const mockResult = createMockMessageResponse('OTP sent successfully')
      mockAuthService.sendOTP.mockResolvedValue(mockResult as any)
      const result = await controller.sendOTP({ email: 'test@example.com', type: 'REGISTER' } as any)
      expect(result).toMatchSnapshot()
    })

    it('should match 2FA setup response structure', async () => {
      const mockResult = createMockTwoFactorResponse()
      mockAuthService.enableTwoFactorAuth.mockResolvedValue(mockResult as any)
      const result = await controller.enableTwoFactorAuth({} as any, 1)
      expect(result).toMatchSnapshot()
    })

    it('should match refresh token response structure', async () => {
      const mockResult = createMockTokens()
      mockAuthService.refreshToken.mockResolvedValue(mockResult as any)
      const result = await controller.refreshToken({ refreshToken: 'mock-refresh-token' } as any, 'Mozilla/5.0', '127.0.0.1')
      expect(result).toMatchSnapshot()
    })
  })
})
