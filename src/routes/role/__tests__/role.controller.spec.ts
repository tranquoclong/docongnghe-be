import { CACHE_MANAGER } from '@nestjs/cache-manager'
import { BadRequestException } from '@nestjs/common'
import { Test, TestingModule } from '@nestjs/testing'
import { Cache } from 'cache-manager'
import { HTTPMethod, RoleName } from 'src/shared/constants/role.constant'
import { NotFoundRecordException } from 'src/shared/error'
import { RoleController } from '../role.controller'
import { CreateRoleBodyDTO, GetRoleParamsDTO, GetRolesQueryDTO, UpdateRoleBodyDTO } from '../role.dto'
import { ProhibitedActionOnBaseRoleException, RoleAlreadyExistsException } from '../role.error'
import { RoleService } from '../role.service'

// Test data factory để tạo dữ liệu test
const createTestData = {
  getRolesQuery: (overrides = {}): GetRolesQueryDTO => ({
    page: 1,
    limit: 10,
    ...overrides,
  }),

  getRoleParams: (overrides = {}): GetRoleParamsDTO => ({
    roleId: 1,
    ...overrides,
  }),

  createRoleBody: (overrides = {}): CreateRoleBodyDTO => ({
    name: 'Test Role',
    description: 'Test role description',
    isActive: true,
    ...overrides,
  }),

  updateRoleBody: (overrides = {}): UpdateRoleBodyDTO => ({
    name: 'Updated Role',
    description: 'Updated role description',
    isActive: true,
    permissionIds: [1, 2, 3],
    ...overrides,
  }),

  roleResponse: (overrides = {}) =>
    ({
      id: 1,
      name: 'Test Role',
      description: 'Test role description',
      isActive: true,
      createdById: 1,
      updatedById: null,
      deletedById: null,
      createdAt: new Date('2024-01-01').toISOString(),
      updatedAt: new Date('2024-01-01').toISOString(),
      deletedAt: null,
      ...overrides,
    }) as any,

  roleWithPermissionsResponse: (overrides = {}) =>
    ({
      id: 1,
      name: 'Test Role',
      description: 'Test role description',
      isActive: true,
      createdById: 1,
      updatedById: null,
      deletedById: null,
      createdAt: new Date('2024-01-01').toISOString(),
      updatedAt: new Date('2024-01-01').toISOString(),
      deletedAt: null,
      permissions: [
        {
          id: 1,
          name: 'View Users',
          description: 'Permission to view users',
          module: 'user',
          path: '/users',
          method: HTTPMethod.GET,
          createdById: 1,
          updatedById: null,
          deletedById: null,
          createdAt: new Date('2024-01-01').toISOString(),
          updatedAt: new Date('2024-01-01').toISOString(),
          deletedAt: null,
        },
      ],
      ...overrides,
    }) as any,

  rolesListResponse: (overrides = {}) => ({
    data: [
      {
        id: 1,
        name: RoleName.Admin,
        description: 'Administrator role',
        isActive: true,
        createdById: null,
        updatedById: null,
        deletedById: null,
        createdAt: new Date('2024-01-01').toISOString(),
        updatedAt: new Date('2024-01-01').toISOString(),
        deletedAt: null,
      },
      {
        id: 2,
        name: RoleName.Client,
        description: 'Client role',
        isActive: true,
        createdById: null,
        updatedById: null,
        deletedById: null,
        createdAt: new Date('2024-01-01').toISOString(),
        updatedAt: new Date('2024-01-01').toISOString(),
        deletedAt: null,
      },
    ],
    totalItems: 2,
    page: 1,
    limit: 10,
    totalPages: 1,
    ...overrides,
  }),

  messageResponse: (message: 'Delete successfully' = 'Delete successfully') => ({
    message,
  }),
}

