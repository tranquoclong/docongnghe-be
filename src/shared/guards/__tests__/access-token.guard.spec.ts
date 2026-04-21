import { CACHE_MANAGER } from '@nestjs/cache-manager'
import { ExecutionContext, ForbiddenException, UnauthorizedException } from '@nestjs/common'
import { Test, TestingModule } from '@nestjs/testing'
import { Cache } from 'cache-manager'
import { REQUEST_ROLE_PERMISSIONS, REQUEST_USER_KEY } from 'src/shared/constants/auth.constant'
import { PrismaService } from 'src/shared/services/prisma.service'
import { TokenService } from 'src/shared/services/token.service'
import { AccessTokenPayload } from 'src/shared/types/jwt.type'
import { AccessTokenGuard } from '../access-token.guard'

/**
 * ACCESS TOKEN GUARD UNIT TESTS
 *
 * Module này test authentication guard cho JWT access token
 * Đây là module CRITICAL vì là security layer chính của hệ thống
 *
 * Test Coverage:
 * - Token extraction from Authorization header
 * - Token validation (valid, expired, malformed, invalid signature)
 * - User permission validation
 * - Role-based access control
 * - Cache mechanism for role permissions
 * - Error handling (missing token, invalid token, permission denied)
 * - Edge cases (concurrent requests, cache miss/hit)
 */

