import { Test, TestingModule } from '@nestjs/testing'
import { PrismaService } from 'src/shared/services/prisma.service'
import { CategoryTranslationRepo } from '../category-translation.repo'

describe('CategoryTranslationRepo', () => {
  let repository: CategoryTranslationRepo

  // Mock PrismaService
  const mockPrismaService = {
    categoryTranslation: {
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
  }

  // Test data factory
  const createTestData = {
    categoryTranslation: (overrides = {}) => ({
      id: 1,
      categoryId: 1,
      languageId: 'en',
      name: 'Electronics',
      description: 'Electronics category description',
      createdById: null,
      updatedById: null,
      deletedById: null,
      deletedAt: null,
      createdAt: new Date('2024-01-01'),
      updatedAt: new Date('2024-01-01'),
      ...overrides,
    }),
  }

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CategoryTranslationRepo,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile()

    repository = module.get<CategoryTranslationRepo>(CategoryTranslationRepo)

    // Reset mocks
    jest.clearAllMocks()
  })

  describe('findById', () => {
    it('should find category translation by id', async () => {
      // Arrange - Chuẩn bị dữ liệu
      const id = 1
      const mockCategoryTranslation = createTestData.categoryTranslation({ id })

      mockPrismaService.categoryTranslation.findUnique.mockResolvedValue(mockCategoryTranslation)

      // Act - Thực hiện tìm category translation
      const result = await repository.findById(id)

      // Assert - Kiểm tra kết quả
      expect(result).toMatchObject({
        id: 1,
        categoryId: 1,
        languageId: 'en',
        name: 'Electronics',
        description: 'Electronics category description',
      })
      expect(mockPrismaService.categoryTranslation.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id, deletedAt: null },
        }),
      )
    })

    it('should return null when category translation not found', async () => {
      // Arrange - Chuẩn bị dữ liệu
      const id = 999

      mockPrismaService.categoryTranslation.findUnique.mockResolvedValue(null)

      // Act - Thực hiện tìm category translation
      const result = await repository.findById(id)

      // Assert - Kiểm tra kết quả
      expect(result).toBeNull()
    })

    it('should not return deleted category translation', async () => {
      // Arrange - Chuẩn bị dữ liệu
      const id = 1

      mockPrismaService.categoryTranslation.findUnique.mockResolvedValue(null)

      // Act - Thực hiện tìm category translation đã bị xóa
      const result = await repository.findById(id)

      // Assert - Kiểm tra kết quả
      expect(result).toBeNull()
      expect(mockPrismaService.categoryTranslation.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id, deletedAt: null },
        }),
      )
    })
  })

  describe('create', () => {
    it('should create category translation successfully', async () => {
      // Arrange - Chuẩn bị dữ liệu
      const createdById = 1
      const data = {
        categoryId: 1,
        languageId: 'vi',
        name: 'Điện tử',
        description: 'Mô tả danh mục điện tử',
      }
      const mockCategoryTranslation = createTestData.categoryTranslation({ ...data, createdById })

      mockPrismaService.categoryTranslation.create.mockResolvedValue(mockCategoryTranslation)

      // Act - Thực hiện tạo category translation
      const result = await repository.create({ createdById, data })

      // Assert - Kiểm tra kết quả
      expect(result).toMatchObject({
        categoryId: 1,
        languageId: 'vi',
        name: 'Điện tử',
        description: 'Mô tả danh mục điện tử',
        createdById: 1,
      })
      expect(mockPrismaService.categoryTranslation.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: {
            ...data,
            createdById,
          },
        }),
      )
    })

    it('should create category translation with null createdById', async () => {
      // Arrange - Chuẩn bị dữ liệu
      const createdById = null
      const data = {
        categoryId: 2,
        languageId: 'en',
        name: 'Fashion',
        description: 'Fashion category description',
      }
      const mockCategoryTranslation = createTestData.categoryTranslation({ ...data, createdById: null })

      mockPrismaService.categoryTranslation.create.mockResolvedValue(mockCategoryTranslation)

      // Act - Thực hiện tạo category translation với createdById null
      const result = await repository.create({ createdById, data })

      // Assert - Kiểm tra kết quả
      expect(result).toMatchObject({
        categoryId: 2,
        languageId: 'en',
        name: 'Fashion',
        createdById: null,
      })
    })

    it('should create category translation for different language', async () => {
      // Arrange - Chuẩn bị dữ liệu
      const createdById = 1
      const data = {
        categoryId: 1,
        languageId: 'fr',
        name: 'Électronique',
        description: 'Description de la catégorie électronique',
      }
      const mockCategoryTranslation = createTestData.categoryTranslation({ ...data, createdById })

      mockPrismaService.categoryTranslation.create.mockResolvedValue(mockCategoryTranslation)

      // Act - Thực hiện tạo category translation cho ngôn ngữ khác
      const result = await repository.create({ createdById, data })

      // Assert - Kiểm tra kết quả
      expect(result).toMatchObject({
        languageId: 'fr',
        description: 'Description de la catégorie électronique',
      })
    })
  })

  describe('update', () => {
    it('should update category translation successfully', async () => {
      // Arrange - Chuẩn bị dữ liệu
      const id = 1
      const updatedById = 2
      const data = {
        categoryId: 1,
        languageId: 'en',
        name: 'Electronics Updated',
        description: 'Electronics category description updated',
      }
      const mockCategoryTranslation = createTestData.categoryTranslation({ id, ...data, updatedById })

      mockPrismaService.categoryTranslation.update.mockResolvedValue(mockCategoryTranslation)

      // Act - Thực hiện cập nhật category translation
      const result = await repository.update({ id, updatedById, data })

      // Assert - Kiểm tra kết quả
      expect(result).toMatchObject({
        id: 1,
        name: 'Electronics Updated',
        description: 'Electronics category description updated',
        updatedById: 2,
      })
      expect(mockPrismaService.categoryTranslation.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id, deletedAt: null },
          data: {
            ...data,
            updatedById,
          },
        }),
      )
    })

    it('should not update deleted category translation', async () => {
      // Arrange - Chuẩn bị dữ liệu
      const id = 1
      const updatedById = 2
      const data = {
        categoryId: 1,
        languageId: 'en',
        name: 'Electronics Updated',
        description: 'Updated description',
      }

      mockPrismaService.categoryTranslation.update.mockResolvedValue(null)

      // Act - Thực hiện cập nhật category translation đã bị xóa
      const result = await repository.update({ id, updatedById, data })

      // Assert - Kiểm tra kết quả
      expect(mockPrismaService.categoryTranslation.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id, deletedAt: null },
        }),
      )
    })
  })

  describe('delete', () => {
    it('should soft delete category translation by default', async () => {
      // Arrange - Chuẩn bị dữ liệu
      const id = 1
      const deletedById = 2
      const mockCategoryTranslation = createTestData.categoryTranslation({ id, deletedById, deletedAt: new Date() })

      mockPrismaService.categoryTranslation.update.mockResolvedValue(mockCategoryTranslation)

      // Act - Thực hiện soft delete category translation
      const result = await repository.delete({ id, deletedById })

      // Assert - Kiểm tra kết quả
      expect(result).toMatchObject({
        id: 1,
        deletedById: 2,
      })
      expect(mockPrismaService.categoryTranslation.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id, deletedAt: null },
          data: expect.objectContaining({
            deletedById,
            deletedAt: expect.any(Date),
          }),
        }),
      )
      expect(mockPrismaService.categoryTranslation.delete).not.toHaveBeenCalled()
    })

    it('should hard delete category translation when isHard is true', async () => {
      // Arrange - Chuẩn bị dữ liệu
      const id = 1
      const deletedById = 2
      const mockCategoryTranslation = createTestData.categoryTranslation({ id })

      mockPrismaService.categoryTranslation.delete.mockResolvedValue(mockCategoryTranslation)

      // Act - Thực hiện hard delete category translation
      const result = await repository.delete({ id, deletedById }, true)

      // Assert - Kiểm tra kết quả
      expect(result).toMatchObject({ id: 1 })
      expect(mockPrismaService.categoryTranslation.delete).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id },
        }),
      )
      expect(mockPrismaService.categoryTranslation.update).not.toHaveBeenCalled()
    })

    it('should soft delete category translation when isHard is false', async () => {
      // Arrange - Chuẩn bị dữ liệu
      const id = 1
      const deletedById = 2
      const mockCategoryTranslation = createTestData.categoryTranslation({ id, deletedById, deletedAt: new Date() })

      mockPrismaService.categoryTranslation.update.mockResolvedValue(mockCategoryTranslation)

      // Act - Thực hiện soft delete category translation với isHard = false
      const result = await repository.delete({ id, deletedById }, false)

      // Assert - Kiểm tra kết quả
      expect(result).toMatchObject({
        id: 1,
        deletedById: 2,
      })
      expect(mockPrismaService.categoryTranslation.update).toHaveBeenCalled()
      expect(mockPrismaService.categoryTranslation.delete).not.toHaveBeenCalled()
    })
  })
})
