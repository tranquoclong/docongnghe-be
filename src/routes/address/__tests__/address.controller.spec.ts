import { Test, TestingModule } from '@nestjs/testing'
import { AddressController } from '../address.controller'
import { AddressService } from '../address.service'
import {
  CreateAddressBody,
  UpdateAddressBody,
  ListAddressesQuery,
  UpdateAddressParams,
  GetAddressDetailParams,
  DeleteAddressParams,
  SetDefaultAddressParams,
} from '../address.dto'

// Test data factory để tạo dữ liệu test
const createTestData = {
  createAddressBody: (overrides = {}): CreateAddressBody => ({
    name: 'Nguyễn Văn A',
    phone: '0987654321',
    provinceId: '01',
    provinceName: 'TP. Hồ Chí Minh',
    districtId: '001',
    districtName: 'Quận 1',
    wardId: '00001',
    wardName: 'Phường Bến Nghé',
    detail: '123 Lê Lợi',
    isDefault: false,
    ...overrides,
  }),

  updateAddressBody: (overrides = {}): UpdateAddressBody => ({
    name: 'Nguyễn Văn B',
    phone: '0345678912',
    detail: '456 Nguyễn Huệ',
    ...overrides,
  }),

  updateAddressParams: (overrides = {}): UpdateAddressParams => ({
    id: 1,
    ...overrides,
  }),

  getAddressDetailParams: (overrides = {}): GetAddressDetailParams => ({
    id: 1,
    ...overrides,
  }),

  deleteAddressParams: (overrides = {}): DeleteAddressParams => ({
    id: 1,
    ...overrides,
  }),

  setDefaultAddressParams: (overrides = {}): SetDefaultAddressParams => ({
    id: 1,
    ...overrides,
  }),

  listAddressesQuery: (overrides = {}): ListAddressesQuery => ({
    page: 1,
    limit: 10,
    isActive: true,
    search: undefined,
    ...overrides,
  }),

  addressResponse: (overrides = {}) => ({
    id: 1,
    userId: 1,
    name: 'Nguyễn Văn A',
    phone: '0987654321',
    provinceId: '01',
    provinceName: 'TP. Hồ Chí Minh',
    districtId: '001',
    districtName: 'Quận 1',
    wardId: '00001',
    wardName: 'Phường Bến Nghé',
    detail: '123 Lê Lợi',
    fullAddress: '123 Lê Lợi, Phường Bến Nghé, Quận 1, TP. Hồ Chí Minh',
    isDefault: false,
    isActive: true,
    createdAt: new Date('2024-01-01').toISOString(),
    updatedAt: new Date('2024-01-01').toISOString(),
    ...overrides,
  }),

  addressListResponse: (overrides = {}) => ({
    data: [createTestData.addressResponse()],
    pagination: {
      page: 1,
      limit: 10,
      total: 1,
      totalPages: 1,
    },
    ...overrides,
  }),

  addressStatsResponse: (overrides = {}) => ({
    total: 5,
    defaultAddress: {
      id: 1,
      name: 'Nguyễn Văn A',
      phone: '0987654321',
      fullAddress: '123 Lê Lợi, Phường Bến Nghé, Quận 1, TP. Hồ Chí Minh',
      isDefault: true,
    },
    ...overrides,
  }),
}

