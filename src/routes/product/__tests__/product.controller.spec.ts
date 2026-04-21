import { Test, TestingModule } from '@nestjs/testing'
import { ProductController } from '../product.controller'
import { ProductService } from '../product.service'
import { GetProductsQueryDTO, GetProductParamsDTO } from '../product.dto'
import { OrderBy, SortBy } from 'src/shared/constants/other.constant'

// Test data factory để tạo dữ liệu test
const createTestData = {
  getProductsQuery: (overrides = {}): GetProductsQueryDTO => ({
    page: 1,
    limit: 10,
    orderBy: OrderBy.Desc,
    sortBy: SortBy.CreatedAt,
    ...overrides,
  }),

  getProductParams: (overrides = {}): GetProductParamsDTO => ({
    productId: 1,
    ...overrides,
  }),

  productListResponse: (overrides = {}) => ({
    data: [
      {
        id: 1,
        publishedAt: new Date().toISOString(),
        name: 'Test Product',
        basePrice: 100000,
        virtualPrice: 120000,
        brandId: 1,
        images: ['test-image.jpg'],
        variants: [
          {
            value: 'Size',
            options: ['M', 'L', 'XL'],
          },
        ],
        createdById: null,
        updatedById: null,
        deletedById: null,
        deletedAt: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        productTranslations: [
          {
            id: 1,
            name: 'Test Product',
            description: 'Test Description',
            languageId: 'vi',
            productId: 1,
            createdById: null,
            updatedById: null,
            deletedById: null,
            deletedAt: null,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        ],
      },
    ],
    totalItems: 1,
    page: 1,
    limit: 10,
    totalPages: 1,
    ...overrides,
  }),

  productDetailResponse: (overrides = {}) => ({
    id: 1,
    publishedAt: new Date().toISOString(),
    name: 'Test Product',
    basePrice: 100000,
    virtualPrice: 120000,
    brandId: 1,
    images: ['test-image.jpg'],
    variants: [
      {
        value: 'Size',
        options: ['M', 'L', 'XL'],
      },
    ],
    createdById: 1,
    updatedById: null,
    deletedById: null,
    deletedAt: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    productTranslations: [
      {
        id: 1,
        name: 'Test Product',
        description: 'Test Description',
        languageId: 'vi',
        productId: 1,
        createdById: null,
        updatedById: null,
        deletedById: null,
        deletedAt: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ],
    skus: [
      {
        id: 1,
        value: 'Size: M',
        price: 100000,
        stock: 50,
        image: 'test-sku-image.jpg',
        productId: 1,
        createdById: 1,
        updatedById: null,
        deletedById: null,
        deletedAt: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ],
    categories: [
      {
        id: 1,
        name: 'Electronics',
        logo: 'electronics-logo.jpg',
        parentCategoryId: null,
        createdById: null,
        updatedById: null,
        deletedById: null,
        deletedAt: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        categoryTranslations: [
          {
            id: 1,
            categoryId: 1,
            languageId: 'vi',
            name: 'Điện tử',
            description: 'Sản phẩm điện tử',
            createdById: null,
            updatedById: null,
            deletedById: null,
            deletedAt: null,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        ],
      },
    ],
    brand: {
      id: 1,
      name: 'Apple',
      logo: 'apple-logo.jpg',
      createdById: null,
      updatedById: null,
      deletedById: null,
      deletedAt: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      brandTranslations: [
        {
          id: 1,
          brandId: 1,
          languageId: 'vi',
          name: 'Apple',
          description: 'Apple brand',
          createdById: null,
          updatedById: null,
          deletedById: null,
          deletedAt: null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ],
    },
    ...overrides,
  }),
}

describe('ProductController', () => {
  let controller: ProductController
  let module: TestingModule
  let mockProductService: jest.Mocked<ProductService>

  beforeEach(async () => {
    // Tạo mock cho ProductService với tất cả methods cần thiết
    mockProductService = {
      list: jest.fn(),
      getDetail: jest.fn(),
    } as any

    module = await Test.createTestingModule({
      controllers: [ProductController],
      providers: [{ provide: ProductService, useValue: mockProductService }],
    }).compile()

    controller = module.get<ProductController>(ProductController)
  })

  afterEach(() => {
    jest.clearAllMocks()
    jest.resetAllMocks()
  })

  afterAll(async () => {
    jest.restoreAllMocks()
    if (module) {
      await module.close()
    }
  })

  describe('list', () => {
    it('should return product list successfully with default parameters', async () => {
      // Arrange - Chuẩn bị dữ liệu test
      const query = createTestData.getProductsQuery()
      const mockProductListResponse = createTestData.productListResponse()

      mockProductService.list.mockResolvedValue(mockProductListResponse)

      // Act - Thực hiện gọi controller
      const result = await controller.list(query)

      // Assert - Kiểm tra kết quả
      expect(result).toEqual(mockProductListResponse)
      expect(mockProductService.list).toHaveBeenCalledWith({
        query,
      })
      expect(mockProductService.list).toHaveBeenCalledTimes(1)
    })

    it('should handle product list with brand filter', async () => {
      // Arrange - Chuẩn bị dữ liệu test với brand filter
      const query = createTestData.getProductsQuery({
        brandIds: [1, 2],
      })
      const mockProductListResponse = createTestData.productListResponse()

      mockProductService.list.mockResolvedValue(mockProductListResponse)

      // Act - Thực hiện gọi controller
      const result = await controller.list(query)

      // Assert - Kiểm tra kết quả
      expect(result).toEqual(mockProductListResponse)
      expect(mockProductService.list).toHaveBeenCalledWith({
        query,
      })
    })

    it('should handle product list with price range filter', async () => {
      // Arrange - Chuẩn bị dữ liệu test với price filter
      const query = createTestData.getProductsQuery({
        minPrice: 50000,
        maxPrice: 200000,
      })
      const mockProductListResponse = createTestData.productListResponse()

      mockProductService.list.mockResolvedValue(mockProductListResponse)

      // Act - Thực hiện gọi controller
      const result = await controller.list(query)

      // Assert - Kiểm tra kết quả
      expect(result).toEqual(mockProductListResponse)
      expect(mockProductService.list).toHaveBeenCalledWith({
        query,
      })
    })

    it('should handle product list with category filter', async () => {
      // Arrange - Chuẩn bị dữ liệu test với category filter
      const query = createTestData.getProductsQuery({
        categories: [1, 2, 3],
      })
      const mockProductListResponse = createTestData.productListResponse()

      mockProductService.list.mockResolvedValue(mockProductListResponse)

      // Act - Thực hiện gọi controller
      const result = await controller.list(query)

      // Assert - Kiểm tra kết quả
      expect(result).toEqual(mockProductListResponse)
      expect(mockProductService.list).toHaveBeenCalledWith({
        query,
      })
    })

    it('should handle product list with name search', async () => {
      // Arrange - Chuẩn bị dữ liệu test với name search
      const query = createTestData.getProductsQuery({
        name: 'iPhone',
      })
      const mockProductListResponse = createTestData.productListResponse()

      mockProductService.list.mockResolvedValue(mockProductListResponse)

      // Act - Thực hiện gọi controller
      const result = await controller.list(query)

      // Assert - Kiểm tra kết quả
      expect(result).toEqual(mockProductListResponse)
      expect(mockProductService.list).toHaveBeenCalledWith({
        query,
      })
    })

    it('should handle different sorting options', async () => {
      // Arrange - Chuẩn bị dữ liệu test với sorting khác
      const query = createTestData.getProductsQuery({
        orderBy: OrderBy.Asc,
        sortBy: SortBy.Price,
      })
      const mockProductListResponse = createTestData.productListResponse()

      mockProductService.list.mockResolvedValue(mockProductListResponse)

      // Act - Thực hiện gọi controller
      const result = await controller.list(query)

      // Assert - Kiểm tra kết quả
      expect(result).toEqual(mockProductListResponse)
      expect(mockProductService.list).toHaveBeenCalledWith({
        query,
      })
    })

    it('should handle empty product list', async () => {
      // Arrange - Chuẩn bị dữ liệu product list trống
      const query = createTestData.getProductsQuery()
      const emptyProductListResponse = createTestData.productListResponse({
        data: [],
        totalItems: 0,
        totalPages: 0,
      })

      mockProductService.list.mockResolvedValue(emptyProductListResponse)

      // Act - Thực hiện gọi controller
      const result = await controller.list(query)

      // Assert - Kiểm tra kết quả
      expect(result).toEqual(emptyProductListResponse)
      expect(result.data).toHaveLength(0)
      expect(result.totalItems).toBe(0)
    })

    it('should handle pagination correctly', async () => {
      // Arrange - Chuẩn bị dữ liệu test với pagination khác
      const query = createTestData.getProductsQuery({
        page: 2,
        limit: 5,
      })
      const mockProductListResponse = createTestData.productListResponse({
        page: 2,
        limit: 5,
        totalPages: 3,
      })

      mockProductService.list.mockResolvedValue(mockProductListResponse)

      // Act - Thực hiện gọi controller
      const result = await controller.list(query)

      // Assert - Kiểm tra kết quả
      expect(result).toEqual(mockProductListResponse)
      expect(result.page).toBe(2)
      expect(result.limit).toBe(5)
    })

    it('should handle multiple filters combined', async () => {
      // Arrange - Chuẩn bị dữ liệu test với nhiều filters
      const query = createTestData.getProductsQuery({
        name: 'iPhone',
        brandIds: [1],
        minPrice: 10000,
        maxPrice: 50000,
        categories: [1, 2],
        page: 1,
        limit: 20,
      })
      const mockProductListResponse = createTestData.productListResponse()

      mockProductService.list.mockResolvedValue(mockProductListResponse)

      // Act - Thực hiện gọi controller
      const result = await controller.list(query)

      // Assert - Kiểm tra kết quả
      expect(result).toEqual(mockProductListResponse)
      expect(mockProductService.list).toHaveBeenCalledWith({
        query,
      })
    })
  })

  describe('findById', () => {
    it('should return product detail successfully', async () => {
      // Arrange - Chuẩn bị dữ liệu test
      const params = createTestData.getProductParams({
        productId: 1,
      })
      const mockProductDetailResponse = createTestData.productDetailResponse()

      mockProductService.getDetail.mockResolvedValue(mockProductDetailResponse)

      // Act - Thực hiện gọi controller
      const result = await controller.findById(params)

      // Assert - Kiểm tra kết quả
      expect(result).toEqual(mockProductDetailResponse)
      expect(mockProductService.getDetail).toHaveBeenCalledWith({
        productId: params.productId,
      })
      expect(mockProductService.getDetail).toHaveBeenCalledTimes(1)
    })

    it('should handle different product IDs', async () => {
      // Arrange - Chuẩn bị dữ liệu test với product ID khác
      const params = createTestData.getProductParams({
        productId: 5,
      })
      const mockProductDetailResponse = createTestData.productDetailResponse({
        id: 5,
        name: 'Another Product',
      })

      mockProductService.getDetail.mockResolvedValue(mockProductDetailResponse)

      // Act - Thực hiện gọi controller
      const result = await controller.findById(params)

      // Assert - Kiểm tra kết quả
      expect(result).toEqual(mockProductDetailResponse)
      expect(result.id).toBe(5)
      expect(result.name).toBe('Another Product')
      expect(mockProductService.getDetail).toHaveBeenCalledWith({
        productId: 5,
      })
    })

    it('should handle product with multiple SKUs', async () => {
      // Arrange - Chuẩn bị dữ liệu test với nhiều SKUs
      const params = createTestData.getProductParams({
        productId: 1,
      })
      const mockProductDetailResponse = createTestData.productDetailResponse({
        skus: [
          {
            id: 1,
            value: 'Size: M',
            price: 100000,
            stock: 50,
            image: 'test-sku-1.jpg',
            productId: 1,
            createdById: 1,
            updatedById: null,
            deletedById: null,
            deletedAt: null,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
          {
            id: 2,
            value: 'Size: L',
            price: 110000,
            stock: 30,
            image: 'test-sku-2.jpg',
            productId: 1,
            createdById: 1,
            updatedById: null,
            deletedById: null,
            deletedAt: null,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        ],
      })

      mockProductService.getDetail.mockResolvedValue(mockProductDetailResponse)

      // Act - Thực hiện gọi controller
      const result = await controller.findById(params)

      // Assert - Kiểm tra kết quả
      expect(result).toEqual(mockProductDetailResponse)
      expect(result.skus).toHaveLength(2)
      expect(result.skus[0].value).toBe('Size: M')
      expect(result.skus[1].value).toBe('Size: L')
    })

    it('should handle product with multiple categories', async () => {
      // Arrange - Chuẩn bị dữ liệu test với nhiều categories
      const params = createTestData.getProductParams({
        productId: 1,
      })
      const mockProductDetailResponse = createTestData.productDetailResponse({
        categories: [
          {
            id: 1,
            name: 'Electronics',
            logo: 'electronics-logo.jpg',
            parentId: null,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            categoryTranslations: [
              {
                id: 1,
                name: 'Điện tử',
                description: 'Sản phẩm điện tử',
                languageId: 'vi',
              },
            ],
          },
          {
            id: 2,
            name: 'Mobile',
            logo: 'mobile-logo.jpg',
            parentId: 1,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            categoryTranslations: [
              {
                id: 2,
                name: 'Điện thoại',
                description: 'Điện thoại di động',
                languageId: 'vi',
              },
            ],
          },
        ],
      })

      mockProductService.getDetail.mockResolvedValue(mockProductDetailResponse)

      // Act - Thực hiện gọi controller
      const result = await controller.findById(params)

      // Assert - Kiểm tra kết quả
      expect(result).toEqual(mockProductDetailResponse)
      expect(result.categories).toHaveLength(2)
      expect(result.categories[0].name).toBe('Electronics')
      expect(result.categories[1].name).toBe('Mobile')
    })
  })

  describe('error handling', () => {
    it('should handle service errors in list', async () => {
      // Arrange - Chuẩn bị lỗi từ service
      const query = createTestData.getProductsQuery()
      const serviceError = new Error('Service error occurred')

      mockProductService.list.mockRejectedValue(serviceError)

      // Act & Assert - Thực hiện test và kiểm tra lỗi
      await expect(controller.list(query)).rejects.toThrow('Service error occurred')
      expect(mockProductService.list).toHaveBeenCalledWith({
        query,
      })
    })

    it('should handle service errors in findById', async () => {
      // Arrange - Chuẩn bị lỗi từ service
      const params = createTestData.getProductParams({
        productId: 1,
      })
      const serviceError = new Error('Product not found')

      mockProductService.getDetail.mockRejectedValue(serviceError)

      // Act & Assert - Thực hiện test và kiểm tra lỗi
      await expect(controller.findById(params)).rejects.toThrow('Product not found')
      expect(mockProductService.getDetail).toHaveBeenCalledWith({
        productId: params.productId,
      })
    })

    it('should pass through service responses without modification in list', async () => {
      // Arrange - Chuẩn bị test để đảm bảo controller không modify data
      const query = createTestData.getProductsQuery()
      const originalResponse = createTestData.productListResponse()

      mockProductService.list.mockResolvedValue(originalResponse)

      // Act - Thực hiện gọi controller
      const result = await controller.list(query)

      // Assert - Kiểm tra kết quả không bị thay đổi
      expect(result).toBe(originalResponse) // Same reference
      expect(result).toEqual(originalResponse) // Same content
    })

    it('should pass through service responses without modification in findById', async () => {
      // Arrange - Chuẩn bị test để đảm bảo controller không modify data
      const params = createTestData.getProductParams({
        productId: 1,
      })
      const originalResponse = createTestData.productDetailResponse()

      mockProductService.getDetail.mockResolvedValue(originalResponse)

      // Act - Thực hiện gọi controller
      const result = await controller.findById(params)

      // Assert - Kiểm tra kết quả không bị thay đổi
      expect(result).toBe(originalResponse) // Same reference
      expect(result).toEqual(originalResponse) // Same content
    })
  })

  describe('validation edge cases', () => {
    it('should handle edge case product IDs', async () => {
      // Arrange - Chuẩn bị test với edge case IDs
      const edgeCaseIds = [1, 999999, Number.MAX_SAFE_INTEGER]

      for (const productId of edgeCaseIds) {
        const params = createTestData.getProductParams({ productId })
        const mockResponse = createTestData.productDetailResponse({ id: productId })
        mockProductService.getDetail.mockResolvedValue(mockResponse)

        // Act - Thực hiện gọi controller
        const result = await controller.findById(params)

        // Assert - Kiểm tra kết quả
        expect(result.id).toBe(productId)
        expect(mockProductService.getDetail).toHaveBeenCalledWith({
          productId,
        })

        // Reset mock for next iteration
        mockProductService.getDetail.mockReset()
      }
    })

    it('should handle edge case pagination values', async () => {
      // Arrange - Chuẩn bị test với edge case pagination
      const edgeCases = [
        { page: 1, limit: 1 },
        { page: 1, limit: 100 },
        { page: 999, limit: 50 },
      ]

      for (const paginationCase of edgeCases) {
        const query = createTestData.getProductsQuery(paginationCase)
        const mockResponse = createTestData.productListResponse(paginationCase)
        mockProductService.list.mockResolvedValue(mockResponse)

        // Act - Thực hiện gọi controller
        const result = await controller.list(query)

        // Assert - Kiểm tra kết quả
        expect(result.page).toBe(paginationCase.page)
        expect(result.limit).toBe(paginationCase.limit)
        expect(mockProductService.list).toHaveBeenCalledWith({
          query,
        })

        // Reset mock for next iteration
        mockProductService.list.mockReset()
      }
    })
  })

  // ===== RESPONSE STRUCTURE SNAPSHOTS =====

  describe('Response Structure Snapshots', () => {
    const fixedDate = '2024-01-01T00:00:00.000Z'

    it('should match product list response structure', async () => {
      const mockResponse = createTestData.productListResponse({
        data: [
          {
            id: 1,
            publishedAt: fixedDate,
            name: 'Test Product',
            basePrice: 100000,
            virtualPrice: 120000,
            brandId: 1,
            images: ['test-image.jpg'],
            variants: [{ value: 'Size', options: ['M', 'L', 'XL'] }],
            createdById: null,
            updatedById: null,
            deletedById: null,
            deletedAt: null,
            createdAt: fixedDate,
            updatedAt: fixedDate,
            productTranslations: [
              {
                id: 1,
                name: 'Test Product',
                description: 'Test Description',
                languageId: 'vi',
                productId: 1,
                createdById: null,
                updatedById: null,
                deletedById: null,
                deletedAt: null,
                createdAt: fixedDate,
                updatedAt: fixedDate,
              },
            ],
          },
        ],
      })
      mockProductService.list.mockResolvedValue(mockResponse)
      const result = await controller.list(createTestData.getProductsQuery())
      expect(result).toMatchSnapshot()
    })

    it('should match product detail response structure', async () => {
      const mockResponse = createTestData.productDetailResponse({
        publishedAt: fixedDate,
        createdAt: fixedDate,
        updatedAt: fixedDate,
        productTranslations: [
          {
            id: 1,
            name: 'Test Product',
            description: 'Test Description',
            languageId: 'vi',
            productId: 1,
            createdById: null,
            updatedById: null,
            deletedById: null,
            deletedAt: null,
            createdAt: fixedDate,
            updatedAt: fixedDate,
          },
        ],
        skus: [
          {
            id: 1,
            value: 'Size: M',
            price: 100000,
            stock: 50,
            image: 'test-sku-image.jpg',
            productId: 1,
            createdById: 1,
            updatedById: null,
            deletedById: null,
            deletedAt: null,
            createdAt: fixedDate,
            updatedAt: fixedDate,
          },
        ],
        categories: [
          {
            id: 1,
            name: 'Electronics',
            logo: 'electronics-logo.jpg',
            parentCategoryId: null,
            createdById: null,
            updatedById: null,
            deletedById: null,
            deletedAt: null,
            createdAt: fixedDate,
            updatedAt: fixedDate,
            categoryTranslations: [
              {
                id: 1,
                categoryId: 1,
                languageId: 'vi',
                name: 'Điện tử',
                description: 'Sản phẩm điện tử',
                createdById: null,
                updatedById: null,
                deletedById: null,
                deletedAt: null,
                createdAt: fixedDate,
                updatedAt: fixedDate,
              },
            ],
          },
        ],
        brand: {
          id: 1,
          name: 'Apple',
          logo: 'apple-logo.jpg',
          createdById: null,
          updatedById: null,
          deletedById: null,
          deletedAt: null,
          createdAt: fixedDate,
          updatedAt: fixedDate,
          brandTranslations: [
            {
              id: 1,
              brandId: 1,
              languageId: 'vi',
              name: 'Apple',
              description: 'Apple brand',
              createdById: null,
              updatedById: null,
              deletedById: null,
              deletedAt: null,
              createdAt: fixedDate,
              updatedAt: fixedDate,
            },
          ],
        },
      })
      mockProductService.getDetail.mockResolvedValue(mockResponse)
      const result = await controller.findById(createTestData.getProductParams())
      expect(result).toMatchSnapshot()
    })
  })
})
