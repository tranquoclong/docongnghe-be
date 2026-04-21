import { Test, TestingModule } from '@nestjs/testing'
import { CartService } from '../cart.service'
import { CartRepo } from '../cart.repo'
import { PaginationQueryType } from 'src/shared/models/request.model'
import { AddToCartBodyType, UpdateCartItemBodyType, DeleteCartBodyType } from '../cart.model'
import { I18nContext } from 'nestjs-i18n'

// Mock I18nContext để test không phụ thuộc vào i18n
jest.mock('nestjs-i18n', () => ({
  I18nContext: {
    current: jest.fn().mockReturnValue({ lang: 'vi' }),
  },
}))

// Test data factory để tạo dữ liệu test
const createTestData = {
  paginationQuery: (overrides = {}): PaginationQueryType => ({
    page: 1,
    limit: 10,
    ...overrides,
  }),

  addToCartBody: (overrides = {}): AddToCartBodyType => ({
    skuId: 1,
    quantity: 2,
    ...overrides,
  }),

  updateCartItemBody: (overrides = {}): UpdateCartItemBodyType => ({
    skuId: 1,
    quantity: 3,
    ...overrides,
  }),

  deleteCartBody: (overrides = {}): DeleteCartBodyType => ({
    cartItemIds: [1, 2, 3],
    ...overrides,
  }),

  cartResponse: (overrides = {}) =>
    ({
      data: [
        {
          shop: {
            id: 1,
            name: 'Test Shop',
            avatar: null,
          },
          cartItems: [
            {
              id: 1,
              quantity: 2,
              skuId: 1,
              userId: 1,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
              sku: {
                id: 1,
                value: 'Size: M, Color: Red',
                price: 50000,
                stock: 100,
                image: 'test-image.jpg',
                productId: 1,
                product: {
                  id: 1,
                  name: 'Test Product',
                  variants: [
                    {
                      value: 'Size',
                      options: ['M', 'L', 'XL'],
                    },
                  ],
                  publishedAt: new Date().toISOString(),
                  productTranslations: [
                    {
                      id: 1,
                      name: 'Test Product',
                      description: 'Test Description',
                      languageId: 'vi',
                    },
                  ],
                },
              },
            },
          ],
        },
      ],
      totalItems: 1,
      page: 1,
      limit: 10,
      totalPages: 1,
      ...overrides,
    }) as any,

  cartItem: (overrides = {}) => ({
    id: 1,
    quantity: 2,
    skuId: 1,
    userId: 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  }),

  deleteResult: (overrides = {}) => ({
    count: 3,
    ...overrides,
  }),
}