describe('RoleController', () => {
  let controller: RoleController
  let module: TestingModule
  let mockRoleService: jest.Mocked<RoleService>
  let mockCacheManager: jest.Mocked<Cache>

  beforeEach(async () => {
    // Tạo mock cho RoleService với tất cả methods cần thiết
    mockRoleService = {
      list: jest.fn(),
      findById: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    } as any

    // Tạo mock cho Cache Manager
    mockCacheManager = {
      get: jest.fn(),
      set: jest.fn(),
      del: jest.fn(),
    } as any

    module = await Test.createTestingModule({
      controllers: [RoleController],
      providers: [
        { provide: RoleService, useValue: mockRoleService },
        { provide: CACHE_MANAGER, useValue: mockCacheManager },
      ],
    }).compile()

    controller = module.get<RoleController>(RoleController)
  })

  afterEach(() => {
    jest.clearAllMocks()
    jest.resetAllMocks()
  })

  afterAll(async () => {
    jest.restoreAllMocks()
    await module.close()
  })

  describe('list', () => {
    it('should return list of roles with default pagination', async () => {
      // Arrange - Chuẩn bị dữ liệu lấy danh sách roles với pagination mặc định
      const query = createTestData.getRolesQuery()
      const mockListResponse = createTestData.rolesListResponse()

      mockRoleService.list.mockResolvedValue(mockListResponse)

      // Act - Thực hiện lấy danh sách roles
      const result = await controller.list(query)

      // Assert - Kiểm tra kết quả
      expect(result).toEqual(mockListResponse)
      expect(result.data).toHaveLength(2)
      expect(result.page).toBe(1)
      expect(result.limit).toBe(10)
      expect(mockRoleService.list).toHaveBeenCalledWith({
        page: 1,
        limit: 10,
      })
      expect(mockRoleService.list).toHaveBeenCalledTimes(1)
    })

    it('should return list of roles with custom pagination', async () => {
      // Arrange - Chuẩn bị dữ liệu lấy danh sách roles với pagination tùy chỉnh
      const query = createTestData.getRolesQuery({ page: 2, limit: 5 })
      const mockListResponse = createTestData.rolesListResponse({
        page: 2,
        limit: 5,
        totalPages: 2,
      })

      mockRoleService.list.mockResolvedValue(mockListResponse)

      // Act - Thực hiện lấy danh sách roles
      const result = await controller.list(query)

      // Assert - Kiểm tra kết quả
      expect(result.page).toBe(2)
      expect(result.limit).toBe(5)
      expect(mockRoleService.list).toHaveBeenCalledWith({
        page: 2,
        limit: 5,
      })
    })

    it('should return empty list when no roles exist', async () => {
      // Arrange - Chuẩn bị dữ liệu khi không có roles
      const query = createTestData.getRolesQuery()
      const mockListResponse = createTestData.rolesListResponse({
        data: [],
        totalItems: 0,
        totalPages: 0,
      })

      mockRoleService.list.mockResolvedValue(mockListResponse)

      // Act - Thực hiện lấy danh sách roles
      const result = await controller.list(query)

      // Assert - Kiểm tra kết quả
      expect(result.data).toHaveLength(0)
      expect(result.totalItems).toBe(0)
    })

    it('should return list with base roles (ADMIN, CLIENT, SELLER)', async () => {
      // Arrange - Chuẩn bị dữ liệu với các base roles
      const query = createTestData.getRolesQuery()
      const mockListResponse = createTestData.rolesListResponse({
        data: [
          createTestData.roleResponse({ id: 1, name: RoleName.Admin }),
          createTestData.roleResponse({ id: 2, name: RoleName.Client }),
          createTestData.roleResponse({ id: 3, name: RoleName.Seller }),
        ],
        totalItems: 3,
      })

      mockRoleService.list.mockResolvedValue(mockListResponse)

      // Act - Thực hiện lấy danh sách roles
      const result = await controller.list(query)

      // Assert - Kiểm tra kết quả
      expect(result.data).toHaveLength(3)
      expect(result.data[0].name).toBe(RoleName.Admin)
      expect(result.data[1].name).toBe(RoleName.Client)
      expect(result.data[2].name).toBe(RoleName.Seller)
    })
  })

  describe('findById', () => {
    it('should return role by id successfully', async () => {
      // Arrange - Chuẩn bị dữ liệu tìm role theo ID
      const params = createTestData.getRoleParams({ roleId: 1 })
      const mockRoleResponse = createTestData.roleWithPermissionsResponse()

      mockRoleService.findById.mockResolvedValue(mockRoleResponse)

      // Act - Thực hiện tìm role
      const result = await controller.findById(params)

      // Assert - Kiểm tra kết quả
      expect(result).toEqual(mockRoleResponse)
      expect(result.id).toBe(1)
      expect(result.permissions).toBeDefined()
      expect(mockRoleService.findById).toHaveBeenCalledWith(1)
      expect(mockRoleService.findById).toHaveBeenCalledTimes(1)
    })

    it('should throw NotFoundRecordException when role not found', async () => {
      // Arrange - Chuẩn bị dữ liệu khi role không tồn tại
      const params = createTestData.getRoleParams({ roleId: 999 })

      mockRoleService.findById.mockRejectedValue(NotFoundRecordException)

      // Act & Assert - Thực hiện và kiểm tra exception
      await expect(controller.findById(params)).rejects.toThrow(NotFoundRecordException)
    })

    it('should return role with permissions array', async () => {
      // Arrange - Chuẩn bị dữ liệu role với permissions
      const params = createTestData.getRoleParams({ roleId: 1 })
      const mockRoleResponse = createTestData.roleWithPermissionsResponse({
        permissions: [
          {
            id: 1,
            name: 'View Users',
            description: 'Permission to view users',
            module: 'user',
            path: '/users',
            method: HTTPMethod.GET,
            createdById: 1,
            updatedById: null,
            deletedById: null,
            createdAt: new Date('2024-01-01').toISOString(),
            updatedAt: new Date('2024-01-01').toISOString(),
            deletedAt: null,
          },
          {
            id: 2,
            name: 'Create Users',
            description: 'Permission to create users',
            module: 'user',
            path: '/users',
            method: HTTPMethod.POST,
            createdById: 1,
            updatedById: null,
            deletedById: null,
            createdAt: new Date('2024-01-01').toISOString(),
            updatedAt: new Date('2024-01-01').toISOString(),
            deletedAt: null,
          },
        ],
      })

      mockRoleService.findById.mockResolvedValue(mockRoleResponse)

      // Act - Thực hiện tìm role
      const result = await controller.findById(params)

      // Assert - Kiểm tra kết quả
      expect(result.permissions).toHaveLength(2)
      expect(result.permissions[0].name).toBe('View Users')
      expect(result.permissions[1].name).toBe('Create Users')
    })
  })

  describe('create', () => {
    it('should create role successfully', async () => {
      // Arrange - Chuẩn bị dữ liệu tạo role mới
      const body = createTestData.createRoleBody()
      const userId = 1
      const mockRoleResponse = createTestData.roleResponse()

      mockRoleService.create.mockResolvedValue(mockRoleResponse)

      // Act - Thực hiện tạo role
      const result = await controller.create(body, userId)

      // Assert - Kiểm tra kết quả
      expect(result).toEqual(mockRoleResponse)
      expect(mockRoleService.create).toHaveBeenCalledWith({
        data: body,
        createdById: userId,
      })
      expect(mockRoleService.create).toHaveBeenCalledTimes(1)
    })

    it('should throw RoleAlreadyExistsException when role name already exists', async () => {
      // Arrange - Chuẩn bị dữ liệu khi tên role đã tồn tại
      const body = createTestData.createRoleBody({ name: 'Existing Role' })
      const userId = 1

      mockRoleService.create.mockRejectedValue(RoleAlreadyExistsException)

      // Act & Assert - Thực hiện và kiểm tra exception
      await expect(controller.create(body, userId)).rejects.toThrow(RoleAlreadyExistsException)
    })

    it('should create role with custom description', async () => {
      // Arrange - Chuẩn bị dữ liệu tạo role với description tùy chỉnh
      const body = createTestData.createRoleBody({
        name: 'Custom Role',
        description: 'This is a custom role for testing',
      })
      const userId = 1
      const mockRoleResponse = createTestData.roleResponse({
        name: 'Custom Role',
        description: 'This is a custom role for testing',
      })

      mockRoleService.create.mockResolvedValue(mockRoleResponse)

      // Act - Thực hiện tạo role
      const result = await controller.create(body, userId)

      // Assert - Kiểm tra kết quả
      expect(result.name).toBe('Custom Role')
      expect(result.description).toBe('This is a custom role for testing')
    })

    it('should create role with isActive set to false', async () => {
      // Arrange - Chuẩn bị dữ liệu tạo role với isActive = false
      const body = createTestData.createRoleBody({ isActive: false })
      const userId = 1
      const mockRoleResponse = createTestData.roleResponse({ isActive: false })

      mockRoleService.create.mockResolvedValue(mockRoleResponse)

      // Act - Thực hiện tạo role
      const result = await controller.create(body, userId)

      // Assert - Kiểm tra kết quả
      expect(result.isActive).toBe(false)
    })

    it('should create role with createdById set correctly', async () => {
      // Arrange - Chuẩn bị dữ liệu tạo role với createdById
      const body = createTestData.createRoleBody()
      const userId = 5
      const mockRoleResponse = createTestData.roleResponse({ createdById: 5 })

      mockRoleService.create.mockResolvedValue(mockRoleResponse)

      // Act - Thực hiện tạo role
      const result = await controller.create(body, userId)

      // Assert - Kiểm tra kết quả
      expect(result.createdById).toBe(5)
      expect(mockRoleService.create).toHaveBeenCalledWith({
        data: body,
        createdById: 5,
      })
    })
  })

  describe('update', () => {
    it('should update role successfully', async () => {
      // Arrange - Chuẩn bị dữ liệu cập nhật role
      const body = createTestData.updateRoleBody()
      const params = createTestData.getRoleParams({ roleId: 4 })
      const userId = 1
      const mockRoleResponse = createTestData.roleWithPermissionsResponse({
        id: 4,
        name: 'Updated Role',
        description: 'Updated role description',
      })

      mockRoleService.update.mockResolvedValue(mockRoleResponse)

      // Act - Thực hiện cập nhật role
      const result = await controller.update(body, params, userId)

      // Assert - Kiểm tra kết quả
      expect(result).toEqual(mockRoleResponse)
      expect(mockRoleService.update).toHaveBeenCalledWith({
        data: body,
        id: 4,
        updatedById: userId,
      })
      expect(mockRoleService.update).toHaveBeenCalledTimes(1)
    })

    it('should throw ProhibitedActionOnBaseRoleException when trying to update ADMIN role', async () => {
      // Arrange - Chuẩn bị dữ liệu khi cố cập nhật ADMIN role
      const body = createTestData.updateRoleBody()
      const params = createTestData.getRoleParams({ roleId: 1 }) // ADMIN role ID
      const userId = 1

      mockRoleService.update.mockRejectedValue(ProhibitedActionOnBaseRoleException)

      // Act & Assert - Thực hiện và kiểm tra exception
      await expect(controller.update(body, params, userId)).rejects.toThrow(ProhibitedActionOnBaseRoleException)
    })

    it('should throw ProhibitedActionOnBaseRoleException when trying to update CLIENT role', async () => {
      // Arrange - Chuẩn bị dữ liệu khi cố cập nhật CLIENT role
      const body = createTestData.updateRoleBody()
      const params = createTestData.getRoleParams({ roleId: 2 }) // CLIENT role ID
      const userId = 1

      mockRoleService.update.mockRejectedValue(ProhibitedActionOnBaseRoleException)

      // Act & Assert - Thực hiện và kiểm tra exception
      await expect(controller.update(body, params, userId)).rejects.toThrow(ProhibitedActionOnBaseRoleException)
    })

    it('should throw ProhibitedActionOnBaseRoleException when trying to update SELLER role', async () => {
      // Arrange - Chuẩn bị dữ liệu khi cố cập nhật SELLER role
      const body = createTestData.updateRoleBody()
      const params = createTestData.getRoleParams({ roleId: 3 }) // SELLER role ID
      const userId = 1

      mockRoleService.update.mockRejectedValue(ProhibitedActionOnBaseRoleException)

      // Act & Assert - Thực hiện và kiểm tra exception
      await expect(controller.update(body, params, userId)).rejects.toThrow(ProhibitedActionOnBaseRoleException)
    })

    it('should throw NotFoundRecordException when role not found', async () => {
      // Arrange - Chuẩn bị dữ liệu khi role không tồn tại
      const body = createTestData.updateRoleBody()
      const params = createTestData.getRoleParams({ roleId: 999 })
      const userId = 1

      mockRoleService.update.mockRejectedValue(NotFoundRecordException)

      // Act & Assert - Thực hiện và kiểm tra exception
      await expect(controller.update(body, params, userId)).rejects.toThrow(NotFoundRecordException)
    })

    it('should throw RoleAlreadyExistsException when updating to existing role name', async () => {
      // Arrange - Chuẩn bị dữ liệu khi cập nhật tên role đã tồn tại
      const body = createTestData.updateRoleBody({ name: 'Existing Role' })
      const params = createTestData.getRoleParams({ roleId: 4 })
      const userId = 1

      mockRoleService.update.mockRejectedValue(RoleAlreadyExistsException)

      // Act & Assert - Thực hiện và kiểm tra exception
      await expect(controller.update(body, params, userId)).rejects.toThrow(RoleAlreadyExistsException)
    })

    it('should update role with new permissions', async () => {
      // Arrange - Chuẩn bị dữ liệu cập nhật role với permissions mới
      const body = createTestData.updateRoleBody({ permissionIds: [1, 2, 3, 4] })
      const params = createTestData.getRoleParams({ roleId: 4 })
      const userId = 1
      const mockRoleResponse = createTestData.roleWithPermissionsResponse({
        id: 4,
        permissions: [
          {
            id: 1,
            name: 'View Users',
            description: 'Permission to view users',
            module: 'user',
            path: '/users',
            method: HTTPMethod.GET,
            createdById: 1,
            updatedById: null,
            deletedById: null,
            createdAt: new Date('2024-01-01').toISOString(),
            updatedAt: new Date('2024-01-01').toISOString(),
            deletedAt: null,
          },
        ],
      })

      mockRoleService.update.mockResolvedValue(mockRoleResponse)

      // Act - Thực hiện cập nhật role
      const result = await controller.update(body, params, userId)

      // Assert - Kiểm tra kết quả
      expect(result.permissions).toBeDefined()
      expect(mockRoleService.update).toHaveBeenCalledWith({
        data: body,
        id: 4,
        updatedById: userId,
      })
    })

    it('should throw BadRequestException when updating with deleted permissions', async () => {
      // Arrange - Chuẩn bị dữ liệu khi cập nhật với permissions đã bị xóa
      const body = createTestData.updateRoleBody({ permissionIds: [999] })
      const params = createTestData.getRoleParams({ roleId: 4 })
      const userId = 1

      mockRoleService.update.mockRejectedValue(new BadRequestException('Permission not found'))

      // Act & Assert - Thực hiện và kiểm tra exception
      await expect(controller.update(body, params, userId)).rejects.toThrow(BadRequestException)
    })

    it('should update role isActive status', async () => {
      // Arrange - Chuẩn bị dữ liệu cập nhật isActive status
      const body = createTestData.updateRoleBody({ isActive: false })
      const params = createTestData.getRoleParams({ roleId: 4 })
      const userId = 1
      const mockRoleResponse = createTestData.roleWithPermissionsResponse({
        id: 4,
        isActive: false,
      })

      mockRoleService.update.mockResolvedValue(mockRoleResponse)

      // Act - Thực hiện cập nhật role
      const result = await controller.update(body, params, userId)

      // Assert - Kiểm tra kết quả
      expect(result).toBeDefined()
      expect(result.isActive).toBe(false)
    })
  })

  describe('delete', () => {
    it('should delete role successfully', async () => {
      // Arrange - Chuẩn bị dữ liệu xóa role
      const params = createTestData.getRoleParams({ roleId: 4 })
      const userId = 1
      const mockMessageResponse = createTestData.messageResponse()

      mockRoleService.delete.mockResolvedValue(mockMessageResponse)

      // Act - Thực hiện xóa role
      const result = await controller.delete(params, userId)

      // Assert - Kiểm tra kết quả
      expect(result).toEqual(mockMessageResponse)
      expect(result.message).toBe('Delete successfully')
      expect(mockRoleService.delete).toHaveBeenCalledWith({
        id: 4,
        deletedById: userId,
      })
      expect(mockRoleService.delete).toHaveBeenCalledTimes(1)
    })

    it('should throw ProhibitedActionOnBaseRoleException when trying to delete ADMIN role', async () => {
      // Arrange - Chuẩn bị dữ liệu khi cố xóa ADMIN role
      const params = createTestData.getRoleParams({ roleId: 1 }) // ADMIN role ID
      const userId = 1

      mockRoleService.delete.mockRejectedValue(ProhibitedActionOnBaseRoleException)

      // Act & Assert - Thực hiện và kiểm tra exception
      await expect(controller.delete(params, userId)).rejects.toThrow(ProhibitedActionOnBaseRoleException)
    })

    it('should throw ProhibitedActionOnBaseRoleException when trying to delete CLIENT role', async () => {
      // Arrange - Chuẩn bị dữ liệu khi cố xóa CLIENT role
      const params = createTestData.getRoleParams({ roleId: 2 }) // CLIENT role ID
      const userId = 1

      mockRoleService.delete.mockRejectedValue(ProhibitedActionOnBaseRoleException)

      // Act & Assert - Thực hiện và kiểm tra exception
      await expect(controller.delete(params, userId)).rejects.toThrow(ProhibitedActionOnBaseRoleException)
    })

    it('should throw ProhibitedActionOnBaseRoleException when trying to delete SELLER role', async () => {
      // Arrange - Chuẩn bị dữ liệu khi cố xóa SELLER role
      const params = createTestData.getRoleParams({ roleId: 3 }) // SELLER role ID
      const userId = 1

      mockRoleService.delete.mockRejectedValue(ProhibitedActionOnBaseRoleException)

      // Act & Assert - Thực hiện và kiểm tra exception
      await expect(controller.delete(params, userId)).rejects.toThrow(ProhibitedActionOnBaseRoleException)
    })

    it('should throw NotFoundRecordException when role not found', async () => {
      // Arrange - Chuẩn bị dữ liệu khi role không tồn tại
      const params = createTestData.getRoleParams({ roleId: 999 })
      const userId = 1

      mockRoleService.delete.mockRejectedValue(NotFoundRecordException)

      // Act & Assert - Thực hiện và kiểm tra exception
      await expect(controller.delete(params, userId)).rejects.toThrow(NotFoundRecordException)
    })

    it('should delete custom role (not base role)', async () => {
      // Arrange - Chuẩn bị dữ liệu xóa custom role
      const params = createTestData.getRoleParams({ roleId: 10 })
      const userId = 1
      const mockMessageResponse = createTestData.messageResponse()

      mockRoleService.delete.mockResolvedValue(mockMessageResponse)

      // Act - Thực hiện xóa role
      const result = await controller.delete(params, userId)

      // Assert - Kiểm tra kết quả
      expect(result.message).toBe('Delete successfully')
    })
  })

  describe('Edge Cases & Security', () => {
    it('should handle concurrent list requests properly', async () => {
      // Arrange - Chuẩn bị dữ liệu cho nhiều requests đồng thời
      const query = createTestData.getRolesQuery()
      const mockListResponse = createTestData.rolesListResponse()

      mockRoleService.list.mockResolvedValue(mockListResponse)

      // Act - Thực hiện nhiều requests đồng thời
      const results = await Promise.all([controller.list(query), controller.list(query), controller.list(query)])

      // Assert - Kiểm tra kết quả
      expect(results).toHaveLength(3)
      expect(mockRoleService.list).toHaveBeenCalledTimes(3)
    })

    it('should validate roleId parameter is positive number', async () => {
      // Arrange - Chuẩn bị dữ liệu với roleId dương
      const params = createTestData.getRoleParams({ roleId: 1 })
      const mockRoleResponse = createTestData.roleWithPermissionsResponse()

      mockRoleService.findById.mockResolvedValue(mockRoleResponse)

      // Act - Thực hiện tìm role
      const result = await controller.findById(params)

      // Assert - Kiểm tra kết quả
      expect(result).toBeDefined()
      expect(params.roleId).toBeGreaterThan(0)
    })

    it('should handle service errors gracefully', async () => {
      // Arrange - Chuẩn bị dữ liệu khi service throw error
      const query = createTestData.getRolesQuery()
      const error = new Error('Database connection failed')

      mockRoleService.list.mockRejectedValue(error)

      // Act & Assert - Thực hiện và kiểm tra error
      await expect(controller.list(query)).rejects.toThrow('Database connection failed')
    })

    it('should protect base roles from modification', async () => {
      // Arrange - Chuẩn bị dữ liệu test bảo vệ base roles
      const baseRoleIds = [1, 2, 3] // ADMIN, CLIENT, SELLER
      const body = createTestData.updateRoleBody()
      const userId = 1

      mockRoleService.update.mockRejectedValue(ProhibitedActionOnBaseRoleException)

      // Act & Assert - Thực hiện và kiểm tra exception cho tất cả base roles
      for (const roleId of baseRoleIds) {
        const params = createTestData.getRoleParams({ roleId })
        await expect(controller.update(body, params, userId)).rejects.toThrow(ProhibitedActionOnBaseRoleException)
      }
    })
  })

  // ===== RESPONSE STRUCTURE SNAPSHOTS =====

  describe('Response Structure Snapshots', () => {
    it('should match role list response structure', async () => {
      const mockResponse = {
        data: [createTestData.roleResponse(), createTestData.roleResponse({ id: 2, name: 'Admin' })],
        totalItems: 2,
        page: 1,
        limit: 10,
        totalPages: 1,
      }
      mockRoleService.list.mockResolvedValue(mockResponse)
      const result = await controller.list(createTestData.getRolesQuery())
      expect(result).toMatchSnapshot()
    })

    it('should match role detail response structure', async () => {
      const mockResponse = createTestData.roleWithPermissionsResponse()
      mockRoleService.findById.mockResolvedValue(mockResponse)
      const result = await controller.findById(createTestData.getRoleParams())
      expect(result).toMatchSnapshot()
    })

    it('should match role create response structure', async () => {
      const mockResponse = createTestData.roleResponse({ id: 10, name: 'New Role' })
      mockRoleService.create.mockResolvedValue(mockResponse)
      const result = await controller.create(createTestData.createRoleBody(), 1)
      expect(result).toMatchSnapshot()
    })
  })
})