describe('AddressController', () => {
  let controller: AddressController
  let module: TestingModule
  let mockAddressService: jest.Mocked<AddressService>

  beforeEach(async () => {
    // Tạo mock cho AddressService với tất cả methods cần thiết
    mockAddressService = {
      createAddress: jest.fn(),
      updateAddress: jest.fn(),
      getAddressDetail: jest.fn(),
      getAddresses: jest.fn(),
      deleteAddress: jest.fn(),
      setDefaultAddress: jest.fn(),
      getAddressStats: jest.fn(),
      getDefaultAddress: jest.fn(),
    } as any

    module = await Test.createTestingModule({
      controllers: [AddressController],
      providers: [{ provide: AddressService, useValue: mockAddressService }],
    }).compile()

    controller = module.get<AddressController>(AddressController)
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

  describe('createAddress', () => {
    it('should create address successfully', async () => {
      // Arrange - Chuẩn bị dữ liệu tạo địa chỉ
      const userId = 1
      const body = createTestData.createAddressBody()
      const mockAddressResponse = createTestData.addressResponse()

      mockAddressService.createAddress.mockResolvedValue(mockAddressResponse)

      // Act - Thực hiện tạo địa chỉ
      const result = await controller.createAddress(userId, body)

      // Assert - Kiểm tra kết quả
      expect(result).toEqual({ data: mockAddressResponse })
      expect(mockAddressService.createAddress).toHaveBeenCalledWith(userId, body)
      expect(mockAddressService.createAddress).toHaveBeenCalledTimes(1)
    })

    it('should create default address for new user', async () => {
      // Arrange - Chuẩn bị dữ liệu tạo địa chỉ mặc định cho user mới
      const userId = 1
      const body = createTestData.createAddressBody({ isDefault: true })
      const mockAddressResponse = createTestData.addressResponse({ isDefault: true })

      mockAddressService.createAddress.mockResolvedValue(mockAddressResponse)

      // Act - Thực hiện tạo địa chỉ mặc định
      const result = await controller.createAddress(userId, body)

      // Assert - Kiểm tra kết quả
      expect(result).toEqual({ data: mockAddressResponse })
      expect(result.data.isDefault).toBe(true)
      expect(mockAddressService.createAddress).toHaveBeenCalledWith(userId, body)
    })

    it('should handle different user creating address', async () => {
      // Arrange - Chuẩn bị dữ liệu với user khác
      const userId = 2
      const body = createTestData.createAddressBody({ name: 'Trần Thị B' })
      const mockAddressResponse = createTestData.addressResponse({
        userId: 2,
        name: 'Trần Thị B',
      })

      mockAddressService.createAddress.mockResolvedValue(mockAddressResponse)

      // Act - Thực hiện tạo địa chỉ
      const result = await controller.createAddress(userId, body)

      // Assert - Kiểm tra kết quả
      expect(result).toEqual({ data: mockAddressResponse })
      expect(result.data.userId).toBe(2)
      expect(result.data.name).toBe('Trần Thị B')
    })
  })

  describe('getAddresses', () => {
    it('should get addresses list successfully', async () => {
      // Arrange - Chuẩn bị dữ liệu lấy danh sách địa chỉ
      const userId = 1
      const query = createTestData.listAddressesQuery()
      const mockListResponse = createTestData.addressListResponse()

      mockAddressService.getAddresses.mockResolvedValue(mockListResponse)

      // Act - Thực hiện lấy danh sách địa chỉ
      const result = await controller.getAddresses(userId, query)

      // Assert - Kiểm tra kết quả
      expect(result).toEqual(mockListResponse)
      expect(mockAddressService.getAddresses).toHaveBeenCalledWith(userId, query)
      expect(mockAddressService.getAddresses).toHaveBeenCalledTimes(1)
    })

    it('should handle addresses list with search query', async () => {
      // Arrange - Chuẩn bị dữ liệu tìm kiếm địa chỉ
      const userId = 1
      const query = createTestData.listAddressesQuery({ search: 'Nguyễn' })
      const mockListResponse = createTestData.addressListResponse()

      mockAddressService.getAddresses.mockResolvedValue(mockListResponse)

      // Act - Thực hiện tìm kiếm địa chỉ
      const result = await controller.getAddresses(userId, query)

      // Assert - Kiểm tra kết quả
      expect(result).toEqual(mockListResponse)
      expect(mockAddressService.getAddresses).toHaveBeenCalledWith(userId, query)
    })

    it('should handle addresses list with pagination', async () => {
      // Arrange - Chuẩn bị dữ liệu với pagination
      const userId = 1
      const query = createTestData.listAddressesQuery({ page: 2, limit: 5 })
      const mockListResponse = createTestData.addressListResponse({
        pagination: {
          page: 2,
          limit: 5,
          total: 10,
          totalPages: 2,
        },
      })

      mockAddressService.getAddresses.mockResolvedValue(mockListResponse)

      // Act - Thực hiện lấy danh sách địa chỉ
      const result = await controller.getAddresses(userId, query)

      // Assert - Kiểm tra kết quả pagination
      expect(result.pagination.page).toBe(2)
      expect(result.pagination.limit).toBe(5)
      expect(result.pagination.totalPages).toBe(2)
    })

    it('should handle empty addresses list', async () => {
      // Arrange - Chuẩn bị dữ liệu danh sách trống
      const userId = 1
      const query = createTestData.listAddressesQuery()
      const emptyListResponse = createTestData.addressListResponse({
        data: [],
        pagination: {
          page: 1,
          limit: 10,
          total: 0,
          totalPages: 0,
        },
      })

      mockAddressService.getAddresses.mockResolvedValue(emptyListResponse)

      // Act - Thực hiện lấy danh sách địa chỉ
      const result = await controller.getAddresses(userId, query)

      // Assert - Kiểm tra kết quả
      expect(result.data).toHaveLength(0)
      expect(result.pagination.total).toBe(0)
    })
  })

  describe('getAddressStats', () => {
    it('should get address stats successfully', async () => {
      // Arrange - Chuẩn bị dữ liệu thống kê địa chỉ
      const userId = 1
      const mockStatsResponse = createTestData.addressStatsResponse()

      mockAddressService.getAddressStats.mockResolvedValue(mockStatsResponse)

      // Act - Thực hiện lấy thống kê địa chỉ
      const result = await controller.getAddressStats(userId)

      // Assert - Kiểm tra kết quả
      expect(result).toEqual({ data: mockStatsResponse })
      expect(mockAddressService.getAddressStats).toHaveBeenCalledWith(userId)
      expect(mockAddressService.getAddressStats).toHaveBeenCalledTimes(1)
    })

    it('should handle stats with no default address', async () => {
      // Arrange - Chuẩn bị dữ liệu thống kê không có địa chỉ mặc định
      const userId = 1
      const mockStatsResponse = createTestData.addressStatsResponse({
        defaultAddress: undefined,
      })

      mockAddressService.getAddressStats.mockResolvedValue(mockStatsResponse)

      // Act - Thực hiện lấy thống kê địa chỉ
      const result = await controller.getAddressStats(userId)

      // Assert - Kiểm tra kết quả
      expect(result.data.defaultAddress).toBeUndefined()
    })
  })

  describe('getDefaultAddress', () => {
    it('should get default address successfully', async () => {
      // Arrange - Chuẩn bị dữ liệu lấy địa chỉ mặc định
      const userId = 1
      const mockDefaultAddress = createTestData.addressResponse({ isDefault: true })

      mockAddressService.getDefaultAddress.mockResolvedValue(mockDefaultAddress)

      // Act - Thực hiện lấy địa chỉ mặc định
      const result = await controller.getDefaultAddress(userId)

      // Assert - Kiểm tra kết quả
      expect(result).toEqual({ data: mockDefaultAddress })
      expect(mockAddressService.getDefaultAddress).toHaveBeenCalledWith(userId)
    })

    it('should return null when no default address exists', async () => {
      // Arrange - Chuẩn bị dữ liệu khi không có địa chỉ mặc định
      const userId = 1

      mockAddressService.getDefaultAddress.mockResolvedValue(null)

      // Act - Thực hiện lấy địa chỉ mặc định
      const result = await controller.getDefaultAddress(userId)

      // Assert - Kiểm tra kết quả
      expect(result).toEqual({ data: null })
    })
  })

  describe('getAddressDetail', () => {
    it('should get address detail successfully', async () => {
      // Arrange - Chuẩn bị dữ liệu lấy chi tiết địa chỉ
      const userId = 1
      const params = createTestData.getAddressDetailParams()
      const mockAddressResponse = createTestData.addressResponse()

      mockAddressService.getAddressDetail.mockResolvedValue(mockAddressResponse)

      // Act - Thực hiện lấy chi tiết địa chỉ
      const result = await controller.getAddressDetail(userId, params)

      // Assert - Kiểm tra kết quả
      expect(result).toEqual({ data: mockAddressResponse })
      expect(mockAddressService.getAddressDetail).toHaveBeenCalledWith(params.id, userId)
      expect(mockAddressService.getAddressDetail).toHaveBeenCalledTimes(1)
    })

    it('should handle different address IDs', async () => {
      // Arrange - Chuẩn bị dữ liệu với address ID khác
      const userId = 1
      const params = createTestData.getAddressDetailParams({ id: 5 })
      const mockAddressResponse = createTestData.addressResponse({ id: 5, name: 'Địa chỉ khác' })

      mockAddressService.getAddressDetail.mockResolvedValue(mockAddressResponse)

      // Act - Thực hiện lấy chi tiết địa chỉ
      const result = await controller.getAddressDetail(userId, params)

      // Assert - Kiểm tra kết quả
      expect(result.data.id).toBe(5)
      expect(result.data.name).toBe('Địa chỉ khác')
      expect(mockAddressService.getAddressDetail).toHaveBeenCalledWith(5, userId)
    })
  })

  describe('updateAddress', () => {
    it('should update address successfully', async () => {
      // Arrange - Chuẩn bị dữ liệu cập nhật địa chỉ
      const userId = 1
      const params = createTestData.updateAddressParams()
      const body = createTestData.updateAddressBody()
      const mockUpdatedAddress = createTestData.addressResponse({ ...body })

      mockAddressService.updateAddress.mockResolvedValue(mockUpdatedAddress)

      // Act - Thực hiện cập nhật địa chỉ
      const result = await controller.updateAddress(userId, params, body)

      // Assert - Kiểm tra kết quả
      expect(result).toEqual({ data: mockUpdatedAddress })
      expect(mockAddressService.updateAddress).toHaveBeenCalledWith(params.id, userId, body)
      expect(mockAddressService.updateAddress).toHaveBeenCalledTimes(1)
    })

    it('should update partial address data', async () => {
      // Arrange - Chuẩn bị dữ liệu cập nhật một phần
      const userId = 1
      const params = createTestData.updateAddressParams()
      const body = createTestData.updateAddressBody({ name: 'Tên mới' })
      const mockUpdatedAddress = createTestData.addressResponse({ name: 'Tên mới' })

      mockAddressService.updateAddress.mockResolvedValue(mockUpdatedAddress)

      // Act - Thực hiện cập nhật một phần địa chỉ
      const result = await controller.updateAddress(userId, params, body)

      // Assert - Kiểm tra kết quả
      expect(result.data.name).toBe('Tên mới')
      expect(mockAddressService.updateAddress).toHaveBeenCalledWith(params.id, userId, body)
    })

    it('should handle updating different users addresses', async () => {
      // Arrange - Chuẩn bị dữ liệu với user khác
      const userId = 2
      const params = createTestData.updateAddressParams({ id: 3 })
      const body = createTestData.updateAddressBody()
      const mockUpdatedAddress = createTestData.addressResponse({ id: 3, userId: 2 })

      mockAddressService.updateAddress.mockResolvedValue(mockUpdatedAddress)

      // Act - Thực hiện cập nhật địa chỉ
      const result = await controller.updateAddress(userId, params, body)

      // Assert - Kiểm tra kết quả
      expect(result.data.userId).toBe(2)
      expect(mockAddressService.updateAddress).toHaveBeenCalledWith(3, 2, body)
    })
  })

  describe('setDefaultAddress', () => {
    it('should set default address successfully', async () => {
      // Arrange - Chuẩn bị dữ liệu đặt địa chỉ mặc định
      const userId = 1
      const params = createTestData.setDefaultAddressParams()
      const mockDefaultAddress = createTestData.addressResponse({ isDefault: true })

      mockAddressService.setDefaultAddress.mockResolvedValue(mockDefaultAddress)

      // Act - Thực hiện đặt địa chỉ mặc định
      const result = await controller.setDefaultAddress(userId, params)

      // Assert - Kiểm tra kết quả
      expect(result).toEqual({ data: mockDefaultAddress })
      expect(result.data.isDefault).toBe(true)
      expect(mockAddressService.setDefaultAddress).toHaveBeenCalledWith(params.id, userId)
      expect(mockAddressService.setDefaultAddress).toHaveBeenCalledTimes(1)
    })

    it('should handle setting default for different address IDs', async () => {
      // Arrange - Chuẩn bị dữ liệu với address ID khác
      const userId = 1
      const params = createTestData.setDefaultAddressParams({ id: 3 })
      const mockDefaultAddress = createTestData.addressResponse({ id: 3, isDefault: true })

      mockAddressService.setDefaultAddress.mockResolvedValue(mockDefaultAddress)

      // Act - Thực hiện đặt địa chỉ mặc định
      const result = await controller.setDefaultAddress(userId, params)

      // Assert - Kiểm tra kết quả
      expect(result.data.id).toBe(3)
      expect(result.data.isDefault).toBe(true)
      expect(mockAddressService.setDefaultAddress).toHaveBeenCalledWith(3, userId)
    })
  })

  describe('deleteAddress', () => {
    it('should delete address successfully', async () => {
      // Arrange - Chuẩn bị dữ liệu xóa địa chỉ
      const userId = 1
      const params = createTestData.deleteAddressParams()
      const mockDeleteResponse = { message: 'Xóa địa chỉ thành công' }

      mockAddressService.deleteAddress.mockResolvedValue(mockDeleteResponse)

      // Act - Thực hiện xóa địa chỉ
      const result = await controller.deleteAddress(userId, params)

      // Assert - Kiểm tra kết quả
      expect(result).toEqual(mockDeleteResponse)
      expect(mockAddressService.deleteAddress).toHaveBeenCalledWith(params.id, userId)
      expect(mockAddressService.deleteAddress).toHaveBeenCalledTimes(1)
    })

    it('should handle deleting different address IDs', async () => {
      // Arrange - Chuẩn bị dữ liệu với address ID khác
      const userId = 1
      const params = createTestData.deleteAddressParams({ id: 5 })
      const mockDeleteResponse = { message: 'Xóa địa chỉ thành công' }

      mockAddressService.deleteAddress.mockResolvedValue(mockDeleteResponse)

      // Act - Thực hiện xóa địa chỉ
      const result = await controller.deleteAddress(userId, params)

      // Assert - Kiểm tra kết quả
      expect(result.message).toBe('Xóa địa chỉ thành công')
      expect(mockAddressService.deleteAddress).toHaveBeenCalledWith(5, userId)
    })

    it('should handle deleting for different users', async () => {
      // Arrange - Chuẩn bị dữ liệu với user khác
      const userId = 2
      const params = createTestData.deleteAddressParams()
      const mockDeleteResponse = { message: 'Xóa địa chỉ thành công' }

      mockAddressService.deleteAddress.mockResolvedValue(mockDeleteResponse)

      // Act - Thực hiện xóa địa chỉ
      const result = await controller.deleteAddress(userId, params)

      // Assert - Kiểm tra kết quả
      expect(result).toEqual(mockDeleteResponse)
      expect(mockAddressService.deleteAddress).toHaveBeenCalledWith(params.id, 2)
    })
  })

  describe('edge cases and error handling', () => {
    it('should handle service errors in createAddress', async () => {
      // Arrange - Chuẩn bị lỗi từ service
      const userId = 1
      const body = createTestData.createAddressBody()
      const serviceError = new Error('Max addresses exceeded')

      mockAddressService.createAddress.mockRejectedValue(serviceError)

      // Act & Assert - Thực hiện test và kiểm tra lỗi
      await expect(controller.createAddress(userId, body)).rejects.toThrow('Max addresses exceeded')
      expect(mockAddressService.createAddress).toHaveBeenCalledWith(userId, body)
    })

    it('should handle service errors in getAddresses', async () => {
      // Arrange - Chuẩn bị lỗi từ service
      const userId = 1
      const query = createTestData.listAddressesQuery()
      const serviceError = new Error('Database connection failed')

      mockAddressService.getAddresses.mockRejectedValue(serviceError)

      // Act & Assert - Thực hiện test và kiểm tra lỗi
      await expect(controller.getAddresses(userId, query)).rejects.toThrow('Database connection failed')
    })

    it('should handle service errors in updateAddress', async () => {
      // Arrange - Chuẩn bị lỗi từ service
      const userId = 1
      const params = createTestData.updateAddressParams()
      const body = createTestData.updateAddressBody()
      const serviceError = new Error('Address not found')

      mockAddressService.updateAddress.mockRejectedValue(serviceError)

      // Act & Assert - Thực hiện test và kiểm tra lỗi
      await expect(controller.updateAddress(userId, params, body)).rejects.toThrow('Address not found')
    })

    it('should handle service errors in deleteAddress', async () => {
      // Arrange - Chuẩn bị lỗi từ service
      const userId = 1
      const params = createTestData.deleteAddressParams()
      const serviceError = new Error('Cannot delete default address')

      mockAddressService.deleteAddress.mockRejectedValue(serviceError)

      // Act & Assert - Thực hiện test và kiểm tra lỗi
      await expect(controller.deleteAddress(userId, params)).rejects.toThrow('Cannot delete default address')
    })

    it('should pass through service responses without modification', async () => {
      // Arrange - Chuẩn bị test để đảm bảo controller không modify data
      const userId = 1
      const query = createTestData.listAddressesQuery()
      const originalResponse = createTestData.addressListResponse()

      mockAddressService.getAddresses.mockResolvedValue(originalResponse)

      // Act - Thực hiện lấy danh sách địa chỉ
      const result = await controller.getAddresses(userId, query)

      // Assert - Kiểm tra kết quả không bị thay đổi
      expect(result).toEqual(originalResponse) // Same content
      expect(result).toEqual(originalResponse) // Deep equality check
    })

    it('should handle concurrent requests correctly', async () => {
      // Arrange - Chuẩn bị test concurrent requests
      const userId = 1
      const query = createTestData.listAddressesQuery()
      const mockResponse = createTestData.addressListResponse()

      mockAddressService.getAddresses.mockResolvedValue(mockResponse)

      // Act - Thực hiện multiple concurrent requests
      const promises = Array(3)
        .fill(null)
        .map(() => controller.getAddresses(userId, query))
      const results = await Promise.all(promises)

      // Assert - Kiểm tra tất cả requests đều thành công
      results.forEach((result) => {
        expect(result).toEqual(mockResponse)
      })
      expect(mockAddressService.getAddresses).toHaveBeenCalledTimes(3)
    })
  })

  // ===== RESPONSE STRUCTURE SNAPSHOTS =====

  describe('Response Structure Snapshots', () => {
    it('should match address list response structure', async () => {
      const mockResponse = createTestData.addressListResponse()
      mockAddressService.getAddresses.mockResolvedValue(mockResponse)
      const result = await controller.getAddresses(1, createTestData.listAddressesQuery())
      expect(result).toMatchSnapshot()
    })

    it('should match address detail response structure', async () => {
      const mockResponse = createTestData.addressResponse()
      mockAddressService.getAddressDetail.mockResolvedValue(mockResponse)
      const result = await controller.getAddressDetail(1, createTestData.getAddressDetailParams())
      expect(result).toMatchSnapshot()
    })

    it('should match create address response structure', async () => {
      const mockResponse = createTestData.addressResponse()
      mockAddressService.createAddress.mockResolvedValue(mockResponse)
      const result = await controller.createAddress(1, createTestData.createAddressBody())
      expect(result).toMatchSnapshot()
    })
  })
})
