import { Test, TestingModule } from '@nestjs/testing'
import { PrismaService } from 'src/shared/services/prisma.service'
import { BrandTranslationRepo } from '../brand-translation.repo'

describe('BrandTranslationRepo', () => {
  let repository: BrandTranslationRepo

  // Mock PrismaService
  const mockPrismaService = {
    brandTranslation: {
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
  }

  // Test data factory
  const createTestData = {
    brandTranslation: (overrides = {}) => ({
      id: 1,
      brandId: 1,
      languageId: 'en',
      name: 'Nike',
      description: 'Nike brand description',
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
        BrandTranslationRepo,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile()

    repository = module.get<BrandTranslationRepo>(BrandTranslationRepo)

    // Reset mocks
    jest.clearAllMocks()
  })

  describe('findById', () => {
    it('should find brand translation by id', async () => {
      // Arrange - Chuẩn bị dữ liệu
      const id = 1
      const mockBrandTranslation = createTestData.brandTranslation({ id })

      mockPrismaService.brandTranslation.findUnique.mockResolvedValue(mockBrandTranslation)

      // Act - Thực hiện tìm brand translation
      const result = await repository.findById(id)

      // Assert - Kiểm tra kết quả
      expect(result).toMatchObject({
        id: 1,
        brandId: 1,
        languageId: 'en',
        name: 'Nike',
        description: 'Nike brand description',
      })
      expect(mockPrismaService.brandTranslation.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id, deletedAt: null },
        }),
      )
    })

    it('should return null when brand translation not found', async () => {
      // Arrange - Chuẩn bị dữ liệu
      const id = 999

      mockPrismaService.brandTranslation.findUnique.mockResolvedValue(null)

      // Act - Thực hiện tìm brand translation
      const result = await repository.findById(id)

      // Assert - Kiểm tra kết quả
      expect(result).toBeNull()
    })

    it('should not return deleted brand translation', async () => {
      // Arrange - Chuẩn bị dữ liệu
      const id = 1

      mockPrismaService.brandTranslation.findUnique.mockResolvedValue(null)

      // Act - Thực hiện tìm brand translation đã bị xóa
      const result = await repository.findById(id)

      // Assert - Kiểm tra kết quả
      expect(result).toBeNull()
      expect(mockPrismaService.brandTranslation.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id, deletedAt: null },
        }),
      )
    })
  })

  describe('create', () => {
    it('should create brand translation successfully', async () => {
      // Arrange - Chuẩn bị dữ liệu
      const createdById = 1
      const data = {
        brandId: 1,
        languageId: 'vi',
        name: 'Nike',
        description: 'Mô tả thương hiệu Nike',
      }
      const mockBrandTranslation = createTestData.brandTranslation({ ...data, createdById })

      mockPrismaService.brandTranslation.create.mockResolvedValue(mockBrandTranslation)

      // Act - Thực hiện tạo brand translation
      const result = await repository.create({ createdById, data })

      // Assert - Kiểm tra kết quả
      expect(result).toMatchObject({
        brandId: 1,
        languageId: 'vi',
        name: 'Nike',
        description: 'Mô tả thương hiệu Nike',
        createdById: 1,
      })
      expect(mockPrismaService.brandTranslation.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: {
            ...data,
            createdById,
          },
        }),
      )
    })

    it('should create brand translation with null createdById', async () => {
      // Arrange - Chuẩn bị dữ liệu
      const createdById = null
      const data = {
        brandId: 2,
        languageId: 'en',
        name: 'Adidas',
        description: 'Adidas brand description',
      }
      const mockBrandTranslation = createTestData.brandTranslation({ ...data, createdById: null })

      mockPrismaService.brandTranslation.create.mockResolvedValue(mockBrandTranslation)

      // Act - Thực hiện tạo brand translation với createdById null
      const result = await repository.create({ createdById, data })

      // Assert - Kiểm tra kết quả
      expect(result).toMatchObject({
        brandId: 2,
        languageId: 'en',
        name: 'Adidas',
        createdById: null,
      })
    })

    it('should create brand translation for different language', async () => {
      // Arrange - Chuẩn bị dữ liệu
      const createdById = 1
      const data = {
        brandId: 1,
        languageId: 'fr',
        name: 'Nike',
        description: 'Description de la marque Nike',
      }
      const mockBrandTranslation = createTestData.brandTranslation({ ...data, createdById })

      mockPrismaService.brandTranslation.create.mockResolvedValue(mockBrandTranslation)

      // Act - Thực hiện tạo brand translation cho ngôn ngữ khác
      const result = await repository.create({ createdById, data })

      // Assert - Kiểm tra kết quả
      expect(result).toMatchObject({
        languageId: 'fr',
        description: 'Description de la marque Nike',
      })
    })
  })

  describe('update', () => {
    it('should update brand translation successfully', async () => {
      // Arrange - Chuẩn bị dữ liệu
      const id = 1
      const updatedById = 2
      const data = {
        brandId: 1,
        languageId: 'en',
        name: 'Nike Updated',
        description: 'Nike brand description updated',
      }
      const mockBrandTranslation = createTestData.brandTranslation({ id, ...data, updatedById })

      mockPrismaService.brandTranslation.update.mockResolvedValue(mockBrandTranslation)

      // Act - Thực hiện cập nhật brand translation
      const result = await repository.update({ id, updatedById, data })

      // Assert - Kiểm tra kết quả
      expect(result).toMatchObject({
        id: 1,
        name: 'Nike Updated',
        description: 'Nike brand description updated',
        updatedById: 2,
      })
      expect(mockPrismaService.brandTranslation.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id, deletedAt: null },
          data: {
            ...data,
            updatedById,
          },
        }),
      )
    })

    it('should not update deleted brand translation', async () => {
      // Arrange - Chuẩn bị dữ liệu
      const id = 1
      const updatedById = 2
      const data = {
        brandId: 1,
        languageId: 'en',
        name: 'Nike Updated',
        description: 'Updated description',
      }

      mockPrismaService.brandTranslation.update.mockResolvedValue(null)

      // Act - Thực hiện cập nhật brand translation đã bị xóa
      const result = await repository.update({ id, updatedById, data })

      // Assert - Kiểm tra kết quả
      expect(mockPrismaService.brandTranslation.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id, deletedAt: null },
        }),
      )
    })
  })

  describe('delete', () => {
    it('should soft delete brand translation by default', async () => {
      // Arrange - Chuẩn bị dữ liệu
      const id = 1
      const deletedById = 2
      const mockBrandTranslation = createTestData.brandTranslation({ id, deletedById, deletedAt: new Date() })

      mockPrismaService.brandTranslation.update.mockResolvedValue(mockBrandTranslation)

      // Act - Thực hiện soft delete brand translation
      const result = await repository.delete({ id, deletedById })

      // Assert - Kiểm tra kết quả
      expect(result).toMatchObject({
        id: 1,
        deletedById: 2,
      })
      expect(mockPrismaService.brandTranslation.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id, deletedAt: null },
          data: expect.objectContaining({
            deletedById,
            deletedAt: expect.any(Date),
          }),
        }),
      )
      expect(mockPrismaService.brandTranslation.delete).not.toHaveBeenCalled()
    })

    it('should hard delete brand translation when isHard is true', async () => {
      // Arrange - Chuẩn bị dữ liệu
      const id = 1
      const deletedById = 2
      const mockBrandTranslation = createTestData.brandTranslation({ id })

      mockPrismaService.brandTranslation.delete.mockResolvedValue(mockBrandTranslation)

      // Act - Thực hiện hard delete brand translation
      const result = await repository.delete({ id, deletedById }, true)

      // Assert - Kiểm tra kết quả
      expect(result).toMatchObject({ id: 1 })
      expect(mockPrismaService.brandTranslation.delete).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id },
        }),
      )
      expect(mockPrismaService.brandTranslation.update).not.toHaveBeenCalled()
    })

    it('should soft delete brand translation when isHard is false', async () => {
      // Arrange - Chuẩn bị dữ liệu
      const id = 1
      const deletedById = 2
      const mockBrandTranslation = createTestData.brandTranslation({ id, deletedById, deletedAt: new Date() })

      mockPrismaService.brandTranslation.update.mockResolvedValue(mockBrandTranslation)

      // Act - Thực hiện soft delete brand translation với isHard = false
      const result = await repository.delete({ id, deletedById }, false)

      // Assert - Kiểm tra kết quả
      expect(result).toMatchObject({
        id: 1,
        deletedById: 2,
      })
      expect(mockPrismaService.brandTranslation.update).toHaveBeenCalled()
      expect(mockPrismaService.brandTranslation.delete).not.toHaveBeenCalled()
    })
  })
})
