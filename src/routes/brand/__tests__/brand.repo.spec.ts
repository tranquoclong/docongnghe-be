import { Test, TestingModule } from '@nestjs/testing'
import { ALL_LANGUAGE_CODE } from 'src/shared/constants/other.constant'
import { PrismaService } from 'src/shared/services/prisma.service'
import { BrandRepo } from '../brand.repo'

describe('BrandRepo', () => {
  let repository: BrandRepo

  // Mock PrismaService
  const mockPrismaService = {
    brand: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      count: jest.fn(),
    },
  }

  // Test data factory
  const createTestData = {
    brand: (overrides = {}) => ({
      id: 1,
      name: 'Nike',
      logo: 'https://example.com/nike-logo.png',
      createdById: null,
      updatedById: null,
      deletedById: null,
      deletedAt: null,
      createdAt: new Date('2024-01-01'),
      updatedAt: new Date('2024-01-01'),
      ...overrides,
    }),
    brandWithTranslations: (overrides = {}) => ({
      id: 1,
      name: 'Nike',
      logo: 'https://example.com/nike-logo.png',
      createdById: null,
      updatedById: null,
      deletedById: null,
      deletedAt: null,
      createdAt: new Date('2024-01-01'),
      updatedAt: new Date('2024-01-01'),
      brandTranslations: [
        {
          id: 1,
          brandId: 1,
          languageId: 'en',
          name: 'Nike',
          description: 'Nike brand description',
          deletedAt: null,
        },
        {
          id: 2,
          brandId: 1,
          languageId: 'vi',
          name: 'Nike',
          description: 'Mô tả thương hiệu Nike',
          deletedAt: null,
        },
      ],
      ...overrides,
    }),
  }

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BrandRepo,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile()

    repository = module.get<BrandRepo>(BrandRepo)

    // Reset mocks
    jest.clearAllMocks()
  })

  describe('list', () => {
    it('should get list of brands with all languages', async () => {
      // Arrange - Chuẩn bị dữ liệu
      const pagination = { page: 1, limit: 10 }
      const languageId = ALL_LANGUAGE_CODE
      const mockBrands = [
        createTestData.brandWithTranslations({ id: 1, name: 'Nike' }),
        createTestData.brandWithTranslations({ id: 2, name: 'Adidas' }),
      ]

      mockPrismaService.brand.count.mockResolvedValue(2)
      mockPrismaService.brand.findMany.mockResolvedValue(mockBrands)

      // Act - Thực hiện lấy danh sách brands
      const result = await repository.list(pagination, languageId)

      // Assert - Kiểm tra kết quả
      expect(result.data).toHaveLength(2)
      expect(result.data[0]).toMatchObject({ id: 1, name: 'Nike' })
      expect(result.data[1]).toMatchObject({ id: 2, name: 'Adidas' })
      expect(result.totalItems).toBe(2)
      expect(result.page).toBe(1)
      expect(result.limit).toBe(10)
      expect(result.totalPages).toBe(1)
      expect(mockPrismaService.brand.count).toHaveBeenCalled()
      expect(mockPrismaService.brand.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { deletedAt: null },
          include: {
            brandTranslations: {
              where: { deletedAt: null },
            },
          },
        }),
      )
    })

    it('should get list of brands with specific language', async () => {
      // Arrange - Chuẩn bị dữ liệu
      const pagination = { page: 1, limit: 10 }
      const languageId = 'vi'
      const mockBrands = [
        createTestData.brandWithTranslations({
          brandTranslations: [
            {
              id: 2,
              brandId: 1,
              languageId: 'vi',
              name: 'Nike',
              description: 'Mô tả thương hiệu Nike',
              deletedAt: null,
            },
          ],
        }),
      ]

      mockPrismaService.brand.count.mockResolvedValue(1)
      mockPrismaService.brand.findMany.mockResolvedValue(mockBrands)

      // Act - Thực hiện lấy danh sách brands với ngôn ngữ cụ thể
      const result = await repository.list(pagination, languageId)

      // Assert - Kiểm tra kết quả
      expect(result.data).toHaveLength(1)
      expect(mockPrismaService.brand.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          include: {
            brandTranslations: {
              where: { deletedAt: null, languageId: 'vi' },
            },
          },
        }),
      )
    })

    it('should calculate pagination correctly for page 2', async () => {
      // Arrange - Chuẩn bị dữ liệu
      const pagination = { page: 2, limit: 10 }
      const languageId = ALL_LANGUAGE_CODE
      const mockBrands = [createTestData.brandWithTranslations({ id: 11 })]

      mockPrismaService.brand.count.mockResolvedValue(15)
      mockPrismaService.brand.findMany.mockResolvedValue(mockBrands)

      // Act - Thực hiện lấy danh sách brands trang 2
      const result = await repository.list(pagination, languageId)

      // Assert - Kiểm tra kết quả
      expect(result.page).toBe(2)
      expect(result.totalPages).toBe(2)
      expect(mockPrismaService.brand.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 10,
          take: 10,
        }),
      )
    })

    it('should only return brands that are not deleted', async () => {
      // Arrange - Chuẩn bị dữ liệu
      const pagination = { page: 1, limit: 10 }
      const languageId = ALL_LANGUAGE_CODE
      const mockBrands = [createTestData.brandWithTranslations({ deletedAt: null })]

      mockPrismaService.brand.count.mockResolvedValue(1)
      mockPrismaService.brand.findMany.mockResolvedValue(mockBrands)

      // Act - Thực hiện lấy danh sách brands
      await repository.list(pagination, languageId)

      // Assert - Kiểm tra kết quả
      expect(mockPrismaService.brand.count).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { deletedAt: null },
        }),
      )
      expect(mockPrismaService.brand.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { deletedAt: null },
        }),
      )
    })
  })

  describe('findById', () => {
    it('should find brand by id with all languages', async () => {
      // Arrange - Chuẩn bị dữ liệu
      const id = 1
      const languageId = ALL_LANGUAGE_CODE
      const mockBrand = createTestData.brandWithTranslations({ id })

      mockPrismaService.brand.findUnique.mockResolvedValue(mockBrand)

      // Act - Thực hiện tìm brand
      const result = await repository.findById(id, languageId)

      // Assert - Kiểm tra kết quả
      expect(result).toMatchObject({
        id: 1,
        name: 'Nike',
      })
      expect(result?.brandTranslations).toHaveLength(2)
      expect(mockPrismaService.brand.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id, deletedAt: null },
          include: {
            brandTranslations: {
              where: { deletedAt: null },
            },
          },
        }),
      )
    })

    it('should find brand by id with specific language', async () => {
      // Arrange - Chuẩn bị dữ liệu
      const id = 1
      const languageId = 'en'
      const mockBrand = createTestData.brandWithTranslations({
        brandTranslations: [
          {
            id: 1,
            brandId: 1,
            languageId: 'en',
            name: 'Nike',
            description: 'Nike brand description',
            deletedAt: null,
          },
        ],
      })

      mockPrismaService.brand.findUnique.mockResolvedValue(mockBrand)

      // Act - Thực hiện tìm brand với ngôn ngữ cụ thể
      const result = await repository.findById(id, languageId)

      // Assert - Kiểm tra kết quả
      expect(result?.brandTranslations).toHaveLength(1)
      expect(mockPrismaService.brand.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({
          include: {
            brandTranslations: {
              where: { deletedAt: null, languageId: 'en' },
            },
          },
        }),
      )
    })

    it('should return null when brand not found', async () => {
      // Arrange - Chuẩn bị dữ liệu
      const id = 999
      const languageId = ALL_LANGUAGE_CODE

      mockPrismaService.brand.findUnique.mockResolvedValue(null)

      // Act - Thực hiện tìm brand
      const result = await repository.findById(id, languageId)

      // Assert - Kiểm tra kết quả
      expect(result).toBeNull()
    })
  })

  describe('create', () => {
    it('should create brand successfully', async () => {
      // Arrange - Chuẩn bị dữ liệu
      const createdById = 1
      const data = {
        name: 'Puma',
        logo: 'https://example.com/puma-logo.png',
      }
      const mockBrand = createTestData.brandWithTranslations({ ...data, createdById })

      mockPrismaService.brand.create.mockResolvedValue(mockBrand)

      // Act - Thực hiện tạo brand
      const result = await repository.create({ createdById, data })

      // Assert - Kiểm tra kết quả
      expect(result).toMatchObject({
        name: 'Puma',
        logo: 'https://example.com/puma-logo.png',
        createdById: 1,
      })
      expect(mockPrismaService.brand.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: {
            ...data,
            createdById,
          },
          include: {
            brandTranslations: {
              where: { deletedAt: null },
            },
          },
        }),
      )
    })

    it('should create brand with null createdById', async () => {
      // Arrange - Chuẩn bị dữ liệu
      const createdById = null
      const data = {
        name: 'Reebok',
        logo: 'https://example.com/reebok-logo.png',
      }
      const mockBrand = createTestData.brandWithTranslations({ ...data, createdById: null })

      mockPrismaService.brand.create.mockResolvedValue(mockBrand)

      // Act - Thực hiện tạo brand với createdById null
      const result = await repository.create({ createdById, data })

      // Assert - Kiểm tra kết quả
      expect(result).toMatchObject({
        name: 'Reebok',
        createdById: null,
      })
    })
  })

  describe('update', () => {
    it('should update brand successfully', async () => {
      // Arrange - Chuẩn bị dữ liệu
      const id = 1
      const updatedById = 2
      const data = {
        name: 'Nike Updated',
        logo: 'https://example.com/nike-updated-logo.png',
      }
      const mockBrand = createTestData.brandWithTranslations({ ...data, updatedById })

      mockPrismaService.brand.update.mockResolvedValue(mockBrand)

      // Act - Thực hiện cập nhật brand
      const result = await repository.update({ id, updatedById, data })

      // Assert - Kiểm tra kết quả
      expect(result).toMatchObject({
        name: 'Nike Updated',
        logo: 'https://example.com/nike-updated-logo.png',
      })
      expect(mockPrismaService.brand.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id, deletedAt: null },
          data: {
            ...data,
            updatedById,
          },
          include: {
            brandTranslations: {
              where: { deletedAt: null },
            },
          },
        }),
      )
    })
  })

  describe('delete', () => {
    it('should soft delete brand by default', async () => {
      // Arrange - Chuẩn bị dữ liệu
      const id = 1
      const deletedById = 2
      const mockBrand = createTestData.brand({ id, deletedById, deletedAt: new Date() })

      mockPrismaService.brand.update.mockResolvedValue(mockBrand)

      // Act - Thực hiện soft delete brand
      const result = await repository.delete({ id, deletedById })

      // Assert - Kiểm tra kết quả
      expect(result).toMatchObject({
        id: 1,
        deletedById: 2,
      })
      expect(mockPrismaService.brand.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id, deletedAt: null },
          data: expect.objectContaining({
            deletedById,
          }),
        }),
      )
      expect(mockPrismaService.brand.delete).not.toHaveBeenCalled()
    })

    it('should hard delete brand when isHard is true', async () => {
      // Arrange - Chuẩn bị dữ liệu
      const id = 1
      const deletedById = 2
      const mockBrand = createTestData.brand({ id })

      mockPrismaService.brand.delete.mockResolvedValue(mockBrand)

      // Act - Thực hiện hard delete brand
      const result = await repository.delete({ id, deletedById }, true)

      // Assert - Kiểm tra kết quả
      expect(result).toMatchObject({ id: 1 })
      expect(mockPrismaService.brand.delete).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id },
        }),
      )
      expect(mockPrismaService.brand.update).not.toHaveBeenCalled()
    })

    it('should soft delete brand when isHard is false', async () => {
      // Arrange - Chuẩn bị dữ liệu
      const id = 1
      const deletedById = 2
      const mockBrand = createTestData.brand({ id, deletedById, deletedAt: new Date() })

      mockPrismaService.brand.update.mockResolvedValue(mockBrand)

      // Act - Thực hiện soft delete brand với isHard = false
      const result = await repository.delete({ id, deletedById }, false)

      // Assert - Kiểm tra kết quả
      expect(result).toMatchObject({
        id: 1,
        deletedById: 2,
      })
      expect(mockPrismaService.brand.update).toHaveBeenCalled()
      expect(mockPrismaService.brand.delete).not.toHaveBeenCalled()
    })
  })
})
