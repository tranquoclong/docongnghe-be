import { Test, TestingModule } from '@nestjs/testing'
import { RoleName } from 'src/shared/constants/role.constant'
import { AccessTokenPayload } from 'src/shared/types/jwt.type'
import { ManageProductController } from '../manage-product.controller'
import { ManageProductService } from '../manage-product.service'
import {
  CreateProductBodyDTO,
  GetManageProductsQueryDTO,
  GetProductParamsDTO,
  UpdateProductBodyDTO,
} from '../product.dto'

/**
 * MANAGE PRODUCT CONTROLLER UNIT TESTS
 *
 * Test Coverage:
 * - Controller initialization
 * - GET /manage-product/products - list() - Protected, with privilege validation
 * - GET /manage-product/products/:productId - findById() - Protected, with privilege validation
 * - POST /manage-product/products - create() - Protected, create product with translations
 * - PUT /manage-product/products/:productId - update() - Protected, with privilege validation
 * - DELETE /manage-product/products/:productId - delete() - Protected, with privilege validation
 */

describe('ManageProductController', () => {
  let controller: ManageProductController
  let mockManageProductService: jest.Mocked<ManageProductService>

  // ===== TEST DATA FACTORIES =====
  const FIXED_DATE = '2024-01-01T00:00:00.000Z'

  const createMockUser = (overrides = {}): AccessTokenPayload => ({
    userId: 1,
    roleId: 2,
    deviceId: 1,
    roleName: RoleName.Seller,
    exp: Math.floor(Date.now() / 1000) + 3600,
    iat: Math.floor(Date.now() / 1000),
    ...overrides,
  })

  const createMockAdminUser = (): AccessTokenPayload => ({
    userId: 2,
    roleId: 1,
    deviceId: 1,
    roleName: RoleName.Admin,
    exp: Math.floor(Date.now() / 1000) + 3600,
    iat: Math.floor(Date.now() / 1000),
  })

  const createMockProduct = (overrides = {}) => ({
    id: 1,
    publishedAt: new Date(FIXED_DATE),
    name: 'Test Product',
    basePrice: 100000,
    virtualPrice: 150000,
    brandId: 1,
    images: ['https://example.com/image1.jpg'],
    variants: [{ value: 'Color', options: ['Red', 'Blue'] }],
    createdById: 1,
    updatedById: null,
    deletedById: null,
    deletedAt: null,
    createdAt: new Date(FIXED_DATE).toISOString(),
    updatedAt: new Date(FIXED_DATE).toISOString(),
    ...overrides,
  })

  const createMockProductDetail = (overrides = {}) => ({
    ...createMockProduct(overrides),
    productTranslations: [
      {
        id: 1,
        productId: 1,
        languageId: 'en',
        name: 'Test Product',
        description: 'Test Description',
        createdById: 1,
        updatedById: null,
        deletedById: null,
        deletedAt: null,
        createdAt: new Date(FIXED_DATE).toISOString(),
        updatedAt: new Date(FIXED_DATE).toISOString(),
      },
    ],
    skus: [
      {
        id: 1,
        productId: 1,
        value: 'Red',
        price: 100000,
        stock: 100,
        image: 'https://example.com/red.jpg',
        createdById: 1,
        updatedById: null,
        deletedById: null,
        deletedAt: null,
        createdAt: new Date(FIXED_DATE).toISOString(),
        updatedAt: new Date(FIXED_DATE).toISOString(),
      },
    ],
    categories: [
      {
        id: 1,
        name: 'Electronics',
        parentCategoryId: null,
        categoryTranslations: [],
        createdById: 1,
        updatedById: null,
        deletedById: null,
        deletedAt: null,
        createdAt: new Date(FIXED_DATE).toISOString(),
        updatedAt: new Date(FIXED_DATE).toISOString(),
      },
    ],
    brand: {
      id: 1,
      name: 'Test Brand',
      brandTranslations: [],
      createdById: 1,
      updatedById: null,
      deletedById: null,
      deletedAt: null,
      createdAt: new Date(FIXED_DATE).toISOString(),
      updatedAt: new Date(FIXED_DATE).toISOString(),
    },
  })

  const createMockProductList = () => ({
    data: [
      {
        ...createMockProduct(),
        productTranslations: [],
      },
    ],
    totalItems: 1,
    page: 1,
    limit: 10,
    totalPages: 1,
  })

  beforeEach(async () => {
    // Mock ManageProductService
    mockManageProductService = {
      list: jest.fn(),
      getDetail: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      validatePrivilege: jest.fn(),
    } as any

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ManageProductController],
      providers: [{ provide: ManageProductService, useValue: mockManageProductService }],
    }).compile()

    controller = module.get<ManageProductController>(ManageProductController)
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  // ===== CONTROLLER INITIALIZATION =====

  describe('Controller Initialization', () => {
    it('should be defined', () => {
      expect(controller).toBeDefined()
    })

    it('should have manageProductService injected', () => {
      expect(controller['manageProductService']).toBeDefined()
      expect(controller['manageProductService']).toBe(mockManageProductService)
    })
  })

  // ===== GET /manage-product/products (list) TESTS =====

  describe('GET /manage-product/products - list()', () => {
    it('should return product list for seller (own products)', async () => {
      // Arrange
      const query: GetManageProductsQueryDTO = {
        page: 1,
        limit: 10,
        createdById: 1,
      } as any
      const user = createMockUser()
      const mockProductList = createMockProductList()
      mockManageProductService.list.mockResolvedValue(mockProductList as any)

      // Act
      const result = await controller.list(query, user)

      // Assert
      expect(result).toEqual(mockProductList)
      expect(mockManageProductService.list).toHaveBeenCalledWith({
        query,
        roleNameRequest: user.roleName,
        userIdRequest: user.userId,
      })
    })

    it('should return product list for admin (any products)', async () => {
      // Arrange
      const query: GetManageProductsQueryDTO = {
        page: 1,
        limit: 10,
        createdById: 5, // Different user
      } as any
      const user = createMockAdminUser()
      const mockProductList = createMockProductList()
      mockManageProductService.list.mockResolvedValue(mockProductList as any)

      // Act
      const result = await controller.list(query, user)

      // Assert
      expect(result).toEqual(mockProductList)
      expect(mockManageProductService.list).toHaveBeenCalledWith({
        query,
        roleNameRequest: RoleName.Admin,
        userIdRequest: user.userId,
      })
    })

    it('should return product list with filters (brandIds, categories, price range)', async () => {
      // Arrange
      const query: GetManageProductsQueryDTO = {
        page: 1,
        limit: 10,
        createdById: 1,
        brandIds: [1, 2],
        categories: [1, 2],
        minPrice: 50000,
        maxPrice: 200000,
        isPublic: true,
      } as any
      const user = createMockUser()
      const mockProductList = createMockProductList()
      mockManageProductService.list.mockResolvedValue(mockProductList as any)

      // Act
      const result = await controller.list(query, user)

      // Assert
      expect(result).toEqual(mockProductList)
      expect(mockManageProductService.list).toHaveBeenCalledWith({
        query,
        roleNameRequest: user.roleName,
        userIdRequest: user.userId,
      })
    })

    it('should return empty list when no products exist', async () => {
      // Arrange
      const query: GetManageProductsQueryDTO = {
        page: 1,
        limit: 10,
        createdById: 1,
      } as any
      const user = createMockUser()
      const emptyList = {
        data: [],
        totalItems: 0,
        page: 1,
        limit: 10,
        totalPages: 0,
      }
      mockManageProductService.list.mockResolvedValue(emptyList as any)

      // Act
      const result = await controller.list(query, user)

      // Assert
      expect(result.data).toHaveLength(0)
      expect(result.totalItems).toBe(0)
    })
  })

  // ===== GET /manage-product/products/:productId (findById) TESTS =====

  describe('GET /manage-product/products/:productId - findById()', () => {
    it('should return product detail for owner', async () => {
      // Arrange
      const params: GetProductParamsDTO = { productId: 1 } as any
      const user = createMockUser()
      const mockProductDetail = createMockProductDetail()
      mockManageProductService.getDetail.mockResolvedValue(mockProductDetail as any)

      // Act
      const result = await controller.findById(params, user)

      // Assert
      expect(result).toEqual(mockProductDetail)
      expect(mockManageProductService.getDetail).toHaveBeenCalledWith({
        productId: params.productId,
        roleNameRequest: user.roleName,
        userIdRequest: user.userId,
      })
    })

    it('should return product detail for admin', async () => {
      // Arrange
      const params: GetProductParamsDTO = { productId: 1 } as any
      const user = createMockAdminUser()
      const mockProductDetail = createMockProductDetail({ createdById: 5 }) // Different user
      mockManageProductService.getDetail.mockResolvedValue(mockProductDetail as any)

      // Act
      const result = await controller.findById(params, user)

      // Assert
      expect(result).toEqual(mockProductDetail)
      expect(mockManageProductService.getDetail).toHaveBeenCalledWith({
        productId: params.productId,
        roleNameRequest: RoleName.Admin,
        userIdRequest: user.userId,
      })
    })

    it('should throw error when product not found', async () => {
      // Arrange
      const params: GetProductParamsDTO = { productId: 999 } as any
      const user = createMockUser()
      mockManageProductService.getDetail.mockRejectedValue(new Error('Error.NotFound'))

      // Act & Assert
      await expect(controller.findById(params, user)).rejects.toThrow('Error.NotFound')
    })
  })

  // ===== POST /manage-product/products (create) TESTS =====

  describe('POST /manage-product/products - create()', () => {
    it('should create product successfully', async () => {
      // Arrange
      const userId = 1
      const body: CreateProductBodyDTO = {
        publishedAt: new Date(FIXED_DATE),
        name: 'New Product',
        basePrice: 100000,
        virtualPrice: 150000,
        brandId: 1,
        images: ['https://example.com/image1.jpg'],
        variants: [{ name: 'Color', options: ['Red', 'Blue'] }],
        categories: [1, 2],
        skus: [
          { value: 'Red', price: 100000, stock: 100, image: 'https://example.com/red.jpg' },
          { value: 'Blue', price: 100000, stock: 100, image: 'https://example.com/blue.jpg' },
        ],
      } as any
      const mockCreatedProduct = createMockProductDetail()
      mockManageProductService.create.mockResolvedValue(mockCreatedProduct as any)

      // Act
      const result = await controller.create(body, userId)

      // Assert
      expect(result).toEqual(mockCreatedProduct)
      expect(mockManageProductService.create).toHaveBeenCalledWith({
        data: body,
        createdById: userId,
      })
    })

    it('should create product with multiple SKUs based on variants', async () => {
      // Arrange
      const userId = 1
      const body: CreateProductBodyDTO = {
        publishedAt: new Date(FIXED_DATE),
        name: 'Multi-variant Product',
        basePrice: 200000,
        virtualPrice: 250000,
        brandId: 1,
        images: ['https://example.com/image1.jpg'],
        variants: [
          { name: 'Color', options: ['Red', 'Blue'] },
          { name: 'Size', options: ['S', 'M', 'L'] },
        ],
        categories: [1],
        skus: [
          { value: 'Red-S', price: 200000, stock: 50, image: '' },
          { value: 'Red-M', price: 200000, stock: 50, image: '' },
          { value: 'Red-L', price: 200000, stock: 50, image: '' },
          { value: 'Blue-S', price: 200000, stock: 50, image: '' },
          { value: 'Blue-M', price: 200000, stock: 50, image: '' },
          { value: 'Blue-L', price: 200000, stock: 50, image: '' },
        ],
      } as any
      const mockCreatedProduct = createMockProductDetail()
      mockManageProductService.create.mockResolvedValue(mockCreatedProduct as any)

      // Act
      const result = await controller.create(body, userId)

      // Assert
      expect(result).toEqual(mockCreatedProduct)
      expect(mockManageProductService.create).toHaveBeenCalledWith({
        data: body,
        createdById: userId,
      })
    })
  })

  // ===== PUT /manage-product/products/:productId (update) TESTS =====

  describe('PUT /manage-product/products/:productId - update()', () => {
    it('should update product successfully for owner', async () => {
      // Arrange
      const params: GetProductParamsDTO = { productId: 1 } as any
      const user = createMockUser()
      const body: UpdateProductBodyDTO = {
        name: 'Updated Product',
        basePrice: 120000,
        virtualPrice: 180000,
      } as any
      const mockUpdatedProduct = createMockProduct({ name: 'Updated Product' })
      mockManageProductService.update.mockResolvedValue(mockUpdatedProduct as any)

      // Act
      const result = await controller.update(body, params, user)

      // Assert
      expect(result).toEqual(mockUpdatedProduct)
      expect(mockManageProductService.update).toHaveBeenCalledWith({
        data: body,
        productId: params.productId,
        updatedById: user.userId,
        roleNameRequest: user.roleName,
      })
    })

    it('should update product successfully for admin', async () => {
      // Arrange
      const params: GetProductParamsDTO = { productId: 1 } as any
      const user = createMockAdminUser()
      const body: UpdateProductBodyDTO = {
        name: 'Admin Updated Product',
      } as any
      const mockUpdatedProduct = createMockProduct({ name: 'Admin Updated Product', createdById: 5 })
      mockManageProductService.update.mockResolvedValue(mockUpdatedProduct as any)

      // Act
      const result = await controller.update(body, params, user)

      // Assert
      expect(result).toEqual(mockUpdatedProduct)
      expect(mockManageProductService.update).toHaveBeenCalledWith({
        data: body,
        productId: params.productId,
        updatedById: user.userId,
        roleNameRequest: RoleName.Admin,
      })
    })

    it('should throw error when updating non-existent product', async () => {
      // Arrange
      const params: GetProductParamsDTO = { productId: 999 } as any
      const user = createMockUser()
      const body: UpdateProductBodyDTO = { name: 'Updated' } as any
      mockManageProductService.update.mockRejectedValue(new Error('Error.NotFound'))

      // Act & Assert
      await expect(controller.update(body, params, user)).rejects.toThrow('Error.NotFound')
    })
  })

  // ===== DELETE /manage-product/products/:productId (delete) TESTS =====

  describe('DELETE /manage-product/products/:productId - delete()', () => {
    it('should delete product successfully for owner', async () => {
      // Arrange
      const params: GetProductParamsDTO = { productId: 1 } as any
      const user = createMockUser()
      const mockResponse = { message: 'Delete successfully' as const }
      mockManageProductService.delete.mockResolvedValue(mockResponse)

      // Act
      const result = await controller.delete(params, user)

      // Assert
      expect(result).toEqual(mockResponse)
      expect(mockManageProductService.delete).toHaveBeenCalledWith({
        productId: params.productId,
        deletedById: user.userId,
        roleNameRequest: user.roleName,
      })
    })

    it('should delete product successfully for admin', async () => {
      // Arrange
      const params: GetProductParamsDTO = { productId: 1 } as any
      const user = createMockAdminUser()
      const mockResponse = { message: 'Delete successfully' as const }
      mockManageProductService.delete.mockResolvedValue(mockResponse)

      // Act
      const result = await controller.delete(params, user)

      // Assert
      expect(result).toEqual(mockResponse)
      expect(mockManageProductService.delete).toHaveBeenCalledWith({
        productId: params.productId,
        deletedById: user.userId,
        roleNameRequest: RoleName.Admin,
      })
    })

    it('should throw error when deleting non-existent product', async () => {
      // Arrange
      const params: GetProductParamsDTO = { productId: 999 } as any
      const user = createMockUser()
      mockManageProductService.delete.mockRejectedValue(new Error('Error.NotFound'))

      // Act & Assert
      await expect(controller.delete(params, user)).rejects.toThrow('Error.NotFound')
    })
  })

  // ===== EDGE CASES & ERROR HANDLING =====

  describe('Edge Cases & Error Handling', () => {
    it('should handle service throwing unexpected error in list', async () => {
      // Arrange
      const query: GetManageProductsQueryDTO = {
        page: 1,
        limit: 10,
        createdById: 1,
      } as any
      const user = createMockUser()
      mockManageProductService.list.mockRejectedValue(new Error('Database connection failed'))

      // Act & Assert
      await expect(controller.list(query, user)).rejects.toThrow('Database connection failed')
    })

    it('should handle service throwing unexpected error in create', async () => {
      // Arrange
      const userId = 1
      const body: CreateProductBodyDTO = {
        name: 'Test',
        basePrice: 100000,
        virtualPrice: 150000,
        brandId: 1,
        images: [],
        variants: [],
        categories: [],
        skus: [],
      } as any
      mockManageProductService.create.mockRejectedValue(new Error('Unexpected error'))

      // Act & Assert
      await expect(controller.create(body, userId)).rejects.toThrow('Unexpected error')
    })
  })

  // ===== RESPONSE STRUCTURE SNAPSHOTS =====

  describe('Response Structure Snapshots', () => {
    const fixedDate = '2024-01-01T00:00:00.000Z'

    it('should match product detail response structure', async () => {
      const mockProduct = createMockProductDetail({
        publishedAt: new Date(fixedDate),
        createdAt: fixedDate,
        updatedAt: fixedDate,
        productTranslations: [
          {
            id: 1,
            productId: 1,
            languageId: 'en',
            name: 'Test Product',
            description: 'Test Description',
            createdById: 1,
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
            productId: 1,
            value: 'Red',
            price: 100000,
            stock: 100,
            image: 'https://example.com/red.jpg',
            createdById: 1,
            updatedById: null,
            deletedById: null,
            deletedAt: null,
            createdAt: fixedDate,
            updatedAt: fixedDate,
          },
        ],
      })
      const params: GetProductParamsDTO = { productId: 1 }
      const user = createMockUser({ exp: 1704067200, iat: 1704063600 })
      mockManageProductService.getDetail.mockResolvedValue(mockProduct as any)
      const result = await controller.findById(params, user)
      expect(result).toMatchSnapshot()
    })

    it('should match create product response structure', async () => {
      const mockProduct = createMockProduct({
        publishedAt: new Date(fixedDate),
        createdAt: fixedDate,
        updatedAt: fixedDate,
      })
      mockManageProductService.create.mockResolvedValue(mockProduct as any)
      const body: CreateProductBodyDTO = {
        name: 'Test',
        basePrice: 100000,
        virtualPrice: 150000,
        brandId: 1,
        images: [],
        variants: [],
        categories: [],
        skus: [],
      } as any
      const result = await controller.create(body, 1)
      expect(result).toMatchSnapshot()
    })
  })
})