describe('CartService', () => {
  let service: CartService
  let module: TestingModule
  let mockCartRepo: jest.Mocked<CartRepo>

  beforeEach(async () => {
    // Reset I18nContext mock
    ;(I18nContext.current as jest.Mock).mockReturnValue({ lang: 'vi' })

    // Tạo mock cho CartRepo với tất cả methods cần thiết
    mockCartRepo = {
      list: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    } as any

    module = await Test.createTestingModule({
      providers: [CartService, { provide: CartRepo, useValue: mockCartRepo }],
    }).compile()

    service = module.get<CartService>(CartService)
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

  describe('getCart', () => {
    it('should get cart successfully with pagination', async () => {
      // Arrange - Chuẩn bị dữ liệu test
      const userId = 1
      const query = createTestData.paginationQuery({
        page: 1,
        limit: 10,
      })
      const mockCartResponse = createTestData.cartResponse()

      mockCartRepo.list.mockResolvedValue(mockCartResponse)

      // Act - Thực hiện lấy cart
      const result = await service.getCart(userId, query)

      // Assert - Kiểm tra kết quả
      expect(result).toEqual(mockCartResponse)
      expect(mockCartRepo.list).toHaveBeenCalledWith({
        userId,
        languageId: 'vi',
        page: query.page,
        limit: query.limit,
      })
      expect(mockCartRepo.list).toHaveBeenCalledTimes(1)
    })

    it('should handle different language context', async () => {
      // Arrange - Chuẩn bị dữ liệu test với ngôn ngữ khác
      const userId = 1
      const query = createTestData.paginationQuery()
      const mockCartResponse = createTestData.cartResponse()

      // Mock I18nContext để trả về ngôn ngữ khác
      ;(I18nContext.current as jest.Mock).mockReturnValue({ lang: 'en' })
      mockCartRepo.list.mockResolvedValue(mockCartResponse)

      // Act - Thực hiện lấy cart
      const result = await service.getCart(userId, query)

      // Assert - Kiểm tra kết quả
      expect(result).toEqual(mockCartResponse)
      expect(mockCartRepo.list).toHaveBeenCalledWith({
        userId,
        languageId: 'en',
        page: query.page,
        limit: query.limit,
      })
    })

    it('should handle empty cart result', async () => {
      // Arrange - Chuẩn bị dữ liệu cart trống
      const userId = 1
      const query = createTestData.paginationQuery()
      const emptyCartResponse = createTestData.cartResponse({
        data: [],
        totalItems: 0,
        totalPages: 0,
      })

      mockCartRepo.list.mockResolvedValue(emptyCartResponse)

      // Act - Thực hiện lấy cart
      const result = await service.getCart(userId, query)

      // Assert - Kiểm tra kết quả
      expect(result).toEqual(emptyCartResponse)
      expect(result.data).toHaveLength(0)
      expect(result.totalItems).toBe(0)
    })
  })

  describe('addToCart', () => {
    it('should add item to cart successfully', async () => {
      // Arrange - Chuẩn bị dữ liệu thêm vào cart
      const userId = 1
      const body = createTestData.addToCartBody({
        skuId: 1,
        quantity: 2,
      })
      const mockCartItem = createTestData.cartItem({
        skuId: body.skuId,
        quantity: body.quantity,
        userId,
      })

      mockCartRepo.create.mockResolvedValue(mockCartItem)

      // Act - Thực hiện thêm vào cart
      const result = await service.addToCart(userId, body)

      // Assert - Kiểm tra kết quả
      expect(result).toEqual(mockCartItem)
      expect(mockCartRepo.create).toHaveBeenCalledWith(userId, body)
      expect(mockCartRepo.create).toHaveBeenCalledTimes(1)
    })

    it('should handle adding multiple quantity', async () => {
      // Arrange - Chuẩn bị dữ liệu thêm nhiều số lượng
      const userId = 1
      const body = createTestData.addToCartBody({
        skuId: 2,
        quantity: 5,
      })
      const mockCartItem = createTestData.cartItem({
        skuId: body.skuId,
        quantity: body.quantity,
        userId,
      })

      mockCartRepo.create.mockResolvedValue(mockCartItem)

      // Act - Thực hiện thêm vào cart
      const result = await service.addToCart(userId, body)

      // Assert - Kiểm tra kết quả
      expect(result).toEqual(mockCartItem)
      expect(result.quantity).toBe(5)
      expect(mockCartRepo.create).toHaveBeenCalledWith(userId, body)
    })
  })

  describe('updateCartItem', () => {
    it('should update cart item successfully', async () => {
      // Arrange - Chuẩn bị dữ liệu cập nhật cart item
      const userId = 1
      const cartItemId = 1
      const body = createTestData.updateCartItemBody({
        skuId: 1,
        quantity: 3,
      })
      const mockUpdatedCartItem = createTestData.cartItem({
        id: cartItemId,
        skuId: body.skuId,
        quantity: body.quantity,
        userId,
      })

      mockCartRepo.update.mockResolvedValue(mockUpdatedCartItem)

      // Act - Thực hiện cập nhật cart item
      const result = await service.updateCartItem({
        userId,
        cartItemId,
        body,
      })

      // Assert - Kiểm tra kết quả
      expect(result).toEqual(mockUpdatedCartItem)
      expect(mockCartRepo.update).toHaveBeenCalledWith({
        userId,
        body,
        cartItemId,
      })
      expect(mockCartRepo.update).toHaveBeenCalledTimes(1)
    })

    it('should update cart item with different SKU', async () => {
      // Arrange - Chuẩn bị dữ liệu cập nhật với SKU khác
      const userId = 1
      const cartItemId = 2
      const body = createTestData.updateCartItemBody({
        skuId: 3,
        quantity: 1,
      })
      const mockUpdatedCartItem = createTestData.cartItem({
        id: cartItemId,
        skuId: body.skuId,
        quantity: body.quantity,
        userId,
      })

      mockCartRepo.update.mockResolvedValue(mockUpdatedCartItem)

      // Act - Thực hiện cập nhật cart item
      const result = await service.updateCartItem({
        userId,
        cartItemId,
        body,
      })

      // Assert - Kiểm tra kết quả
      expect(result).toEqual(mockUpdatedCartItem)
      expect(result.skuId).toBe(3)
      expect(result.quantity).toBe(1)
    })
  })

  describe('deleteCart', () => {
    it('should delete cart items successfully', async () => {
      // Arrange - Chuẩn bị dữ liệu xóa cart items
      const userId = 1
      const body = createTestData.deleteCartBody({
        cartItemIds: [1, 2, 3],
      })
      const mockDeleteResult = createTestData.deleteResult({
        count: 3,
      })

      mockCartRepo.delete.mockResolvedValue(mockDeleteResult)

      // Act - Thực hiện xóa cart items
      const result = await service.deleteCart(userId, body)

      // Assert - Kiểm tra kết quả
      expect(result).toEqual({
        message: '3 item(s) deleted from cart',
      })
      expect(mockCartRepo.delete).toHaveBeenCalledWith(userId, body)
      expect(mockCartRepo.delete).toHaveBeenCalledTimes(1)
    })

    it('should handle single item deletion', async () => {
      // Arrange - Chuẩn bị dữ liệu xóa 1 item
      const userId = 1
      const body = createTestData.deleteCartBody({
        cartItemIds: [1],
      })
      const mockDeleteResult = createTestData.deleteResult({
        count: 1,
      })

      mockCartRepo.delete.mockResolvedValue(mockDeleteResult)

      // Act - Thực hiện xóa cart item
      const result = await service.deleteCart(userId, body)

      // Assert - Kiểm tra kết quả
      expect(result).toEqual({
        message: '1 item(s) deleted from cart',
      })
      expect(mockCartRepo.delete).toHaveBeenCalledWith(userId, body)
    })

    it('should handle no items deleted', async () => {
      // Arrange - Chuẩn bị dữ liệu không xóa được item nào
      const userId = 1
      const body = createTestData.deleteCartBody({
        cartItemIds: [999], // ID không tồn tại
      })
      const mockDeleteResult = createTestData.deleteResult({
        count: 0,
      })

      mockCartRepo.delete.mockResolvedValue(mockDeleteResult)

      // Act - Thực hiện xóa cart item
      const result = await service.deleteCart(userId, body)

      // Assert - Kiểm tra kết quả
      expect(result).toEqual({
        message: '0 item(s) deleted from cart',
      })
      expect(mockCartRepo.delete).toHaveBeenCalledWith(userId, body)
    })

    it('should handle empty cart item IDs array', async () => {
      // Arrange - Chuẩn bị dữ liệu với mảng rỗng
      const userId = 1
      const body = createTestData.deleteCartBody({
        cartItemIds: [],
      })
      const mockDeleteResult = createTestData.deleteResult({
        count: 0,
      })

      mockCartRepo.delete.mockResolvedValue(mockDeleteResult)

      // Act - Thực hiện xóa cart item
      const result = await service.deleteCart(userId, body)

      // Assert - Kiểm tra kết quả
      expect(result).toEqual({
        message: '0 item(s) deleted from cart',
      })
      expect(mockCartRepo.delete).toHaveBeenCalledWith(userId, body)
    })
  })

  describe('edge cases', () => {
    it('should handle null I18nContext gracefully', async () => {
      // Arrange - Chuẩn bị I18nContext null
      ;(I18nContext.current as jest.Mock).mockReturnValue(null)
      const userId = 1
      const query = createTestData.paginationQuery()
      const mockCartResponse = createTestData.cartResponse()

      mockCartRepo.list.mockResolvedValue(mockCartResponse)

      // Act - Thực hiện lấy cart
      const result = await service.getCart(userId, query)

      // Assert - Kiểm tra kết quả
      expect(result).toEqual(mockCartResponse)
      expect(mockCartRepo.list).toHaveBeenCalledWith({
        userId,
        languageId: undefined, // null?.lang returns undefined
        page: query.page,
        limit: query.limit,
      })
    })

    it('should handle repository errors properly', async () => {
      // Arrange - Chuẩn bị lỗi từ repository
      const userId = 1
      const query = createTestData.paginationQuery()
      const repositoryError = new Error('Database connection failed')

      mockCartRepo.list.mockRejectedValue(repositoryError)

      // Act & Assert - Thực hiện test và kiểm tra lỗi
      await expect(service.getCart(userId, query)).rejects.toThrow('Database connection failed')
      expect(mockCartRepo.list).toHaveBeenCalledWith({
        userId,
        languageId: 'vi', // Default lang từ mock
        page: query.page,
        limit: query.limit,
      })
    })

    it('should propagate non-existent SKU error from repo on addToCart', async () => {
      const userId = 1
      const body = createTestData.addToCartBody({ skuId: 99999 })
      mockCartRepo.create.mockRejectedValue(new Error('SKU not found'))

      await expect(service.addToCart(userId, body)).rejects.toThrow('SKU not found')
    })

    it('should propagate error when updating cart item for wrong user', async () => {
      const userId = 1
      const cartItemId = 100
      const body = createTestData.updateCartItemBody()
      mockCartRepo.update.mockRejectedValue(new Error('Cart item not found'))

      await expect(service.updateCartItem({ userId, cartItemId, body })).rejects.toThrow('Cart item not found')
    })

    it('should handle zero quantity in update body', async () => {
      const userId = 1
      const cartItemId = 1
      const body = createTestData.updateCartItemBody({ quantity: 0 })
      mockCartRepo.update.mockResolvedValue({} as any)

      await service.updateCartItem({ userId, cartItemId, body })

      expect(mockCartRepo.update).toHaveBeenCalledWith({
        userId,
        body,
        cartItemId,
      })
    })

    it('should handle concurrent addToCart calls', async () => {
      const userId = 1
      const body1 = createTestData.addToCartBody({ skuId: 1 })
      const body2 = createTestData.addToCartBody({ skuId: 2 })
      mockCartRepo.create.mockResolvedValue({} as any)

      await Promise.all([service.addToCart(userId, body1), service.addToCart(userId, body2)])

      expect(mockCartRepo.create).toHaveBeenCalledTimes(2)
    })

    it('should handle delete with non-existent cart item IDs', async () => {
      const userId = 1
      const body = createTestData.deleteCartBody({ cartItemIds: [999, 998] })
      mockCartRepo.delete.mockResolvedValue({ count: 0 })

      const result = await service.deleteCart(userId, body)

      expect(result).toEqual({ message: '0 item(s) deleted from cart' })
    })
  })
})
