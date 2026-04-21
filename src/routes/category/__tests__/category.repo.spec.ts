import { Test, TestingModule } from '@nestjs/testing'
import { ALL_LANGUAGE_CODE } from 'src/shared/constants/other.constant'
import { PrismaService } from 'src/shared/services/prisma.service'
import { CategoryRepo } from '../category.repo'

describe('CategoryRepo', () => {
  let repository: CategoryRepo

  // Mock PrismaService
  const mockPrismaService = {
    category: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
  }

  // Test data factory
  const createTestData = {
    category: (overrides = {}) => ({
      id: 1,
      name: 'Electronics',
      icon: 'https://example.com/electronics-icon.png',
      parentCategoryId: null,
      createdById: null,
      updatedById: null,
      deletedById: null,
      deletedAt: null,
      createdAt: new Date('2024-01-01'),
      updatedAt: new Date('2024-01-01'),
      ...overrides,
    }),
    categoryWithTranslations: (overrides = {}) => ({
      id: 1,
      name: 'Electronics',
      icon: 'https://example.com/electronics-icon.png',
      parentCategoryId: null,
      createdById: null,
      updatedById: null,
      deletedById: null,
      deletedAt: null,
      createdAt: new Date('2024-01-01'),
      updatedAt: new Date('2024-01-01'),
      categoryTranslations: [
        {
          id: 1,
          categoryId: 1,
          languageId: 'en',
          name: 'Electronics',
          description: 'Electronics category',
          deletedAt: null,
        },
        {
          id: 2,
          categoryId: 1,
          languageId: 'vi',
          name: 'Điện tử',
          description: 'Danh mục điện tử',
          deletedAt: null,
        },
      ],
      ...overrides,
    }),
  }

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CategoryRepo,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile()

    repository = module.get<CategoryRepo>(CategoryRepo)

    // Reset mocks
    jest.clearAllMocks()
  })

  describe('findAll', () => {
    it('should get all root categories with all languages', async () => {
      // Arrange - Chuẩn bị dữ liệu
      const languageId = ALL_LANGUAGE_CODE
      const mockCategories = [
        createTestData.categoryWithTranslations({ id: 1, name: 'Electronics', parentCategoryId: null }),
        createTestData.categoryWithTranslations({ id: 2, name: 'Fashion', parentCategoryId: null }),
      ]

      mockPrismaService.category.findMany.mockResolvedValue(mockCategories)

      // Act - Thực hiện lấy danh sách categories
      const result = await repository.findAll({ languageId })

      // Assert - Kiểm tra kết quả
      expect(result.data).toHaveLength(2)
      expect(result.data[0]).toMatchObject({ id: 1, name: 'Electronics' })
      expect(result.data[1]).toMatchObject({ id: 2, name: 'Fashion' })
      expect(result.totalItems).toBe(2)
      expect(mockPrismaService.category.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { deletedAt: null, parentCategoryId: null },
          include: {
            categoryTranslations: {
              where: { deletedAt: null },
            },
          },
        }),
      )
    })

    it('should get subcategories by parentCategoryId', async () => {
      // Arrange - Chuẩn bị dữ liệu
      const parentCategoryId = 1
      const languageId = ALL_LANGUAGE_CODE
      const mockCategories = [
        createTestData.categoryWithTranslations({ id: 3, name: 'Laptops', parentCategoryId: 1 }),
        createTestData.categoryWithTranslations({ id: 4, name: 'Phones', parentCategoryId: 1 }),
      ]

      mockPrismaService.category.findMany.mockResolvedValue(mockCategories)

      // Act - Thực hiện lấy danh sách subcategories
      const result = await repository.findAll({ parentCategoryId, languageId })

      // Assert - Kiểm tra kết quả
      expect(result.data).toHaveLength(2)
      expect(mockPrismaService.category.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { deletedAt: null, parentCategoryId: 1 },
        }),
      )
    })

    it('should get categories with specific language', async () => {
      // Arrange - Chuẩn bị dữ liệu
      const languageId = 'vi'
      const mockCategories = [
        createTestData.categoryWithTranslations({
          categoryTranslations: [
            {
              id: 2,
              categoryId: 1,
              languageId: 'vi',
              name: 'Điện tử',
              description: 'Danh mục điện tử',
              deletedAt: null,
            },
          ],
        }),
      ]

      mockPrismaService.category.findMany.mockResolvedValue(mockCategories)

      // Act - Thực hiện lấy danh sách categories với ngôn ngữ cụ thể
      const result = await repository.findAll({ languageId })

      // Assert - Kiểm tra kết quả
      expect(result.data).toHaveLength(1)
      expect(mockPrismaService.category.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          include: {
            categoryTranslations: {
              where: { deletedAt: null, languageId: 'vi' },
            },
          },
        }),
      )
    })

    it('should handle parentCategoryId as null explicitly', async () => {
      // Arrange - Chuẩn bị dữ liệu
      const parentCategoryId = null
      const languageId = ALL_LANGUAGE_CODE
      const mockCategories = [createTestData.categoryWithTranslations()]

      mockPrismaService.category.findMany.mockResolvedValue(mockCategories)

      // Act - Thực hiện lấy danh sách categories với parentCategoryId null
      const result = await repository.findAll({ parentCategoryId, languageId })

      // Assert - Kiểm tra kết quả
      expect(mockPrismaService.category.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { deletedAt: null, parentCategoryId: null },
        }),
      )
    })

    it('should only return categories that are not deleted', async () => {
      // Arrange - Chuẩn bị dữ liệu
      const languageId = ALL_LANGUAGE_CODE
      const mockCategories = [createTestData.categoryWithTranslations({ deletedAt: null })]

      mockPrismaService.category.findMany.mockResolvedValue(mockCategories)

      // Act - Thực hiện lấy danh sách categories
      await repository.findAll({ languageId })

      // Assert - Kiểm tra kết quả
      expect(mockPrismaService.category.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { deletedAt: null, parentCategoryId: null },
        }),
      )
    })
  })

  describe('findById', () => {
    it('should find category by id with all languages', async () => {
      // Arrange - Chuẩn bị dữ liệu
      const id = 1
      const languageId = ALL_LANGUAGE_CODE
      const mockCategory = createTestData.categoryWithTranslations({ id })

      mockPrismaService.category.findUnique.mockResolvedValue(mockCategory)

      // Act - Thực hiện tìm category
      const result = await repository.findById({ id, languageId })

      // Assert - Kiểm tra kết quả
      expect(result).toMatchObject({
        id: 1,
        name: 'Electronics',
      })
      expect(result?.categoryTranslations).toHaveLength(2)
      expect(mockPrismaService.category.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id, deletedAt: null },
          include: {
            categoryTranslations: {
              where: { deletedAt: null },
            },
          },
        }),
      )
    })

    it('should find category by id with specific language', async () => {
      // Arrange - Chuẩn bị dữ liệu
      const id = 1
      const languageId = 'en'
      const mockCategory = createTestData.categoryWithTranslations({
        categoryTranslations: [
          {
            id: 1,
            categoryId: 1,
            languageId: 'en',
            name: 'Electronics',
            description: 'Electronics category',
            deletedAt: null,
          },
        ],
      })

      mockPrismaService.category.findUnique.mockResolvedValue(mockCategory)

      // Act - Thực hiện tìm category với ngôn ngữ cụ thể
      const result = await repository.findById({ id, languageId })

      // Assert - Kiểm tra kết quả
      expect(result?.categoryTranslations).toHaveLength(1)
      expect(mockPrismaService.category.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({
          include: {
            categoryTranslations: {
              where: { deletedAt: null, languageId: 'en' },
            },
          },
        }),
      )
    })

    it('should return null when category not found', async () => {
      // Arrange - Chuẩn bị dữ liệu
      const id = 999
      const languageId = ALL_LANGUAGE_CODE

      mockPrismaService.category.findUnique.mockResolvedValue(null)

      // Act - Thực hiện tìm category
      const result = await repository.findById({ id, languageId })

      // Assert - Kiểm tra kết quả
      expect(result).toBeNull()
    })
  })

  describe('create', () => {
    it('should create root category successfully', async () => {
      // Arrange - Chuẩn bị dữ liệu
      const createdById = 1
      const data = {
        name: 'Sports',
        logo: 'https://example.com/sports-logo.png',
        parentCategoryId: null,
      }
      const mockCategory = createTestData.categoryWithTranslations({ ...data, createdById })

      mockPrismaService.category.create.mockResolvedValue(mockCategory)

      // Act - Thực hiện tạo category
      const result = await repository.create({ createdById, data })

      // Assert - Kiểm tra kết quả
      expect(result).toMatchObject({
        name: 'Sports',
        createdById: 1,
      })
      expect(mockPrismaService.category.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: {
            ...data,
            createdById,
          },
          include: {
            categoryTranslations: {
              where: { deletedAt: null },
            },
          },
        }),
      )
    })

    it('should create subcategory successfully', async () => {
      // Arrange - Chuẩn bị dữ liệu
      const createdById = 1
      const data = {
        name: 'Smartphones',
        logo: 'https://example.com/smartphones-logo.png',
        parentCategoryId: 1,
      }
      const mockCategory = createTestData.categoryWithTranslations({ ...data, createdById })

      mockPrismaService.category.create.mockResolvedValue(mockCategory)

      // Act - Thực hiện tạo subcategory
      const result = await repository.create({ createdById, data })

      // Assert - Kiểm tra kết quả
      expect(result).toMatchObject({
        name: 'Smartphones',
        parentCategoryId: 1,
      })
    })

    it('should create category with null createdById', async () => {
      // Arrange - Chuẩn bị dữ liệu
      const createdById = null
      const data = {
        name: 'Books',
        logo: 'https://example.com/books-logo.png',
        parentCategoryId: null,
      }
      const mockCategory = createTestData.categoryWithTranslations({ ...data, createdById: null })

      mockPrismaService.category.create.mockResolvedValue(mockCategory)

      // Act - Thực hiện tạo category với createdById null
      const result = await repository.create({ createdById, data })

      // Assert - Kiểm tra kết quả
      expect(result).toMatchObject({
        name: 'Books',
        createdById: null,
      })
    })
  })

  describe('update', () => {
    it('should update category successfully', async () => {
      // Arrange - Chuẩn bị dữ liệu
      const id = 1
      const updatedById = 2
      const data = {
        name: 'Electronics Updated',
        logo: 'https://example.com/electronics-updated-logo.png',
        parentCategoryId: null,
      }
      const mockCategory = createTestData.categoryWithTranslations({ ...data, updatedById })

      mockPrismaService.category.update.mockResolvedValue(mockCategory)

      // Act - Thực hiện cập nhật category
      const result = await repository.update({ id, updatedById, data })

      // Assert - Kiểm tra kết quả
      expect(result).toMatchObject({
        name: 'Electronics Updated',
      })
      expect(mockPrismaService.category.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id, deletedAt: null },
          data: {
            ...data,
            updatedById,
          },
          include: {
            categoryTranslations: {
              where: { deletedAt: null },
            },
          },
        }),
      )
    })
  })

  describe('delete', () => {
    it('should soft delete category by default', async () => {
      // Arrange - Chuẩn bị dữ liệu
      const id = 1
      const deletedById = 2
      const mockCategory = createTestData.category({ id, deletedById, deletedAt: new Date() })

      mockPrismaService.category.update.mockResolvedValue(mockCategory)

      // Act - Thực hiện soft delete category
      const result = await repository.delete({ id, deletedById })

      // Assert - Kiểm tra kết quả
      expect(result).toMatchObject({
        id: 1,
        deletedById: 2,
      })
      expect(mockPrismaService.category.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id, deletedAt: null },
          data: expect.objectContaining({
            deletedById,
          }),
        }),
      )
      expect(mockPrismaService.category.delete).not.toHaveBeenCalled()
    })

    it('should hard delete category when isHard is true', async () => {
      // Arrange - Chuẩn bị dữ liệu
      const id = 1
      const deletedById = 2
      const mockCategory = createTestData.category({ id })

      mockPrismaService.category.delete.mockResolvedValue(mockCategory)

      // Act - Thực hiện hard delete category
      const result = await repository.delete({ id, deletedById }, true)

      // Assert - Kiểm tra kết quả
      expect(result).toMatchObject({ id: 1 })
      expect(mockPrismaService.category.delete).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id },
        }),
      )
      expect(mockPrismaService.category.update).not.toHaveBeenCalled()
    })

    it('should soft delete category when isHard is false', async () => {
      // Arrange - Chuẩn bị dữ liệu
      const id = 1
      const deletedById = 2
      const mockCategory = createTestData.category({ id, deletedById, deletedAt: new Date() })

      mockPrismaService.category.update.mockResolvedValue(mockCategory)

      // Act - Thực hiện soft delete category với isHard = false
      const result = await repository.delete({ id, deletedById }, false)

      // Assert - Kiểm tra kết quả
      expect(result).toMatchObject({
        id: 1,
        deletedById: 2,
      })
      expect(mockPrismaService.category.update).toHaveBeenCalled()
      expect(mockPrismaService.category.delete).not.toHaveBeenCalled()
    })
  })
})
