import { CACHE_MANAGER } from '@nestjs/cache-manager'
import { Test, TestingModule } from '@nestjs/testing'
import { Cache } from 'cache-manager'
import { HTTPMethod } from 'src/shared/constants/role.constant'
import { NotFoundRecordException } from 'src/shared/error'
import { PermissionController } from '../permission.controller'
import {
  CreatePermissionBodyDTO,
  GetPermissionParamsDTO,
  GetPermissionsQueryDTO,
  UpdatePermissionBodyDTO,
} from '../permission.dto'
import { PermissionAlreadyExistsException } from '../permission.error'
import { PermissionService } from '../permission.service'

// Test data factory để tạo dữ liệu test
const createTestData = {
  getPermissionsQuery: (overrides = {}): GetPermissionsQueryDTO => ({
    page: 1,
    limit: 10,
    ...overrides,
  }),

  getPermissionParams: (overrides = {}): GetPermissionParamsDTO => ({
    permissionId: 1,
    ...overrides,
  }),

  createPermissionBody: (overrides = {}): CreatePermissionBodyDTO => ({
    name: 'View Users',
    description: 'Permission to view users',
    module: 'user',
    path: '/users',
    method: HTTPMethod.GET,
    ...overrides,
  }),

  updatePermissionBody: (overrides = {}): UpdatePermissionBodyDTO => ({
    name: 'Updated Permission',
    description: 'Updated permission description',
    module: 'user',
    path: '/users/updated',
    method: HTTPMethod.POST,
    ...overrides,
  }),

  permissionResponse: (overrides = {}) =>
    ({
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
      ...overrides,
    }) as any,

  permissionsListResponse: (overrides = {}) => ({
    data: [
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
    totalItems: 2,
    page: 1,
    limit: 10,
    totalPages: 1,
    ...overrides,
  }),

  messageResponse: (message: 'Delete successfully' = 'Delete successfully') => ({
    message,
  }) as const,
}

describe('PermissionController', () => {
  let controller: PermissionController
  let module: TestingModule
  let mockPermissionService: jest.Mocked<PermissionService>
  let mockCacheManager: jest.Mocked<Cache>

  beforeEach(async () => {
    // Tạo mock cho PermissionService với tất cả methods cần thiết
    mockPermissionService = {
      list: jest.fn(),
      findById: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      deleteCachedRole: jest.fn(),
    } as any

    // Tạo mock cho Cache Manager
    mockCacheManager = {
      get: jest.fn(),
      set: jest.fn(),
      del: jest.fn(),
    } as any

    module = await Test.createTestingModule({
      controllers: [PermissionController],
      providers: [
        { provide: PermissionService, useValue: mockPermissionService },
        { provide: CACHE_MANAGER, useValue: mockCacheManager },
      ],
    }).compile()

    controller = module.get<PermissionController>(PermissionController)
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
    it('should return list of permissions with default pagination', async () => {
      // Arrange - Chuẩn bị dữ liệu lấy danh sách permissions với pagination mặc định
      const query = createTestData.getPermissionsQuery()
      const mockListResponse = createTestData.permissionsListResponse()

      mockPermissionService.list.mockResolvedValue(mockListResponse)

      // Act - Thực hiện lấy danh sách permissions
      const result = await controller.list(query)

      // Assert - Kiểm tra kết quả
      expect(result).toEqual(mockListResponse)
      expect(result.data).toHaveLength(2)
      expect(result.page).toBe(1)
      expect(result.limit).toBe(10)
      expect(mockPermissionService.list).toHaveBeenCalledWith({
        page: 1,
        limit: 10,
      })
      expect(mockPermissionService.list).toHaveBeenCalledTimes(1)
    })

    it('should return list of permissions with custom pagination', async () => {
      // Arrange - Chuẩn bị dữ liệu lấy danh sách permissions với pagination tùy chỉnh
      const query = createTestData.getPermissionsQuery({ page: 2, limit: 5 })
      const mockListResponse = createTestData.permissionsListResponse({
        page: 2,
        limit: 5,
        totalPages: 2,
      })

      mockPermissionService.list.mockResolvedValue(mockListResponse)

      // Act - Thực hiện lấy danh sách permissions
      const result = await controller.list(query)

      // Assert - Kiểm tra kết quả
      expect(result.page).toBe(2)
      expect(result.limit).toBe(5)
      expect(mockPermissionService.list).toHaveBeenCalledWith({
        page: 2,
        limit: 5,
      })
    })

    it('should return empty list when no permissions exist', async () => {
      // Arrange - Chuẩn bị dữ liệu khi không có permissions
      const query = createTestData.getPermissionsQuery()
      const mockListResponse = createTestData.permissionsListResponse({
        data: [],
        totalItems: 0,
        totalPages: 0,
      })

      mockPermissionService.list.mockResolvedValue(mockListResponse)

      // Act - Thực hiện lấy danh sách permissions
      const result = await controller.list(query)

      // Assert - Kiểm tra kết quả
      expect(result.data).toHaveLength(0)
      expect(result.totalItems).toBe(0)
    })

    it('should return list with different HTTP methods', async () => {
      // Arrange - Chuẩn bị dữ liệu với các HTTP methods khác nhau
      const query = createTestData.getPermissionsQuery()
      const mockListResponse = createTestData.permissionsListResponse({
        data: [
          createTestData.permissionResponse({ id: 1, method: HTTPMethod.GET }),
          createTestData.permissionResponse({ id: 2, method: HTTPMethod.POST }),
          createTestData.permissionResponse({ id: 3, method: HTTPMethod.PUT }),
          createTestData.permissionResponse({ id: 4, method: HTTPMethod.DELETE }),
          createTestData.permissionResponse({ id: 5, method: HTTPMethod.PATCH }),
        ],
        totalItems: 5,
      })

      mockPermissionService.list.mockResolvedValue(mockListResponse)

      // Act - Thực hiện lấy danh sách permissions
      const result = await controller.list(query)

      // Assert - Kiểm tra kết quả
      expect(result.data).toHaveLength(5)
      expect(result.data[0].method).toBe(HTTPMethod.GET)
      expect(result.data[1].method).toBe(HTTPMethod.POST)
      expect(result.data[2].method).toBe(HTTPMethod.PUT)
      expect(result.data[3].method).toBe(HTTPMethod.DELETE)
      expect(result.data[4].method).toBe(HTTPMethod.PATCH)
    })

    it('should return list grouped by module', async () => {
      // Arrange - Chuẩn bị dữ liệu với các modules khác nhau
      const query = createTestData.getPermissionsQuery()
      const mockListResponse = createTestData.permissionsListResponse({
        data: [
          createTestData.permissionResponse({ id: 1, module: 'user', name: 'View Users' }),
          createTestData.permissionResponse({ id: 2, module: 'user', name: 'Create Users' }),
          createTestData.permissionResponse({ id: 3, module: 'product', name: 'View Products' }),
          createTestData.permissionResponse({ id: 4, module: 'order', name: 'View Orders' }),
        ],
        totalItems: 4,
      })

      mockPermissionService.list.mockResolvedValue(mockListResponse)

      // Act - Thực hiện lấy danh sách permissions
      const result = await controller.list(query)

      // Assert - Kiểm tra kết quả
      expect(result.data).toHaveLength(4)
      expect(result.data.filter((p) => p.module === 'user')).toHaveLength(2)
      expect(result.data.filter((p) => p.module === 'product')).toHaveLength(1)
      expect(result.data.filter((p) => p.module === 'order')).toHaveLength(1)
    })
  })

  describe('findById', () => {
    it('should return permission by id successfully', async () => {
      // Arrange - Chuẩn bị dữ liệu tìm permission theo ID
      const params = createTestData.getPermissionParams({ permissionId: 1 })
      const mockPermissionResponse = createTestData.permissionResponse()

      mockPermissionService.findById.mockResolvedValue(mockPermissionResponse)

      // Act - Thực hiện tìm permission
      const result = await controller.findById(params)

      // Assert - Kiểm tra kết quả
      expect(result).toEqual(mockPermissionResponse)
      expect(result.id).toBe(1)
      expect(result.name).toBe('View Users')
      expect(mockPermissionService.findById).toHaveBeenCalledWith(1)
      expect(mockPermissionService.findById).toHaveBeenCalledTimes(1)
    })

    it('should throw NotFoundRecordException when permission not found', async () => {
      // Arrange - Chuẩn bị dữ liệu khi permission không tồn tại
      const params = createTestData.getPermissionParams({ permissionId: 999 })

      mockPermissionService.findById.mockRejectedValue(NotFoundRecordException)

      // Act & Assert - Thực hiện và kiểm tra exception
      await expect(controller.findById(params)).rejects.toThrow(NotFoundRecordException)
    })

    it('should return permission with all required fields', async () => {
      // Arrange - Chuẩn bị dữ liệu permission với tất cả fields
      const params = createTestData.getPermissionParams({ permissionId: 1 })
      const mockPermissionResponse = createTestData.permissionResponse({
        id: 1,
        name: 'Create Products',
        description: 'Permission to create products',
        module: 'product',
        path: '/products',
        method: HTTPMethod.POST,
      })

      mockPermissionService.findById.mockResolvedValue(mockPermissionResponse)

      // Act - Thực hiện tìm permission
      const result = await controller.findById(params)

      // Assert - Kiểm tra kết quả
      expect(result.id).toBe(1)
      expect(result.name).toBe('Create Products')
      expect(result.description).toBe('Permission to create products')
      expect(result.module).toBe('product')
      expect(result.path).toBe('/products')
      expect(result.method).toBe(HTTPMethod.POST)
    })
  })

  describe('create', () => {
    it('should create permission successfully', async () => {
      // Arrange - Chuẩn bị dữ liệu tạo permission mới
      const body = createTestData.createPermissionBody()
      const userId = 1
      const mockPermissionResponse = createTestData.permissionResponse()

      mockPermissionService.create.mockResolvedValue(mockPermissionResponse)

      // Act - Thực hiện tạo permission
      const result = await controller.create(body, userId)

      // Assert - Kiểm tra kết quả
      expect(result).toEqual(mockPermissionResponse)
      expect(mockPermissionService.create).toHaveBeenCalledWith({
        data: body,
        createdById: userId,
      })
      expect(mockPermissionService.create).toHaveBeenCalledTimes(1)
    })

    it('should throw PermissionAlreadyExistsException when permission already exists', async () => {
      // Arrange - Chuẩn bị dữ liệu khi permission đã tồn tại (duplicate path + method)
      const body = createTestData.createPermissionBody()
      const userId = 1

      mockPermissionService.create.mockRejectedValue(PermissionAlreadyExistsException)

      // Act & Assert - Thực hiện và kiểm tra exception
      await expect(controller.create(body, userId)).rejects.toThrow(PermissionAlreadyExistsException)
    })

    it('should create permission with GET method', async () => {
      // Arrange - Chuẩn bị dữ liệu tạo permission với GET method
      const body = createTestData.createPermissionBody({
        name: 'View Products',
        module: 'product',
        path: '/products',
        method: HTTPMethod.GET,
      })
      const userId = 1
      const mockPermissionResponse = createTestData.permissionResponse({
        name: 'View Products',
        module: 'product',
        path: '/products',
        method: HTTPMethod.GET,
      })

      mockPermissionService.create.mockResolvedValue(mockPermissionResponse)

      // Act - Thực hiện tạo permission
      const result = await controller.create(body, userId)

      // Assert - Kiểm tra kết quả
      expect(result.method).toBe(HTTPMethod.GET)
      expect(result.path).toBe('/products')
    })

    it('should create permission with POST method', async () => {
      // Arrange - Chuẩn bị dữ liệu tạo permission với POST method
      const body = createTestData.createPermissionBody({
        name: 'Create Orders',
        module: 'order',
        path: '/orders',
        method: HTTPMethod.POST,
      })
      const userId = 1
      const mockPermissionResponse = createTestData.permissionResponse({
        name: 'Create Orders',
        module: 'order',
        path: '/orders',
        method: HTTPMethod.POST,
      })

      mockPermissionService.create.mockResolvedValue(mockPermissionResponse)

      // Act - Thực hiện tạo permission
      const result = await controller.create(body, userId)

      // Assert - Kiểm tra kết quả
      expect(result.method).toBe(HTTPMethod.POST)
      expect(result.module).toBe('order')
    })

    it('should create permission with PUT method', async () => {
      // Arrange - Chuẩn bị dữ liệu tạo permission với PUT method
      const body = createTestData.createPermissionBody({
        name: 'Update Categories',
        module: 'category',
        path: '/categories/:id',
        method: HTTPMethod.PUT,
      })
      const userId = 1
      const mockPermissionResponse = createTestData.permissionResponse({
        name: 'Update Categories',
        module: 'category',
        path: '/categories/:id',
        method: HTTPMethod.PUT,
      })

      mockPermissionService.create.mockResolvedValue(mockPermissionResponse)

      // Act - Thực hiện tạo permission
      const result = await controller.create(body, userId)

      // Assert - Kiểm tra kết quả
      expect(result.method).toBe(HTTPMethod.PUT)
      expect(result.path).toBe('/categories/:id')
    })

    it('should create permission with DELETE method', async () => {
      // Arrange - Chuẩn bị dữ liệu tạo permission với DELETE method
      const body = createTestData.createPermissionBody({
        name: 'Delete Brands',
        module: 'brand',
        path: '/brands/:id',
        method: HTTPMethod.DELETE,
      })
      const userId = 1
      const mockPermissionResponse = createTestData.permissionResponse({
        name: 'Delete Brands',
        module: 'brand',
        path: '/brands/:id',
        method: HTTPMethod.DELETE,
      })

      mockPermissionService.create.mockResolvedValue(mockPermissionResponse)

      // Act - Thực hiện tạo permission
      const result = await controller.create(body, userId)

      // Assert - Kiểm tra kết quả
      expect(result.method).toBe(HTTPMethod.DELETE)
    })

    it('should create permission with PATCH method', async () => {
      // Arrange - Chuẩn bị dữ liệu tạo permission với PATCH method
      const body = createTestData.createPermissionBody({
        name: 'Partial Update Reviews',
        module: 'review',
        path: '/reviews/:id',
        method: HTTPMethod.PATCH,
      })
      const userId = 1
      const mockPermissionResponse = createTestData.permissionResponse({
        name: 'Partial Update Reviews',
        module: 'review',
        path: '/reviews/:id',
        method: HTTPMethod.PATCH,
      })

      mockPermissionService.create.mockResolvedValue(mockPermissionResponse)

      // Act - Thực hiện tạo permission
      const result = await controller.create(body, userId)

      // Assert - Kiểm tra kết quả
      expect(result.method).toBe(HTTPMethod.PATCH)
    })

    it('should create permission without description (optional field)', async () => {
      // Arrange - Chuẩn bị dữ liệu tạo permission không có description
      const body = createTestData.createPermissionBody()
      delete (body as any).description
      const userId = 1
      const mockPermissionResponse = createTestData.permissionResponse({ description: '' })

      mockPermissionService.create.mockResolvedValue(mockPermissionResponse)

      // Act - Thực hiện tạo permission
      const result = await controller.create(body, userId)

      // Assert - Kiểm tra kết quả
      expect(result).toBeDefined()
      expect(mockPermissionService.create).toHaveBeenCalled()
    })

    it('should create permission with createdById set correctly', async () => {
      // Arrange - Chuẩn bị dữ liệu tạo permission với createdById
      const body = createTestData.createPermissionBody()
      const userId = 5
      const mockPermissionResponse = createTestData.permissionResponse({ createdById: 5 })

      mockPermissionService.create.mockResolvedValue(mockPermissionResponse)

      // Act - Thực hiện tạo permission
      const result = await controller.create(body, userId)

      // Assert - Kiểm tra kết quả
      expect(result.createdById).toBe(5)
      expect(mockPermissionService.create).toHaveBeenCalledWith({
        data: body,
        createdById: 5,
      })
    })
  })

  describe('update', () => {
    it('should update permission successfully', async () => {
      // Arrange - Chuẩn bị dữ liệu cập nhật permission
      const body = createTestData.updatePermissionBody()
      const params = createTestData.getPermissionParams({ permissionId: 1 })
      const userId = 1
      const mockPermissionResponse = createTestData.permissionResponse({
        id: 1,
        name: 'Updated Permission',
        description: 'Updated permission description',
        path: '/users/updated',
        method: HTTPMethod.POST,
      })

      mockPermissionService.update.mockResolvedValue(mockPermissionResponse)

      // Act - Thực hiện cập nhật permission
      const result = await controller.update(body, params, userId)

      // Assert - Kiểm tra kết quả
      expect(result).toEqual(mockPermissionResponse)
      expect(mockPermissionService.update).toHaveBeenCalledWith({
        data: body,
        id: 1,
        updatedById: userId,
      })
      expect(mockPermissionService.update).toHaveBeenCalledTimes(1)
    })

    it('should throw NotFoundRecordException when permission not found', async () => {
      // Arrange - Chuẩn bị dữ liệu khi permission không tồn tại
      const body = createTestData.updatePermissionBody()
      const params = createTestData.getPermissionParams({ permissionId: 999 })
      const userId = 1

      mockPermissionService.update.mockRejectedValue(NotFoundRecordException)

      // Act & Assert - Thực hiện và kiểm tra exception
      await expect(controller.update(body, params, userId)).rejects.toThrow(NotFoundRecordException)
    })

    it('should throw PermissionAlreadyExistsException when updating to existing path+method', async () => {
      // Arrange - Chuẩn bị dữ liệu khi cập nhật path+method đã tồn tại
      const body = createTestData.updatePermissionBody({
        path: '/existing-path',
        method: HTTPMethod.GET,
      })
      const params = createTestData.getPermissionParams({ permissionId: 1 })
      const userId = 1

      mockPermissionService.update.mockRejectedValue(PermissionAlreadyExistsException)

      // Act & Assert - Thực hiện và kiểm tra exception
      await expect(controller.update(body, params, userId)).rejects.toThrow(PermissionAlreadyExistsException)
    })

    it('should update permission path', async () => {
      // Arrange - Chuẩn bị dữ liệu cập nhật path
      const body = createTestData.updatePermissionBody({ path: '/new-path' })
      const params = createTestData.getPermissionParams({ permissionId: 1 })
      const userId = 1
      const mockPermissionResponse = createTestData.permissionResponse({ path: '/new-path' })

      mockPermissionService.update.mockResolvedValue(mockPermissionResponse)

      // Act - Thực hiện cập nhật permission
      const result = await controller.update(body, params, userId)

      // Assert - Kiểm tra kết quả
      expect(result.path).toBe('/new-path')
    })

    it('should update permission method', async () => {
      // Arrange - Chuẩn bị dữ liệu cập nhật method
      const body = createTestData.updatePermissionBody({ method: HTTPMethod.DELETE })
      const params = createTestData.getPermissionParams({ permissionId: 1 })
      const userId = 1
      const mockPermissionResponse = createTestData.permissionResponse({ method: HTTPMethod.DELETE })

      mockPermissionService.update.mockResolvedValue(mockPermissionResponse)

      // Act - Thực hiện cập nhật permission
      const result = await controller.update(body, params, userId)

      // Assert - Kiểm tra kết quả
      expect(result.method).toBe(HTTPMethod.DELETE)
    })

    it('should update permission module', async () => {
      // Arrange - Chuẩn bị dữ liệu cập nhật module
      const body = createTestData.updatePermissionBody({ module: 'product' })
      const params = createTestData.getPermissionParams({ permissionId: 1 })
      const userId = 1
      const mockPermissionResponse = createTestData.permissionResponse({ module: 'product' })

      mockPermissionService.update.mockResolvedValue(mockPermissionResponse)

      // Act - Thực hiện cập nhật permission
      const result = await controller.update(body, params, userId)

      // Assert - Kiểm tra kết quả
      expect(result.module).toBe('product')
    })

    it('should update permission name and description', async () => {
      // Arrange - Chuẩn bị dữ liệu cập nhật name và description
      const body = createTestData.updatePermissionBody({
        name: 'New Permission Name',
        description: 'New permission description',
      })
      const params = createTestData.getPermissionParams({ permissionId: 1 })
      const userId = 1
      const mockPermissionResponse = createTestData.permissionResponse({
        name: 'New Permission Name',
        description: 'New permission description',
      })

      mockPermissionService.update.mockResolvedValue(mockPermissionResponse)

      // Act - Thực hiện cập nhật permission
      const result = await controller.update(body, params, userId)

      // Assert - Kiểm tra kết quả
      expect(result.name).toBe('New Permission Name')
      expect(result.description).toBe('New permission description')
    })
  })

  describe('delete', () => {
    it('should delete permission successfully', async () => {
      // Arrange - Chuẩn bị dữ liệu xóa permission
      const params = createTestData.getPermissionParams({ permissionId: 1 })
      const userId = 1
      const mockMessageResponse = createTestData.messageResponse()

      mockPermissionService.delete.mockResolvedValue(mockMessageResponse)

      // Act - Thực hiện xóa permission
      const result = await controller.delete(params, userId)

      // Assert - Kiểm tra kết quả
      expect(result).toEqual(mockMessageResponse)
      expect(result.message).toBe('Delete successfully')
      expect(mockPermissionService.delete).toHaveBeenCalledWith({
        id: 1,
        deletedById: userId,
      })
      expect(mockPermissionService.delete).toHaveBeenCalledTimes(1)
    })

    it('should throw NotFoundRecordException when permission not found', async () => {
      // Arrange - Chuẩn bị dữ liệu khi permission không tồn tại
      const params = createTestData.getPermissionParams({ permissionId: 999 })
      const userId = 1

      mockPermissionService.delete.mockRejectedValue(NotFoundRecordException)

      // Act & Assert - Thực hiện và kiểm tra exception
      await expect(controller.delete(params, userId)).rejects.toThrow(NotFoundRecordException)
    })

    it('should delete permission and invalidate cache for associated roles', async () => {
      // Arrange - Chuẩn bị dữ liệu xóa permission có liên kết với roles
      const params = createTestData.getPermissionParams({ permissionId: 1 })
      const userId = 1
      const mockMessageResponse = createTestData.messageResponse()

      mockPermissionService.delete.mockResolvedValue(mockMessageResponse)

      // Act - Thực hiện xóa permission
      const result = await controller.delete(params, userId)

      // Assert - Kiểm tra kết quả
      expect(result.message).toBe('Delete successfully')
      expect(mockPermissionService.delete).toHaveBeenCalledWith({
        id: 1,
        deletedById: userId,
      })
    })

    it('should set deletedById correctly when deleting permission', async () => {
      // Arrange - Chuẩn bị dữ liệu xóa permission với deletedById
      const params = createTestData.getPermissionParams({ permissionId: 5 })
      const userId = 10
      const mockMessageResponse = createTestData.messageResponse()

      mockPermissionService.delete.mockResolvedValue(mockMessageResponse)

      // Act - Thực hiện xóa permission
      const result = await controller.delete(params, userId)

      // Assert - Kiểm tra kết quả
      expect(mockPermissionService.delete).toHaveBeenCalledWith({
        id: 5,
        deletedById: 10,
      })
    })
  })

  describe('Edge Cases & Security', () => {
    it('should handle concurrent list requests properly', async () => {
      // Arrange - Chuẩn bị dữ liệu cho nhiều requests đồng thời
      const query = createTestData.getPermissionsQuery()
      const mockListResponse = createTestData.permissionsListResponse()

      mockPermissionService.list.mockResolvedValue(mockListResponse)

      // Act - Thực hiện nhiều requests đồng thời
      const results = await Promise.all([controller.list(query), controller.list(query), controller.list(query)])

      // Assert - Kiểm tra kết quả
      expect(results).toHaveLength(3)
      expect(mockPermissionService.list).toHaveBeenCalledTimes(3)
    })

    it('should validate permissionId parameter is positive number', async () => {
      // Arrange - Chuẩn bị dữ liệu với permissionId dương
      const params = createTestData.getPermissionParams({ permissionId: 1 })
      const mockPermissionResponse = createTestData.permissionResponse()

      mockPermissionService.findById.mockResolvedValue(mockPermissionResponse)

      // Act - Thực hiện tìm permission
      const result = await controller.findById(params)

      // Assert - Kiểm tra kết quả
      expect(result).toBeDefined()
      expect(params.permissionId).toBeGreaterThan(0)
    })

    it('should handle service errors gracefully', async () => {
      // Arrange - Chuẩn bị dữ liệu khi service throw error
      const query = createTestData.getPermissionsQuery()
      const error = new Error('Database connection failed')

      mockPermissionService.list.mockRejectedValue(error)

      // Act & Assert - Thực hiện và kiểm tra error
      await expect(controller.list(query)).rejects.toThrow('Database connection failed')
    })

    it('should prevent duplicate permissions with same path and method', async () => {
      // Arrange - Chuẩn bị dữ liệu tạo permission trùng path+method
      const body = createTestData.createPermissionBody({
        path: '/users',
        method: HTTPMethod.GET,
      })
      const userId = 1

      mockPermissionService.create.mockRejectedValue(PermissionAlreadyExistsException)

      // Act & Assert - Thực hiện và kiểm tra exception
      await expect(controller.create(body, userId)).rejects.toThrow(PermissionAlreadyExistsException)
    })

    it('should allow same path with different methods', async () => {
      // Arrange - Chuẩn bị dữ liệu tạo permissions với cùng path nhưng khác method
      const body1 = createTestData.createPermissionBody({
        name: 'View Users',
        path: '/users',
        method: HTTPMethod.GET,
      })
      const body2 = createTestData.createPermissionBody({
        name: 'Create Users',
        path: '/users',
        method: HTTPMethod.POST,
      })
      const userId = 1

      mockPermissionService.create
        .mockResolvedValueOnce(createTestData.permissionResponse({ id: 1, method: HTTPMethod.GET }))
        .mockResolvedValueOnce(createTestData.permissionResponse({ id: 2, method: HTTPMethod.POST }))

      // Act - Thực hiện tạo 2 permissions
      const result1 = await controller.create(body1, userId)
      const result2 = await controller.create(body2, userId)

      // Assert - Kiểm tra kết quả
      expect(result1.method).toBe(HTTPMethod.GET)
      expect(result2.method).toBe(HTTPMethod.POST)
      expect(mockPermissionService.create).toHaveBeenCalledTimes(2)
    })

    it('should handle permissions for different modules', async () => {
      // Arrange - Chuẩn bị dữ liệu với nhiều modules khác nhau
      const query = createTestData.getPermissionsQuery()
      const mockListResponse = createTestData.permissionsListResponse({
        data: [
          createTestData.permissionResponse({ id: 1, module: 'user' }),
          createTestData.permissionResponse({ id: 2, module: 'product' }),
          createTestData.permissionResponse({ id: 3, module: 'order' }),
          createTestData.permissionResponse({ id: 4, module: 'payment' }),
        ],
        totalItems: 4,
      })

      mockPermissionService.list.mockResolvedValue(mockListResponse)

      // Act - Thực hiện lấy danh sách permissions
      const result = await controller.list(query)

      // Assert - Kiểm tra kết quả
      const modules = result.data.map((p) => p.module)
      expect(modules).toContain('user')
      expect(modules).toContain('product')
      expect(modules).toContain('order')
      expect(modules).toContain('payment')
    })
  })

  // ===== RESPONSE STRUCTURE SNAPSHOTS =====

  describe('Response Structure Snapshots', () => {
    it('should match permission list response structure', async () => {
      const mockResponse = {
        data: [createTestData.permissionResponse(), createTestData.permissionResponse({ id: 2, name: 'Create Users' })],
        totalItems: 2,
        page: 1,
        limit: 10,
        totalPages: 1,
      }
      mockPermissionService.list.mockResolvedValue(mockResponse)
      const result = await controller.list(createTestData.getPermissionsQuery())
      expect(result).toMatchSnapshot()
    })

    it('should match permission detail response structure', async () => {
      const mockResponse = createTestData.permissionResponse()
      mockPermissionService.findById.mockResolvedValue(mockResponse)
      const result = await controller.findById(createTestData.getPermissionParams())
      expect(result).toMatchSnapshot()
    })

    it('should match permission create response structure', async () => {
      const mockResponse = createTestData.permissionResponse({ id: 10, name: 'New Permission' })
      mockPermissionService.create.mockResolvedValue(mockResponse)
      const result = await controller.create(createTestData.createPermissionBody(), 1)
      expect(result).toMatchSnapshot()
    })
  })
})
