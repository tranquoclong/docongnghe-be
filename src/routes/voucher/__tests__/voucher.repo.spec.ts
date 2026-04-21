import { Test, TestingModule } from '@nestjs/testing'
import { PrismaService } from '../../../shared/services/prisma.service'
import {
  CreateVoucherBody,
  ListAvailableVouchersQuery,
  ListMyVouchersQuery,
  ListVouchersQuery,
  UpdateVoucherBody,
} from '../voucher.dto'
import { VoucherRepository } from '../voucher.repo'

describe('VoucherRepository', () => {
  let repository: VoucherRepository
  let prismaService: PrismaService

  // Mock PrismaService
  const mockPrismaService = {
    voucher: {
      create: jest.fn(),
      update: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      fields: {
        usedCount: 'usedCount',
      },
    },
    userVoucher: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      update: jest.fn(),
    },
    $transaction: jest.fn(),
  }

  // Test data factories
  const createTestData = {
    createVoucherBody: (): CreateVoucherBody => ({
      code: 'SUMMER2024',
      name: 'Summer Sale',
      description: 'Summer sale voucher',
      type: 'PERCENTAGE',
      value: 20,
      minOrderValue: 100000,
      maxDiscount: 50000,
      startDate: new Date('2025-11-02').toISOString(),
      endDate: new Date('2025-11-08').toISOString(),
      usageLimit: 100,
      userUsageLimit: 1,
      isActive: true,
      applicableProducts: [1, 2, 3],
      excludedProducts: [4, 5],
    }),
    updateVoucherBody: (): UpdateVoucherBody => ({
      name: 'Updated Summer Sale',
      description: 'Updated description',
      isActive: false,
    }),
    voucher: (overrides = {}) => {
      const now = new Date()
      const startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString()
      const endDate = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString()
      return {
        id: 1,
        code: 'SUMMER2024',
        name: 'Summer Sale',
        description: 'Summer sale voucher',
        type: 'PERCENTAGE',
        value: 20,
        minOrderValue: 100000,
        maxDiscount: 50000,
        startDate,
        endDate,
        usageLimit: 100,
        userUsageLimit: 1,
        usedCount: 0,
        isActive: true,
        applicableProducts: [1, 2, 3],
        excludedProducts: [4, 5],
        sellerId: null,
        createdById: 1,
        updatedById: null,
        deletedById: null,
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
        deletedAt: null,
        ...overrides,
      }
    },
    userVoucher: (overrides = {}) => ({
      userId: 1,
      voucherId: 1,
      usedCount: 0,
      savedAt: new Date().toISOString(),
      usedAt: null,
      voucher: createTestData.voucher(),
      ...overrides,
    }),
    listVouchersQuery: (): ListVouchersQuery => ({
      page: 1,
      limit: 10,
    }),
    listAvailableVouchersQuery: (): ListAvailableVouchersQuery => ({
      page: 1,
      limit: 10,
    }),
    listMyVouchersQuery: (): ListMyVouchersQuery => ({
      page: 1,
      limit: 10,
    }),
  }

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        VoucherRepository,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile()

    repository = module.get<VoucherRepository>(VoucherRepository)
    prismaService = module.get<PrismaService>(PrismaService)

    // Reset mocks
    jest.clearAllMocks()
  })

  describe('create', () => {
    it('should create voucher successfully', async () => {
      // Arrange - Chuẩn bị dữ liệu
      const body = createTestData.createVoucherBody()
      const createdById = 1
      const sellerId = 2
      const mockVoucher = createTestData.voucher({ createdById, sellerId })

      mockPrismaService.voucher.create.mockResolvedValue(mockVoucher)

      // Act - Thực hiện tạo voucher
      const result = await repository.create(body, createdById, sellerId)

      // Assert - Kiểm tra kết quả
      expect(result).toEqual(mockVoucher)
      expect(mockPrismaService.voucher.create).toHaveBeenCalledWith({
        data: {
          ...body,
          createdById,
          sellerId,
        },
      })
    })

    it('should create voucher without createdById and sellerId', async () => {
      // Arrange - Chuẩn bị dữ liệu không có createdById và sellerId
      const body = createTestData.createVoucherBody()
      const mockVoucher = createTestData.voucher({ createdById: undefined, sellerId: undefined })

      mockPrismaService.voucher.create.mockResolvedValue(mockVoucher)

      // Act - Thực hiện tạo voucher
      const result = await repository.create(body)

      // Assert - Kiểm tra kết quả
      expect(result).toEqual(mockVoucher)
      expect(mockPrismaService.voucher.create).toHaveBeenCalledWith({
        data: {
          ...body,
          createdById: undefined,
          sellerId: undefined,
        },
      })
    })
  })

  describe('update', () => {
    it('should update voucher successfully', async () => {
      // Arrange - Chuẩn bị dữ liệu
      const id = 1
      const body = createTestData.updateVoucherBody()
      const updatedById = 1
      const mockVoucher = createTestData.voucher({ ...body, updatedById })

      mockPrismaService.voucher.update.mockResolvedValue(mockVoucher)

      // Act - Thực hiện cập nhật
      const result = await repository.update(id, body, updatedById)

      // Assert - Kiểm tra kết quả
      expect(result).toEqual(mockVoucher)
      expect(mockPrismaService.voucher.update).toHaveBeenCalledWith({
        where: { id, deletedAt: null },
        data: {
          ...body,
          updatedById,
        },
      })
    })

    it('should update voucher without updatedById', async () => {
      // Arrange - Chuẩn bị dữ liệu không có updatedById
      const id = 1
      const body = createTestData.updateVoucherBody()
      const mockVoucher = createTestData.voucher({ ...body })

      mockPrismaService.voucher.update.mockResolvedValue(mockVoucher)

      // Act - Thực hiện cập nhật
      const result = await repository.update(id, body)

      // Assert - Kiểm tra kết quả
      expect(result).toEqual(mockVoucher)
      expect(mockPrismaService.voucher.update).toHaveBeenCalledWith({
        where: { id, deletedAt: null },
        data: {
          ...body,
          updatedById: undefined,
        },
      })
    })
  })

  describe('findById', () => {
    it('should find voucher by id successfully', async () => {
      // Arrange - Chuẩn bị dữ liệu
      const id = 1
      const mockVoucher = createTestData.voucher({ id })

      mockPrismaService.voucher.findFirst.mockResolvedValue(mockVoucher)

      // Act - Thực hiện tìm kiếm
      const result = await repository.findById(id)

      // Assert - Kiểm tra kết quả
      expect(result).toEqual(mockVoucher)
      expect(mockPrismaService.voucher.findFirst).toHaveBeenCalledWith({
        where: { id, deletedAt: null },
      })
    })

    it('should return null when voucher not found', async () => {
      // Arrange - Chuẩn bị dữ liệu không tồn tại
      const id = 999
      mockPrismaService.voucher.findFirst.mockResolvedValue(null)

      // Act - Thực hiện tìm kiếm
      const result = await repository.findById(id)

      // Assert - Kiểm tra kết quả
      expect(result).toBeNull()
    })
  })

  describe('findByCode', () => {
    it('should find voucher by code successfully', async () => {
      // Arrange - Chuẩn bị dữ liệu
      const code = 'SUMMER2024'
      const mockVoucher = createTestData.voucher({ code })

      mockPrismaService.voucher.findFirst.mockResolvedValue(mockVoucher)

      // Act - Thực hiện tìm kiếm
      const result = await repository.findByCode(code)

      // Assert - Kiểm tra kết quả
      expect(result).toEqual(mockVoucher)
      expect(mockPrismaService.voucher.findFirst).toHaveBeenCalledWith({
        where: { code, deletedAt: null },
      })
    })

    it('should return null when code not found', async () => {
      // Arrange - Chuẩn bị dữ liệu không tồn tại
      const code = 'NOTFOUND'
      mockPrismaService.voucher.findFirst.mockResolvedValue(null)

      // Act - Thực hiện tìm kiếm
      const result = await repository.findByCode(code)

      // Assert - Kiểm tra kết quả
      expect(result).toBeNull()
    })
  })

  describe('isCodeExists', () => {
    it('should return true when code exists', async () => {
      // Arrange - Chuẩn bị dữ liệu code đã tồn tại
      const code = 'SUMMER2024'
      const mockVoucher = createTestData.voucher({ code })

      mockPrismaService.voucher.findFirst.mockResolvedValue(mockVoucher)

      // Act - Thực hiện kiểm tra
      const result = await repository.isCodeExists(code)

      // Assert - Kiểm tra kết quả
      expect(result).toBe(true)
      expect(mockPrismaService.voucher.findFirst).toHaveBeenCalledWith({
        where: { code, deletedAt: null },
      })
    })

    it('should return false when code does not exist', async () => {
      // Arrange - Chuẩn bị dữ liệu code không tồn tại
      const code = 'NOTFOUND'
      mockPrismaService.voucher.findFirst.mockResolvedValue(null)

      // Act - Thực hiện kiểm tra
      const result = await repository.isCodeExists(code)

      // Assert - Kiểm tra kết quả
      expect(result).toBe(false)
    })

    it('should exclude specific id when checking code exists', async () => {
      // Arrange - Chuẩn bị dữ liệu với excludeId
      const code = 'SUMMER2024'
      const excludeId = 1
      mockPrismaService.voucher.findFirst.mockResolvedValue(null)

      // Act - Thực hiện kiểm tra
      const result = await repository.isCodeExists(code, excludeId)

      // Assert - Kiểm tra kết quả
      expect(result).toBe(false)
      expect(mockPrismaService.voucher.findFirst).toHaveBeenCalledWith({
        where: {
          code,
          deletedAt: null,
          id: { not: excludeId },
        },
      })
    })
  })

  describe('delete', () => {
    it('should soft delete voucher successfully', async () => {
      // Arrange - Chuẩn bị dữ liệu
      const id = 1
      const deletedById = 1
      const mockVoucher = createTestData.voucher({ id, deletedById, deletedAt: new Date().toISOString() })

      mockPrismaService.voucher.update.mockResolvedValue(mockVoucher)

      // Act - Thực hiện xóa
      const result = await repository.delete(id, deletedById)

      // Assert - Kiểm tra kết quả
      expect(result).toEqual(mockVoucher)
      expect(mockPrismaService.voucher.update).toHaveBeenCalledWith({
        where: { id },
        data: {
          deletedAt: expect.any(Date),
          deletedById,
        },
      })
    })

    it('should soft delete voucher without deletedById', async () => {
      // Arrange - Chuẩn bị dữ liệu không có deletedById
      const id = 1
      const mockVoucher = createTestData.voucher({ id, deletedAt: new Date().toISOString() })

      mockPrismaService.voucher.update.mockResolvedValue(mockVoucher)

      // Act - Thực hiện xóa
      const result = await repository.delete(id)

      // Assert - Kiểm tra kết quả
      expect(result).toEqual(mockVoucher)
      expect(mockPrismaService.voucher.update).toHaveBeenCalledWith({
        where: { id },
        data: {
          deletedAt: expect.any(Date),
          deletedById: undefined,
        },
      })
    })
  })

  describe('findMany', () => {
    it('should find vouchers with pagination', async () => {
      // Arrange - Chuẩn bị dữ liệu
      const query = createTestData.listVouchersQuery()
      const mockVouchers = [createTestData.voucher(), createTestData.voucher({ id: 2 })]
      const total = 2

      mockPrismaService.voucher.findMany.mockResolvedValue(mockVouchers)
      mockPrismaService.voucher.count.mockResolvedValue(total)

      // Act - Thực hiện tìm kiếm
      const result = await repository.findMany(query)

      // Assert - Kiểm tra kết quả
      expect(result).toEqual({
        data: mockVouchers,
        total,
        page: query.page,
        limit: query.limit,
      })
      expect(mockPrismaService.voucher.findMany).toHaveBeenCalled()
      expect(mockPrismaService.voucher.count).toHaveBeenCalled()
    })

    it('should filter by type', async () => {
      // Arrange - Chuẩn bị dữ liệu với filter type
      const query: ListVouchersQuery = { page: 1, limit: 10, type: 'PERCENTAGE' }
      const mockVouchers = [createTestData.voucher({ type: 'PERCENTAGE' })]

      mockPrismaService.voucher.findMany.mockResolvedValue(mockVouchers)
      mockPrismaService.voucher.count.mockResolvedValue(1)

      // Act - Thực hiện tìm kiếm
      const result = await repository.findMany(query)

      // Assert - Kiểm tra kết quả
      expect(result.data).toEqual(mockVouchers)
      expect(mockPrismaService.voucher.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ type: 'PERCENTAGE' }),
        }),
      )
    })

    it('should filter by isActive', async () => {
      // Arrange - Chuẩn bị dữ liệu với filter isActive
      const query: ListVouchersQuery = { page: 1, limit: 10, isActive: true }
      const mockVouchers = [createTestData.voucher({ isActive: true })]

      mockPrismaService.voucher.findMany.mockResolvedValue(mockVouchers)
      mockPrismaService.voucher.count.mockResolvedValue(1)

      // Act - Thực hiện tìm kiếm
      const result = await repository.findMany(query)

      // Assert - Kiểm tra kết quả
      expect(result.data).toEqual(mockVouchers)
    })

    it('should filter by search query', async () => {
      // Arrange - Chuẩn bị dữ liệu với search
      const query: ListVouchersQuery = { page: 1, limit: 10, search: 'summer' }
      const mockVouchers = [createTestData.voucher()]

      mockPrismaService.voucher.findMany.mockResolvedValue(mockVouchers)
      mockPrismaService.voucher.count.mockResolvedValue(1)

      // Act - Thực hiện tìm kiếm
      const result = await repository.findMany(query)

      // Assert - Kiểm tra kết quả
      expect(result.data).toEqual(mockVouchers)
    })

    it('should filter by sellerId', async () => {
      // Arrange - Chuẩn bị dữ liệu với sellerId
      const query = createTestData.listVouchersQuery()
      const sellerId = 2
      const mockVouchers = [createTestData.voucher({ sellerId })]

      mockPrismaService.voucher.findMany.mockResolvedValue(mockVouchers)
      mockPrismaService.voucher.count.mockResolvedValue(1)

      // Act - Thực hiện tìm kiếm
      const result = await repository.findMany(query, sellerId)

      // Assert - Kiểm tra kết quả
      expect(result.data).toEqual(mockVouchers)
    })
  })

  describe('findAvailable', () => {
    it('should find available vouchers', async () => {
      // Arrange - Chuẩn bị dữ liệu
      const query = createTestData.listAvailableVouchersQuery()
      const mockVouchers = [createTestData.voucher()]
      const total = 1

      mockPrismaService.voucher.findMany.mockResolvedValue(mockVouchers)
      mockPrismaService.voucher.count.mockResolvedValue(total)

      // Act - Thực hiện tìm kiếm
      const result = await repository.findAvailable(query)

      // Assert - Kiểm tra kết quả
      expect(result).toEqual({
        data: mockVouchers,
        total,
        page: query.page,
        limit: query.limit,
      })
    })

    it('should find available vouchers with userId', async () => {
      // Arrange - Chuẩn bị dữ liệu với userId
      const query = createTestData.listAvailableVouchersQuery()
      const userId = 1
      const mockVouchers = [createTestData.voucher()]

      mockPrismaService.voucher.findMany.mockResolvedValue(mockVouchers)
      mockPrismaService.voucher.count.mockResolvedValue(1)

      // Act - Thực hiện tìm kiếm
      const result = await repository.findAvailable(query, userId)

      // Assert - Kiểm tra kết quả
      expect(result.data).toEqual(mockVouchers)
      expect(mockPrismaService.voucher.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          include: expect.objectContaining({
            userVouchers: { where: { userId } },
          }),
        }),
      )
    })

    it('should filter available vouchers by type', async () => {
      // Arrange - Chuẩn bị dữ liệu với type filter
      const query: ListAvailableVouchersQuery = { page: 1, limit: 10, type: 'PERCENTAGE' }
      const mockVouchers = [createTestData.voucher({ type: 'PERCENTAGE' })]

      mockPrismaService.voucher.findMany.mockResolvedValue(mockVouchers)
      mockPrismaService.voucher.count.mockResolvedValue(1)

      // Act - Thực hiện tìm kiếm
      const result = await repository.findAvailable(query)

      // Assert - Kiểm tra kết quả
      expect(result.data).toEqual(mockVouchers)
    })
  })

  describe('collectVoucher', () => {
    it('should collect voucher successfully', async () => {
      // Arrange - Chuẩn bị dữ liệu
      const userId = 1
      const voucherId = 1
      const mockUserVoucher = createTestData.userVoucher({ userId, voucherId })

      mockPrismaService.userVoucher.create.mockResolvedValue(mockUserVoucher)

      // Act - Thực hiện lưu voucher
      const result = await repository.collectVoucher(userId, voucherId)

      // Assert - Kiểm tra kết quả
      expect(result).toEqual(mockUserVoucher)
      expect(mockPrismaService.userVoucher.create).toHaveBeenCalledWith({
        data: { userId, voucherId },
        include: { voucher: true },
      })
    })
  })

  describe('isVoucherCollected', () => {
    it('should return true when voucher is collected', async () => {
      // Arrange - Chuẩn bị dữ liệu voucher đã lưu
      const userId = 1
      const voucherId = 1
      const mockUserVoucher = createTestData.userVoucher({ userId, voucherId })

      mockPrismaService.userVoucher.findUnique.mockResolvedValue(mockUserVoucher)

      // Act - Thực hiện kiểm tra
      const result = await repository.isVoucherCollected(userId, voucherId)

      // Assert - Kiểm tra kết quả
      expect(result).toBe(true)
    })

    it('should return false when voucher is not collected', async () => {
      // Arrange - Chuẩn bị dữ liệu voucher chưa lưu
      const userId = 1
      const voucherId = 1

      mockPrismaService.userVoucher.findUnique.mockResolvedValue(null)

      // Act - Thực hiện kiểm tra
      const result = await repository.isVoucherCollected(userId, voucherId)

      // Assert - Kiểm tra kết quả
      expect(result).toBe(false)
    })
  })

  describe('findUserVoucher', () => {
    it('should find user voucher successfully', async () => {
      // Arrange - Chuẩn bị dữ liệu
      const userId = 1
      const voucherId = 1
      const mockUserVoucher = createTestData.userVoucher({ userId, voucherId })

      mockPrismaService.userVoucher.findUnique.mockResolvedValue(mockUserVoucher)

      // Act - Thực hiện tìm kiếm
      const result = await repository.findUserVoucher(userId, voucherId)

      // Assert - Kiểm tra kết quả
      expect(result).toEqual(mockUserVoucher)
      expect(mockPrismaService.userVoucher.findUnique).toHaveBeenCalledWith({
        where: { userId_voucherId: { userId, voucherId } },
        include: { voucher: true },
      })
    })
  })

  describe('findMyVouchers', () => {
    it('should find my vouchers successfully', async () => {
      // Arrange - Chuẩn bị dữ liệu
      const userId = 1
      const query = createTestData.listMyVouchersQuery()
      const mockUserVouchers = [createTestData.userVoucher({ userId })]
      const total = 1

      mockPrismaService.userVoucher.findMany.mockResolvedValue(mockUserVouchers)
      mockPrismaService.userVoucher.count.mockResolvedValue(total)

      // Act - Thực hiện tìm kiếm
      const result = await repository.findMyVouchers(userId, query)

      // Assert - Kiểm tra kết quả
      expect(result).toEqual({
        data: mockUserVouchers,
        total,
        page: query.page,
        limit: query.limit,
      })
    })

    it('should filter my vouchers by status expired', async () => {
      // Arrange - Chuẩn bị dữ liệu với status expired
      const userId = 1
      const query: ListMyVouchersQuery = { page: 1, limit: 10, status: 'expired' }
      const mockUserVouchers = [createTestData.userVoucher({ userId })]

      mockPrismaService.userVoucher.findMany.mockResolvedValue(mockUserVouchers)
      mockPrismaService.userVoucher.count.mockResolvedValue(1)

      // Act - Thực hiện tìm kiếm
      const result = await repository.findMyVouchers(userId, query)

      // Assert - Kiểm tra kết quả
      expect(result.data).toEqual(mockUserVouchers)
    })

    it('should filter my vouchers by status available', async () => {
      // Arrange - Chuẩn bị dữ liệu với status available
      const userId = 1
      const query: ListMyVouchersQuery = { page: 1, limit: 10, status: 'available' }
      const mockUserVouchers = [
        createTestData.userVoucher({
          userId,
          usedCount: 0,
          voucher: createTestData.voucher({ userUsageLimit: 1 }),
        }),
      ]

      mockPrismaService.userVoucher.findMany.mockResolvedValue(mockUserVouchers)
      mockPrismaService.userVoucher.count.mockResolvedValue(1)

      // Act - Thực hiện tìm kiếm
      const result = await repository.findMyVouchers(userId, query)

      // Assert - Kiểm tra kết quả
      expect(result.data).toEqual(mockUserVouchers)
    })

    it('should filter my vouchers by status used', async () => {
      // Arrange - Chuẩn bị dữ liệu với status used
      const userId = 1
      const query: ListMyVouchersQuery = { page: 1, limit: 10, status: 'used' }
      const mockUserVouchers = [
        createTestData.userVoucher({
          userId,
          usedCount: 1,
          voucher: createTestData.voucher({ userUsageLimit: 1 }),
        }),
      ]

      mockPrismaService.userVoucher.findMany.mockResolvedValue(mockUserVouchers)
      mockPrismaService.userVoucher.count.mockResolvedValue(1)

      // Act - Thực hiện tìm kiếm
      const result = await repository.findMyVouchers(userId, query)

      // Assert - Kiểm tra kết quả
      expect(result.data).toEqual(mockUserVouchers)
    })
  })

  describe('canApplyVoucher', () => {
    it('should return false when voucher not found', async () => {
      // Arrange - Chuẩn bị dữ liệu voucher không tồn tại
      const userId = 1
      const code = 'NOTFOUND'
      const orderAmount = 100000

      mockPrismaService.voucher.findFirst.mockResolvedValue(null)

      // Act - Thực hiện kiểm tra
      const result = await repository.canApplyVoucher(userId, code, orderAmount)

      // Assert - Kiểm tra kết quả
      expect(result).toEqual({
        canApply: false,
        reason: 'Voucher không tồn tại',
      })
    })

    it('should return false when voucher is not active', async () => {
      // Arrange - Chuẩn bị dữ liệu voucher không active
      const userId = 1
      const code = 'SUMMER2024'
      const orderAmount = 100000
      const mockVoucher = createTestData.voucher({ code, isActive: false })

      mockPrismaService.voucher.findFirst.mockResolvedValue(mockVoucher)

      // Act - Thực hiện kiểm tra
      const result = await repository.canApplyVoucher(userId, code, orderAmount)

      // Assert - Kiểm tra kết quả
      expect(result).toEqual({
        canApply: false,
        reason: 'Voucher đã bị vô hiệu hóa',
      })
    })

    it('should return false when voucher not yet started', async () => {
      // Arrange - Chuẩn bị dữ liệu voucher chưa bắt đầu
      const userId = 1
      const code = 'SUMMER2024'
      const orderAmount = 100000
      const futureDate = new Date('2099-01-01')
      const mockVoucher = createTestData.voucher({ code, startDate: futureDate })

      // Spy on findByCode to bypass @SerializeAll() decorator which converts Date to string
      jest.spyOn(repository as any, 'findByCode').mockResolvedValue(mockVoucher)

      // Act - Thực hiện kiểm tra
      const result = await repository.canApplyVoucher(userId, code, orderAmount)

      // Assert - Kiểm tra kết quả
      expect(result).toEqual({
        canApply: false,
        reason: 'Voucher chưa có hiệu lực',
      })
    })

    it('should return false when voucher expired', async () => {
      // Arrange - Chuẩn bị dữ liệu voucher đã hết hạn
      const userId = 1
      const code = 'SUMMER2024'
      const orderAmount = 100000
      const pastDate = new Date('2020-01-01')
      const mockVoucher = createTestData.voucher({ code, endDate: pastDate })

      // Spy on findByCode to bypass @SerializeAll() decorator which converts Date to string
      jest.spyOn(repository as any, 'findByCode').mockResolvedValue(mockVoucher)

      // Act - Thực hiện kiểm tra
      const result = await repository.canApplyVoucher(userId, code, orderAmount)

      // Assert - Kiểm tra kết quả
      expect(result).toEqual({
        canApply: false,
        reason: 'Voucher đã hết hạn',
      })
    })

    it('should return false when usage limit reached', async () => {
      // Arrange - Chuẩn bị dữ liệu voucher đã hết lượt sử dụng
      const userId = 1
      const code = 'SUMMER2024'
      const orderAmount = 100000
      const mockVoucher = createTestData.voucher({ code, usageLimit: 100, usedCount: 100 })

      mockPrismaService.voucher.findFirst.mockResolvedValue(mockVoucher)

      // Act - Thực hiện kiểm tra
      const result = await repository.canApplyVoucher(userId, code, orderAmount)

      // Assert - Kiểm tra kết quả
      expect(result).toEqual({
        canApply: false,
        reason: 'Voucher đã hết lượt sử dụng',
      })
    })

    it('should return false when user has not collected voucher', async () => {
      // Arrange - Chuẩn bị dữ liệu user chưa lưu voucher
      const userId = 1
      const code = 'SUMMER2024'
      const orderAmount = 100000
      const mockVoucher = createTestData.voucher({ code })

      mockPrismaService.voucher.findFirst.mockResolvedValue(mockVoucher)
      mockPrismaService.userVoucher.findUnique.mockResolvedValue(null)

      // Act - Thực hiện kiểm tra
      const result = await repository.canApplyVoucher(userId, code, orderAmount)

      // Assert - Kiểm tra kết quả
      expect(result).toEqual({
        canApply: false,
        reason: 'Bạn chưa lưu voucher này',
      })
    })

    it('should return false when user usage limit reached', async () => {
      // Arrange - Chuẩn bị dữ liệu user đã hết lượt sử dụng
      const userId = 1
      const code = 'SUMMER2024'
      const orderAmount = 100000
      const mockVoucher = createTestData.voucher({ code, userUsageLimit: 1 })
      const mockUserVoucher = createTestData.userVoucher({ userId, voucherId: 1, usedCount: 1 })

      mockPrismaService.voucher.findFirst.mockResolvedValue(mockVoucher)
      mockPrismaService.userVoucher.findUnique.mockResolvedValue(mockUserVoucher)

      // Act - Thực hiện kiểm tra
      const result = await repository.canApplyVoucher(userId, code, orderAmount)

      // Assert - Kiểm tra kết quả
      expect(result).toEqual({
        canApply: false,
        reason: 'Bạn đã sử dụng hết lượt voucher này',
      })
    })

    it('should return false when order amount below minimum', async () => {
      // Arrange - Chuẩn bị dữ liệu đơn hàng không đủ giá trị tối thiểu
      const userId = 1
      const code = 'SUMMER2024'
      const orderAmount = 50000
      const mockVoucher = createTestData.voucher({ code, minOrderValue: 100000 })
      const mockUserVoucher = createTestData.userVoucher({ userId, voucherId: 1 })

      mockPrismaService.voucher.findFirst.mockResolvedValue(mockVoucher)
      mockPrismaService.userVoucher.findUnique.mockResolvedValue(mockUserVoucher)

      // Act - Thực hiện kiểm tra
      const result = await repository.canApplyVoucher(userId, code, orderAmount)

      // Assert - Kiểm tra kết quả
      expect(result).toEqual({
        canApply: false,
        reason: 'Đơn hàng tối thiểu 100.000đ',
      })
    })

    it('should return false when product not applicable', async () => {
      // Arrange - Chuẩn bị dữ liệu sản phẩm không áp dụng
      const userId = 1
      const code = 'SUMMER2024'
      const orderAmount = 100000
      const productIds = [10, 11]
      const mockVoucher = createTestData.voucher({ code, applicableProducts: [1, 2, 3] })
      const mockUserVoucher = createTestData.userVoucher({ userId, voucherId: 1 })

      mockPrismaService.voucher.findFirst.mockResolvedValue(mockVoucher)
      mockPrismaService.userVoucher.findUnique.mockResolvedValue(mockUserVoucher)

      // Act - Thực hiện kiểm tra
      const result = await repository.canApplyVoucher(userId, code, orderAmount, productIds)

      // Assert - Kiểm tra kết quả
      expect(result).toEqual({
        canApply: false,
        reason: 'Sản phẩm không áp dụng voucher này',
      })
    })

    it('should return false when product is excluded', async () => {
      // Arrange - Chuẩn bị dữ liệu sản phẩm bị loại trừ
      const userId = 1
      const code = 'SUMMER2024'
      const orderAmount = 100000
      const productIds = [1, 4] // 1 is applicable, 4 is excluded
      const mockVoucher = createTestData.voucher({ code, applicableProducts: [1, 2, 3], excludedProducts: [4, 5] })
      const mockUserVoucher = createTestData.userVoucher({ userId, voucherId: 1 })

      mockPrismaService.voucher.findFirst.mockResolvedValue(mockVoucher)
      mockPrismaService.userVoucher.findUnique.mockResolvedValue(mockUserVoucher)

      // Act - Thực hiện kiểm tra
      const result = await repository.canApplyVoucher(userId, code, orderAmount, productIds)

      // Assert - Kiểm tra kết quả
      expect(result).toEqual({
        canApply: false,
        reason: 'Đơn hàng chứa sản phẩm không được áp dụng voucher',
      })
    })

    it('should calculate discount for PERCENTAGE type', async () => {
      // Arrange - Chuẩn bị dữ liệu voucher PERCENTAGE (no applicable products restriction)
      const userId = 1
      const code = 'SUMMER2024'
      const orderAmount = 100000
      const mockVoucher = createTestData.voucher({
        code,
        type: 'PERCENTAGE',
        value: 20,
        maxDiscount: 50000,
        applicableProducts: [],
        excludedProducts: [],
      })
      const mockUserVoucher = createTestData.userVoucher({ userId, voucherId: 1 })

      mockPrismaService.voucher.findFirst.mockResolvedValue(mockVoucher)
      mockPrismaService.userVoucher.findUnique.mockResolvedValue(mockUserVoucher)

      // Act - Thực hiện kiểm tra
      const result = await repository.canApplyVoucher(userId, code, orderAmount)

      // Assert - Kiểm tra kết quả
      expect(result).toEqual({
        canApply: true,
        discountAmount: 20000, // 20% of 100000
        voucher: mockVoucher,
      })
    })

    it('should calculate discount for FIXED_AMOUNT type', async () => {
      // Arrange - Chuẩn bị dữ liệu voucher FIXED_AMOUNT (no applicable products restriction)
      const userId = 1
      const code = 'SUMMER2024'
      const orderAmount = 100000
      const mockVoucher = createTestData.voucher({
        code,
        type: 'FIXED_AMOUNT',
        value: 30000,
        applicableProducts: [],
        excludedProducts: [],
      })
      const mockUserVoucher = createTestData.userVoucher({ userId, voucherId: 1 })

      mockPrismaService.voucher.findFirst.mockResolvedValue(mockVoucher)
      mockPrismaService.userVoucher.findUnique.mockResolvedValue(mockUserVoucher)

      // Act - Thực hiện kiểm tra
      const result = await repository.canApplyVoucher(userId, code, orderAmount)

      // Assert - Kiểm tra kết quả
      expect(result).toEqual({
        canApply: true,
        discountAmount: 30000,
        voucher: mockVoucher,
      })
    })

    it('should calculate discount for FREE_SHIPPING type', async () => {
      // Arrange - Chuẩn bị dữ liệu voucher FREE_SHIPPING (no applicable products restriction)
      const userId = 1
      const code = 'SUMMER2024'
      const orderAmount = 100000
      const mockVoucher = createTestData.voucher({
        code,
        type: 'FREE_SHIPPING',
        value: 25000,
        applicableProducts: [],
        excludedProducts: [],
      })
      const mockUserVoucher = createTestData.userVoucher({ userId, voucherId: 1 })

      mockPrismaService.voucher.findFirst.mockResolvedValue(mockVoucher)
      mockPrismaService.userVoucher.findUnique.mockResolvedValue(mockUserVoucher)

      // Act - Thực hiện kiểm tra
      const result = await repository.canApplyVoucher(userId, code, orderAmount)

      // Assert - Kiểm tra kết quả
      expect(result).toEqual({
        canApply: true,
        discountAmount: 25000,
        voucher: mockVoucher,
      })
    })
  })

  describe('useVoucher', () => {
    it('should use voucher successfully', async () => {
      // Arrange - Chuẩn bị dữ liệu
      const userId = 1
      const voucherId = 1

      mockPrismaService.$transaction.mockImplementation((callback) => {
        if (typeof callback === 'function') {
          return callback(mockPrismaService)
        }
        return Promise.resolve([{}, {}])
      })

      // Act - Thực hiện sử dụng voucher
      await repository.useVoucher(userId, voucherId)

      // Assert - Kiểm tra kết quả
      expect(mockPrismaService.$transaction).toHaveBeenCalled()
    })
  })

  describe('getUserVoucherStats', () => {
    it('should get user voucher stats successfully', async () => {
      // Arrange - Chuẩn bị dữ liệu
      const userId = 1
      const mockUserVouchers = [
        createTestData.userVoucher({
          userId,
          usedCount: 0,
          voucher: createTestData.voucher({ userUsageLimit: 1 }),
        }),
      ]

      mockPrismaService.userVoucher.count
        .mockResolvedValueOnce(5) // collected
        .mockResolvedValueOnce(2) // used
        .mockResolvedValueOnce(1) // expired
      mockPrismaService.userVoucher.findMany.mockResolvedValue(mockUserVouchers)
      mockPrismaService.voucher.count.mockResolvedValue(10)

      // Act - Thực hiện lấy stats
      const result = await repository.getUserVoucherStats(userId)

      // Assert - Kiểm tra kết quả
      expect(result).toEqual({
        totalVouchers: 10,
        collectedVouchers: 5,
        usedVouchers: 2,
        activeVouchers: 1,
      })
    })
  })

  describe('getVoucherStats', () => {
    it('should get voucher stats without sellerId', async () => {
      // Arrange - Chuẩn bị dữ liệu cho admin
      mockPrismaService.voucher.count
        .mockResolvedValueOnce(10) // total
        .mockResolvedValueOnce(8) // active
        .mockResolvedValueOnce(5) // used

      // Act - Thực hiện lấy stats
      const result = await repository.getVoucherStats()

      // Assert - Kiểm tra kết quả
      expect(result).toEqual({
        totalVouchers: 10,
        activeVouchers: 8,
        usedVouchers: 5,
        collectedVouchers: 0,
      })
    })

    it('should get voucher stats with sellerId', async () => {
      // Arrange - Chuẩn bị dữ liệu cho seller
      const sellerId = 2

      mockPrismaService.voucher.count
        .mockResolvedValueOnce(5) // total
        .mockResolvedValueOnce(4) // active
        .mockResolvedValueOnce(2) // used

      // Act - Thực hiện lấy stats
      const result = await repository.getVoucherStats(sellerId)

      // Assert - Kiểm tra kết quả
      expect(result).toEqual({
        totalVouchers: 5,
        activeVouchers: 4,
        usedVouchers: 2,
        collectedVouchers: 0,
      })
      expect(mockPrismaService.voucher.count).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ sellerId }),
        }),
      )
    })
  })
})
