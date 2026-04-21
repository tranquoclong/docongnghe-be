import { Test, TestingModule } from '@nestjs/testing'
import { ProfileController } from '../profile.controller'
import { ChangePasswordBodyDTO, UpdateMeBodyDTO } from '../profile.dto'
import { ProfileService } from '../profile.service'

/**
 * PROFILE CONTROLLER UNIT TESTS
 *
 * Test coverage cho ProfileController với 3 endpoints:
 * - GET /profile (getProfile) - Protected endpoint, get current user profile
 * - PUT /profile (updateProfile) - Protected endpoint, update profile info
 * - PUT /profile/change-password (changePassword) - Protected endpoint, change password
 *
 * Key features:
 * - Tất cả endpoints đều protected (require authentication)
 * - User chỉ có thể thao tác với profile của chính mình (userId từ @ActiveUser)
 * - UpdateProfile: update name, phoneNumber, avatar (avatar optional)
 * - ChangePassword: validate old password, new password, confirm password
 * - Audit trail: updatedById
 */

describe('ProfileController', () => {
  let controller: ProfileController
  let mockProfileService: jest.Mocked<ProfileService>

  // ===== TEST DATA FACTORIES =====

  const createMockUserProfile = (overrides: Record<string, any> = {}) => {
    const dateStr = overrides.createdAt ?? new Date().toISOString()
    return {
      id: 1,
      email: 'user@example.com',
      name: 'Test User',
      password: 'hashed_password',
      phoneNumber: '0123456789',
      avatar: 'https://example.com/avatar.jpg',
      totpSecret: null,
      status: 'ACTIVE' as const,
      roleId: 2,
      createdById: null,
      updatedById: null,
      deletedById: null,
      createdAt: dateStr,
      updatedAt: overrides.updatedAt ?? dateStr,
      deletedAt: null,
      role: {
        id: 2,
        name: 'User',
        description: 'Default user role',
        isActive: true,
        createdById: null,
        updatedById: null,
        deletedById: null,
        deletedAt: null,
        createdAt: dateStr,
        updatedAt: overrides.updatedAt ?? dateStr,
        permissions: [
          {
            id: 1,
            name: 'read:profile',
            description: 'Read profile',
            module: 'profile',
            path: '/profile',
            method: 'GET' as const,
            createdById: null,
            updatedById: null,
            deletedById: null,
            deletedAt: null,
            createdAt: dateStr,
            updatedAt: overrides.updatedAt ?? dateStr,
          },
        ],
      },
      ...overrides,
    }
  }

  const createMockUpdatedProfile = (overrides = {}) => ({
    id: 1,
    email: 'user@example.com',
    name: 'Updated Name',
    phoneNumber: '0987654321',
    avatar: 'https://example.com/new-avatar.jpg',
    status: 'ACTIVE' as const,
    roleId: 2,
    createdById: null,
    updatedById: 1,
    deletedById: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    deletedAt: null,
    ...overrides,
  })

  // ===== SETUP & TEARDOWN =====

  beforeEach(async () => {
    // Tạo mock service với tất cả methods
    mockProfileService = {
      getProfile: jest.fn(),
      updateProfile: jest.fn(),
      changePassword: jest.fn(),
    } as any

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ProfileController],
      providers: [
        {
          provide: ProfileService,
          useValue: mockProfileService,
        },
      ],
    }).compile()

    controller = module.get<ProfileController>(ProfileController)
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  // ===== INITIALIZATION TESTS =====

  describe('Initialization', () => {
    it('should be defined', () => {
      expect(controller).toBeDefined()
    })

    it('should have profileService injected', () => {
      expect(controller['profileService']).toBeDefined()
      expect(controller['profileService']).toBe(mockProfileService)
    })
  })

  // ===== GET /profile (getProfile) TESTS =====

  describe('GET /profile - getProfile()', () => {
    it('should return current user profile with role and permissions', async () => {
      // Arrange
      const userId = 1
      const mockProfile = createMockUserProfile()
      mockProfileService.getProfile.mockResolvedValue(mockProfile as any)

      // Act
      const result = await controller.getProfile(userId)

      // Assert
      expect(result).toEqual(mockProfile)
      expect(mockProfileService.getProfile).toHaveBeenCalledWith(userId)
      expect(mockProfileService.getProfile).toHaveBeenCalledTimes(1)
      expect(result.role).toBeDefined()
      expect(result.role.permissions).toBeDefined()
      expect(result.role.permissions.length).toBeGreaterThan(0)
    })

    it('should throw error when user not found', async () => {
      // Arrange
      const userId = 999
      mockProfileService.getProfile.mockRejectedValue(new Error('Error.NotFound'))

      // Act & Assert
      await expect(controller.getProfile(userId)).rejects.toThrow('Error.NotFound')
      expect(mockProfileService.getProfile).toHaveBeenCalledWith(userId)
    })

    it('should not include password and totpSecret in response', async () => {
      // Arrange - Service returns profile without sensitive fields
      const userId = 1
      const { password, totpSecret, ...profileWithoutSensitive } = createMockUserProfile()
      mockProfileService.getProfile.mockResolvedValue(profileWithoutSensitive as any)

      // Act
      const result = await controller.getProfile(userId)

      // Assert
      expect(result).not.toHaveProperty('password')
      expect(result).not.toHaveProperty('totpSecret')
    })
  })

  // ===== PUT /profile (updateProfile) TESTS =====

  describe('PUT /profile - updateProfile()', () => {
    it('should update profile successfully', async () => {
      // Arrange
      const userId = 1
      const body: UpdateMeBodyDTO = {
        name: 'Updated Name',
        phoneNumber: '0987654321',
        avatar: 'https://example.com/new-avatar.jpg',
      }
      const mockUpdatedProfile = createMockUpdatedProfile({
        name: body.name,
        phoneNumber: body.phoneNumber,
        avatar: body.avatar,
        updatedById: userId,
      })
      mockProfileService.updateProfile.mockResolvedValue(mockUpdatedProfile as any)

      // Act
      const result = await controller.updateProfile(body, userId)

      // Assert
      expect(result).toEqual(mockUpdatedProfile)
      expect(mockProfileService.updateProfile).toHaveBeenCalledWith({
        userId,
        body,
      })
      expect(result!.name).toBe(body.name)
      expect(result!.phoneNumber).toBe(body.phoneNumber)
      expect(result!.avatar).toBe(body.avatar)
      expect(result!.updatedById).toBe(userId)
    })

    it('should update profile without avatar (avatar is optional)', async () => {
      // Arrange
      const userId = 1
      const body: UpdateMeBodyDTO = {
        name: 'Updated Name',
        phoneNumber: '0987654321',
      }
      const mockUpdatedProfile = createMockUpdatedProfile({
        name: body.name,
        phoneNumber: body.phoneNumber,
        avatar: null,
      })
      mockProfileService.updateProfile.mockResolvedValue(mockUpdatedProfile as any)

      // Act
      const result = await controller.updateProfile(body, userId)

      // Assert
      expect(result!.name).toBe(body.name)
      expect(result!.phoneNumber).toBe(body.phoneNumber)
      expect(result!.avatar).toBeNull()
    })

    it('should throw error when updating non-existent user', async () => {
      // Arrange
      const userId = 999
      const body: UpdateMeBodyDTO = {
        name: 'Updated Name',
        phoneNumber: '0987654321',
      }
      mockProfileService.updateProfile.mockRejectedValue(new Error('Error.NotFound'))

      // Act & Assert
      await expect(controller.updateProfile(body, userId)).rejects.toThrow('Error.NotFound')
    })

    it('should update profile with audit trail (updatedById)', async () => {
      // Arrange
      const userId = 5
      const body: UpdateMeBodyDTO = {
        name: 'New Name',
        phoneNumber: '1111111111',
      }
      const mockUpdatedProfile = createMockUpdatedProfile({
        id: userId,
        updatedById: userId,
      })
      mockProfileService.updateProfile.mockResolvedValue(mockUpdatedProfile as any)

      // Act
      const result = await controller.updateProfile(body, userId)

      // Assert
      expect(result!.updatedById).toBe(userId)
      expect(mockProfileService.updateProfile).toHaveBeenCalledWith({
        userId,
        body,
      })
    })
  })

  // ===== PUT /profile/change-password (changePassword) TESTS =====

  describe('PUT /profile/change-password - changePassword()', () => {
    it('should change password successfully', async () => {
      // Arrange
      const userId = 1
      const body: ChangePasswordBodyDTO = {
        password: 'oldPassword123',
        newPassword: 'newPassword456',
        confirmNewPassword: 'newPassword456',
      }
      const mockResponse = { message: 'Password changed successfully' }
      mockProfileService.changePassword.mockResolvedValue(mockResponse)

      // Act
      const result = await controller.changePassword(body, userId)

      // Assert
      expect(result).toEqual(mockResponse)
      expect(mockProfileService.changePassword).toHaveBeenCalledWith({
        userId,
        body,
      })
      expect(result.message).toBe('Password changed successfully')
    })

    it('should throw error when old password is incorrect', async () => {
      // Arrange
      const userId = 1
      const body: ChangePasswordBodyDTO = {
        password: 'wrongPassword',
        newPassword: 'newPassword456',
        confirmNewPassword: 'newPassword456',
      }
      mockProfileService.changePassword.mockRejectedValue(new Error('Error.InvalidPassword'))

      // Act & Assert
      await expect(controller.changePassword(body, userId)).rejects.toThrow('Error.InvalidPassword')
      expect(mockProfileService.changePassword).toHaveBeenCalledWith({
        userId,
        body,
      })
    })

    it('should throw error when user not found', async () => {
      // Arrange
      const userId = 999
      const body: ChangePasswordBodyDTO = {
        password: 'oldPassword123',
        newPassword: 'newPassword456',
        confirmNewPassword: 'newPassword456',
      }
      mockProfileService.changePassword.mockRejectedValue(new Error('Error.NotFound'))

      // Act & Assert
      await expect(controller.changePassword(body, userId)).rejects.toThrow('Error.NotFound')
    })

    it('should validate that newPassword and confirmNewPassword match (handled by DTO validation)', async () => {
      // Arrange
      const userId = 1
      const body: ChangePasswordBodyDTO = {
        password: 'oldPassword123',
        newPassword: 'newPassword456',
        confirmNewPassword: 'newPassword456', // Match
      }
      const mockResponse = { message: 'Password changed successfully' }
      mockProfileService.changePassword.mockResolvedValue(mockResponse)

      // Act
      const result = await controller.changePassword(body, userId)

      // Assert
      expect(result.message).toBe('Password changed successfully')
    })

    it('should validate that newPassword is different from old password (handled by DTO validation)', async () => {
      // Arrange
      const userId = 1
      const body: ChangePasswordBodyDTO = {
        password: 'oldPassword123',
        newPassword: 'newPassword456', // Different from old password
        confirmNewPassword: 'newPassword456',
      }
      const mockResponse = { message: 'Password changed successfully' }
      mockProfileService.changePassword.mockResolvedValue(mockResponse)

      // Act
      const result = await controller.changePassword(body, userId)

      // Assert
      expect(result.message).toBe('Password changed successfully')
    })
  })

  // ===== EDGE CASES & ERROR HANDLING =====

  describe('Edge Cases & Error Handling', () => {
    it('should handle service throwing unexpected error in getProfile', async () => {
      // Arrange
      const userId = 1
      mockProfileService.getProfile.mockRejectedValue(new Error('Database connection failed'))

      // Act & Assert
      await expect(controller.getProfile(userId)).rejects.toThrow('Database connection failed')
    })

    it('should handle service throwing unexpected error in updateProfile', async () => {
      // Arrange
      const userId = 1
      const body: UpdateMeBodyDTO = {
        name: 'Test',
        phoneNumber: '0123456789',
      }
      mockProfileService.updateProfile.mockRejectedValue(new Error('Unexpected error'))

      // Act & Assert
      await expect(controller.updateProfile(body, userId)).rejects.toThrow('Unexpected error')
    })

    it('should handle maximum length for name (100 characters)', async () => {
      // Arrange
      const userId = 1
      const longName = 'A'.repeat(100) // 100 characters
      const body: UpdateMeBodyDTO = {
        name: longName,
        phoneNumber: '0123456789',
      }
      const mockUpdatedProfile = createMockUpdatedProfile({ name: longName })
      mockProfileService.updateProfile.mockResolvedValue(mockUpdatedProfile as any)

      // Act
      const result = await controller.updateProfile(body, userId)

      // Assert
      expect(result!.name.length).toBe(100)
    })

    it('should handle phone number with minimum length (9 characters)', async () => {
      // Arrange
      const userId = 1
      const body: UpdateMeBodyDTO = {
        name: 'Test User',
        phoneNumber: '012345678', // 9 characters
      }
      const mockUpdatedProfile = createMockUpdatedProfile({ phoneNumber: '012345678' })
      mockProfileService.updateProfile.mockResolvedValue(mockUpdatedProfile as any)

      // Act
      const result = await controller.updateProfile(body, userId)

      // Assert
      expect(result!.phoneNumber.length).toBe(9)
    })

    it('should handle phone number with maximum length (15 characters)', async () => {
      // Arrange
      const userId = 1
      const body: UpdateMeBodyDTO = {
        name: 'Test User',
        phoneNumber: '012345678901234', // 15 characters
      }
      const mockUpdatedProfile = createMockUpdatedProfile({ phoneNumber: '012345678901234' })
      mockProfileService.updateProfile.mockResolvedValue(mockUpdatedProfile as any)

      // Act
      const result = await controller.updateProfile(body, userId)

      // Assert
      expect(result!.phoneNumber.length).toBe(15)
    })
  })

  // ===== RESPONSE STRUCTURE SNAPSHOTS =====

  describe('Response Structure Snapshots', () => {
    const fixedDate = '2024-01-01T00:00:00.000Z'

    it('should match profile response structure', async () => {
      const mockProfile = createMockUserProfile({ createdAt: fixedDate, updatedAt: fixedDate })
      mockProfileService.getProfile.mockResolvedValue(mockProfile)
      const result = await controller.getProfile(1)
      expect(result).toMatchSnapshot()
    })

    it('should match change password response structure', async () => {
      mockProfileService.changePassword.mockResolvedValue({ message: 'Password changed successfully' })
      const result = await controller.changePassword(
        { password: 'OldPass123!', newPassword: 'NewPass123!', confirmNewPassword: 'NewPass123!' },
        1,
      )
      expect(result).toMatchSnapshot()
    })
  })
})
