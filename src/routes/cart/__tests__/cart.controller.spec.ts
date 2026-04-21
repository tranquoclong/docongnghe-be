import { Test, TestingModule } from '@nestjs/testing'
import { CartController } from '../cart.controller'
import { CartService } from '../cart.service'
import { PaginationQueryDTO } from 'src/shared/dtos/request.dto'
import { AddToCartBodyDTO, DeleteCartBodyDTO, GetCartItemParamsDTO, UpdateCartItemBodyDTO } from '../cart.dto'

// Test data factory để tạo dữ liệu test
const createTestData = {
  paginationQuery: (overrides = {}): PaginationQueryDTO => ({
    page: 1,
    limit: 10,
    ...overrides,
  }),

  addToCartBody: (overrides = {}): AddToCartBodyDTO => ({
    skuId: 1,
    quantity: 2,
    ...overrides,
  }),

  updateCartItemBody: (overrides = {}): UpdateCartItemBodyDTO => ({
    skuId: 1,
    quantity: 3,
    ...overrides,
  }),

  deleteCartBody: (overrides = {}): DeleteCartBodyDTO => ({
    cartItemIds: [1, 2, 3],
    ...overrides,
  }),

  cartItemParams: (overrides = {}): GetCartItemParamsDTO => ({
    cartItemId: 1,
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

  deleteMessage: (count: number) => ({
    message: `${count} item(s) deleted from cart`,
  }),
}

describe('CartController', () => {
  let controller: CartController
  let module: TestingModule
  let mockCartService: jest.Mocked<CartService>

  beforeEach(async () => {
    // Tạo mock cho CartService với tất cả methods cần thiết
    mockCartService = {
      getCart: jest.fn(),
      addToCart: jest.fn(),
      updateCartItem: jest.fn(),
      deleteCart: jest.fn(),
    } as any

    module = await Test.createTestingModule({
      controllers: [CartController],
      providers: [{ provide: CartService, useValue: mockCartService }],
    }).compile()

    controller = module.get<CartController>(CartController)
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
    it('should get cart successfully', async () => {
      // Arrange - Chuẩn bị dữ liệu test
      const userId = 1
      const query = createTestData.paginationQuery({
        page: 1,
        limit: 10,
      })
      const mockCartResponse = createTestData.cartResponse()

      mockCartService.getCart.mockResolvedValue(mockCartResponse)

      // Act - Thực hiện lấy cart
      const result = await controller.getCart(userId, query)

      // Assert - Kiểm tra kết quả
      expect(result).toEqual(mockCartResponse)
      expect(mockCartService.getCart).toHaveBeenCalledWith(userId, query)
      expect(mockCartService.getCart).toHaveBeenCalledTimes(1)
    })

    it('should handle different pagination parameters', async () => {
      // Arrange - Chuẩn bị dữ liệu test với pagination khác
      const userId = 2
      const query = createTestData.paginationQuery({
        page: 2,
        limit: 5,
      })
      const mockCartResponse = createTestData.cartResponse({
        page: 2,
        limit: 5,
        totalPages: 3,
      })

      mockCartService.getCart.mockResolvedValue(mockCartResponse)

      // Act - Thực hiện lấy cart
      const result = await controller.getCart(userId, query)

      // Assert - Kiểm tra kết quả
      expect(result).toEqual(mockCartResponse)
      expect(result.page).toBe(2)
      expect(result.limit).toBe(5)
      expect(mockCartService.getCart).toHaveBeenCalledWith(userId, query)
    })

    it('should handle empty cart', async () => {
      // Arrange - Chuẩn bị dữ liệu cart trống
      const userId = 1
      const query = createTestData.paginationQuery()
      const emptyCartResponse = createTestData.cartResponse({
        data: [],
        totalItems: 0,
        totalPages: 0,
      })

      mockCartService.getCart.mockResolvedValue(emptyCartResponse)

      // Act - Thực hiện lấy cart
      const result = await controller.getCart(userId, query)

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

      mockCartService.addToCart.mockResolvedValue(mockCartItem)

      // Act - Thực hiện thêm vào cart
      const result = await controller.addToCart(body, userId)

      // Assert - Kiểm tra kết quả
      expect(result).toEqual(mockCartItem)
      expect(mockCartService.addToCart).toHaveBeenCalledWith(userId, body)
      expect(mockCartService.addToCart).toHaveBeenCalledTimes(1)
    })

    it('should handle adding different products', async () => {
      // Arrange - Chuẩn bị dữ liệu thêm sản phẩm khác
      const userId = 2
      const body = createTestData.addToCartBody({
        skuId: 5,
        quantity: 3,
      })
      const mockCartItem = createTestData.cartItem({
        id: 2,
        skuId: body.skuId,
        quantity: body.quantity,
        userId,
      })

      mockCartService.addToCart.mockResolvedValue(mockCartItem)

      // Act - Thực hiện thêm vào cart
      const result = await controller.addToCart(body, userId)

      // Assert - Kiểm tra kết quả
      expect(result).toEqual(mockCartItem)
      expect(result.skuId).toBe(5)
      expect(result.quantity).toBe(3)
      expect(mockCartService.addToCart).toHaveBeenCalledWith(userId, body)
    })

    it('should handle large quantity', async () => {
      // Arrange - Chuẩn bị dữ liệu với số lượng lớn
      const userId = 1
      const body = createTestData.addToCartBody({
        skuId: 1,
        quantity: 100,
      })
      const mockCartItem = createTestData.cartItem({
        skuId: body.skuId,
        quantity: body.quantity,
        userId,
      })

      mockCartService.addToCart.mockResolvedValue(mockCartItem)

      // Act - Thực hiện thêm vào cart
      const result = await controller.addToCart(body, userId)

      // Assert - Kiểm tra kết quả
      expect(result).toEqual(mockCartItem)
      expect(result.quantity).toBe(100)
    })
  })

  describe('updateCartItem', () => {
    it('should update cart item successfully', async () => {
      // Arrange - Chuẩn bị dữ liệu cập nhật cart item
      const userId = 1
      const param = createTestData.cartItemParams({
        cartItemId: 1,
      })
      const body = createTestData.updateCartItemBody({
        skuId: 2,
        quantity: 5,
      })
      const mockUpdatedCartItem = createTestData.cartItem({
        id: param.cartItemId,
        skuId: body.skuId,
        quantity: body.quantity,
        userId,
      })

      mockCartService.updateCartItem.mockResolvedValue(mockUpdatedCartItem)

      // Act - Thực hiện cập nhật cart item
      const result = await controller.updateCartItem(userId, param, body)

      // Assert - Kiểm tra kết quả
      expect(result).toEqual(mockUpdatedCartItem)
      expect(mockCartService.updateCartItem).toHaveBeenCalledWith({
        userId,
        cartItemId: param.cartItemId,
        body,
      })
      expect(mockCartService.updateCartItem).toHaveBeenCalledTimes(1)
    })

    it('should handle updating different cart items', async () => {
      // Arrange - Chuẩn bị dữ liệu cập nhật cart item khác
      const userId = 2
      const param = createTestData.cartItemParams({
        cartItemId: 3,
      })
      const body = createTestData.updateCartItemBody({
        skuId: 4,
        quantity: 1,
      })
      const mockUpdatedCartItem = createTestData.cartItem({
        id: param.cartItemId,
        skuId: body.skuId,
        quantity: body.quantity,
        userId,
      })

      mockCartService.updateCartItem.mockResolvedValue(mockUpdatedCartItem)

      // Act - Thực hiện cập nhật cart item
      const result = await controller.updateCartItem(userId, param, body)

      // Assert - Kiểm tra kết quả
      expect(result).toEqual(mockUpdatedCartItem)
      expect(result.id).toBe(3)
      expect(result.skuId).toBe(4)
      expect(result.quantity).toBe(1)
    })

    it('should handle quantity updates', async () => {
      // Arrange - Chuẩn bị dữ liệu cập nhật chỉ số lượng
      const userId = 1
      const param = createTestData.cartItemParams({
        cartItemId: 1,
      })
      const body = createTestData.updateCartItemBody({
        skuId: 1, // Giữ nguyên SKU
        quantity: 10, // Thay đổi quantity
      })
      const mockUpdatedCartItem = createTestData.cartItem({
        id: param.cartItemId,
        skuId: body.skuId,
        quantity: body.quantity,
        userId,
      })

      mockCartService.updateCartItem.mockResolvedValue(mockUpdatedCartItem)

      // Act - Thực hiện cập nhật cart item
      const result = await controller.updateCartItem(userId, param, body)

      // Assert - Kiểm tra kết quả
      expect(result).toEqual(mockUpdatedCartItem)
      expect(result.quantity).toBe(10)
      expect(mockCartService.updateCartItem).toHaveBeenCalledWith({
        userId,
        cartItemId: param.cartItemId,
        body,
      })
    })
  })

  describe('deleteCart', () => {
    it('should delete cart items successfully', async () => {
      // Arrange - Chuẩn bị dữ liệu xóa cart items
      const userId = 1
      const body = createTestData.deleteCartBody({
        cartItemIds: [1, 2, 3],
      })
      const mockDeleteResponse = createTestData.deleteMessage(3)

      mockCartService.deleteCart.mockResolvedValue(mockDeleteResponse)

      // Act - Thực hiện xóa cart items
      const result = await controller.deleteCart(body, userId)

      // Assert - Kiểm tra kết quả
      expect(result).toEqual(mockDeleteResponse)
      expect(result.message).toBe('3 item(s) deleted from cart')
      expect(mockCartService.deleteCart).toHaveBeenCalledWith(userId, body)
      expect(mockCartService.deleteCart).toHaveBeenCalledTimes(1)
    })

    it('should handle single item deletion', async () => {
      // Arrange - Chuẩn bị dữ liệu xóa 1 item
      const userId = 1
      const body = createTestData.deleteCartBody({
        cartItemIds: [5],
      })
      const mockDeleteResponse = createTestData.deleteMessage(1)

      mockCartService.deleteCart.mockResolvedValue(mockDeleteResponse)

      // Act - Thực hiện xóa cart item
      const result = await controller.deleteCart(body, userId)

      // Assert - Kiểm tra kết quả
      expect(result).toEqual(mockDeleteResponse)
      expect(result.message).toBe('1 item(s) deleted from cart')
      expect(mockCartService.deleteCart).toHaveBeenCalledWith(userId, body)
    })

    it('should handle no items deleted', async () => {
      // Arrange - Chuẩn bị dữ liệu không xóa được item nào
      const userId = 1
      const body = createTestData.deleteCartBody({
        cartItemIds: [999], // ID không tồn tại
      })
      const mockDeleteResponse = createTestData.deleteMessage(0)

      mockCartService.deleteCart.mockResolvedValue(mockDeleteResponse)

      // Act - Thực hiện xóa cart item
      const result = await controller.deleteCart(body, userId)

      // Assert - Kiểm tra kết quả
      expect(result).toEqual(mockDeleteResponse)
      expect(result.message).toBe('0 item(s) deleted from cart')
      expect(mockCartService.deleteCart).toHaveBeenCalledWith(userId, body)
    })

    it('should handle multiple item deletion', async () => {
      // Arrange - Chuẩn bị dữ liệu xóa nhiều items
      const userId = 2
      const body = createTestData.deleteCartBody({
        cartItemIds: [1, 2, 3, 4, 5],
      })
      const mockDeleteResponse = createTestData.deleteMessage(5)

      mockCartService.deleteCart.mockResolvedValue(mockDeleteResponse)

      // Act - Thực hiện xóa cart items
      const result = await controller.deleteCart(body, userId)

      // Assert - Kiểm tra kết quả
      expect(result).toEqual(mockDeleteResponse)
      expect(result.message).toBe('5 item(s) deleted from cart')
      expect(body.cartItemIds).toHaveLength(5)
    })
  })

  describe('edge cases and error handling', () => {
    it('should handle service errors in getCart', async () => {
      // Arrange - Chuẩn bị lỗi từ service
      const userId = 1
      const query = createTestData.paginationQuery()
      const serviceError = new Error('Service unavailable')

      mockCartService.getCart.mockRejectedValue(serviceError)

      // Act & Assert - Thực hiện test và kiểm tra lỗi
      await expect(controller.getCart(userId, query)).rejects.toThrow('Service unavailable')
      expect(mockCartService.getCart).toHaveBeenCalledWith(userId, query)
    })

    it('should handle service errors in addToCart', async () => {
      // Arrange - Chuẩn bị lỗi từ service
      const userId = 1
      const body = createTestData.addToCartBody()
      const serviceError = new Error('SKU not found')

      mockCartService.addToCart.mockRejectedValue(serviceError)

      // Act & Assert - Thực hiện test và kiểm tra lỗi
      await expect(controller.addToCart(body, userId)).rejects.toThrow('SKU not found')
      expect(mockCartService.addToCart).toHaveBeenCalledWith(userId, body)
    })

    it('should handle service errors in updateCartItem', async () => {
      // Arrange - Chuẩn bị lỗi từ service
      const userId = 1
      const param = createTestData.cartItemParams()
      const body = createTestData.updateCartItemBody()
      const serviceError = new Error('Cart item not found')

      mockCartService.updateCartItem.mockRejectedValue(serviceError)

      // Act & Assert - Thực hiện test và kiểm tra lỗi
      await expect(controller.updateCartItem(userId, param, body)).rejects.toThrow('Cart item not found')
      expect(mockCartService.updateCartItem).toHaveBeenCalledWith({
        userId,
        cartItemId: param.cartItemId,
        body,
      })
    })

    it('should handle service errors in deleteCart', async () => {
      // Arrange - Chuẩn bị lỗi từ service
      const userId = 1
      const body = createTestData.deleteCartBody()
      const serviceError = new Error('Database error')

      mockCartService.deleteCart.mockRejectedValue(serviceError)

      // Act & Assert - Thực hiện test và kiểm tra lỗi
      await expect(controller.deleteCart(body, userId)).rejects.toThrow('Database error')
      expect(mockCartService.deleteCart).toHaveBeenCalledWith(userId, body)
    })
  })

  // ===== RESPONSE STRUCTURE SNAPSHOTS =====

  describe('Response Structure Snapshots', () => {
    const fixedDate = '2024-01-01T00:00:00.000Z'

    it('should match cart list response structure', async () => {
      const mockResponse = createTestData.cartResponse({
        data: [
          {
            shop: { id: 1, name: 'Test Shop', avatar: null },
            cartItems: [
              {
                id: 1,
                quantity: 2,
                skuId: 1,
                userId: 1,
                createdAt: fixedDate,
                updatedAt: fixedDate,
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
                    variants: [{ value: 'Size', options: ['M', 'L', 'XL'] }],
                    publishedAt: fixedDate,
                    productTranslations: [{ id: 1, name: 'Test Product', description: 'Test Description', languageId: 'vi' }],
                  },
                },
              },
            ],
          },
        ],
      })
      mockCartService.getCart.mockResolvedValue(mockResponse)
      const result = await controller.getCart(1, createTestData.paginationQuery())
      expect(result).toMatchSnapshot()
    })

    it('should match add to cart response structure', async () => {
      const mockResponse = createTestData.cartItem({ createdAt: fixedDate, updatedAt: fixedDate })
      mockCartService.addToCart.mockResolvedValue(mockResponse)
      const result = await controller.addToCart(createTestData.addToCartBody(), 1)
      expect(result).toMatchSnapshot()
    })

    it('should match delete cart response structure', async () => {
      const mockResponse = createTestData.deleteMessage(3)
      mockCartService.deleteCart.mockResolvedValue(mockResponse)
      const result = await controller.deleteCart(createTestData.deleteCartBody(), 1)
      expect(result).toMatchSnapshot()
    })
  })
})
