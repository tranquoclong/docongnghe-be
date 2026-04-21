import { Test, TestingModule } from '@nestjs/testing'
import { NotFoundRecordException } from 'src/shared/error'
import { isNotFoundPrismaError } from 'src/shared/helpers'
import { CreateCategoryBodyType, UpdateCategoryBodyType } from '../category.model'
import { CategoryRepo } from '../category.repo'
import { CategoryService } from '../category.service'
import { MESSAGES } from 'src/shared/constants/app.constant'

// Mock helper function
jest.mock('src/shared/helpers', () => ({
  isNotFoundPrismaError: jest.fn(),
}))

const mockIsNotFoundPrismaError = isNotFoundPrismaError as jest.MockedFunction<typeof isNotFoundPrismaError>

/**
 * CATEGORY SERVICE UNIT TESTS
 *
 * Module này test service layer của Category
 * Category là module quan trọng - quản lý danh mục sản phẩm với cấu trúc cây (parent-child)
 *
 * Test Coverage:
 * - Find all categories (with parent filter)
 * - Find category by ID
 * - Create category (root and child)
 * - Update category
 * - Delete category (soft delete)
 * - Parent-child relationship
 * - Error handling (NotFound)
 * - I18n language support
 */

describe('CategoryService', () => {
  let service: CategoryService
  let mockCategoryRepo: jest.Mocked<CategoryRepo>

  // Test data factories
  const createCategory = (overrides = {}) => ({
    id: 1,
    name: 'Electronics',
    logo: 'https://example.com/electronics.png',
    parentCategoryId: null,
    categoryTranslations: [],
    createdById: 1,
    updatedById: null,
    deletedById: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    deletedAt: null,
    ...overrides,
  })

  const createCategoryData = (overrides = {}): CreateCategoryBodyType => ({
    name: 'Smartphones',
    logo: 'https://example.com/smartphones.png',
    parentCategoryId: null,
    ...overrides,
  })

  beforeEach(async () => {
    mockCategoryRepo = {
      findAll: jest.fn(),
      findById: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    } as any

    const module: TestingModule = await Test.createTestingModule({
      providers: [CategoryService, { provide: CategoryRepo, useValue: mockCategoryRepo }],
    }).compile()

    service = module.get<CategoryService>(CategoryService)
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  // ============================================
  // FIND ALL CATEGORIES
  // ============================================

  describe('findAll', () => {
    it('should return all root categories when parentCategoryId is null', async () => {
      // Arrange
      const mockResponse = {
        data: [createCategory({ id: 1, name: 'Electronics' }), createCategory({ id: 2, name: 'Fashion' })],
        totalItems: 2,
      }

      mockCategoryRepo.findAll.mockResolvedValue(mockResponse as any)

      // Act
      const result = await service.findAll(null)

      // Assert
      expect(result).toEqual(mockResponse)
      expect(mockCategoryRepo.findAll).toHaveBeenCalledWith({
        parentCategoryId: null,
        languageId: undefined,
      })
    })

    it('should return child categories when parentCategoryId is provided', async () => {
      // Arrange
      const parentId = 1
      const mockResponse = {
        data: [
          createCategory({ id: 10, name: 'Smartphones', parentCategoryId: parentId }),
          createCategory({ id: 11, name: 'Laptops', parentCategoryId: parentId }),
        ],
        totalItems: 2,
      }

      mockCategoryRepo.findAll.mockResolvedValue(mockResponse as any)

      // Act
      const result = await service.findAll(parentId)

      // Assert
      expect(result.data).toHaveLength(2)
      expect(result.data[0].parentCategoryId).toBe(parentId)
      expect(mockCategoryRepo.findAll).toHaveBeenCalledWith({
        parentCategoryId: parentId,
        languageId: undefined,
      })
    })

    it('should handle empty category list', async () => {
      // Arrange
      const mockResponse = {
        data: [],
        totalItems: 0,
      }

      mockCategoryRepo.findAll.mockResolvedValue(mockResponse as any)

      // Act
      const result = await service.findAll()

      // Assert
      expect(result.data).toHaveLength(0)
      expect(result.totalItems).toBe(0)
    })
  })

  // ============================================
  // FIND CATEGORY BY ID
  // ============================================

  describe('findById', () => {
    it('should return category when found', async () => {
      // Arrange
      const categoryId = 1
      const mockCategory = createCategory({ id: categoryId })

      mockCategoryRepo.findById.mockResolvedValue(mockCategory as any)

      // Act
      const result = await service.findById(categoryId)

      // Assert
      expect(result).toEqual(mockCategory)
      expect(mockCategoryRepo.findById).toHaveBeenCalledWith({
        id: categoryId,
        languageId: undefined,
      })
    })

    it('should throw NotFoundRecordException when category not found', async () => {
      // Arrange
      const categoryId = 999

      mockCategoryRepo.findById.mockResolvedValue(null)

      // Act & Assert
      await expect(service.findById(categoryId)).rejects.toThrow(NotFoundRecordException)
    })
  })

  // ============================================
  // CREATE CATEGORY
  // ============================================

  describe('create', () => {
    it('should create root category successfully', async () => {
      // Arrange
      const data = createCategoryData({ parentCategoryId: null })
      const createdById = 1
      const mockCreatedCategory = createCategory({ ...data, createdById })

      mockCategoryRepo.create.mockResolvedValue(mockCreatedCategory as any)

      // Act
      const result = await service.create({ data, createdById })

      // Assert
      expect(result).toEqual(mockCreatedCategory)
      expect(result.parentCategoryId).toBeNull()
      expect(mockCategoryRepo.create).toHaveBeenCalledWith({ createdById, data })
    })

    it('should create child category successfully', async () => {
      // Arrange
      const parentId = 1
      const data = createCategoryData({ name: 'Smartphones', parentCategoryId: parentId })
      const createdById = 1
      const mockCreatedCategory = createCategory({ ...data, createdById, parentCategoryId: parentId })

      mockCategoryRepo.create.mockResolvedValue(mockCreatedCategory as any)

      // Act
      const result = await service.create({ data, createdById })

      // Assert
      expect(result.parentCategoryId).toBe(parentId)
      expect(mockCategoryRepo.create).toHaveBeenCalledWith({
        createdById,
        data: expect.objectContaining({ parentCategoryId: parentId }),
      })
    })

    it('should create category with logo', async () => {
      // Arrange
      const data = createCategoryData({ logo: 'https://cdn.example.com/category.jpg' })
      const createdById = 1

      mockCategoryRepo.create.mockResolvedValue(createCategory(data) as any)

      // Act
      await service.create({ data, createdById })

      // Assert
      expect(mockCategoryRepo.create).toHaveBeenCalledWith({
        createdById,
        data: expect.objectContaining({
          logo: 'https://cdn.example.com/category.jpg',
        }),
      })
    })
  })

  // ============================================
  // UPDATE CATEGORY
  // ============================================

  describe('update', () => {
    it('should update category successfully', async () => {
      // Arrange
      const id = 1
      const data: UpdateCategoryBodyType = {
        name: 'Electronics Updated',
        logo: 'https://example.com/new-logo.png',
        parentCategoryId: null,
      }
      const updatedById = 1
      const mockUpdatedCategory = createCategory({ id, ...data, updatedById })

      mockCategoryRepo.update.mockResolvedValue(mockUpdatedCategory as any)

      // Act
      const result = await service.update({ id, data, updatedById })

      // Assert
      expect(result).toEqual(mockUpdatedCategory)
      expect(mockCategoryRepo.update).toHaveBeenCalledWith({ id, updatedById, data })
    })

    it('should throw NotFoundRecordException when updating non-existent category', async () => {
      // Arrange
      const id = 999
      const data: UpdateCategoryBodyType = {
        name: 'Test',
        logo: null,
        parentCategoryId: null,
      }
      const updatedById = 1

      // Mock Prisma P2025 error (Record not found)
      const prismaError = new Error('Record not found')
      Object.assign(prismaError, {
        code: 'P2025',
        clientVersion: '5.0.0',
        meta: { cause: 'Record to update not found.' },
      })
      mockCategoryRepo.update.mockRejectedValue(prismaError)
      mockIsNotFoundPrismaError.mockReturnValue(true)

      // Act & Assert
      await expect(service.update({ id, data, updatedById })).rejects.toThrow(NotFoundRecordException)
    })
  })

  // ============================================
  // DELETE CATEGORY
  // ============================================

  describe('delete', () => {
    it('should delete category successfully (soft delete)', async () => {
      // Arrange
      const id = 1
      const deletedById = 1

      mockCategoryRepo.delete.mockResolvedValue(createCategory({ id, deletedById }) as any)

      // Act
      const result = await service.delete({ id, deletedById })

      // Assert
      expect(result).toEqual({ message: MESSAGES.DELETE_SUCCESS })
      expect(mockCategoryRepo.delete).toHaveBeenCalledWith({ id, deletedById })
    })

    it('should throw NotFoundRecordException when deleting non-existent category', async () => {
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
      mockCategoryRepo.delete.mockRejectedValue(prismaError)
      mockIsNotFoundPrismaError.mockReturnValue(true)

      // Act & Assert
      await expect(service.delete({ id, deletedById })).rejects.toThrow(NotFoundRecordException)
    })
  })
})
