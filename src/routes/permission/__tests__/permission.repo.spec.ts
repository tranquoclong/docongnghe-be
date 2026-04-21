import { Test, TestingModule } from '@nestjs/testing'
import { PrismaService } from 'src/shared/services/prisma.service'
import { PermissionRepo } from '../permission.repo'

describe('PermissionRepo', () => {
  let repository: PermissionRepo

  // Mock PrismaService
  const mockPrismaService = {
    permission: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      count: jest.fn(),
    },
  }

  // Test data factory
  const createTestData = {
    permission: (overrides = {}) => ({
      id: 1,
      name: 'READ_PRODUCT',
      description: 'Read product permission',
      module: 'product',
      path: '/api/products',
      method: 'GET',
      createdById: null,
      updatedById: null,
      deletedById: null,
      deletedAt: null,
      createdAt: new Date('2024-01-01'),
      updatedAt: new Date('2024-01-01'),
      ...overrides,
    }),
    permissionWithRoles: (overrides = {}) => ({
      id: 1,
      name: 'READ_PRODUCT',
      description: 'Read product permission',
      module: 'product',
      path: '/api/products',
      method: 'GET',
      createdById: null,
      updatedById: null,
      deletedById: null,
      deletedAt: null,
      createdAt: new Date('2024-01-01'),
      updatedAt: new Date('2024-01-01'),
      roles: [
        { id: 1, name: 'USER' },
        { id: 2, name: 'ADMIN' },
      ],
      ...overrides,
    }),
  }

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PermissionRepo,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile()

    repository = module.get<PermissionRepo>(PermissionRepo)

    // Reset mocks
    jest.clearAllMocks()
  })

  describe('list', () => {
    it('should get list of permissions with pagination', async () => {
      // Arrange - Chuẩn bị dữ liệu
      const pagination = { page: 1, limit: 10 }
      const mockPermissions = [
        createTestData.permission({ id: 1, name: 'READ_PRODUCT', path: '/api/products', method: 'GET' }),
        createTestData.permission({ id: 2, name: 'WRITE_PRODUCT', path: '/api/products', method: 'POST' }),
      ]

      mockPrismaService.permission.count.mockResolvedValue(2)
      mockPrismaService.permission.findMany.mockResolvedValue(mockPermissions)

      // Act - Thực hiện lấy danh sách permissions
      const result = await repository.list(pagination)

      // Assert - Kiểm tra kết quả
      expect(result.data).toHaveLength(2)
      expect(result.data[0]).toMatchObject({ id: 1, name: 'READ_PRODUCT' })
      expect(result.data[1]).toMatchObject({ id: 2, name: 'WRITE_PRODUCT' })
      expect(result.totalItems).toBe(2)
      expect(result.page).toBe(1)
      expect(result.limit).toBe(10)
      expect(result.totalPages).toBe(1)
      expect(mockPrismaService.permission.count).toHaveBeenCalled()
      expect(mockPrismaService.permission.findMany).toHaveBeenCalled()
    })

    it('should calculate pagination correctly for page 2', async () => {
      // Arrange - Chuẩn bị dữ liệu
      const pagination = { page: 2, limit: 10 }
      const mockPermissions = [createTestData.permission({ id: 11 })]

      mockPrismaService.permission.count.mockResolvedValue(15)
      mockPrismaService.permission.findMany.mockResolvedValue(mockPermissions)

      // Act - Thực hiện lấy danh sách permissions trang 2
      const result = await repository.list(pagination)

      // Assert - Kiểm tra kết quả
      expect(result.page).toBe(2)
      expect(result.totalPages).toBe(2)
      expect(mockPrismaService.permission.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 10,
          take: 10,
        }),
      )
    })

    it('should only return permissions that are not deleted', async () => {
      // Arrange - Chuẩn bị dữ liệu
      const pagination = { page: 1, limit: 10 }
      const mockPermissions = [createTestData.permission({ deletedAt: null })]

      mockPrismaService.permission.count.mockResolvedValue(1)
      mockPrismaService.permission.findMany.mockResolvedValue(mockPermissions)

      // Act - Thực hiện lấy danh sách permissions
      await repository.list(pagination)

      // Assert - Kiểm tra kết quả
      expect(mockPrismaService.permission.count).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { deletedAt: null },
        }),
      )
      expect(mockPrismaService.permission.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { deletedAt: null },
        }),
      )
    })
  })

  describe('findById', () => {
    it('should find permission by id successfully', async () => {
      // Arrange - Chuẩn bị dữ liệu
      const id = 1
      const mockPermission = createTestData.permission({ id })

      mockPrismaService.permission.findUnique.mockResolvedValue(mockPermission)

      // Act - Thực hiện tìm permission
      const result = await repository.findById(id)

      // Assert - Kiểm tra kết quả
      expect(result).toMatchObject({
        id: 1,
        name: 'READ_PRODUCT',
      })
      expect(mockPrismaService.permission.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id, deletedAt: null },
        }),
      )
    })

    it('should return null when permission not found', async () => {
      // Arrange - Chuẩn bị dữ liệu
      const id = 999

      mockPrismaService.permission.findUnique.mockResolvedValue(null)

      // Act - Thực hiện tìm permission
      const result = await repository.findById(id)

      // Assert - Kiểm tra kết quả
      expect(result).toBeNull()
    })
  })

  describe('create', () => {
    it('should create permission successfully', async () => {
      // Arrange - Chuẩn bị dữ liệu
      const createdById = 1
      const data = {
        name: 'DELETE_PRODUCT',
        description: 'Delete product permission',
        module: 'product',
        path: '/api/products/:id',
        method: 'DELETE' as const,
      }
      const mockPermission = createTestData.permission({ ...data, createdById })

      mockPrismaService.permission.create.mockResolvedValue(mockPermission)

      // Act - Thực hiện tạo permission
      const result = await repository.create({ createdById, data })

      // Assert - Kiểm tra kết quả
      expect(result).toMatchObject({
        name: 'DELETE_PRODUCT',
        description: 'Delete product permission',
        createdById: 1,
      })
      expect(mockPrismaService.permission.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: {
            ...data,
            createdById,
          },
        }),
      )
    })

    it('should create permission with null createdById', async () => {
      // Arrange - Chuẩn bị dữ liệu
      const createdById = null
      const data = {
        name: 'VIEW_DASHBOARD',
        description: 'View dashboard permission',
        module: 'dashboard',
        path: '/api/dashboard',
        method: 'GET' as const,
      }
      const mockPermission = createTestData.permission({ ...data, createdById: null })

      mockPrismaService.permission.create.mockResolvedValue(mockPermission)

      // Act - Thực hiện tạo permission với createdById null
      const result = await repository.create({ createdById, data })

      // Assert - Kiểm tra kết quả
      expect(result).toMatchObject({
        name: 'VIEW_DASHBOARD',
        createdById: null,
      })
    })
  })

  describe('update', () => {
    it('should update permission successfully', async () => {
      // Arrange - Chuẩn bị dữ liệu
      const id = 1
      const updatedById = 2
      const data = {
        name: 'UPDATED_PERMISSION',
        description: 'Updated description',
        module: 'product',
        path: '/api/products/updated',
        method: 'PUT' as const,
      }
      const mockPermission = createTestData.permissionWithRoles({ ...data, updatedById })

      mockPrismaService.permission.update.mockResolvedValue(mockPermission)

      // Act - Thực hiện cập nhật permission
      const result = await repository.update({ id, updatedById, data })

      // Assert - Kiểm tra kết quả
      expect(result).toMatchObject({
        name: 'UPDATED_PERMISSION',
        description: 'Updated description',
      })
      expect(result.roles).toHaveLength(2)
      expect(mockPrismaService.permission.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id, deletedAt: null },
          data: {
            ...data,
            updatedById,
          },
          include: { roles: true },
        }),
      )
    })
  })

  describe('delete', () => {
    it('should soft delete permission by default', async () => {
      // Arrange - Chuẩn bị dữ liệu
      const id = 1
      const deletedById = 2
      const mockPermission = createTestData.permissionWithRoles({ id, deletedById, deletedAt: new Date() })

      mockPrismaService.permission.update.mockResolvedValue(mockPermission)

      // Act - Thực hiện soft delete permission
      const result = await repository.delete({ id, deletedById })

      // Assert - Kiểm tra kết quả
      expect(result).toMatchObject({
        id: 1,
        deletedById: 2,
      })
      expect(mockPrismaService.permission.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id, deletedAt: null },
          data: expect.objectContaining({
            deletedById,
          }),
          include: { roles: true },
        }),
      )
      expect(mockPrismaService.permission.delete).not.toHaveBeenCalled()
    })

    it('should hard delete permission when isHard is true', async () => {
      // Arrange - Chuẩn bị dữ liệu
      const id = 1
      const deletedById = 2
      const mockPermission = createTestData.permissionWithRoles({ id })

      mockPrismaService.permission.delete.mockResolvedValue(mockPermission)

      // Act - Thực hiện hard delete permission
      const result = await repository.delete({ id, deletedById }, true)

      // Assert - Kiểm tra kết quả
      expect(result).toMatchObject({ id: 1 })
      expect(mockPrismaService.permission.delete).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id },
          include: { roles: true },
        }),
      )
      expect(mockPrismaService.permission.update).not.toHaveBeenCalled()
    })

    it('should soft delete permission when isHard is false', async () => {
      // Arrange - Chuẩn bị dữ liệu
      const id = 1
      const deletedById = 2
      const mockPermission = createTestData.permissionWithRoles({ id, deletedById, deletedAt: new Date() })

      mockPrismaService.permission.update.mockResolvedValue(mockPermission)

      // Act - Thực hiện soft delete permission với isHard = false
      const result = await repository.delete({ id, deletedById }, false)

      // Assert - Kiểm tra kết quả
      expect(result).toMatchObject({
        id: 1,
        deletedById: 2,
      })
      expect(mockPrismaService.permission.update).toHaveBeenCalled()
      expect(mockPrismaService.permission.delete).not.toHaveBeenCalled()
    })
  })
})
