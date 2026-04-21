import { Test, TestingModule } from '@nestjs/testing'
import { PrismaService } from '../../../shared/services/prisma.service'
import { CreateAddressBody, ListAddressesQuery, UpdateAddressBody } from '../address.dto'
import { AddressRepository } from '../address.repo'

describe('AddressRepository', () => {
  let repository: AddressRepository
  let prismaService: PrismaService

  // Mock PrismaService
  const mockPrismaService = {
    address: {
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      delete: jest.fn(),
    },
    $transaction: jest.fn(),
  }

  // Test data factories
  const createTestData = {
    createAddressBody: (): CreateAddressBody => ({
      name: 'Nguyễn Văn A',
      phone: '0123456789',
      provinceId: '1',
      provinceName: 'Hà Nội',
      districtId: '1',
      districtName: 'Quận Ba Đình',
      wardId: '1',
      wardName: 'Phường Điện Biên',
      detail: 'Số 1 Hoàng Hoa Thám',
      isDefault: false,
    }),
    updateAddressBody: (): UpdateAddressBody => ({
      name: 'Nguyễn Văn B',
      phone: '0987654321',
      isDefault: true,
    }),
    address: (overrides = {}) => ({
      id: 1,
      userId: 1,
      name: 'Nguyễn Văn A',
      phone: '0123456789',
      provinceId: '1',
      provinceName: 'Hà Nội',
      districtId: '1',
      districtName: 'Quận Ba Đình',
      wardId: '1',
      wardName: 'Phường Điện Biên',
      detail: 'Số 1 Hoàng Hoa Thám',
      fullAddress: 'Số 1 Hoàng Hoa Thám, Phường Điện Biên, Quận Ba Đình, Hà Nội',
      isDefault: false,
      isActive: true,
      createdAt: new Date().toISOString() as any,
      updatedAt: new Date().toISOString() as any,
      ...overrides,
    }),
    listAddressesQuery: (): ListAddressesQuery => ({
      page: 1,
      limit: 10,
    }),
  }

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AddressRepository,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile()

    repository = module.get<AddressRepository>(AddressRepository)
    prismaService = module.get<PrismaService>(PrismaService)

    // Reset mocks
    jest.clearAllMocks()
  })

  describe('create', () => {
    it('should create address successfully', async () => {
      // Arrange - Chuẩn bị dữ liệu
      const userId = 1
      const body = createTestData.createAddressBody()
      const mockAddress = createTestData.address({ userId })

      mockPrismaService.address.create.mockResolvedValue(mockAddress)

      // Act - Thực hiện tạo address
      const result = await repository.create(userId, body)

      // Assert - Kiểm tra kết quả
      expect(result).toEqual(mockAddress)
      expect(mockPrismaService.address.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId,
          name: body.name,
          phone: body.phone,
          fullAddress: expect.stringContaining(body.detail),
        }),
      })
    })

    it('should unset other default addresses when creating default address', async () => {
      // Arrange - Chuẩn bị dữ liệu với isDefault = true
      const userId = 1
      const body = createTestData.createAddressBody()
      body.isDefault = true
      const mockAddress = createTestData.address({ userId, isDefault: true })

      mockPrismaService.address.updateMany.mockResolvedValue({ count: 1 })
      mockPrismaService.address.create.mockResolvedValue(mockAddress)

      // Act - Thực hiện tạo address
      const result = await repository.create(userId, body)

      // Assert - Kiểm tra kết quả
      expect(result).toEqual(mockAddress)
      expect(mockPrismaService.address.updateMany).toHaveBeenCalledWith({
        where: { userId, isDefault: true },
        data: { isDefault: false },
      })
    })
  })

  describe('update', () => {
    it('should update address successfully', async () => {
      // Arrange - Chuẩn bị dữ liệu
      const id = 1
      const userId = 1
      const body = createTestData.updateAddressBody()
      const mockAddress = createTestData.address({ id, userId, ...body })

      mockPrismaService.address.update.mockResolvedValue(mockAddress)

      // Act - Thực hiện cập nhật
      const result = await repository.update(id, userId, body)

      // Assert - Kiểm tra kết quả
      expect(result).toEqual(mockAddress)
      expect(mockPrismaService.address.update).toHaveBeenCalled()
    })

    it('should update fullAddress when address components change', async () => {
      // Arrange - Chuẩn bị dữ liệu với thay đổi địa chỉ
      const id = 1
      const userId = 1
      const body: UpdateAddressBody = {
        detail: 'Số 2 Hoàng Hoa Thám',
        wardName: 'Phường Cống Vị',
      }
      const currentAddress = createTestData.address({ id, userId })
      const mockAddress = createTestData.address({ id, userId, ...body })

      mockPrismaService.address.findFirst.mockResolvedValue(currentAddress)
      mockPrismaService.address.update.mockResolvedValue(mockAddress)

      // Act - Thực hiện cập nhật
      const result = await repository.update(id, userId, body)

      // Assert - Kiểm tra kết quả
      expect(result).toEqual(mockAddress)
      expect(mockPrismaService.address.findFirst).toHaveBeenCalled()
    })

    it('should unset other default addresses when setting isDefault to true', async () => {
      // Arrange - Chuẩn bị dữ liệu với isDefault = true
      const id = 1
      const userId = 1
      const body: UpdateAddressBody = { isDefault: true }
      const mockAddress = createTestData.address({ id, userId, isDefault: true })

      mockPrismaService.address.updateMany.mockResolvedValue({ count: 1 })
      mockPrismaService.address.update.mockResolvedValue(mockAddress)

      // Act - Thực hiện cập nhật
      const result = await repository.update(id, userId, body)

      // Assert - Kiểm tra kết quả
      expect(result).toEqual(mockAddress)
      expect(mockPrismaService.address.updateMany).toHaveBeenCalledWith({
        where: { userId, isDefault: true, id: { not: id } },
        data: { isDefault: false },
      })
    })

    it('should set isDefault to false when explicitly requested', async () => {
      // Arrange - Chuẩn bị dữ liệu với isDefault = false
      const id = 1
      const userId = 1
      const body: UpdateAddressBody = { isDefault: false }
      const mockAddress = createTestData.address({ id, userId, isDefault: false })

      mockPrismaService.address.update.mockResolvedValue(mockAddress)

      // Act - Thực hiện cập nhật
      const result = await repository.update(id, userId, body)

      // Assert - Kiểm tra kết quả
      expect(result).toEqual(mockAddress)
    })

    it('should update all address fields individually', async () => {
      // Arrange - Chuẩn bị dữ liệu với tất cả các fields
      const id = 1
      const userId = 1
      const body: UpdateAddressBody = {
        name: 'Updated Name',
        phone: '0999999999',
        provinceId: '2',
        provinceName: 'TP.HCM',
        districtId: '2',
        districtName: 'Quận 1',
        wardId: '2',
        wardName: 'Phường Bến Nghé',
        detail: 'Số 100 Nguyễn Huệ',
      }
      const currentAddress = createTestData.address({ id, userId })
      const mockAddress = createTestData.address({ id, userId, ...body })

      mockPrismaService.address.findFirst.mockResolvedValue(currentAddress)
      mockPrismaService.address.update.mockResolvedValue(mockAddress)

      // Act - Thực hiện cập nhật
      const result = await repository.update(id, userId, body)

      // Assert - Kiểm tra kết quả
      expect(result).toEqual(mockAddress)
      expect(mockPrismaService.address.update).toHaveBeenCalledWith({
        where: { id, userId },
        data: expect.objectContaining({
          name: body.name,
          phone: body.phone,
          provinceId: body.provinceId,
          provinceName: body.provinceName,
          districtId: body.districtId,
          districtName: body.districtName,
          wardId: body.wardId,
          wardName: body.wardName,
          detail: body.detail,
          fullAddress: expect.any(String),
        }),
      })
    })

    it('should not update fullAddress when current address not found', async () => {
      // Arrange - Chuẩn bị dữ liệu khi không tìm thấy address hiện tại
      const id = 1
      const userId = 1
      const body: UpdateAddressBody = {
        detail: 'Số 2 Hoàng Hoa Thám',
      }
      const mockAddress = createTestData.address({ id, userId })

      mockPrismaService.address.findFirst.mockResolvedValue(null)
      mockPrismaService.address.update.mockResolvedValue(mockAddress)

      // Act - Thực hiện cập nhật
      const result = await repository.update(id, userId, body)

      // Assert - Kiểm tra kết quả
      expect(result).toEqual(mockAddress)
      expect(mockPrismaService.address.findFirst).toHaveBeenCalled()
    })

    it('should update only provinceName without other address fields', async () => {
      // Arrange - Chuẩn bị dữ liệu chỉ update provinceName
      const id = 1
      const userId = 1
      const body: UpdateAddressBody = {
        provinceName: 'Đà Nẵng',
      }
      const currentAddress = createTestData.address({ id, userId })
      const mockAddress = createTestData.address({ id, userId, provinceName: 'Đà Nẵng' })

      mockPrismaService.address.findFirst.mockResolvedValue(currentAddress)
      mockPrismaService.address.update.mockResolvedValue(mockAddress)

      // Act - Thực hiện cập nhật
      const result = await repository.update(id, userId, body)

      // Assert - Kiểm tra kết quả
      expect(result).toEqual(mockAddress)
      expect(mockPrismaService.address.update).toHaveBeenCalledWith({
        where: { id, userId },
        data: expect.objectContaining({
          provinceName: body.provinceName,
          fullAddress: expect.any(String),
        }),
      })
    })

    it('should update only districtName without other address fields', async () => {
      // Arrange - Chuẩn bị dữ liệu chỉ update districtName
      const id = 1
      const userId = 1
      const body: UpdateAddressBody = {
        districtName: 'Quận Hoàn Kiếm',
      }
      const currentAddress = createTestData.address({ id, userId })
      const mockAddress = createTestData.address({ id, userId, districtName: 'Quận Hoàn Kiếm' })

      mockPrismaService.address.findFirst.mockResolvedValue(currentAddress)
      mockPrismaService.address.update.mockResolvedValue(mockAddress)

      // Act - Thực hiện cập nhật
      const result = await repository.update(id, userId, body)

      // Assert - Kiểm tra kết quả
      expect(result).toEqual(mockAddress)
      expect(mockPrismaService.address.update).toHaveBeenCalledWith({
        where: { id, userId },
        data: expect.objectContaining({
          districtName: body.districtName,
          fullAddress: expect.any(String),
        }),
      })
    })
  })

  describe('findById', () => {
    it('should find address by id successfully', async () => {
      // Arrange - Chuẩn bị dữ liệu
      const id = 1
      const userId = 1
      const mockAddress = createTestData.address({ id, userId })

      mockPrismaService.address.findFirst.mockResolvedValue(mockAddress)

      // Act - Thực hiện tìm kiếm
      const result = await repository.findById(id, userId)

      // Assert - Kiểm tra kết quả
      expect(result).toEqual(mockAddress)
      expect(mockPrismaService.address.findFirst).toHaveBeenCalledWith({
        where: { id, userId, isActive: true },
      })
    })

    it('should return null when address not found', async () => {
      // Arrange - Chuẩn bị dữ liệu không tồn tại
      const id = 999
      const userId = 1

      mockPrismaService.address.findFirst.mockResolvedValue(null)

      // Act - Thực hiện tìm kiếm
      const result = await repository.findById(id, userId)

      // Assert - Kiểm tra kết quả
      expect(result).toBeNull()
    })
  })

  describe('findMany', () => {
    it('should find addresses with pagination', async () => {
      // Arrange - Chuẩn bị dữ liệu
      const userId = 1
      const query = createTestData.listAddressesQuery()
      const mockAddresses = [createTestData.address({ userId }), createTestData.address({ id: 2, userId })]
      const total = 2

      mockPrismaService.address.findMany.mockResolvedValue(mockAddresses)
      mockPrismaService.address.count.mockResolvedValue(total)

      // Act - Thực hiện tìm kiếm
      const result = await repository.findMany(userId, query)

      // Assert - Kiểm tra kết quả
      expect(result).toEqual({
        data: mockAddresses,
        total,
        page: query.page,
        limit: query.limit,
      })
    })

    it('should filter by isActive', async () => {
      // Arrange - Chuẩn bị dữ liệu với filter isActive
      const userId = 1
      const query: ListAddressesQuery = { page: 1, limit: 10, isActive: true }
      const mockAddresses = [createTestData.address({ userId, isActive: true })]

      mockPrismaService.address.findMany.mockResolvedValue(mockAddresses)
      mockPrismaService.address.count.mockResolvedValue(1)

      // Act - Thực hiện tìm kiếm
      const result = await repository.findMany(userId, query)

      // Assert - Kiểm tra kết quả
      expect(result.data).toEqual(mockAddresses)
    })

    it('should filter by search query', async () => {
      // Arrange - Chuẩn bị dữ liệu với search
      const userId = 1
      const query: ListAddressesQuery = { page: 1, limit: 10, search: 'Hà Nội' }
      const mockAddresses = [createTestData.address({ userId })]

      mockPrismaService.address.findMany.mockResolvedValue(mockAddresses)
      mockPrismaService.address.count.mockResolvedValue(1)

      // Act - Thực hiện tìm kiếm
      const result = await repository.findMany(userId, query)

      // Assert - Kiểm tra kết quả
      expect(result.data).toEqual(mockAddresses)
    })

    it('should use default page and limit when not provided', async () => {
      // Arrange - Chuẩn bị dữ liệu không có page và limit
      const userId = 1
      const query = {} as ListAddressesQuery
      const mockAddresses = [createTestData.address({ userId })]

      mockPrismaService.address.findMany.mockResolvedValue(mockAddresses)
      mockPrismaService.address.count.mockResolvedValue(1)

      // Act - Thực hiện tìm kiếm
      const result = await repository.findMany(userId, query)

      // Assert - Kiểm tra kết quả sử dụng default values
      expect(result.page).toBe(1)
      expect(result.limit).toBe(10)
      expect(mockPrismaService.address.findMany).toHaveBeenCalledWith({
        where: { userId },
        orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
        skip: 0,
        take: 10,
      })
    })

    it('should filter by isActive false', async () => {
      // Arrange - Chuẩn bị dữ liệu với isActive = false
      const userId = 1
      const query: ListAddressesQuery = { page: 1, limit: 10, isActive: false }
      const mockAddresses = [createTestData.address({ userId, isActive: false })]

      mockPrismaService.address.findMany.mockResolvedValue(mockAddresses)
      mockPrismaService.address.count.mockResolvedValue(1)

      // Act - Thực hiện tìm kiếm
      const result = await repository.findMany(userId, query)

      // Assert - Kiểm tra kết quả
      expect(result.data).toEqual(mockAddresses)
      expect(mockPrismaService.address.findMany).toHaveBeenCalledWith({
        where: { userId, isActive: false },
        orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
        skip: 0,
        take: 10,
      })
    })
  })

  describe('delete', () => {
    it('should soft delete address successfully', async () => {
      // Arrange - Chuẩn bị dữ liệu
      const id = 1
      const userId = 1
      const mockAddress = createTestData.address({ id, userId, isActive: false })

      mockPrismaService.address.update.mockResolvedValue(mockAddress)

      // Act - Thực hiện xóa
      const result = await repository.delete(id, userId)

      // Assert - Kiểm tra kết quả
      expect(result).toEqual(mockAddress)
      expect(mockPrismaService.address.update).toHaveBeenCalledWith({
        where: { id, userId },
        data: { isActive: false },
      })
    })
  })

  describe('hardDelete', () => {
    it('should hard delete address successfully', async () => {
      // Arrange - Chuẩn bị dữ liệu
      const id = 1
      const userId = 1
      const mockAddress = createTestData.address({ id, userId })

      mockPrismaService.address.delete.mockResolvedValue(mockAddress)

      // Act - Thực hiện xóa vĩnh viễn
      const result = await repository.hardDelete(id, userId)

      // Assert - Kiểm tra kết quả
      expect(result).toEqual(mockAddress)
      expect(mockPrismaService.address.delete).toHaveBeenCalledWith({
        where: { id, userId },
      })
    })
  })

  describe('setDefault', () => {
    it('should set address as default successfully', async () => {
      // Arrange - Chuẩn bị dữ liệu
      const id = 1
      const userId = 1
      const mockAddress = createTestData.address({ id, userId, isDefault: true })

      mockPrismaService.$transaction.mockResolvedValue([{ count: 1 }, mockAddress])
      mockPrismaService.address.findFirst.mockResolvedValue(mockAddress)

      // Act - Thực hiện set default
      const result = await repository.setDefault(id, userId)

      // Assert - Kiểm tra kết quả
      expect(result).toEqual(mockAddress)
      expect(mockPrismaService.$transaction).toHaveBeenCalled()
    })
  })

  describe('findDefault', () => {
    it('should find default address successfully', async () => {
      // Arrange - Chuẩn bị dữ liệu
      const userId = 1
      const mockAddress = createTestData.address({ userId, isDefault: true })

      mockPrismaService.address.findFirst.mockResolvedValue(mockAddress)

      // Act - Thực hiện tìm kiếm
      const result = await repository.findDefault(userId)

      // Assert - Kiểm tra kết quả
      expect(result).toEqual(mockAddress)
      expect(mockPrismaService.address.findFirst).toHaveBeenCalledWith({
        where: { userId, isDefault: true, isActive: true },
      })
    })

    it('should return null when no default address found', async () => {
      // Arrange - Chuẩn bị dữ liệu không có default
      const userId = 1

      mockPrismaService.address.findFirst.mockResolvedValue(null)

      // Act - Thực hiện tìm kiếm
      const result = await repository.findDefault(userId)

      // Assert - Kiểm tra kết quả
      expect(result).toBeNull()
    })
  })

  describe('countByUser', () => {
    it('should count addresses by user successfully', async () => {
      // Arrange - Chuẩn bị dữ liệu
      const userId = 1
      const count = 5

      mockPrismaService.address.count.mockResolvedValue(count)

      // Act - Thực hiện đếm
      const result = await repository.countByUser(userId)

      // Assert - Kiểm tra kết quả
      expect(result).toBe(count)
      expect(mockPrismaService.address.count).toHaveBeenCalledWith({
        where: { userId, isActive: true },
      })
    })
  })

  describe('isDefaultAddress', () => {
    it('should return true when address is default', async () => {
      // Arrange - Chuẩn bị dữ liệu default address
      const id = 1
      const userId = 1
      const mockAddress = createTestData.address({ id, userId, isDefault: true })

      mockPrismaService.address.findFirst.mockResolvedValue(mockAddress)

      // Act - Thực hiện kiểm tra
      const result = await repository.isDefaultAddress(id, userId)

      // Assert - Kiểm tra kết quả
      expect(result).toBe(true)
      expect(mockPrismaService.address.findFirst).toHaveBeenCalledWith({
        where: { id, userId, isDefault: true, isActive: true },
      })
    })

    it('should return false when address is not default', async () => {
      // Arrange - Chuẩn bị dữ liệu không phải default
      const id = 1
      const userId = 1

      mockPrismaService.address.findFirst.mockResolvedValue(null)

      // Act - Thực hiện kiểm tra
      const result = await repository.isDefaultAddress(id, userId)

      // Assert - Kiểm tra kết quả
      expect(result).toBe(false)
    })
  })
})