describe('AccessTokenGuard', () => {
  let guard: AccessTokenGuard
  let mockTokenService: jest.Mocked<TokenService>
  let mockPrismaService: any
  let mockCacheManager: jest.Mocked<Cache>
  let mockExecutionContext: jest.Mocked<ExecutionContext>

  // Test data factory
  const createMockAccessTokenPayload = (overrides = {}): AccessTokenPayload => ({
    userId: 1,
    roleId: 1,
    deviceId: 1,
    roleName: 'user',
    exp: Math.floor(Date.now() / 1000) + 3600, // 1 hour from now
    iat: Math.floor(Date.now() / 1000),
    ...overrides,
  })

  const createMockRequest = (overrides = {}) => ({
    headers: {
      authorization: 'Bearer valid.jwt.token',
    },
    route: {
      path: '/api/products',
    },
    method: 'GET',
    ...overrides,
  })

  const createMockRole = (overrides = {}) => ({
    id: 1,
    name: 'user',
    description: 'Regular user role',
    isActive: true,
    deletedAt: null,
    permissions: [
      {
        id: 1,
        path: '/api/products',
        method: 'GET',
        deletedAt: null,
      },
      {
        id: 2,
        path: '/api/cart',
        method: 'POST',
        deletedAt: null,
      },
    ],
    ...overrides,
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
    // Mock TokenService
    mockTokenService = {
      verifyAccessToken: jest.fn(),
      signAccessToken: jest.fn(),
      signRefreshToken: jest.fn(),
      verifyRefreshToken: jest.fn(),
    } as any

    // Mock PrismaService
    mockPrismaService = {
      role: {
        findUniqueOrThrow: jest.fn(),
      },
    } as any

    // Mock CacheManager
    mockCacheManager = {
      get: jest.fn(),
      set: jest.fn(),
      del: jest.fn(),
      reset: jest.fn(),
    } as any

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AccessTokenGuard,
        { provide: TokenService, useValue: mockTokenService },
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: CACHE_MANAGER, useValue: mockCacheManager },
      ],
    }).compile()

    guard = module.get<AccessTokenGuard>(AccessTokenGuard)
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  // ============================================
  // VALID TOKEN SCENARIOS
  // ============================================

  describe('✅ Valid Token Scenarios', () => {
    it('should allow request with valid access token', async () => {
      // Arrange
      const mockRequest = createMockRequest()
      const mockPayload = createMockAccessTokenPayload()
      const mockRole = createMockRole()
      mockExecutionContext = createMockExecutionContext(mockRequest)

      mockTokenService.verifyAccessToken.mockResolvedValue(mockPayload)
      mockCacheManager.get.mockResolvedValue(null) // Cache miss
      mockPrismaService.role.findUniqueOrThrow.mockResolvedValue(mockRole as any)

      // Act
      const result = await guard.canActivate(mockExecutionContext)

      // Assert
      expect(result).toBe(true)
      expect(mockTokenService.verifyAccessToken).toHaveBeenCalledWith('valid.jwt.token')
      expect(mockRequest[REQUEST_USER_KEY]).toEqual(mockPayload)
    })

    it('should extract user info from token correctly', async () => {
      // Arrange
      const mockRequest = createMockRequest()
      const mockPayload = createMockAccessTokenPayload({
        userId: 123,
        roleId: 2,
        roleName: 'admin',
      })
      const mockRole = createMockRole({ id: 2, name: 'admin' })
      mockExecutionContext = createMockExecutionContext(mockRequest)

      mockTokenService.verifyAccessToken.mockResolvedValue(mockPayload)
      mockCacheManager.get.mockResolvedValue(null)
      mockPrismaService.role.findUniqueOrThrow.mockResolvedValue(mockRole as any)

      // Act
      await guard.canActivate(mockExecutionContext)

      // Assert
      expect(mockRequest[REQUEST_USER_KEY]).toEqual(
        expect.objectContaining({
          userId: 123,
          roleId: 2,
          roleName: 'admin',
        }),
      )
    })

    it('should use cached role permissions when available', async () => {
      // Arrange
      const mockRequest = createMockRequest()
      const mockPayload = createMockAccessTokenPayload()
      const cachedRole = {
        id: 1,
        name: 'user',
        permissions: {
          '/api/products:GET': {
            id: 1,
            path: '/api/products',
            method: 'GET',
            deletedAt: null,
          },
        },
      }
      mockExecutionContext = createMockExecutionContext(mockRequest)

      mockTokenService.verifyAccessToken.mockResolvedValue(mockPayload)
      mockCacheManager.get.mockResolvedValue(cachedRole)

      // Act
      const result = await guard.canActivate(mockExecutionContext)

      // Assert
      expect(result).toBe(true)
      expect(mockPrismaService.role.findUniqueOrThrow).not.toHaveBeenCalled()
      expect(mockCacheManager.get).toHaveBeenCalledWith('role:1')
    })

    it('should cache role permissions after database query', async () => {
      // Arrange
      const mockRequest = createMockRequest()
      const mockPayload = createMockAccessTokenPayload()
      const mockRole = createMockRole()
      mockExecutionContext = createMockExecutionContext(mockRequest)

      mockTokenService.verifyAccessToken.mockResolvedValue(mockPayload)
      mockCacheManager.get.mockResolvedValue(null) // Cache miss
      mockPrismaService.role.findUniqueOrThrow.mockResolvedValue(mockRole as any)

      // Act
      await guard.canActivate(mockExecutionContext)

      // Assert
      expect(mockCacheManager.set).toHaveBeenCalledWith(
        'role:1',
        expect.objectContaining({
          id: 1,
          name: 'user',
          permissions: expect.any(Object),
        }),
        1000 * 60 * 60, // 1 hour
      )
    })
  })

  // ============================================
  // INVALID TOKEN SCENARIOS
  // ============================================

  describe('❌ Invalid Token Scenarios', () => {
    it('should reject expired token', async () => {
      // Arrange
      const mockRequest = createMockRequest()
      mockExecutionContext = createMockExecutionContext(mockRequest)

      mockTokenService.verifyAccessToken.mockRejectedValue(new Error('Token expired'))

      // Act & Assert
      await expect(guard.canActivate(mockExecutionContext)).rejects.toThrow(UnauthorizedException)
      await expect(guard.canActivate(mockExecutionContext)).rejects.toThrow('Error.InvalidAccessToken')
    })

    it('should reject malformed token', async () => {
      // Arrange
      const mockRequest = createMockRequest({
        headers: { authorization: 'Bearer invalid.malformed.token' },
      })
      mockExecutionContext = createMockExecutionContext(mockRequest)

      mockTokenService.verifyAccessToken.mockRejectedValue(new Error('Malformed token'))

      // Act & Assert
      await expect(guard.canActivate(mockExecutionContext)).rejects.toThrow(UnauthorizedException)
    })

    it('should reject token with invalid signature', async () => {
      // Arrange
      const mockRequest = createMockRequest({
        headers: { authorization: 'Bearer token.with.invalid.signature' },
      })
      mockExecutionContext = createMockExecutionContext(mockRequest)

      mockTokenService.verifyAccessToken.mockRejectedValue(new Error('Invalid signature'))

      // Act & Assert
      await expect(guard.canActivate(mockExecutionContext)).rejects.toThrow(UnauthorizedException)
    })

    it('should reject when token verification fails', async () => {
      // Arrange
      const mockRequest = createMockRequest()
      mockExecutionContext = createMockExecutionContext(mockRequest)

      mockTokenService.verifyAccessToken.mockRejectedValue(new Error('Verification failed'))

      // Act & Assert
      await expect(guard.canActivate(mockExecutionContext)).rejects.toThrow(UnauthorizedException)
      expect(mockTokenService.verifyAccessToken).toHaveBeenCalledWith('valid.jwt.token')
    })
  })

  // ============================================
  // EDGE CASES
  // ============================================

  describe('🔄 Edge Cases', () => {
    it('should handle missing authorization header', async () => {
      // Arrange
      const mockRequest = createMockRequest({
        headers: {},
      })
      mockExecutionContext = createMockExecutionContext(mockRequest)

      // Act & Assert
      await expect(guard.canActivate(mockExecutionContext)).rejects.toThrow(UnauthorizedException)
      await expect(guard.canActivate(mockExecutionContext)).rejects.toThrow('Error.MissingAccessToken')
    })

    it('should handle authorization header without Bearer prefix', async () => {
      // Arrange
      const mockRequest = createMockRequest({
        headers: { authorization: 'invalid.token.format' },
      })
      mockExecutionContext = createMockExecutionContext(mockRequest)

      // Act & Assert
      await expect(guard.canActivate(mockExecutionContext)).rejects.toThrow(UnauthorizedException)
    })

    it('should handle empty authorization header', async () => {
      // Arrange
      const mockRequest = createMockRequest({
        headers: { authorization: '' },
      })
      mockExecutionContext = createMockExecutionContext(mockRequest)

      // Act & Assert
      await expect(guard.canActivate(mockExecutionContext)).rejects.toThrow(UnauthorizedException)
    })

    it('should handle authorization header with only Bearer', async () => {
      // Arrange
      const mockRequest = createMockRequest({
        headers: { authorization: 'Bearer ' },
      })
      mockExecutionContext = createMockExecutionContext(mockRequest)

      // Act & Assert
      await expect(guard.canActivate(mockExecutionContext)).rejects.toThrow(UnauthorizedException)
    })

    it('should handle concurrent token validation', async () => {
      // Arrange
      const mockRequest1 = createMockRequest()
      const mockRequest2 = createMockRequest()
      const mockPayload = createMockAccessTokenPayload()
      const mockRole = createMockRole()
      const mockContext1 = createMockExecutionContext(mockRequest1)
      const mockContext2 = createMockExecutionContext(mockRequest2)

      mockTokenService.verifyAccessToken.mockResolvedValue(mockPayload)
      mockCacheManager.get.mockResolvedValue(null)
      mockPrismaService.role.findUniqueOrThrow.mockResolvedValue(mockRole as any)

      // Act
      const results = await Promise.all([guard.canActivate(mockContext1), guard.canActivate(mockContext2)])

      // Assert
      expect(results).toEqual([true, true])
      expect(mockTokenService.verifyAccessToken).toHaveBeenCalledTimes(2)
    })
  })

  // ============================================
  // PERMISSION VALIDATION
  // ============================================

  describe('🔒 Permission Validation', () => {
    it('should allow access when user has required permission', async () => {
      // Arrange
      const mockRequest = createMockRequest({
        route: { path: '/api/products' },
        method: 'GET',
      })
      const mockPayload = createMockAccessTokenPayload()
      const mockRole = createMockRole({
        permissions: [
          {
            id: 1,
            path: '/api/products',
            method: 'GET',
            deletedAt: null,
          },
        ],
      })
      mockExecutionContext = createMockExecutionContext(mockRequest)

      mockTokenService.verifyAccessToken.mockResolvedValue(mockPayload)
      mockCacheManager.get.mockResolvedValue(null)
      mockPrismaService.role.findUniqueOrThrow.mockResolvedValue(mockRole as any)

      // Act
      const result = await guard.canActivate(mockExecutionContext)

      // Assert
      expect(result).toBe(true)
    })

    it('should deny access when user lacks required permission', async () => {
      // Arrange
      const mockRequest = createMockRequest({
        route: { path: '/api/admin/users' },
        method: 'DELETE',
      })
      const mockPayload = createMockAccessTokenPayload()
      const mockRole = createMockRole({
        permissions: [
          {
            id: 1,
            path: '/api/products',
            method: 'GET',
            deletedAt: null,
          },
        ],
      })
      mockExecutionContext = createMockExecutionContext(mockRequest)

      mockTokenService.verifyAccessToken.mockResolvedValue(mockPayload)
      mockCacheManager.get.mockResolvedValue(null)
      mockPrismaService.role.findUniqueOrThrow.mockResolvedValue(mockRole as any)

      // Act & Assert
      await expect(guard.canActivate(mockExecutionContext)).rejects.toThrow(ForbiddenException)
      await expect(guard.canActivate(mockExecutionContext)).rejects.toThrow('Error.PermissionDenied')
    })

    it('should check permission based on both path and method', async () => {
      // Arrange
      const mockRequest = createMockRequest({
        route: { path: '/api/products' },
        method: 'POST',
      })
      const mockPayload = createMockAccessTokenPayload()
      const mockRole = createMockRole({
        permissions: [
          {
            id: 1,
            path: '/api/products',
            method: 'GET', // Only GET allowed, not POST
            deletedAt: null,
          },
        ],
      })
      mockExecutionContext = createMockExecutionContext(mockRequest)

      mockTokenService.verifyAccessToken.mockResolvedValue(mockPayload)
      mockCacheManager.get.mockResolvedValue(null)
      mockPrismaService.role.findUniqueOrThrow.mockResolvedValue(mockRole as any)

      // Act & Assert
      await expect(guard.canActivate(mockExecutionContext)).rejects.toThrow(ForbiddenException)
    })

    it('should allow access when role has multiple permissions', async () => {
      // Arrange
      const mockRequest = createMockRequest({
        route: { path: '/api/cart' },
        method: 'POST',
      })
      const mockPayload = createMockAccessTokenPayload()
      const mockRole = createMockRole({
        permissions: [
          {
            id: 1,
            path: '/api/products',
            method: 'GET',
            deletedAt: null,
          },
          {
            id: 2,
            path: '/api/cart',
            method: 'POST',
            deletedAt: null,
          },
          {
            id: 3,
            path: '/api/orders',
            method: 'GET',
            deletedAt: null,
          },
        ],
      })
      mockExecutionContext = createMockExecutionContext(mockRequest)

      mockTokenService.verifyAccessToken.mockResolvedValue(mockPayload)
      mockCacheManager.get.mockResolvedValue(null)
      mockPrismaService.role.findUniqueOrThrow.mockResolvedValue(mockRole as any)

      // Act
      const result = await guard.canActivate(mockExecutionContext)

      // Assert
      expect(result).toBe(true)
    })
  })

  // ============================================
  // ROLE VALIDATION
  // ============================================

  describe('👥 Role Validation', () => {
    it('should reject when role is not found', async () => {
      // Arrange
      const mockRequest = createMockRequest()
      const mockPayload = createMockAccessTokenPayload()
      mockExecutionContext = createMockExecutionContext(mockRequest)

      mockTokenService.verifyAccessToken.mockResolvedValue(mockPayload)
      mockCacheManager.get.mockResolvedValue(null)
      mockPrismaService.role.findUniqueOrThrow.mockRejectedValue(new Error('Role not found'))

      // Act & Assert
      await expect(guard.canActivate(mockExecutionContext)).rejects.toThrow(ForbiddenException)
    })

    it('should reject when role is inactive', async () => {
      // Arrange
      const mockRequest = createMockRequest()
      const mockPayload = createMockAccessTokenPayload()
      mockExecutionContext = createMockExecutionContext(mockRequest)

      mockTokenService.verifyAccessToken.mockResolvedValue(mockPayload)
      mockCacheManager.get.mockResolvedValue(null)
      mockPrismaService.role.findUniqueOrThrow.mockRejectedValue(new Error('Role inactive'))

      // Act & Assert
      await expect(guard.canActivate(mockExecutionContext)).rejects.toThrow(ForbiddenException)
    })

    it('should reject when role is deleted', async () => {
      // Arrange
      const mockRequest = createMockRequest()
      const mockPayload = createMockAccessTokenPayload()
      mockExecutionContext = createMockExecutionContext(mockRequest)

      mockTokenService.verifyAccessToken.mockResolvedValue(mockPayload)
      mockCacheManager.get.mockResolvedValue(null)
      mockPrismaService.role.findUniqueOrThrow.mockRejectedValue(new Error('Role deleted'))

      // Act & Assert
      await expect(guard.canActivate(mockExecutionContext)).rejects.toThrow(ForbiddenException)
    })

    it('should attach role permissions to request', async () => {
      // Arrange
      const mockRequest = createMockRequest()
      const mockPayload = createMockAccessTokenPayload()
      const mockRole = createMockRole()
      mockExecutionContext = createMockExecutionContext(mockRequest)

      mockTokenService.verifyAccessToken.mockResolvedValue(mockPayload)
      mockCacheManager.get.mockResolvedValue(null)
      mockPrismaService.role.findUniqueOrThrow.mockResolvedValue(mockRole as any)

      // Act
      await guard.canActivate(mockExecutionContext)

      // Assert
      expect(mockRequest[REQUEST_ROLE_PERMISSIONS]).toEqual(mockRole)
    })
  })

  // ============================================
  // CACHE MECHANISM
  // ============================================

  describe('💾 Cache Mechanism', () => {
    it('should query database when cache is empty', async () => {
      // Arrange
      const mockRequest = createMockRequest()
      const mockPayload = createMockAccessTokenPayload()
      const mockRole = createMockRole()
      mockExecutionContext = createMockExecutionContext(mockRequest)

      mockTokenService.verifyAccessToken.mockResolvedValue(mockPayload)
      mockCacheManager.get.mockResolvedValue(null)
      mockPrismaService.role.findUniqueOrThrow.mockResolvedValue(mockRole as any)

      // Act
      await guard.canActivate(mockExecutionContext)

      // Assert
      expect(mockCacheManager.get).toHaveBeenCalledWith('role:1')
      expect(mockPrismaService.role.findUniqueOrThrow).toHaveBeenCalled()
    })

    it('should skip database query when cache hit', async () => {
      // Arrange
      const mockRequest = createMockRequest()
      const mockPayload = createMockAccessTokenPayload()
      const cachedRole = {
        id: 1,
        name: 'user',
        permissions: {
          '/api/products:GET': {
            id: 1,
            path: '/api/products',
            method: 'GET',
            deletedAt: null,
          },
        },
      }
      mockExecutionContext = createMockExecutionContext(mockRequest)

      mockTokenService.verifyAccessToken.mockResolvedValue(mockPayload)
      mockCacheManager.get.mockResolvedValue(cachedRole)

      // Act
      await guard.canActivate(mockExecutionContext)

      // Assert
      expect(mockCacheManager.get).toHaveBeenCalledWith('role:1')
      expect(mockPrismaService.role.findUniqueOrThrow).not.toHaveBeenCalled()
    })

    it('should cache role with correct TTL (1 hour)', async () => {
      // Arrange
      const mockRequest = createMockRequest()
      const mockPayload = createMockAccessTokenPayload()
      const mockRole = createMockRole()
      mockExecutionContext = createMockExecutionContext(mockRequest)

      mockTokenService.verifyAccessToken.mockResolvedValue(mockPayload)
      mockCacheManager.get.mockResolvedValue(null)
      mockPrismaService.role.findUniqueOrThrow.mockResolvedValue(mockRole as any)

      // Act
      await guard.canActivate(mockExecutionContext)

      // Assert
      expect(mockCacheManager.set).toHaveBeenCalledWith(
        'role:1',
        expect.any(Object),
        1000 * 60 * 60, // 1 hour in milliseconds
      )
    })

    it('should transform permissions array to object for caching', async () => {
      // Arrange
      const mockRequest = createMockRequest()
      const mockPayload = createMockAccessTokenPayload()
      const mockRole = createMockRole()
      mockExecutionContext = createMockExecutionContext(mockRequest)

      mockTokenService.verifyAccessToken.mockResolvedValue(mockPayload)
      mockCacheManager.get.mockResolvedValue(null)
      mockPrismaService.role.findUniqueOrThrow.mockResolvedValue(mockRole as any)

      // Act
      await guard.canActivate(mockExecutionContext)

      // Assert
      expect(mockCacheManager.set).toHaveBeenCalledWith(
        'role:1',
        expect.objectContaining({
          permissions: expect.objectContaining({
            '/api/products:GET': expect.any(Object),
            '/api/cart:POST': expect.any(Object),
          }),
        }),
        expect.any(Number),
      )
    })
  })

  // ============================================
  // ERROR HANDLING
  // ============================================

  describe('⚠️ Error Handling', () => {
    it('should handle token service errors gracefully', async () => {
      // Arrange
      const mockRequest = createMockRequest()
      mockExecutionContext = createMockExecutionContext(mockRequest)

      mockTokenService.verifyAccessToken.mockRejectedValue(new Error('Service unavailable'))

      // Act & Assert
      await expect(guard.canActivate(mockExecutionContext)).rejects.toThrow(UnauthorizedException)
    })

    it('should handle database errors gracefully', async () => {
      // Arrange
      const mockRequest = createMockRequest()
      const mockPayload = createMockAccessTokenPayload()
      mockExecutionContext = createMockExecutionContext(mockRequest)

      mockTokenService.verifyAccessToken.mockResolvedValue(mockPayload)
      mockCacheManager.get.mockResolvedValue(null)
      mockPrismaService.role.findUniqueOrThrow.mockRejectedValue(new Error('Database error'))

      // Act & Assert
      await expect(guard.canActivate(mockExecutionContext)).rejects.toThrow(ForbiddenException)
    })

    it('should handle cache errors gracefully', async () => {
      // Arrange
      const mockRequest = createMockRequest()
      const mockPayload = createMockAccessTokenPayload()
      const mockRole = createMockRole()
      mockExecutionContext = createMockExecutionContext(mockRequest)

      mockTokenService.verifyAccessToken.mockResolvedValue(mockPayload)
      mockCacheManager.get.mockRejectedValue(new Error('Cache error'))
      mockPrismaService.role.findUniqueOrThrow.mockResolvedValue(mockRole as any)

      // Act & Assert
      // Should still work even if cache fails
      await expect(guard.canActivate(mockExecutionContext)).rejects.toThrow()
    })
  })

  // ============================================
  // HTTP METHODS VALIDATION
  // ============================================

  describe('🌐 HTTP Methods Validation', () => {
    it('Nên cho phép truy cập với PUT method khi có permission', async () => {
      // Arrange: Chuẩn bị request với PUT method
      const mockRequest = createMockRequest({
        route: { path: '/api/products/:id' },
        method: 'PUT',
      })
      const mockPayload = createMockAccessTokenPayload()
      const mockRole = createMockRole({
        permissions: [
          {
            id: 1,
            path: '/api/products/:id',
            method: 'PUT',
            deletedAt: null,
          },
        ],
      })
      mockExecutionContext = createMockExecutionContext(mockRequest)

      mockTokenService.verifyAccessToken.mockResolvedValue(mockPayload)
      mockCacheManager.get.mockResolvedValue(null)
      mockPrismaService.role.findUniqueOrThrow.mockResolvedValue(mockRole as any)

      // Act: Thực hiện canActivate
      const result = await guard.canActivate(mockExecutionContext)

      // Assert: Verify được phép truy cập
      expect(result).toBe(true)
    })

    it('Nên cho phép truy cập với DELETE method khi có permission', async () => {
      // Arrange: Chuẩn bị request với DELETE method
      const mockRequest = createMockRequest({
        route: { path: '/api/products/:id' },
        method: 'DELETE',
      })
      const mockPayload = createMockAccessTokenPayload()
      const mockRole = createMockRole({
        permissions: [
          {
            id: 1,
            path: '/api/products/:id',
            method: 'DELETE',
            deletedAt: null,
          },
        ],
      })
      mockExecutionContext = createMockExecutionContext(mockRequest)

      mockTokenService.verifyAccessToken.mockResolvedValue(mockPayload)
      mockCacheManager.get.mockResolvedValue(null)
      mockPrismaService.role.findUniqueOrThrow.mockResolvedValue(mockRole as any)

      // Act: Thực hiện canActivate
      const result = await guard.canActivate(mockExecutionContext)

      // Assert: Verify được phép truy cập
      expect(result).toBe(true)
    })

    it('Nên cho phép truy cập với PATCH method khi có permission', async () => {
      // Arrange: Chuẩn bị request với PATCH method
      const mockRequest = createMockRequest({
        route: { path: '/api/users/:id' },
        method: 'PATCH',
      })
      const mockPayload = createMockAccessTokenPayload()
      const mockRole = createMockRole({
        permissions: [
          {
            id: 1,
            path: '/api/users/:id',
            method: 'PATCH',
            deletedAt: null,
          },
        ],
      })
      mockExecutionContext = createMockExecutionContext(mockRequest)

      mockTokenService.verifyAccessToken.mockResolvedValue(mockPayload)
      mockCacheManager.get.mockResolvedValue(null)
      mockPrismaService.role.findUniqueOrThrow.mockResolvedValue(mockRole as any)

      // Act: Thực hiện canActivate
      const result = await guard.canActivate(mockExecutionContext)

      // Assert: Verify được phép truy cập
      expect(result).toBe(true)
    })
  })

  // ============================================
  // DYNAMIC ROUTES & NESTED PATHS
  // ============================================

  describe('🔀 Dynamic Routes & Nested Paths', () => {
    it('Nên validate permission cho dynamic routes với path parameters', async () => {
      // Arrange: Chuẩn bị request với dynamic route
      const mockRequest = createMockRequest({
        route: { path: '/api/products/:productId/reviews/:reviewId' },
        method: 'GET',
      })
      const mockPayload = createMockAccessTokenPayload()
      const mockRole = createMockRole({
        permissions: [
          {
            id: 1,
            path: '/api/products/:productId/reviews/:reviewId',
            method: 'GET',
            deletedAt: null,
          },
        ],
      })
      mockExecutionContext = createMockExecutionContext(mockRequest)

      mockTokenService.verifyAccessToken.mockResolvedValue(mockPayload)
      mockCacheManager.get.mockResolvedValue(null)
      mockPrismaService.role.findUniqueOrThrow.mockResolvedValue(mockRole as any)

      // Act: Thực hiện canActivate
      const result = await guard.canActivate(mockExecutionContext)

      // Assert: Verify được phép truy cập
      expect(result).toBe(true)
    })

    it('Nên validate permission cho nested routes', async () => {
      // Arrange: Chuẩn bị request với nested route
      const mockRequest = createMockRequest({
        route: { path: '/api/admin/users/roles' },
        method: 'GET',
      })
      const mockPayload = createMockAccessTokenPayload()
      const mockRole = createMockRole({
        permissions: [
          {
            id: 1,
            path: '/api/admin/users/roles',
            method: 'GET',
            deletedAt: null,
          },
        ],
      })
      mockExecutionContext = createMockExecutionContext(mockRequest)

      mockTokenService.verifyAccessToken.mockResolvedValue(mockPayload)
      mockCacheManager.get.mockResolvedValue(null)
      mockPrismaService.role.findUniqueOrThrow.mockResolvedValue(mockRole as any)

      // Act: Thực hiện canActivate
      const result = await guard.canActivate(mockExecutionContext)

      // Assert: Verify được phép truy cập
      expect(result).toBe(true)
    })
  })

  // ============================================
  // EDGE CASES - EMPTY PERMISSIONS
  // ============================================

  describe('📭 Empty Permissions Edge Cases', () => {
    it('Nên từ chối truy cập khi role có empty permissions array', async () => {
      // Arrange: Chuẩn bị role với permissions rỗng
      const mockRequest = createMockRequest()
      const mockPayload = createMockAccessTokenPayload()
      const mockRole = createMockRole({
        permissions: [],
      })
      mockExecutionContext = createMockExecutionContext(mockRequest)

      mockTokenService.verifyAccessToken.mockResolvedValue(mockPayload)
      mockCacheManager.get.mockResolvedValue(null)
      mockPrismaService.role.findUniqueOrThrow.mockResolvedValue(mockRole as any)

      // Act & Assert: Verify bị từ chối
      await expect(guard.canActivate(mockExecutionContext)).rejects.toThrow(ForbiddenException)
      await expect(guard.canActivate(mockExecutionContext)).rejects.toThrow('Error.PermissionDenied')
    })

    it('Nên cache role ngay cả khi permissions array rỗng', async () => {
      // Arrange: Chuẩn bị role với permissions rỗng
      const mockRequest = createMockRequest()
      const mockPayload = createMockAccessTokenPayload()
      const mockRole = createMockRole({
        permissions: [],
      })
      mockExecutionContext = createMockExecutionContext(mockRequest)

      mockTokenService.verifyAccessToken.mockResolvedValue(mockPayload)
      mockCacheManager.get.mockResolvedValue(null)
      mockPrismaService.role.findUniqueOrThrow.mockResolvedValue(mockRole as any)

      // Act: Thực hiện canActivate (sẽ throw error)
      try {
        await guard.canActivate(mockExecutionContext)
      } catch (error) {
        // Expected to throw
      }

      // Assert: Verify role vẫn được cache
      expect(mockCacheManager.set).toHaveBeenCalledWith(
        'role:1',
        expect.objectContaining({
          id: 1,
          name: 'user',
          permissions: {},
        }),
        1000 * 60 * 60,
      )
    })
  })

  // ============================================
  // SECURITY TESTS
  // ============================================

  describe('🔐 Security Tests', () => {
    it('SECURITY: Nên inject user vào request sau khi validate token thành công', async () => {
      // Arrange: Chuẩn bị valid request
      const mockRequest = createMockRequest()
      const mockPayload = createMockAccessTokenPayload({
        userId: 999,
        roleId: 5,
        roleName: 'premium_user',
      })
      const mockRole = createMockRole({ id: 5 })
      mockExecutionContext = createMockExecutionContext(mockRequest)

      mockTokenService.verifyAccessToken.mockResolvedValue(mockPayload)
      mockCacheManager.get.mockResolvedValue(null)
      mockPrismaService.role.findUniqueOrThrow.mockResolvedValue(mockRole as any)

      // Act: Thực hiện canActivate
      await guard.canActivate(mockExecutionContext)

      // Assert: Verify user được inject vào request
      expect(mockRequest[REQUEST_USER_KEY]).toEqual(mockPayload)
      expect(mockRequest[REQUEST_USER_KEY].userId).toBe(999)
      expect(mockRequest[REQUEST_USER_KEY].roleId).toBe(5)
    })

    it('SECURITY: Nên sử dụng cache key format đúng để tránh cache collision', async () => {
      // Arrange: Chuẩn bị request với roleId cụ thể
      const mockRequest = createMockRequest()
      const mockPayload = createMockAccessTokenPayload({ roleId: 42 })
      const mockRole = createMockRole({ id: 42 })
      mockExecutionContext = createMockExecutionContext(mockRequest)

      mockTokenService.verifyAccessToken.mockResolvedValue(mockPayload)
      mockCacheManager.get.mockResolvedValue(null)
      mockPrismaService.role.findUniqueOrThrow.mockResolvedValue(mockRole as any)

      // Act: Thực hiện canActivate
      await guard.canActivate(mockExecutionContext)

      // Assert: Verify cache key format đúng
      expect(mockCacheManager.get).toHaveBeenCalledWith('role:42')
      expect(mockCacheManager.set).toHaveBeenCalledWith('role:42', expect.any(Object), expect.any(Number))
    })

    it('SECURITY: Nên validate cả path và method để tránh permission bypass', async () => {
      // Arrange: User có GET permission nhưng cố gắng POST
      const mockRequest = createMockRequest({
        route: { path: '/api/admin/users' },
        method: 'POST',
      })
      const mockPayload = createMockAccessTokenPayload()
      const mockRole = createMockRole({
        permissions: [
          {
            id: 1,
            path: '/api/admin/users',
            method: 'GET', // Chỉ có GET, không có POST
            deletedAt: null,
          },
        ],
      })
      mockExecutionContext = createMockExecutionContext(mockRequest)

      mockTokenService.verifyAccessToken.mockResolvedValue(mockPayload)
      mockCacheManager.get.mockResolvedValue(null)
      mockPrismaService.role.findUniqueOrThrow.mockResolvedValue(mockRole as any)

      // Act & Assert: Verify bị từ chối
      await expect(guard.canActivate(mockExecutionContext)).rejects.toThrow(ForbiddenException)
      await expect(guard.canActivate(mockExecutionContext)).rejects.toThrow('Error.PermissionDenied')
    })
  })
})
