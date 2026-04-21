import { ForbiddenException } from '@nestjs/common'
import { Test, TestingModule } from '@nestjs/testing'
import { UserStatus } from 'src/shared/constants/auth.constant'
import { RoleName } from 'src/shared/constants/role.constant'
import { NotFoundRecordException } from 'src/shared/error'
import { UserController } from '../user.controller'
import { CreateUserBodyDTO, GetUserParamsDTO, GetUsersQueryDTO, UpdateUserBodyDTO } from '../user.dto'
import { CannotUpdateOrDeleteYourselfException, RoleNotFoundException, UserAlreadyExistsException } from '../user.error'
import { UserService } from '../user.service'

// Test data factory để tạo dữ liệu test
const createTestData = {
  getUsersQuery: (overrides = {}): GetUsersQueryDTO => ({
    page: 1,
    limit: 10,
    ...overrides,
  }),

  getUserParams: (overrides = {}): GetUserParamsDTO => ({
    userId: 1,
    ...overrides,
  }),

  createUserBody: (overrides = {}): CreateUserBodyDTO => ({
    email: 'test@example.com',
    name: 'Test User',
    phoneNumber: '0987654321',
    avatar: 'https://example.com/avatar.jpg',
    status: UserStatus.ACTIVE,
    password: 'password123',
    roleId: 2,
    ...overrides,
  }),

  updateUserBody: (overrides = {}): UpdateUserBodyDTO => ({
    email: 'updated@example.com',
    name: 'Updated User',
    phoneNumber: '0123456789',
    avatar: 'https://example.com/new-avatar.jpg',
    status: UserStatus.ACTIVE,
    password: 'newpassword123',
    roleId: 2,
    ...overrides,
  }),

  userResponse: (overrides = {}) =>
    ({
      id: 1,
      email: 'test@example.com',
      name: 'Test User',
      phoneNumber: '0987654321',
      avatar: 'https://example.com/avatar.jpg',
      status: UserStatus.ACTIVE,
      roleId: 2,
      createdById: 1,
      updatedById: null,
      deletedById: null,
      createdAt: new Date('2024-01-01').toISOString(),
      updatedAt: new Date('2024-01-01').toISOString(),
      deletedAt: null,
      ...overrides,
    }) as any,

  userWithRoleResponse: (overrides = {}) =>
    ({
      id: 1,
      email: 'test@example.com',
      name: 'Test User',
      phoneNumber: '0987654321',
      avatar: 'https://example.com/avatar.jpg',
      status: UserStatus.ACTIVE,
      roleId: 2,
      createdById: 1,
      updatedById: null,
      deletedById: null,
      createdAt: new Date('2024-01-01').toISOString(),
      updatedAt: new Date('2024-01-01').toISOString(),
      deletedAt: null,
      role: {
        id: 2,
        name: RoleName.Client,
        permissions: [],
      },
      ...overrides,
    }) as any,

  usersListResponse: (overrides = {}) => ({
    data: [
      {
        id: 1,
        email: 'user1@example.com',
        name: 'User 1',
        phoneNumber: '0987654321',
        avatar: null,
        status: UserStatus.ACTIVE,
        roleId: 2,
        createdById: 1,
        updatedById: null,
        deletedById: null,
        createdAt: new Date('2024-01-01').toISOString(),
        updatedAt: new Date('2024-01-01').toISOString(),
        deletedAt: null,
        role: {
          id: 2,
          name: RoleName.Client,
        },
      },
    ],
    totalItems: 1,
    page: 1,
    limit: 10,
    totalPages: 1,
    ...overrides,
  }),

  messageResponse: (message = 'User deleted successfully') => ({
    message,
  }),
}

