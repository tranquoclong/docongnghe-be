import { Test, TestingModule } from '@nestjs/testing'
import { PaginationQueryDTO } from '../../../shared/dtos/request.dto'
import { BrandController } from '../brand.controller'
import { CreateBrandBodyDTO, GetBrandParamsDTO, UpdateBrandBodyDTO } from '../brand.dto'
import { BrandService } from '../brand.service'

/**
 * BRAND CONTROLLER UNIT TESTS
 *
 * Test coverage cho BrandController với 5 endpoints:
 * - GET /brands (list) - Public endpoint với pagination
 * - GET /brands/:brandId (findById) - Public endpoint
 * - POST /brands (create) - Protected endpoint
 * - PUT /brands/:brandId (update) - Protected endpoint
 * - DELETE /brands/:brandId (delete) - Protected endpoint (soft delete)
 */

describe('BrandController', () => {
  let controller: BrandController
  let mockBrandService: jest.Mocked<BrandService>

  // ===== TEST DATA FACTORIES =====

  const createMockBrand = (overrides = {}) => ({
    id: 1,
    name: 'Nike',
    logo: 'https://example.com/nike-logo.png',
    brandTranslations: [],
    createdById: 1,
    updatedById: null,
    deletedById: null,
    deletedAt: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  })

  const createMockBrandsList = () => ({
    data: [
      createMockBrand({ id: 1, name: 'Nike' }),
      createMockBrand({ id: 2, name: 'Adidas', logo: 'https://example.com/adidas-logo.png' }),
      createMockBrand({ id: 3, name: 'Puma', logo: 'https://example.com/puma-logo.png' }),
    ],
    totalItems: 3,
    page: 1,
    limit: 10,
    totalPages: 1,
  })

  // ===== SETUP & TEARDOWN =====

  beforeEach(async () => {
    // Tạo mock service với tất cả methods
    mockBrandService = {
      list: jest.fn(),
      findById: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    } as any

    const module: TestingModule = await Test.createTestingModule({
      controllers: [BrandController],
      providers: [
        {
          provide: BrandService,
          useValue: mockBrandService,
        },
      ],
    }).compile()

    controller = module.get<BrandController>(BrandController)
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  // ===== INITIALIZATION TESTS =====

  describe('Initialization', () => {
    it('should be defined', () => {
      expect(controller).toBeDefined()
    })

    it('should have brandService injected', () => {
      expect(controller['brandService']).toBeDefined()
      expect(controller['brandService']).toBe(mockBrandService)
    })
  })

  // ===== GET /brands (list) TESTS =====

  describe('GET /brands - list()', () => {
    it('should return paginated brands list', async () => {
      // Arrange
      const query: PaginationQueryDTO = { page: 1, limit: 10 }
      const mockResponse = createMockBrandsList()
      mockBrandService.list.mockResolvedValue(mockResponse)

      // Act
      const result = await controller.list(query)

      // Assert
      expect(result).toEqual(mockResponse)
      expect(mockBrandService.list).toHaveBeenCalledWith(query)
      expect(mockBrandService.list).toHaveBeenCalledTimes(1)
    })

    it('should handle pagination with different page and limit', async () => {
      // Arrange
      const query: PaginationQueryDTO = { page: 2, limit: 5 }
      const mockResponse = {
        data: [createMockBrand({ id: 6 }), createMockBrand({ id: 7 })],
        totalItems: 12,
        page: 2,
        limit: 5,
        totalPages: 3,
      }
      mockBrandService.list.mockResolvedValue(mockResponse)

      // Act
      const result = await controller.list(query)

      // Assert
      expect(result).toEqual(mockResponse)
      expect(result.page).toBe(2)
      expect(result.limit).toBe(5)
      expect(result.totalPages).toBe(3)
    })

    it('should return empty array when no brands exist', async () => {
      // Arrange
      const query: PaginationQueryDTO = { page: 1, limit: 10 }
      const mockResponse = {
        data: [],
        totalItems: 0,
        page: 1,
        limit: 10,
        totalPages: 0,
      }
      mockBrandService.list.mockResolvedValue(mockResponse)

      // Act
      const result = await controller.list(query)

      // Assert
      expect(result.data).toEqual([])
      expect(result.totalItems).toBe(0)
    })
  })

  // ===== GET /brands/:brandId (findById) TESTS =====

  describe('GET /brands/:brandId - findById()', () => {
    it('should return brand by id', async () => {
      // Arrange
      const params: GetBrandParamsDTO = { brandId: 1 }
      const mockBrand = createMockBrand()
      mockBrandService.findById.mockResolvedValue(mockBrand)

      // Act
      const result = await controller.findById(params)

      // Assert
      expect(result).toEqual(mockBrand)
      expect(mockBrandService.findById).toHaveBeenCalledWith(1)
      expect(mockBrandService.findById).toHaveBeenCalledTimes(1)
    })

    it('should throw error when brand not found', async () => {
      // Arrange
      const params: GetBrandParamsDTO = { brandId: 999 }
      mockBrandService.findById.mockRejectedValue(new Error('Error.NotFoundRecord'))

      // Act & Assert
      await expect(controller.findById(params)).rejects.toThrow('Error.NotFoundRecord')
      expect(mockBrandService.findById).toHaveBeenCalledWith(999)
    })

    it('should handle different brand ids', async () => {
      // Arrange
      const params: GetBrandParamsDTO = { brandId: 42 }
      const mockBrand = createMockBrand({ id: 42, name: 'Custom Brand' })
      mockBrandService.findById.mockResolvedValue(mockBrand)

      // Act
      const result = await controller.findById(params)

      // Assert
      expect(result.id).toBe(42)
      expect(result.name).toBe('Custom Brand')
    })
  })

  // ===== POST /brands (create) TESTS =====

  describe('POST /brands - create()', () => {
    it('should create new brand successfully', async () => {
      // Arrange
      const userId = 1
      const body: CreateBrandBodyDTO = {
        name: 'New Brand',
        logo: 'https://example.com/new-brand-logo.png',
      }
      const mockCreatedBrand = createMockBrand({ id: 10, ...body, createdById: userId })
      mockBrandService.create.mockResolvedValue(mockCreatedBrand)

      // Act
      const result = await controller.create(body, userId)

      // Assert
      expect(result).toEqual(mockCreatedBrand)
      expect(mockBrandService.create).toHaveBeenCalledWith({
        data: body,
        createdById: userId,
      })
      expect(result.createdById).toBe(userId)
    })

    it('should create brand with minimal data', async () => {
      // Arrange
      const userId = 2
      const body: CreateBrandBodyDTO = {
        name: 'Minimal Brand',
        logo: 'https://example.com/minimal.png',
      }
      const mockCreatedBrand = createMockBrand({ ...body, createdById: userId })
      mockBrandService.create.mockResolvedValue(mockCreatedBrand)

      // Act
      const result = await controller.create(body, userId)

      // Assert
      expect(result.name).toBe('Minimal Brand')
      expect(result.logo).toBe('https://example.com/minimal.png')
    })

    it('should handle long brand names', async () => {
      // Arrange
      const userId = 1
      const longName = 'A'.repeat(500) // Max length 500
      const body: CreateBrandBodyDTO = {
        name: longName,
        logo: 'https://example.com/logo.png',
      }
      const mockCreatedBrand = createMockBrand({ ...body })
      mockBrandService.create.mockResolvedValue(mockCreatedBrand)

      // Act
      const result = await controller.create(body, userId)

      // Assert
      expect(result.name).toBe(longName)
      expect(result.name.length).toBe(500)
    })

    it('should throw error when creating duplicate brand', async () => {
      // Arrange
      const userId = 1
      const body: CreateBrandBodyDTO = {
        name: 'Existing Brand',
        logo: 'https://example.com/logo.png',
      }
      mockBrandService.create.mockRejectedValue(new Error('Brand already exists'))

      // Act & Assert
      await expect(controller.create(body, userId)).rejects.toThrow('Brand already exists')
    })
  })

  // ===== PUT /brands/:brandId (update) TESTS =====

  describe('PUT /brands/:brandId - update()', () => {
    it('should update brand successfully', async () => {
      // Arrange
      const userId = 1
      const params: GetBrandParamsDTO = { brandId: 1 }
      const body: UpdateBrandBodyDTO = {
        name: 'Updated Brand',
        logo: 'https://example.com/updated-logo.png',
      }
      const mockUpdatedBrand = createMockBrand({ id: 1, ...body, updatedById: userId })
      mockBrandService.update.mockResolvedValue(mockUpdatedBrand)

      // Act
      const result = await controller.update(body, params, userId)

      // Assert
      expect(result).toEqual(mockUpdatedBrand)
      expect(mockBrandService.update).toHaveBeenCalledWith({
        data: body,
        id: 1,
        updatedById: userId,
      })
      expect(result.updatedById).toBe(userId)
    })

    it('should update only name', async () => {
      // Arrange
      const userId = 1
      const params: GetBrandParamsDTO = { brandId: 2 }
      const body: UpdateBrandBodyDTO = {
        name: 'Name Only Update',
        logo: 'https://example.com/logo.png',
      }
      const mockUpdatedBrand = createMockBrand({ id: 2, ...body })
      mockBrandService.update.mockResolvedValue(mockUpdatedBrand)

      // Act
      const result = await controller.update(body, params, userId)

      // Assert
      expect(result.name).toBe('Name Only Update')
    })

    it('should throw error when updating non-existent brand', async () => {
      // Arrange
      const userId = 1
      const params: GetBrandParamsDTO = { brandId: 999 }
      const body: UpdateBrandBodyDTO = {
        name: 'Updated',
        logo: 'https://example.com/logo.png',
      }
      mockBrandService.update.mockRejectedValue(new Error('Error.NotFoundRecord'))

      // Act & Assert
      await expect(controller.update(body, params, userId)).rejects.toThrow('Error.NotFoundRecord')
    })

    it('should handle concurrent updates from different users', async () => {
      // Arrange
      const userId1 = 1
      const userId2 = 2
      const params: GetBrandParamsDTO = { brandId: 1 }
      const body: UpdateBrandBodyDTO = {
        name: 'Concurrent Update',
        logo: 'https://example.com/logo.png',
      }
      const mockUpdatedBrand = createMockBrand({ ...body, updatedById: userId2 })
      mockBrandService.update.mockResolvedValue(mockUpdatedBrand)

      // Act
      const result = await controller.update(body, params, userId2)

      // Assert
      expect(result.updatedById).toBe(userId2)
    })
  })

  // ===== DELETE /brands/:brandId (delete) TESTS =====

  describe('DELETE /brands/:brandId - delete()', () => {
    it('should delete brand successfully (soft delete)', async () => {
      // Arrange
      const userId = 1
      const params: GetBrandParamsDTO = { brandId: 1 }
      const mockResponse = { message: 'Delete successfully' }
      mockBrandService.delete.mockResolvedValue(mockResponse as any)

      // Act
      const result = await controller.delete(params, userId)

      // Assert
      expect(result).toEqual(mockResponse)
      expect(mockBrandService.delete).toHaveBeenCalledWith({
        id: 1,
        deletedById: userId,
      })
      expect(result.message).toBe('Delete successfully')
    })

    it('should throw error when deleting non-existent brand', async () => {
      // Arrange
      const userId = 1
      const params: GetBrandParamsDTO = { brandId: 999 }
      mockBrandService.delete.mockRejectedValue(new Error('Error.NotFoundRecord'))

      // Act & Assert
      await expect(controller.delete(params, userId)).rejects.toThrow('Error.NotFoundRecord')
      expect(mockBrandService.delete).toHaveBeenCalledWith({
        id: 999,
        deletedById: userId,
      })
    })

    it('should track who deleted the brand', async () => {
      // Arrange
      const userId = 5
      const params: GetBrandParamsDTO = { brandId: 10 }
      const mockResponse = { message: 'Delete successfully' }
      mockBrandService.delete.mockResolvedValue(mockResponse as any)

      // Act
      await controller.delete(params, userId)

      // Assert
      expect(mockBrandService.delete).toHaveBeenCalledWith({
        id: 10,
        deletedById: 5,
      })
    })

    it('should handle deletion of already deleted brand', async () => {
      // Arrange
      const userId = 1
      const params: GetBrandParamsDTO = { brandId: 1 }
      mockBrandService.delete.mockRejectedValue(new Error('Error.NotFoundRecord'))

      // Act & Assert
      await expect(controller.delete(params, userId)).rejects.toThrow('Error.NotFoundRecord')
    })
  })

  // ===== EDGE CASES & ERROR HANDLING =====

  describe('Edge Cases & Error Handling', () => {
    it('should handle service throwing unexpected error in list', async () => {
      // Arrange
      const query: PaginationQueryDTO = { page: 1, limit: 10 }
      mockBrandService.list.mockRejectedValue(new Error('Database connection failed'))

      // Act & Assert
      await expect(controller.list(query)).rejects.toThrow('Database connection failed')
    })

    it('should handle service throwing unexpected error in create', async () => {
      // Arrange
      const userId = 1
      const body: CreateBrandBodyDTO = {
        name: 'Test',
        logo: 'https://example.com/logo.png',
      }
      mockBrandService.create.mockRejectedValue(new Error('Unexpected error'))

      // Act & Assert
      await expect(controller.create(body, userId)).rejects.toThrow('Unexpected error')
    })

    it('should handle large page numbers in pagination', async () => {
      // Arrange
      const query: PaginationQueryDTO = { page: 1000, limit: 10 }
      const mockResponse = {
        data: [],
        totalItems: 50,
        page: 1000,
        limit: 10,
        totalPages: 5,
      }
      mockBrandService.list.mockResolvedValue(mockResponse)

      // Act
      const result = await controller.list(query)

      // Assert
      expect(result.data).toEqual([])
      expect(result.page).toBe(1000)
    })
  })

  // ===== RESPONSE STRUCTURE SNAPSHOTS =====

  describe('Response Structure Snapshots', () => {
    const fixedDate = '2024-01-01T00:00:00.000Z'

    it('should match brand list response structure', async () => {
      const mockResponse = {
        data: [
          createMockBrand({ id: 1, name: 'Nike', createdAt: fixedDate, updatedAt: fixedDate }),
          createMockBrand({ id: 2, name: 'Adidas', createdAt: fixedDate, updatedAt: fixedDate }),
        ],
        totalItems: 2,
        page: 1,
        limit: 10,
        totalPages: 1,
      }
      mockBrandService.list.mockResolvedValue(mockResponse)
      const result = await controller.list({ page: 1, limit: 10 })
      expect(result).toMatchSnapshot()
    })

    it('should match brand detail response structure', async () => {
      const mockBrand = createMockBrand({ createdAt: fixedDate, updatedAt: fixedDate })
      mockBrandService.findById.mockResolvedValue(mockBrand)
      const result = await controller.findById({ brandId: 1 })
      expect(result).toMatchSnapshot()
    })

    it('should match brand create response structure', async () => {
      const mockBrand = createMockBrand({ id: 10, name: 'New Brand', createdAt: fixedDate, updatedAt: fixedDate })
      mockBrandService.create.mockResolvedValue(mockBrand)
      const result = await controller.create({ name: 'New Brand', logo: 'https://example.com/logo.png' }, 1)
      expect(result).toMatchSnapshot()
    })

    it('should match brand delete response structure', async () => {
      mockBrandService.delete.mockResolvedValue({ message: 'Delete successfully' })
      const result = await controller.delete({ brandId: 1 }, 1)
      expect(result).toMatchSnapshot()
    })
  })
})
