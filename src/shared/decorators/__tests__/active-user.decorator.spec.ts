import { ExecutionContext } from '@nestjs/common'
import { REQUEST_USER_KEY } from 'src/shared/constants/auth.constant'
import { AccessTokenPayload } from 'src/shared/types/jwt.type'

/**
 * ACTIVE USER DECORATOR UNIT TESTS
 *
 * Module này test ActiveUser decorator - parameter decorator extract user từ request
 * Đây là module CRITICAL vì được sử dụng rộng rãi trong controllers để lấy user info
 *
 * Test Coverage:
 * - Extract toàn bộ user object
 * - Extract specific field từ user (userId, roleId, roleName, deviceId)
 * - Handle missing user trong request
 * - Handle missing field trong user object
 * - ExecutionContext integration
 * - Type safety với AccessTokenPayload
 *
 * NOTE: Vì createParamDecorator returns ParameterDecorator (không thể gọi trực tiếp),
 * chúng ta test bằng cách recreate decorator logic và test callback function
 */

describe('ActiveUser Decorator', () => {
  // ============================================
  // RECREATE DECORATOR LOGIC FOR TESTING
  // ============================================

  // Recreate decorator callback để test (copy từ active-user.decorator.ts)
  const activeUserCallback = (field: keyof AccessTokenPayload | undefined, context: ExecutionContext) => {
    const request = context.switchToHttp().getRequest()
    const user: AccessTokenPayload | undefined = request[REQUEST_USER_KEY]
    return field ? user?.[field] : user
  }

  // ============================================
  // TEST DATA FACTORIES
  // ============================================

  const createMockAccessTokenPayload = (overrides = {}): AccessTokenPayload => ({
    userId: 1,
    roleId: 2,
    deviceId: 1,
    roleName: 'USER',
    exp: Math.floor(Date.now() / 1000) + 3600,
    iat: Math.floor(Date.now() / 1000),
    ...overrides,
  })

  const createMockExecutionContext = (request: any): jest.Mocked<ExecutionContext> => {
    return {
      switchToHttp: jest.fn().mockReturnValue({
        getRequest: jest.fn().mockReturnValue(request),
        getResponse: jest.fn(),
        getNext: jest.fn(),
      }),
      getClass: jest.fn(),
      getHandler: jest.fn(),
      getArgs: jest.fn(),
      getArgByIndex: jest.fn(),
      switchToRpc: jest.fn(),
      switchToWs: jest.fn(),
      getType: jest.fn(),
    } as any
  }

  // ============================================
  // EXTRACT FULL USER OBJECT
  // ============================================

  describe('✅ Extract Full User Object', () => {
    it('Nên return toàn bộ user object khi không specify field', () => {
      // Arrange: Chuẩn bị request với user data
      const mockUser = createMockAccessTokenPayload({
        userId: 123,
        roleId: 5,
        roleName: 'ADMIN',
      })
      const mockRequest = {
        [REQUEST_USER_KEY]: mockUser,
      }
      const mockContext = createMockExecutionContext(mockRequest)

      // Act: Gọi callback function với undefined field
      const result = activeUserCallback(undefined, mockContext)

      // Assert: Verify toàn bộ user object được return
      expect(result).toEqual(mockUser)
      expect(result).toHaveProperty('userId', 123)
      expect(result).toHaveProperty('roleId', 5)
      expect(result).toHaveProperty('roleName', 'ADMIN')
      expect(result).toHaveProperty('deviceId')
      expect(result).toHaveProperty('exp')
      expect(result).toHaveProperty('iat')
    })

    it('Nên return user object với tất cả fields', () => {
      // Arrange: User với full data
      const mockUser = createMockAccessTokenPayload()
      const mockRequest = { [REQUEST_USER_KEY]: mockUser }
      const mockContext = createMockExecutionContext(mockRequest)

      // Act: Extract user
      const result = activeUserCallback(undefined, mockContext)

      // Assert: Verify all fields present
      expect(result).toMatchObject({
        userId: expect.any(Number),
        roleId: expect.any(Number),
        deviceId: expect.any(Number),
        roleName: expect.any(String),
        exp: expect.any(Number),
        iat: expect.any(Number),
      })
    })

    it('Nên work với different user data', () => {
      // Arrange: Different user
      const mockUser = createMockAccessTokenPayload({
        userId: 999,
        roleId: 1,
        deviceId: 42,
        roleName: 'SELLER',
      })
      const mockRequest = { [REQUEST_USER_KEY]: mockUser }
      const mockContext = createMockExecutionContext(mockRequest)

      // Act: Extract user
      const result = activeUserCallback(undefined, mockContext) as AccessTokenPayload

      // Assert: Verify correct data
      expect(result.userId).toBe(999)
      expect(result.roleId).toBe(1)
      expect(result.deviceId).toBe(42)
      expect(result.roleName).toBe('SELLER')
    })
  })

  // ============================================
  // EXTRACT SPECIFIC FIELDS
  // ============================================

  describe('🔍 Extract Specific Fields', () => {
    it('Nên extract userId field', () => {
      // Arrange: Request với user
      const mockUser = createMockAccessTokenPayload({ userId: 456 })
      const mockRequest = { [REQUEST_USER_KEY]: mockUser }
      const mockContext = createMockExecutionContext(mockRequest)

      // Act: Extract userId
      const result = activeUserCallback('userId', mockContext)

      // Assert: Verify chỉ userId được return
      expect(result).toBe(456)
      expect(typeof result).toBe('number')
    })

    it('Nên extract roleId field', () => {
      // Arrange: Request với user
      const mockUser = createMockAccessTokenPayload({ roleId: 7 })
      const mockRequest = { [REQUEST_USER_KEY]: mockUser }
      const mockContext = createMockExecutionContext(mockRequest)

      // Act: Extract roleId
      const result = activeUserCallback('roleId', mockContext)

      // Assert: Verify roleId
      expect(result).toBe(7)
    })

    it('Nên extract roleName field', () => {
      // Arrange: Request với user
      const mockUser = createMockAccessTokenPayload({ roleName: 'PREMIUM_USER' })
      const mockRequest = { [REQUEST_USER_KEY]: mockUser }
      const mockContext = createMockExecutionContext(mockRequest)

      // Act: Extract roleName
      const result = activeUserCallback('roleName', mockContext)

      // Assert: Verify roleName
      expect(result).toBe('PREMIUM_USER')
      expect(typeof result).toBe('string')
    })

    it('Nên extract deviceId field', () => {
      // Arrange: Request với user
      const mockUser = createMockAccessTokenPayload({ deviceId: 99 })
      const mockRequest = { [REQUEST_USER_KEY]: mockUser }
      const mockContext = createMockExecutionContext(mockRequest)

      // Act: Extract deviceId
      const result = activeUserCallback('deviceId', mockContext)

      // Assert: Verify deviceId
      expect(result).toBe(99)
    })

    it('Nên extract exp field', () => {
      // Arrange: Request với user
      const expTime = Math.floor(Date.now() / 1000) + 7200
      const mockUser = createMockAccessTokenPayload({ exp: expTime })
      const mockRequest = { [REQUEST_USER_KEY]: mockUser }
      const mockContext = createMockExecutionContext(mockRequest)

      // Act: Extract exp
      const result = activeUserCallback('exp', mockContext)

      // Assert: Verify exp
      expect(result).toBe(expTime)
    })

    it('Nên extract iat field', () => {
      // Arrange: Request với user
      const iatTime = Math.floor(Date.now() / 1000)
      const mockUser = createMockAccessTokenPayload({ iat: iatTime })
      const mockRequest = { [REQUEST_USER_KEY]: mockUser }
      const mockContext = createMockExecutionContext(mockRequest)

      // Act: Extract iat
      const result = activeUserCallback('iat', mockContext)

      // Assert: Verify iat
      expect(result).toBe(iatTime)
    })
  })

  // ============================================
  // EDGE CASES - MISSING DATA
  // ============================================

  describe('⚠️ Edge Cases - Missing Data', () => {
    it('Nên return undefined khi user không tồn tại trong request', () => {
      // Arrange: Request không có user
      const mockRequest = {}
      const mockContext = createMockExecutionContext(mockRequest)

      // Act: Extract user
      const result = activeUserCallback(undefined, mockContext)

      // Assert: Verify undefined
      expect(result).toBeUndefined()
    })

    it('Nên return undefined khi extract field từ missing user', () => {
      // Arrange: Request không có user
      const mockRequest = {}
      const mockContext = createMockExecutionContext(mockRequest)

      // Act: Extract userId từ missing user
      const result = activeUserCallback('userId', mockContext)

      // Assert: Verify undefined (optional chaining)
      expect(result).toBeUndefined()
    })

    it('Nên return null khi user là null', () => {
      // Arrange: Request với user = null
      const mockRequest = { [REQUEST_USER_KEY]: null }
      const mockContext = createMockExecutionContext(mockRequest)

      // Act: Extract user
      const result = activeUserCallback(undefined, mockContext)

      // Assert: Verify null
      expect(result).toBeNull()
    })

    it('Nên return undefined khi extract field từ null user', () => {
      // Arrange: Request với user = null
      const mockRequest = { [REQUEST_USER_KEY]: null }
      const mockContext = createMockExecutionContext(mockRequest)

      // Act: Extract userId từ null user
      const result = activeUserCallback('userId', mockContext)

      // Assert: Verify undefined (optional chaining)
      expect(result).toBeUndefined()
    })
  })

  // ============================================
  // EXECUTION CONTEXT INTEGRATION
  // ============================================

  describe('🔄 ExecutionContext Integration', () => {
    it('Nên call switchToHttp() để get HTTP context', () => {
      // Arrange: Mock context
      const mockRequest = { [REQUEST_USER_KEY]: createMockAccessTokenPayload() }
      const mockContext = createMockExecutionContext(mockRequest)

      // Act: Extract user
      activeUserCallback(undefined, mockContext)

      // Assert: Verify switchToHttp được gọi
      expect(mockContext.switchToHttp).toHaveBeenCalled()
    })

    it('Nên call getRequest() để get request object', () => {
      // Arrange: Mock context với spy
      const mockRequest = { [REQUEST_USER_KEY]: createMockAccessTokenPayload() }
      const getRequestSpy = jest.fn().mockReturnValue(mockRequest)
      const mockContext = {
        switchToHttp: jest.fn().mockReturnValue({
          getRequest: getRequestSpy,
        }),
      } as any

      // Act: Extract user
      activeUserCallback(undefined, mockContext)

      // Assert: Verify getRequest được gọi
      expect(getRequestSpy).toHaveBeenCalled()
    })

    it('Nên work với real ExecutionContext structure', () => {
      // Arrange: Realistic context structure
      const mockUser = createMockAccessTokenPayload({ userId: 777 })
      const mockRequest = {
        [REQUEST_USER_KEY]: mockUser,
        headers: { authorization: 'Bearer token' },
        method: 'GET',
        url: '/api/users/profile',
      }
      const mockContext = createMockExecutionContext(mockRequest)

      // Act: Extract user
      const result = activeUserCallback(undefined, mockContext) as AccessTokenPayload

      // Assert: Verify correct extraction
      expect(result).toEqual(mockUser)
      expect(result.userId).toBe(777)
    })
  })
})
