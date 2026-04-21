import { CACHE_MANAGER } from '@nestjs/cache-manager'
import { Test, TestingModule } from '@nestjs/testing'
import { Cache } from 'cache-manager'
import { RoleName } from 'src/shared/constants/role.constant'
import { NotFoundRecordException } from 'src/shared/error'
import { isNotFoundPrismaError, isUniqueConstraintPrismaError } from 'src/shared/helpers'
import { ProhibitedActionOnBaseRoleException, RoleAlreadyExistsException } from '../role.error'
import { CreateRoleBodyType, UpdateRoleBodyType } from '../role.model'
import { RoleRepo } from '../role.repo'
import { RoleService } from '../role.service'
import { MESSAGES } from 'src/shared/constants/app.constant'

// Mock helper functions
jest.mock('src/shared/helpers', () => ({
  isNotFoundPrismaError: jest.fn(),
  isUniqueConstraintPrismaError: jest.fn(),
}))

const mockIsNotFoundPrismaError = isNotFoundPrismaError as jest.MockedFunction<typeof isNotFoundPrismaError>
const mockIsUniqueConstraintPrismaError = isUniqueConstraintPrismaError as jest.MockedFunction<
  typeof isUniqueConstraintPrismaError
>

/**
 * ROLE SERVICE UNIT TESTS
 *
 * Module này test service layer của Role - CRITICAL MODULE cho RBAC system
 * Role quản lý vai trò người dùng và permissions
 *
 * Test Coverage:
 * - List roles với pagination
 * - Find role by ID
 * - Create role
 * - Update role (với permission assignment)
 * - Delete role (soft delete)
 * - Base role protection (ADMIN, CLIENT, SELLER)
 * - Cache management
 * - Error handling (NotFound, AlreadyExists, ProhibitedAction)
 */

