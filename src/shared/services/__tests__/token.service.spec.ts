import { JwtService } from '@nestjs/jwt'
import { Test, TestingModule } from '@nestjs/testing'
import envConfig from 'src/shared/config'
import { AccessTokenPayloadCreate, RefreshTokenPayloadCreate } from 'src/shared/types/jwt.type'
import { v4 as uuid } from 'uuid'
import { TokenService } from '../token.service'

// Mock uuid
jest.mock('uuid')

describe('TokenService', () => {
  let service: TokenService
  let mockJwtService: jest.Mocked<JwtService>

  // Test data factories
  const createTestData = {
    accessTokenPayload: (overrides = {}): AccessTokenPayloadCreate => ({
      userId: 1,
      roleId: 2,
      deviceId: 1,
      roleName: 'USER',
      ...overrides,
    }),
    refreshTokenPayload: (overrides = {}): RefreshTokenPayloadCreate => ({
      userId: 1,
      ...overrides,
    }),
    signedToken: () => 'signed-jwt-token-123',
    verifiedAccessToken: (overrides = {}) => ({
      userId: 1,
      roleId: 2,
      deviceId: 1,
      roleName: 'USER',
      uuid: 'mocked-uuid-1234',
      exp: Math.floor(Date.now() / 1000) + 3600,
      iat: Math.floor(Date.now() / 1000),
      ...overrides,
    }),
    verifiedRefreshToken: (overrides = {}) => ({
      userId: 1,
      uuid: 'mocked-uuid-1234',
      exp: Math.floor(Date.now() / 1000) + 604800,
      iat: Math.floor(Date.now() / 1000),
      ...overrides,
    }),
  }

  beforeEach(async () => {
    // Mock uuid
    ;(uuid as jest.Mock).mockReturnValue('mocked-uuid-1234')

    // Mock JwtService
    mockJwtService = {
      sign: jest.fn(),
      signAsync: jest.fn(),
      verify: jest.fn(),
      verifyAsync: jest.fn(),
      decode: jest.fn(),
    } as any

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TokenService,
        {
          provide: JwtService,
          useValue: mockJwtService,
        },
      ],
    }).compile()

    service = module.get<TokenService>(TokenService)
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  describe('signAccessToken', () => {
    it('should sign access token with correct payload and options', () => {
      // Arrange - Chuẩn bị payload và mock return value
      const payload = createTestData.accessTokenPayload()
      const expectedToken = createTestData.signedToken()

      mockJwtService.sign.mockReturnValue(expectedToken)

      // Act - Thực hiện sign access token
      const result = service.signAccessToken(payload)

      // Assert - Kiểm tra kết quả
      expect(result).toBe(expectedToken)
      expect(mockJwtService.sign).toHaveBeenCalledWith(
        {
          ...payload,
          uuid: 'mocked-uuid-1234',
        },
        {
          secret: envConfig.ACCESS_TOKEN_SECRET,
          expiresIn: envConfig.ACCESS_TOKEN_EXPIRES_IN,
          algorithm: 'HS256',
        },
      )
    })

    it('should include uuid in access token payload', () => {
      // Arrange - Chuẩn bị payload
      const payload = createTestData.accessTokenPayload({ userId: 999 })

      mockJwtService.sign.mockReturnValue('token')

      // Act - Thực hiện sign access token
      service.signAccessToken(payload)

      // Assert - Kiểm tra uuid được thêm vào payload
      expect(mockJwtService.sign).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 999,
          uuid: 'mocked-uuid-1234',
        }),
        expect.any(Object),
      )
    })

    it('should use HS256 algorithm for access token', () => {
      // Arrange - Chuẩn bị payload
      const payload = createTestData.accessTokenPayload()

      mockJwtService.sign.mockReturnValue('token')

      // Act - Thực hiện sign access token
      service.signAccessToken(payload)

      // Assert - Kiểm tra algorithm
      expect(mockJwtService.sign).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({
          algorithm: 'HS256',
        }),
      )
    })
  })

  describe('signRefreshToken', () => {
    it('should sign refresh token with default expiresIn', () => {
      // Arrange - Chuẩn bị payload không có expiresIn
      const payload = createTestData.refreshTokenPayload()
      const expectedToken = createTestData.signedToken()

      mockJwtService.sign.mockReturnValue(expectedToken)

      // Act - Thực hiện sign refresh token
      const result = service.signRefreshToken(payload)

      // Assert - Kiểm tra kết quả
      expect(result).toBe(expectedToken)
      expect(mockJwtService.sign).toHaveBeenCalledWith(
        {
          ...payload,
          uuid: 'mocked-uuid-1234',
        },
        {
          secret: envConfig.REFRESH_TOKEN_SECRET,
          expiresIn: envConfig.REFRESH_TOKEN_EXPIRES_IN,
          algorithm: 'HS256',
        },
      )
    })

    it('should sign refresh token with custom expiresIn', () => {
      // Arrange - Chuẩn bị payload với custom expiresIn
      const payload = createTestData.refreshTokenPayload()
      const customExpiresIn = 86400 // 1 day

      mockJwtService.sign.mockReturnValue('token')

      // Act - Thực hiện sign refresh token với custom expiresIn
      service.signRefreshToken(payload, customExpiresIn)

      // Assert - Kiểm tra custom expiresIn được sử dụng
      expect(mockJwtService.sign).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({
          expiresIn: customExpiresIn,
        }),
      )
    })

    it('should include uuid in refresh token payload', () => {
      // Arrange - Chuẩn bị payload
      const payload = createTestData.refreshTokenPayload({ userId: 999 })

      mockJwtService.sign.mockReturnValue('token')

      // Act - Thực hiện sign refresh token
      service.signRefreshToken(payload)

      // Assert - Kiểm tra uuid được thêm vào payload
      expect(mockJwtService.sign).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 999,
          uuid: 'mocked-uuid-1234',
        }),
        expect.any(Object),
      )
    })

    it('should use HS256 algorithm for refresh token', () => {
      // Arrange - Chuẩn bị payload
      const payload = createTestData.refreshTokenPayload()

      mockJwtService.sign.mockReturnValue('token')

      // Act - Thực hiện sign refresh token
      service.signRefreshToken(payload)

      // Assert - Kiểm tra algorithm
      expect(mockJwtService.sign).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({
          algorithm: 'HS256',
        }),
      )
    })

    it('should use expiresIn 0 when passed as parameter', () => {
      // Arrange - Chuẩn bị payload với expiresIn = 0
      const payload = createTestData.refreshTokenPayload()

      mockJwtService.sign.mockReturnValue('token')

      // Act - Thực hiện sign refresh token với expiresIn = 0
      service.signRefreshToken(payload, 0)

      // Assert - Kiểm tra expiresIn = 0 được sử dụng
      expect(mockJwtService.sign).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({
          expiresIn: 0,
        }),
      )
    })
  })

  describe('verifyAccessToken', () => {
    it('should verify access token successfully', async () => {
      // Arrange - Chuẩn bị token và mock verified payload
      const token = 'valid-access-token'
      const verifiedPayload = createTestData.verifiedAccessToken()

      mockJwtService.verifyAsync.mockResolvedValue(verifiedPayload)

      // Act - Thực hiện verify access token
      const result = await service.verifyAccessToken(token)

      // Assert - Kiểm tra kết quả
      expect(result).toEqual(verifiedPayload)
      expect(mockJwtService.verifyAsync).toHaveBeenCalledWith(token, {
        secret: envConfig.ACCESS_TOKEN_SECRET,
      })
    })

    it('should use correct secret for access token verification', async () => {
      // Arrange - Chuẩn bị token
      const token = 'valid-access-token'

      mockJwtService.verifyAsync.mockResolvedValue(createTestData.verifiedAccessToken())

      // Act - Thực hiện verify access token
      await service.verifyAccessToken(token)

      // Assert - Kiểm tra secret được sử dụng
      expect(mockJwtService.verifyAsync).toHaveBeenCalledWith(
        token,
        expect.objectContaining({
          secret: envConfig.ACCESS_TOKEN_SECRET,
        }),
      )
    })
  })

  describe('verifyRefreshToken', () => {
    it('should verify refresh token successfully', async () => {
      // Arrange - Chuẩn bị token và mock verified payload
      const token = 'valid-refresh-token'
      const verifiedPayload = createTestData.verifiedRefreshToken()

      mockJwtService.verifyAsync.mockResolvedValue(verifiedPayload)

      // Act - Thực hiện verify refresh token
      const result = await service.verifyRefreshToken(token)

      // Assert - Kiểm tra kết quả
      expect(result).toEqual(verifiedPayload)
      expect(mockJwtService.verifyAsync).toHaveBeenCalledWith(token, {
        secret: envConfig.REFRESH_TOKEN_SECRET,
      })
    })

    it('should use correct secret for refresh token verification', async () => {
      // Arrange - Chuẩn bị token
      const token = 'valid-refresh-token'

      mockJwtService.verifyAsync.mockResolvedValue(createTestData.verifiedRefreshToken())

      // Act - Thực hiện verify refresh token
      await service.verifyRefreshToken(token)

      // Assert - Kiểm tra secret được sử dụng
      expect(mockJwtService.verifyAsync).toHaveBeenCalledWith(
        token,
        expect.objectContaining({
          secret: envConfig.REFRESH_TOKEN_SECRET,
        }),
      )
    })
  })
})
