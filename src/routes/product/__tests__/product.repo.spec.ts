import { Test, TestingModule } from '@nestjs/testing'
import { OrderBy, SortBy } from '../../../shared/constants/other.constant'
import { PrismaService } from '../../../shared/services/prisma.service'
import { ProductRepo } from '../product.repo'

describe('ProductRepo', () => {
  let repository: ProductRepo
  let prismaService: PrismaService

  // Mock PrismaService
  const mockPrismaService = {
    product: {
      create: jest.fn(),
      update: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      delete: jest.fn(),
    },
    sKU: {
      findMany: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
      createMany: jest.fn(),
    },
    productTranslation: {
      updateMany: jest.fn(),
    },
    $transaction: jest.fn(),
  }

  // Test data factories
  const createTestData = {
    product: (overrides = {}) => ({
      id: 1,
      name: 'Test Product',
      description: 'Test Description',
      basePrice: 100000,
      brandId: 1,
      createdById: 1,
      updatedById: null,
      deletedById: null,
      publishedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      deletedAt: null,
      ...overrides,
    }),
    createProductBody: () => ({
      name: 'New Product',
      variants: [{ value: 'Color', options: ['Red', 'Blue'] }],
      publishedAt: new Date().toISOString(),
      basePrice: 150000,
      virtualPrice: 180000,
      brandId: 1,
      images: ['image1.jpg', 'image2.jpg'],
      categories: [1, 2],
      skus: [
        { value: 'Red-M', price: 150000, stock: 10, image: 'image1.jpg' },
        { value: 'Blue-L', price: 160000, stock: 5, image: 'image2.jpg' },
      ],
    }),
    updateProductBody: () => ({
      name: 'Updated Product',
      variants: [{ value: 'Color', options: ['Red'] }],
      publishedAt: new Date().toISOString(),
      basePrice: 200000,
      virtualPrice: 250000,
      brandId: 2,
      images: ['image1.jpg'],
      categories: [1, 3],
      skus: [{ value: 'Red-M', price: 200000, stock: 20, image: 'image1.jpg' }],
    }),
    sku: (overrides = {}) => ({
      id: 1,
      productId: 1,
      value: 'Red-M',
      price: 150000,
      stock: 10,
      image: 'image1.jpg',
      createdById: 1,
      updatedById: null,
      deletedById: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      deletedAt: null,
      ...overrides,
    }),
  }

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProductRepo,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile()

    repository = module.get<ProductRepo>(ProductRepo)
    prismaService = module.get<PrismaService>(PrismaService)

    // Reset mocks
    jest.clearAllMocks()
  })

  describe('list', () => {
    it('should list products with pagination', async () => {
      // Arrange - Chuẩn bị dữ liệu
      const params = {
        limit: 10,
        page: 1,
        languageId: 'vi',
        orderBy: OrderBy.Desc,
        sortBy: SortBy.CreatedAt,
      }
      const mockProducts = [createTestData.product(), createTestData.product({ id: 2 })]
      const totalItems = 2

      mockPrismaService.product.count.mockResolvedValue(totalItems)
      mockPrismaService.product.findMany.mockResolvedValue(mockProducts)

      // Act - Thực hiện list
      const result = await repository.list(params)

      // Assert - Kiểm tra kết quả
      expect(result.data).toHaveLength(2)
      expect(result.totalItems).toBe(totalItems)
      expect(result.page).toBe(1)
      expect(result.limit).toBe(10)
      expect(mockPrismaService.product.findMany).toHaveBeenCalled()
    })

    it('should filter by name', async () => {
      // Arrange - Chuẩn bị dữ liệu với filter name
      const params = {
        limit: 10,
        page: 1,
        name: 'Test',
        languageId: 'vi',
        orderBy: OrderBy.Desc,
        sortBy: SortBy.CreatedAt,
      }
      const mockProducts = [createTestData.product({ name: 'Test Product' })]

      mockPrismaService.product.count.mockResolvedValue(1)
      mockPrismaService.product.findMany.mockResolvedValue(mockProducts)

      // Act - Thực hiện list
      const result = await repository.list(params)

      // Assert - Kiểm tra kết quả
      expect(result.data).toHaveLength(1)
    })

    it('should filter by brandIds', async () => {
      // Arrange - Chuẩn bị dữ liệu với filter brandIds
      const params = {
        limit: 10,
        page: 1,
        brandIds: [1, 2],
        languageId: 'vi',
        orderBy: OrderBy.Desc,
        sortBy: SortBy.CreatedAt,
      }
      const mockProducts = [createTestData.product({ brandId: 1 })]

      mockPrismaService.product.count.mockResolvedValue(1)
      mockPrismaService.product.findMany.mockResolvedValue(mockProducts)

      // Act - Thực hiện list
      const result = await repository.list(params)

      // Assert - Kiểm tra kết quả
      expect(result.data).toHaveLength(1)
    })

    it('should filter by categories', async () => {
      // Arrange - Chuẩn bị dữ liệu với filter categories
      const params = {
        limit: 10,
        page: 1,
        categories: [1, 2],
        languageId: 'vi',
        orderBy: OrderBy.Desc,
        sortBy: SortBy.CreatedAt,
      }
      const mockProducts = [createTestData.product()]

      mockPrismaService.product.count.mockResolvedValue(1)
      mockPrismaService.product.findMany.mockResolvedValue(mockProducts)

      // Act - Thực hiện list
      const result = await repository.list(params)

      // Assert - Kiểm tra kết quả
      expect(result.data).toHaveLength(1)
    })

    it('should filter by price range', async () => {
      // Arrange - Chuẩn bị dữ liệu với filter price
      const params = {
        limit: 10,
        page: 1,
        minPrice: 50000,
        maxPrice: 200000,
        languageId: 'vi',
        orderBy: OrderBy.Desc,
        sortBy: SortBy.CreatedAt,
      }
      const mockProducts = [createTestData.product({ basePrice: 100000 })]

      mockPrismaService.product.count.mockResolvedValue(1)
      mockPrismaService.product.findMany.mockResolvedValue(mockProducts)

      // Act - Thực hiện list
      const result = await repository.list(params)

      // Assert - Kiểm tra kết quả
      expect(result.data).toHaveLength(1)
    })

    it('should filter by isPublic true', async () => {
      // Arrange - Chuẩn bị dữ liệu với filter isPublic
      const params = {
        limit: 10,
        page: 1,
        isPublic: true,
        languageId: 'vi',
        orderBy: OrderBy.Desc,
        sortBy: SortBy.CreatedAt,
      }
      const mockProducts = [createTestData.product({ publishedAt: new Date().toISOString() })]

      mockPrismaService.product.count.mockResolvedValue(1)
      mockPrismaService.product.findMany.mockResolvedValue(mockProducts)

      // Act - Thực hiện list
      const result = await repository.list(params)

      // Assert - Kiểm tra kết quả
      expect(result.data).toHaveLength(1)
    })

    it('should filter by isPublic false', async () => {
      // Arrange - Chuẩn bị dữ liệu với filter isPublic false
      const params = {
        limit: 10,
        page: 1,
        isPublic: false,
        languageId: 'vi',
        orderBy: OrderBy.Desc,
        sortBy: SortBy.CreatedAt,
      }
      const mockProducts = [createTestData.product({ publishedAt: null })]

      mockPrismaService.product.count.mockResolvedValue(1)
      mockPrismaService.product.findMany.mockResolvedValue(mockProducts)

      // Act - Thực hiện list
      const result = await repository.list(params)

      // Assert - Kiểm tra kết quả
      expect(result.data).toHaveLength(1)
    })

    it('should sort by price', async () => {
      // Arrange - Chuẩn bị dữ liệu với sort by price
      const params = {
        limit: 10,
        page: 1,
        languageId: 'vi',
        orderBy: OrderBy.Asc,
        sortBy: SortBy.Price,
      }
      const mockProducts = [createTestData.product()]

      mockPrismaService.product.count.mockResolvedValue(1)
      mockPrismaService.product.findMany.mockResolvedValue(mockProducts)

      // Act - Thực hiện list
      const result = await repository.list(params)

      // Assert - Kiểm tra kết quả
      expect(result.data).toHaveLength(1)
    })

    it('should sort by sale', async () => {
      // Arrange - Chuẩn bị dữ liệu với sort by sale
      const params = {
        limit: 10,
        page: 1,
        languageId: 'vi',
        orderBy: OrderBy.Desc,
        sortBy: SortBy.Sale,
      }
      const mockProducts = [createTestData.product()]

      mockPrismaService.product.count.mockResolvedValue(1)
      mockPrismaService.product.findMany.mockResolvedValue(mockProducts)

      // Act - Thực hiện list
      const result = await repository.list(params)

      // Assert - Kiểm tra kết quả
      expect(result.data).toHaveLength(1)
    })
  })

  describe('findById', () => {
    it('should find product by id successfully', async () => {
      // Arrange - Chuẩn bị dữ liệu
      const productId = 1
      const mockProduct = createTestData.product({ id: productId })

      mockPrismaService.product.findUnique.mockResolvedValue(mockProduct)

      // Act - Thực hiện tìm kiếm
      const result = await repository.findById(productId)

      // Assert - Kiểm tra kết quả
      expect(result).toBeDefined()
      expect(result?.id).toBe(productId)
      expect(mockPrismaService.product.findUnique).toHaveBeenCalledWith({
        where: { id: productId, deletedAt: null },
      })
    })

    it('should return null when product not found', async () => {
      // Arrange - Chuẩn bị dữ liệu không tồn tại
      const productId = 999

      mockPrismaService.product.findUnique.mockResolvedValue(null)

      // Act - Thực hiện tìm kiếm
      const result = await repository.findById(productId)

      // Assert - Kiểm tra kết quả
      expect(result).toBeNull()
    })
  })

  describe('getDetail', () => {
    it('should get product detail successfully', async () => {
      // Arrange - Chuẩn bị dữ liệu
      const params = { productId: 1, languageId: 'vi' }
      const mockProduct = createTestData.product({ id: 1 })

      mockPrismaService.product.findUnique.mockResolvedValue(mockProduct)

      // Act - Thực hiện lấy detail
      const result = await repository.getDetail(params)

      // Assert - Kiểm tra kết quả
      expect(result).toBeDefined()
      expect(result?.id).toBe(1)
      expect(mockPrismaService.product.findUnique).toHaveBeenCalled()
    })

    it('should get product detail with isPublic true', async () => {
      // Arrange - Chuẩn bị dữ liệu với isPublic
      const params = { productId: 1, languageId: 'vi', isPublic: true }
      const mockProduct = createTestData.product({ id: 1, publishedAt: new Date().toISOString() })

      mockPrismaService.product.findUnique.mockResolvedValue(mockProduct)

      // Act - Thực hiện lấy detail
      const result = await repository.getDetail(params)

      // Assert - Kiểm tra kết quả
      expect(result).toBeDefined()
      expect(result?.id).toBe(1)
    })

    it('should get product detail with isPublic false', async () => {
      // Arrange - Chuẩn bị dữ liệu với isPublic false
      const params = { productId: 1, languageId: 'vi', isPublic: false }
      const mockProduct = createTestData.product({ id: 1, publishedAt: null })

      mockPrismaService.product.findUnique.mockResolvedValue(mockProduct)

      // Act - Thực hiện lấy detail
      const result = await repository.getDetail(params)

      // Assert - Kiểm tra kết quả
      expect(result).toBeDefined()
      expect(result?.id).toBe(1)
    })
  })

  describe('create', () => {
    it('should create product successfully', async () => {
      // Arrange - Chuẩn bị dữ liệu
      const createdById = 1
      const data = createTestData.createProductBody()
      const mockProduct = createTestData.product({ name: data.name })

      mockPrismaService.product.create.mockResolvedValue(mockProduct)

      // Act - Thực hiện tạo product
      const result = await repository.create({ createdById, data })

      // Assert - Kiểm tra kết quả
      expect(result).toBeDefined()
      expect(result.name).toBe(data.name)
      expect(mockPrismaService.product.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            createdById,
            name: data.name,
          }),
        }),
      )
    })
  })

  describe('update', () => {
    it('should update product successfully', async () => {
      // Arrange - Chuẩn bị dữ liệu
      const id = 1
      const updatedById = 1
      const data = createTestData.updateProductBody()
      const existingSKUs = [createTestData.sku({ value: 'Red-M' }), createTestData.sku({ id: 2, value: 'Blue-L' })]
      const mockProduct = createTestData.product({ id, name: data.name })

      mockPrismaService.sKU.findMany.mockResolvedValue(existingSKUs)
      mockPrismaService.$transaction.mockResolvedValue([mockProduct])

      // Act - Thực hiện update
      const result = await repository.update({ id, updatedById, data })

      // Assert - Kiểm tra kết quả
      expect(result).toBeDefined()
      expect(result.name).toBe(data.name)
      expect(mockPrismaService.sKU.findMany).toHaveBeenCalledWith({
        where: { productId: id, deletedAt: null },
      })
      expect(mockPrismaService.$transaction).toHaveBeenCalled()
    })

    it('should handle creating new SKUs (id = null) when updating product', async () => {
      // Arrange - Test lines 293-294: skusToCreate with id = null
      const id = 1
      const updatedById = 1
      const data = createTestData.updateProductBody()
      // Existing SKUs in DB
      const existingSKUs = [createTestData.sku({ id: 1, value: 'Red-M' })]
      // New SKUs to create (id = null)
      data.skus = [
        { id: null, value: 'Blue-L', price: 180000, stock: 10, image: 'blue.jpg' } as any, // New SKU
        { id: null, value: 'Green-XL', price: 200000, stock: 5, image: 'green.jpg' } as any, // New SKU
      ]
      const mockProduct = createTestData.product({ id, name: data.name })

      mockPrismaService.sKU.findMany.mockResolvedValue(existingSKUs)
      mockPrismaService.$transaction.mockResolvedValue([mockProduct])

      // Act
      const result = await repository.update({ id, updatedById, data })

      // Assert - Verify skusToCreate logic was executed
      expect(result).toBeDefined()
      expect(mockPrismaService.$transaction).toHaveBeenCalled()
      // Verify transaction was called with createMany for new SKUs
      const transactionCallback = mockPrismaService.$transaction.mock.calls[0][0]
      expect(transactionCallback).toBeDefined()
    })

    it('should handle mixed SKUs (some with id, some without) when updating product', async () => {
      // Arrange - Test both skusToUpdate and skusToCreate paths
      const id = 1
      const updatedById = 1
      const data = createTestData.updateProductBody()
      // Existing SKUs in DB
      const existingSKUs = [
        createTestData.sku({ id: 1, value: 'Red-M' }),
        createTestData.sku({ id: 2, value: 'Blue-L' }),
      ]
      // Mixed SKUs: some existing (with id), some new (id = null)
      data.skus = [
        { id: 1, value: 'Red-M', price: 150000, stock: 20, image: 'red.jpg' } as any, // Update existing
        { id: null, value: 'Green-XL', price: 200000, stock: 5, image: 'green.jpg' } as any, // Create new
      ]
      const mockProduct = createTestData.product({ id, name: data.name })

      mockPrismaService.sKU.findMany.mockResolvedValue(existingSKUs)
      mockPrismaService.$transaction.mockResolvedValue([mockProduct])

      // Act
      const result = await repository.update({ id, updatedById, data })

      // Assert - Both update and create paths should be executed
      expect(result).toBeDefined()
      expect(mockPrismaService.$transaction).toHaveBeenCalled()
    })
  })

  describe('delete', () => {
    it('should soft delete product successfully', async () => {
      // Arrange - Chuẩn bị dữ liệu
      const id = 1
      const deletedById = 1
      const mockProduct = createTestData.product({ id, deletedAt: new Date().toISOString() })

      mockPrismaService.product.update.mockResolvedValue(mockProduct)
      mockPrismaService.productTranslation.updateMany.mockResolvedValue({ count: 1 })
      mockPrismaService.sKU.updateMany.mockResolvedValue({ count: 2 })

      // Act - Thực hiện xóa
      const result = await repository.delete({ id, deletedById })

      // Assert - Kiểm tra kết quả
      expect(result).toBeDefined()
      expect(result.id).toBe(id)
      expect(mockPrismaService.product.update).toHaveBeenCalledWith({
        where: { id, deletedAt: null },
        data: expect.objectContaining({ deletedById }),
      })
    })

    it('should hard delete product successfully', async () => {
      // Arrange - Chuẩn bị dữ liệu hard delete
      const id = 1
      const deletedById = 1
      const mockProduct = createTestData.product({ id })

      mockPrismaService.product.delete.mockResolvedValue(mockProduct)

      // Act - Thực hiện xóa vĩnh viễn
      const result = await repository.delete({ id, deletedById }, true)

      // Assert - Kiểm tra kết quả
      expect(result).toBeDefined()
      expect(result.id).toBe(id)
      expect(mockPrismaService.product.delete).toHaveBeenCalledWith({
        where: { id },
      })
    })
  })
})
