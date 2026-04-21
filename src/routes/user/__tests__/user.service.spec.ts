import { ForbiddenException } from '@nestjs/common'
import { Test, TestingModule } from '@nestjs/testing'
import { RoleName } from 'src/shared/constants/role.constant'
import { NotFoundRecordException } from 'src/shared/error'
import { SharedRoleRepository } from 'src/shared/repositories/shared-role.repo'
import { SharedUserRepository } from 'src/shared/repositories/shared-user.repo'
import { HashingService } from 'src/shared/services/hashing.service'
import { CannotUpdateOrDeleteYourselfException, RoleNotFoundException, UserAlreadyExistsException } from '../user.error'
import { UserRepo } from '../user.repo'
import { UserService } from '../user.service'

// Mock helper functions
jest.mock('src/shared/helpers', () => ({
  isForeignKeyConstraintPrismaError: jest.fn(),
  isNotFoundPrismaError: jest.fn(),
  isUniqueConstraintPrismaError: jest.fn(),
}))

// Import mocked helpers after jest.mock
import {
  isForeignKeyConstraintPrismaError,
  isNotFoundPrismaError,
  isUniqueConstraintPrismaError,
} from 'src/shared/helpers'

/**
 * USER SERVICE UNIT TESTS
 *
 * Module này test service layer của User
 * Đây là module CRITICAL vì quản lý user và RBAC system
 *
 * Test Coverage:
 * - User CRUD operations
 * - RBAC permission checks
 * - Password hashing
 * - Self-update/delete prevention
 * - Admin role protection
 * - Error handling
 */

