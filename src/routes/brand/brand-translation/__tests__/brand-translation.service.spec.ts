import { Test, TestingModule } from '@nestjs/testing'
import { BrandTranslationAlreadyExistsException } from 'src/routes/brand/brand-translation/brand-translation.error'
import {
  CreateBrandTranslationBodyType,
  UpdateBrandTranslationBodyType,
} from 'src/routes/brand/brand-translation/brand-translation.model'
import { BrandTranslationRepo } from 'src/routes/brand/brand-translation/brand-translation.repo'
import { BrandTranslationService } from 'src/routes/brand/brand-translation/brand-translation.service'
import { isNotFoundPrismaError, isUniqueConstraintPrismaError } from 'src/shared/helpers'
import { MESSAGES } from 'src/shared/constants/app.constant'

// Mock helpers
jest.mock('src/shared/helpers', () => ({
  isNotFoundPrismaError: jest.fn(),
  isUniqueConstraintPrismaError: jest.fn(),
}))

const mockIsNotFoundPrismaError = isNotFoundPrismaError as jest.MockedFunction<typeof isNotFoundPrismaError>
const mockIsUniqueConstraintPrismaError = isUniqueConstraintPrismaError as jest.MockedFunction<
  typeof isUniqueConstraintPrismaError
>

/**
 * BRAND TRANSLATION SERVICE UNIT TESTS
 *
 * Test coverage cho BrandTranslationService - HIGH PRIORITY module cho I18n support
 * Service quản lý CRUD operations cho brand translations
 *
 * Test Coverage:
 * - findById: Tìm brand translation theo ID
 * - create: Tạo brand translation mới
 * - update: Cập nhật brand translation
 * - delete: Xóa brand translation (soft delete)
 */
