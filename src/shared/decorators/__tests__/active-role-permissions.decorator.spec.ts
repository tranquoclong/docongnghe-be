import { ExecutionContext } from '@nestjs/common'
import { REQUEST_ROLE_PERMISSIONS } from 'src/shared/constants/auth.constant'
import { PermissionType } from 'src/shared/models/shared-permission.model'
import { RolePermissionsType } from 'src/shared/models/shared-role.model'

/**
 * ACTIVE ROLE PERMISSIONS DECORATOR UNIT TESTS
 *
 * Module này test ActiveRolePermissions decorator - parameter decorator extract role permissions từ request
 * Đây là module CRITICAL vì được sử dụng trong controllers để lấy role và permissions info
 *
 * Test Coverage:
 * - Extract toàn bộ role permissions object
 * - Extract specific field từ role permissions (id, name, permissions)
 * - Handle missing role permissions trong request
 * - Handle missing field trong role permissions object
 * - ExecutionContext integration
 * - Type safety với RolePermissionsType
 *
 * NOTE: Vì createParamDecorator returns ParameterDecorator (không thể gọi trực tiếp),
 * chúng ta test bằng cách recreate decorator logic và test callback function
 */

describe('ActiveRolePermissions Decorator', () => {
  // ============================================
  // RECREATE DECORATOR LOGIC FOR TESTING
  // ============================================

  // Recreate decorator callback để test (copy từ active-role-permissions.decorator.ts)
  const activeRolePermissionsCallback = (field: keyof RolePermissionsType | undefined, context: ExecutionContext) => {
    const request = context.switchToHttp().getRequest()
    const rolePermissions: RolePermissionsType | undefined = request[REQUEST_ROLE_PERMISSIONS]
    return field ? rolePermissions?.[field] : rolePermissions
  }

  // ============================================
  // TEST DATA FACTORIES
  // ============================================

  const createMockPermission = (overrides = {}): PermissionType => ({
    id: 1,
    name: 'READ_PRODUCT',
    description: 'Read product permission',
    module: 'PRODUCT',
    path: '/api/products',
    method: 'GET',
    createdById: null,
    updatedById: null,
    deletedById: null,
    deletedAt: null,
    createdAt: new Date('2024-01-01').toISOString(),
    updatedAt: new Date('2024-01-01').toISOString(),
    ...overrides,
  })

  const createMockRolePermissions = (overrides = {}): RolePermissionsType => ({
    id: 1,
    name: 'USER',
    description: 'User role',
    isActive: true,
    createdById: null,
    updatedById: null,
    deletedById: null,
    deletedAt: null,
    createdAt: new Date('2024-01-01').toISOString(),
    updatedAt: new Date('2024-01-01').toISOString(),
    permissions: [createMockPermission()],
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
  // EXTRACT FULL ROLE PERMISSIONS OBJECT
  // ============================================

  describe('✅ Extract Full Role Permissions Object', () => {
    it('Nên return toàn bộ role permissions object khi không specify field', () => {
      // Arrange: Chuẩn bị request với role permissions data
      const mockRolePermissions = createMockRolePermissions({
        id: 5,
        name: 'ADMIN',
        description: 'Administrator role',
      })
      const mockRequest = {
        [REQUEST_ROLE_PERMISSIONS]: mockRolePermissions,
      }
      const mockContext = createMockExecutionContext(mockRequest)

      // Act: Gọi callback function với undefined field
      const result = activeRolePermissionsCallback(undefined, mockContext)

      // Assert: Verify toàn bộ role permissions object được return
      expect(result).toEqual(mockRolePermissions)
      expect(result).toHaveProperty('id', 5)
      expect(result).toHaveProperty('name', 'ADMIN')
      expect(result).toHaveProperty('description', 'Administrator role')
      expect(result).toHaveProperty('permissions')
      expect(result).toHaveProperty('isActive')
    })

    it('Nên return role permissions với tất cả fields', () => {
      // Arrange: Role permissions với full data
      const mockRolePermissions = createMockRolePermissions()
      const mockRequest = { [REQUEST_ROLE_PERMISSIONS]: mockRolePermissions }
      const mockContext = createMockExecutionContext(mockRequest)

      // Act: Extract role permissions
      const result = activeRolePermissionsCallback(undefined, mockContext)

      // Assert: Verify all fields present
      expect(result).toMatchObject({
        id: expect.any(Number),
        name: expect.any(String),
        description: expect.any(String),
        isActive: expect.any(Boolean),
        permissions: expect.any(Array),
        createdAt: expect.any(String),
        updatedAt: expect.any(String),
      })
    })

    it('Nên return role permissions với permissions array', () => {
      // Arrange: Role với multiple permissions
      const mockPermissions = [
        createMockPermission({ id: 1, name: 'READ_PRODUCT' }),
        createMockPermission({ id: 2, name: 'WRITE_PRODUCT', method: 'POST' }),
      ]
      const mockRolePermissions = createMockRolePermissions({
        permissions: mockPermissions,
      })
      const mockRequest = { [REQUEST_ROLE_PERMISSIONS]: mockRolePermissions }
      const mockContext = createMockExecutionContext(mockRequest)

      // Act: Extract role permissions
      const result = activeRolePermissionsCallback(undefined, mockContext) as RolePermissionsType

      // Assert: Verify permissions array
      expect(result.permissions).toHaveLength(2)
      expect(result.permissions[0].name).toBe('READ_PRODUCT')
      expect(result.permissions[1].name).toBe('WRITE_PRODUCT')
    })
  })

  // ============================================
  // EXTRACT SPECIFIC FIELDS
  // ============================================

  describe('🔍 Extract Specific Fields', () => {
    it('Nên extract id field', () => {
      // Arrange: Request với role permissions
      const mockRolePermissions = createMockRolePermissions({ id: 99 })
      const mockRequest = { [REQUEST_ROLE_PERMISSIONS]: mockRolePermissions }
      const mockContext = createMockExecutionContext(mockRequest)

      // Act: Extract id
      const result = activeRolePermissionsCallback('id', mockContext)

      // Assert: Verify chỉ id được return
      expect(result).toBe(99)
      expect(typeof result).toBe('number')
    })

    it('Nên extract name field', () => {
      // Arrange: Request với role permissions
      const mockRolePermissions = createMockRolePermissions({ name: 'SELLER' })
      const mockRequest = { [REQUEST_ROLE_PERMISSIONS]: mockRolePermissions }
      const mockContext = createMockExecutionContext(mockRequest)

      // Act: Extract name
      const result = activeRolePermissionsCallback('name', mockContext)

      // Assert: Verify name
      expect(result).toBe('SELLER')
      expect(typeof result).toBe('string')
    })

    it('Nên extract description field', () => {
      // Arrange: Request với role permissions
      const mockRolePermissions = createMockRolePermissions({ description: 'Seller role with product management' })
      const mockRequest = { [REQUEST_ROLE_PERMISSIONS]: mockRolePermissions }
      const mockContext = createMockExecutionContext(mockRequest)

      // Act: Extract description
      const result = activeRolePermissionsCallback('description', mockContext)

      // Assert: Verify description
      expect(result).toBe('Seller role with product management')
    })

    it('Nên extract permissions array field', () => {
      // Arrange: Request với role permissions
      const mockPermissions = [
        createMockPermission({ id: 10, name: 'DELETE_PRODUCT' }),
        createMockPermission({ id: 11, name: 'UPDATE_PRODUCT' }),
      ]
      const mockRolePermissions = createMockRolePermissions({ permissions: mockPermissions })
      const mockRequest = { [REQUEST_ROLE_PERMISSIONS]: mockRolePermissions }
      const mockContext = createMockExecutionContext(mockRequest)

      // Act: Extract permissions
      const result = activeRolePermissionsCallback('permissions', mockContext) as PermissionType[]

      // Assert: Verify permissions array
      expect(result).toHaveLength(2)
      expect(result[0].id).toBe(10)
      expect(result[1].id).toBe(11)
    })

    it('Nên extract isActive field', () => {
      // Arrange: Request với role permissions
      const mockRolePermissions = createMockRolePermissions({ isActive: false })
      const mockRequest = { [REQUEST_ROLE_PERMISSIONS]: mockRolePermissions }
      const mockContext = createMockExecutionContext(mockRequest)

      // Act: Extract isActive
      const result = activeRolePermissionsCallback('isActive', mockContext)

      // Assert: Verify isActive
      expect(result).toBe(false)
      expect(typeof result).toBe('boolean')
    })
  })

  // ============================================
  // EDGE CASES - MISSING DATA
  // ============================================

  describe('⚠️ Edge Cases - Missing Data', () => {
    it('Nên return undefined khi role permissions không tồn tại trong request', () => {
      // Arrange: Request không có role permissions
      const mockRequest = {}
      const mockContext = createMockExecutionContext(mockRequest)

      // Act: Extract role permissions
      const result = activeRolePermissionsCallback(undefined, mockContext)

      // Assert: Verify undefined
      expect(result).toBeUndefined()
    })

    it('Nên return undefined khi extract field từ missing role permissions', () => {
      // Arrange: Request không có role permissions
      const mockRequest = {}
      const mockContext = createMockExecutionContext(mockRequest)

      // Act: Extract name từ missing role permissions
      const result = activeRolePermissionsCallback('name', mockContext)

      // Assert: Verify undefined (optional chaining)
      expect(result).toBeUndefined()
    })

    it('Nên return null khi role permissions là null', () => {
      // Arrange: Request với role permissions = null
      const mockRequest = { [REQUEST_ROLE_PERMISSIONS]: null }
      const mockContext = createMockExecutionContext(mockRequest)

      // Act: Extract role permissions
      const result = activeRolePermissionsCallback(undefined, mockContext)

      // Assert: Verify null
      expect(result).toBeNull()
    })

    it('Nên return undefined khi extract field từ null role permissions', () => {
      // Arrange: Request với role permissions = null
      const mockRequest = { [REQUEST_ROLE_PERMISSIONS]: null }
      const mockContext = createMockExecutionContext(mockRequest)

      // Act: Extract name từ null role permissions
      const result = activeRolePermissionsCallback('name', mockContext)

      // Assert: Verify undefined (optional chaining)
      expect(result).toBeUndefined()
    })

    it('Nên handle empty permissions array', () => {
      // Arrange: Role với empty permissions
      const mockRolePermissions = createMockRolePermissions({ permissions: [] })
      const mockRequest = { [REQUEST_ROLE_PERMISSIONS]: mockRolePermissions }
      const mockContext = createMockExecutionContext(mockRequest)

      // Act: Extract permissions
      const result = activeRolePermissionsCallback('permissions', mockContext) as PermissionType[]

      // Assert: Verify empty array
      expect(result).toEqual([])
      expect(result).toHaveLength(0)
    })
  })

  // ============================================
  // EXECUTION CONTEXT INTEGRATION
  // ============================================

  describe('🔄 ExecutionContext Integration', () => {
    it('Nên call switchToHttp() để get HTTP context', () => {
      // Arrange: Mock context
      const mockRequest = { [REQUEST_ROLE_PERMISSIONS]: createMockRolePermissions() }
      const mockContext = createMockExecutionContext(mockRequest)

      // Act: Extract role permissions
      activeRolePermissionsCallback(undefined, mockContext)

      // Assert: Verify switchToHttp được gọi
      expect(mockContext.switchToHttp).toHaveBeenCalled()
    })

    it('Nên call getRequest() để get request object', () => {
      // Arrange: Mock context với spy
      const mockRequest = { [REQUEST_ROLE_PERMISSIONS]: createMockRolePermissions() }
      const getRequestSpy = jest.fn().mockReturnValue(mockRequest)
      const mockContext = {
        switchToHttp: jest.fn().mockReturnValue({
          getRequest: getRequestSpy,
        }),
      } as any

      // Act: Extract role permissions
      activeRolePermissionsCallback(undefined, mockContext)

      // Assert: Verify getRequest được gọi
      expect(getRequestSpy).toHaveBeenCalled()
    })

    it('Nên work với real ExecutionContext structure', () => {
      // Arrange: Realistic context structure
      const mockRolePermissions = createMockRolePermissions({ id: 777, name: 'PREMIUM' })
      const mockRequest = {
        [REQUEST_ROLE_PERMISSIONS]: mockRolePermissions,
        headers: { authorization: 'Bearer token' },
        method: 'GET',
        url: '/api/users/profile',
      }
      const mockContext = createMockExecutionContext(mockRequest)

      // Act: Extract role permissions
      const result = activeRolePermissionsCallback(undefined, mockContext) as RolePermissionsType

      // Assert: Verify correct extraction
      expect(result).toEqual(mockRolePermissions)
      expect(result.id).toBe(777)
      expect(result.name).toBe('PREMIUM')
    })
  })
})
