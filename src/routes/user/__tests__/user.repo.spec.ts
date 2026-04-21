import { Test, TestingModule } from '@nestjs/testing'
import { UserRepo } from '../user.repo'
import { PrismaService } from 'src/shared/services/prisma.service'

describe('UserRepo', () => {
  let repository: UserRepo

  // Mock PrismaService
  const mockPrismaService = {
    user: {
      create: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      count: jest.fn(),
    },
  }

  // Test data factory
  const createTestData = {
    user: (overrides = {}) => ({
      id: 1,
      email: 'test@example.com',
      name: 'Test User',
      phoneNumber: '0123456789',
      avatar: null,
      status: 'ACTIVE',
      password: 'hashed_password',
      roleId: 1,
      createdById: null,
      updatedById: null,
      deletedById: null,
      deletedAt: null,
      createdAt: new Date('2024-01-01'),
      updatedAt: new Date('2024-01-01'),
      ...overrides,
    }),
    userWithRole: (overrides = {}) => ({
      id: 1,
      email: 'test@example.com',
      name: 'Test User',
      phoneNumber: '0123456789',
      avatar: null,
      status: 'ACTIVE',
      password: 'hashed_password',
      roleId: 1,
      createdById: null,
      updatedById: null,
      deletedById: null,
      deletedAt: null,
      createdAt: new Date('2024-01-01'),
      updatedAt: new Date('2024-01-01'),
      role: {
        id: 1,
        name: 'USER',
      },
      ...overrides,
    }),
  }

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserRepo,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile()

    repository = module.get<UserRepo>(UserRepo)

    // Reset mocks
    jest.clearAllMocks()
  })

  describe('getListUser', () => {
    it('should get list of users with pagination', async () => {
      // Arrange - Chuẩn bị dữ liệu
      const pagination = { page: 1, limit: 10 }
      const mockUsers = [
        createTestData.userWithRole({ id: 1, email: 'user1@example.com' }),
        createTestData.userWithRole({ id: 2, email: 'user2@example.com' }),
      ]

      mockPrismaService.user.count.mockResolvedValue(2)
      mockPrismaService.user.findMany.mockResolvedValue(mockUsers)

      // Act - Thực hiện lấy danh sách users
      const result = await repository.getListUser(pagination)

      // Assert - Kiểm tra kết quả
      expect(result.data).toHaveLength(2)
      expect(result.data[0]).toMatchObject({ id: 1, email: 'user1@example.com' })
      expect(result.data[1]).toMatchObject({ id: 2, email: 'user2@example.com' })
      expect(result.totalItems).toBe(2)
      expect(result.page).toBe(1)
      expect(result.limit).toBe(10)
      expect(result.totalPages).toBe(1)
      expect(mockPrismaService.user.count).toHaveBeenCalled()
      expect(mockPrismaService.user.findMany).toHaveBeenCalled()
    })

    it('should calculate pagination correctly for page 2', async () => {
      // Arrange - Chuẩn bị dữ liệu
      const pagination = { page: 2, limit: 10 }
      const mockUsers = [createTestData.userWithRole({ id: 11 })]

      mockPrismaService.user.count.mockResolvedValue(15)
      mockPrismaService.user.findMany.mockResolvedValue(mockUsers)

      // Act - Thực hiện lấy danh sách users trang 2
      const result = await repository.getListUser(pagination)

      // Assert - Kiểm tra kết quả
      expect(result.page).toBe(2)
      expect(result.totalPages).toBe(2)
      expect(mockPrismaService.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 10,
          take: 10,
        }),
      )
    })

    it('should only return users that are not deleted', async () => {
      // Arrange - Chuẩn bị dữ liệu
      const pagination = { page: 1, limit: 10 }
      const mockUsers = [createTestData.userWithRole({ deletedAt: null })]

      mockPrismaService.user.count.mockResolvedValue(1)
      mockPrismaService.user.findMany.mockResolvedValue(mockUsers)

      // Act - Thực hiện lấy danh sách users
      await repository.getListUser(pagination)

      // Assert - Kiểm tra kết quả
      expect(mockPrismaService.user.count).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { deletedAt: null },
        }),
      )
      expect(mockPrismaService.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { deletedAt: null },
        }),
      )
    })
  })

  describe('createUser', () => {
    it('should create user successfully', async () => {
      // Arrange - Chuẩn bị dữ liệu
      const createdById = 1
      const data = {
        email: 'newuser@example.com',
        name: 'New User',
        phoneNumber: '0987654321',
        avatar: null,
        status: 'ACTIVE' as const,
        password: 'hashed_password',
        roleId: 2,
      }
      const mockUser = createTestData.user({ ...data, createdById })

      mockPrismaService.user.create.mockResolvedValue(mockUser)

      // Act - Thực hiện tạo user
      const result = await repository.createUser({ createdById, data })

      // Assert - Kiểm tra kết quả
      expect(result).toMatchObject({
        email: 'newuser@example.com',
        name: 'New User',
        createdById: 1,
      })
      expect(mockPrismaService.user.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: {
            ...data,
            createdById,
          },
        }),
      )
    })

    it('should create user with null createdById', async () => {
      // Arrange - Chuẩn bị dữ liệu
      const createdById = null
      const data = {
        email: 'newuser@example.com',
        name: 'New User',
        phoneNumber: '0987654321',
        avatar: null,
        status: 'ACTIVE' as const,
        password: 'hashed_password',
        roleId: 2,
      }
      const mockUser = createTestData.user({ ...data, createdById: null })

      mockPrismaService.user.create.mockResolvedValue(mockUser)

      // Act - Thực hiện tạo user với createdById null
      const result = await repository.createUser({ createdById, data })

      // Assert - Kiểm tra kết quả
      expect(result).toMatchObject({
        email: 'newuser@example.com',
        createdById: null,
      })
    })
  })

  describe('deleteUser', () => {
    it('should soft delete user by default', async () => {
      // Arrange - Chuẩn bị dữ liệu
      const id = 1
      const deletedById = 2
      const mockUser = createTestData.user({ id, deletedById, deletedAt: new Date() })

      mockPrismaService.user.update.mockResolvedValue(mockUser)

      // Act - Thực hiện soft delete user
      const result = await repository.deleteUser({ id, deletedById })

      // Assert - Kiểm tra kết quả
      expect(result).toMatchObject({
        id: 1,
        deletedById: 2,
      })
      expect(mockPrismaService.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id },
          data: expect.objectContaining({
            deletedById,
          }),
        }),
      )
      expect(mockPrismaService.user.delete).not.toHaveBeenCalled()
    })

    it('should hard delete user when isHard is true', async () => {
      // Arrange - Chuẩn bị dữ liệu
      const id = 1
      const deletedById = 2
      const mockUser = createTestData.user({ id })

      mockPrismaService.user.delete.mockResolvedValue(mockUser)

      // Act - Thực hiện hard delete user
      const result = await repository.deleteUser({ id, deletedById }, true)

      // Assert - Kiểm tra kết quả
      expect(result).toMatchObject({ id: 1 })
      expect(mockPrismaService.user.delete).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id },
        }),
      )
      expect(mockPrismaService.user.update).not.toHaveBeenCalled()
    })

    it('should soft delete user when isHard is false', async () => {
      // Arrange - Chuẩn bị dữ liệu
      const id = 1
      const deletedById = 2
      const mockUser = createTestData.user({ id, deletedById, deletedAt: new Date() })

      mockPrismaService.user.update.mockResolvedValue(mockUser)

      // Act - Thực hiện soft delete user với isHard = false
      const result = await repository.deleteUser({ id, deletedById }, false)

      // Assert - Kiểm tra kết quả
      expect(result).toMatchObject({
        id: 1,
        deletedById: 2,
      })
      expect(mockPrismaService.user.update).toHaveBeenCalled()
      expect(mockPrismaService.user.delete).not.toHaveBeenCalled()
    })
  })
})