describe('UserController', () => {
  let controller: UserController
  let module: TestingModule
  let mockUserService: jest.Mocked<UserService>

  beforeEach(async () => {
    // Tạo mock cho UserService với tất cả methods cần thiết
    mockUserService = {
      getListUser: jest.fn(),
      findById: jest.fn(),
      createUser: jest.fn(),
      updateUser: jest.fn(),
      deletedUser: jest.fn(),
    } as any

    module = await Test.createTestingModule({
      controllers: [UserController],
      providers: [{ provide: UserService, useValue: mockUserService }],
    }).compile()

    controller = module.get<UserController>(UserController)
  })

  afterEach(() => {
    jest.clearAllMocks()
    jest.resetAllMocks()
  })

  afterAll(async () => {
    jest.restoreAllMocks()
    if (module) {
      await module.close()
    }
  })

  describe('getListUser', () => {
    it('should get users list successfully with default pagination', async () => {
      // Arrange - Chuẩn bị dữ liệu lấy danh sách users
      const query = createTestData.getUsersQuery()
      const mockListResponse = createTestData.usersListResponse()

      mockUserService.getListUser.mockResolvedValue(mockListResponse)

      // Act - Thực hiện lấy danh sách users
      const result = await controller.getListUser(query)

      // Assert - Kiểm tra kết quả
      expect(result).toEqual(mockListResponse)
      expect(mockUserService.getListUser).toHaveBeenCalledWith({
        page: 1,
        limit: 10,
      })
      expect(mockUserService.getListUser).toHaveBeenCalledTimes(1)
    })

    it('should get users list with custom pagination', async () => {
      // Arrange - Chuẩn bị dữ liệu với pagination tùy chỉnh
      const query = createTestData.getUsersQuery({ page: 2, limit: 20 })
      const mockListResponse = createTestData.usersListResponse({
        page: 2,
        limit: 20,
        totalItems: 50,
        totalPages: 3,
      })

      mockUserService.getListUser.mockResolvedValue(mockListResponse)

      // Act - Thực hiện lấy danh sách users
      const result = await controller.getListUser(query)

      // Assert - Kiểm tra kết quả
      expect(result).toEqual(mockListResponse)
      expect(mockUserService.getListUser).toHaveBeenCalledWith({
        page: 2,
        limit: 20,
      })
    })

    it('should return empty list when no users found', async () => {
      // Arrange - Chuẩn bị dữ liệu khi không có users
      const query = createTestData.getUsersQuery()
      const mockEmptyResponse = createTestData.usersListResponse({
        data: [],
        totalItems: 0,
        totalPages: 0,
      })

      mockUserService.getListUser.mockResolvedValue(mockEmptyResponse)

      // Act - Thực hiện lấy danh sách users
      const result = await controller.getListUser(query)

      // Assert - Kiểm tra kết quả
      expect(result.data).toEqual([])
      expect(result.totalItems).toBe(0)
    })
  })

  describe('findById', () => {
    it('should find user by id successfully', async () => {
      // Arrange - Chuẩn bị dữ liệu tìm user theo id
      const params = createTestData.getUserParams({ userId: 1 })
      const mockUserResponse = createTestData.userWithRoleResponse()

      mockUserService.findById.mockResolvedValue(mockUserResponse)

      // Act - Thực hiện tìm user
      const result = await controller.findById(params)

      // Assert - Kiểm tra kết quả
      expect(result).toEqual(mockUserResponse)
      expect(mockUserService.findById).toHaveBeenCalledWith(1)
      expect(mockUserService.findById).toHaveBeenCalledTimes(1)
    })

    it('should throw NotFoundRecordException when user not found', async () => {
      // Arrange - Chuẩn bị dữ liệu khi user không tồn tại
      const params = createTestData.getUserParams({ userId: 999 })

      mockUserService.findById.mockRejectedValue(NotFoundRecordException)

      // Act & Assert - Thực hiện và kiểm tra exception
      await expect(controller.findById(params)).rejects.toThrow(NotFoundRecordException)
      expect(mockUserService.findById).toHaveBeenCalledWith(999)
    })

    it('should return user with role and permissions', async () => {
      // Arrange - Chuẩn bị dữ liệu user với role và permissions
      const params = createTestData.getUserParams({ userId: 1 })
      const mockUserResponse = createTestData.userWithRoleResponse({
        role: {
          id: 2,
          name: RoleName.Client,
          permissions: [
            {
              id: 1,
              name: 'read:products',
              module: 'product',
              path: '/products',
              method: 'GET',
            },
          ],
        },
      })

      mockUserService.findById.mockResolvedValue(mockUserResponse)

      // Act - Thực hiện tìm user
      const result = await controller.findById(params)

      // Assert - Kiểm tra kết quả
      expect(result.role).toBeDefined()
      expect(result.role.permissions).toHaveLength(1)
      expect(result.role.permissions[0].name).toBe('read:products')
    })
  })

  describe('createUser', () => {
    it('should create user successfully by admin', async () => {
      // Arrange - Chuẩn bị dữ liệu tạo user bởi admin
      const body = createTestData.createUserBody()
      const userId = 1
      const roleName = RoleName.Admin
      const mockUserResponse = createTestData.userResponse()

      mockUserService.createUser.mockResolvedValue(mockUserResponse)

      // Act - Thực hiện tạo user
      const result = await controller.createUser(body, userId, roleName)

      // Assert - Kiểm tra kết quả
      expect(result).toEqual(mockUserResponse)
      expect(mockUserService.createUser).toHaveBeenCalledWith({
        data: body,
        createdById: userId,
        createdByRoleName: roleName,
      })
      expect(mockUserService.createUser).toHaveBeenCalledTimes(1)
    })

    it('should create user with client role by admin', async () => {
      // Arrange - Chuẩn bị dữ liệu tạo client user bởi admin
      const body = createTestData.createUserBody({ roleId: 2 })
      const userId = 1
      const roleName = RoleName.Admin
      const mockUserResponse = createTestData.userResponse({ roleId: 2 })

      mockUserService.createUser.mockResolvedValue(mockUserResponse)

      // Act - Thực hiện tạo user
      const result = await controller.createUser(body, userId, roleName)

      // Assert - Kiểm tra kết quả
      expect(result.roleId).toBe(2)
      expect(mockUserService.createUser).toHaveBeenCalledWith({
        data: body,
        createdById: userId,
        createdByRoleName: roleName,
      })
    })

    it('should create user with seller role by admin', async () => {
      // Arrange - Chuẩn bị dữ liệu tạo seller user bởi admin
      const body = createTestData.createUserBody({ roleId: 3 })
      const userId = 1
      const roleName = RoleName.Admin
      const mockUserResponse = createTestData.userResponse({ roleId: 3 })

      mockUserService.createUser.mockResolvedValue(mockUserResponse)

      // Act - Thực hiện tạo user
      const result = await controller.createUser(body, userId, roleName)

      // Assert - Kiểm tra kết quả
      expect(result.roleId).toBe(3)
    })

    it('should throw ForbiddenException when non-admin tries to create admin user', async () => {
      // Arrange - Chuẩn bị dữ liệu khi non-admin cố tạo admin user
      const body = createTestData.createUserBody({ roleId: 1 }) // Admin role
      const userId = 2
      const roleName = RoleName.Client

      mockUserService.createUser.mockRejectedValue(new ForbiddenException())

      // Act & Assert - Thực hiện và kiểm tra exception
      await expect(controller.createUser(body, userId, roleName)).rejects.toThrow(ForbiddenException)
      expect(mockUserService.createUser).toHaveBeenCalledWith({
        data: body,
        createdById: userId,
        createdByRoleName: roleName,
      })
    })

    it('should throw UserAlreadyExistsException when email already exists', async () => {
      // Arrange - Chuẩn bị dữ liệu khi email đã tồn tại
      const body = createTestData.createUserBody({ email: 'existing@example.com' })
      const userId = 1
      const roleName = RoleName.Admin

      mockUserService.createUser.mockRejectedValue(UserAlreadyExistsException)

      // Act & Assert - Thực hiện và kiểm tra exception
      await expect(controller.createUser(body, userId, roleName)).rejects.toThrow(UserAlreadyExistsException)
    })

    it('should throw RoleNotFoundException when roleId does not exist', async () => {
      // Arrange - Chuẩn bị dữ liệu khi roleId không tồn tại
      const body = createTestData.createUserBody({ roleId: 999 })
      const userId = 1
      const roleName = RoleName.Admin

      mockUserService.createUser.mockRejectedValue(RoleNotFoundException)

      // Act & Assert - Thực hiện và kiểm tra exception
      await expect(controller.createUser(body, userId, roleName)).rejects.toThrow(RoleNotFoundException)
    })

    it('should create user with all required fields', async () => {
      // Arrange - Chuẩn bị dữ liệu với tất cả các trường bắt buộc
      const body = createTestData.createUserBody({
        email: 'newuser@example.com',
        name: 'New User',
        phoneNumber: '0912345678',
        password: 'securepassword123',
        roleId: 2,
        status: UserStatus.ACTIVE,
      })
      const userId = 1
      const roleName = RoleName.Admin
      const mockUserResponse = createTestData.userResponse({
        email: 'newuser@example.com',
        name: 'New User',
      })

      mockUserService.createUser.mockResolvedValue(mockUserResponse)

      // Act - Thực hiện tạo user
      const result = await controller.createUser(body, userId, roleName)

      // Assert - Kiểm tra kết quả
      expect(result.email).toBe('newuser@example.com')
      expect(result.name).toBe('New User')
    })

    it('should create user with inactive status', async () => {
      // Arrange - Chuẩn bị dữ liệu tạo user với status inactive
      const body = createTestData.createUserBody({ status: UserStatus.INACTIVE })
      const userId = 1
      const roleName = RoleName.Admin
      const mockUserResponse = createTestData.userResponse({ status: UserStatus.INACTIVE })

      mockUserService.createUser.mockResolvedValue(mockUserResponse)

      // Act - Thực hiện tạo user
      const result = await controller.createUser(body, userId, roleName)

      // Assert - Kiểm tra kết quả
      expect(result.status).toBe(UserStatus.INACTIVE)
    })
  })

  describe('updateUser', () => {
    it('should update user successfully by admin', async () => {
      // Arrange - Chuẩn bị dữ liệu cập nhật user bởi admin
      const body = createTestData.updateUserBody()
      const params = createTestData.getUserParams({ userId: 2 })
      const userId = 1
      const roleName = RoleName.Admin
      const mockUserResponse = createTestData.userResponse({
        id: 2,
        email: 'updated@example.com',
        name: 'Updated User',
      })

      mockUserService.updateUser.mockResolvedValue(mockUserResponse)

      // Act - Thực hiện cập nhật user
      const result = await controller.updateUser(body, params, userId, roleName)

      // Assert - Kiểm tra kết quả
      expect(result).toEqual(mockUserResponse)
      expect(mockUserService.updateUser).toHaveBeenCalledWith({
        data: body,
        id: 2,
        updatedById: userId,
        updatedByRoleName: roleName,
      })
      expect(mockUserService.updateUser).toHaveBeenCalledTimes(1)
    })

    it('should throw CannotUpdateOrDeleteYourselfException when trying to update yourself', async () => {
      // Arrange - Chuẩn bị dữ liệu khi cố cập nhật chính mình
      const body = createTestData.updateUserBody()
      const params = createTestData.getUserParams({ userId: 1 })
      const userId = 1 // Same as params.userId
      const roleName = RoleName.Admin

      mockUserService.updateUser.mockRejectedValue(CannotUpdateOrDeleteYourselfException)

      // Act & Assert - Thực hiện và kiểm tra exception
      await expect(controller.updateUser(body, params, userId, roleName)).rejects.toThrow(
        CannotUpdateOrDeleteYourselfException,
      )
    })

    it('should throw ForbiddenException when non-admin tries to update admin user', async () => {
      // Arrange - Chuẩn bị dữ liệu khi non-admin cố cập nhật admin user
      const body = createTestData.updateUserBody()
      const params = createTestData.getUserParams({ userId: 1 }) // Admin user
      const userId = 2
      const roleName = RoleName.Client

      mockUserService.updateUser.mockRejectedValue(new ForbiddenException())

      // Act & Assert - Thực hiện và kiểm tra exception
      await expect(controller.updateUser(body, params, userId, roleName)).rejects.toThrow(ForbiddenException)
    })

    it('should throw NotFoundRecordException when user not found', async () => {
      // Arrange - Chuẩn bị dữ liệu khi user không tồn tại
      const body = createTestData.updateUserBody()
      const params = createTestData.getUserParams({ userId: 999 })
      const userId = 1
      const roleName = RoleName.Admin

      mockUserService.updateUser.mockRejectedValue(NotFoundRecordException)

      // Act & Assert - Thực hiện và kiểm tra exception
      await expect(controller.updateUser(body, params, userId, roleName)).rejects.toThrow(NotFoundRecordException)
    })

    it('should throw UserAlreadyExistsException when email already exists', async () => {
      // Arrange - Chuẩn bị dữ liệu khi email đã tồn tại
      const body = createTestData.updateUserBody({ email: 'existing@example.com' })
      const params = createTestData.getUserParams({ userId: 2 })
      const userId = 1
      const roleName = RoleName.Admin

      mockUserService.updateUser.mockRejectedValue(UserAlreadyExistsException)

      // Act & Assert - Thực hiện và kiểm tra exception
      await expect(controller.updateUser(body, params, userId, roleName)).rejects.toThrow(UserAlreadyExistsException)
    })

    it('should update user status to blocked', async () => {
      // Arrange - Chuẩn bị dữ liệu cập nhật status thành blocked
      const body = createTestData.updateUserBody({ status: UserStatus.BLOCKED })
      const params = createTestData.getUserParams({ userId: 2 })
      const userId = 1
      const roleName = RoleName.Admin
      const mockUserResponse = createTestData.userResponse({
        id: 2,
        status: UserStatus.BLOCKED,
      })

      mockUserService.updateUser.mockResolvedValue(mockUserResponse)

      // Act - Thực hiện cập nhật user
      const result = await controller.updateUser(body, params, userId, roleName)

      // Assert - Kiểm tra kết quả
      expect(result).toBeDefined()
      expect(result!.status).toBe(UserStatus.BLOCKED)
    })

    it('should update user with new avatar', async () => {
      // Arrange - Chuẩn bị dữ liệu cập nhật avatar
      const body = createTestData.updateUserBody({ avatar: 'https://example.com/new-avatar.jpg' })
      const params = createTestData.getUserParams({ userId: 2 })
      const userId = 1
      const roleName = RoleName.Admin
      const mockUserResponse = createTestData.userResponse({
        id: 2,
        avatar: 'https://example.com/new-avatar.jpg',
      })

      mockUserService.updateUser.mockResolvedValue(mockUserResponse)

      // Act - Thực hiện cập nhật user
      const result = await controller.updateUser(body, params, userId, roleName)

      // Assert - Kiểm tra kết quả
      expect(result).toBeDefined()
      expect(result!.avatar).toBe('https://example.com/new-avatar.jpg')
    })

    it('should update user phone number', async () => {
      // Arrange - Chuẩn bị dữ liệu cập nhật số điện thoại
      const body = createTestData.updateUserBody({ phoneNumber: '0999888777' })
      const params = createTestData.getUserParams({ userId: 2 })
      const userId = 1
      const roleName = RoleName.Admin
      const mockUserResponse = createTestData.userResponse({
        id: 2,
        phoneNumber: '0999888777',
      })

      mockUserService.updateUser.mockResolvedValue(mockUserResponse)

      // Act - Thực hiện cập nhật user
      const result = await controller.updateUser(body, params, userId, roleName)

      // Assert - Kiểm tra kết quả
      expect(result).toBeDefined()
      expect(result!.phoneNumber).toBe('0999888777')
    })
  })

  describe('deleteUser', () => {
    it('should delete user successfully by admin', async () => {
      // Arrange - Chuẩn bị dữ liệu xóa user bởi admin
      const params = createTestData.getUserParams({ userId: 2 })
      const userId = 1
      const roleName = RoleName.Admin
      const mockMessageResponse = createTestData.messageResponse()

      mockUserService.deletedUser.mockResolvedValue(mockMessageResponse)

      // Act - Thực hiện xóa user
      const result = await controller.deleteUser(params, userId, roleName)

      // Assert - Kiểm tra kết quả
      expect(result).toEqual(mockMessageResponse)
      expect(result.message).toBe('User deleted successfully')
      expect(mockUserService.deletedUser).toHaveBeenCalledWith({
        id: 2,
        deletedById: userId,
        deletedByRoleName: roleName,
      })
      expect(mockUserService.deletedUser).toHaveBeenCalledTimes(1)
    })

    it('should throw CannotUpdateOrDeleteYourselfException when trying to delete yourself', async () => {
      // Arrange - Chuẩn bị dữ liệu khi cố xóa chính mình
      const params = createTestData.getUserParams({ userId: 1 })
      const userId = 1 // Same as params.userId
      const roleName = RoleName.Admin

      mockUserService.deletedUser.mockRejectedValue(CannotUpdateOrDeleteYourselfException)

      // Act & Assert - Thực hiện và kiểm tra exception
      await expect(controller.deleteUser(params, userId, roleName)).rejects.toThrow(
        CannotUpdateOrDeleteYourselfException,
      )
    })

    it('should throw ForbiddenException when non-admin tries to delete admin user', async () => {
      // Arrange - Chuẩn bị dữ liệu khi non-admin cố xóa admin user
      const params = createTestData.getUserParams({ userId: 1 }) // Admin user
      const userId = 2
      const roleName = RoleName.Client

      mockUserService.deletedUser.mockRejectedValue(new ForbiddenException())

      // Act & Assert - Thực hiện và kiểm tra exception
      await expect(controller.deleteUser(params, userId, roleName)).rejects.toThrow(ForbiddenException)
    })

    it('should throw NotFoundRecordException when user not found', async () => {
      // Arrange - Chuẩn bị dữ liệu khi user không tồn tại
      const params = createTestData.getUserParams({ userId: 999 })
      const userId = 1
      const roleName = RoleName.Admin

      mockUserService.deletedUser.mockRejectedValue(NotFoundRecordException)

      // Act & Assert - Thực hiện và kiểm tra exception
      await expect(controller.deleteUser(params, userId, roleName)).rejects.toThrow(NotFoundRecordException)
    })

    it('should perform soft delete (not hard delete)', async () => {
      // Arrange - Chuẩn bị dữ liệu xóa mềm user
      const params = createTestData.getUserParams({ userId: 2 })
      const userId = 1
      const roleName = RoleName.Admin
      const mockMessageResponse = createTestData.messageResponse()

      mockUserService.deletedUser.mockResolvedValue(mockMessageResponse)

      // Act - Thực hiện xóa user
      const result = await controller.deleteUser(params, userId, roleName)

      // Assert - Kiểm tra kết quả (soft delete)
      expect(result.message).toBe('User deleted successfully')
      expect(mockUserService.deletedUser).toHaveBeenCalledWith({
        id: 2,
        deletedById: userId,
        deletedByRoleName: roleName,
      })
    })

    it('should delete client user by admin', async () => {
      // Arrange - Chuẩn bị dữ liệu xóa client user bởi admin
      const params = createTestData.getUserParams({ userId: 3 })
      const userId = 1
      const roleName = RoleName.Admin
      const mockMessageResponse = createTestData.messageResponse()

      mockUserService.deletedUser.mockResolvedValue(mockMessageResponse)

      // Act - Thực hiện xóa user
      const result = await controller.deleteUser(params, userId, roleName)

      // Assert - Kiểm tra kết quả
      expect(result.message).toBe('User deleted successfully')
    })

    it('should delete seller user by admin', async () => {
      // Arrange - Chuẩn bị dữ liệu xóa seller user bởi admin
      const params = createTestData.getUserParams({ userId: 4 })
      const userId = 1
      const roleName = RoleName.Admin
      const mockMessageResponse = createTestData.messageResponse()

      mockUserService.deletedUser.mockResolvedValue(mockMessageResponse)

      // Act - Thực hiện xóa user
      const result = await controller.deleteUser(params, userId, roleName)

      // Assert - Kiểm tra kết quả
      expect(result.message).toBe('User deleted successfully')
    })
  })

  describe('Edge Cases & Security', () => {
    it('should handle concurrent requests properly', async () => {
      // Arrange - Chuẩn bị dữ liệu cho nhiều requests đồng thời
      const query = createTestData.getUsersQuery()
      const mockListResponse = createTestData.usersListResponse()

      mockUserService.getListUser.mockResolvedValue(mockListResponse)

      // Act - Thực hiện nhiều requests đồng thời
      const results = await Promise.all([
        controller.getListUser(query),
        controller.getListUser(query),
        controller.getListUser(query),
      ])

      // Assert - Kiểm tra kết quả
      expect(results).toHaveLength(3)
      expect(mockUserService.getListUser).toHaveBeenCalledTimes(3)
    })

    it('should validate userId parameter is positive number', async () => {
      // Arrange - Chuẩn bị dữ liệu với userId âm (sẽ bị validate bởi DTO)
      const params = createTestData.getUserParams({ userId: 1 })
      const mockUserResponse = createTestData.userWithRoleResponse()

      mockUserService.findById.mockResolvedValue(mockUserResponse)

      // Act - Thực hiện tìm user
      const result = await controller.findById(params)

      // Assert - Kiểm tra kết quả
      expect(result).toBeDefined()
      expect(params.userId).toBeGreaterThan(0)
    })

    it('should handle service errors gracefully', async () => {
      // Arrange - Chuẩn bị dữ liệu khi service throw error
      const query = createTestData.getUsersQuery()
      const error = new Error('Database connection failed')

      mockUserService.getListUser.mockRejectedValue(error)

      // Act & Assert - Thực hiện và kiểm tra error
      await expect(controller.getListUser(query)).rejects.toThrow('Database connection failed')
    })
  })

  // ===== RESPONSE STRUCTURE SNAPSHOTS =====

  describe('Response Structure Snapshots', () => {
    it('should match users list response structure', async () => {
      const mockResponse = createTestData.usersListResponse()
      mockUserService.getListUser.mockResolvedValue(mockResponse)
      const result = await controller.getListUser(createTestData.getUsersQuery())
      expect(result).toMatchSnapshot()
    })

    it('should match user detail with role response structure', async () => {
      const mockResponse = createTestData.userWithRoleResponse()
      mockUserService.findById.mockResolvedValue(mockResponse)
      const result = await controller.findById(createTestData.getUserParams())
      expect(result).toMatchSnapshot()
    })

    it('should match create user response structure', async () => {
      const mockResponse = createTestData.userResponse()
      mockUserService.createUser.mockResolvedValue(mockResponse)
      const result = await controller.createUser(createTestData.createUserBody(), 1, 'Admin')
      expect(result).toMatchSnapshot()
    })
  })
})
