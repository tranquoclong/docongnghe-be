import { Test, TestingModule } from '@nestjs/testing'
import { HttpException } from '@nestjs/common'
import { AddressService } from '../address.service'
import { AddressRepository } from '../address.repo'
import { CreateAddressBody, UpdateAddressBody, ListAddressesQuery } from '../address.dto'
import { ADDRESS_ERRORS } from '../address.error'

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

  listAddressesQuery: (overrides = {}): ListAddressesQuery => ({
    page: 1,
    limit: 10,
    isActive: true,
    search: undefined,
    ...overrides,
  }),

  addressEntity: (overrides = {}) => ({
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
    createdAt: '2024-01-01T00:00:00.000Z' as any,
    updatedAt: '2024-01-01T00:00:00.000Z' as any,
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
    createdAt: '2024-01-01T00:00:00.000Z' as any,
    updatedAt: '2024-01-01T00:00:00.000Z' as any,
    ...overrides,
  }),

  addressListResponse: (overrides = {}) => ({
    data: [createTestData.addressEntity()],
    total: 1,
    page: 1,
    limit: 10,
    ...overrides,
  }),

  addressStats: (overrides = {}) => ({
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

describe('AddressService', () => {
  let service: AddressService
  let module: TestingModule
  let mockAddressRepository: jest.Mocked<AddressRepository>

  beforeEach(async () => {
    // Tạo mock cho AddressRepository với tất cả methods cần thiết
    mockAddressRepository = {
      create: jest.fn(),
      update: jest.fn(),
      findById: jest.fn(),
      findMany: jest.fn(),
      delete: jest.fn(),
      setDefault: jest.fn(),
      findDefault: jest.fn(),
      countByUser: jest.fn(),
      isDefaultAddress: jest.fn(),
    } as any

    module = await Test.createTestingModule({
      providers: [AddressService, { provide: AddressRepository, useValue: mockAddressRepository }],
    }).compile()

    service = module.get<AddressService>(AddressService)
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
    it('should create address successfully with isDefault set to true when first address', async () => {
      // Arrange - Chuẩn bị dữ liệu cho địa chỉ đầu tiên
      const userId = 1
      const createData = createTestData.createAddressBody({ isDefault: false })
      const mockCreatedAddress = createTestData.addressEntity({ isDefault: true })

      mockAddressRepository.countByUser.mockResolvedValue(0) // First address
      mockAddressRepository.create.mockResolvedValue(mockCreatedAddress)

      // Act - Thực hiện tạo địa chỉ
      const result = await service.createAddress(userId, createData)

      // Assert - Kiểm tra kết quả
      expect(result).toEqual(mockCreatedAddress)
      expect(mockAddressRepository.countByUser).toHaveBeenCalledWith(userId)
      expect(mockAddressRepository.create).toHaveBeenCalledWith(userId, { ...createData, isDefault: true })
    })

    it('should create address successfully when user has less than 10 addresses', async () => {
      // Arrange - Chuẩn bị dữ liệu khi user có ít hơn 10 địa chỉ
      const userId = 1
      const createData = createTestData.createAddressBody()
      const mockCreatedAddress = createTestData.addressEntity()

      mockAddressRepository.countByUser.mockResolvedValue(5)
      mockAddressRepository.create.mockResolvedValue(mockCreatedAddress)

      // Act - Thực hiện tạo địa chỉ
      const result = await service.createAddress(userId, createData)

      // Assert - Kiểm tra kết quả
      expect(result).toEqual(mockCreatedAddress)
      expect(mockAddressRepository.countByUser).toHaveBeenCalledWith(userId)
      expect(mockAddressRepository.create).toHaveBeenCalledWith(userId, createData)
    })

    it('should throw error when user reaches maximum address limit', async () => {
      // Arrange - Chuẩn bị dữ liệu khi user đã có 10 địa chỉ
      const userId = 1
      const createData = createTestData.createAddressBody()

      mockAddressRepository.countByUser.mockResolvedValue(10)

      // Act & Assert - Thực hiện test và kiểm tra lỗi
      await expect(service.createAddress(userId, createData)).rejects.toThrow(
        new HttpException(ADDRESS_ERRORS.MAX_ADDRESSES_EXCEEDED, 400),
      )
      expect(mockAddressRepository.countByUser).toHaveBeenCalledWith(userId)
      expect(mockAddressRepository.create).not.toHaveBeenCalled()
    })

    it('should throw error when phone number format is invalid', async () => {
      // Arrange - Chuẩn bị dữ liệu với số điện thoại không hợp lệ
      const userId = 1
      const createData = createTestData.createAddressBody({ phone: '123' })

      mockAddressRepository.countByUser.mockResolvedValue(5)

      // Act & Assert - Thực hiện test và kiểm tra lỗi validation số điện thoại
      await expect(service.createAddress(userId, createData)).rejects.toThrow(
        new HttpException(
          {
            message: 'Số điện thoại không đúng định dạng',
            statusCode: 400,
            errorCode: 'INVALID_PHONE_FORMAT',
          },
          400,
        ),
      )
    })

    it('should throw error when required address data is missing', async () => {
      // Arrange - Chuẩn bị dữ liệu thiếu thông tin bắt buộc
      const userId = 1
      const createData = createTestData.createAddressBody({ provinceId: '', districtId: '', wardId: '' })

      mockAddressRepository.countByUser.mockResolvedValue(5)

      // Act & Assert - Thực hiện test và kiểm tra lỗi validation
      await expect(service.createAddress(userId, createData)).rejects.toThrow(
        new HttpException(ADDRESS_ERRORS.INVALID_ADDRESS_DATA, 400),
      )
    })

    it('should handle valid Vietnamese phone numbers', async () => {
      // Arrange - Chuẩn bị dữ liệu với các định dạng số điện thoại hợp lệ
      const userId = 1
      const testPhones = ['0987654321', '+84987654321', '0345678912', '0876543210']
      const mockCreatedAddress = createTestData.addressEntity()

      mockAddressRepository.countByUser.mockResolvedValue(5)
      mockAddressRepository.create.mockResolvedValue(mockCreatedAddress)

      // Act & Assert - Kiểm tra tất cả định dạng số điện thoại hợp lệ
      for (const phone of testPhones) {
        const createData = createTestData.createAddressBody({ phone })
        const result = await service.createAddress(userId, createData)
        expect(result).toEqual(mockCreatedAddress)
      }
    })
  })

  describe('updateAddress', () => {
    it('should update address successfully', async () => {
      // Arrange - Chuẩn bị dữ liệu cập nhật địa chỉ
      const userId = 1
      const addressId = 1
      const updateData = createTestData.updateAddressBody()
      const existingAddress = createTestData.addressEntity()
      const updatedAddress = createTestData.addressEntity({ ...updateData })

      mockAddressRepository.findById.mockResolvedValue(existingAddress)
      mockAddressRepository.update.mockResolvedValue(updatedAddress)

      // Act - Thực hiện cập nhật địa chỉ
      const result = await service.updateAddress(addressId, userId, updateData)

      // Assert - Kiểm tra kết quả
      expect(result).toEqual(updatedAddress)
      expect(mockAddressRepository.findById).toHaveBeenCalledWith(addressId, userId)
      expect(mockAddressRepository.update).toHaveBeenCalledWith(addressId, userId, updateData)
    })

    it('should throw error when address not found', async () => {
      // Arrange - Chuẩn bị dữ liệu với địa chỉ không tồn tại
      const userId = 1
      const addressId = 999
      const updateData = createTestData.updateAddressBody()

      mockAddressRepository.findById.mockResolvedValue(null)

      // Act & Assert - Thực hiện test và kiểm tra lỗi
      await expect(service.updateAddress(addressId, userId, updateData)).rejects.toThrow(
        new HttpException(ADDRESS_ERRORS.ADDRESS_NOT_FOUND, 404),
      )
      expect(mockAddressRepository.findById).toHaveBeenCalledWith(addressId, userId)
      expect(mockAddressRepository.update).not.toHaveBeenCalled()
    })

    it('should validate address data when updating location fields', async () => {
      // Arrange - Chuẩn bị dữ liệu cập nhật với thông tin địa lý
      const userId = 1
      const addressId = 1
      const updateData = createTestData.updateAddressBody({
        provinceId: '02',
        provinceName: 'Hà Nội',
        districtId: '',
        districtName: '',
        wardId: '',
        wardName: '',
      })
      const existingAddress = createTestData.addressEntity()

      mockAddressRepository.findById.mockResolvedValue(existingAddress)

      // Act & Assert - Thực hiện test và kiểm tra lỗi validation
      await expect(service.updateAddress(addressId, userId, updateData)).rejects.toThrow(
        new HttpException(ADDRESS_ERRORS.INVALID_ADDRESS_DATA, 400),
      )
    })

    it('should update address with phone validation', async () => {
      // Arrange - Chuẩn bị dữ liệu cập nhật với số điện thoại không hợp lệ
      const userId = 1
      const addressId = 1
      const updateData = createTestData.updateAddressBody({ phone: 'invalid-phone' })
      const existingAddress = createTestData.addressEntity()

      mockAddressRepository.findById.mockResolvedValue(existingAddress)

      // Act & Assert - Thực hiện test và kiểm tra lỗi validation số điện thoại
      await expect(service.updateAddress(addressId, userId, updateData)).rejects.toThrow()
    })
  })

  describe('getAddressDetail', () => {
    it('should get address detail successfully', async () => {
      // Arrange - Chuẩn bị dữ liệu lấy chi tiết địa chỉ
      const userId = 1
      const addressId = 1
      const mockAddress = createTestData.addressEntity()

      mockAddressRepository.findById.mockResolvedValue(mockAddress)

      // Act - Thực hiện lấy chi tiết địa chỉ
      const result = await service.getAddressDetail(addressId, userId)

      // Assert - Kiểm tra kết quả
      expect(result).toEqual(mockAddress)
      expect(mockAddressRepository.findById).toHaveBeenCalledWith(addressId, userId)
    })

    it('should throw error when address not found', async () => {
      // Arrange - Chuẩn bị dữ liệu với địa chỉ không tồn tại
      const userId = 1
      const addressId = 999

      mockAddressRepository.findById.mockResolvedValue(null)

      // Act & Assert - Thực hiện test và kiểm tra lỗi
      await expect(service.getAddressDetail(addressId, userId)).rejects.toThrow(
        new HttpException(ADDRESS_ERRORS.ADDRESS_NOT_FOUND, 404),
      )
      expect(mockAddressRepository.findById).toHaveBeenCalledWith(addressId, userId)
    })
  })

  describe('getAddresses', () => {
    it('should get addresses list successfully', async () => {
      // Arrange - Chuẩn bị dữ liệu lấy danh sách địa chỉ
      const userId = 1
      const query = createTestData.listAddressesQuery()
      const mockListResponse = createTestData.addressListResponse()

      mockAddressRepository.findMany.mockResolvedValue(mockListResponse)

      // Act - Thực hiện lấy danh sách địa chỉ
      const result = await service.getAddresses(userId, query)

      // Assert - Kiểm tra kết quả
      expect(result).toEqual({
        data: mockListResponse.data,
        pagination: {
          page: 1,
          limit: 10,
          total: 1,
          totalPages: 1,
        },
      })
      expect(mockAddressRepository.findMany).toHaveBeenCalledWith(userId, query)
    })

    it('should handle empty address list', async () => {
      // Arrange - Chuẩn bị dữ liệu danh sách địa chỉ trống
      const userId = 1
      const query = createTestData.listAddressesQuery()
      const emptyListResponse = createTestData.addressListResponse({ data: [], total: 0 })

      mockAddressRepository.findMany.mockResolvedValue(emptyListResponse)

      // Act - Thực hiện lấy danh sách địa chỉ
      const result = await service.getAddresses(userId, query)

      // Assert - Kiểm tra kết quả
      expect(result.data).toHaveLength(0)
      expect(result.pagination.total).toBe(0)
      expect(result.pagination.totalPages).toBe(0)
    })

    it('should handle pagination correctly', async () => {
      // Arrange - Chuẩn bị dữ liệu với pagination
      const userId = 1
      const query = createTestData.listAddressesQuery({ page: 2, limit: 5 })
      const mockListResponse = createTestData.addressListResponse({
        data: Array(5).fill(createTestData.addressEntity()),
        total: 15,
        page: 2,
        limit: 5,
      })

      mockAddressRepository.findMany.mockResolvedValue(mockListResponse)

      // Act - Thực hiện lấy danh sách địa chỉ
      const result = await service.getAddresses(userId, query)

      // Assert - Kiểm tra kết quả pagination
      expect(result.pagination.page).toBe(2)
      expect(result.pagination.limit).toBe(5)
      expect(result.pagination.total).toBe(15)
      expect(result.pagination.totalPages).toBe(3)
    })
  })

  describe('deleteAddress', () => {
    it('should delete address successfully', async () => {
      // Arrange - Chuẩn bị dữ liệu xóa địa chỉ
      const userId = 1
      const addressId = 1
      const mockAddress = createTestData.addressEntity({ isDefault: false })

      mockAddressRepository.findById.mockResolvedValue(mockAddress)
      mockAddressRepository.delete.mockResolvedValue(mockAddress)

      // Act - Thực hiện xóa địa chỉ
      const result = await service.deleteAddress(addressId, userId)

      // Assert - Kiểm tra kết quả
      expect(result).toEqual({ message: 'Xóa địa chỉ thành công' })
      expect(mockAddressRepository.findById).toHaveBeenCalledWith(addressId, userId)
      expect(mockAddressRepository.delete).toHaveBeenCalledWith(addressId, userId)
    })

    it('should throw error when trying to delete default address', async () => {
      // Arrange - Chuẩn bị dữ liệu xóa địa chỉ mặc định
      const userId = 1
      const addressId = 1
      const mockDefaultAddress = createTestData.addressEntity({ isDefault: true })

      mockAddressRepository.findById.mockResolvedValue(mockDefaultAddress)

      // Act & Assert - Thực hiện test và kiểm tra lỗi
      await expect(service.deleteAddress(addressId, userId)).rejects.toThrow(
        new HttpException(ADDRESS_ERRORS.CANNOT_DELETE_DEFAULT_ADDRESS, 400),
      )
      expect(mockAddressRepository.findById).toHaveBeenCalledWith(addressId, userId)
      expect(mockAddressRepository.delete).not.toHaveBeenCalled()
    })

    it('should throw error when address not found', async () => {
      // Arrange - Chuẩn bị dữ liệu với địa chỉ không tồn tại
      const userId = 1
      const addressId = 999

      mockAddressRepository.findById.mockResolvedValue(null)

      // Act & Assert - Thực hiện test và kiểm tra lỗi
      await expect(service.deleteAddress(addressId, userId)).rejects.toThrow(
        new HttpException(ADDRESS_ERRORS.ADDRESS_NOT_FOUND, 404),
      )
      expect(mockAddressRepository.delete).not.toHaveBeenCalled()
    })
  })

  describe('setDefaultAddress', () => {
    it('should set default address successfully', async () => {
      // Arrange - Chuẩn bị dữ liệu đặt địa chỉ mặc định
      const userId = 1
      const addressId = 1
      const mockAddress = createTestData.addressEntity({ isActive: true })
      const mockUpdatedAddress = createTestData.addressEntity({ isDefault: true })

      mockAddressRepository.findById.mockResolvedValue(mockAddress)
      mockAddressRepository.setDefault.mockResolvedValue(mockUpdatedAddress)

      // Act - Thực hiện đặt địa chỉ mặc định
      const result = await service.setDefaultAddress(addressId, userId)

      // Assert - Kiểm tra kết quả
      expect(result).toEqual(mockUpdatedAddress)
      expect(mockAddressRepository.findById).toHaveBeenCalledWith(addressId, userId)
      expect(mockAddressRepository.setDefault).toHaveBeenCalledWith(addressId, userId)
    })

    it('should throw error when trying to set inactive address as default', async () => {
      // Arrange - Chuẩn bị dữ liệu đặt địa chỉ không hoạt động làm mặc định
      const userId = 1
      const addressId = 1
      const mockInactiveAddress = createTestData.addressEntity({ isActive: false })

      mockAddressRepository.findById.mockResolvedValue(mockInactiveAddress)

      // Act & Assert - Thực hiện test và kiểm tra lỗi
      await expect(service.setDefaultAddress(addressId, userId)).rejects.toThrow(
        new HttpException(ADDRESS_ERRORS.CANNOT_SET_INACTIVE_AS_DEFAULT, 400),
      )
      expect(mockAddressRepository.setDefault).not.toHaveBeenCalled()
    })

    it('should throw error when address not found', async () => {
      // Arrange - Chuẩn bị dữ liệu với địa chỉ không tồn tại
      const userId = 1
      const addressId = 999

      mockAddressRepository.findById.mockResolvedValue(null)

      // Act & Assert - Thực hiện test và kiểm tra lỗi
      await expect(service.setDefaultAddress(addressId, userId)).rejects.toThrow(
        new HttpException(ADDRESS_ERRORS.ADDRESS_NOT_FOUND, 404),
      )
      expect(mockAddressRepository.setDefault).not.toHaveBeenCalled()
    })
  })

  describe('getAddressStats', () => {
    it('should get address stats successfully', async () => {
      // Arrange - Chuẩn bị dữ liệu thống kê địa chỉ
      const userId = 1
      const mockStats = createTestData.addressStats()
      const mockDefaultAddress = createTestData.addressEntity({ isDefault: true })

      mockAddressRepository.countByUser.mockResolvedValue(5)
      mockAddressRepository.findDefault.mockResolvedValue(mockDefaultAddress)

      // Act - Thực hiện lấy thống kê địa chỉ
      const result = await service.getAddressStats(userId)

      // Assert - Kiểm tra kết quả
      expect(result).toEqual(mockStats)
      expect(mockAddressRepository.countByUser).toHaveBeenCalledWith(userId)
      expect(mockAddressRepository.findDefault).toHaveBeenCalledWith(userId)
    })

    it('should handle stats when no default address exists', async () => {
      // Arrange - Chuẩn bị dữ liệu thống kê khi không có địa chỉ mặc định
      const userId = 1

      mockAddressRepository.countByUser.mockResolvedValue(3)
      mockAddressRepository.findDefault.mockResolvedValue(null)

      // Act - Thực hiện lấy thống kê địa chỉ
      const result = await service.getAddressStats(userId)

      // Assert - Kiểm tra kết quả
      expect(result).toEqual({
        total: 3,
        defaultAddress: undefined,
      })
    })
  })

  describe('getDefaultAddress', () => {
    it('should get default address successfully', async () => {
      // Arrange - Chuẩn bị dữ liệu lấy địa chỉ mặc định
      const userId = 1
      const mockDefaultAddress = createTestData.addressEntity({ isDefault: true })

      mockAddressRepository.findDefault.mockResolvedValue(mockDefaultAddress)

      // Act - Thực hiện lấy địa chỉ mặc định
      const result = await service.getDefaultAddress(userId)

      // Assert - Kiểm tra kết quả
      expect(result).toEqual(mockDefaultAddress)
      expect(mockAddressRepository.findDefault).toHaveBeenCalledWith(userId)
    })

    it('should return null when no default address exists', async () => {
      // Arrange - Chuẩn bị dữ liệu khi không có địa chỉ mặc định
      const userId = 1

      mockAddressRepository.findDefault.mockResolvedValue(null)

      // Act - Thực hiện lấy địa chỉ mặc định
      const result = await service.getDefaultAddress(userId)

      // Assert - Kiểm tra kết quả
      expect(result).toBeNull()
      expect(mockAddressRepository.findDefault).toHaveBeenCalledWith(userId)
    })
  })

  describe('edge cases and error handling', () => {
    it('should handle repository errors gracefully', async () => {
      // Arrange - Chuẩn bị lỗi từ repository
      const userId = 1
      const addressId = 1
      const repositoryError = new Error('Database connection failed')

      mockAddressRepository.findById.mockRejectedValue(repositoryError)

      // Act & Assert - Thực hiện test và kiểm tra lỗi từ repository
      await expect(service.getAddressDetail(addressId, userId)).rejects.toThrow('Database connection failed')
    })

    it('should handle concurrent default address updates', async () => {
      // Arrange - Chuẩn bị test concurrent updates
      const userId = 1
      const addressId = 1
      const createData = createTestData.createAddressBody({ isDefault: true })
      const mockAddress = createTestData.addressEntity({ isDefault: true })

      mockAddressRepository.countByUser.mockResolvedValue(5)
      mockAddressRepository.create.mockResolvedValue(mockAddress)

      // Act - Thực hiện tạo địa chỉ với isDefault = true
      const result = await service.createAddress(userId, createData)

      // Assert - Kiểm tra kết quả
      expect(result.isDefault).toBe(true)
      expect(mockAddressRepository.create).toHaveBeenCalledWith(userId, createData)
    })

    it('should handle various phone number formats', async () => {
      // Arrange - Chuẩn bị test các định dạng số điện thoại khác nhau
      const userId = 1
      const invalidPhones = ['123', '012345678901234', 'abc', '+841234567890']

      mockAddressRepository.countByUser.mockResolvedValue(5)

      // Act & Assert - Kiểm tra từng định dạng số điện thoại không hợp lệ
      for (const phone of invalidPhones) {
        const createData = createTestData.createAddressBody({ phone })
        await expect(service.createAddress(userId, createData)).rejects.toThrow()
      }
    })
  })
})