describe('UserService', () => {
  let service: UserService
  let mockUserRepo: jest.Mocked<UserRepo>
  let mockHashingService: jest.Mocked<HashingService>
  let mockSharedUserRepo: jest.Mocked<SharedUserRepository>
  let mockSharedRoleRepo: jest.Mocked<SharedRoleRepository>

  // Mock helper functions
  const mockIsForeignKeyConstraintPrismaError = isForeignKeyConstraintPrismaError as jest.MockedFunction<
    typeof isForeignKeyConstraintPrismaError
  >
  const mockIsNotFoundPrismaError = isNotFoundPrismaError as jest.MockedFunction<typeof isNotFoundPrismaError>
  const mockIsUniqueConstraintPrismaError = isUniqueConstraintPrismaError as jest.MockedFunction<
    typeof isUniqueConstraintPrismaError
  >

  const ADMIN_ROLE_ID = 1
  const CLIENT_ROLE_ID = 2
  const SELLER_ROLE_ID = 3

  // Test data factories
  const createUser = (overrides = {}) => ({
    id: 10,
    email: 'test@example.com',
    name: 'Test User',
    phoneNumber: '0123456789',
    avatar: null,
    status: 'ACTIVE',
    roleId: CLIENT_ROLE_ID,
    password: 'hashed_password',
    totpSecret: null,
    createdById: null,
    updatedById: null,
    deletedById: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    deletedAt: null,
    ...overrides,
  })

  const createUserData = (overrides = {}) => ({
    email: 'newuser@example.com',
    name: 'New User',
    phoneNumber: '0987654321',
    avatar: null,
    status: 'ACTIVE' as const,
    password: 'password123',
    roleId: CLIENT_ROLE_ID,
    ...overrides,
  })

  beforeEach(async () => {
    mockUserRepo = {
      getListUser: jest.fn(),
      createUser: jest.fn(),
      deleteUser: jest.fn(),
    } as any

    mockHashingService = {
      hash: jest.fn(),
      compare: jest.fn(),
    } as any

    mockSharedUserRepo = {
      findUnique: jest.fn(),
      findUniqueIncludeRolePermissions: jest.fn(),
      updateUser: jest.fn(),
    } as any

    mockSharedRoleRepo = {
      getAdminRoleId: jest.fn(),
    } as any

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserService,
        { provide: UserRepo, useValue: mockUserRepo },
        { provide: HashingService, useValue: mockHashingService },
        { provide: SharedUserRepository, useValue: mockSharedUserRepo },
        { provide: SharedRoleRepository, useValue: mockSharedRoleRepo },
      ],
    }).compile()

    service = module.get<UserService>(UserService)

    // Setup default mocks
    mockSharedRoleRepo.getAdminRoleId.mockResolvedValue(ADMIN_ROLE_ID)
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  // ============================================
  // GET LIST USER
  // ============================================

  describe('getListUser', () => {
    it('should get list of users with pagination', async () => {
      // Arrange
      const query = { page: 1, limit: 10 }
      const expectedResult = {
        data: [createUser()],
        totalItems: 1,
        page: 1,
        limit: 10,
        totalPages: 1,
      }
      mockUserRepo.getListUser.mockResolvedValue(expectedResult as any)

      // Act
      const result = await service.getListUser(query)

      // Assert
      expect(result).toEqual(expectedResult)
      expect(mockUserRepo.getListUser).toHaveBeenCalledWith(query)
    })
  })

  // ============================================
  // FIND BY ID
  // ============================================

  describe('findById', () => {
    it('should find user by ID with role and permissions', async () => {
      // Arrange
      const userId = 10
      const expectedUser = createUser()
      mockSharedUserRepo.findUniqueIncludeRolePermissions.mockResolvedValue(expectedUser as any)

      // Act
      const result = await service.findById(userId)

      // Assert
      expect(result).toEqual(expectedUser)
      expect(mockSharedUserRepo.findUniqueIncludeRolePermissions).toHaveBeenCalledWith({ id: userId })
    })

    it('should throw NotFoundRecordException if user not found', async () => {
      // Arrange
      const userId = 999
      mockSharedUserRepo.findUniqueIncludeRolePermissions.mockResolvedValue(null)

      // Act & Assert
      await expect(service.findById(userId)).rejects.toThrow(NotFoundRecordException)
    })
  })

  // ============================================
  // CREATE USER
  // ============================================

  describe('createUser', () => {
    it('should create user successfully with hashed password', async () => {
      // Arrange
      const data = createUserData()
      const createdById = 1
      const createdByRoleName = RoleName.Admin
      const hashedPassword = 'hashed_password_123'
      const expectedUser = createUser({ email: data.email, password: hashedPassword })

      mockHashingService.hash.mockResolvedValue(hashedPassword)
      mockUserRepo.createUser.mockResolvedValue(expectedUser as any)

      // Act
      const result = await service.createUser({ data, createdById, createdByRoleName })

      // Assert
      expect(result).toEqual(expectedUser)
      expect(mockHashingService.hash).toHaveBeenCalledWith(data.password)
      expect(mockUserRepo.createUser).toHaveBeenCalledWith({
        createdById,
        data: { ...data, password: hashedPassword },
      })
    })

    it('should allow admin to create admin user', async () => {
      // Arrange
      const data = createUserData({ roleId: ADMIN_ROLE_ID })
      const createdById = 1
      const createdByRoleName = RoleName.Admin
      const hashedPassword = 'hashed_password'

      mockHashingService.hash.mockResolvedValue(hashedPassword)
      mockUserRepo.createUser.mockResolvedValue(createUser() as any)

      // Act
      await service.createUser({ data, createdById, createdByRoleName })

      // Assert
      expect(mockUserRepo.createUser).toHaveBeenCalled()
    })

    it('should prevent non-admin from creating admin user', async () => {
      // Arrange
      const data = createUserData({ roleId: ADMIN_ROLE_ID })
      const createdById = 2
      const createdByRoleName = RoleName.Client

      // Act & Assert
      await expect(service.createUser({ data, createdById, createdByRoleName })).rejects.toThrow(ForbiddenException)
    })

    it('should throw UserAlreadyExistsException if email already exists', async () => {
      // Arrange
      const data = createUserData()
      const createdById = 1
      const createdByRoleName = RoleName.Admin
      const hashedPassword = 'hashed_password'

      mockHashingService.hash.mockResolvedValue(hashedPassword)

      // Create proper Prisma P2002 error
      const prismaError = new Error('Unique constraint failed')
      Object.assign(prismaError, {
        code: 'P2002',
        clientVersion: '5.0.0',
        meta: { target: ['email'] },
      })
      mockUserRepo.createUser.mockRejectedValue(prismaError)
      mockIsUniqueConstraintPrismaError.mockReturnValue(true)

      // Act & Assert
      await expect(service.createUser({ data, createdById, createdByRoleName })).rejects.toThrow(
        UserAlreadyExistsException,
      )
    })

    it('should throw RoleNotFoundException if roleId does not exist', async () => {
      // Arrange
      const data = createUserData({ roleId: 999 })
      const createdById = 1
      const createdByRoleName = RoleName.Admin
      const hashedPassword = 'hashed_password'

      mockHashingService.hash.mockResolvedValue(hashedPassword)

      // Create proper Prisma P2003 error
      const prismaError = new Error('Foreign key constraint failed')
      Object.assign(prismaError, {
        code: 'P2003',
        clientVersion: '5.0.0',
        meta: { field_name: 'roleId' },
      })
      mockUserRepo.createUser.mockRejectedValue(prismaError)
      mockIsForeignKeyConstraintPrismaError.mockReturnValue(true)

      // Act & Assert
      await expect(service.createUser({ data, createdById, createdByRoleName })).rejects.toThrow(RoleNotFoundException)
    })
  })

  // ============================================
  // UPDATE USER
  // ============================================

  describe('updateUser', () => {
    it('should update user successfully', async () => {
      // Arrange
      const id = 10
      const data = createUserData({ name: 'Updated Name' })
      const updatedById = 1
      const updatedByRoleName = RoleName.Admin
      const targetUser = createUser({ id, roleId: CLIENT_ROLE_ID })
      const updatedUser = { ...targetUser, ...data }

      mockSharedUserRepo.findUnique.mockResolvedValue(targetUser as any)
      mockSharedUserRepo.updateUser.mockResolvedValue(updatedUser as any)

      // Act
      const result = await service.updateUser({ id, data, updatedById, updatedByRoleName })

      // Assert
      expect(result).toEqual(updatedUser)
      expect(mockSharedUserRepo.updateUser).toHaveBeenCalledWith({ id }, { ...data, updatedById })
    })

    it('should prevent user from updating themselves', async () => {
      // Arrange
      const id = 10
      const data = createUserData({ name: 'Updated Name' })
      const updatedById = 10 // Same as target user
      const updatedByRoleName = RoleName.Client

      // Act & Assert
      await expect(service.updateUser({ id, data, updatedById, updatedByRoleName })).rejects.toThrow(
        CannotUpdateOrDeleteYourselfException,
      )
    })

    it('should allow admin to update admin user', async () => {
      // Arrange
      const id = 10
      const data = createUserData({ name: 'Updated Admin' })
      const updatedById = 1
      const updatedByRoleName = RoleName.Admin
      const targetUser = createUser({ id, roleId: ADMIN_ROLE_ID })

      mockSharedUserRepo.findUnique.mockResolvedValue(targetUser as any)
      mockSharedUserRepo.updateUser.mockResolvedValue(targetUser as any)

      // Act
      await service.updateUser({ id, data, updatedById, updatedByRoleName })

      // Assert
      expect(mockSharedUserRepo.updateUser).toHaveBeenCalled()
    })

    it('should prevent non-admin from updating admin user', async () => {
      // Arrange
      const id = 10
      const data = createUserData({ name: 'Updated Admin' })
      const updatedById = 2
      const updatedByRoleName = RoleName.Client
      const targetUser = createUser({ id, roleId: ADMIN_ROLE_ID })

      mockSharedUserRepo.findUnique.mockResolvedValue(targetUser as any)

      // Act & Assert
      await expect(service.updateUser({ id, data, updatedById, updatedByRoleName })).rejects.toThrow(ForbiddenException)
    })

    it('should throw NotFoundRecordException if user not found', async () => {
      // Arrange
      const id = 999
      const data = createUserData({ name: 'Updated' })
      const updatedById = 1
      const updatedByRoleName = RoleName.Admin

      mockSharedUserRepo.findUnique.mockResolvedValue(createUser() as any)

      // Create proper Prisma P2025 error
      const prismaError = new Error('Record not found')
      Object.assign(prismaError, {
        code: 'P2025',
        clientVersion: '5.0.0',
        meta: { cause: 'Record to update not found.' },
      })
      mockSharedUserRepo.updateUser.mockRejectedValue(prismaError)
      mockIsNotFoundPrismaError.mockReturnValue(true)

      // Act & Assert
      await expect(service.updateUser({ id, data, updatedById, updatedByRoleName })).rejects.toThrow(
        NotFoundRecordException,
      )
    })

    it('should allow non-admin to update non-admin user', async () => {
      // Arrange
      const id = 10
      const data = createUserData({ name: 'Updated Name' })
      const updatedById = 2 // Non-admin user (CLIENT)
      const updatedByRoleName = RoleName.Client
      const targetUser = createUser({ id, roleId: CLIENT_ROLE_ID }) // Target is also CLIENT
      const updatedUser = { ...targetUser, ...data }

      mockSharedUserRepo.findUnique.mockResolvedValue(targetUser as any)
      mockSharedUserRepo.updateUser.mockResolvedValue(updatedUser as any)

      // Act
      const result = await service.updateUser({ id, data, updatedById, updatedByRoleName })

      // Assert
      expect(result).toEqual(updatedUser)
      expect(mockSharedUserRepo.updateUser).toHaveBeenCalledWith({ id }, { ...data, updatedById })
    })

    it('should throw NotFoundRecordException when getRoleIdByUserId fails to find user', async () => {
      // Arrange
      const id = 999
      const data = createUserData({ name: 'Updated' })
      const updatedById = 1
      const updatedByRoleName = RoleName.Admin

      // Mock findUnique to return null (user not found)
      mockSharedUserRepo.findUnique.mockResolvedValue(null)

      // Act & Assert
      await expect(service.updateUser({ id, data, updatedById, updatedByRoleName })).rejects.toThrow(
        NotFoundRecordException,
      )
    })

    it('should throw UserAlreadyExistsException when update fails with unique constraint error', async () => {
      // Arrange
      const id = 10
      const data = createUserData({ email: 'existing@example.com' })
      const updatedById = 1
      const updatedByRoleName = RoleName.Admin
      const targetUser = createUser({ id, roleId: CLIENT_ROLE_ID })

      mockSharedUserRepo.findUnique.mockResolvedValue(targetUser as any)

      // Create proper Prisma P2002 error
      const prismaError = new Error('Unique constraint failed')
      Object.assign(prismaError, {
        code: 'P2002',
        clientVersion: '5.0.0',
        meta: { target: ['email'] },
      })
      mockSharedUserRepo.updateUser.mockRejectedValue(prismaError)
      mockIsUniqueConstraintPrismaError.mockReturnValue(true)

      // Act & Assert
      await expect(service.updateUser({ id, data, updatedById, updatedByRoleName })).rejects.toThrow(
        UserAlreadyExistsException,
      )
    })

    it('should throw RoleNotFoundException when update fails with foreign key constraint error', async () => {
      // Arrange
      const id = 10
      const data = createUserData({ roleId: 999 }) // Invalid roleId
      const updatedById = 1
      const updatedByRoleName = RoleName.Admin
      const targetUser = createUser({ id, roleId: CLIENT_ROLE_ID })

      mockSharedUserRepo.findUnique.mockResolvedValue(targetUser as any)

      // Create proper Prisma P2003 error
      const prismaError = new Error('Foreign key constraint failed')
      Object.assign(prismaError, {
        code: 'P2003',
        clientVersion: '5.0.0',
        meta: { field_name: 'roleId' },
      })
      mockSharedUserRepo.updateUser.mockRejectedValue(prismaError)
      mockIsForeignKeyConstraintPrismaError.mockReturnValue(true)

      // Act & Assert
      await expect(service.updateUser({ id, data, updatedById, updatedByRoleName })).rejects.toThrow(
        RoleNotFoundException,
      )
    })
  })

  // ============================================
  // DELETE USER
  // ============================================

  describe('deletedUser', () => {
    it('should delete user successfully (soft delete)', async () => {
      // Arrange
      const id = 10
      const deletedById = 1
      const deletedByRoleName = RoleName.Admin
      const targetUser = createUser({ id, roleId: CLIENT_ROLE_ID })

      mockSharedUserRepo.findUnique.mockResolvedValue(targetUser as any)
      mockUserRepo.deleteUser.mockResolvedValue({} as any)

      // Act
      const result = await service.deletedUser({ id, deletedById, deletedByRoleName })

      // Assert
      expect(result).toEqual({ message: 'User deleted successfully' })
      expect(mockUserRepo.deleteUser).toHaveBeenCalledWith({ id, deletedById })
    })

    it('should prevent user from deleting themselves', async () => {
      // Arrange
      const id = 10
      const deletedById = 10 // Same as target user
      const deletedByRoleName = RoleName.Client

      // Act & Assert
      await expect(service.deletedUser({ id, deletedById, deletedByRoleName })).rejects.toThrow(
        CannotUpdateOrDeleteYourselfException,
      )
    })

    it('should allow admin to delete admin user', async () => {
      // Arrange
      const id = 10
      const deletedById = 1
      const deletedByRoleName = RoleName.Admin
      const targetUser = createUser({ id, roleId: ADMIN_ROLE_ID })

      mockSharedUserRepo.findUnique.mockResolvedValue(targetUser as any)
      mockUserRepo.deleteUser.mockResolvedValue({} as any)

      // Act
      await service.deletedUser({ id, deletedById, deletedByRoleName })

      // Assert
      expect(mockUserRepo.deleteUser).toHaveBeenCalled()
    })

    it('should prevent non-admin from deleting admin user', async () => {
      // Arrange
      const id = 10
      const deletedById = 2
      const deletedByRoleName = RoleName.Client
      const targetUser = createUser({ id, roleId: ADMIN_ROLE_ID })

      mockSharedUserRepo.findUnique.mockResolvedValue(targetUser as any)

      // Act & Assert
      await expect(service.deletedUser({ id, deletedById, deletedByRoleName })).rejects.toThrow(ForbiddenException)
    })

    it('should throw NotFoundRecordException if user not found', async () => {
      // Arrange
      const id = 999
      const deletedById = 1
      const deletedByRoleName = RoleName.Admin

      mockSharedUserRepo.findUnique.mockResolvedValue(createUser() as any)

      // Create proper Prisma P2025 error
      const prismaError = new Error('Record not found')
      Object.assign(prismaError, {
        code: 'P2025',
        clientVersion: '5.0.0',
        meta: { cause: 'Record to delete not found.' },
      })
      mockUserRepo.deleteUser.mockRejectedValue(prismaError)
      mockIsNotFoundPrismaError.mockReturnValue(true)

      // Act & Assert
      await expect(service.deletedUser({ id, deletedById, deletedByRoleName })).rejects.toThrow(NotFoundRecordException)
    })
  })

  // ============================================
  // RBAC VERIFICATION TESTS
  // ============================================

  describe('RBAC Permission Checks', () => {
    it('should allow admin to perform any action', async () => {
      // Arrange
      const data = createUserData({ roleId: ADMIN_ROLE_ID })
      const adminId = 1
      const adminRoleName = RoleName.Admin

      mockHashingService.hash.mockResolvedValue('hashed')
      mockUserRepo.createUser.mockResolvedValue(createUser() as any)

      // Act
      await service.createUser({ data, createdById: adminId, createdByRoleName: adminRoleName })

      // Assert - No exception thrown
      expect(mockUserRepo.createUser).toHaveBeenCalled()
    })

    it('should prevent non-admin from admin-only actions', async () => {
      // Arrange
      const data = createUserData({ roleId: ADMIN_ROLE_ID })
      const userId = 2
      const userRoleName = RoleName.Client

      // Act & Assert
      await expect(service.createUser({ data, createdById: userId, createdByRoleName: userRoleName })).rejects.toThrow(
        ForbiddenException,
      )
    })

    it('should verify role permissions before update', async () => {
      // Arrange
      const id = 10
      const data = { name: 'Updated' } as any
      const updatedById = 2
      const updatedByRoleName = RoleName.Client
      const targetUser = createUser({ id, roleId: ADMIN_ROLE_ID })

      mockSharedUserRepo.findUnique.mockResolvedValue(targetUser as any)

      // Act & Assert
      await expect(service.updateUser({ id, data, updatedById, updatedByRoleName })).rejects.toThrow(ForbiddenException)

      // Verify role check was performed
      expect(mockSharedRoleRepo.getAdminRoleId).toHaveBeenCalled()
    })

    it('should verify role permissions before delete', async () => {
      // Arrange
      const id = 10
      const deletedById = 2
      const deletedByRoleName = RoleName.Client
      const targetUser = createUser({ id, roleId: ADMIN_ROLE_ID })

      mockSharedUserRepo.findUnique.mockResolvedValue(targetUser as any)

      // Act & Assert
      await expect(service.deletedUser({ id, deletedById, deletedByRoleName })).rejects.toThrow(ForbiddenException)
    })
  })
})
