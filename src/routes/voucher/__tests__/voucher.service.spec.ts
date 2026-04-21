import { Test, TestingModule } from '@nestjs/testing'
import { HttpException } from '@nestjs/common'
import { VoucherService } from '../voucher.service'
import { VoucherRepository } from '../voucher.repo'
import { VOUCHER_ERRORS } from '../voucher.error'
import {
  CreateVoucherBody,
  UpdateVoucherBody,
  ListVouchersQuery,
  ListAvailableVouchersQuery,
  ListMyVouchersQuery,
  ApplyVoucherBody,
} from '../voucher.dto'
import { VoucherType } from '../voucher.model'

// Test data factory để tạo dữ liệu test
const createTestData = {
  createVoucherBody: (overrides = {}): CreateVoucherBody => ({
    code: 'SUMMER2024',
    name: 'Summer Sale',
    description: 'Summer sale voucher',
    type: 'PERCENTAGE' as VoucherType,
    value: 20,
    minOrderValue: 100000,
    maxDiscount: 50000,
    usageLimit: 100,
    userUsageLimit: 1,
    startDate: new Date(Date.now() + 86400000).toISOString(), // Tomorrow
    endDate: new Date(Date.now() + 7 * 86400000).toISOString(), // Next week
    isActive: true,
    applicableProducts: [1, 2, 3],
    excludedProducts: [4, 5],
    ...overrides,
  }),

  updateVoucherBody: (overrides = {}): UpdateVoucherBody => ({
    name: 'Updated Summer Sale',
    description: 'Updated description',
    isActive: false,
    ...overrides,
  }),

  listVouchersQuery: (overrides = {}): ListVouchersQuery => ({
    page: 1,
    limit: 10,
    ...overrides,
  }),

  listAvailableVouchersQuery: (overrides = {}): ListAvailableVouchersQuery => ({
    page: 1,
    limit: 10,
    ...overrides,
  }),

  listMyVouchersQuery: (overrides = {}): ListMyVouchersQuery => ({
    page: 1,
    limit: 10,
    ...overrides,
  }),

  applyVoucherBody: (overrides = {}): ApplyVoucherBody => ({
    code: 'SUMMER2024',
    orderAmount: 200000,
    productIds: [1, 2, 3],
    ...overrides,
  }),

  voucherResponse: (overrides = {}) => ({
    id: 1,
    code: 'SUMMER2024',
    name: 'Summer Sale',
    description: 'Summer sale voucher',
    type: 'PERCENTAGE' as VoucherType,
    value: 20,
    minOrderValue: 100000,
    maxDiscount: 50000,
    usageLimit: 100,
    usedCount: 0,
    userUsageLimit: 1,
    startDate: new Date(Date.now() + 86400000),
    endDate: new Date(Date.now() + 7 * 86400000),
    isActive: true,
    sellerId: null,
    applicableProducts: [1, 2, 3],
    excludedProducts: [4, 5],
    createdById: null,
    updatedById: null,
    deletedById: null,
    deletedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }),

  voucherListResponse: (overrides = {}) => ({
    data: [
      {
        id: 1,
        code: 'SUMMER2024',
        name: 'Summer Sale',
        description: 'Summer sale voucher',
        type: 'PERCENTAGE' as VoucherType,
        value: 20,
        minOrderValue: 100000,
        maxDiscount: 50000,
        usageLimit: 100,
        usedCount: 0,
        userUsageLimit: 1,
        startDate: new Date(Date.now() + 86400000),
        endDate: new Date(Date.now() + 7 * 86400000),
        isActive: true,
        sellerId: null,
        applicableProducts: [1, 2, 3],
        excludedProducts: [4, 5],
        createdById: null,
        updatedById: null,
        deletedById: null,
        deletedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ],
    page: 1,
    limit: 10,
    total: 1,
    ...overrides,
  }),

  userVoucherResponse: (overrides = {}) => ({
    id: 1,
    userId: 1,
    voucherId: 1,
    usedCount: 0,
    usedAt: null,
    savedAt: new Date(),
    voucher: createTestData.voucherResponse(),
    ...overrides,
  }),

  voucherApplicationResult: (overrides = {}) => ({
    canApply: true,
    discountAmount: 40000, // 20% của 200000
    voucher: createTestData.voucherResponse(),
    reason: undefined,
    ...overrides,
  }),

  voucherStatsResponse: (overrides = {}) => ({
    totalVouchers: 10,
    activeVouchers: 8,
    collectedVouchers: 5,
    usedVouchers: 2,
    ...overrides,
  }),
}

describe('VoucherService', () => {
  let service: VoucherService
  let module: TestingModule
  let mockVoucherRepository: jest.Mocked<VoucherRepository>

  beforeEach(async () => {
    // Tạo mock cho VoucherRepository với tất cả methods cần thiết
    mockVoucherRepository = {
      // Management methods
      isCodeExists: jest.fn(),
      create: jest.fn(),
      findById: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      findMany: jest.fn(),

      // Public methods
      findAvailable: jest.fn(),
      findByCode: jest.fn(),

      // User methods
      isVoucherCollected: jest.fn(),
      collectVoucher: jest.fn(),
      findMyVouchers: jest.fn(),
      findUserVoucher: jest.fn(),
      canApplyVoucher: jest.fn(),
      useVoucher: jest.fn(),

      // Stats methods
      getUserVoucherStats: jest.fn(),
      getVoucherStats: jest.fn(),
    } as any

    module = await Test.createTestingModule({
      providers: [VoucherService, { provide: VoucherRepository, useValue: mockVoucherRepository }],
    }).compile()

    service = module.get<VoucherService>(VoucherService)
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

  describe('createVoucher', () => {
    it('should create voucher successfully', async () => {
      // Arrange - Chuẩn bị dữ liệu test
      const data = createTestData.createVoucherBody()
      const createdById = 1
      const sellerId = undefined
      const mockVoucherResponse = createTestData.voucherResponse()

      mockVoucherRepository.isCodeExists.mockResolvedValue(false)
      mockVoucherRepository.create.mockResolvedValue(mockVoucherResponse)

      // Act - Thực hiện tạo voucher
      const result = await service.createVoucher(data, createdById, sellerId)

      // Assert - Kiểm tra kết quả
      expect(result).toEqual(
        expect.objectContaining({
          id: mockVoucherResponse.id,
          code: mockVoucherResponse.code,
          name: mockVoucherResponse.name,
          type: mockVoucherResponse.type,
          value: mockVoucherResponse.value,
        }),
      )
      expect(mockVoucherRepository.isCodeExists).toHaveBeenCalledWith(data.code)
      expect(mockVoucherRepository.create).toHaveBeenCalledWith(data, createdById, sellerId)
    })

    it('should throw error when voucher code already exists', async () => {
      // Arrange - Chuẩn bị dữ liệu test với code đã tồn tại
      const data = createTestData.createVoucherBody()
      const createdById = 1

      mockVoucherRepository.isCodeExists.mockResolvedValue(true)

      // Act & Assert - Thực hiện test và kiểm tra lỗi
      await expect(service.createVoucher(data, createdById)).rejects.toThrow(
        new HttpException(VOUCHER_ERRORS.VOUCHER_CODE_EXISTS, 400),
      )
      expect(mockVoucherRepository.isCodeExists).toHaveBeenCalledWith(data.code)
      expect(mockVoucherRepository.create).not.toHaveBeenCalled()
    })

    it('should throw error for invalid voucher dates', async () => {
      // Arrange - Chuẩn bị dữ liệu test với dates không hợp lệ
      const data = createTestData.createVoucherBody({
        startDate: new Date(Date.now() + 7 * 86400000), // Next week
        endDate: new Date(Date.now() + 86400000), // Tomorrow (before start date)
      })
      const createdById = 1

      mockVoucherRepository.isCodeExists.mockResolvedValue(false)

      // Act & Assert - Thực hiện test và kiểm tra lỗi
      await expect(service.createVoucher(data, createdById)).rejects.toThrow(
        new HttpException(VOUCHER_ERRORS.INVALID_VOUCHER_DATES, 400),
      )
      expect(mockVoucherRepository.create).not.toHaveBeenCalled()
    })

    it('should throw error for invalid percentage value', async () => {
      // Arrange - Chuẩn bị dữ liệu test với percentage value không hợp lệ
      const invalidValues = [0, -10, 101, 150]

      for (const value of invalidValues) {
        const data = createTestData.createVoucherBody({
          type: 'PERCENTAGE' as VoucherType,
          value,
        })
        const createdById = 1

        mockVoucherRepository.isCodeExists.mockResolvedValue(false)

        // Act & Assert - Thực hiện test và kiểm tra lỗi
        await expect(service.createVoucher(data, createdById)).rejects.toThrow(
          new HttpException(VOUCHER_ERRORS.INVALID_PERCENTAGE_VALUE, 400),
        )

        // Reset mock for next iteration
        mockVoucherRepository.isCodeExists.mockReset()
      }
    })

    it('should throw error for invalid voucher value', async () => {
      // Arrange - Chuẩn bị dữ liệu test với voucher value không hợp lệ
      const invalidValues = [0, -1000]

      for (const value of invalidValues) {
        const data = createTestData.createVoucherBody({
          type: 'FIXED_AMOUNT' as VoucherType,
          value,
        })
        const createdById = 1

        mockVoucherRepository.isCodeExists.mockResolvedValue(false)

        // Act & Assert - Thực hiện test và kiểm tra lỗi
        await expect(service.createVoucher(data, createdById)).rejects.toThrow(
          new HttpException(VOUCHER_ERRORS.INVALID_VOUCHER_VALUE, 400),
        )

        // Reset mock for next iteration
        mockVoucherRepository.isCodeExists.mockReset()
      }
    })

    it('should create voucher for seller', async () => {
      // Arrange - Chuẩn bị dữ liệu test cho seller
      const data = createTestData.createVoucherBody()
      const createdById = 1
      const sellerId = 1
      const mockVoucherResponse = createTestData.voucherResponse({ sellerId: 1 })

      mockVoucherRepository.isCodeExists.mockResolvedValue(false)
      mockVoucherRepository.create.mockResolvedValue(mockVoucherResponse)

      // Act - Thực hiện tạo voucher
      const result = await service.createVoucher(data, createdById, sellerId)

      // Assert - Kiểm tra kết quả
      expect(result.sellerId).toBe(sellerId)
      expect(mockVoucherRepository.create).toHaveBeenCalledWith(data, createdById, sellerId)
    })

    it('should create different voucher types successfully', async () => {
      // Arrange - Chuẩn bị test cho các loại voucher khác nhau
      const voucherTypes = [
        { type: 'PERCENTAGE' as VoucherType, value: 15 },
        { type: 'FIXED_AMOUNT' as VoucherType, value: 50000 },
        { type: 'FREE_SHIPPING' as VoucherType, value: 1 },
        { type: 'BUY_X_GET_Y' as VoucherType, value: 2 },
      ]

      for (const voucherType of voucherTypes) {
        const data = createTestData.createVoucherBody(voucherType)
        const createdById = 1
        const mockVoucherResponse = createTestData.voucherResponse(voucherType)

        mockVoucherRepository.isCodeExists.mockResolvedValue(false)
        mockVoucherRepository.create.mockResolvedValue(mockVoucherResponse)

        // Act - Thực hiện tạo voucher
        const result = await service.createVoucher(data, createdById)

        // Assert - Kiểm tra kết quả
        expect(result.type).toBe(voucherType.type)
        expect(result.value).toBe(voucherType.value)

        // Reset mocks for next iteration
        mockVoucherRepository.isCodeExists.mockReset()
        mockVoucherRepository.create.mockReset()
      }
    })
  })

  describe('updateVoucher', () => {
    it('should update voucher successfully', async () => {
      // Arrange - Chuẩn bị dữ liệu test
      const id = 1
      const data = createTestData.updateVoucherBody()
      const updatedById = 1
      const existingVoucher = createTestData.voucherResponse({ usedCount: 0 })
      const updatedVoucher = createTestData.voucherResponse({ ...data })

      mockVoucherRepository.findById.mockResolvedValue(existingVoucher)
      mockVoucherRepository.update.mockResolvedValue(updatedVoucher)

      // Act - Thực hiện cập nhật voucher
      const result = await service.updateVoucher(id, data, updatedById)

      // Assert - Kiểm tra kết quả
      expect(result).toEqual(
        expect.objectContaining({
          name: data.name,
          description: data.description,
          isActive: data.isActive,
        }),
      )
      expect(mockVoucherRepository.findById).toHaveBeenCalledWith(id)
      expect(mockVoucherRepository.update).toHaveBeenCalledWith(id, data, updatedById)
    })

    it('should throw error when voucher not found', async () => {
      // Arrange - Chuẩn bị dữ liệu test với voucher không tồn tại
      const id = 999
      const data = createTestData.updateVoucherBody()
      const updatedById = 1

      mockVoucherRepository.findById.mockResolvedValue(null)

      // Act & Assert - Thực hiện test và kiểm tra lỗi
      await expect(service.updateVoucher(id, data, updatedById)).rejects.toThrow(
        new HttpException(VOUCHER_ERRORS.VOUCHER_NOT_FOUND, 404),
      )
      expect(mockVoucherRepository.update).not.toHaveBeenCalled()
    })

    it('should throw error when trying to edit used voucher restricted fields', async () => {
      // Arrange - Chuẩn bị dữ liệu test với voucher đã được sử dụng
      const id = 1
      const data = {
        type: 'FIXED_AMOUNT' as VoucherType, // Restricted field
        value: 100000, // Restricted field
      }
      const updatedById = 1
      const existingVoucher = createTestData.voucherResponse({ usedCount: 5 }) // Already used

      mockVoucherRepository.findById.mockResolvedValue(existingVoucher)

      // Act & Assert - Thực hiện test và kiểm tra lỗi
      await expect(service.updateVoucher(id, data, updatedById)).rejects.toThrow(
        new HttpException(VOUCHER_ERRORS.CANNOT_EDIT_USED_VOUCHER, 400),
      )
      expect(mockVoucherRepository.update).not.toHaveBeenCalled()
    })

    it('should allow editing non-restricted fields of used voucher', async () => {
      // Arrange - Chuẩn bị dữ liệu test với voucher đã được sử dụng nhưng chỉ edit non-restricted fields
      const id = 1
      const data = {
        name: 'Updated Name',
        description: 'Updated Description',
        isActive: false,
      }
      const updatedById = 1
      const existingVoucher = createTestData.voucherResponse({ usedCount: 5 })
      const updatedVoucher = createTestData.voucherResponse({ ...data })

      mockVoucherRepository.findById.mockResolvedValue(existingVoucher)
      mockVoucherRepository.update.mockResolvedValue(updatedVoucher)

      // Act - Thực hiện cập nhật voucher
      const result = await service.updateVoucher(id, data, updatedById)

      // Assert - Kiểm tra kết quả
      expect(result).toEqual(expect.objectContaining(data))
      expect(mockVoucherRepository.update).toHaveBeenCalledWith(id, data, updatedById)
    })

    it('should throw access denied error when seller tries to edit other seller voucher', async () => {
      // Arrange - Chuẩn bị dữ liệu test với seller cố gắng edit voucher của seller khác
      const id = 1
      const data = createTestData.updateVoucherBody()
      const updatedById = 2
      const sellerId = 2
      const existingVoucher = createTestData.voucherResponse({ sellerId: 1 }) // Different seller

      mockVoucherRepository.findById.mockResolvedValue(existingVoucher)

      // Act & Assert - Thực hiện test và kiểm tra lỗi
      await expect(service.updateVoucher(id, data, updatedById, sellerId)).rejects.toThrow(
        new HttpException(VOUCHER_ERRORS.VOUCHER_ACCESS_DENIED, 403),
      )
      expect(mockVoucherRepository.update).not.toHaveBeenCalled()
    })
  })

  describe('deleteVoucher', () => {
    it('should delete voucher successfully', async () => {
      // Arrange - Chuẩn bị dữ liệu test
      const id = 1
      const deletedById = 1
      const existingVoucher = createTestData.voucherResponse({ usedCount: 0 })

      mockVoucherRepository.findById.mockResolvedValue(existingVoucher)
      mockVoucherRepository.delete.mockResolvedValue(existingVoucher)

      // Act - Thực hiện xóa voucher
      const result = await service.deleteVoucher(id, deletedById)

      // Assert - Kiểm tra kết quả
      expect(result).toEqual({ message: 'Xóa voucher thành công' })
      expect(mockVoucherRepository.findById).toHaveBeenCalledWith(id)
      expect(mockVoucherRepository.delete).toHaveBeenCalledWith(id, deletedById)
    })

    it('should throw error when voucher not found', async () => {
      // Arrange - Chuẩn bị dữ liệu test với voucher không tồn tại
      const id = 999
      const deletedById = 1

      mockVoucherRepository.findById.mockResolvedValue(null)

      // Act & Assert - Thực hiện test và kiểm tra lỗi
      await expect(service.deleteVoucher(id, deletedById)).rejects.toThrow(
        new HttpException(VOUCHER_ERRORS.VOUCHER_NOT_FOUND, 404),
      )
      expect(mockVoucherRepository.delete).not.toHaveBeenCalled()
    })

    it('should throw error when trying to delete used voucher', async () => {
      // Arrange - Chuẩn bị dữ liệu test với voucher đã được sử dụng
      const id = 1
      const deletedById = 1
      const existingVoucher = createTestData.voucherResponse({ usedCount: 5 })

      mockVoucherRepository.findById.mockResolvedValue(existingVoucher)

      // Act & Assert - Thực hiện test và kiểm tra lỗi
      await expect(service.deleteVoucher(id, deletedById)).rejects.toThrow(
        new HttpException(VOUCHER_ERRORS.CANNOT_DELETE_USED_VOUCHER, 400),
      )
      expect(mockVoucherRepository.delete).not.toHaveBeenCalled()
    })

    it('should throw access denied error when seller tries to delete other seller voucher', async () => {
      // Arrange - Chuẩn bị dữ liệu test với seller cố gắng xóa voucher của seller khác
      const id = 1
      const deletedById = 2
      const sellerId = 2
      const existingVoucher = createTestData.voucherResponse({ sellerId: 1, usedCount: 0 })

      mockVoucherRepository.findById.mockResolvedValue(existingVoucher)

      // Act & Assert - Thực hiện test và kiểm tra lỗi
      await expect(service.deleteVoucher(id, deletedById, sellerId)).rejects.toThrow(
        new HttpException(VOUCHER_ERRORS.VOUCHER_ACCESS_DENIED, 403),
      )
      expect(mockVoucherRepository.delete).not.toHaveBeenCalled()
    })
  })

  describe('getVouchers', () => {
    it('should get voucher list successfully', async () => {
      // Arrange - Chuẩn bị dữ liệu test
      const query = createTestData.listVouchersQuery()
      const mockVoucherListResponse = createTestData.voucherListResponse()

      mockVoucherRepository.findMany.mockResolvedValue(mockVoucherListResponse)

      // Act - Thực hiện lấy danh sách vouchers
      const result = await service.getVouchers(query)

      // Assert - Kiểm tra kết quả
      expect(result).toEqual({
        data: expect.arrayContaining([
          expect.objectContaining({
            id: 1,
            code: 'SUMMER2024',
            name: 'Summer Sale',
          }),
        ]),
        pagination: {
          page: 1,
          limit: 10,
          total: 1,
          totalPages: 1,
        },
      })
      expect(mockVoucherRepository.findMany).toHaveBeenCalledWith(query, undefined)
    })

    it('should get voucher list for specific seller', async () => {
      // Arrange - Chuẩn bị dữ liệu test cho seller specific
      const query = createTestData.listVouchersQuery()
      const sellerId = 1
      const mockVoucherListResponse = createTestData.voucherListResponse({
        data: [createTestData.voucherResponse({ sellerId: 1 })],
      })

      mockVoucherRepository.findMany.mockResolvedValue(mockVoucherListResponse)

      // Act - Thực hiện lấy danh sách vouchers
      const result = await service.getVouchers(query, sellerId)

      // Assert - Kiểm tra kết quả
      expect(result.data[0].sellerId).toBe(sellerId)
      expect(mockVoucherRepository.findMany).toHaveBeenCalledWith(query, sellerId)
    })
  })

  describe('collectVoucher', () => {
    it('should collect voucher successfully', async () => {
      // Arrange - Chuẩn bị dữ liệu test
      const userId = 1
      const voucherId = 1
      const existingVoucher = createTestData.voucherResponse({
        isActive: true,
        startDate: new Date(Date.now() - 86400000), // Yesterday (started)
        endDate: new Date(Date.now() + 7 * 86400000), // Next week (not expired)
        usageLimit: 100,
        usedCount: 50,
      })
      const mockUserVoucher = createTestData.userVoucherResponse()

      mockVoucherRepository.findById.mockResolvedValue(existingVoucher)
      mockVoucherRepository.isVoucherCollected.mockResolvedValue(false)
      mockVoucherRepository.collectVoucher.mockResolvedValue(mockUserVoucher)

      // Act - Thực hiện lưu voucher
      const result = await service.collectVoucher(userId, voucherId)

      // Assert - Kiểm tra kết quả
      expect(result).toEqual(
        expect.objectContaining({
          id: mockUserVoucher.id,
          userId: mockUserVoucher.userId,
          voucherId: mockUserVoucher.voucherId,
        }),
      )
      expect(mockVoucherRepository.findById).toHaveBeenCalledWith(voucherId)
      expect(mockVoucherRepository.isVoucherCollected).toHaveBeenCalledWith(userId, voucherId)
      expect(mockVoucherRepository.collectVoucher).toHaveBeenCalledWith(userId, voucherId)
    })

    it('should throw error when voucher not found', async () => {
      // Arrange - Chuẩn bị dữ liệu test với voucher không tồn tại
      const userId = 1
      const voucherId = 999

      mockVoucherRepository.findById.mockResolvedValue(null)

      // Act & Assert - Thực hiện test và kiểm tra lỗi
      await expect(service.collectVoucher(userId, voucherId)).rejects.toThrow(
        new HttpException(VOUCHER_ERRORS.VOUCHER_NOT_FOUND, 404),
      )
      expect(mockVoucherRepository.collectVoucher).not.toHaveBeenCalled()
    })

    it('should throw error when voucher is inactive', async () => {
      // Arrange - Chuẩn bị dữ liệu test với voucher không active
      const userId = 1
      const voucherId = 1
      const existingVoucher = createTestData.voucherResponse({ isActive: false })

      mockVoucherRepository.findById.mockResolvedValue(existingVoucher)

      // Act & Assert - Thực hiện test và kiểm tra lỗi
      await expect(service.collectVoucher(userId, voucherId)).rejects.toThrow(
        new HttpException(VOUCHER_ERRORS.VOUCHER_INACTIVE, 400),
      )
      expect(mockVoucherRepository.collectVoucher).not.toHaveBeenCalled()
    })

    it('should throw error when voucher not started yet', async () => {
      // Arrange - Chuẩn bị dữ liệu test với voucher chưa bắt đầu
      const userId = 1
      const voucherId = 1
      const existingVoucher = createTestData.voucherResponse({
        isActive: true,
        startDate: new Date(Date.now() + 86400000), // Tomorrow
      })

      mockVoucherRepository.findById.mockResolvedValue(existingVoucher)

      // Act & Assert - Thực hiện test và kiểm tra lỗi
      await expect(service.collectVoucher(userId, voucherId)).rejects.toThrow(
        new HttpException(VOUCHER_ERRORS.VOUCHER_NOT_STARTED, 400),
      )
      expect(mockVoucherRepository.collectVoucher).not.toHaveBeenCalled()
    })

    it('should throw error when voucher expired', async () => {
      // Arrange - Chuẩn bị dữ liệu test với voucher đã hết hạn
      const userId = 1
      const voucherId = 1
      const existingVoucher = createTestData.voucherResponse({
        isActive: true,
        startDate: new Date(Date.now() - 7 * 86400000), // Last week
        endDate: new Date(Date.now() - 86400000), // Yesterday
      })

      mockVoucherRepository.findById.mockResolvedValue(existingVoucher)

      // Act & Assert - Thực hiện test và kiểm tra lỗi
      await expect(service.collectVoucher(userId, voucherId)).rejects.toThrow(
        new HttpException(VOUCHER_ERRORS.VOUCHER_EXPIRED, 400),
      )
      expect(mockVoucherRepository.collectVoucher).not.toHaveBeenCalled()
    })

    it('should throw error when voucher already collected', async () => {
      // Arrange - Chuẩn bị dữ liệu test với voucher đã được lưu
      const userId = 1
      const voucherId = 1
      const existingVoucher = createTestData.voucherResponse({
        isActive: true,
        startDate: new Date(Date.now() - 86400000),
        endDate: new Date(Date.now() + 7 * 86400000),
      })

      mockVoucherRepository.findById.mockResolvedValue(existingVoucher)
      mockVoucherRepository.isVoucherCollected.mockResolvedValue(true)

      // Act & Assert - Thực hiện test và kiểm tra lỗi
      await expect(service.collectVoucher(userId, voucherId)).rejects.toThrow(
        new HttpException(VOUCHER_ERRORS.VOUCHER_ALREADY_COLLECTED, 400),
      )
      expect(mockVoucherRepository.collectVoucher).not.toHaveBeenCalled()
    })

    it('should throw error when voucher usage limit exceeded', async () => {
      // Arrange - Chuẩn bị dữ liệu test với voucher đã hết lượt sử dụng
      const userId = 1
      const voucherId = 1
      const existingVoucher = createTestData.voucherResponse({
        isActive: true,
        startDate: new Date(Date.now() - 86400000),
        endDate: new Date(Date.now() + 7 * 86400000),
        usageLimit: 100,
        usedCount: 100, // Đã hết lượt
      })

      mockVoucherRepository.findById.mockResolvedValue(existingVoucher)
      mockVoucherRepository.isVoucherCollected.mockResolvedValue(false)

      // Act & Assert - Thực hiện test và kiểm tra lỗi
      await expect(service.collectVoucher(userId, voucherId)).rejects.toThrow(
        new HttpException(VOUCHER_ERRORS.VOUCHER_USAGE_LIMIT_EXCEEDED, 400),
      )
      expect(mockVoucherRepository.collectVoucher).not.toHaveBeenCalled()
    })
  })

  describe('applyVoucher', () => {
    it('should apply voucher successfully', async () => {
      // Arrange - Chuẩn bị dữ liệu test
      const userId = 1
      const data = createTestData.applyVoucherBody()
      const mockApplicationResult = createTestData.voucherApplicationResult()

      mockVoucherRepository.canApplyVoucher.mockResolvedValue(mockApplicationResult)

      // Act - Thực hiện áp dụng voucher
      const result = await service.applyVoucher(userId, data)

      // Assert - Kiểm tra kết quả
      expect(result).toEqual(mockApplicationResult)
      expect(mockVoucherRepository.canApplyVoucher).toHaveBeenCalledWith(
        userId,
        data.code,
        data.orderAmount,
        data.productIds,
      )
    })

    it('should return cannot apply result when conditions not met', async () => {
      // Arrange - Chuẩn bị dữ liệu test khi không thể áp dụng
      const userId = 1
      const data = createTestData.applyVoucherBody()
      const mockApplicationResult = createTestData.voucherApplicationResult({
        canApply: false,
        discountAmount: 0,
        reason: 'Order value too low',
      })

      mockVoucherRepository.canApplyVoucher.mockResolvedValue(mockApplicationResult)

      // Act - Thực hiện áp dụng voucher
      const result = await service.applyVoucher(userId, data)

      // Assert - Kiểm tra kết quả
      expect(result).toEqual(mockApplicationResult)
      expect(result.canApply).toBe(false)
      expect(result.discountAmount).toBe(0)
    })
  })

  describe('getMyVouchers', () => {
    it('should get user vouchers successfully', async () => {
      // Arrange - Chuẩn bị dữ liệu test
      const userId = 1
      const query = createTestData.listMyVouchersQuery()
      const mockMyVouchersResponse = {
        data: [createTestData.userVoucherResponse()],
        page: 1,
        limit: 10,
        total: 1,
      }

      mockVoucherRepository.findMyVouchers.mockResolvedValue(mockMyVouchersResponse)

      // Act - Thực hiện lấy danh sách voucher của user
      const result = await service.getMyVouchers(userId, query)

      // Assert - Kiểm tra kết quả
      expect(result).toEqual({
        data: expect.arrayContaining([
          expect.objectContaining({
            id: 1,
            userId: 1,
            voucherId: 1,
          }),
        ]),
        pagination: {
          page: 1,
          limit: 10,
          total: 1,
          totalPages: 1,
        },
      })
      expect(mockVoucherRepository.findMyVouchers).toHaveBeenCalledWith(userId, query)
    })
  })

  describe('useVoucher', () => {
    it('should use voucher successfully', async () => {
      // Arrange - Chuẩn bị dữ liệu test
      const userId = 1
      const voucherId = 1

      mockVoucherRepository.useVoucher.mockResolvedValue(undefined)

      // Act - Thực hiện sử dụng voucher
      await service.useVoucher(userId, voucherId)

      // Assert - Kiểm tra không có lỗi và method được gọi
      expect(mockVoucherRepository.useVoucher).toHaveBeenCalledWith(userId, voucherId)
    })
  })

  describe('getUserVoucherStats', () => {
    it('should get user voucher stats successfully', async () => {
      // Arrange - Chuẩn bị dữ liệu test
      const userId = 1
      const mockStatsResponse = createTestData.voucherStatsResponse()

      mockVoucherRepository.getUserVoucherStats.mockResolvedValue(mockStatsResponse)

      // Act - Thực hiện lấy stats
      const result = await service.getUserVoucherStats(userId)

      // Assert - Kiểm tra kết quả
      expect(result).toEqual(mockStatsResponse)
      expect(mockVoucherRepository.getUserVoucherStats).toHaveBeenCalledWith(userId)
    })
  })

  describe('getVoucherStats', () => {
    it('should get voucher stats successfully', async () => {
      // Arrange - Chuẩn bị dữ liệu test
      const mockStatsResponse = createTestData.voucherStatsResponse()

      mockVoucherRepository.getVoucherStats.mockResolvedValue(mockStatsResponse)

      // Act - Thực hiện lấy stats
      const result = await service.getVoucherStats()

      // Assert - Kiểm tra kết quả
      expect(result).toEqual(mockStatsResponse)
      expect(mockVoucherRepository.getVoucherStats).toHaveBeenCalledWith(undefined)
    })

    it('should get voucher stats for specific seller', async () => {
      // Arrange - Chuẩn bị dữ liệu test cho seller
      const sellerId = 1
      const mockStatsResponse = createTestData.voucherStatsResponse()

      mockVoucherRepository.getVoucherStats.mockResolvedValue(mockStatsResponse)

      // Act - Thực hiện lấy stats
      const result = await service.getVoucherStats(sellerId)

      // Assert - Kiểm tra kết quả
      expect(result).toEqual(mockStatsResponse)
      expect(mockVoucherRepository.getVoucherStats).toHaveBeenCalledWith(sellerId)
    })
  })

  describe('getAvailableVouchers', () => {
    it('should get available vouchers successfully', async () => {
      // Arrange - Chuẩn bị dữ liệu test
      const query = createTestData.listAvailableVouchersQuery()
      const userId = 1
      const mockAvailableVouchersResponse = {
        data: [
          {
            ...createTestData.voucherResponse(),
            userVouchers: [
              {
                id: 1,
                userId: 1,
                voucherId: 1,
                usedCount: 0,
                usedAt: null,
                savedAt: new Date(),
              },
            ],
          },
        ],
        page: 1,
        limit: 10,
        total: 1,
      }

      mockVoucherRepository.findAvailable.mockResolvedValue(mockAvailableVouchersResponse)

      // Act - Thực hiện lấy vouchers available
      const result = await service.getAvailableVouchers(query, userId)

      // Assert - Kiểm tra kết quả
      expect(result).toEqual({
        data: expect.arrayContaining([
          expect.objectContaining({
            id: 1,
            code: 'SUMMER2024',
            isCollected: true,
            canApply: true,
          }),
        ]),
        pagination: {
          page: 1,
          limit: 10,
          total: 1,
          totalPages: 1,
        },
      })
      expect(mockVoucherRepository.findAvailable).toHaveBeenCalledWith(query, userId)
    })

    it('should get available vouchers without user (public)', async () => {
      // Arrange - Chuẩn bị dữ liệu test không có user
      const query = createTestData.listAvailableVouchersQuery()
      const mockAvailableVouchersResponse = {
        data: [
          {
            ...createTestData.voucherResponse(),
            userVouchers: [],
          },
        ],
        page: 1,
        limit: 10,
        total: 1,
      }

      mockVoucherRepository.findAvailable.mockResolvedValue(mockAvailableVouchersResponse)

      // Act - Thực hiện lấy vouchers available
      const result = await service.getAvailableVouchers(query)

      // Assert - Kiểm tra kết quả
      expect(result).toEqual({
        data: expect.arrayContaining([
          expect.objectContaining({
            id: 1,
            code: 'SUMMER2024',
            isCollected: false,
            canApply: false,
            userVoucher: null,
          }),
        ]),
        pagination: {
          page: 1,
          limit: 10,
          total: 1,
          totalPages: 1,
        },
      })
      expect(mockVoucherRepository.findAvailable).toHaveBeenCalledWith(query, undefined)
    })
  })

  describe('getVoucherDetail', () => {
    it('should get voucher detail successfully', async () => {
      // Arrange - Chuẩn bị dữ liệu test
      const id = 1
      const userId = 1
      const mockVoucher = createTestData.voucherResponse()
      const mockUserVoucher = {
        id: 1,
        userId: 1,
        voucherId: 1,
        usedCount: 0,
        usedAt: null,
        savedAt: new Date(),
        voucher: mockVoucher,
      }

      mockVoucherRepository.findById.mockResolvedValue(mockVoucher)
      mockVoucherRepository.findUserVoucher.mockResolvedValue(mockUserVoucher)

      // Act - Thực hiện lấy chi tiết voucher
      const result = await service.getVoucherDetail(id, userId)

      // Assert - Kiểm tra kết quả
      expect(result).toEqual(
        expect.objectContaining({
          id: 1,
          code: 'SUMMER2024',
          isCollected: true,
          canApply: true,
          userVoucher: expect.objectContaining({
            usedCount: 0,
            canUse: true,
          }),
        }),
      )
      expect(mockVoucherRepository.findById).toHaveBeenCalledWith(id)
      expect(mockVoucherRepository.findUserVoucher).toHaveBeenCalledWith(userId, id)
    })

    it('should throw error when voucher not found', async () => {
      // Arrange - Chuẩn bị dữ liệu test với voucher không tồn tại
      const id = 999
      const userId = 1

      mockVoucherRepository.findById.mockResolvedValue(null)

      // Act & Assert - Thực hiện test và kiểm tra lỗi
      await expect(service.getVoucherDetail(id, userId)).rejects.toThrow(
        new HttpException(VOUCHER_ERRORS.VOUCHER_NOT_FOUND, 404),
      )
      expect(mockVoucherRepository.findUserVoucher).not.toHaveBeenCalled()
    })
  })

  describe('getVoucherByCode', () => {
    it('should get voucher by code successfully', async () => {
      // Arrange - Chuẩn bị dữ liệu test
      const code = 'SUMMER2024'
      const userId = 1
      const mockVoucher = createTestData.voucherResponse()

      // Mock the getVoucherDetail method indirectly
      mockVoucherRepository.findByCode.mockResolvedValue(mockVoucher)
      mockVoucherRepository.findById.mockResolvedValue(mockVoucher)
      mockVoucherRepository.findUserVoucher.mockResolvedValue(null)

      // Act - Thực hiện lấy voucher theo code
      const result = await service.getVoucherByCode(code, userId)

      // Assert - Kiểm tra kết quả
      expect(result).toEqual(
        expect.objectContaining({
          id: 1,
          code: 'SUMMER2024',
          isCollected: false,
          canApply: false,
        }),
      )
      expect(mockVoucherRepository.findByCode).toHaveBeenCalledWith(code)
    })

    it('should throw error when voucher code not found', async () => {
      // Arrange - Chuẩn bị dữ liệu test với code không tồn tại
      const code = 'NOTFOUND'
      const userId = 1

      mockVoucherRepository.findByCode.mockResolvedValue(null)

      // Act & Assert - Thực hiện test và kiểm tra lỗi
      await expect(service.getVoucherByCode(code, userId)).rejects.toThrow(
        new HttpException(VOUCHER_ERRORS.VOUCHER_CODE_NOT_FOUND, 404),
      )
    })
  })
})
