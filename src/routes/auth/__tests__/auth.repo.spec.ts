import { Test, TestingModule } from '@nestjs/testing'
import { TypeOfVerificationCode } from '../../../shared/constants/auth.constant'
import { PrismaService } from '../../../shared/services/prisma.service'
import { AuthRepository } from '../auth.repo'

describe('AuthRepository', () => {
  let repository: AuthRepository
  let mockPrismaService: any

  // Test data factories
  const createTestData = {
    user: (overrides = {}) => ({
      id: 1,
      email: 'test@example.com',
      name: 'Test User',
      phoneNumber: '0123456789',
      password: 'hashedPassword123',
      roleId: 2,
      status: 'ACTIVE' as const,
      totpSecret: null,
      avatar: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      deletedAt: null,
      createdById: null,
      updatedById: null,
      deletedById: null,
      ...overrides,
    }),
    role: (overrides = {}) => ({
      id: 2,
      name: 'USER',
      description: 'Regular user',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      deletedAt: null,
      createdById: null,
      updatedById: null,
      deletedById: null,
      ...overrides,
    }),
    verificationCode: (overrides = {}) => ({
      id: 1,
      email: 'test@example.com',
      code: '123456',
      type: TypeOfVerificationCode.REGISTER,
      expiresAt: new Date(Date.now() + 60000).toISOString(),
      createdAt: new Date().toISOString(),
      ...overrides,
    }),
    refreshToken: (overrides = {}) => ({
      id: 1,
      token: 'refresh-token-123',
      userId: 1,
      deviceId: 1,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      createdAt: new Date().toISOString(),
      ...overrides,
    }),
    device: (overrides = {}) => ({
      id: 1,
      userId: 1,
      userAgent: 'Mozilla/5.0',
      ip: '192.168.1.1',
      lastActive: new Date().toISOString(),
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      ...overrides,
    }),
  }

  beforeEach(async () => {
    // Mock PrismaService
    mockPrismaService = {
      user: {
        create: jest.fn(),
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      verificationCode: {
        upsert: jest.fn(),
        findUnique: jest.fn(),
        delete: jest.fn(),
      },
      refreshToken: {
        create: jest.fn(),
        delete: jest.fn(),
        findUnique: jest.fn(),
      },
      device: {
        create: jest.fn(),
        update: jest.fn(),
      },
    }

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthRepository,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile()

    repository = module.get<AuthRepository>(AuthRepository)
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  describe('createUser', () => {
    it('should create user and omit password and totpSecret', async () => {
      // Arrange - Chuẩn bị dữ liệu tạo user
      const userData = {
        email: 'test@example.com',
        name: 'Test User',
        password: 'hashedPassword123',
        phoneNumber: '0123456789',
        roleId: 2,
      }

      const expectedUser = createTestData.user({ ...userData, password: undefined, totpSecret: undefined })

      mockPrismaService.user.create.mockResolvedValue(expectedUser)

      // Act - Thực hiện tạo user
      const result = await repository.createUser(userData)

      // Assert - Kiểm tra kết quả
      expect(result).toEqual(expectedUser)
      expect(mockPrismaService.user.create).toHaveBeenCalledWith({
        data: userData,
        omit: {
          password: true,
          totpSecret: true,
        },
      })
    })
  })

  describe('createUserIncludeRole', () => {
    it('should create user with role included', async () => {
      // Arrange - Chuẩn bị dữ liệu tạo user kèm role
      const userData = {
        email: 'test@example.com',
        name: 'Test User',
        password: 'hashedPassword123',
        phoneNumber: '0123456789',
        roleId: 2,
        avatar: 'avatar.jpg',
      }

      const mockUser = createTestData.user(userData)
      const mockRole = createTestData.role()
      const expectedResult = { ...mockUser, role: mockRole }

      mockPrismaService.user.create.mockResolvedValue(expectedResult)

      // Act - Thực hiện tạo user kèm role
      const result = await repository.createUserIncludeRole(userData)

      // Assert - Kiểm tra kết quả
      expect(result).toEqual(expectedResult)
      expect(result.role).toBeDefined()
      expect(mockPrismaService.user.create).toHaveBeenCalledWith({
        data: userData,
        include: {
          role: true,
        },
      })
    })
  })

  describe('createVerificationCode', () => {
    it('should upsert verification code', async () => {
      // Arrange - Chuẩn bị dữ liệu verification code
      const expiresAt = new Date(Date.now() + 60000).toISOString()
      const payload = {
        email: 'test@example.com',
        code: '123456',
        type: TypeOfVerificationCode.REGISTER,
        expiresAt,
      }

      const mockVerificationCode = createTestData.verificationCode(payload)

      mockPrismaService.verificationCode.upsert.mockResolvedValue(mockVerificationCode)

      // Act - Thực hiện upsert verification code
      const result = await repository.createVerificationCode(payload)

      // Assert - Kiểm tra kết quả
      expect(result).toEqual(mockVerificationCode)
      expect(mockPrismaService.verificationCode.upsert).toHaveBeenCalledWith({
        where: {
          email_type: {
            email: payload.email,
            type: payload.type,
          },
        },
        create: payload,
        update: {
          code: payload.code,
          expiresAt: payload.expiresAt,
        },
      })
    })
  })

  describe('findUniqueVerificationCode', () => {
    it('should find verification code by id', async () => {
      // Arrange - Chuẩn bị dữ liệu tìm kiếm theo id
      const uniqueValue = { id: 1 }
      const mockVerificationCode = createTestData.verificationCode()

      mockPrismaService.verificationCode.findUnique.mockResolvedValue(mockVerificationCode)

      // Act - Thực hiện tìm kiếm
      const result = await repository.findUniqueVerificationCode(uniqueValue)

      // Assert - Kiểm tra kết quả
      expect(result).toEqual(mockVerificationCode)
      expect(mockPrismaService.verificationCode.findUnique).toHaveBeenCalledWith({
        where: uniqueValue,
      })
    })

    it('should find verification code by email and type', async () => {
      // Arrange - Chuẩn bị dữ liệu tìm kiếm theo email_type
      const uniqueValue = {
        email_type: {
          email: 'test@example.com',
          type: TypeOfVerificationCode.REGISTER,
        },
      }
      const mockVerificationCode = createTestData.verificationCode()

      mockPrismaService.verificationCode.findUnique.mockResolvedValue(mockVerificationCode)

      // Act - Thực hiện tìm kiếm
      const result = await repository.findUniqueVerificationCode(uniqueValue)

      // Assert - Kiểm tra kết quả
      expect(result).toEqual(mockVerificationCode)
      expect(mockPrismaService.verificationCode.findUnique).toHaveBeenCalledWith({
        where: uniqueValue,
      })
    })

    it('should return null when verification code not found', async () => {
      // Arrange - Chuẩn bị dữ liệu không tìm thấy
      const uniqueValue = { id: 999 }

      mockPrismaService.verificationCode.findUnique.mockResolvedValue(null)

      // Act - Thực hiện tìm kiếm
      const result = await repository.findUniqueVerificationCode(uniqueValue)

      // Assert - Kiểm tra kết quả
      expect(result).toBeNull()
    })
  })

  describe('createRefreshToken', () => {
    it('should create refresh token', async () => {
      // Arrange - Chuẩn bị dữ liệu tạo refresh token
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
      const data = {
        token: 'refresh-token-123',
        userId: 1,
        expiresAt,
        deviceId: 1,
      }

      const mockRefreshToken = createTestData.refreshToken({ ...data, expiresAt: expiresAt.toISOString() })

      mockPrismaService.refreshToken.create.mockResolvedValue(mockRefreshToken)

      // Act - Thực hiện tạo refresh token
      const result = await repository.createRefreshToken(data)

      // Assert - Kiểm tra kết quả
      expect(result).toEqual(mockRefreshToken)
      expect(mockPrismaService.refreshToken.create).toHaveBeenCalledWith({
        data,
      })
    })
  })

  describe('deleteRefreshToken', () => {
    it('should delete refresh token', async () => {
      // Arrange - Chuẩn bị dữ liệu xóa refresh token
      const uniqueObject = { token: 'refresh-token-123' }
      const mockRefreshToken = createTestData.refreshToken(uniqueObject)

      mockPrismaService.refreshToken.delete.mockResolvedValue(mockRefreshToken)

      // Act - Thực hiện xóa refresh token
      const result = await repository.deleteRefreshToken(uniqueObject)

      // Assert - Kiểm tra kết quả
      expect(result).toEqual(mockRefreshToken)
      expect(mockPrismaService.refreshToken.delete).toHaveBeenCalledWith({
        where: uniqueObject,
      })
    })
  })

  describe('createDevice', () => {
    it('should create device with required fields', async () => {
      // Arrange - Chuẩn bị dữ liệu tạo device
      const data = {
        userId: 1,
        userAgent: 'Mozilla/5.0',
        ip: '192.168.1.1',
      }

      const mockDevice = createTestData.device(data)

      mockPrismaService.device.create.mockResolvedValue(mockDevice)

      // Act - Thực hiện tạo device
      const result = await repository.createDevice(data)

      // Assert - Kiểm tra kết quả
      expect(result).toEqual(mockDevice)
      expect(mockPrismaService.device.create).toHaveBeenCalledWith({
        data,
      })
    })

    it('should create device with optional fields', async () => {
      // Arrange - Chuẩn bị dữ liệu tạo device với optional fields
      const lastActive = new Date().toISOString()
      const data = {
        userId: 1,
        userAgent: 'Mozilla/5.0',
        ip: '192.168.1.1',
        lastActive,
        isActive: true,
      }

      const mockDevice = createTestData.device(data)

      mockPrismaService.device.create.mockResolvedValue(mockDevice)

      // Act - Thực hiện tạo device
      const result = await repository.createDevice(data)

      // Assert - Kiểm tra kết quả
      expect(result).toEqual(mockDevice)
      expect(mockPrismaService.device.create).toHaveBeenCalledWith({
        data,
      })
    })
  })

  describe('updateDevice', () => {
    it('should update device', async () => {
      // Arrange - Chuẩn bị dữ liệu update device
      const deviceId = 1
      const lastActive = new Date().toISOString()
      const data = {
        lastActive,
        isActive: true,
      }

      const mockDevice = createTestData.device({ id: deviceId, ...data })

      mockPrismaService.device.update.mockResolvedValue(mockDevice)

      // Act - Thực hiện update device
      const result = await repository.updateDevice(deviceId, data)

      // Assert - Kiểm tra kết quả
      expect(result).toEqual(mockDevice)
      expect(mockPrismaService.device.update).toHaveBeenCalledWith({
        where: {
          id: deviceId,
        },
        data,
      })
    })
  })

  describe('findUniqueUserIncludeRole', () => {
    it('should find user by id with role and deletedAt null', async () => {
      // Arrange - Chuẩn bị dữ liệu tìm user theo id
      const uniqueObject = { id: 1 }
      const mockUser = createTestData.user()
      const mockRole = createTestData.role()
      const expectedResult = { ...mockUser, role: mockRole }

      mockPrismaService.user.findFirst.mockResolvedValue(expectedResult)

      // Act - Thực hiện tìm user
      const result = await repository.findUniqueUserIncludeRole(uniqueObject)

      // Assert - Kiểm tra kết quả
      expect(result).toEqual(expectedResult)
      expect(result?.role).toBeDefined()
      expect(mockPrismaService.user.findFirst).toHaveBeenCalledWith({
        where: {
          ...uniqueObject,
          deletedAt: null,
        },
        include: {
          role: true,
        },
      })
    })

    it('should find user by email with role and deletedAt null', async () => {
      // Arrange - Chuẩn bị dữ liệu tìm user theo email
      const uniqueObject = { email: 'test@example.com' }
      const mockUser = createTestData.user({ email: uniqueObject.email })
      const mockRole = createTestData.role()
      const expectedResult = { ...mockUser, role: mockRole }

      mockPrismaService.user.findFirst.mockResolvedValue(expectedResult)

      // Act - Thực hiện tìm user
      const result = await repository.findUniqueUserIncludeRole(uniqueObject)

      // Assert - Kiểm tra kết quả
      expect(result).toEqual(expectedResult)
      expect(mockPrismaService.user.findFirst).toHaveBeenCalledWith({
        where: {
          ...uniqueObject,
          deletedAt: null,
        },
        include: {
          role: true,
        },
      })
    })

    it('should return null when user not found', async () => {
      // Arrange - Chuẩn bị dữ liệu không tìm thấy user
      const uniqueObject = { id: 999 }

      mockPrismaService.user.findFirst.mockResolvedValue(null)

      // Act - Thực hiện tìm user
      const result = await repository.findUniqueUserIncludeRole(uniqueObject)

      // Assert - Kiểm tra kết quả
      expect(result).toBeNull()
    })
  })

  describe('findUniqueRefreshTokenIncludeUserRole', () => {
    it('should find refresh token with user and role', async () => {
      // Arrange - Chuẩn bị dữ liệu tìm refresh token
      const uniqueObject = { token: 'refresh-token-123' }
      const mockUser = createTestData.user()
      const mockRole = createTestData.role()
      const mockRefreshToken = createTestData.refreshToken(uniqueObject)
      const expectedResult = {
        ...mockRefreshToken,
        user: { ...mockUser, role: mockRole },
      }

      mockPrismaService.refreshToken.findUnique.mockResolvedValue(expectedResult)

      // Act - Thực hiện tìm refresh token
      const result = await repository.findUniqueRefreshTokenIncludeUserRole(uniqueObject)

      // Assert - Kiểm tra kết quả
      expect(result).toEqual(expectedResult)
      expect(result?.user).toBeDefined()
      expect(result?.user.role).toBeDefined()
      expect(mockPrismaService.refreshToken.findUnique).toHaveBeenCalledWith({
        where: uniqueObject,
        include: {
          user: {
            include: {
              role: true,
            },
          },
        },
      })
    })

    it('should return null when refresh token not found', async () => {
      // Arrange - Chuẩn bị dữ liệu không tìm thấy refresh token
      const uniqueObject = { token: 'non-existent-token' }

      mockPrismaService.refreshToken.findUnique.mockResolvedValue(null)

      // Act - Thực hiện tìm refresh token
      const result = await repository.findUniqueRefreshTokenIncludeUserRole(uniqueObject)

      // Assert - Kiểm tra kết quả
      expect(result).toBeNull()
    })
  })

  describe('updateDeviceWithTransaction', () => {
    it('should update device without transaction (use default prisma)', async () => {
      // Arrange - Chuẩn bị dữ liệu update device không có transaction
      const deviceId = 1
      const lastActive = new Date().toISOString()
      const data = {
        lastActive,
        isActive: false,
      }

      const mockDevice = createTestData.device({ id: deviceId, ...data })

      mockPrismaService.device.update.mockResolvedValue(mockDevice)

      // Act - Thực hiện update device
      const result = await repository.updateDeviceWithTransaction(deviceId, data)

      // Assert - Kiểm tra kết quả
      expect(result).toEqual(mockDevice)
      expect(mockPrismaService.device.update).toHaveBeenCalledWith({
        where: {
          id: deviceId,
        },
        data,
      })
    })

    it('should update device with transaction (use provided prisma)', async () => {
      // Arrange - Chuẩn bị dữ liệu update device với transaction
      const deviceId = 1
      const lastActive = new Date().toISOString()
      const data = {
        lastActive,
        isActive: false,
      }

      const mockTransactionPrisma = {
        device: {
          update: jest.fn(),
        },
      } as any

      const mockDevice = createTestData.device({ id: deviceId, ...data })

      mockTransactionPrisma.device.update.mockResolvedValue(mockDevice)

      // Act - Thực hiện update device với transaction
      const result = await repository.updateDeviceWithTransaction(deviceId, data, mockTransactionPrisma)

      // Assert - Kiểm tra kết quả
      expect(result).toEqual(mockDevice)
      expect(mockTransactionPrisma.device.update).toHaveBeenCalledWith({
        where: {
          id: deviceId,
        },
        data,
      })
      expect(mockPrismaService.device.update).not.toHaveBeenCalled()
    })
  })

  describe('createRefreshTokenWithTransaction', () => {
    it('should create refresh token without transaction (use default prisma)', async () => {
      // Arrange - Chuẩn bị dữ liệu tạo refresh token không có transaction
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
      const data = {
        token: 'refresh-token-123',
        userId: 1,
        deviceId: 1,
        expiresAt,
      }

      const mockRefreshToken = createTestData.refreshToken({ ...data, expiresAt: expiresAt.toISOString() })

      mockPrismaService.refreshToken.create.mockResolvedValue(mockRefreshToken)

      // Act - Thực hiện tạo refresh token
      const result = await repository.createRefreshTokenWithTransaction(data)

      // Assert - Kiểm tra kết quả
      expect(result).toEqual(mockRefreshToken)
      expect(mockPrismaService.refreshToken.create).toHaveBeenCalledWith({
        data,
      })
    })

    it('should create refresh token with transaction (use provided prisma)', async () => {
      // Arrange - Chuẩn bị dữ liệu tạo refresh token với transaction
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
      const data = {
        token: 'refresh-token-123',
        userId: 1,
        deviceId: 1,
        expiresAt,
      }

      const mockTransactionPrisma = {
        refreshToken: {
          create: jest.fn(),
        },
      } as any

      const mockRefreshToken = createTestData.refreshToken({ ...data, expiresAt: expiresAt.toISOString() })

      mockTransactionPrisma.refreshToken.create.mockResolvedValue(mockRefreshToken)

      // Act - Thực hiện tạo refresh token với transaction
      const result = await repository.createRefreshTokenWithTransaction(data, mockTransactionPrisma)

      // Assert - Kiểm tra kết quả
      expect(result).toEqual(mockRefreshToken)
      expect(mockTransactionPrisma.refreshToken.create).toHaveBeenCalledWith({
        data,
      })
      expect(mockPrismaService.refreshToken.create).not.toHaveBeenCalled()
    })
  })

  describe('deleteRefreshTokenWithTransaction', () => {
    it('should delete refresh token without transaction (use default prisma)', async () => {
      // Arrange - Chuẩn bị dữ liệu xóa refresh token không có transaction
      const token = 'refresh-token-123'
      const mockRefreshToken = createTestData.refreshToken({ token })

      mockPrismaService.refreshToken.delete.mockResolvedValue(mockRefreshToken)

      // Act - Thực hiện xóa refresh token
      await repository.deleteRefreshTokenWithTransaction(token)

      // Assert - Kiểm tra kết quả
      expect(mockPrismaService.refreshToken.delete).toHaveBeenCalledWith({
        where: { token },
      })
    })

    it('should delete refresh token with transaction (use provided prisma)', async () => {
      // Arrange - Chuẩn bị dữ liệu xóa refresh token với transaction
      const token = 'refresh-token-123'

      const mockTransactionPrisma = {
        refreshToken: {
          delete: jest.fn(),
        },
      } as any

      const mockRefreshToken = createTestData.refreshToken({ token })

      mockTransactionPrisma.refreshToken.delete.mockResolvedValue(mockRefreshToken)

      // Act - Thực hiện xóa refresh token với transaction
      await repository.deleteRefreshTokenWithTransaction(token, mockTransactionPrisma)

      // Assert - Kiểm tra kết quả
      expect(mockTransactionPrisma.refreshToken.delete).toHaveBeenCalledWith({
        where: { token },
      })
      expect(mockPrismaService.refreshToken.delete).not.toHaveBeenCalled()
    })
  })

  describe('deleteVerificationCode', () => {
    it('should delete verification code by id', async () => {
      // Arrange - Chuẩn bị dữ liệu xóa verification code theo id
      const uniqueValue = { id: 1 }
      const mockVerificationCode = createTestData.verificationCode()

      mockPrismaService.verificationCode.delete.mockResolvedValue(mockVerificationCode)

      // Act - Thực hiện xóa verification code
      const result = await repository.deleteVerificationCode(uniqueValue)

      // Assert - Kiểm tra kết quả
      expect(result).toEqual(mockVerificationCode)
      expect(mockPrismaService.verificationCode.delete).toHaveBeenCalledWith({
        where: uniqueValue,
      })
    })

    it('should delete verification code by email and type', async () => {
      // Arrange - Chuẩn bị dữ liệu xóa verification code theo email_type
      const uniqueValue = {
        email_type: {
          email: 'test@example.com',
          type: TypeOfVerificationCode.REGISTER,
        },
      }
      const mockVerificationCode = createTestData.verificationCode()

      mockPrismaService.verificationCode.delete.mockResolvedValue(mockVerificationCode)

      // Act - Thực hiện xóa verification code
      const result = await repository.deleteVerificationCode(uniqueValue)

      // Assert - Kiểm tra kết quả
      expect(result).toEqual(mockVerificationCode)
      expect(mockPrismaService.verificationCode.delete).toHaveBeenCalledWith({
        where: uniqueValue,
      })
    })
  })
})
