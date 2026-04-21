import { Test, TestingModule } from '@nestjs/testing'
import { RoleName } from 'src/shared/constants/role.constant'
import { RoleType } from 'src/shared/models/shared-role.model'
import { SharedRoleRepository } from 'src/shared/repositories/shared-role.repo'
import { PrismaService } from 'src/shared/services/prisma.service'

describe('SharedRoleRepository', () => {
  let repository: SharedRoleRepository

  // Mock PrismaService
  const mockPrismaService = {
    $queryRaw: jest.fn(),
  }

  const createTestData = {
    role: (overrides = {}): RoleType => ({
      id: 1,
      name: RoleName.Client,
      description: 'Client role',
      isActive: true,
      createdById: null,
      updatedById: null,
      deletedById: null,
      deletedAt: null,
      createdAt: '2024-01-01T00:00:00.000Z',
      updatedAt: '2024-01-01T00:00:00.000Z',
      ...overrides,
    }),
  }

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SharedRoleRepository,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile()

    repository = module.get<SharedRoleRepository>(SharedRoleRepository)

    // Reset mocks
    jest.clearAllMocks()
  })

  describe('getClientRoleId', () => {
    it('should get client role id from database on first call', async () => {
      const mockRole = createTestData.role({ id: 2, name: RoleName.Client })
      mockPrismaService.$queryRaw.mockResolvedValue([mockRole])

      const result = await repository.getClientRoleId()

      expect(result).toBe(2)
      expect(mockPrismaService.$queryRaw).toHaveBeenCalledTimes(1)
    })

    it('should return cached client role id on subsequent calls', async () => {
      const mockRole = createTestData.role({ id: 2, name: RoleName.Client })
      mockPrismaService.$queryRaw.mockResolvedValue([mockRole])

      const result1 = await repository.getClientRoleId()
      const result2 = await repository.getClientRoleId()
      const result3 = await repository.getClientRoleId()

      expect(result1).toBe(2)
      expect(result2).toBe(2)
      expect(result3).toBe(2)
      expect(mockPrismaService.$queryRaw).toHaveBeenCalledTimes(1)
    })

    it('should throw error when client role not found', async () => {
      mockPrismaService.$queryRaw.mockResolvedValue([])

      await expect(repository.getClientRoleId()).rejects.toThrow('Role not found')
    })
  })

  describe('getAdminRoleId', () => {
    it('should get admin role id from database on first call', async () => {
      const mockRole = createTestData.role({ id: 1, name: RoleName.Admin })
      mockPrismaService.$queryRaw.mockResolvedValue([mockRole])

      const result = await repository.getAdminRoleId()

      expect(result).toBe(1)
      expect(mockPrismaService.$queryRaw).toHaveBeenCalledTimes(1)
    })

    it('should return cached admin role id on subsequent calls', async () => {
      const mockRole = createTestData.role({ id: 1, name: RoleName.Admin })
      mockPrismaService.$queryRaw.mockResolvedValue([mockRole])

      const result1 = await repository.getAdminRoleId()
      const result2 = await repository.getAdminRoleId()
      const result3 = await repository.getAdminRoleId()

      expect(result1).toBe(1)
      expect(result2).toBe(1)
      expect(result3).toBe(1)
      expect(mockPrismaService.$queryRaw).toHaveBeenCalledTimes(1)
    })

    it('should throw error when admin role not found', async () => {
      mockPrismaService.$queryRaw.mockResolvedValue([])

      await expect(repository.getAdminRoleId()).rejects.toThrow('Role not found')
    })
  })

  describe('caching behavior', () => {
    it('should cache client and admin role ids independently', async () => {
      const mockClientRole = createTestData.role({ id: 2, name: RoleName.Client })
      const mockAdminRole = createTestData.role({ id: 1, name: RoleName.Admin })

      mockPrismaService.$queryRaw.mockResolvedValueOnce([mockClientRole]).mockResolvedValueOnce([mockAdminRole])

      const clientId1 = await repository.getClientRoleId()
      const adminId1 = await repository.getAdminRoleId()
      const clientId2 = await repository.getClientRoleId()
      const adminId2 = await repository.getAdminRoleId()

      expect(clientId1).toBe(2)
      expect(clientId2).toBe(2)
      expect(adminId1).toBe(1)
      expect(adminId2).toBe(1)
      expect(mockPrismaService.$queryRaw).toHaveBeenCalledTimes(2)
    })
  })
})
