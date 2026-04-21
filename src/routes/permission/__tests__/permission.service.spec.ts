import { CACHE_MANAGER } from '@nestjs/cache-manager'
import { Test, TestingModule } from '@nestjs/testing'
import { Cache } from 'cache-manager'
import { NotFoundRecordException } from 'src/shared/error'
import { isNotFoundPrismaError, isUniqueConstraintPrismaError } from 'src/shared/helpers'
import { PermissionAlreadyExistsException } from '../permission.error'
import { CreatePermissionBodyType, UpdatePermissionBodyType } from '../permission.model'
import { PermissionRepo } from '../permission.repo'
import { PermissionService } from '../permission.service'
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
 * PERMISSION SERVICE UNIT TESTS
 *
 * Module này test service layer của Permission - CRITICAL MODULE cho RBAC system
 * Permission quản lý quyền truy cập API endpoints
 *
 * Test Coverage:
 * - List permissions với pagination
 * - Find permission by ID
 * - Create permission
 * - Update permission (với cache invalidation cho roles)
 * - Delete permission (soft delete với cache invalidation)
 * - Cache management cho affected roles
 * - Error handling (NotFound, AlreadyExists)
 * - Unique constraint (module + path + method)
 */

describe('PermissionService', () => {
  let service: PermissionService
  let mockPermissionRepo: jest.Mocked<PermissionRepo>
  let mockCacheManager: jest.Mocked<Cache>

  // Test data factories
  const createPermission = (overrides = {}) => ({
    id: 1,
    name: 'Get Users',
    module: 'USER',
    path: '/api/users',
    method: 'GET',
    roles: [],
    createdById: 1,
    updatedById: null,
    deletedById: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    deletedAt: null,
    ...overrides,
  })

  const createPermissionData = (overrides = {}): CreatePermissionBodyType => ({
    name: 'Create User',
    module: 'USER',
    path: '/api/users',
    method: 'POST',
    ...overrides,
  })

  const createUpdatePermissionData = (overrides = {}): UpdatePermissionBodyType => ({
    name: 'Update User',
    module: 'USER',
    path: '/api/users/:id',
    method: 'PUT',
    ...overrides,
  })

  beforeEach(async () => {
    mockPermissionRepo = {
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
        PermissionService,
        { provide: PermissionRepo, useValue: mockPermissionRepo },
        { provide: CACHE_MANAGER, useValue: mockCacheManager },
      ],
    }).compile()

    service = module.get<PermissionService>(PermissionService)
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  // ============================================
  // LIST PERMISSIONS
  // ============================================

  describe('list', () => {
    it('should return paginated list of permissions', async () => {
      // Arrange
      const pagination = { page: 1, limit: 10 }
      const mockResponse = {
        data: [createPermission(), createPermission({ id: 2, name: 'Create User', method: 'POST' })],
        totalItems: 2,
        page: 1,
        limit: 10,
        totalPages: 1,
      }

      mockPermissionRepo.list.mockResolvedValue(mockResponse as any)

      // Act
      const result = await service.list(pagination)

      // Assert
      expect(result).toEqual(mockResponse)
      expect(mockPermissionRepo.list).toHaveBeenCalledWith(pagination)
    })

    it('should handle pagination correctly', async () => {
      // Arrange
      const pagination = { page: 2, limit: 20 }
      const mockResponse = {
        data: [createPermission()],
        totalItems: 50,
        page: 2,
        limit: 20,
        totalPages: 3,
      }

      mockPermissionRepo.list.mockResolvedValue(mockResponse as any)

      // Act
      const result = await service.list(pagination)

      // Assert
      expect(result.page).toBe(2)
      expect(result.limit).toBe(20)
      expect(result.totalPages).toBe(3)
    })
  })

  // ============================================
  // FIND PERMISSION BY ID
  // ============================================

  describe('findById', () => {
    it('should return permission when found', async () => {
      // Arrange
      const permissionId = 1
      const mockPermission = createPermission({ id: permissionId })

      mockPermissionRepo.findById.mockResolvedValue(mockPermission as any)

      // Act
      const result = await service.findById(permissionId)

      // Assert
      expect(result).toEqual(mockPermission)
      expect(mockPermissionRepo.findById).toHaveBeenCalledWith(permissionId)
    })

    it('should throw NotFoundRecordException when permission not found', async () => {
      // Arrange
      const permissionId = 999

      mockPermissionRepo.findById.mockResolvedValue(null)

      // Act & Assert
      await expect(service.findById(permissionId)).rejects.toThrow(NotFoundRecordException)
    })
  })

  // ============================================
  // CREATE PERMISSION
  // ============================================

  describe('create', () => {
    it('should create permission successfully', async () => {
      // Arrange
      const data = createPermissionData()
      const createdById = 1
      const mockCreatedPermission = createPermission({ ...data, createdById })

      mockPermissionRepo.create.mockResolvedValue(mockCreatedPermission as any)

      // Act
      const result = await service.create({ data, createdById })

      // Assert
      expect(result).toEqual(mockCreatedPermission)
      expect(mockPermissionRepo.create).toHaveBeenCalledWith({ createdById, data })
    })

    it('should throw PermissionAlreadyExistsException when permission already exists', async () => {
      // Arrange
      const data = createPermissionData()
      const createdById = 1

      // Mock Prisma P2002 error (Unique constraint violation)
      const prismaError = new Error('Unique constraint failed')
      Object.assign(prismaError, {
        code: 'P2002',
        clientVersion: '5.0.0',
        meta: { target: ['module', 'path', 'method'] },
      })
      mockPermissionRepo.create.mockRejectedValue(prismaError)
      mockIsUniqueConstraintPrismaError.mockReturnValue(true)

      // Act & Assert
      await expect(service.create({ data, createdById })).rejects.toThrow(PermissionAlreadyExistsException)
    })

    it('should create permission with different HTTP methods', async () => {
      // Arrange
      const methods = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH']

      for (const method of methods) {
        const data = createPermissionData({ method })
        const createdById = 1

        mockPermissionRepo.create.mockResolvedValue(createPermission({ ...data, method }) as any)

        // Act
        const result = await service.create({ data, createdById })

        // Assert
        expect(result.method).toBe(method)
      }
    })
  })

  // ============================================
  // UPDATE PERMISSION
  // ============================================

  describe('update', () => {
    it('should update permission successfully and clear cache for affected roles', async () => {
      // Arrange
      const id = 1
      const data = createUpdatePermissionData()
      const updatedById = 1
      const mockUpdatedPermission = {
        ...createPermission({ id, ...data, updatedById }),
        roles: [{ id: 4 }, { id: 5 }],
      }

      mockPermissionRepo.update.mockResolvedValue(mockUpdatedPermission as any)
      mockCacheManager.del.mockResolvedValue(true as any)

      // Act
      const result = await service.update({ id, data, updatedById })

      // Assert
      expect(result).toEqual(mockUpdatedPermission)
      expect(mockPermissionRepo.update).toHaveBeenCalledWith({ id, updatedById, data })
      expect(mockCacheManager.del).toHaveBeenCalledTimes(2)
      expect(mockCacheManager.del).toHaveBeenCalledWith('roles:4')
      expect(mockCacheManager.del).toHaveBeenCalledWith('roles:5')
    })

    it('should throw NotFoundRecordException when updating non-existent permission', async () => {
      // Arrange
      const id = 999
      const data = createUpdatePermissionData()
      const updatedById = 1

      // Mock Prisma P2025 error (Record not found)
      const prismaError = new Error('Record not found')
      Object.assign(prismaError, {
        code: 'P2025',
        clientVersion: '5.0.0',
        meta: { cause: 'Record to update not found.' },
      })
      mockPermissionRepo.update.mockRejectedValue(prismaError)
      mockIsNotFoundPrismaError.mockReturnValue(true)

      // Act & Assert
      await expect(service.update({ id, data, updatedById })).rejects.toThrow(NotFoundRecordException)
    })

    it('should throw PermissionAlreadyExistsException when updating to duplicate permission', async () => {
      // Arrange
      const id = 1
      const data = createUpdatePermissionData()
      const updatedById = 1

      // Mock Prisma P2002 error (Unique constraint violation)
      const prismaError = new Error('Unique constraint failed')
      Object.assign(prismaError, {
        code: 'P2002',
        clientVersion: '5.0.0',
        meta: { target: ['module', 'path', 'method'] },
      })
      mockPermissionRepo.update.mockRejectedValue(prismaError)
      mockIsUniqueConstraintPrismaError.mockReturnValue(true)

      // Act & Assert
      await expect(service.update({ id, data, updatedById })).rejects.toThrow(PermissionAlreadyExistsException)
    })

    it('should handle permission with no roles', async () => {
      // Arrange
      const id = 1
      const data = createUpdatePermissionData()
      const updatedById = 1
      const mockUpdatedPermission = {
        ...createPermission({ id, ...data, updatedById }),
        roles: [],
      }

      mockPermissionRepo.update.mockResolvedValue(mockUpdatedPermission as any)

      // Act
      await service.update({ id, data, updatedById })

      // Assert
      expect(mockCacheManager.del).not.toHaveBeenCalled()
    })
  })

  // ============================================
  // DELETE PERMISSION
  // ============================================

  describe('delete', () => {
    it('should delete permission successfully and clear cache for affected roles', async () => {
      // Arrange
      const id = 1
      const deletedById = 1
      const mockDeletedPermission = {
        ...createPermission({ id, deletedById }),
        roles: [{ id: 4 }, { id: 5 }, { id: 6 }],
      }

      mockPermissionRepo.delete.mockResolvedValue(mockDeletedPermission as any)
      mockCacheManager.del.mockResolvedValue(true as any)

      // Act
      const result = await service.delete({ id, deletedById })

      // Assert
      expect(result).toEqual({ message: MESSAGES.DELETE_SUCCESS })
      expect(mockPermissionRepo.delete).toHaveBeenCalledWith({ id, deletedById })
      expect(mockCacheManager.del).toHaveBeenCalledTimes(3)
      expect(mockCacheManager.del).toHaveBeenCalledWith('roles:4')
      expect(mockCacheManager.del).toHaveBeenCalledWith('roles:5')
      expect(mockCacheManager.del).toHaveBeenCalledWith('roles:6')
    })

    it('should throw NotFoundRecordException when deleting non-existent permission', async () => {
      // Arrange
      const id = 999
      const deletedById = 1

      // Mock Prisma P2025 error (Record not found)
      const prismaError = new Error('Record not found')
      Object.assign(prismaError, {
        code: 'P2025',
        clientVersion: '5.0.0',
        meta: { cause: 'Record to delete not found.' },
      })
      mockPermissionRepo.delete.mockRejectedValue(prismaError)
      mockIsNotFoundPrismaError.mockReturnValue(true)

      // Act & Assert
      await expect(service.delete({ id, deletedById })).rejects.toThrow(NotFoundRecordException)
    })

    it('should handle permission with no roles when deleting', async () => {
      // Arrange
      const id = 1
      const deletedById = 1
      const mockDeletedPermission = {
        ...createPermission({ id, deletedById }),
        roles: [],
      }

      mockPermissionRepo.delete.mockResolvedValue(mockDeletedPermission as any)

      // Act
      await service.delete({ id, deletedById })

      // Assert
      expect(mockCacheManager.del).not.toHaveBeenCalled()
    })
  })
})
