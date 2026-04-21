import { Test, TestingModule } from '@nestjs/testing'
import { PrismaService } from 'src/shared/services/prisma.service'
import { RoleRepo } from '../role.repo'

describe('RoleRepo', () => {
  let repository: RoleRepo

  // Mock PrismaService
  const mockPrismaService = {
    role: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      count: jest.fn(),
    },
    permission: {
      findMany: jest.fn(),
    },
  }

  // Test data factory
  const createTestData = {
    role: (overrides = {}) => ({
      id: 1,
      name: 'USER',
      description: 'User role',
      isActive: true,
      createdById: null,
      updatedById: null,
      deletedById: null,
      deletedAt: null,
      createdAt: new Date('2024-01-01'),
      updatedAt: new Date('2024-01-01'),
      ...overrides,
    }),
    roleWithPermissions: (overrides = {}) => ({
      id: 1,
      name: 'USER',
      description: 'User role',
      isActive: true,
      createdById: null,
      updatedById: null,
      deletedById: null,
      deletedAt: null,
      createdAt: new Date('2024-01-01'),
      updatedAt: new Date('2024-01-01'),
      permissions: [
        {
          id: 1,
          name: 'READ_PRODUCT',
          description: 'Read product permission',
          deletedAt: null,
        },
        {
          id: 2,
          name: 'WRITE_PRODUCT',
          description: 'Write product permission',
          deletedAt: null,
        },
      ],
      ...overrides,
    }),
    permission: (overrides = {}) => ({
      id: 1,
      name: 'READ_PRODUCT',
      description: 'Read product permission',
      createdById: null,
      updatedById: null,
      deletedById: null,
      deletedAt: null,
      createdAt: new Date('2024-01-01'),
      updatedAt: new Date('2024-01-01'),
      ...overrides,
    }),
  }

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RoleRepo,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile()

    repository = module.get<RoleRepo>(RoleRepo)

    // Reset mocks
    jest.clearAllMocks()
  })

  describe('list', () => {
    it('should get list of roles with pagination', async () => {
      // Arrange - Chuẩn bị dữ liệu
      const pagination = { page: 1, limit: 10 }
      const mockRoles = [createTestData.role({ id: 1, name: 'USER' }), createTestData.role({ id: 2, name: 'ADMIN' })]

      mockPrismaService.role.count.mockResolvedValue(2)
      mockPrismaService.role.findMany.mockResolvedValue(mockRoles)

      // Act - Thực hiện lấy danh sách roles
      const result = await repository.list(pagination)

      // Assert - Kiểm tra kết quả
      expect(result.data).toHaveLength(2)
      expect(result.data[0]).toMatchObject({ id: 1, name: 'USER' })
      expect(result.data[1]).toMatchObject({ id: 2, name: 'ADMIN' })
      expect(result.totalItems).toBe(2)
      expect(result.page).toBe(1)
      expect(result.limit).toBe(10)
      expect(result.totalPages).toBe(1)
      expect(mockPrismaService.role.count).toHaveBeenCalled()
      expect(mockPrismaService.role.findMany).toHaveBeenCalled()
    })

    it('should calculate pagination correctly for page 2', async () => {
      // Arrange - Chuẩn bị dữ liệu
      const pagination = { page: 2, limit: 10 }
      const mockRoles = [createTestData.role({ id: 11 })]

      mockPrismaService.role.count.mockResolvedValue(15)
      mockPrismaService.role.findMany.mockResolvedValue(mockRoles)

      // Act - Thực hiện lấy danh sách roles trang 2
      const result = await repository.list(pagination)

      // Assert - Kiểm tra kết quả
      expect(result.page).toBe(2)
      expect(result.totalPages).toBe(2)
      expect(mockPrismaService.role.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 10,
          take: 10,
        }),
      )
    })

    it('should only return roles that are not deleted', async () => {
      // Arrange - Chuẩn bị dữ liệu
      const pagination = { page: 1, limit: 10 }
      const mockRoles = [createTestData.role({ deletedAt: null })]

      mockPrismaService.role.count.mockResolvedValue(1)
      mockPrismaService.role.findMany.mockResolvedValue(mockRoles)

      // Act - Thực hiện lấy danh sách roles
      await repository.list(pagination)

      // Assert - Kiểm tra kết quả
      expect(mockPrismaService.role.count).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { deletedAt: null },
        }),
      )
      expect(mockPrismaService.role.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { deletedAt: null },
        }),
      )
    })
  })

  describe('findById', () => {
    it('should find role by id with permissions', async () => {
      // Arrange - Chuẩn bị dữ liệu
      const id = 1
      const mockRole = createTestData.roleWithPermissions({ id })

      mockPrismaService.role.findUnique.mockResolvedValue(mockRole)

      // Act - Thực hiện tìm role
      const result = await repository.findById(id)

      // Assert - Kiểm tra kết quả
      expect(result).toMatchObject({
        id: 1,
        name: 'USER',
      })
      expect(result?.permissions).toHaveLength(2)
      expect(mockPrismaService.role.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id, deletedAt: null },
          include: expect.objectContaining({
            permissions: expect.objectContaining({
              where: { deletedAt: null },
            }),
          }),
        }),
      )
    })

    it('should return null when role not found', async () => {
      // Arrange - Chuẩn bị dữ liệu
      const id = 999

      mockPrismaService.role.findUnique.mockResolvedValue(null)

      // Act - Thực hiện tìm role
      const result = await repository.findById(id)

      // Assert - Kiểm tra kết quả
      expect(result).toBeNull()
    })
  })

  describe('create', () => {
    it('should create role successfully', async () => {
      // Arrange - Chuẩn bị dữ liệu
      const createdById = 1
      const data = {
        name: 'MODERATOR',
        description: 'Moderator role',
        isActive: true,
        permissionIds: [1, 2],
      }
      const mockRole = createTestData.role({ ...data, createdById })

      mockPrismaService.role.create.mockResolvedValue(mockRole)

      // Act - Thực hiện tạo role
      const result = await repository.create({ createdById, data })

      // Assert - Kiểm tra kết quả
      expect(result).toMatchObject({
        name: 'MODERATOR',
        description: 'Moderator role',
        createdById: 1,
      })
      expect(mockPrismaService.role.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: {
            ...data,
            createdById,
          },
        }),
      )
    })

    it('should create role with null createdById', async () => {
      // Arrange - Chuẩn bị dữ liệu
      const createdById = null
      const data = {
        name: 'GUEST',
        description: 'Guest role',
        isActive: true,
        permissionIds: [],
      }
      const mockRole = createTestData.role({ ...data, createdById: null })

      mockPrismaService.role.create.mockResolvedValue(mockRole)

      // Act - Thực hiện tạo role với createdById null
      const result = await repository.create({ createdById, data })

      // Assert - Kiểm tra kết quả
      expect(result).toMatchObject({
        name: 'GUEST',
        createdById: null,
      })
    })
  })

  describe('update', () => {
    it('should update role successfully', async () => {
      // Arrange - Chuẩn bị dữ liệu
      const id = 1
      const updatedById = 2
      const data = {
        name: 'UPDATED_ROLE',
        description: 'Updated description',
        isActive: false,
        permissionIds: [1, 2],
      }
      const mockPermissions = [
        createTestData.permission({ id: 1, deletedAt: null }),
        createTestData.permission({ id: 2, deletedAt: null }),
      ]
      const mockRole = createTestData.roleWithPermissions({ ...data, updatedById })

      mockPrismaService.permission.findMany.mockResolvedValue(mockPermissions)
      mockPrismaService.role.update.mockResolvedValue(mockRole)

      // Act - Thực hiện cập nhật role
      const result = await repository.update({ id, updatedById, data })

      // Assert - Kiểm tra kết quả
      expect(result).toMatchObject({
        name: 'UPDATED_ROLE',
        description: 'Updated description',
      })
      expect(mockPrismaService.permission.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: { in: [1, 2] } },
        }),
      )
      expect(mockPrismaService.role.update).toHaveBeenCalled()
    })

    it('should update role with empty permissionIds', async () => {
      // Arrange - Chuẩn bị dữ liệu
      const id = 1
      const updatedById = 2
      const data = {
        name: 'ROLE_NO_PERMISSIONS',
        description: 'Role without permissions',
        isActive: true,
        permissionIds: [],
      }
      const mockRole = createTestData.roleWithPermissions({ ...data, permissions: [] })

      mockPrismaService.role.update.mockResolvedValue(mockRole)

      // Act - Thực hiện cập nhật role với permissionIds rỗng
      const result = await repository.update({ id, updatedById, data })

      // Assert - Kiểm tra kết quả
      expect(result).toMatchObject({
        name: 'ROLE_NO_PERMISSIONS',
      })
      expect(mockPrismaService.permission.findMany).not.toHaveBeenCalled()
      expect(mockPrismaService.role.update).toHaveBeenCalled()
    })

    it('should throw error when updating with deleted permissions', async () => {
      // Arrange - Chuẩn bị dữ liệu
      const id = 1
      const updatedById = 2
      const data = {
        name: 'ROLE',
        description: 'Role',
        isActive: true,
        permissionIds: [1, 2],
      }
      const mockPermissions = [
        createTestData.permission({ id: 1, deletedAt: null }),
        createTestData.permission({ id: 2, deletedAt: new Date() }), // Deleted permission
      ]

      mockPrismaService.permission.findMany.mockResolvedValue(mockPermissions)

      // Act & Assert - Thực hiện cập nhật và kiểm tra lỗi
      await expect(repository.update({ id, updatedById, data })).rejects.toThrow(
        'Cannot update role with deleted permissions: 2',
      )
      expect(mockPrismaService.permission.findMany).toHaveBeenCalled()
      expect(mockPrismaService.role.update).not.toHaveBeenCalled()
    })

    it('should throw error when updating with multiple deleted permissions', async () => {
      // Arrange - Chuẩn bị dữ liệu
      const id = 1
      const updatedById = 2
      const data = {
        name: 'ROLE',
        description: 'Role',
        isActive: true,
        permissionIds: [1, 2, 3],
      }
      const mockPermissions = [
        createTestData.permission({ id: 1, deletedAt: null }),
        createTestData.permission({ id: 2, deletedAt: new Date() }),
        createTestData.permission({ id: 3, deletedAt: new Date() }),
      ]

      mockPrismaService.permission.findMany.mockResolvedValue(mockPermissions)

      // Act & Assert - Thực hiện cập nhật và kiểm tra lỗi
      await expect(repository.update({ id, updatedById, data })).rejects.toThrow(
        'Cannot update role with deleted permissions: 2, 3',
      )
    })
  })

  describe('delete', () => {
    it('should soft delete role by default', async () => {
      // Arrange - Chuẩn bị dữ liệu
      const id = 1
      const deletedById = 2
      const mockRole = createTestData.role({ id, deletedById, deletedAt: new Date() })

      mockPrismaService.role.update.mockResolvedValue(mockRole)

      // Act - Thực hiện soft delete role
      const result = await repository.delete({ id, deletedById })

      // Assert - Kiểm tra kết quả
      expect(result).toMatchObject({
        id: 1,
        deletedById: 2,
      })
      expect(mockPrismaService.role.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id, deletedAt: null },
          data: expect.objectContaining({
            deletedById,
          }),
        }),
      )
      expect(mockPrismaService.role.delete).not.toHaveBeenCalled()
    })

    it('should hard delete role when isHard is true', async () => {
      // Arrange - Chuẩn bị dữ liệu
      const id = 1
      const deletedById = 2
      const mockRole = createTestData.role({ id })

      mockPrismaService.role.delete.mockResolvedValue(mockRole)

      // Act - Thực hiện hard delete role
      const result = await repository.delete({ id, deletedById }, true)

      // Assert - Kiểm tra kết quả
      expect(result).toMatchObject({ id: 1 })
      expect(mockPrismaService.role.delete).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id },
        }),
      )
      expect(mockPrismaService.role.update).not.toHaveBeenCalled()
    })

    it('should soft delete role when isHard is false', async () => {
      // Arrange - Chuẩn bị dữ liệu
      const id = 1
      const deletedById = 2
      const mockRole = createTestData.role({ id, deletedById, deletedAt: new Date() })

      mockPrismaService.role.update.mockResolvedValue(mockRole)

      // Act - Thực hiện soft delete role với isHard = false
      const result = await repository.delete({ id, deletedById }, false)

      // Assert - Kiểm tra kết quả
      expect(result).toMatchObject({
        id: 1,
        deletedById: 2,
      })
      expect(mockPrismaService.role.update).toHaveBeenCalled()
      expect(mockPrismaService.role.delete).not.toHaveBeenCalled()
    })
  })
})
