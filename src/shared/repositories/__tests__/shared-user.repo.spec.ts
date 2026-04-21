import { Test, TestingModule } from '@nestjs/testing'
import { UserStatus } from 'src/shared/constants/auth.constant'
import { HTTPMethod } from 'src/shared/constants/role.constant'
import { UserType } from 'src/shared/models/shared-user.model'
import { SharedUserRepository, UserIncludeRolePermissionsType } from 'src/shared/repositories/shared-user.repo'
import { PrismaService } from 'src/shared/services/prisma.service'

describe('SharedUserRepository', () => {
  let repository: SharedUserRepository

  // Mock PrismaService
  const mockPrismaService = {
    user: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
    },
  }

  const createTestData = {
    user: (overrides = {}): UserType => ({
      id: 1,
      email: 'test@example.com',
      password: 'hashedPassword',
      name: 'Test User',
      phoneNumber: '0123456789',
      avatar: null,
      totpSecret: null,
      status: UserStatus.ACTIVE,
      roleId: 1,
      createdById: null,
      updatedById: null,
      deletedById: null,
      deletedAt: null,
      createdAt: '2024-01-01T00:00:00.000Z',
      updatedAt: '2024-01-01T00:00:00.000Z',
      ...overrides,
    }),
    userWithRolePermissions: (overrides = {}): UserIncludeRolePermissionsType => ({
      id: 1,
      email: 'test@example.com',
      password: 'hashedPassword',
      name: 'Test User',
      phoneNumber: '0123456789',
      avatar: null,
      totpSecret: null,
      status: UserStatus.ACTIVE,
      roleId: 1,
      createdById: null,
      updatedById: null,
      deletedById: null,
      deletedAt: null,
      createdAt: '2024-01-01T00:00:00.000Z',
      updatedAt: '2024-01-01T00:00:00.000Z',
      role: {
        id: 1,
        name: 'Admin',
        description: 'Administrator role',
        isActive: true,
        createdById: null,
        updatedById: null,
        deletedById: null,
        deletedAt: null,
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z',
        permissions: [
          {
            id: 1,
            name: 'read:users',
            description: 'Read users permission',
            module: 'users',
            path: '/users',
            method: HTTPMethod.GET,
            createdById: null,
            updatedById: null,
            deletedById: null,
            deletedAt: null,
            createdAt: '2024-01-01T00:00:00.000Z',
            updatedAt: '2024-01-01T00:00:00.000Z',
          },
        ],
      },
      ...overrides,
    }),
  }

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SharedUserRepository,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile()

    repository = module.get<SharedUserRepository>(SharedUserRepository)

    // Reset mocks
    jest.clearAllMocks()
  })

  describe('findUnique', () => {
    it('should find user by id', async () => {
      const mockUser = createTestData.user()
      mockPrismaService.user.findFirst.mockResolvedValue(mockUser as any)

      const result = await repository.findUnique({ id: 1 })

      expect(result).toEqual(mockUser)
      expect(mockPrismaService.user.findFirst).toHaveBeenCalledWith({
        where: {
          id: 1,
          deletedAt: null,
        },
      })
    })

    it('should find user by email', async () => {
      const mockUser = createTestData.user()
      mockPrismaService.user.findFirst.mockResolvedValue(mockUser as any)

      const result = await repository.findUnique({ email: 'test@example.com' })

      expect(result).toEqual(mockUser)
      expect(mockPrismaService.user.findFirst).toHaveBeenCalledWith({
        where: {
          email: 'test@example.com',
          deletedAt: null,
        },
      })
    })

    it('should return null when user not found', async () => {
      mockPrismaService.user.findFirst.mockResolvedValue(null)

      const result = await repository.findUnique({ id: 999 })

      expect(result).toBeNull()
    })
  })

  describe('findUniqueIncludeRolePermissions', () => {
    it('should find user with role and permissions by id', async () => {
      const mockUser = createTestData.userWithRolePermissions()
      mockPrismaService.user.findFirst.mockResolvedValue(mockUser as any)

      const result = await repository.findUniqueIncludeRolePermissions({ id: 1 })

      expect(result).toEqual(mockUser)
      expect(mockPrismaService.user.findFirst).toHaveBeenCalledWith({
        where: {
          id: 1,
          deletedAt: null,
        },
        include: {
          role: {
            include: {
              permissions: {
                where: {
                  deletedAt: null,
                },
              },
            },
          },
        },
      })
    })

    it('should find user with role and permissions by email', async () => {
      const mockUser = createTestData.userWithRolePermissions()
      mockPrismaService.user.findFirst.mockResolvedValue(mockUser as any)

      const result = await repository.findUniqueIncludeRolePermissions({ email: 'test@example.com' })

      expect(result).toEqual(mockUser)
      expect(mockPrismaService.user.findFirst).toHaveBeenCalledWith({
        where: {
          email: 'test@example.com',
          deletedAt: null,
        },
        include: {
          role: {
            include: {
              permissions: {
                where: {
                  deletedAt: null,
                },
              },
            },
          },
        },
      })
    })

    it('should return null when user not found', async () => {
      mockPrismaService.user.findFirst.mockResolvedValue(null)

      const result = await repository.findUniqueIncludeRolePermissions({ id: 999 })

      expect(result).toBeNull()
    })
  })

  describe('updateUser', () => {
    it('should update user successfully', async () => {
      const mockUser = createTestData.user({ name: 'Updated User' })
      mockPrismaService.user.update.mockResolvedValue(mockUser as any)

      const result = await repository.updateUser({ id: 1 }, { name: 'Updated User' })

      expect(result).toEqual(mockUser)
      expect(mockPrismaService.user.update).toHaveBeenCalledWith({
        where: {
          id: 1,
          deletedAt: null,
        },
        data: { name: 'Updated User' },
      })
    })
  })

  describe('findById', () => {
    it('should find user by id', async () => {
      const mockUser = createTestData.user()
      mockPrismaService.user.findFirst.mockResolvedValue(mockUser as any)

      const result = await repository.findById(1)

      expect(result).toEqual(mockUser)
      expect(mockPrismaService.user.findFirst).toHaveBeenCalledWith({
        where: {
          id: 1,
          deletedAt: null,
        },
      })
    })
  })

  describe('findByIds', () => {
    it('should find multiple users by ids', async () => {
      const mockUsers = [createTestData.user({ id: 1 }), createTestData.user({ id: 2 })]
      mockPrismaService.user.findMany.mockResolvedValue(mockUsers as any)

      const result = await repository.findByIds([1, 2])

      expect(result).toEqual(mockUsers)
      expect(mockPrismaService.user.findMany).toHaveBeenCalledWith({
        where: {
          id: { in: [1, 2] },
          deletedAt: null,
        },
      })
    })

    it('should return empty array when no users found', async () => {
      mockPrismaService.user.findMany.mockResolvedValue([])

      const result = await repository.findByIds([999])

      expect(result).toEqual([])
    })
  })

  describe('findMany', () => {
    it('should find users with default options', async () => {
      const mockUsers = [createTestData.user()]
      mockPrismaService.user.findMany.mockResolvedValue(mockUsers as any)

      const result = await repository.findMany()

      expect(result).toEqual(mockUsers)
      expect(mockPrismaService.user.findMany).toHaveBeenCalledWith({
        where: {
          deletedAt: null,
        },
        skip: undefined,
        take: undefined,
        orderBy: undefined,
      })
    })

    it('should find users with pagination', async () => {
      const mockUsers = [createTestData.user()]
      mockPrismaService.user.findMany.mockResolvedValue(mockUsers as any)

      const result = await repository.findMany({ skip: 10, take: 5 })

      expect(result).toEqual(mockUsers)
      expect(mockPrismaService.user.findMany).toHaveBeenCalledWith({
        where: {
          deletedAt: null,
        },
        skip: 10,
        take: 5,
        orderBy: undefined,
      })
    })

    it('should find users with where clause', async () => {
      const mockUsers = [createTestData.user()]
      mockPrismaService.user.findMany.mockResolvedValue(mockUsers as any)

      const result = await repository.findMany({ where: { roleId: 1 } })

      expect(result).toEqual(mockUsers)
      expect(mockPrismaService.user.findMany).toHaveBeenCalledWith({
        where: {
          deletedAt: null,
          roleId: 1,
        },
        skip: undefined,
        take: undefined,
        orderBy: undefined,
      })
    })

    it('should find users with orderBy', async () => {
      const mockUsers = [createTestData.user()]
      mockPrismaService.user.findMany.mockResolvedValue(mockUsers as any)

      const result = await repository.findMany({ orderBy: { createdAt: 'desc' } })

      expect(result).toEqual(mockUsers)
      expect(mockPrismaService.user.findMany).toHaveBeenCalledWith({
        where: {
          deletedAt: null,
        },
        skip: undefined,
        take: undefined,
        orderBy: { createdAt: 'desc' },
      })
    })
  })
})