describe('BrandTranslationService', () => {
  let service: BrandTranslationService
  let brandTranslationRepo: jest.Mocked<BrandTranslationRepo>

  // Test data factory
  const createTestData = {
    brandTranslation: (overrides = {}) => ({
      id: 1,
      brandId: 1,
      languageId: 'vi',
      name: 'Thương hiệu Test',
      description: 'Mô tả thương hiệu',
      createdById: 1,
      updatedById: null,
      deletedById: null,
      deletedAt: null,
      createdAt: '2024-01-01T00:00:00.000Z',
      updatedAt: '2024-01-01T00:00:00.000Z',
      ...overrides,
    }),
    createBrandTranslationData: (overrides = {}): CreateBrandTranslationBodyType => ({
      brandId: 1,
      languageId: 'en',
      name: 'Test Brand',
      description: 'Brand description',
      ...overrides,
    }),
    updateBrandTranslationData: (overrides = {}): UpdateBrandTranslationBodyType => ({
      brandId: 1,
      languageId: 'en',
      name: 'Updated Brand',
      description: 'Updated description',
      ...overrides,
    }),
  }

  beforeEach(async () => {
    // Reset mocks
    jest.clearAllMocks()
    mockIsNotFoundPrismaError.mockReturnValue(false)
    mockIsUniqueConstraintPrismaError.mockReturnValue(false)

    // Create mock repository
    const mockBrandTranslationRepo = {
      findById: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    }

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BrandTranslationService,
        {
          provide: BrandTranslationRepo,
          useValue: mockBrandTranslationRepo,
        },
      ],
    }).compile()

    service = module.get<BrandTranslationService>(BrandTranslationService)
    brandTranslationRepo = module.get(BrandTranslationRepo)
  })

  describe('findById', () => {
    it('should return brand translation when found', async () => {
      // Arrange - Chuẩn bị dữ liệu
      const mockBrandTranslation = createTestData.brandTranslation()
      brandTranslationRepo.findById.mockResolvedValue(mockBrandTranslation as any)

      // Act - Thực hiện findById
      const result = await service.findById(1)

      // Assert - Kiểm tra kết quả
      expect(result).toEqual(mockBrandTranslation)
      expect(brandTranslationRepo.findById).toHaveBeenCalledWith(1)
    })

    it('should throw NotFoundRecordException when brand translation not found', async () => {
      // Arrange - Chuẩn bị dữ liệu
      brandTranslationRepo.findById.mockResolvedValue(null)

      // Act & Assert - Thực hiện findById và kiểm tra exception
      await expect(service.findById(999)).rejects.toThrow('Error.NotFound')
    })
  })

  describe('create', () => {
    it('should create brand translation successfully', async () => {
      // Arrange - Chuẩn bị dữ liệu
      const createData = createTestData.createBrandTranslationData()
      const mockBrandTranslation = createTestData.brandTranslation({ languageId: 'en', name: 'Test Brand' })
      brandTranslationRepo.create.mockResolvedValue(mockBrandTranslation as any)

      // Act - Thực hiện create
      const result = await service.create({
        data: createData,
        createdById: 1,
      })

      // Assert - Kiểm tra kết quả
      expect(result).toEqual(mockBrandTranslation)
      expect(brandTranslationRepo.create).toHaveBeenCalledWith({
        createdById: 1,
        data: createData,
      })
    })

    it('should throw BrandTranslationAlreadyExistsException when translation already exists', async () => {
      // Arrange - Chuẩn bị dữ liệu
      const createData = createTestData.createBrandTranslationData()
      const prismaError = new Error('Unique constraint failed')
      ;(prismaError as any).code = 'P2002'
      brandTranslationRepo.create.mockRejectedValue(prismaError)
      mockIsUniqueConstraintPrismaError.mockReturnValue(true)

      // Act & Assert - Thực hiện create và kiểm tra exception
      await expect(
        service.create({
          data: createData,
          createdById: 1,
        }),
      ).rejects.toThrow(BrandTranslationAlreadyExistsException)
    })

    it('should rethrow error when Prisma throws other error', async () => {
      // Arrange - Chuẩn bị dữ liệu
      const createData = createTestData.createBrandTranslationData()
      const otherError = new Error('Other error')
      brandTranslationRepo.create.mockRejectedValue(otherError)

      // Act & Assert - Thực hiện create và kiểm tra exception
      await expect(
        service.create({
          data: createData,
          createdById: 1,
        }),
      ).rejects.toThrow(otherError)
    })
  })

  describe('update', () => {
    it('should update brand translation successfully', async () => {
      // Arrange - Chuẩn bị dữ liệu
      const updateData = createTestData.updateBrandTranslationData()
      const mockBrandTranslation = createTestData.brandTranslation({ name: 'Updated Brand' })
      brandTranslationRepo.update.mockResolvedValue(mockBrandTranslation as any)

      // Act - Thực hiện update
      const result = await service.update({
        id: 1,
        data: updateData,
        updatedById: 1,
      })

      // Assert - Kiểm tra kết quả
      expect(result).toEqual(mockBrandTranslation)
      expect(brandTranslationRepo.update).toHaveBeenCalledWith({
        id: 1,
        updatedById: 1,
        data: updateData,
      })
    })

    it('should throw BrandTranslationAlreadyExistsException when unique constraint violated', async () => {
      // Arrange - Chuẩn bị dữ liệu
      const updateData = createTestData.updateBrandTranslationData()
      const prismaError = new Error('Unique constraint failed')
      ;(prismaError as any).code = 'P2002'
      brandTranslationRepo.update.mockRejectedValue(prismaError)
      mockIsUniqueConstraintPrismaError.mockReturnValue(true)

      // Act & Assert - Thực hiện update và kiểm tra exception
      await expect(
        service.update({
          id: 1,
          data: updateData,
          updatedById: 1,
        }),
      ).rejects.toThrow(BrandTranslationAlreadyExistsException)
    })

    it('should throw NotFoundRecordException when brand translation not found', async () => {
      // Arrange - Chuẩn bị dữ liệu
      const updateData = createTestData.updateBrandTranslationData()
      const prismaError = new Error('Record not found')
      ;(prismaError as any).code = 'P2025'
      brandTranslationRepo.update.mockRejectedValue(prismaError)
      mockIsNotFoundPrismaError.mockReturnValue(true)

      // Act & Assert - Thực hiện update và kiểm tra exception
      await expect(
        service.update({
          id: 999,
          data: updateData,
          updatedById: 1,
        }),
      ).rejects.toThrow('Error.NotFound')
    })

    it('should rethrow error when Prisma throws other error', async () => {
      // Arrange - Chuẩn bị dữ liệu
      const updateData = createTestData.updateBrandTranslationData()
      const otherError = new Error('Other error')
      brandTranslationRepo.update.mockRejectedValue(otherError)

      // Act & Assert - Thực hiện update và kiểm tra exception
      await expect(
        service.update({
          id: 1,
          data: updateData,
          updatedById: 1,
        }),
      ).rejects.toThrow(otherError)
    })
  })

  describe('delete', () => {
    it('should delete brand translation successfully', async () => {
      // Arrange - Chuẩn bị dữ liệu
      brandTranslationRepo.delete.mockResolvedValue(undefined as any)

      // Act - Thực hiện delete
      const result = await service.delete({
        id: 1,
        deletedById: 1,
      })

      // Assert - Kiểm tra kết quả
      expect(result).toEqual({ message: MESSAGES.DELETE_SUCCESS })
      expect(brandTranslationRepo.delete).toHaveBeenCalledWith({
        id: 1,
        deletedById: 1,
      })
    })

    it('should throw NotFoundRecordException when brand translation not found', async () => {
      // Arrange - Chuẩn bị dữ liệu
      const prismaError = new Error('Record not found')
      ;(prismaError as any).code = 'P2025'
      brandTranslationRepo.delete.mockRejectedValue(prismaError)
      mockIsNotFoundPrismaError.mockReturnValue(true)

      // Act & Assert - Thực hiện delete và kiểm tra exception
      await expect(
        service.delete({
          id: 999,
          deletedById: 1,
        }),
      ).rejects.toThrow('Error.NotFound')
    })

    it('should rethrow error when Prisma throws other error', async () => {
      // Arrange - Chuẩn bị dữ liệu
      const otherError = new Error('Other error')
      brandTranslationRepo.delete.mockRejectedValue(otherError)

      // Act & Assert - Thực hiện delete và kiểm tra exception
      await expect(
        service.delete({
          id: 1,
          deletedById: 1,
        }),
      ).rejects.toThrow(otherError)
    })
  })
})
