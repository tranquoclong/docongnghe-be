import { Test, TestingModule } from '@nestjs/testing'
import { google } from 'googleapis'
import { UserStatus } from '../../../shared/constants/auth.constant'
import { SharedRoleRepository } from '../../../shared/repositories/shared-role.repo'
import { HashingService } from '../../../shared/services/hashing.service'
import { GoogleUserInfoError } from '../auth.error'
import { AuthRepository } from '../auth.repo'
import { AuthService } from '../auth.service'
import { GoogleService } from '../google.service'

// Mock googleapis
jest.mock('googleapis', () => ({
  google: {
    auth: {
      OAuth2: jest.fn(),
    },
    oauth2: jest.fn(),
  },
}))

/**
 * GOOGLE SERVICE UNIT TESTS
 *
 * Test coverage cho Google OAuth authentication service
 * - getAuthorizationUrl: Generate OAuth URL với state encoding
 * - googleCallback: Handle OAuth callback, user creation, token generation
 * - State encoding/decoding (userAgent, IP)
 * - Error handling (invalid token, missing email, etc.)
 */

describe('GoogleService', () => {
  let service: GoogleService
  let mockAuthRepository: jest.Mocked<AuthRepository>
  let mockHashingService: jest.Mocked<HashingService>
  let mockSharedRoleRepository: jest.Mocked<SharedRoleRepository>
  let mockAuthService: jest.Mocked<AuthService>
  let mockOAuth2Client: any

  // ===== TEST DATA FACTORIES =====

  const createMockUser = (overrides = {}) => ({
    id: 1,
    email: 'test@example.com',
    name: 'Test User',
    phoneNumber: '',
    avatar: 'https://example.com/avatar.jpg',
    roleId: 2,
    role: {
      id: 2,
      name: 'client',
      description: 'Client role',
      isActive: true,
      createdById: null,
      updatedById: null,
      deletedById: null,
      deletedAt: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    password: 'hashedPassword',
    totpSecret: null,
    totpEnabled: false,
    status: UserStatus.ACTIVE,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    deletedAt: null,
    createdById: null,
    updatedById: null,
    deletedById: null,
    isActive: true,
    ...overrides,
  })

  const createMockDevice = (overrides = {}) => ({
    id: 1,
    userId: 1,
    userAgent: 'Mozilla/5.0',
    ip: '192.168.1.1',
    lastActive: new Date().toISOString(),
    createdAt: new Date().toISOString(),
    isActive: true,
    ...overrides,
  })

  const createMockAuthTokens = (overrides = {}) => ({
    accessToken: 'access-token-123',
    refreshToken: 'refresh-token-456',
    ...overrides,
  })

  const createMockGoogleUserInfo = (overrides = {}) => ({
    email: 'test@example.com',
    name: 'Test User',
    picture: 'https://example.com/avatar.jpg',
    ...overrides,
  })

  beforeEach(async () => {
    // Mock dependencies
    mockAuthRepository = {
      findUniqueUserIncludeRole: jest.fn(),
      createUserIncludeRole: jest.fn(),
      createDevice: jest.fn(),
    } as any

    mockHashingService = {
      hash: jest.fn(),
    } as any

    mockSharedRoleRepository = {
      getClientRoleId: jest.fn(),
    } as any

    mockAuthService = {
      generateTokens: jest.fn(),
    } as any

    // Mock OAuth2Client
    mockOAuth2Client = {
      generateAuthUrl: jest.fn(),
      getToken: jest.fn(),
      setCredentials: jest.fn(),
    }

    // Mock google.auth.OAuth2 constructor
    ;(google.auth.OAuth2 as unknown as jest.Mock).mockImplementation(() => mockOAuth2Client)

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GoogleService,
        { provide: AuthRepository, useValue: mockAuthRepository },
        { provide: HashingService, useValue: mockHashingService },
        { provide: SharedRoleRepository, useValue: mockSharedRoleRepository },
        { provide: AuthService, useValue: mockAuthService },
      ],
    }).compile()

    service = module.get<GoogleService>(GoogleService)
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  // ===== INITIALIZATION =====

  describe('Service Initialization', () => {
    it('should be defined', () => {
      expect(service).toBeDefined()
    })

    it('should initialize OAuth2Client with correct credentials', () => {
      expect(google.auth.OAuth2).toHaveBeenCalled()
    })

    it('should have oauth2Client instance', () => {
      expect(service['oauth2Client']).toBeDefined()
    })
  })

  // ===== GET AUTHORIZATION URL =====

  describe('getAuthorizationUrl', () => {
    it('should generate authorization URL with encoded state', () => {
      // Arrange - Chuẩn bị dữ liệu
      const userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
      const ip = '192.168.1.100'
      const expectedUrl = 'https://accounts.google.com/o/oauth2/v2/auth?...'

      mockOAuth2Client.generateAuthUrl.mockReturnValue(expectedUrl)

      // Act - Thực hiện generate URL
      const result = service.getAuthorizationUrl({ userAgent, ip })

      // Assert - Kiểm tra kết quả
      expect(result).toEqual({ url: expectedUrl })
      expect(mockOAuth2Client.generateAuthUrl).toHaveBeenCalledWith({
        access_type: 'offline',
        scope: ['https://www.googleapis.com/auth/userinfo.profile', 'https://www.googleapis.com/auth/userinfo.email'],
        include_granted_scopes: true,
        state: expect.any(String),
      })
    })

    it('should encode userAgent and IP in state parameter', () => {
      // Arrange - Chuẩn bị dữ liệu
      const userAgent = 'Chrome/120.0'
      const ip = '10.0.0.1'

      mockOAuth2Client.generateAuthUrl.mockReturnValue('https://google.com/auth')

      // Act - Thực hiện generate URL
      service.getAuthorizationUrl({ userAgent, ip })

      // Assert - Kiểm tra state được encode đúng
      const callArgs = mockOAuth2Client.generateAuthUrl.mock.calls[0][0]
      const state = callArgs.state
      const decodedState = JSON.parse(Buffer.from(state, 'base64').toString())

      expect(decodedState).toEqual({ userAgent, ip })
    })

    it('should handle special characters in userAgent', () => {
      // Arrange - Chuẩn bị dữ liệu với special characters
      const userAgent = 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X)'
      const ip = '172.16.0.1'

      mockOAuth2Client.generateAuthUrl.mockReturnValue('https://google.com/auth')

      // Act - Thực hiện generate URL
      service.getAuthorizationUrl({ userAgent, ip })

      // Assert - Kiểm tra state được encode đúng
      const callArgs = mockOAuth2Client.generateAuthUrl.mock.calls[0][0]
      const state = callArgs.state
      const decodedState = JSON.parse(Buffer.from(state, 'base64').toString())

      expect(decodedState.userAgent).toBe(userAgent)
    })

    it('should include correct OAuth scopes', () => {
      // Arrange - Chuẩn bị dữ liệu
      const userAgent = 'Safari/17.0'
      const ip = '192.168.0.1'

      mockOAuth2Client.generateAuthUrl.mockReturnValue('https://google.com/auth')

      // Act - Thực hiện generate URL
      service.getAuthorizationUrl({ userAgent, ip })

      // Assert - Kiểm tra scopes
      const callArgs = mockOAuth2Client.generateAuthUrl.mock.calls[0][0]
      expect(callArgs.scope).toEqual([
        'https://www.googleapis.com/auth/userinfo.profile',
        'https://www.googleapis.com/auth/userinfo.email',
      ])
      expect(callArgs.access_type).toBe('offline')
      expect(callArgs.include_granted_scopes).toBe(true)
    })

    it('should handle IPv6 addresses', () => {
      // Arrange - Chuẩn bị dữ liệu với IPv6
      const userAgent = 'Firefox/121.0'
      const ip = '2001:0db8:85a3:0000:0000:8a2e:0370:7334'

      mockOAuth2Client.generateAuthUrl.mockReturnValue('https://google.com/auth')

      // Act - Thực hiện generate URL
      service.getAuthorizationUrl({ userAgent, ip })

      // Assert - Kiểm tra state được encode đúng
      const callArgs = mockOAuth2Client.generateAuthUrl.mock.calls[0][0]
      const state = callArgs.state
      const decodedState = JSON.parse(Buffer.from(state, 'base64').toString())

      expect(decodedState.ip).toBe(ip)
    })

    it('should handle empty userAgent and IP', () => {
      // Arrange - Chuẩn bị dữ liệu rỗng
      const userAgent = ''
      const ip = ''

      mockOAuth2Client.generateAuthUrl.mockReturnValue('https://google.com/auth')

      // Act - Thực hiện generate URL
      service.getAuthorizationUrl({ userAgent, ip })

      // Assert - Kiểm tra state được encode đúng
      const callArgs = mockOAuth2Client.generateAuthUrl.mock.calls[0][0]
      const state = callArgs.state
      const decodedState = JSON.parse(Buffer.from(state, 'base64').toString())

      expect(decodedState).toEqual({ userAgent: '', ip: '' })
    })
  })

  // ===== GOOGLE CALLBACK - SUCCESS CASES =====

  describe('googleCallback - Success Cases', () => {
    it('should handle callback with existing user successfully', async () => {
      // Arrange - Chuẩn bị dữ liệu cho existing user
      const code = 'auth-code-123'
      const userAgent = 'Mozilla/5.0'
      const ip = '192.168.1.1'
      const state = Buffer.from(JSON.stringify({ userAgent, ip })).toString('base64')

      const mockTokens = { access_token: 'access-token', refresh_token: 'refresh-token' }
      const mockGoogleUser = createMockGoogleUserInfo()
      const mockUser = createMockUser()
      const mockDevice = createMockDevice()
      const mockAuthTokens = createMockAuthTokens()

      mockOAuth2Client.getToken.mockResolvedValue({ tokens: mockTokens })
      mockAuthRepository.findUniqueUserIncludeRole.mockResolvedValue(mockUser)
      mockAuthRepository.createDevice.mockResolvedValue(mockDevice)
      mockAuthService.generateTokens.mockResolvedValue(mockAuthTokens)

      // Mock google.oauth2
      const mockUserinfoGet = jest.fn().mockResolvedValue({ data: mockGoogleUser })
      ;(google.oauth2 as jest.Mock).mockReturnValue({
        userinfo: { get: mockUserinfoGet },
      })

      // Act - Thực hiện callback
      const result = await service.googleCallback({ code, state })

      // Assert - Kiểm tra kết quả
      expect(result).toEqual(mockAuthTokens)
      expect(mockOAuth2Client.getToken).toHaveBeenCalledWith(code)
      expect(mockOAuth2Client.setCredentials).toHaveBeenCalledWith(mockTokens)
      expect(mockAuthRepository.findUniqueUserIncludeRole).toHaveBeenCalledWith({
        email: mockGoogleUser.email,
      })
      expect(mockAuthRepository.createDevice).toHaveBeenCalledWith({
        userId: mockUser.id,
        userAgent,
        ip,
      })
      expect(mockAuthService.generateTokens).toHaveBeenCalledWith({
        userId: mockUser.id,
        roleId: mockUser.roleId,
        deviceId: mockDevice.id,
        roleName: mockUser.role.name,
      })
    })

    it('should create new user from Google profile when user does not exist', async () => {
      // Arrange - Chuẩn bị dữ liệu cho new user
      const code = 'auth-code-456'
      const userAgent = 'Chrome/120.0'
      const ip = '10.0.0.1'
      const state = Buffer.from(JSON.stringify({ userAgent, ip })).toString('base64')

      const mockTokens = { access_token: 'access-token', refresh_token: 'refresh-token' }
      const mockGoogleUser = createMockGoogleUserInfo({
        email: 'newuser@example.com',
        name: 'New User',
        picture: 'https://example.com/new-avatar.jpg',
      })
      const mockNewUser = createMockUser({
        email: mockGoogleUser.email,
        name: mockGoogleUser.name,
        avatar: mockGoogleUser.picture,
      })
      const mockDevice = createMockDevice()
      const mockAuthTokens = createMockAuthTokens()
      const clientRoleId = 2
      const hashedPassword = 'hashed-random-password'

      mockOAuth2Client.getToken.mockResolvedValue({ tokens: mockTokens })
      mockAuthRepository.findUniqueUserIncludeRole.mockResolvedValue(null) // User không tồn tại
      mockSharedRoleRepository.getClientRoleId.mockResolvedValue(clientRoleId)
      mockHashingService.hash.mockResolvedValue(hashedPassword)
      mockAuthRepository.createUserIncludeRole.mockResolvedValue(mockNewUser)
      mockAuthRepository.createDevice.mockResolvedValue(mockDevice)
      mockAuthService.generateTokens.mockResolvedValue(mockAuthTokens)

      // Mock google.oauth2
      const mockUserinfoGet = jest.fn().mockResolvedValue({ data: mockGoogleUser })
      ;(google.oauth2 as jest.Mock).mockReturnValue({
        userinfo: { get: mockUserinfoGet },
      })

      // Act - Thực hiện callback
      const result = await service.googleCallback({ code, state })

      // Assert - Kiểm tra kết quả
      expect(result).toEqual(mockAuthTokens)
      expect(mockSharedRoleRepository.getClientRoleId).toHaveBeenCalled()
      expect(mockHashingService.hash).toHaveBeenCalledWith(expect.any(String)) // UUID password
      expect(mockAuthRepository.createUserIncludeRole).toHaveBeenCalledWith({
        email: mockGoogleUser.email,
        name: mockGoogleUser.name,
        phoneNumber: '',
        password: hashedPassword,
        roleId: clientRoleId,
        avatar: mockGoogleUser.picture,
      })
    })

    it('should handle missing optional fields from Google profile', async () => {
      // Arrange - Chuẩn bị dữ liệu với missing name và picture
      const code = 'auth-code-789'
      const userAgent = 'Safari/17.0'
      const ip = '172.16.0.1'
      const state = Buffer.from(JSON.stringify({ userAgent, ip })).toString('base64')

      const mockTokens = { access_token: 'access-token', refresh_token: 'refresh-token' }
      const mockGoogleUser = {
        email: 'minimal@example.com',
        name: null, // Missing name
        picture: null, // Missing picture
      }
      const mockNewUser = createMockUser({
        email: mockGoogleUser.email,
        name: '',
        avatar: null,
      })
      const mockDevice = createMockDevice()
      const mockAuthTokens = createMockAuthTokens()

      mockOAuth2Client.getToken.mockResolvedValue({ tokens: mockTokens })
      mockAuthRepository.findUniqueUserIncludeRole.mockResolvedValue(null)
      mockSharedRoleRepository.getClientRoleId.mockResolvedValue(2)
      mockHashingService.hash.mockResolvedValue('hashed-password')
      mockAuthRepository.createUserIncludeRole.mockResolvedValue(mockNewUser)
      mockAuthRepository.createDevice.mockResolvedValue(mockDevice)
      mockAuthService.generateTokens.mockResolvedValue(mockAuthTokens)

      // Mock google.oauth2
      const mockUserinfoGet = jest.fn().mockResolvedValue({ data: mockGoogleUser })
      ;(google.oauth2 as jest.Mock).mockReturnValue({
        userinfo: { get: mockUserinfoGet },
      })

      // Act - Thực hiện callback
      const result = await service.googleCallback({ code, state })

      // Assert - Kiểm tra kết quả
      expect(result).toEqual(mockAuthTokens)
      expect(mockAuthRepository.createUserIncludeRole).toHaveBeenCalledWith({
        email: mockGoogleUser.email,
        name: '', // Default to empty string
        phoneNumber: '',
        password: 'hashed-password',
        roleId: 2,
        avatar: null, // Default to null
      })
    })

    it('should parse state parameter correctly', async () => {
      // Arrange - Chuẩn bị dữ liệu với custom userAgent và IP
      const code = 'auth-code-abc'
      const userAgent = 'PostmanRuntime/7.36.0'
      const ip = '203.0.113.42'
      const state = Buffer.from(JSON.stringify({ userAgent, ip })).toString('base64')

      const mockTokens = { access_token: 'access-token', refresh_token: 'refresh-token' }
      const mockGoogleUser = createMockGoogleUserInfo()
      const mockUser = createMockUser()
      const mockDevice = createMockDevice({ userAgent, ip })
      const mockAuthTokens = createMockAuthTokens()

      mockOAuth2Client.getToken.mockResolvedValue({ tokens: mockTokens })
      mockAuthRepository.findUniqueUserIncludeRole.mockResolvedValue(mockUser)
      mockAuthRepository.createDevice.mockResolvedValue(mockDevice)
      mockAuthService.generateTokens.mockResolvedValue(mockAuthTokens)

      // Mock google.oauth2
      const mockUserinfoGet = jest.fn().mockResolvedValue({ data: mockGoogleUser })
      ;(google.oauth2 as jest.Mock).mockReturnValue({
        userinfo: { get: mockUserinfoGet },
      })

      // Act - Thực hiện callback
      await service.googleCallback({ code, state })

      // Assert - Kiểm tra device được tạo với đúng userAgent và IP
      expect(mockAuthRepository.createDevice).toHaveBeenCalledWith({
        userId: mockUser.id,
        userAgent,
        ip,
      })
    })

    it('should generate random password for new user', async () => {
      // Arrange - Chuẩn bị dữ liệu
      const code = 'auth-code-xyz'
      const state = Buffer.from(JSON.stringify({ userAgent: 'Test', ip: '1.1.1.1' })).toString('base64')

      const mockTokens = { access_token: 'access-token', refresh_token: 'refresh-token' }
      const mockGoogleUser = createMockGoogleUserInfo({ email: 'random@example.com' })
      const mockNewUser = createMockUser({ email: mockGoogleUser.email })
      const mockDevice = createMockDevice()
      const mockAuthTokens = createMockAuthTokens()

      mockOAuth2Client.getToken.mockResolvedValue({ tokens: mockTokens })
      mockAuthRepository.findUniqueUserIncludeRole.mockResolvedValue(null)
      mockSharedRoleRepository.getClientRoleId.mockResolvedValue(2)
      mockHashingService.hash.mockResolvedValue('hashed-uuid-password')
      mockAuthRepository.createUserIncludeRole.mockResolvedValue(mockNewUser)
      mockAuthRepository.createDevice.mockResolvedValue(mockDevice)
      mockAuthService.generateTokens.mockResolvedValue(mockAuthTokens)

      // Mock google.oauth2
      const mockUserinfoGet = jest.fn().mockResolvedValue({ data: mockGoogleUser })
      ;(google.oauth2 as jest.Mock).mockReturnValue({
        userinfo: { get: mockUserinfoGet },
      })

      // Act - Thực hiện callback
      await service.googleCallback({ code, state })

      // Assert - Kiểm tra hash được gọi với UUID (format: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx)
      expect(mockHashingService.hash).toHaveBeenCalledWith(
        expect.stringMatching(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/),
      )
    })

    it('should create device with correct userId', async () => {
      // Arrange - Chuẩn bị dữ liệu
      const code = 'auth-code-device'
      const state = Buffer.from(JSON.stringify({ userAgent: 'Test', ip: '2.2.2.2' })).toString('base64')

      const mockTokens = { access_token: 'access-token', refresh_token: 'refresh-token' }
      const mockGoogleUser = createMockGoogleUserInfo()
      const mockUser = createMockUser({ id: 999 })
      const mockDevice = createMockDevice({ userId: 999 })
      const mockAuthTokens = createMockAuthTokens()

      mockOAuth2Client.getToken.mockResolvedValue({ tokens: mockTokens })
      mockAuthRepository.findUniqueUserIncludeRole.mockResolvedValue(mockUser)
      mockAuthRepository.createDevice.mockResolvedValue(mockDevice)
      mockAuthService.generateTokens.mockResolvedValue(mockAuthTokens)

      // Mock google.oauth2
      const mockUserinfoGet = jest.fn().mockResolvedValue({ data: mockGoogleUser })
      ;(google.oauth2 as jest.Mock).mockReturnValue({
        userinfo: { get: mockUserinfoGet },
      })

      // Act - Thực hiện callback
      await service.googleCallback({ code, state })

      // Assert - Kiểm tra device được tạo với đúng userId
      expect(mockAuthRepository.createDevice).toHaveBeenCalledWith({
        userId: 999,
        userAgent: 'Test',
        ip: '2.2.2.2',
      })
    })

    it('should generate tokens with correct payload', async () => {
      // Arrange - Chuẩn bị dữ liệu
      const code = 'auth-code-tokens'
      const state = Buffer.from(JSON.stringify({ userAgent: 'Test', ip: '3.3.3.3' })).toString('base64')

      const mockTokens = { access_token: 'access-token', refresh_token: 'refresh-token' }
      const mockGoogleUser = createMockGoogleUserInfo()
      const mockUser = createMockUser({
        id: 123,
        roleId: 5,
        role: { ...createMockUser().role, id: 5, name: 'premium' },
      })
      const mockDevice = createMockDevice({ id: 456 })
      const mockAuthTokens = createMockAuthTokens()

      mockOAuth2Client.getToken.mockResolvedValue({ tokens: mockTokens })
      mockAuthRepository.findUniqueUserIncludeRole.mockResolvedValue(mockUser)
      mockAuthRepository.createDevice.mockResolvedValue(mockDevice)
      mockAuthService.generateTokens.mockResolvedValue(mockAuthTokens)

      // Mock google.oauth2
      const mockUserinfoGet = jest.fn().mockResolvedValue({ data: mockGoogleUser })
      ;(google.oauth2 as jest.Mock).mockReturnValue({
        userinfo: { get: mockUserinfoGet },
      })

      // Act - Thực hiện callback
      await service.googleCallback({ code, state })

      // Assert - Kiểm tra generateTokens được gọi với đúng payload
      expect(mockAuthService.generateTokens).toHaveBeenCalledWith({
        userId: 123,
        roleId: 5,
        deviceId: 456,
        roleName: 'premium',
      })
    })

    it('should handle invalid state parameter gracefully', async () => {
      // Arrange - Chuẩn bị dữ liệu với invalid state (không phải base64 hợp lệ)
      const code = 'auth-code-invalid-state'
      const state = 'invalid-base64-!@#$%'

      const mockTokens = { access_token: 'access-token', refresh_token: 'refresh-token' }
      const mockGoogleUser = createMockGoogleUserInfo()
      const mockUser = createMockUser()
      const mockDevice = createMockDevice()
      const mockAuthTokens = createMockAuthTokens()

      mockOAuth2Client.getToken.mockResolvedValue({ tokens: mockTokens })
      mockAuthRepository.findUniqueUserIncludeRole.mockResolvedValue(mockUser)
      mockAuthRepository.createDevice.mockResolvedValue(mockDevice)
      mockAuthService.generateTokens.mockResolvedValue(mockAuthTokens)

      // Mock google.oauth2
      const mockUserinfoGet = jest.fn().mockResolvedValue({ data: mockGoogleUser })
      ;(google.oauth2 as jest.Mock).mockReturnValue({
        userinfo: { get: mockUserinfoGet },
      })

      // Spy on console.error
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation()

      // Act - Thực hiện callback
      const result = await service.googleCallback({ code, state })

      // Assert - Kiểm tra kết quả vẫn thành công với default values
      expect(result).toEqual(mockAuthTokens)
      expect(consoleErrorSpy).toHaveBeenCalledWith('Error parsing state:', expect.any(Error))
      expect(mockAuthRepository.createDevice).toHaveBeenCalledWith({
        userId: mockUser.id,
        userAgent: 'unknown', // Default value
        ip: 'unknown', // Default value
      })

      consoleErrorSpy.mockRestore()
    })

    it('should handle empty state parameter', async () => {
      // Arrange - Chuẩn bị dữ liệu với empty state
      const code = 'auth-code-empty-state'
      const state = ''

      const mockTokens = { access_token: 'access-token', refresh_token: 'refresh-token' }
      const mockGoogleUser = createMockGoogleUserInfo()
      const mockUser = createMockUser()
      const mockDevice = createMockDevice()
      const mockAuthTokens = createMockAuthTokens()

      mockOAuth2Client.getToken.mockResolvedValue({ tokens: mockTokens })
      mockAuthRepository.findUniqueUserIncludeRole.mockResolvedValue(mockUser)
      mockAuthRepository.createDevice.mockResolvedValue(mockDevice)
      mockAuthService.generateTokens.mockResolvedValue(mockAuthTokens)

      // Mock google.oauth2
      const mockUserinfoGet = jest.fn().mockResolvedValue({ data: mockGoogleUser })
      ;(google.oauth2 as jest.Mock).mockReturnValue({
        userinfo: { get: mockUserinfoGet },
      })

      // Act - Thực hiện callback
      const result = await service.googleCallback({ code, state })

      // Assert - Kiểm tra kết quả với default values
      expect(result).toEqual(mockAuthTokens)
      expect(mockAuthRepository.createDevice).toHaveBeenCalledWith({
        userId: mockUser.id,
        userAgent: 'unknown',
        ip: 'unknown',
      })
    })
  })

  // ===== GOOGLE CALLBACK - ERROR CASES =====

  describe('googleCallback - Error Cases', () => {
    it('should throw error when missing email from Google profile', async () => {
      // Arrange - Chuẩn bị dữ liệu với missing email
      const code = 'auth-code-no-email'
      const state = Buffer.from(JSON.stringify({ userAgent: 'Test', ip: '1.1.1.1' })).toString('base64')

      const mockTokens = { access_token: 'access-token', refresh_token: 'refresh-token' }
      const mockGoogleUser = {
        email: null, // Missing email
        name: 'Test User',
        picture: 'https://example.com/avatar.jpg',
      }

      mockOAuth2Client.getToken.mockResolvedValue({ tokens: mockTokens })

      // Mock google.oauth2
      const mockUserinfoGet = jest.fn().mockResolvedValue({ data: mockGoogleUser })
      ;(google.oauth2 as jest.Mock).mockReturnValue({
        userinfo: { get: mockUserinfoGet },
      })

      // Spy on console.error
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation()

      // Act & Assert - Thực hiện callback và kiểm tra lỗi
      await expect(service.googleCallback({ code, state })).rejects.toThrow(GoogleUserInfoError)

      expect(consoleErrorSpy).toHaveBeenCalledWith('Error in google callback:', GoogleUserInfoError)

      consoleErrorSpy.mockRestore()
    })

    it('should throw error when token exchange fails', async () => {
      // Arrange - Chuẩn bị dữ liệu với invalid code
      const code = 'invalid-auth-code'
      const state = Buffer.from(JSON.stringify({ userAgent: 'Test', ip: '2.2.2.2' })).toString('base64')

      const tokenError = new Error('Invalid authorization code')
      mockOAuth2Client.getToken.mockRejectedValue(tokenError)

      // Spy on console.error
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation()

      // Act & Assert - Thực hiện callback và kiểm tra lỗi
      await expect(service.googleCallback({ code, state })).rejects.toThrow('Invalid authorization code')

      expect(consoleErrorSpy).toHaveBeenCalledWith('Error in google callback:', tokenError)

      consoleErrorSpy.mockRestore()
    })

    it('should throw error when Google API fails', async () => {
      // Arrange - Chuẩn bị dữ liệu
      const code = 'auth-code-api-error'
      const state = Buffer.from(JSON.stringify({ userAgent: 'Test', ip: '3.3.3.3' })).toString('base64')

      const mockTokens = { access_token: 'access-token', refresh_token: 'refresh-token' }
      const apiError = new Error('Google API error')

      mockOAuth2Client.getToken.mockResolvedValue({ tokens: mockTokens })

      // Mock google.oauth2 to throw error
      const mockUserinfoGet = jest.fn().mockRejectedValue(apiError)
      ;(google.oauth2 as jest.Mock).mockReturnValue({
        userinfo: { get: mockUserinfoGet },
      })

      // Spy on console.error
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation()

      // Act & Assert - Thực hiện callback và kiểm tra lỗi
      await expect(service.googleCallback({ code, state })).rejects.toThrow('Google API error')

      expect(consoleErrorSpy).toHaveBeenCalledWith('Error in google callback:', apiError)

      consoleErrorSpy.mockRestore()
    })

    it('should throw error when user creation fails', async () => {
      // Arrange - Chuẩn bị dữ liệu
      const code = 'auth-code-create-error'
      const state = Buffer.from(JSON.stringify({ userAgent: 'Test', ip: '4.4.4.4' })).toString('base64')

      const mockTokens = { access_token: 'access-token', refresh_token: 'refresh-token' }
      const mockGoogleUser = createMockGoogleUserInfo({ email: 'error@example.com' })
      const dbError = new Error('Database error: Failed to create user')

      mockOAuth2Client.getToken.mockResolvedValue({ tokens: mockTokens })
      mockAuthRepository.findUniqueUserIncludeRole.mockResolvedValue(null)
      mockSharedRoleRepository.getClientRoleId.mockResolvedValue(2)
      mockHashingService.hash.mockResolvedValue('hashed-password')
      mockAuthRepository.createUserIncludeRole.mockRejectedValue(dbError)

      // Mock google.oauth2
      const mockUserinfoGet = jest.fn().mockResolvedValue({ data: mockGoogleUser })
      ;(google.oauth2 as jest.Mock).mockReturnValue({
        userinfo: { get: mockUserinfoGet },
      })

      // Spy on console.error
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation()

      // Act & Assert - Thực hiện callback và kiểm tra lỗi
      await expect(service.googleCallback({ code, state })).rejects.toThrow('Database error: Failed to create user')

      expect(consoleErrorSpy).toHaveBeenCalledWith('Error in google callback:', dbError)

      consoleErrorSpy.mockRestore()
    })

    it('should throw error when device creation fails', async () => {
      // Arrange - Chuẩn bị dữ liệu
      const code = 'auth-code-device-error'
      const state = Buffer.from(JSON.stringify({ userAgent: 'Test', ip: '5.5.5.5' })).toString('base64')

      const mockTokens = { access_token: 'access-token', refresh_token: 'refresh-token' }
      const mockGoogleUser = createMockGoogleUserInfo()
      const mockUser = createMockUser()
      const deviceError = new Error('Failed to create device')

      mockOAuth2Client.getToken.mockResolvedValue({ tokens: mockTokens })
      mockAuthRepository.findUniqueUserIncludeRole.mockResolvedValue(mockUser)
      mockAuthRepository.createDevice.mockRejectedValue(deviceError)

      // Mock google.oauth2
      const mockUserinfoGet = jest.fn().mockResolvedValue({ data: mockGoogleUser })
      ;(google.oauth2 as jest.Mock).mockReturnValue({
        userinfo: { get: mockUserinfoGet },
      })

      // Spy on console.error
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation()

      // Act & Assert - Thực hiện callback và kiểm tra lỗi
      await expect(service.googleCallback({ code, state })).rejects.toThrow('Failed to create device')

      expect(consoleErrorSpy).toHaveBeenCalledWith('Error in google callback:', deviceError)

      consoleErrorSpy.mockRestore()
    })

    it('should throw error when token generation fails', async () => {
      // Arrange - Chuẩn bị dữ liệu
      const code = 'auth-code-token-error'
      const state = Buffer.from(JSON.stringify({ userAgent: 'Test', ip: '6.6.6.6' })).toString('base64')

      const mockTokens = { access_token: 'access-token', refresh_token: 'refresh-token' }
      const mockGoogleUser = createMockGoogleUserInfo()
      const mockUser = createMockUser()
      const mockDevice = createMockDevice()
      const tokenError = new Error('Failed to generate tokens')

      mockOAuth2Client.getToken.mockResolvedValue({ tokens: mockTokens })
      mockAuthRepository.findUniqueUserIncludeRole.mockResolvedValue(mockUser)
      mockAuthRepository.createDevice.mockResolvedValue(mockDevice)
      mockAuthService.generateTokens.mockRejectedValue(tokenError)

      // Mock google.oauth2
      const mockUserinfoGet = jest.fn().mockResolvedValue({ data: mockGoogleUser })
      ;(google.oauth2 as jest.Mock).mockReturnValue({
        userinfo: { get: mockUserinfoGet },
      })

      // Spy on console.error
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation()

      // Act & Assert - Thực hiện callback và kiểm tra lỗi
      await expect(service.googleCallback({ code, state })).rejects.toThrow('Failed to generate tokens')

      expect(consoleErrorSpy).toHaveBeenCalledWith('Error in google callback:', tokenError)

      consoleErrorSpy.mockRestore()
    })

    it('should throw error when getClientRoleId fails', async () => {
      // Arrange - Chuẩn bị dữ liệu
      const code = 'auth-code-role-error'
      const state = Buffer.from(JSON.stringify({ userAgent: 'Test', ip: '7.7.7.7' })).toString('base64')

      const mockTokens = { access_token: 'access-token', refresh_token: 'refresh-token' }
      const mockGoogleUser = createMockGoogleUserInfo({ email: 'newuser@example.com' })
      const roleError = new Error('Failed to get client role ID')

      mockOAuth2Client.getToken.mockResolvedValue({ tokens: mockTokens })
      mockAuthRepository.findUniqueUserIncludeRole.mockResolvedValue(null)
      mockSharedRoleRepository.getClientRoleId.mockRejectedValue(roleError)

      // Mock google.oauth2
      const mockUserinfoGet = jest.fn().mockResolvedValue({ data: mockGoogleUser })
      ;(google.oauth2 as jest.Mock).mockReturnValue({
        userinfo: { get: mockUserinfoGet },
      })

      // Spy on console.error
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation()

      // Act & Assert - Thực hiện callback và kiểm tra lỗi
      await expect(service.googleCallback({ code, state })).rejects.toThrow('Failed to get client role ID')

      expect(consoleErrorSpy).toHaveBeenCalledWith('Error in google callback:', roleError)

      consoleErrorSpy.mockRestore()
    })

    it('should throw error when password hashing fails', async () => {
      // Arrange - Chuẩn bị dữ liệu
      const code = 'auth-code-hash-error'
      const state = Buffer.from(JSON.stringify({ userAgent: 'Test', ip: '8.8.8.8' })).toString('base64')

      const mockTokens = { access_token: 'access-token', refresh_token: 'refresh-token' }
      const mockGoogleUser = createMockGoogleUserInfo({ email: 'newuser2@example.com' })
      const hashError = new Error('Failed to hash password')

      mockOAuth2Client.getToken.mockResolvedValue({ tokens: mockTokens })
      mockAuthRepository.findUniqueUserIncludeRole.mockResolvedValue(null)
      mockSharedRoleRepository.getClientRoleId.mockResolvedValue(2)
      mockHashingService.hash.mockRejectedValue(hashError)

      // Mock google.oauth2
      const mockUserinfoGet = jest.fn().mockResolvedValue({ data: mockGoogleUser })
      ;(google.oauth2 as jest.Mock).mockReturnValue({
        userinfo: { get: mockUserinfoGet },
      })

      // Spy on console.error
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation()

      // Act & Assert - Thực hiện callback và kiểm tra lỗi
      await expect(service.googleCallback({ code, state })).rejects.toThrow('Failed to hash password')

      expect(consoleErrorSpy).toHaveBeenCalledWith('Error in google callback:', hashError)

      consoleErrorSpy.mockRestore()
    })
  })
})
