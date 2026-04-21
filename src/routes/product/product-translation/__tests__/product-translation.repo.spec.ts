import { Test, TestingModule } from '@nestjs/testing'
import { PrismaService } from 'src/shared/services/prisma.service'
import { ProductTranslationRepo } from '../product-translation.repo'

describe('ProductTranslationRepo', () => {
  let repository: ProductTranslationRepo

  // Mock PrismaService
  const mockPrismaService = {
    productTranslation: {
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
  }

  // Test data factory
  const createTestData = {
    productTranslation: (overrides = {}) => ({
      id: 1,
      productId: 1,
      languageId: 'en',
      name: 'iPhone 15 Pro',
      description: 'Latest iPhone with advanced features',
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
        ProductTranslationRepo,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile()

    repository = module.get<ProductTranslationRepo>(ProductTranslationRepo)

    // Reset mocks
    jest.clearAllMocks()
  })

  describe('findById', () => {
    it('should find product translation by id', async () => {
      // Arrange - Chuẩn bị dữ liệu
      const id = 1
      const mockProductTranslation = createTestData.productTranslation({ id })

      mockPrismaService.productTranslation.findUnique.mockResolvedValue(mockProductTranslation)

      // Act - Thực hiện tìm product translation
      const result = await repository.findById(id)

      // Assert - Kiểm tra kết quả
      expect(result).toMatchObject({
        id: 1,
        productId: 1,
        languageId: 'en',
        name: 'iPhone 15 Pro',
        description: 'Latest iPhone with advanced features',
      })
      expect(mockPrismaService.productTranslation.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id, deletedAt: null },
        }),
      )
    })

    it('should return null when product translation not found', async () => {
      // Arrange - Chuẩn bị dữ liệu
      const id = 999

      mockPrismaService.productTranslation.findUnique.mockResolvedValue(null)

      // Act - Thực hiện tìm product translation
      const result = await repository.findById(id)

      // Assert - Kiểm tra kết quả
      expect(result).toBeNull()
    })

    it('should not return deleted product translation', async () => {
      // Arrange - Chuẩn bị dữ liệu
      const id = 1

      mockPrismaService.productTranslation.findUnique.mockResolvedValue(null)

      // Act - Thực hiện tìm product translation đã bị xóa
      const result = await repository.findById(id)

      // Assert - Kiểm tra kết quả
      expect(result).toBeNull()
      expect(mockPrismaService.productTranslation.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id, deletedAt: null },
        }),
      )
    })
  })

  describe('create', () => {
    it('should create product translation successfully', async () => {
      // Arrange - Chuẩn bị dữ liệu
      const createdById = 1
      const data = {
        productId: 1,
        languageId: 'vi',
        name: 'iPhone 15 Pro',
        description: 'iPhone mới nhất với tính năng tiên tiến',
      }
      const mockProductTranslation = createTestData.productTranslation({ ...data, createdById })

      mockPrismaService.productTranslation.create.mockResolvedValue(mockProductTranslation)

      // Act - Thực hiện tạo product translation
      const result = await repository.create({ createdById, data })

      // Assert - Kiểm tra kết quả
      expect(result).toMatchObject({
        productId: 1,
        languageId: 'vi',
        name: 'iPhone 15 Pro',
        description: 'iPhone mới nhất với tính năng tiên tiến',
        createdById: 1,
      })
      expect(mockPrismaService.productTranslation.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: {
            ...data,
            createdById,
          },
        }),
      )
    })

    it('should create product translation with null createdById', async () => {
      // Arrange - Chuẩn bị dữ liệu
      const createdById = null
      const data = {
        productId: 2,
        languageId: 'en',
        name: 'Samsung Galaxy S24',
        description: 'Latest Samsung flagship phone',
      }
      const mockProductTranslation = createTestData.productTranslation({ ...data, createdById: null })

      mockPrismaService.productTranslation.create.mockResolvedValue(mockProductTranslation)

      // Act - Thực hiện tạo product translation với createdById null
      const result = await repository.create({ createdById, data })

      // Assert - Kiểm tra kết quả
      expect(result).toMatchObject({
        productId: 2,
        languageId: 'en',
        name: 'Samsung Galaxy S24',
        createdById: null,
      })
    })

    it('should create product translation for different language', async () => {
      // Arrange - Chuẩn bị dữ liệu
      const createdById = 1
      const data = {
        productId: 1,
        languageId: 'fr',
        name: 'iPhone 15 Pro',
        description: 'Dernier iPhone avec des fonctionnalités avancées',
      }
      const mockProductTranslation = createTestData.productTranslation({ ...data, createdById })

      mockPrismaService.productTranslation.create.mockResolvedValue(mockProductTranslation)

      // Act - Thực hiện tạo product translation cho ngôn ngữ khác
      const result = await repository.create({ createdById, data })

      // Assert - Kiểm tra kết quả
      expect(result).toMatchObject({
        languageId: 'fr',
        description: 'Dernier iPhone avec des fonctionnalités avancées',
      })
    })
  })

  describe('update', () => {
    it('should update product translation successfully', async () => {
      // Arrange - Chuẩn bị dữ liệu
      const id = 1
      const updatedById = 2
      const data = {
        productId: 1,
        languageId: 'en',
        name: 'iPhone 15 Pro Max',
        description: 'Updated iPhone description',
      }
      const mockProductTranslation = createTestData.productTranslation({ id, ...data, updatedById })

      mockPrismaService.productTranslation.update.mockResolvedValue(mockProductTranslation)

      // Act - Thực hiện cập nhật product translation
      const result = await repository.update({ id, updatedById, data })

      // Assert - Kiểm tra kết quả
      expect(result).toMatchObject({
        id: 1,
        name: 'iPhone 15 Pro Max',
        description: 'Updated iPhone description',
        updatedById: 2,
      })
      expect(mockPrismaService.productTranslation.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id, deletedAt: null },
          data: {
            ...data,
            updatedById,
          },
        }),
      )
    })

    it('should not update deleted product translation', async () => {
      // Arrange - Chuẩn bị dữ liệu
      const id = 1
      const updatedById = 2
      const data = {
        productId: 1,
        languageId: 'en',
        name: 'iPhone Updated',
        description: 'Updated description',
      }

      mockPrismaService.productTranslation.update.mockResolvedValue(null)

      // Act - Thực hiện cập nhật product translation đã bị xóa
      const result = await repository.update({ id, updatedById, data })

      // Assert - Kiểm tra kết quả
      expect(mockPrismaService.productTranslation.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id, deletedAt: null },
        }),
      )
    })
  })

  describe('delete', () => {
    it('should soft delete product translation by default', async () => {
      // Arrange - Chuẩn bị dữ liệu
      const id = 1
      const deletedById = 2
      const mockProductTranslation = createTestData.productTranslation({ id, deletedById, deletedAt: new Date() })

      mockPrismaService.productTranslation.update.mockResolvedValue(mockProductTranslation)

      // Act - Thực hiện soft delete product translation
      const result = await repository.delete({ id, deletedById })

      // Assert - Kiểm tra kết quả
      expect(result).toMatchObject({
        id: 1,
        deletedById: 2,
      })
      expect(mockPrismaService.productTranslation.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id, deletedAt: null },
          data: expect.objectContaining({
            deletedById,
            deletedAt: expect.any(Date),
          }),
        }),
      )
      expect(mockPrismaService.productTranslation.delete).not.toHaveBeenCalled()
    })

    it('should hard delete product translation when isHard is true', async () => {
      // Arrange - Chuẩn bị dữ liệu
      const id = 1
      const deletedById = 2
      const mockProductTranslation = createTestData.productTranslation({ id })

      mockPrismaService.productTranslation.delete.mockResolvedValue(mockProductTranslation)

      // Act - Thực hiện hard delete product translation
      const result = await repository.delete({ id, deletedById }, true)

      // Assert - Kiểm tra kết quả
      expect(result).toMatchObject({ id: 1 })
      expect(mockPrismaService.productTranslation.delete).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id },
        }),
      )
      expect(mockPrismaService.productTranslation.update).not.toHaveBeenCalled()
    })

    it('should soft delete product translation when isHard is false', async () => {
      // Arrange - Chuẩn bị dữ liệu
      const id = 1
      const deletedById = 2
      const mockProductTranslation = createTestData.productTranslation({ id, deletedById, deletedAt: new Date() })

      mockPrismaService.productTranslation.update.mockResolvedValue(mockProductTranslation)

      // Act - Thực hiện soft delete product translation với isHard = false
      const result = await repository.delete({ id, deletedById }, false)

      // Assert - Kiểm tra kết quả
      expect(result).toMatchObject({
        id: 1,
        deletedById: 2,
      })
      expect(mockPrismaService.productTranslation.update).toHaveBeenCalled()
      expect(mockPrismaService.productTranslation.delete).not.toHaveBeenCalled()
    })
  })
})
