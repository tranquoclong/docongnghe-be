import { Test, TestingModule } from '@nestjs/testing'
import { CategoryController } from '../category.controller'
import {
  CreateCategoryBodyDTO,
  GetAllCategoriesQueryDTO,
  GetCategoryParamsDTO,
  UpdateCategoryBodyDTO,
} from '../category.dto'
import { CategoryService } from '../category.service'

/**
 * CATEGORY CONTROLLER UNIT TESTS
 *
 * Test coverage cho CategoryController với 5 endpoints:
 * - GET /categories (findAll) - Public endpoint với parentCategoryId filter
 * - GET /categories/:categoryId (findById) - Public endpoint
 * - POST /categories (create) - Protected endpoint, support parent category
 * - PUT /categories/:categoryId (update) - Protected endpoint
 * - DELETE /categories/:categoryId (delete) - Protected endpoint (soft delete)
 *
 * Key features:
 * - Hierarchical categories (parent-child relationships)
 * - Filter by parentCategoryId (get root categories or subcategories)
 * - Category translations support
 */

describe('CategoryController', () => {
  let controller: CategoryController
  let mockCategoryService: jest.Mocked<CategoryService>

  // ===== TEST DATA FACTORIES =====

  const createMockCategory = (overrides = {}) => ({
    id: 1,
    name: 'Electronics',
    logo: 'https://example.com/electronics-logo.png',
    parentCategoryId: null,
    categoryTranslations: [],
    createdById: 1,
    updatedById: null,
    deletedById: null,
    deletedAt: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  })

  const createMockCategoriesList = () => ({
    data: [
      createMockCategory({ id: 1, name: 'Electronics', parentCategoryId: null }),
      createMockCategory({ id: 2, name: 'Clothing', parentCategoryId: null }),
      createMockCategory({ id: 3, name: 'Books', parentCategoryId: null }),
    ],
    totalItems: 3,
  })

  const createMockSubcategoriesList = () => ({
    data: [
      createMockCategory({ id: 4, name: 'Smartphones', parentCategoryId: 1 }),
      createMockCategory({ id: 5, name: 'Laptops', parentCategoryId: 1 }),
      createMockCategory({ id: 6, name: 'Tablets', parentCategoryId: 1 }),
    ],
    totalItems: 3,
  })

  // ===== SETUP & TEARDOWN =====

  beforeEach(async () => {
    // Tạo mock service với tất cả methods
    mockCategoryService = {
      findAll: jest.fn(),
      findById: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    } as any

    const module: TestingModule = await Test.createTestingModule({
      controllers: [CategoryController],
      providers: [
        {
          provide: CategoryService,
          useValue: mockCategoryService,
        },
      ],
    }).compile()

    controller = module.get<CategoryController>(CategoryController)
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  // ===== INITIALIZATION TESTS =====

  describe('Initialization', () => {
    it('should be defined', () => {
      expect(controller).toBeDefined()
    })

    it('should have categoryService injected', () => {
      expect(controller['categoryService']).toBeDefined()
      expect(controller['categoryService']).toBe(mockCategoryService)
    })
  })

  // ===== GET /categories (findAll) TESTS =====

  describe('GET /categories - findAll()', () => {
    it('should return all root categories when parentCategoryId is not provided', async () => {
      // Arrange
      const query: GetAllCategoriesQueryDTO = {}
      const mockResponse = createMockCategoriesList()
      mockCategoryService.findAll.mockResolvedValue(mockResponse)

      // Act
      const result = await controller.findAll(query)

      // Assert
      expect(result).toEqual(mockResponse)
      expect(mockCategoryService.findAll).toHaveBeenCalledWith(undefined)
      expect(mockCategoryService.findAll).toHaveBeenCalledTimes(1)
      expect(result.data.every((cat) => cat.parentCategoryId === null)).toBe(true)
    })

    it('should return subcategories when parentCategoryId is provided', async () => {
      // Arrange
      const query: GetAllCategoriesQueryDTO = { parentCategoryId: 1 }
      const mockResponse = createMockSubcategoriesList()
      mockCategoryService.findAll.mockResolvedValue(mockResponse)

      // Act
      const result = await controller.findAll(query)

      // Assert
      expect(result).toEqual(mockResponse)
      expect(mockCategoryService.findAll).toHaveBeenCalledWith(1)
      expect(result.data.every((cat) => cat.parentCategoryId === 1)).toBe(true)
    })

    it('should return empty array when no categories exist', async () => {
      // Arrange
      const query: GetAllCategoriesQueryDTO = {}
      const mockResponse = {
        data: [],
        totalItems: 0,
      }
      mockCategoryService.findAll.mockResolvedValue(mockResponse)

      // Act
      const result = await controller.findAll(query)

      // Assert
      expect(result.data).toEqual([])
      expect(result.totalItems).toBe(0)
    })
  })

  // ===== GET /categories/:categoryId (findById) TESTS =====

  describe('GET /categories/:categoryId - findById()', () => {
    it('should return category by id', async () => {
      // Arrange
      const params: GetCategoryParamsDTO = { categoryId: 1 }
      const mockCategory = createMockCategory()
      mockCategoryService.findById.mockResolvedValue(mockCategory)

      // Act
      const result = await controller.findById(params)

      // Assert
      expect(result).toEqual(mockCategory)
      expect(mockCategoryService.findById).toHaveBeenCalledWith(1)
      expect(mockCategoryService.findById).toHaveBeenCalledTimes(1)
    })

    it('should throw error when category not found', async () => {
      // Arrange
      const params: GetCategoryParamsDTO = { categoryId: 999 }
      mockCategoryService.findById.mockRejectedValue(new Error('Error.NotFoundRecord'))

      // Act & Assert
      await expect(controller.findById(params)).rejects.toThrow('Error.NotFoundRecord')
      expect(mockCategoryService.findById).toHaveBeenCalledWith(999)
    })

    it('should return category with parent relationship', async () => {
      // Arrange
      const params: GetCategoryParamsDTO = { categoryId: 4 }
      const mockCategory = createMockCategory({ id: 4, name: 'Smartphones', parentCategoryId: 1 })
      mockCategoryService.findById.mockResolvedValue(mockCategory)

      // Act
      const result = await controller.findById(params)

      // Assert
      expect(result.id).toBe(4)
      expect(result.name).toBe('Smartphones')
      expect(result.parentCategoryId).toBe(1)
    })
  })

  // ===== POST /categories (create) TESTS =====

  describe('POST /categories - create()', () => {
    it('should create root category successfully', async () => {
      // Arrange
      const userId = 1
      const body: CreateCategoryBodyDTO = {
        name: 'New Category',
        logo: 'https://example.com/new-category-logo.png',
        parentCategoryId: null,
      }
      const mockCreatedCategory = createMockCategory({ id: 10, ...body, createdById: userId })
      mockCategoryService.create.mockResolvedValue(mockCreatedCategory)

      // Act
      const result = await controller.create(body, userId)

      // Assert
      expect(result).toEqual(mockCreatedCategory)
      expect(mockCategoryService.create).toHaveBeenCalledWith({
        data: body,
        createdById: userId,
      })
      expect(result.createdById).toBe(userId)
      expect(result.parentCategoryId).toBeNull()
    })

    it('should create subcategory with parent category', async () => {
      // Arrange
      const userId = 1
      const body: CreateCategoryBodyDTO = {
        name: 'Subcategory',
        logo: 'https://example.com/subcategory-logo.png',
        parentCategoryId: 1,
      }
      const mockCreatedCategory = createMockCategory({ ...body, createdById: userId })
      mockCategoryService.create.mockResolvedValue(mockCreatedCategory)

      // Act
      const result = await controller.create(body, userId)

      // Assert
      expect(result.parentCategoryId).toBe(1)
      expect(result.name).toBe('Subcategory')
    })

    it('should create category without logo (nullable)', async () => {
      // Arrange
      const userId = 1
      const body: CreateCategoryBodyDTO = {
        name: 'No Logo Category',
        logo: null,
        parentCategoryId: null,
      }
      const mockCreatedCategory = createMockCategory({ ...body })
      mockCategoryService.create.mockResolvedValue(mockCreatedCategory)

      // Act
      const result = await controller.create(body, userId)

      // Assert
      expect(result.logo).toBeNull()
      expect(result.name).toBe('No Logo Category')
    })

    it('should throw error when creating duplicate category', async () => {
      // Arrange
      const userId = 1
      const body: CreateCategoryBodyDTO = {
        name: 'Existing Category',
        logo: 'https://example.com/logo.png',
        parentCategoryId: null,
      }
      mockCategoryService.create.mockRejectedValue(new Error('Category already exists'))

      // Act & Assert
      await expect(controller.create(body, userId)).rejects.toThrow('Category already exists')
    })
  })

  // ===== PUT /categories/:categoryId (update) TESTS =====

  describe('PUT /categories/:categoryId - update()', () => {
    it('should update category successfully', async () => {
      // Arrange
      const userId = 1
      const params: GetCategoryParamsDTO = { categoryId: 1 }
      const body: UpdateCategoryBodyDTO = {
        name: 'Updated Category',
        logo: 'https://example.com/updated-logo.png',
        parentCategoryId: null,
      }
      const mockUpdatedCategory = createMockCategory({ id: 1, ...body, updatedById: userId })
      mockCategoryService.update.mockResolvedValue(mockUpdatedCategory)

      // Act
      const result = await controller.update(body, params, userId)

      // Assert
      expect(result).toEqual(mockUpdatedCategory)
      expect(mockCategoryService.update).toHaveBeenCalledWith({
        data: body,
        id: 1,
        updatedById: userId,
      })
      expect(result.updatedById).toBe(userId)
    })

    it('should update category parent relationship', async () => {
      // Arrange
      const userId = 1
      const params: GetCategoryParamsDTO = { categoryId: 4 }
      const body: UpdateCategoryBodyDTO = {
        name: 'Smartphones',
        logo: 'https://example.com/logo.png',
        parentCategoryId: 2, // Change parent from 1 to 2
      }
      const mockUpdatedCategory = createMockCategory({ id: 4, ...body })
      mockCategoryService.update.mockResolvedValue(mockUpdatedCategory)

      // Act
      const result = await controller.update(body, params, userId)

      // Assert
      expect(result.parentCategoryId).toBe(2)
    })

    it('should throw error when updating non-existent category', async () => {
      // Arrange
      const userId = 1
      const params: GetCategoryParamsDTO = { categoryId: 999 }
      const body: UpdateCategoryBodyDTO = {
        name: 'Updated',
        logo: 'https://example.com/logo.png',
        parentCategoryId: null,
      }
      mockCategoryService.update.mockRejectedValue(new Error('Error.NotFoundRecord'))

      // Act & Assert
      await expect(controller.update(body, params, userId)).rejects.toThrow('Error.NotFoundRecord')
    })
  })

  // ===== DELETE /categories/:categoryId (delete) TESTS =====

  describe('DELETE /categories/:categoryId - delete()', () => {
    it('should delete category successfully (soft delete)', async () => {
      // Arrange
      const userId = 1
      const params: GetCategoryParamsDTO = { categoryId: 1 }
      const mockResponse = { message: 'Delete successfully' }
      mockCategoryService.delete.mockResolvedValue(mockResponse as any)

      // Act
      const result = await controller.delete(params, userId)

      // Assert
      expect(result).toEqual(mockResponse)
      expect(mockCategoryService.delete).toHaveBeenCalledWith({
        id: 1,
        deletedById: userId,
      })
      expect(result.message).toBe('Delete successfully')
    })

    it('should throw error when deleting non-existent category', async () => {
      // Arrange
      const userId = 1
      const params: GetCategoryParamsDTO = { categoryId: 999 }
      mockCategoryService.delete.mockRejectedValue(new Error('Error.NotFoundRecord'))

      // Act & Assert
      await expect(controller.delete(params, userId)).rejects.toThrow('Error.NotFoundRecord')
      expect(mockCategoryService.delete).toHaveBeenCalledWith({
        id: 999,
        deletedById: userId,
      })
    })

    it('should track who deleted the category', async () => {
      // Arrange
      const userId = 5
      const params: GetCategoryParamsDTO = { categoryId: 10 }
      const mockResponse = { message: 'Delete successfully' }
      mockCategoryService.delete.mockResolvedValue(mockResponse as any)

      // Act
      await controller.delete(params, userId)

      // Assert
      expect(mockCategoryService.delete).toHaveBeenCalledWith({
        id: 10,
        deletedById: 5,
      })
    })
  })

  // ===== EDGE CASES & ERROR HANDLING =====

  describe('Edge Cases & Error Handling', () => {
    it('should handle service throwing unexpected error in findAll', async () => {
      // Arrange
      const query: GetAllCategoriesQueryDTO = {}
      mockCategoryService.findAll.mockRejectedValue(new Error('Database connection failed'))

      // Act & Assert
      await expect(controller.findAll(query)).rejects.toThrow('Database connection failed')
    })

    it('should handle service throwing unexpected error in create', async () => {
      // Arrange
      const userId = 1
      const body: CreateCategoryBodyDTO = {
        name: 'Test',
        logo: 'https://example.com/logo.png',
        parentCategoryId: null,
      }
      mockCategoryService.create.mockRejectedValue(new Error('Unexpected error'))

      // Act & Assert
      await expect(controller.create(body, userId)).rejects.toThrow('Unexpected error')
    })

    it('should handle filtering by non-existent parent category', async () => {
      // Arrange
      const query: GetAllCategoriesQueryDTO = { parentCategoryId: 999 }
      const mockResponse = {
        data: [],
        totalItems: 0,
      }
      mockCategoryService.findAll.mockResolvedValue(mockResponse)

      // Act
      const result = await controller.findAll(query)

      // Assert
      expect(result.data).toEqual([])
      expect(result.totalItems).toBe(0)
    })

    it('should handle multiple levels of category hierarchy', async () => {
      // Arrange
      const query: GetAllCategoriesQueryDTO = { parentCategoryId: 4 }
      const mockResponse = {
        data: [
          createMockCategory({ id: 7, name: 'iPhone', parentCategoryId: 4 }),
          createMockCategory({ id: 8, name: 'Samsung', parentCategoryId: 4 }),
        ],
        totalItems: 2,
      }
      mockCategoryService.findAll.mockResolvedValue(mockResponse)

      // Act
      const result = await controller.findAll(query)

      // Assert
      expect(result.data.length).toBe(2)
      expect(result.data.every((cat) => cat.parentCategoryId === 4)).toBe(true)
    })
  })

  // ===== RESPONSE STRUCTURE SNAPSHOTS =====

  describe('Response Structure Snapshots', () => {
    const fixedDate = '2024-01-01T00:00:00.000Z'

    it('should match category list response structure', async () => {
      const mockResponse = {
        data: [
          createMockCategory({ id: 1, name: 'Electronics', createdAt: fixedDate, updatedAt: fixedDate }),
          createMockCategory({ id: 2, name: 'Clothing', createdAt: fixedDate, updatedAt: fixedDate }),
        ],
        totalItems: 2,
      }
      mockCategoryService.findAll.mockResolvedValue(mockResponse)
      const result = await controller.findAll({})
      expect(result).toMatchSnapshot()
    })

    it('should match category detail response structure', async () => {
      const mockCategory = createMockCategory({ createdAt: fixedDate, updatedAt: fixedDate })
      mockCategoryService.findById.mockResolvedValue(mockCategory)
      const result = await controller.findById({ categoryId: 1 })
      expect(result).toMatchSnapshot()
    })

    it('should match category create response structure', async () => {
      const mockCategory = createMockCategory({ id: 10, name: 'New Category', createdAt: fixedDate, updatedAt: fixedDate })
      mockCategoryService.create.mockResolvedValue(mockCategory)
      const result = await controller.create({ name: 'New Category', logo: null, parentCategoryId: null }, 1)
      expect(result).toMatchSnapshot()
    })

    it('should match category delete response structure', async () => {
      mockCategoryService.delete.mockResolvedValue({ message: 'Delete successfully' })
      const result = await controller.delete({ categoryId: 1 }, 1)
      expect(result).toMatchSnapshot()
    })
  })
})
