import { Test, TestingModule } from '@nestjs/testing'
import { CACHE_MANAGER } from '@nestjs/cache-manager'
import { ProductService } from '../product.service'
import { ProductRepo } from '../product.repo'
import { NotFoundRecordException } from 'src/shared/error'
import { GetProductsQueryType } from '../product.model'
import { I18nContext } from 'nestjs-i18n'
import { OrderBy, SortBy } from 'src/shared/constants/other.constant'

// Mock I18nContext để test không phụ thuộc vào i18n
jest.mock('nestjs-i18n', () => ({
  I18nContext: {
    current: jest.fn(),
  },
}))

// Test data factory để tạo dữ liệu test
const createTestData = {
  getProductsQuery: (overrides = {}): GetProductsQueryType => ({
    page: 1,
    limit: 10,
    orderBy: OrderBy.Desc,
    sortBy: SortBy.CreatedAt,
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

  productDetail: (overrides = {}) => ({
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

describe('ProductService', () => {
  let service: ProductService
  let module: TestingModule
  let mockProductRepo: jest.Mocked<ProductRepo>

  beforeEach(async () => {
    // Setup mock I18nContext để trả về 'vi' mặc định
    ;(I18nContext.current as jest.Mock).mockReturnValue({ lang: 'vi' })

    // Tạo mock cho ProductRepo với tất cả methods cần thiết
    mockProductRepo = {
      list: jest.fn(),
      getDetail: jest.fn(),
    } as any

    module = await Test.createTestingModule({
      providers: [
        ProductService,
        { provide: ProductRepo, useValue: mockProductRepo },
        { provide: CACHE_MANAGER, useValue: { get: jest.fn(), set: jest.fn(), del: jest.fn() } },
      ],
    }).compile()

    service = module.get<ProductService>(ProductService)
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
    it('should get product list successfully with default parameters', async () => {
      // Arrange - Chuẩn bị dữ liệu test
      const query = createTestData.getProductsQuery()
      const mockProductListResponse = createTestData.productListResponse()

      mockProductRepo.list.mockResolvedValue(mockProductListResponse)

      // Act - Thực hiện lấy danh sách products
      const result = await service.list({ query })

      // Assert - Kiểm tra kết quả
      expect(result).toEqual(mockProductListResponse)
      expect(mockProductRepo.list).toHaveBeenCalledWith({
        page: query.page,
        limit: query.limit,
        languageId: 'vi',
        isPublic: true,
        brandIds: query.brandIds,
        minPrice: query.minPrice,
        maxPrice: query.maxPrice,
        categories: query.categories,
        name: query.name,
        createdById: query.createdById,
        orderBy: query.orderBy,
        sortBy: query.sortBy,
      })
      expect(mockProductRepo.list).toHaveBeenCalledTimes(1)
    })

    it('should handle product list with brand filter', async () => {
      // Arrange - Chuẩn bị dữ liệu test với brand filter
      const query = createTestData.getProductsQuery({
        brandIds: [1, 2],
      })
      const mockProductListResponse = createTestData.productListResponse()

      mockProductRepo.list.mockResolvedValue(mockProductListResponse)

      // Act - Thực hiện lấy danh sách products
      const result = await service.list({ query })

      // Assert - Kiểm tra kết quả
      expect(result).toEqual(mockProductListResponse)
      expect(mockProductRepo.list).toHaveBeenCalledWith({
        page: query.page,
        limit: query.limit,
        languageId: 'vi',
        isPublic: true,
        brandIds: [1, 2],
        minPrice: query.minPrice,
        maxPrice: query.maxPrice,
        categories: query.categories,
        name: query.name,
        createdById: query.createdById,
        orderBy: query.orderBy,
        sortBy: query.sortBy,
      })
    })

    it('should handle product list with price range filter', async () => {
      // Arrange - Chuẩn bị dữ liệu test với price filter
      const query = createTestData.getProductsQuery({
        minPrice: 50000,
        maxPrice: 200000,
      })
      const mockProductListResponse = createTestData.productListResponse()

      mockProductRepo.list.mockResolvedValue(mockProductListResponse)

      // Act - Thực hiện lấy danh sách products
      const result = await service.list({ query })

      // Assert - Kiểm tra kết quả
      expect(result).toEqual(mockProductListResponse)
      expect(mockProductRepo.list).toHaveBeenCalledWith({
        page: query.page,
        limit: query.limit,
        languageId: 'vi',
        isPublic: true,
        brandIds: query.brandIds,
        minPrice: 50000,
        maxPrice: 200000,
        categories: query.categories,
        name: query.name,
        createdById: query.createdById,
        orderBy: query.orderBy,
        sortBy: query.sortBy,
      })
    })

    it('should handle product list with category filter', async () => {
      // Arrange - Chuẩn bị dữ liệu test với category filter
      const query = createTestData.getProductsQuery({
        categories: [1, 2, 3],
      })
      const mockProductListResponse = createTestData.productListResponse()

      mockProductRepo.list.mockResolvedValue(mockProductListResponse)

      // Act - Thực hiện lấy danh sách products
      const result = await service.list({ query })

      // Assert - Kiểm tra kết quả
      expect(result).toEqual(mockProductListResponse)
      expect(mockProductRepo.list).toHaveBeenCalledWith({
        page: query.page,
        limit: query.limit,
        languageId: 'vi',
        isPublic: true,
        brandIds: query.brandIds,
        minPrice: query.minPrice,
        maxPrice: query.maxPrice,
        categories: [1, 2, 3],
        name: query.name,
        createdById: query.createdById,
        orderBy: query.orderBy,
        sortBy: query.sortBy,
      })
    })

    it('should handle product list with name search', async () => {
      // Arrange - Chuẩn bị dữ liệu test với name search
      const query = createTestData.getProductsQuery({
        name: 'iPhone',
      })
      const mockProductListResponse = createTestData.productListResponse()

      mockProductRepo.list.mockResolvedValue(mockProductListResponse)

      // Act - Thực hiện lấy danh sách products
      const result = await service.list({ query })

      // Assert - Kiểm tra kết quả
      expect(result).toEqual(mockProductListResponse)
      expect(mockProductRepo.list).toHaveBeenCalledWith({
        page: query.page,
        limit: query.limit,
        languageId: 'vi',
        isPublic: true,
        brandIds: query.brandIds,
        minPrice: query.minPrice,
        maxPrice: query.maxPrice,
        categories: query.categories,
        name: 'iPhone',
        createdById: query.createdById,
        orderBy: query.orderBy,
        sortBy: query.sortBy,
      })
    })

    it('should handle different language context', async () => {
      // Arrange - Chuẩn bị dữ liệu test với ngôn ngữ khác
      const query = createTestData.getProductsQuery()
      const mockProductListResponse = createTestData.productListResponse()

      // Mock I18nContext để trả về ngôn ngữ khác
      ;(I18nContext.current as jest.Mock).mockReturnValue({ lang: 'en' })
      mockProductRepo.list.mockResolvedValue(mockProductListResponse)

      // Act - Thực hiện lấy danh sách products
      const result = await service.list({ query })

      // Assert - Kiểm tra kết quả
      expect(result).toEqual(mockProductListResponse)
      expect(mockProductRepo.list).toHaveBeenCalledWith({
        page: query.page,
        limit: query.limit,
        languageId: 'en',
        isPublic: true,
        brandIds: query.brandIds,
        minPrice: query.minPrice,
        maxPrice: query.maxPrice,
        categories: query.categories,
        name: query.name,
        createdById: query.createdById,
        orderBy: query.orderBy,
        sortBy: query.sortBy,
      })
    })

    it('should handle different sorting options', async () => {
      // Arrange - Chuẩn bị dữ liệu test với sorting khác
      const query = createTestData.getProductsQuery({
        orderBy: OrderBy.Asc,
        sortBy: SortBy.Price,
      })
      const mockProductListResponse = createTestData.productListResponse()

      mockProductRepo.list.mockResolvedValue(mockProductListResponse)

      // Act - Thực hiện lấy danh sách products
      const result = await service.list({ query })

      // Assert - Kiểm tra kết quả
      expect(result).toEqual(mockProductListResponse)
      expect(mockProductRepo.list).toHaveBeenCalledWith({
        page: query.page,
        limit: query.limit,
        languageId: 'vi',
        isPublic: true,
        brandIds: query.brandIds,
        minPrice: query.minPrice,
        maxPrice: query.maxPrice,
        categories: query.categories,
        name: query.name,
        createdById: query.createdById,
        orderBy: OrderBy.Asc,
        sortBy: SortBy.Price,
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

      mockProductRepo.list.mockResolvedValue(emptyProductListResponse)

      // Act - Thực hiện lấy danh sách products
      const result = await service.list({ query })

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

      mockProductRepo.list.mockResolvedValue(mockProductListResponse)

      // Act - Thực hiện lấy danh sách products
      const result = await service.list({ query })

      // Assert - Kiểm tra kết quả
      expect(result).toEqual(mockProductListResponse)
      expect(result.page).toBe(2)
      expect(result.limit).toBe(5)
      expect(mockProductRepo.list).toHaveBeenCalledWith({
        page: 2,
        limit: 5,
        languageId: 'vi',
        isPublic: true,
        brandIds: query.brandIds,
        minPrice: query.minPrice,
        maxPrice: query.maxPrice,
        categories: query.categories,
        name: query.name,
        createdById: query.createdById,
        orderBy: query.orderBy,
        sortBy: query.sortBy,
      })
    })
  })

  describe('getDetail', () => {
    it('should get product detail successfully', async () => {
      // Arrange - Chuẩn bị dữ liệu test
      const productId = 1
      const mockProductDetail = createTestData.productDetail()

      mockProductRepo.getDetail.mockResolvedValue(mockProductDetail)

      // Act - Thực hiện lấy chi tiết product
      const result = await service.getDetail({ productId })

      // Assert - Kiểm tra kết quả
      expect(result).toEqual(mockProductDetail)
      expect(mockProductRepo.getDetail).toHaveBeenCalledWith({
        productId: productId,
        languageId: 'vi',
        isPublic: true,
      })
      expect(mockProductRepo.getDetail).toHaveBeenCalledTimes(1)
    })

    it('should handle different language context in getDetail', async () => {
      // Arrange - Chuẩn bị dữ liệu test với ngôn ngữ khác
      const productId = 1
      const mockProductDetail = createTestData.productDetail()

      // Mock I18nContext để trả về ngôn ngữ khác
      ;(I18nContext.current as jest.Mock).mockReturnValue({ lang: 'en' })
      mockProductRepo.getDetail.mockResolvedValue(mockProductDetail)

      // Act - Thực hiện lấy chi tiết product
      const result = await service.getDetail({ productId })

      // Assert - Kiểm tra kết quả
      expect(result).toEqual(mockProductDetail)
      expect(mockProductRepo.getDetail).toHaveBeenCalledWith({
        productId: productId,
        languageId: 'en',
        isPublic: true,
      })
    })

    it('should throw NotFoundRecordException when product not found', async () => {
      // Arrange - Chuẩn bị dữ liệu test với product không tồn tại
      const productId = 999
      mockProductRepo.getDetail.mockResolvedValue(null)

      // Act & Assert - Thực hiện test và kiểm tra lỗi
      await expect(service.getDetail({ productId })).rejects.toThrow(NotFoundRecordException)
      expect(mockProductRepo.getDetail).toHaveBeenCalledWith({
        productId: productId,
        languageId: 'vi',
        isPublic: true,
      })
    })

    it('should handle different product IDs', async () => {
      // Arrange - Chuẩn bị dữ liệu test với product ID khác
      const productId = 5
      const mockProductDetail = createTestData.productDetail({
        id: 5,
        name: 'Another Product',
      })

      mockProductRepo.getDetail.mockResolvedValue(mockProductDetail)

      // Act - Thực hiện lấy chi tiết product
      const result = await service.getDetail({ productId })

      // Assert - Kiểm tra kết quả
      expect(result).toEqual(mockProductDetail)
      expect(result.id).toBe(5)
      expect(result.name).toBe('Another Product')
      expect(mockProductRepo.getDetail).toHaveBeenCalledWith({
        productId: 5,
        languageId: 'vi',
        isPublic: true,
      })
    })
  })

  describe('edge cases and error handling', () => {
    it('should handle null I18nContext gracefully in list', async () => {
      // Arrange - Chuẩn bị I18nContext null
      ;(I18nContext.current as jest.Mock).mockReturnValue(null)
      const query = createTestData.getProductsQuery()
      const mockProductListResponse = createTestData.productListResponse()

      mockProductRepo.list.mockResolvedValue(mockProductListResponse)

      // Act - Thực hiện lấy danh sách products
      const result = await service.list({ query })

      // Assert - Kiểm tra kết quả
      expect(result).toEqual(mockProductListResponse)
      expect(mockProductRepo.list).toHaveBeenCalledWith({
        page: query.page,
        limit: query.limit,
        languageId: undefined,
        isPublic: true,
        brandIds: query.brandIds,
        minPrice: query.minPrice,
        maxPrice: query.maxPrice,
        categories: query.categories,
        name: query.name,
        createdById: query.createdById,
        orderBy: query.orderBy,
        sortBy: query.sortBy,
      })
    })

    it('should handle null I18nContext gracefully in getDetail', async () => {
      // Arrange - Chuẩn bị I18nContext null
      ;(I18nContext.current as jest.Mock).mockReturnValue(null)
      const productId = 1
      const mockProductDetail = createTestData.productDetail()

      mockProductRepo.getDetail.mockResolvedValue(mockProductDetail)

      // Act - Thực hiện lấy chi tiết product
      const result = await service.getDetail({ productId })

      // Assert - Kiểm tra kết quả
      expect(result).toEqual(mockProductDetail)
      expect(mockProductRepo.getDetail).toHaveBeenCalledWith({
        productId: productId,
        languageId: undefined,
        isPublic: true,
      })
    })

    it('should handle repository errors in list', async () => {
      // Arrange - Chuẩn bị lỗi từ repository
      const query = createTestData.getProductsQuery()
      const repositoryError = new Error('Database connection failed')

      mockProductRepo.list.mockRejectedValue(repositoryError)

      // Act & Assert - Thực hiện test và kiểm tra lỗi
      await expect(service.list({ query })).rejects.toThrow('Database connection failed')
      expect(mockProductRepo.list).toHaveBeenCalledWith({
        page: query.page,
        limit: query.limit,
        languageId: 'vi', // Default lang từ mock
        isPublic: true,
        brandIds: query.brandIds,
        minPrice: query.minPrice,
        maxPrice: query.maxPrice,
        categories: query.categories,
        name: query.name,
        createdById: query.createdById,
        orderBy: query.orderBy,
        sortBy: query.sortBy,
      })
    })

    it('should handle repository errors in getDetail', async () => {
      // Arrange - Chuẩn bị lỗi từ repository
      const productId = 1
      const repositoryError = new Error('Database connection failed')

      mockProductRepo.getDetail.mockRejectedValue(repositoryError)

      // Act & Assert - Thực hiện test và kiểm tra lỗi
      await expect(service.getDetail({ productId })).rejects.toThrow('Database connection failed')
      expect(mockProductRepo.getDetail).toHaveBeenCalledWith({
        productId: productId,
        languageId: 'vi',
        isPublic: true,
      })
    })

    it('should pass through repository responses without modification in list', async () => {
      // Arrange - Chuẩn bị test để đảm bảo service không modify data
      const query = createTestData.getProductsQuery()
      const originalResponse = createTestData.productListResponse()

      mockProductRepo.list.mockResolvedValue(originalResponse)

      // Act - Thực hiện lấy danh sách products
      const result = await service.list({ query })

      // Assert - Kiểm tra kết quả không bị thay đổi
      expect(result).toBe(originalResponse) // Same reference
      expect(result).toEqual(originalResponse) // Same content
    })

    it('should pass through repository responses without modification in getDetail', async () => {
      // Arrange - Chuẩn bị test để đảm bảo service không modify data
      const productId = 1
      const originalResponse = createTestData.productDetail()

      mockProductRepo.getDetail.mockResolvedValue(originalResponse)

      // Act - Thực hiện lấy chi tiết product
      const result = await service.getDetail({ productId })

      // Assert - Kiểm tra kết quả không bị thay đổi
      expect(result).toBe(originalResponse) // Same reference
      expect(result).toEqual(originalResponse) // Same content
    })
  })
})
