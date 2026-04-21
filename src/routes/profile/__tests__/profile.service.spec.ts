import { Test, TestingModule } from '@nestjs/testing'
import { InvalidPasswordException, NotFoundRecordException } from '../../../shared/error'
import { isUniqueConstraintPrismaError } from '../../../shared/helpers'
import { SharedUserRepository } from '../../../shared/repositories/shared-user.repo'
import { HashingService } from '../../../shared/services/hashing.service'
import { ProfileService } from '../profile.service'

// Mock helper functions
jest.mock('src/shared/helpers', () => ({
  isUniqueConstraintPrismaError: jest.fn(),
}))

const mockIsUniqueConstraintPrismaError = isUniqueConstraintPrismaError as jest.MockedFunction<
  typeof isUniqueConstraintPrismaError
>

/**
 * PROFILE SERVICE UNIT TESTS
 *
 * Test Coverage:
 * - getProfile: Get user profile with role and permissions
 * - updateProfile: Update user profile information
 * - changePassword: Change user password with validation
 */

describe('ProfileService', () => {
  let service: ProfileService
  let mockSharedUserRepository: jest.Mocked<SharedUserRepository>
  let mockHashingService: jest.Mocked<HashingService>

  // Test data factories
  const createUser = (overrides = {}) => ({
    id: 1,
    email: 'test@example.com',
    name: 'Test User',
    phoneNumber: '0123456789',
    password: 'hashed_password',
    roleId: 2,
    status: 'ACTIVE' as const,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    deletedById: null,
    createdById: null,
    updatedById: null,
    avatar: null,
    ...overrides,
  })

  const createUserWithRolePermissions = (overrides = {}) => ({
    ...createUser(overrides),
    role: {
      id: 2,
      name: 'CLIENT',
      permissions: [
        { id: 1, path: '/products', method: 'GET', module: 'PRODUCT' },
        { id: 2, path: '/cart', method: 'POST', module: 'CART' },
      ],
    },
  })

  beforeEach(async () => {
    // Mock SharedUserRepository
    mockSharedUserRepository = {
      findUniqueIncludeRolePermissions: jest.fn(),
      findUnique: jest.fn(),
      updateUser: jest.fn(),
    } as any

    // Mock HashingService
    mockHashingService = {
      hash: jest.fn(),
      compare: jest.fn(),
    } as any

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProfileService,
        { provide: SharedUserRepository, useValue: mockSharedUserRepository },
        { provide: HashingService, useValue: mockHashingService },
      ],
    }).compile()

    service = module.get<ProfileService>(ProfileService)
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  // ============================================
  // GET PROFILE
  // ============================================

  describe('getProfile', () => {
    it('should return user profile with role and permissions', async () => {
      // Arrange
      const userId = 1
      const userWithRole = createUserWithRolePermissions()

      mockSharedUserRepository.findUniqueIncludeRolePermissions.mockResolvedValue(userWithRole as any)

      // Act
      const result = await service.getProfile(userId)

      // Assert
      expect(result).toEqual(userWithRole)
      expect(mockSharedUserRepository.findUniqueIncludeRolePermissions).toHaveBeenCalledWith({ id: userId })
    })

    it('should throw NotFoundRecordException when user not found', async () => {
      // Arrange
      const userId = 999

      mockSharedUserRepository.findUniqueIncludeRolePermissions.mockResolvedValue(null)

      // Act & Assert
      await expect(service.getProfile(userId)).rejects.toThrow(NotFoundRecordException)
    })
  })

  // ============================================
  // UPDATE PROFILE
  // ============================================

  describe('updateProfile', () => {
    it('should update user profile successfully', async () => {
      // Arrange
      const userId = 1
      const body = {
        name: 'Updated Name',
        phoneNumber: '0987654321',
        avatar: 'https://example.com/avatar.jpg',
      }
      const updatedUser = createUser({ ...body, updatedById: userId })

      mockSharedUserRepository.updateUser.mockResolvedValue(updatedUser as any)

      // Act
      const result = await service.updateProfile({ userId, body })

      // Assert
      expect(result).toEqual(updatedUser)
      expect(mockSharedUserRepository.updateUser).toHaveBeenCalledWith(
        { id: userId },
        {
          ...body,
          updatedById: userId,
        },
      )
    })

    it('should update only provided fields', async () => {
      // Arrange
      const userId = 1
      const body = {
        name: 'New Name Only',
        phoneNumber: '0123456789',
        avatar: null,
      }
      const updatedUser = createUser({ name: body.name, updatedById: userId })

      mockSharedUserRepository.updateUser.mockResolvedValue(updatedUser as any)

      // Act
      const result = await service.updateProfile({ userId, body })

      // Assert
      expect(result).toEqual(updatedUser)
      expect(mockSharedUserRepository.updateUser).toHaveBeenCalledWith(
        { id: userId },
        {
          ...body,
          updatedById: userId,
        },
      )
    })

    it('should throw NotFoundRecordException when unique constraint violated', async () => {
      // Arrange
      const userId = 1
      const body = {
        name: 'Test User',
        phoneNumber: '0123456789', // Duplicate phone number
        avatar: null,
      }
      const uniqueError = new Error('Unique constraint failed')
      ;(uniqueError as any).code = 'P2002'

      mockSharedUserRepository.updateUser.mockRejectedValue(uniqueError)
      mockIsUniqueConstraintPrismaError.mockReturnValue(true)

      // Act & Assert
      await expect(service.updateProfile({ userId, body })).rejects.toThrow(NotFoundRecordException)
    })

    it('should rethrow other errors', async () => {
      // Arrange
      const userId = 1
      const body = {
        name: 'Test',
        phoneNumber: '0123456789',
        avatar: null,
      }
      const otherError = new Error('Database connection failed')

      mockSharedUserRepository.updateUser.mockRejectedValue(otherError)

      // Act & Assert
      await expect(service.updateProfile({ userId, body })).rejects.toThrow('Database connection failed')
    })
  })

  // ============================================
  // CHANGE PASSWORD
  // ============================================

  describe('changePassword', () => {
    it('should change password successfully', async () => {
      // Arrange
      const userId = 1
      const body = {
        password: 'oldPassword123',
        newPassword: 'newPassword456',
      }
      const user = createUser({ password: 'hashed_old_password' })
      const hashedNewPassword = 'hashed_new_password'

      mockSharedUserRepository.findUnique.mockResolvedValue(user as any)
      mockHashingService.compare.mockResolvedValue(true)
      mockHashingService.hash.mockResolvedValue(hashedNewPassword)
      mockSharedUserRepository.updateUser.mockResolvedValue({} as any)

      // Act
      const result = await service.changePassword({ userId, body })

      // Assert
      expect(result).toEqual({ message: 'Password changed successfully' })
      expect(mockHashingService.compare).toHaveBeenCalledWith(body.password, user.password)
      expect(mockHashingService.hash).toHaveBeenCalledWith(body.newPassword)
      expect(mockSharedUserRepository.updateUser).toHaveBeenCalledWith(
        { id: userId },
        {
          password: hashedNewPassword,
          updatedById: userId,
        },
      )
    })

    it('should throw NotFoundRecordException when user not found', async () => {
      // Arrange
      const userId = 999
      const body = {
        password: 'oldPassword123',
        newPassword: 'newPassword456',
      }

      mockSharedUserRepository.findUnique.mockResolvedValue(null)

      // Act & Assert
      await expect(service.changePassword({ userId, body })).rejects.toThrow(NotFoundRecordException)
      expect(mockHashingService.compare).not.toHaveBeenCalled()
      expect(mockHashingService.hash).not.toHaveBeenCalled()
    })

    it('should throw InvalidPasswordException when old password is incorrect', async () => {
      // Arrange
      const userId = 1
      const body = {
        password: 'wrongPassword',
        newPassword: 'newPassword456',
      }
      const user = createUser({ password: 'hashed_old_password' })

      mockSharedUserRepository.findUnique.mockResolvedValue(user as any)
      mockHashingService.compare.mockResolvedValue(false)

      // Act & Assert
      await expect(service.changePassword({ userId, body })).rejects.toThrow(InvalidPasswordException)
      expect(mockHashingService.hash).not.toHaveBeenCalled()
      expect(mockSharedUserRepository.updateUser).not.toHaveBeenCalled()
    })

    it('should hash new password before saving', async () => {
      // Arrange
      const userId = 1
      const body = {
        password: 'oldPassword123',
        newPassword: 'newPassword456',
      }
      const user = createUser()
      const hashedNewPassword = 'hashed_new_password_123'

      mockSharedUserRepository.findUnique.mockResolvedValue(user as any)
      mockHashingService.compare.mockResolvedValue(true)
      mockHashingService.hash.mockResolvedValue(hashedNewPassword)
      mockSharedUserRepository.updateUser.mockResolvedValue({} as any)

      // Act
      await service.changePassword({ userId, body })

      // Assert
      expect(mockHashingService.hash).toHaveBeenCalledWith(body.newPassword)
      expect(mockSharedUserRepository.updateUser).toHaveBeenCalledWith(
        { id: userId },
        expect.objectContaining({
          password: hashedNewPassword,
        }),
      )
    })

    it('should throw NotFoundRecordException when unique constraint violated during password change', async () => {
      // Arrange
      const userId = 1
      const body = {
        password: 'oldPassword123',
        newPassword: 'newPassword456',
      }
      const user = createUser()
      const uniqueError = new Error('Unique constraint failed')
      ;(uniqueError as any).code = 'P2002'

      mockSharedUserRepository.findUnique.mockResolvedValue(user as any)
      mockHashingService.compare.mockResolvedValue(true)
      mockHashingService.hash.mockResolvedValue('hashed_new_password')
      mockSharedUserRepository.updateUser.mockRejectedValue(uniqueError)
      mockIsUniqueConstraintPrismaError.mockReturnValue(true)

      // Act & Assert
      await expect(service.changePassword({ userId, body })).rejects.toThrow(NotFoundRecordException)
    })
  })
})
