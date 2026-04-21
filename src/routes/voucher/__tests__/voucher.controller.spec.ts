import { Test, TestingModule } from '@nestjs/testing'
import { VoucherController } from '../voucher.controller'
import {
  ApplyVoucherBody,
  CollectVoucherParams,
  CreateVoucherBody,
  DeleteVoucherParams,
  GetVoucherByCodeParams,
  GetVoucherDetailParams,
  ListAvailableVouchersQuery,
  ListMyVouchersQuery,
  ListVouchersQuery,
  UpdateVoucherBody,
  UpdateVoucherParams,
} from '../voucher.dto'
import { VoucherType } from '../voucher.model'
import { VoucherService } from '../voucher.service'

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
    startDate: new Date(Date.now() + 86400000).toISOString(),
    endDate: new Date(Date.now() + 7 * 86400000).toISOString(),
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

  updateVoucherParams: (overrides = {}): UpdateVoucherParams => ({
    id: 1,
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

  getVoucherDetailParams: (overrides = {}): GetVoucherDetailParams => ({
    id: 1,
    ...overrides,
  }),

  getVoucherByCodeParams: (overrides = {}): GetVoucherByCodeParams => ({
    code: 'SUMMER2024',
    ...overrides,
  }),

  collectVoucherParams: (overrides = {}): CollectVoucherParams => ({
    id: 1,
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

  deleteVoucherParams: (overrides = {}): DeleteVoucherParams => ({
    id: 1,
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
    startDate: new Date(Date.now() + 86400000).toISOString(),
    endDate: new Date(Date.now() + 7 * 86400000).toISOString(),
    isActive: true,
    sellerId: null,
    applicableProducts: [1, 2, 3],
    excludedProducts: [4, 5],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  }),

  voucherListResponse: (overrides = {}) => ({
    data: [createTestData.voucherResponse()],
    pagination: {
      page: 1,
      limit: 10,
      total: 1,
      totalPages: 1,
    },
    ...overrides,
  }),

  availableVoucherListResponse: (overrides = {}) => ({
    data: [
      {
        ...createTestData.voucherResponse(),
        userVoucher: null,
        isCollected: false,
        canApply: false,
      },
    ],
    pagination: {
      page: 1,
      limit: 10,
      total: 1,
      totalPages: 1,
    },
    ...overrides,
  }),

  voucherWithUserInfoResponse: (overrides = {}) => ({
    ...createTestData.voucherResponse(),
    userVoucher: {
      usedCount: 0,
      savedAt: new Date().toISOString(),
      canUse: true,
    },
    isCollected: true,
    canApply: true,
    ...overrides,
  }),

  userVoucherResponse: (overrides = {}) => ({
    id: 1,
    userId: 1,
    voucherId: 1,
    usedCount: 0,
    usedAt: null,
    savedAt: new Date().toISOString(),
    voucher: createTestData.voucherResponse(),
    ...overrides,
  }),

  myVoucherListResponse: (overrides = {}) => ({
    data: [createTestData.userVoucherResponse()],
    pagination: {
      page: 1,
      limit: 10,
      total: 1,
      totalPages: 1,
    },
    ...overrides,
  }),

  voucherApplicationResult: (overrides = {}) => ({
    canApply: true,
    discountAmount: 40000,
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

describe('VoucherController', () => {
  let controller: VoucherController
  let module: TestingModule
  let mockVoucherService: jest.Mocked<VoucherService>

  beforeEach(async () => {
    // Tạo mock cho VoucherService với tất cả methods cần thiết
    mockVoucherService = {
      // Management methods
      createVoucher: jest.fn(),
      updateVoucher: jest.fn(),
      deleteVoucher: jest.fn(),
      getVouchers: jest.fn(),
      getVoucherStats: jest.fn(),

      // Public methods
      getAvailableVouchers: jest.fn(),
      getVoucherDetail: jest.fn(),
      getVoucherByCode: jest.fn(),

      // User methods
      collectVoucher: jest.fn(),
      getMyVouchers: jest.fn(),
      applyVoucher: jest.fn(),
      getUserVoucherStats: jest.fn(),

      // Other methods (not used in controller but might exist in service)
      useVoucher: jest.fn(),
    } as any

    module = await Test.createTestingModule({
      controllers: [VoucherController],
      providers: [{ provide: VoucherService, useValue: mockVoucherService }],
    }).compile()

    controller = module.get<VoucherController>(VoucherController)
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

  describe('PUBLIC ENDPOINTS', () => {
    describe('getAvailableVouchers', () => {
      it('should return available vouchers successfully without user', async () => {
        // Arrange - Chuẩn bị dữ liệu test
        const query = createTestData.listAvailableVouchersQuery()
        const mockResponse = createTestData.availableVoucherListResponse()

        mockVoucherService.getAvailableVouchers.mockResolvedValue(mockResponse)

        // Act - Thực hiện gọi controller
        const result = await controller.getAvailableVouchers(query, undefined)

        // Assert - Kiểm tra kết quả
        expect(result).toEqual({
          data: mockResponse.data,
          pagination: mockResponse.pagination,
        })
        expect(mockVoucherService.getAvailableVouchers).toHaveBeenCalledWith(query, undefined)
      })

      it('should return available vouchers successfully with user', async () => {
        // Arrange - Chuẩn bị dữ liệu test với user
        const query = createTestData.listAvailableVouchersQuery()
        const userId = 1
        const mockResponse = createTestData.availableVoucherListResponse({
          data: [
            {
              ...createTestData.voucherResponse(),
              userVoucher: {
                usedCount: 0,
                savedAt: new Date().toISOString(),
                canUse: true,
              },
              isCollected: true,
              canApply: true,
            },
          ],
        })

        mockVoucherService.getAvailableVouchers.mockResolvedValue(mockResponse)

        // Act - Thực hiện gọi controller
        const result = await controller.getAvailableVouchers(query, userId)

        // Assert - Kiểm tra kết quả
        expect(result).toEqual({
          data: mockResponse.data,
          pagination: mockResponse.pagination,
        })
        expect(mockVoucherService.getAvailableVouchers).toHaveBeenCalledWith(query, userId)
      })

      it('should handle different pagination parameters', async () => {
        // Arrange - Chuẩn bị dữ liệu test với pagination khác
        const query = createTestData.listAvailableVouchersQuery({
          page: 2,
          limit: 5,
        })
        const mockResponse = createTestData.availableVoucherListResponse({
          pagination: {
            page: 2,
            limit: 5,
            total: 10,
            totalPages: 2,
          },
        })

        mockVoucherService.getAvailableVouchers.mockResolvedValue(mockResponse)

        // Act - Thực hiện gọi controller
        const result = await controller.getAvailableVouchers(query)

        // Assert - Kiểm tra kết quả
        expect(result.pagination.page).toBe(2)
        expect(result.pagination.limit).toBe(5)
      })
    })

    describe('getVoucherByCode', () => {
      it('should return voucher by code successfully without user', async () => {
        // Arrange - Chuẩn bị dữ liệu test
        const params = createTestData.getVoucherByCodeParams()
        const mockResponse = createTestData.voucherWithUserInfoResponse({
          userVoucher: null,
          isCollected: false,
          canApply: false,
        })

        mockVoucherService.getVoucherByCode.mockResolvedValue(mockResponse)

        // Act - Thực hiện gọi controller
        const result = await controller.getVoucherByCode(params, undefined)

        // Assert - Kiểm tra kết quả
        expect(result).toEqual({ data: mockResponse })
        expect(mockVoucherService.getVoucherByCode).toHaveBeenCalledWith(params.code, undefined)
      })

      it('should return voucher by code successfully with user', async () => {
        // Arrange - Chuẩn bị dữ liệu test với user
        const params = createTestData.getVoucherByCodeParams()
        const userId = 1
        const mockResponse = createTestData.voucherWithUserInfoResponse()

        mockVoucherService.getVoucherByCode.mockResolvedValue(mockResponse)

        // Act - Thực hiện gọi controller
        const result = await controller.getVoucherByCode(params, userId)

        // Assert - Kiểm tra kết quả
        expect(result).toEqual({ data: mockResponse })
        expect(result.data.isCollected).toBe(true)
        expect(result.data.canApply).toBe(true)
        expect(mockVoucherService.getVoucherByCode).toHaveBeenCalledWith(params.code, userId)
      })

      it('should handle different voucher codes', async () => {
        // Arrange - Chuẩn bị test với codes khác nhau
        const codes = ['SUMMER2024', 'WINTER2024', 'NEWYEAR2025']

        for (const code of codes) {
          const params = createTestData.getVoucherByCodeParams({ code })
          const mockResponse = createTestData.voucherWithUserInfoResponse({ code })

          mockVoucherService.getVoucherByCode.mockResolvedValue(mockResponse)

          // Act - Thực hiện gọi controller
          const result = await controller.getVoucherByCode(params)

          // Assert - Kiểm tra kết quả
          expect(result.data.code).toBe(code)
          expect(mockVoucherService.getVoucherByCode).toHaveBeenCalledWith(code, undefined)

          // Reset mock for next iteration
          mockVoucherService.getVoucherByCode.mockReset()
        }
      })
    })
  })

  describe('USER AUTHENTICATED ENDPOINTS', () => {
    describe('collectVoucher', () => {
      it('should collect voucher successfully', async () => {
        // Arrange - Chuẩn bị dữ liệu test
        const userId = 1
        const params = createTestData.collectVoucherParams()
        const mockResponse = createTestData.userVoucherResponse()

        mockVoucherService.collectVoucher.mockResolvedValue(mockResponse)

        // Act - Thực hiện gọi controller
        const result = await controller.collectVoucher(userId, params)

        // Assert - Kiểm tra kết quả
        expect(result).toEqual({ data: mockResponse })
        expect(mockVoucherService.collectVoucher).toHaveBeenCalledWith(userId, params.id)
      })

      it('should handle different voucher IDs', async () => {
        // Arrange - Chuẩn bị test với voucher IDs khác nhau
        const userId = 1
        const voucherIds = [1, 5, 10, 99]

        for (const voucherId of voucherIds) {
          const params = createTestData.collectVoucherParams({ id: voucherId })
          const mockResponse = createTestData.userVoucherResponse({ voucherId })

          mockVoucherService.collectVoucher.mockResolvedValue(mockResponse)

          // Act - Thực hiện gọi controller
          const result = await controller.collectVoucher(userId, params)

          // Assert - Kiểm tra kết quả
          expect(result.data.voucherId).toBe(voucherId)
          expect(mockVoucherService.collectVoucher).toHaveBeenCalledWith(userId, voucherId)

          // Reset mock for next iteration
          mockVoucherService.collectVoucher.mockReset()
        }
      })
    })

    describe('getMyVouchers', () => {
      it('should return my vouchers successfully', async () => {
        // Arrange - Chuẩn bị dữ liệu test
        const userId = 1
        const query = createTestData.listMyVouchersQuery()
        const mockResponse = createTestData.myVoucherListResponse()

        mockVoucherService.getMyVouchers.mockResolvedValue(mockResponse)

        // Act - Thực hiện gọi controller
        const result = await controller.getMyVouchers(userId, query)

        // Assert - Kiểm tra kết quả
        expect(result).toEqual({
          data: mockResponse.data,
          pagination: mockResponse.pagination,
        })
        expect(mockVoucherService.getMyVouchers).toHaveBeenCalledWith(userId, query)
      })

      it('should handle different pagination in my vouchers', async () => {
        // Arrange - Chuẩn bị dữ liệu test với pagination khác
        const userId = 1
        const query = createTestData.listMyVouchersQuery({
          page: 3,
          limit: 20,
        })
        const mockResponse = createTestData.myVoucherListResponse({
          pagination: {
            page: 3,
            limit: 20,
            total: 100,
            totalPages: 5,
          },
        })

        mockVoucherService.getMyVouchers.mockResolvedValue(mockResponse)

        // Act - Thực hiện gọi controller
        const result = await controller.getMyVouchers(userId, query)

        // Assert - Kiểm tra kết quả
        expect(result.pagination.page).toBe(3)
        expect(result.pagination.limit).toBe(20)
        expect(result.pagination.totalPages).toBe(5)
      })
    })

    describe('applyVoucher', () => {
      it('should apply voucher successfully', async () => {
        // Arrange - Chuẩn bị dữ liệu test
        const userId = 1
        const body = createTestData.applyVoucherBody()
        const mockResponse = createTestData.voucherApplicationResult()

        mockVoucherService.applyVoucher.mockResolvedValue(mockResponse)

        // Act - Thực hiện gọi controller
        const result = await controller.applyVoucher(userId, body)

        // Assert - Kiểm tra kết quả
        expect(result).toEqual({ data: mockResponse })
        expect(mockVoucherService.applyVoucher).toHaveBeenCalledWith(userId, body)
      })

      it('should handle voucher that cannot be applied', async () => {
        // Arrange - Chuẩn bị dữ liệu test khi không thể áp dụng voucher
        const userId = 1
        const body = createTestData.applyVoucherBody({ orderAmount: 50000 }) // Too low
        const mockResponse = createTestData.voucherApplicationResult({
          canApply: false,
          discountAmount: 0,
          reason: 'Order value too low',
        })

        mockVoucherService.applyVoucher.mockResolvedValue(mockResponse)

        // Act - Thực hiện gọi controller
        const result = await controller.applyVoucher(userId, body)

        // Assert - Kiểm tra kết quả
        expect(result.data.canApply).toBe(false)
        expect(result.data.discountAmount).toBe(0)
        expect(result.data.reason).toBe('Order value too low')
      })

      it('should handle different order amounts', async () => {
        // Arrange - Chuẩn bị test với order amounts khác nhau
        const userId = 1
        const orderAmounts = [100000, 200000, 500000, 1000000]

        for (const orderAmount of orderAmounts) {
          const body = createTestData.applyVoucherBody({ orderAmount })
          const expectedDiscount = orderAmount * 0.2 // 20%
          const mockResponse = createTestData.voucherApplicationResult({
            discountAmount: expectedDiscount,
          })

          mockVoucherService.applyVoucher.mockResolvedValue(mockResponse)

          // Act - Thực hiện gọi controller
          const result = await controller.applyVoucher(userId, body)

          // Assert - Kiểm tra kết quả
          expect(result.data.discountAmount).toBe(expectedDiscount)

          // Reset mock for next iteration
          mockVoucherService.applyVoucher.mockReset()
        }
      })
    })

    describe('getMyVoucherStats', () => {
      it('should return my voucher stats successfully', async () => {
        // Arrange - Chuẩn bị dữ liệu test
        const userId = 1
        const mockResponse = createTestData.voucherStatsResponse()

        mockVoucherService.getUserVoucherStats.mockResolvedValue(mockResponse)

        // Act - Thực hiện gọi controller
        const result = await controller.getMyVoucherStats(userId)

        // Assert - Kiểm tra kết quả
        expect(result).toEqual({ data: mockResponse })
        expect(mockVoucherService.getUserVoucherStats).toHaveBeenCalledWith(userId)
      })
    })
  })

  describe('ADMIN/SELLER MANAGEMENT ENDPOINTS', () => {
    describe('createVoucher', () => {
      it('should create voucher successfully as admin', async () => {
        // Arrange - Chuẩn bị dữ liệu test cho admin
        const userId = 1
        const roleId = 1 // Admin role
        const body = createTestData.createVoucherBody()
        const mockResponse = createTestData.voucherResponse()

        mockVoucherService.createVoucher.mockResolvedValue(mockResponse)

        // Act - Thực hiện gọi controller
        const result = await controller.createVoucher(userId, roleId, body)

        // Assert - Kiểm tra kết quả
        expect(result).toEqual({ data: mockResponse })
        expect(mockVoucherService.createVoucher).toHaveBeenCalledWith(body, userId, undefined)
      })

      it('should create voucher successfully as seller', async () => {
        // Arrange - Chuẩn bị dữ liệu test cho seller
        const userId = 1
        const roleId = 3 // Seller role (roleId 3 is SELLER)
        const body = createTestData.createVoucherBody()
        const mockResponse = createTestData.voucherResponse({ sellerId: userId })

        mockVoucherService.createVoucher.mockResolvedValue(mockResponse)

        // Act - Thực hiện gọi controller
        const result = await controller.createVoucher(userId, roleId, body)

        // Assert - Kiểm tra kết quả
        expect(result).toEqual({ data: mockResponse })
        expect(mockVoucherService.createVoucher).toHaveBeenCalledWith(body, userId, userId)
      })

      it('should create different types of vouchers', async () => {
        // Arrange - Chuẩn bị test cho các loại voucher khác nhau
        const userId = 1
        const roleId = 1
        const voucherTypes = [
          { type: 'PERCENTAGE' as VoucherType, value: 15 },
          { type: 'FIXED_AMOUNT' as VoucherType, value: 50000 },
          { type: 'FREE_SHIPPING' as VoucherType, value: 1 },
        ]

        for (const voucherType of voucherTypes) {
          const body = createTestData.createVoucherBody(voucherType)
          const mockResponse = createTestData.voucherResponse(voucherType)

          mockVoucherService.createVoucher.mockResolvedValue(mockResponse)

          // Act - Thực hiện gọi controller
          const result = await controller.createVoucher(userId, roleId, body)

          // Assert - Kiểm tra kết quả
          expect(result.data.type).toBe(voucherType.type)
          expect(result.data.value).toBe(voucherType.value)

          // Reset mock for next iteration
          mockVoucherService.createVoucher.mockReset()
        }
      })
    })

    describe('getVouchers', () => {
      it('should return vouchers successfully as admin', async () => {
        // Arrange - Chuẩn bị dữ liệu test cho admin
        const userId = 1
        const roleId = 1 // Admin role
        const query = createTestData.listVouchersQuery()
        const mockResponse = createTestData.voucherListResponse()

        mockVoucherService.getVouchers.mockResolvedValue(mockResponse)

        // Act - Thực hiện gọi controller
        const result = await controller.getVouchers(userId, roleId, query)

        // Assert - Kiểm tra kết quả
        expect(result).toEqual({
          data: mockResponse.data,
          pagination: mockResponse.pagination,
        })
        expect(mockVoucherService.getVouchers).toHaveBeenCalledWith(query, query.sellerId)
      })

      it('should return vouchers successfully as seller', async () => {
        // Arrange - Chuẩn bị dữ liệu test cho seller
        const userId = 1
        const roleId = 3 // Seller role (roleId 3 is SELLER)
        const query = createTestData.listVouchersQuery()
        const mockResponse = createTestData.voucherListResponse()

        mockVoucherService.getVouchers.mockResolvedValue(mockResponse)

        // Act - Thực hiện gọi controller
        const result = await controller.getVouchers(userId, roleId, query)

        // Assert - Kiểm tra kết quả
        expect(result).toEqual({
          data: mockResponse.data,
          pagination: mockResponse.pagination,
        })
        expect(mockVoucherService.getVouchers).toHaveBeenCalledWith(query, userId) // Seller only sees their vouchers
      })
    })

    describe('getVoucherStats', () => {
      it('should return voucher stats successfully as admin', async () => {
        // Arrange - Chuẩn bị dữ liệu test cho admin
        const userId = 1
        const roleId = 1 // Admin role
        const mockResponse = createTestData.voucherStatsResponse()

        mockVoucherService.getVoucherStats.mockResolvedValue(mockResponse)

        // Act - Thực hiện gọi controller
        const result = await controller.getVoucherStats(userId, roleId)

        // Assert - Kiểm tra kết quả
        expect(result).toEqual({ data: mockResponse })
        expect(mockVoucherService.getVoucherStats).toHaveBeenCalledWith(undefined)
      })

      it('should return voucher stats successfully as seller', async () => {
        // Arrange - Chuẩn bị dữ liệu test cho seller
        const userId = 1
        const roleId = 3 // Seller role (roleId 3 is SELLER)
        const mockResponse = createTestData.voucherStatsResponse()

        mockVoucherService.getVoucherStats.mockResolvedValue(mockResponse)

        // Act - Thực hiện gọi controller
        const result = await controller.getVoucherStats(userId, roleId)

        // Assert - Kiểm tra kết quả
        expect(result).toEqual({ data: mockResponse })
        expect(mockVoucherService.getVoucherStats).toHaveBeenCalledWith(userId)
      })
    })

    describe('updateVoucher', () => {
      it('should update voucher successfully as admin', async () => {
        // Arrange - Chuẩn bị dữ liệu test cho admin
        const userId = 1
        const roleId = 1 // Admin role
        const params = createTestData.updateVoucherParams()
        const body = createTestData.updateVoucherBody()
        const mockResponse = createTestData.voucherResponse({ ...body })

        mockVoucherService.updateVoucher.mockResolvedValue(mockResponse)

        // Act - Thực hiện gọi controller
        const result = await controller.updateVoucher(userId, roleId, params, body)

        // Assert - Kiểm tra kết quả
        expect(result).toEqual({ data: mockResponse })
        expect(mockVoucherService.updateVoucher).toHaveBeenCalledWith(params.id, body, userId, undefined)
      })

      it('should update voucher successfully as seller', async () => {
        // Arrange - Chuẩn bị dữ liệu test cho seller
        const userId = 1
        const roleId = 3 // Seller role (roleId 3 is SELLER)
        const params = createTestData.updateVoucherParams()
        const body = createTestData.updateVoucherBody()
        const mockResponse = createTestData.voucherResponse({ ...body, sellerId: userId })

        mockVoucherService.updateVoucher.mockResolvedValue(mockResponse)

        // Act - Thực hiện gọi controller
        const result = await controller.updateVoucher(userId, roleId, params, body)

        // Assert - Kiểm tra kết quả
        expect(result).toEqual({ data: mockResponse })
        expect(mockVoucherService.updateVoucher).toHaveBeenCalledWith(params.id, body, userId, userId)
      })
    })

    describe('deleteVoucher', () => {
      it('should delete voucher successfully as admin', async () => {
        // Arrange - Chuẩn bị dữ liệu test cho admin
        const userId = 1
        const roleId = 1 // Admin role
        const params = createTestData.deleteVoucherParams()
        const mockResponse = { message: 'Xóa voucher thành công' }

        mockVoucherService.deleteVoucher.mockResolvedValue(mockResponse)

        // Act - Thực hiện gọi controller
        const result = await controller.deleteVoucher(userId, roleId, params)

        // Assert - Kiểm tra kết quả
        expect(result).toEqual(mockResponse)
        expect(mockVoucherService.deleteVoucher).toHaveBeenCalledWith(params.id, userId, undefined)
      })

      it('should delete voucher successfully as seller', async () => {
        // Arrange - Chuẩn bị dữ liệu test cho seller
        const userId = 1
        const roleId = 3 // Seller role (roleId 3 is SELLER)
        const params = createTestData.deleteVoucherParams()
        const mockResponse = { message: 'Xóa voucher thành công' }

        mockVoucherService.deleteVoucher.mockResolvedValue(mockResponse)

        // Act - Thực hiện gọi controller
        const result = await controller.deleteVoucher(userId, roleId, params)

        // Assert - Kiểm tra kết quả
        expect(result).toEqual(mockResponse)
        expect(mockVoucherService.deleteVoucher).toHaveBeenCalledWith(params.id, userId, userId)
      })
    })
  })

  describe('getVoucherDetail', () => {
    it('should return voucher detail successfully without user', async () => {
      // Arrange - Chuẩn bị dữ liệu test
      const params = createTestData.getVoucherDetailParams()
      const mockResponse = createTestData.voucherWithUserInfoResponse({
        userVoucher: null,
        isCollected: false,
        canApply: false,
      })

      mockVoucherService.getVoucherDetail.mockResolvedValue(mockResponse)

      // Act - Thực hiện gọi controller
      const result = await controller.getVoucherDetail(params, undefined)

      // Assert - Kiểm tra kết quả
      expect(result).toEqual({ data: mockResponse })
      expect(mockVoucherService.getVoucherDetail).toHaveBeenCalledWith(params.id, undefined)
    })

    it('should return voucher detail successfully with user', async () => {
      // Arrange - Chuẩn bị dữ liệu test với user
      const params = createTestData.getVoucherDetailParams()
      const userId = 1
      const mockResponse = createTestData.voucherWithUserInfoResponse()

      mockVoucherService.getVoucherDetail.mockResolvedValue(mockResponse)

      // Act - Thực hiện gọi controller
      const result = await controller.getVoucherDetail(params, userId)

      // Assert - Kiểm tra kết quả
      expect(result).toEqual({ data: mockResponse })
      expect(result.data.isCollected).toBe(true)
      expect(result.data.canApply).toBe(true)
      expect(mockVoucherService.getVoucherDetail).toHaveBeenCalledWith(params.id, userId)
    })
  })

  describe('error handling', () => {
    it('should handle service errors in createVoucher', async () => {
      // Arrange - Chuẩn bị lỗi từ service
      const userId = 1
      const roleId = 1
      const body = createTestData.createVoucherBody()
      const serviceError = new Error('Code already exists')

      mockVoucherService.createVoucher.mockRejectedValue(serviceError)

      // Act & Assert - Thực hiện test và kiểm tra lỗi
      await expect(controller.createVoucher(userId, roleId, body)).rejects.toThrow('Code already exists')
      expect(mockVoucherService.createVoucher).toHaveBeenCalledWith(body, userId, undefined)
    })

    it('should handle service errors in collectVoucher', async () => {
      // Arrange - Chuẩn bị lỗi từ service
      const userId = 1
      const params = createTestData.collectVoucherParams()
      const serviceError = new Error('Voucher already collected')

      mockVoucherService.collectVoucher.mockRejectedValue(serviceError)

      // Act & Assert - Thực hiện test và kiểm tra lỗi
      await expect(controller.collectVoucher(userId, params)).rejects.toThrow('Voucher already collected')
      expect(mockVoucherService.collectVoucher).toHaveBeenCalledWith(userId, params.id)
    })

    it('should handle service errors in applyVoucher', async () => {
      // Arrange - Chuẩn bị lỗi từ service
      const userId = 1
      const body = createTestData.applyVoucherBody()
      const serviceError = new Error('Voucher not found')

      mockVoucherService.applyVoucher.mockRejectedValue(serviceError)

      // Act & Assert - Thực hiện test và kiểm tra lỗi
      await expect(controller.applyVoucher(userId, body)).rejects.toThrow('Voucher not found')
      expect(mockVoucherService.applyVoucher).toHaveBeenCalledWith(userId, body)
    })

    it('should pass through service responses without modification', async () => {
      // Arrange - Chuẩn bị test để đảm bảo controller không modify data
      const query = createTestData.listAvailableVouchersQuery()
      const originalResponse = createTestData.availableVoucherListResponse()

      mockVoucherService.getAvailableVouchers.mockResolvedValue(originalResponse)

      // Act - Thực hiện gọi controller
      const result = await controller.getAvailableVouchers(query)

      // Assert - Kiểm tra controller trả về data đúng format
      expect(result.data).toBe(originalResponse.data) // Same reference for data
      expect(result.pagination).toBe(originalResponse.pagination) // Same reference for pagination
    })
  })

  describe('role-based access control', () => {
    it('should handle admin vs seller role differences in createVoucher', async () => {
      // Test admin role (roleId = 1)
      const adminUserId = 1
      const adminRoleId = 1
      const body = createTestData.createVoucherBody()
      const adminResponse = createTestData.voucherResponse({ sellerId: null })

      mockVoucherService.createVoucher.mockResolvedValue(adminResponse)

      const adminResult = await controller.createVoucher(adminUserId, adminRoleId, body)
      expect(mockVoucherService.createVoucher).toHaveBeenCalledWith(body, adminUserId, undefined)

      // Reset and test seller role (roleId = 3)
      mockVoucherService.createVoucher.mockReset()
      const sellerUserId = 2
      const sellerRoleId = 3 // Seller role (roleId 3 is SELLER)
      const sellerResponse = createTestData.voucherResponse({ sellerId: sellerUserId })

      mockVoucherService.createVoucher.mockResolvedValue(sellerResponse)

      const sellerResult = await controller.createVoucher(sellerUserId, sellerRoleId, body)
      expect(mockVoucherService.createVoucher).toHaveBeenCalledWith(body, sellerUserId, sellerUserId)

      // Verify different seller IDs
      expect(adminResult.data.sellerId).toBeNull()
      expect(sellerResult.data.sellerId).toBe(sellerUserId)
    })

    it('should handle admin vs seller role differences in getVoucherStats', async () => {
      const statsResponse = createTestData.voucherStatsResponse()
      mockVoucherService.getVoucherStats.mockResolvedValue(statsResponse)

      // Test admin role
      await controller.getVoucherStats(1, 1) // Admin
      expect(mockVoucherService.getVoucherStats).toHaveBeenCalledWith(undefined)

      mockVoucherService.getVoucherStats.mockReset()

      // Test seller role (roleId 3 is SELLER)
      await controller.getVoucherStats(2, 3) // Seller
      expect(mockVoucherService.getVoucherStats).toHaveBeenCalledWith(2)
    })
  })

  // ===== RESPONSE STRUCTURE SNAPSHOTS =====

  describe('Response Structure Snapshots', () => {
    const fixedDate = '2024-01-01T00:00:00.000Z'

    it('should match voucher list response structure', async () => {
      const mockResponse = createTestData.voucherListResponse({
        data: [
          createTestData.voucherResponse({
            startDate: fixedDate,
            endDate: fixedDate,
            createdAt: fixedDate,
            updatedAt: fixedDate,
          }),
        ],
      })
      mockVoucherService.getVouchers.mockResolvedValue(mockResponse)
      const result = await controller.getVouchers(1, 1, createTestData.listVouchersQuery())
      expect(result).toMatchSnapshot()
    })

    it('should match voucher detail response structure', async () => {
      const mockResponse = createTestData.voucherWithUserInfoResponse({
        startDate: fixedDate,
        endDate: fixedDate,
        createdAt: fixedDate,
        updatedAt: fixedDate,
        userVoucher: {
          usedCount: 0,
          savedAt: fixedDate,
          canUse: true,
        },
      })
      mockVoucherService.getVoucherDetail.mockResolvedValue(mockResponse)
      const result = await controller.getVoucherDetail(createTestData.getVoucherDetailParams(), 1)
      expect(result).toMatchSnapshot()
    })

    it('should match voucher application result structure', async () => {
      const mockResponse = createTestData.voucherApplicationResult()
      mockVoucherService.applyVoucher.mockResolvedValue(mockResponse)
      const result = await controller.applyVoucher(1, createTestData.applyVoucherBody())
      expect(result).toMatchSnapshot()
    })

    it('should match voucher stats response structure', async () => {
      const mockResponse = createTestData.voucherStatsResponse()
      mockVoucherService.getUserVoucherStats.mockResolvedValue(mockResponse)
      const result = await controller.getMyVoucherStats(1)
      expect(result).toMatchSnapshot()
    })
  })
})
