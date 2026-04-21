import { Test, TestingModule } from '@nestjs/testing'
import {
  InvalidQuantityException,
  NotFoundCartItemException,
  NotFoundSKUException,
  OutOfStockSKUException,
  ProductNotFoundException,
} from 'src/routes/cart/cart.error'
import { CartRepo } from 'src/routes/cart/cart.repo'
import { ALL_LANGUAGE_CODE } from 'src/shared/constants/other.constant'
import { isNotFoundPrismaError } from 'src/shared/helpers'
import { PrismaService } from 'src/shared/services/prisma.service'

const mockIsNotFoundPrismaError = isNotFoundPrismaError as jest.MockedFunction<typeof isNotFoundPrismaError>

describe('CartRepo', () => {
  let repository: CartRepo
  let mockPrismaService: any

  // Test data factories
  const createTestData = {
    cartItem: (overrides = {}) => ({
      id: 1,
      quantity: 2,
      skuId: 1,
      userId: 1,
      createdAt: new Date('2024-01-01'),
      updatedAt: new Date('2024-01-01'),
      ...overrides,
    }),
    sku: (overrides = {}) => ({
      id: 1,
      value: JSON.stringify({ color: 'red', size: 'M' }),
      price: 100000,
      stock: 10,
      image: 'sku-image.jpg',
      productId: 1,
      deletedAt: null,
      product: {
        id: 1,
        name: 'Test Product',
        basePrice: 100000,
        virtualPrice: 120000,
        publishedAt: new Date('2024-01-01'),
        deletedAt: null,
        createdById: 1,
        productTranslations: [],
        createdBy: {
          id: 1,
          name: 'Shop Owner',
          avatar: 'avatar.jpg',
        },
      },
      ...overrides,
    }),
    user: (overrides = {}) => ({
      id: 1,
      name: 'Shop Owner',
      avatar: 'avatar.jpg',
      ...overrides,
    }),
    addToCartBody: (overrides = {}) => ({
      skuId: 1,
      quantity: 2,
      ...overrides,
    }),
    updateCartItemBody: (overrides = {}) => ({
      skuId: 1,
      quantity: 3,
      ...overrides,
    }),
    deleteCartBody: (overrides = {}) => ({
      cartItemIds: [1, 2],
      ...overrides,
    }),
  }

  beforeEach(async () => {
    jest.clearAllMocks()

    mockPrismaService = {
      cartItem: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        upsert: jest.fn(),
        update: jest.fn(),
        deleteMany: jest.fn(),
      },
      sKU: {
        findUnique: jest.fn(),
      },
      $queryRaw: jest.fn(),
    }

    const module: TestingModule = await Test.createTestingModule({
      providers: [CartRepo, { provide: PrismaService, useValue: mockPrismaService }],
    }).compile()

    repository = module.get<CartRepo>(CartRepo)
  })

  describe('list', () => {
    it('should list cart items using raw SQL query', async () => {
      // Arrange - Chuẩn bị dữ liệu
      const userId = 1
      const languageId = 'vi'
      const page = 1
      const limit = 10
      const mockData = [
        {
          shop: createTestData.user(),
          cartItems: [createTestData.cartItem()],
        },
      ]
      const mockTotalItems = [{ createdById: 1 }]

      mockPrismaService.$queryRaw.mockResolvedValueOnce(mockTotalItems).mockResolvedValueOnce(mockData)

      // Act - Thực hiện list
      const result = await repository.list({ userId, languageId, page, limit })

      // Assert - Kiểm tra kết quả
      expect(result.data).toHaveLength(1)
      expect(result.data[0].shop).toMatchObject({
        id: 1,
        name: 'Shop Owner',
        avatar: 'avatar.jpg',
      })
      expect(result.data[0].cartItems).toHaveLength(1)
      expect(result.totalItems).toBe(1)
      expect(result.page).toBe(1)
      expect(result.limit).toBe(10)
      expect(result.totalPages).toBe(1)
      expect(mockPrismaService.$queryRaw).toHaveBeenCalledTimes(2)
    })

    it('should handle pagination in list', async () => {
      // Arrange - Chuẩn bị dữ liệu cho trang 2
      const userId = 1
      const languageId = 'vi'
      const page = 2
      const limit = 5
      const mockData = [
        {
          shop: createTestData.user({ id: 2 }),
          cartItems: [createTestData.cartItem({ id: 6 })],
        },
      ]
      const mockTotalItems = [{ createdById: 1 }, { createdById: 2 }, { createdById: 3 }]

      mockPrismaService.$queryRaw.mockResolvedValueOnce(mockTotalItems).mockResolvedValueOnce(mockData)

      // Act - Thực hiện list trang 2
      const result = await repository.list({ userId, languageId, page, limit })

      // Assert - Kiểm tra pagination
      expect(result.page).toBe(2)
      expect(result.totalItems).toBe(3)
      expect(result.totalPages).toBe(1)
    })

    it('should use ALL_LANGUAGE_CODE in list raw query', async () => {
      // Arrange - Chuẩn bị dữ liệu với ALL_LANGUAGE_CODE
      const userId = 1
      const languageId = ALL_LANGUAGE_CODE
      const page = 1
      const limit = 10
      const mockData = []
      const mockTotalItems = []

      mockPrismaService.$queryRaw.mockResolvedValueOnce(mockTotalItems).mockResolvedValueOnce(mockData)

      // Act - Thực hiện list
      const result = await repository.list({ userId, languageId, page, limit })

      // Assert - Kiểm tra kết quả
      expect(result.data).toEqual([])
      expect(result.totalItems).toBe(0)
      expect(mockPrismaService.$queryRaw).toHaveBeenCalledTimes(2)
    })
  })

  describe('create', () => {
    it('should create new cart item successfully', async () => {
      // Arrange - Chuẩn bị dữ liệu
      const userId = 1
      const body = createTestData.addToCartBody()
      const mockSku = createTestData.sku()
      const mockCartItem = createTestData.cartItem()

      mockPrismaService.cartItem.findUnique.mockResolvedValue(null)
      mockPrismaService.sKU.findUnique.mockResolvedValue(mockSku)
      mockPrismaService.cartItem.upsert.mockResolvedValue(mockCartItem)

      // Act - Thực hiện create
      const result = await repository.create(userId, body)

      // Assert - Kiểm tra kết quả
      expect(result).toMatchObject({
        id: mockCartItem.id,
        quantity: mockCartItem.quantity,
        skuId: mockCartItem.skuId,
        userId: mockCartItem.userId,
      })
      expect(mockPrismaService.cartItem.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            userId_skuId: {
              userId,
              skuId: body.skuId,
            },
          },
          create: expect.objectContaining({
            userId,
            skuId: body.skuId,
            quantity: body.quantity,
          }),
        }),
      )
    })

    it('should increment quantity when cart item already exists', async () => {
      // Arrange - Chuẩn bị dữ liệu với cart item đã tồn tại
      const userId = 1
      const body = createTestData.addToCartBody({ quantity: 2 })
      const existingCartItem = createTestData.cartItem({ quantity: 3 })
      const mockSku = createTestData.sku({ stock: 10 })
      const updatedCartItem = createTestData.cartItem({ quantity: 5 })

      mockPrismaService.cartItem.findUnique.mockResolvedValue(existingCartItem)
      mockPrismaService.sKU.findUnique.mockResolvedValue(mockSku)
      mockPrismaService.cartItem.upsert.mockResolvedValue(updatedCartItem)

      // Act - Thực hiện create (upsert)
      const result = await repository.create(userId, body)

      // Assert - Kiểm tra increment
      expect(result).toMatchObject({
        id: updatedCartItem.id,
        quantity: updatedCartItem.quantity,
        skuId: updatedCartItem.skuId,
        userId: updatedCartItem.userId,
      })
      expect(mockPrismaService.cartItem.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          update: {
            quantity: {
              increment: body.quantity,
            },
          },
        }),
      )
    })

    it('should throw NotFoundSKUException when SKU not found', async () => {
      // Arrange - Chuẩn bị dữ liệu với SKU không tồn tại
      const userId = 1
      const body = createTestData.addToCartBody()

      mockPrismaService.cartItem.findUnique.mockResolvedValue(null)
      mockPrismaService.sKU.findUnique.mockResolvedValue(null)

      // Act & Assert - Kiểm tra lỗi
      await expect(repository.create(userId, body)).rejects.toThrow(NotFoundSKUException)
    })

    it('should throw OutOfStockSKUException when stock is insufficient', async () => {
      // Arrange - Chuẩn bị dữ liệu với stock không đủ
      const userId = 1
      const body = createTestData.addToCartBody({ quantity: 5 })
      const mockSku = createTestData.sku({ stock: 3 })

      mockPrismaService.cartItem.findUnique.mockResolvedValue(null)
      mockPrismaService.sKU.findUnique.mockResolvedValue(mockSku)

      // Act & Assert - Kiểm tra lỗi
      await expect(repository.create(userId, body)).rejects.toThrow(OutOfStockSKUException)
    })

    it('should throw InvalidQuantityException when total quantity exceeds stock', async () => {
      // Arrange - Chuẩn bị dữ liệu với tổng quantity vượt stock
      const userId = 1
      const body = createTestData.addToCartBody({ quantity: 5 })
      const existingCartItem = createTestData.cartItem({ quantity: 6 })
      const mockSku = createTestData.sku({ stock: 10 })

      mockPrismaService.cartItem.findUnique.mockResolvedValue(existingCartItem)
      mockPrismaService.sKU.findUnique.mockResolvedValue(mockSku)

      // Act & Assert - Kiểm tra lỗi
      await expect(repository.create(userId, body)).rejects.toThrow(InvalidQuantityException)
    })

    it('should throw ProductNotFoundException when product is deleted', async () => {
      // Arrange - Chuẩn bị dữ liệu với product đã xóa
      const userId = 1
      const body = createTestData.addToCartBody()
      const mockSku = createTestData.sku({
        product: {
          ...createTestData.sku().product,
          deletedAt: new Date(),
        },
      })

      mockPrismaService.cartItem.findUnique.mockResolvedValue(null)
      mockPrismaService.sKU.findUnique.mockResolvedValue(mockSku)

      // Act & Assert - Kiểm tra lỗi
      await expect(repository.create(userId, body)).rejects.toThrow(ProductNotFoundException)
    })

    it('should throw ProductNotFoundException when product is not published', async () => {
      // Arrange - Chuẩn bị dữ liệu với product chưa publish
      const userId = 1
      const body = createTestData.addToCartBody()
      const mockSku = createTestData.sku({
        product: {
          ...createTestData.sku().product,
          publishedAt: null,
        },
      })

      mockPrismaService.cartItem.findUnique.mockResolvedValue(null)
      mockPrismaService.sKU.findUnique.mockResolvedValue(mockSku)

      // Act & Assert - Kiểm tra lỗi
      await expect(repository.create(userId, body)).rejects.toThrow(ProductNotFoundException)
    })

    it('should throw ProductNotFoundException when product publishedAt is in future', async () => {
      // Arrange - Chuẩn bị dữ liệu với publishedAt trong tương lai
      const userId = 1
      const body = createTestData.addToCartBody()
      const futureDate = new Date()
      futureDate.setDate(futureDate.getDate() + 10)
      const mockSku = createTestData.sku({
        product: {
          ...createTestData.sku().product,
          publishedAt: futureDate,
        },
      })

      mockPrismaService.cartItem.findUnique.mockResolvedValue(null)
      mockPrismaService.sKU.findUnique.mockResolvedValue(mockSku)

      // Act & Assert - Kiểm tra lỗi
      await expect(repository.create(userId, body)).rejects.toThrow(ProductNotFoundException)
    })
  })

  describe('update', () => {
    it('should update cart item successfully', async () => {
      // Arrange - Chuẩn bị dữ liệu
      const userId = 1
      const cartItemId = 1
      const body = createTestData.updateCartItemBody()
      const mockSku = createTestData.sku()
      const updatedCartItem = createTestData.cartItem({ quantity: 3 })

      mockPrismaService.cartItem.findUnique.mockResolvedValue(null)
      mockPrismaService.sKU.findUnique.mockResolvedValue(mockSku)
      mockPrismaService.cartItem.update.mockResolvedValue(updatedCartItem)

      // Act - Thực hiện update
      const result = await repository.update({ userId, cartItemId, body })

      // Assert - Kiểm tra kết quả
      expect(result).toMatchObject({
        id: updatedCartItem.id,
        quantity: updatedCartItem.quantity,
        skuId: updatedCartItem.skuId,
        userId: updatedCartItem.userId,
      })
      expect(mockPrismaService.cartItem.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            id: cartItemId,
            userId,
          },
          data: {
            skuId: body.skuId,
            quantity: body.quantity,
          },
        }),
      )
    })

    it('should throw NotFoundCartItemException when cart item not found', async () => {
      // Arrange - Chuẩn bị dữ liệu với cart item không tồn tại
      const userId = 1
      const cartItemId = 999
      const body = createTestData.updateCartItemBody()
      const mockSku = createTestData.sku()
      const notFoundError = new Error('Record not found')

      mockPrismaService.cartItem.findUnique.mockResolvedValue(null)
      mockPrismaService.sKU.findUnique.mockResolvedValue(mockSku)
      mockPrismaService.cartItem.update.mockRejectedValue(notFoundError)
      mockIsNotFoundPrismaError.mockReturnValue(true)

      // Act & Assert - Kiểm tra lỗi
      await expect(repository.update({ userId, cartItemId, body })).rejects.toThrow(NotFoundCartItemException)
    })

    it('should throw generic error when update fails with non-notfound error', async () => {
      // Arrange - Chuẩn bị dữ liệu với lỗi khác
      const userId = 1
      const cartItemId = 1
      const body = createTestData.updateCartItemBody()
      const mockSku = createTestData.sku()
      const genericError = new Error('Database error')

      mockPrismaService.cartItem.findUnique.mockResolvedValue(null)
      mockPrismaService.sKU.findUnique.mockResolvedValue(mockSku)
      mockPrismaService.cartItem.update.mockRejectedValue(genericError)
      mockIsNotFoundPrismaError.mockReturnValue(false)

      // Act & Assert - Kiểm tra lỗi generic
      await expect(repository.update({ userId, cartItemId, body })).rejects.toThrow('Database error')
    })
  })

  describe('delete', () => {
    it('should delete cart items successfully', async () => {
      // Arrange - Chuẩn bị dữ liệu
      const userId = 1
      const body = createTestData.deleteCartBody()
      const deleteResult = { count: 2 }

      mockPrismaService.cartItem.deleteMany.mockResolvedValue(deleteResult)

      // Act - Thực hiện delete
      const result = await repository.delete(userId, body)

      // Assert - Kiểm tra kết quả
      expect(result).toEqual(deleteResult)
      expect(mockPrismaService.cartItem.deleteMany).toHaveBeenCalledWith({
        where: {
          id: {
            in: body.cartItemIds,
          },
          userId,
        },
      })
    })

    it('should return count 0 when no items deleted', async () => {
      // Arrange - Chuẩn bị dữ liệu với items không tồn tại
      const userId = 1
      const body = createTestData.deleteCartBody({ cartItemIds: [999, 998] })
      const deleteResult = { count: 0 }

      mockPrismaService.cartItem.deleteMany.mockResolvedValue(deleteResult)

      // Act - Thực hiện delete
      const result = await repository.delete(userId, body)

      // Assert - Kiểm tra kết quả
      expect(result.count).toBe(0)
    })
  })
})