describe('RoleService', () => {
  let service: RoleService
  let mockRoleRepo: jest.Mocked<RoleRepo>
  let mockCacheManager: jest.Mocked<Cache>

  // Test data factories
  const createRole = (overrides = {}) => ({
    id: 4,
    name: 'MANAGER',
    description: 'Manager role',
    isActive: true,
    permissions: [],
    createdById: 1,
    updatedById: null,
    deletedById: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    deletedAt: null,
    ...overrides,
  })

  const createRoleData = (overrides = {}): CreateRoleBodyType => ({
    name: 'SUPERVISOR',
    description: 'Supervisor role',
    isActive: true,
    ...overrides,
  })

  const createUpdateRoleData = (overrides = {}): UpdateRoleBodyType => ({
    name: 'MANAGER_UPDATED',
    description: 'Updated manager role',
    isActive: true,
    permissionIds: [1, 2, 3],
    ...overrides,
  })

  beforeEach(async () => {
    mockRoleRepo = {
      list: jest.fn(),
      findById: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    } as any

    mockCacheManager = {
      get: jest.fn(),
      set: jest.fn(),
      del: jest.fn(),
      reset: jest.fn(),
    } as any

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RoleService,
        { provide: RoleRepo, useValue: mockRoleRepo },
        { provide: CACHE_MANAGER, useValue: mockCacheManager },
      ],
    }).compile()

    service = module.get<RoleService>(RoleService)
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  // ============================================
  // LIST ROLES
  // ============================================

  describe('list', () => {
    it('should return paginated list of roles', async () => {
      // Arrange
      const pagination = { page: 1, limit: 10 }
      const mockResponse = {
        data: [createRole(), createRole({ id: 5, name: 'SUPERVISOR' })],
        totalItems: 2,
        page: 1,
        limit: 10,
        totalPages: 1,
      }

      mockRoleRepo.list.mockResolvedValue(mockResponse as any)

      // Act
      const result = await service.list(pagination)

      // Assert
      expect(result).toEqual(mockResponse)
      expect(mockRoleRepo.list).toHaveBeenCalledWith(pagination)
    })

    it('should handle pagination correctly', async () => {
      // Arrange
      const pagination = { page: 2, limit: 5 }
      const mockResponse = {
        data: [createRole()],
        totalItems: 10,
        page: 2,
        limit: 5,
        totalPages: 2,
      }

      mockRoleRepo.list.mockResolvedValue(mockResponse as any)

      // Act
      const result = await service.list(pagination)

      // Assert
      expect(result.page).toBe(2)
      expect(result.limit).toBe(5)
      expect(result.totalPages).toBe(2)
    })
  })

  // ============================================
  // FIND ROLE BY ID
  // ============================================

  describe('findById', () => {
    it('should return role when found', async () => {
      // Arrange
      const roleId = 4
      const mockRole = createRole({ id: roleId })

      mockRoleRepo.findById.mockResolvedValue(mockRole as any)

      // Act
      const result = await service.findById(roleId)

      // Assert
      expect(result).toEqual(mockRole)
      expect(mockRoleRepo.findById).toHaveBeenCalledWith(roleId)
    })

    it('should throw NotFoundRecordException when role not found', async () => {
      // Arrange
      const roleId = 999

      mockRoleRepo.findById.mockResolvedValue(null)

      // Act & Assert
      await expect(service.findById(roleId)).rejects.toThrow(NotFoundRecordException)
    })
  })

  // ============================================
  // CREATE ROLE
  // ============================================

  describe('create', () => {
    it('should create role successfully', async () => {
      // Arrange
      const data = createRoleData()
      const createdById = 1
      const mockCreatedRole = createRole({ ...data, createdById })

      mockRoleRepo.create.mockResolvedValue(mockCreatedRole as any)

      // Act
      const result = await service.create({ data, createdById })

      // Assert
      expect(result).toEqual(mockCreatedRole)
      expect(mockRoleRepo.create).toHaveBeenCalledWith({ createdById, data })
    })

    it('should throw RoleAlreadyExistsException when role name already exists', async () => {
      // Arrange
      const data = createRoleData({ name: 'MANAGER' })
      const createdById = 1

      // Mock Prisma P2002 error (Unique constraint violation)
      const prismaError = new Error('Unique constraint failed')
      Object.assign(prismaError, {
        code: 'P2002',
        clientVersion: '5.0.0',
        meta: { target: ['name'] },
      })
      mockRoleRepo.create.mockRejectedValue(prismaError)
      mockIsUniqueConstraintPrismaError.mockReturnValue(true)

      // Act & Assert
      await expect(service.create({ data, createdById })).rejects.toThrow(RoleAlreadyExistsException)
    })

    it('should create role with isActive flag', async () => {
      // Arrange
      const data = createRoleData({ isActive: false })
      const createdById = 1

      mockRoleRepo.create.mockResolvedValue(createRole({ ...data, isActive: false }) as any)

      // Act
      const result = await service.create({ data, createdById })

      // Assert
      expect(result.isActive).toBe(false)
    })

    it('should throw error when create fails with non-unique constraint error', async () => {
      // Arrange
      const data = createRoleData()
      const createdById = 1
      const genericError = new Error('Database connection failed')

      mockRoleRepo.create.mockRejectedValue(genericError)
      mockIsUniqueConstraintPrismaError.mockReturnValue(false)

      // Act & Assert
      await expect(service.create({ data, createdById })).rejects.toThrow('Database connection failed')
    })
  })

  // ============================================
  // UPDATE ROLE
  // ============================================

  describe('update', () => {
    it('should update role successfully and clear cache', async () => {
      // Arrange
      const id = 4
      const data = createUpdateRoleData()
      const updatedById = 1
      const mockUpdatedRole = createRole({ id, ...data, updatedById })

      mockRoleRepo.findById.mockResolvedValue(createRole({ id }) as any)
      mockRoleRepo.update.mockResolvedValue(mockUpdatedRole as any)
      mockCacheManager.del.mockResolvedValue(true as any)

      // Act
      const result = await service.update({ id, data, updatedById })

      // Assert
      expect(result).toEqual(mockUpdatedRole)
      expect(mockRoleRepo.update).toHaveBeenCalledWith({ id, updatedById, data })
      expect(mockCacheManager.del).toHaveBeenCalledWith(`roles:${id}`)
    })

    it('should prevent updating base role ADMIN', async () => {
      // Arrange
      const id = 1
      const data = createUpdateRoleData()
      const updatedById = 1

      mockRoleRepo.findById.mockResolvedValue(createRole({ id, name: RoleName.Admin }) as any)

      // Act & Assert
      await expect(service.update({ id, data, updatedById })).rejects.toThrow(ProhibitedActionOnBaseRoleException)
      expect(mockRoleRepo.update).not.toHaveBeenCalled()
    })

    it('should prevent updating base role CLIENT', async () => {
      // Arrange
      const id = 2
      const data = createUpdateRoleData()
      const updatedById = 1

      mockRoleRepo.findById.mockResolvedValue(createRole({ id, name: RoleName.Client }) as any)

      // Act & Assert
      await expect(service.update({ id, data, updatedById })).rejects.toThrow(ProhibitedActionOnBaseRoleException)
    })

    it('should prevent updating base role SELLER', async () => {
      // Arrange
      const id = 3
      const data = createUpdateRoleData()
      const updatedById = 1

      mockRoleRepo.findById.mockResolvedValue(createRole({ id, name: RoleName.Seller }) as any)

      // Act & Assert
      await expect(service.update({ id, data, updatedById })).rejects.toThrow(ProhibitedActionOnBaseRoleException)
    })

    it('should throw NotFoundRecordException when updating non-existent role', async () => {
      // Arrange
      const id = 999
      const data = createUpdateRoleData()
      const updatedById = 1

      mockRoleRepo.findById.mockResolvedValue(null)

      // Act & Assert
      await expect(service.update({ id, data, updatedById })).rejects.toThrow(NotFoundRecordException)
    })

    it('should throw NotFoundRecordException when update fails with Prisma not found error', async () => {
      // Arrange
      const id = 4
      const data = createUpdateRoleData()
      const updatedById = 1

      // Mock Prisma P2025 error (Record not found)
      const prismaError = new Error('Record to update not found')
      Object.assign(prismaError, {
        code: 'P2025',
        clientVersion: '5.0.0',
      })

      mockRoleRepo.findById.mockResolvedValue(createRole({ id }) as any)
      mockRoleRepo.update.mockRejectedValue(prismaError)
      mockIsNotFoundPrismaError.mockReturnValue(true)

      // Act & Assert
      await expect(service.update({ id, data, updatedById })).rejects.toThrow(NotFoundRecordException)
    })

    it('should throw RoleAlreadyExistsException when update fails with unique constraint error', async () => {
      // Arrange
      const id = 4
      const data = createUpdateRoleData({ name: 'MANAGER' })
      const updatedById = 1

      // Mock Prisma P2002 error (Unique constraint violation)
      const prismaError = new Error('Unique constraint failed')
      Object.assign(prismaError, {
        code: 'P2002',
        clientVersion: '5.0.0',
        meta: { target: ['name'] },
      })

      mockRoleRepo.findById.mockResolvedValue(createRole({ id }) as any)
      mockRoleRepo.update.mockRejectedValue(prismaError)
      mockIsNotFoundPrismaError.mockReturnValue(false)
      mockIsUniqueConstraintPrismaError.mockReturnValue(true)

      // Act & Assert
      await expect(service.update({ id, data, updatedById })).rejects.toThrow(RoleAlreadyExistsException)
    })

    it('should throw BadRequestException when update fails with generic Error', async () => {
      // Arrange
      const id = 4
      const data = createUpdateRoleData()
      const updatedById = 1
      const genericError = new Error('Invalid permission IDs')

      mockRoleRepo.findById.mockResolvedValue(createRole({ id }) as any)
      mockRoleRepo.update.mockRejectedValue(genericError)
      mockIsNotFoundPrismaError.mockReturnValue(false)
      mockIsUniqueConstraintPrismaError.mockReturnValue(false)

      // Act & Assert
      await expect(service.update({ id, data, updatedById })).rejects.toThrow('Invalid permission IDs')
    })
  })

  // ============================================
  // DELETE ROLE
  // ============================================

  describe('delete', () => {
    it('should delete role successfully and clear cache', async () => {
      // Arrange
      const id = 4
      const deletedById = 1

      mockRoleRepo.findById.mockResolvedValue(createRole({ id }) as any)
      mockRoleRepo.delete.mockResolvedValue(createRole({ id, deletedById }) as any)
      mockCacheManager.del.mockResolvedValue(true as any)

      // Act
      const result = await service.delete({ id, deletedById })

      // Assert
      expect(result).toEqual({ message: MESSAGES.DELETE_SUCCESS })
      expect(mockRoleRepo.delete).toHaveBeenCalledWith({ id, deletedById })
      expect(mockCacheManager.del).toHaveBeenCalledWith(`roles:${id}`)
    })

    it('should prevent deleting base role ADMIN', async () => {
      // Arrange
      const id = 1
      const deletedById = 1

      mockRoleRepo.findById.mockResolvedValue(createRole({ id, name: RoleName.Admin }) as any)

      // Act & Assert
      await expect(service.delete({ id, deletedById })).rejects.toThrow(ProhibitedActionOnBaseRoleException)
      expect(mockRoleRepo.delete).not.toHaveBeenCalled()
    })

    it('should prevent deleting base role CLIENT', async () => {
      // Arrange
      const id = 2
      const deletedById = 1

      mockRoleRepo.findById.mockResolvedValue(createRole({ id, name: RoleName.Client }) as any)

      // Act & Assert
      await expect(service.delete({ id, deletedById })).rejects.toThrow(ProhibitedActionOnBaseRoleException)
    })

    it('should prevent deleting base role SELLER', async () => {
      // Arrange
      const id = 3
      const deletedById = 1

      mockRoleRepo.findById.mockResolvedValue(createRole({ id, name: RoleName.Seller }) as any)

      // Act & Assert
      await expect(service.delete({ id, deletedById })).rejects.toThrow(ProhibitedActionOnBaseRoleException)
    })

    it('should throw NotFoundRecordException when delete fails with Prisma not found error', async () => {
      // Arrange
      const id = 999
      const deletedById = 1

      // Mock Prisma P2025 error (Record not found)
      const prismaError = new Error('Record to delete not found')
      Object.assign(prismaError, {
        code: 'P2025',
        clientVersion: '5.0.0',
      })

      mockRoleRepo.findById.mockResolvedValue(createRole({ id }) as any)
      mockRoleRepo.delete.mockRejectedValue(prismaError)
      mockIsNotFoundPrismaError.mockReturnValue(true)

      // Act & Assert
      await expect(service.delete({ id, deletedById })).rejects.toThrow(NotFoundRecordException)
    })
  })
})
