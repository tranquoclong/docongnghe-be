import { Test, TestingModule } from '@nestjs/testing'
import { NotFoundRecordException } from 'src/shared/error'
import { isNotFoundPrismaError } from 'src/shared/helpers'
import { CreateBrandBodyType, UpdateBrandBodyType } from '../brand.model'
import { BrandRepo } from '../brand.repo'
import { BrandService } from '../brand.service'
import { MESSAGES } from 'src/shared/constants/app.constant'

// Mock helper function
jest.mock('src/shared/helpers', () => ({
  isNotFoundPrismaError: jest.fn(),
}))

const mockIsNotFoundPrismaError = isNotFoundPrismaError as jest.MockedFunction<typeof isNotFoundPrismaError>

/**
 * BRAND SERVICE UNIT TESTS
 *
 * Module này test service layer của Brand
 * Brand là module quan trọng cho ecommerce - quản lý thương hiệu sản phẩm
 *
 * Test Coverage:
 * - List brands với pagination
 * - Find brand by ID
 * - Create brand
 * - Update brand
 * - Delete brand (soft delete)
 * - Error handling (NotFound)
 * - I18n language support
 */

describe('BrandService', () => {
  let service: BrandService
  let mockBrandRepo: jest.Mocked<BrandRepo>

  // Test data factories
  const createBrand = (overrides = {}) => ({
    id: 1,
    name: 'Nike',
    logo: 'https://example.com/nike-logo.png',
    brandTranslations: [],
    createdById: 1,
    updatedById: null,
    deletedById: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    deletedAt: null,
    ...overrides,
  })

  const createBrandData = (overrides = {}): CreateBrandBodyType => ({
    name: 'Adidas',
    logo: 'https://example.com/adidas-logo.png',
    ...overrides,
  })

  beforeEach(async () => {
    mockBrandRepo = {
      list: jest.fn(),
      findById: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    } as any

    const module: TestingModule = await Test.createTestingModule({
      providers: [BrandService, { provide: BrandRepo, useValue: mockBrandRepo }],
    }).compile()

    service = module.get<BrandService>(BrandService)
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  // ============================================
  // LIST BRANDS
  // ============================================

  describe('list', () => {
    it('should return paginated list of brands', async () => {
      // Arrange
      const pagination = { page: 1, limit: 10 }
      const mockResponse = {
        data: [createBrand(), createBrand({ id: 2, name: 'Puma' })],
        totalItems: 2,
        page: 1,
        limit: 10,
        totalPages: 1,
      }

      mockBrandRepo.list.mockResolvedValue(mockResponse as any)

      // Act
      const result = await service.list(pagination)

      // Assert
      expect(result).toEqual(mockResponse)
      expect(mockBrandRepo.list).toHaveBeenCalledWith(pagination, undefined)
    })

    it('should handle empty brand list', async () => {
      // Arrange
      const pagination = { page: 1, limit: 10 }
      const mockResponse = {
        data: [],
        totalItems: 0,
        page: 1,
        limit: 10,
        totalPages: 0,
      }

      mockBrandRepo.list.mockResolvedValue(mockResponse as any)

      // Act
      const result = await service.list(pagination)

      // Assert
      expect(result.data).toHaveLength(0)
      expect(result.totalItems).toBe(0)
    })

    it('should handle pagination correctly', async () => {
      // Arrange
      const pagination = { page: 2, limit: 5 }
      const mockResponse = {
        data: [createBrand()],
        totalItems: 10,
        page: 2,
        limit: 5,
        totalPages: 2,
      }

      mockBrandRepo.list.mockResolvedValue(mockResponse as any)

      // Act
      const result = await service.list(pagination)

      // Assert
      expect(result.page).toBe(2)
      expect(result.limit).toBe(5)
      expect(result.totalPages).toBe(2)
    })
  })

  // ============================================
  // FIND BRAND BY ID
  // ============================================

  describe('findById', () => {
    it('should return brand when found', async () => {
      // Arrange
      const brandId = 1
      const mockBrand = createBrand({ id: brandId })

      mockBrandRepo.findById.mockResolvedValue(mockBrand as any)

      // Act
      const result = await service.findById(brandId)

      // Assert
      expect(result).toEqual(mockBrand)
      expect(mockBrandRepo.findById).toHaveBeenCalledWith(brandId, undefined)
    })

    it('should throw NotFoundRecordException when brand not found', async () => {
      // Arrange
      const brandId = 999

      mockBrandRepo.findById.mockResolvedValue(null)

      // Act & Assert
      await expect(service.findById(brandId)).rejects.toThrow(NotFoundRecordException)
    })
  })

  // ============================================
  // CREATE BRAND
  // ============================================

  describe('create', () => {
    it('should create brand successfully', async () => {
      // Arrange
      const data = createBrandData()
      const createdById = 1
      const mockCreatedBrand = createBrand({ ...data, createdById })

      mockBrandRepo.create.mockResolvedValue(mockCreatedBrand as any)

      // Act
      const result = await service.create({ data, createdById })

      // Assert
      expect(result).toEqual(mockCreatedBrand)
      expect(mockBrandRepo.create).toHaveBeenCalledWith({ createdById, data })
    })

    it('should create brand with valid logo URL', async () => {
      // Arrange
      const data = createBrandData({ logo: 'https://cdn.example.com/brand-logo.jpg' })
      const createdById = 1

      mockBrandRepo.create.mockResolvedValue(createBrand(data) as any)

      // Act
      await service.create({ data, createdById })

      // Assert
      expect(mockBrandRepo.create).toHaveBeenCalledWith({
        createdById,
        data: expect.objectContaining({
          logo: 'https://cdn.example.com/brand-logo.jpg',
        }),
      })
    })
  })

  // ============================================
  // UPDATE BRAND
  // ============================================

  describe('update', () => {
    it('should update brand successfully', async () => {
      // Arrange
      const id = 1
      const data: UpdateBrandBodyType = { name: 'Nike Updated', logo: 'https://example.com/new-logo.png' }
      const updatedById = 1
      const mockUpdatedBrand = createBrand({ id, ...data, updatedById })

      mockBrandRepo.update.mockResolvedValue(mockUpdatedBrand as any)

      // Act
      const result = await service.update({ id, data, updatedById })

      // Assert
      expect(result).toEqual(mockUpdatedBrand)
      expect(mockBrandRepo.update).toHaveBeenCalledWith({ id, updatedById, data })
    })

    it('should throw NotFoundRecordException when updating non-existent brand', async () => {
      // Arrange
      const id = 999
      const data: UpdateBrandBodyType = { name: 'Test', logo: 'https://example.com/logo.png' }
      const updatedById = 1

      // Mock Prisma P2025 error (Record not found)
      const prismaError = new Error('Record not found')
      Object.assign(prismaError, {
        code: 'P2025',
        clientVersion: '5.0.0',
        meta: { cause: 'Record to update not found.' },
      })
      mockBrandRepo.update.mockRejectedValue(prismaError)
      mockIsNotFoundPrismaError.mockReturnValue(true)

      // Act & Assert
      await expect(service.update({ id, data, updatedById })).rejects.toThrow(NotFoundRecordException)
    })
  })

  // ============================================
  // DELETE BRAND
  // ============================================

  describe('delete', () => {
    it('should delete brand successfully (soft delete)', async () => {
      // Arrange
      const id = 1
      const deletedById = 1

      mockBrandRepo.delete.mockResolvedValue(createBrand({ id, deletedById }) as any)

      // Act
      const result = await service.delete({ id, deletedById })

      // Assert
      expect(result).toEqual({ message: MESSAGES.DELETE_SUCCESS })
      expect(mockBrandRepo.delete).toHaveBeenCalledWith({ id, deletedById })
    })

    it('should throw NotFoundRecordException when deleting non-existent brand', async () => {
      // Arrange
      const id = 999
      const deletedById = 1

      // Mock Prisma P2025 error (Record not found)
      const prismaError = new Error('Record not found')
      Object.assign(prismaError, {
        code: 'P2025',
        clientVersion: '5.0.0',
        meta: { cause: 'Record to delete not found.' },
      })
      mockBrandRepo.delete.mockRejectedValue(prismaError)
      mockIsNotFoundPrismaError.mockReturnValue(true)

      // Act & Assert
      await expect(service.delete({ id, deletedById })).rejects.toThrow(NotFoundRecordException)
    })
  })
})
