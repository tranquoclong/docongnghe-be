import { Test, TestingModule } from '@nestjs/testing'
import { OrderStatus } from '@prisma/client'
import { OutOfStockSKUException } from 'src/routes/cart/cart.error'
import {
  CannotCancelOrderException,
  NotFoundCartItemException,
  OrderNotFoundException,
  ProductNotFoundException,
  SKUNotBelongToShopException,
} from 'src/routes/order/order.error'
import { OrderProducer } from 'src/routes/order/order.producer'
import { OrderRepo } from 'src/routes/order/order.repo'
import { PaymentStatus } from 'src/shared/constants/payment.constant'
import { isNotFoundPrismaError } from 'src/shared/helpers'
import { PrismaService } from 'src/shared/services/prisma.service'

const mockIsNotFoundPrismaError = isNotFoundPrismaError as jest.MockedFunction<typeof isNotFoundPrismaError>

describe('OrderRepo', () => {
  let repository: OrderRepo
  let mockPrismaService: any
  let mockOrderProducer: any

  // Test data factories
  const createTestData = {
    order: (overrides = {}) => ({
      id: 1,
      userId: 1,
      shopId: 1,
      status: OrderStatus.PENDING_PAYMENT,
      receiver: {
        name: 'John Doe',
        phone: '0123456789',
        address: '123 Street',
      },
      createdAt: new Date('2024-01-01'),
      updatedAt: new Date('2024-01-01'),
      deletedAt: null,
      paymentId: 1,
      items: [],
      ...overrides,
    }),
    orderItem: (overrides = {}) => ({
      id: 1,
      orderId: 1,
      productId: 1,
      productName: 'Test Product',
      skuId: 1,
      skuValue: JSON.stringify({ color: 'red' }),
      skuPrice: 100000,
      quantity: 2,
      image: 'product.jpg',
      productTranslations: [],
      ...overrides,
    }),
    cartItem: (overrides = {}) => ({
      id: 1,
      userId: 1,
      skuId: 1,
      quantity: 2,
      sku: {
        id: 1,
        value: JSON.stringify({ color: 'red' }),
        price: 100000,
        stock: 10,
        image: 'sku.jpg',
        productId: 1,
        createdById: 1,
        product: {
          id: 1,
          name: 'Test Product',
          publishedAt: new Date('2024-01-01'),
          deletedAt: null,
          productTranslations: [],
        },
      },
      ...overrides,
    }),
    payment: (overrides = {}) => ({
      id: 1,
      status: PaymentStatus.PENDING,
      ...overrides,
    }),
    createOrderBody: (overrides = {}) => [
      {
        shopId: 1,
        cartItemIds: [1, 2],
        receiver: {
          name: 'John Doe',
          phone: '0123456789',
          address: '123 Street',
        },
        ...overrides,
      },
    ],
    getOrderListQuery: (overrides = {}) => ({
      page: 1,
      limit: 10,
      status: undefined,
      ...overrides,
    }),
  }

  beforeEach(async () => {
    jest.clearAllMocks()

    mockPrismaService = {
      order: {
        count: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
        findUniqueOrThrow: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      cartItem: {
        findMany: jest.fn(),
        deleteMany: jest.fn(),
      },
      payment: {
        create: jest.fn(),
      },
      sKU: {
        update: jest.fn(),
      },
      $transaction: jest.fn(),
    }

    mockOrderProducer = {
      addCancelPaymentJob: jest.fn(),
    }

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrderRepo,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: OrderProducer, useValue: mockOrderProducer },
      ],
    }).compile()

    repository = module.get<OrderRepo>(OrderRepo)
  })

  describe('list', () => {
    it('should list orders with pagination', async () => {
      // Arrange - Chuẩn bị dữ liệu
      const userId = 1
      const query = createTestData.getOrderListQuery()
      const mockOrders = [createTestData.order()]
      const totalItems = 1

      mockPrismaService.order.count.mockResolvedValue(totalItems)
      mockPrismaService.order.findMany.mockResolvedValue(mockOrders)

      // Act - Thực hiện list
      const result = await repository.list(userId, query)

      // Assert - Kiểm tra kết quả
      expect(result.data).toHaveLength(1)
      expect(result.data[0]).toMatchObject({
        id: 1,
        userId: 1,
        shopId: 1,
        status: OrderStatus.PENDING_PAYMENT,
      })
      expect(result.totalItems).toBe(1)
      expect(result.page).toBe(1)
      expect(result.limit).toBe(10)
      expect(result.totalPages).toBe(1)
      expect(mockPrismaService.order.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ userId }),
          skip: 0,
          take: 10,
        }),
      )
    })

    it('should filter by status when provided', async () => {
      // Arrange - Chuẩn bị dữ liệu với status filter
      const userId = 1
      const query = createTestData.getOrderListQuery({ status: OrderStatus.DELIVERED })

      mockPrismaService.order.count.mockResolvedValue(0)
      mockPrismaService.order.findMany.mockResolvedValue([])

      // Act - Thực hiện list
      await repository.list(userId, query)

      // Assert - Kiểm tra filter status
      expect(mockPrismaService.order.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            userId,
            status: OrderStatus.DELIVERED,
          }),
        }),
      )
    })

    it('should handle pagination correctly', async () => {
      // Arrange - Chuẩn bị dữ liệu cho trang 2
      const userId = 1
      const query = createTestData.getOrderListQuery({ page: 2, limit: 5 })

      mockPrismaService.order.count.mockResolvedValue(12)
      mockPrismaService.order.findMany.mockResolvedValue([])

      // Act - Thực hiện list trang 2
      const result = await repository.list(userId, query)

      // Assert - Kiểm tra pagination
      expect(result.page).toBe(2)
      expect(result.totalPages).toBe(3)
      expect(mockPrismaService.order.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 5,
          take: 5,
        }),
      )
    })
  })

  describe('detail', () => {
    it('should get order detail successfully', async () => {
      // Arrange - Chuẩn bị dữ liệu
      const userId = 1
      const orderId = 1
      const mockOrder = createTestData.order({ items: [createTestData.orderItem()] })

      mockPrismaService.order.findUnique.mockResolvedValue(mockOrder)

      // Act - Thực hiện detail
      const result = await repository.detail(userId, orderId)

      // Assert - Kiểm tra kết quả
      expect(result).toMatchObject({
        id: 1,
        userId: 1,
        shopId: 1,
        status: OrderStatus.PENDING_PAYMENT,
      })
      expect(mockPrismaService.order.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            id: orderId,
            userId,
            deletedAt: null,
          },
        }),
      )
    })

    it('should throw OrderNotFoundException when order not found', async () => {
      // Arrange - Chuẩn bị dữ liệu với order không tồn tại
      const userId = 1
      const orderId = 999

      mockPrismaService.order.findUnique.mockResolvedValue(null)

      // Act & Assert - Kiểm tra lỗi
      await expect(repository.detail(userId, orderId)).rejects.toThrow(OrderNotFoundException)
    })
  })

  describe('fetchAndValidateCartItems', () => {
    it('should fetch and validate cart items successfully', async () => {
      // Arrange - Chuẩn bị dữ liệu
      const userId = 1
      const body = createTestData.createOrderBody()
      const mockCartItems = [
        createTestData.cartItem({
          id: 1,
          sku: {
            ...createTestData.cartItem().sku,
            product: {
              ...createTestData.cartItem().sku.product,
              productTranslations: [
                {
                  id: 1,
                  name: 'Product Name',
                  description: 'Product Description',
                  languageId: 'vi',
                },
              ],
            },
          },
        }),
        createTestData.cartItem({ id: 2 }),
      ]

      mockPrismaService.cartItem.findMany.mockResolvedValue(mockCartItems)

      // Act - Thực hiện fetchAndValidateCartItems
      const result = await repository.fetchAndValidateCartItems(userId, body)

      // Assert - Kiểm tra kết quả
      expect(result.cartItems).toHaveLength(2)
      expect(result.cartItemMap.size).toBe(2)
      expect(mockPrismaService.cartItem.findMany).toHaveBeenCalled()
    })

    it('should throw NotFoundCartItemException when cart items not found', async () => {
      // Arrange - Chuẩn bị dữ liệu với cart items không đủ
      const userId = 1
      const body = createTestData.createOrderBody()

      mockPrismaService.cartItem.findMany.mockResolvedValue([createTestData.cartItem({ id: 1 })])

      // Act & Assert - Kiểm tra lỗi
      await expect(repository.fetchAndValidateCartItems(userId, body)).rejects.toThrow(NotFoundCartItemException)
    })

    it('should throw OutOfStockSKUException when SKU out of stock', async () => {
      // Arrange - Chuẩn bị dữ liệu với SKU hết hàng
      const userId = 1
      const body = createTestData.createOrderBody()
      const mockCartItems = [
        createTestData.cartItem({ id: 1, quantity: 20, sku: { ...createTestData.cartItem().sku, stock: 5 } }),
        createTestData.cartItem({ id: 2 }),
      ]

      mockPrismaService.cartItem.findMany.mockResolvedValue(mockCartItems)

      // Act & Assert - Kiểm tra lỗi
      await expect(repository.fetchAndValidateCartItems(userId, body)).rejects.toThrow(OutOfStockSKUException)
    })

    it('should throw ProductNotFoundException when product is deleted', async () => {
      // Arrange - Chuẩn bị dữ liệu với product bị xóa
      const userId = 1
      const body = createTestData.createOrderBody()
      const mockCartItems = [
        createTestData.cartItem({
          id: 1,
          sku: {
            ...createTestData.cartItem().sku,
            product: {
              ...createTestData.cartItem().sku.product,
              deletedAt: new Date(),
            },
          },
        }),
        createTestData.cartItem({ id: 2 }),
      ]

      mockPrismaService.cartItem.findMany.mockResolvedValue(mockCartItems)

      // Act & Assert - Kiểm tra lỗi
      await expect(repository.fetchAndValidateCartItems(userId, body)).rejects.toThrow(ProductNotFoundException)
    })

    it('should throw ProductNotFoundException when product is not published', async () => {
      // Arrange - Chuẩn bị dữ liệu với product chưa publish
      const userId = 1
      const body = createTestData.createOrderBody()
      const mockCartItems = [
        createTestData.cartItem({
          id: 1,
          sku: {
            ...createTestData.cartItem().sku,
            product: {
              ...createTestData.cartItem().sku.product,
              publishedAt: null,
            },
          },
        }),
        createTestData.cartItem({ id: 2 }),
      ]

      mockPrismaService.cartItem.findMany.mockResolvedValue(mockCartItems)

      // Act & Assert - Kiểm tra lỗi
      await expect(repository.fetchAndValidateCartItems(userId, body)).rejects.toThrow(ProductNotFoundException)
    })

    it('should throw ProductNotFoundException when product publish date is in future', async () => {
      // Arrange - Chuẩn bị dữ liệu với product publish date trong tương lai
      const userId = 1
      const body = createTestData.createOrderBody()
      const futureDate = new Date()
      futureDate.setDate(futureDate.getDate() + 10)
      const mockCartItems = [
        createTestData.cartItem({
          id: 1,
          sku: {
            ...createTestData.cartItem().sku,
            product: {
              ...createTestData.cartItem().sku.product,
              publishedAt: futureDate,
            },
          },
        }),
        createTestData.cartItem({ id: 2 }),
      ]

      mockPrismaService.cartItem.findMany.mockResolvedValue(mockCartItems)

      // Act & Assert - Kiểm tra lỗi
      await expect(repository.fetchAndValidateCartItems(userId, body)).rejects.toThrow(ProductNotFoundException)
    })

    it('should throw SKUNotBelongToShopException when SKU does not belong to shop', async () => {
      // Arrange - Chuẩn bị dữ liệu với SKU không thuộc shop
      const userId = 1
      const body = createTestData.createOrderBody({ shopId: 999 })
      const mockCartItems = [createTestData.cartItem({ id: 1 }), createTestData.cartItem({ id: 2 })]

      mockPrismaService.cartItem.findMany.mockResolvedValue(mockCartItems)

      // Act & Assert - Kiểm tra lỗi
      await expect(repository.fetchAndValidateCartItems(userId, body)).rejects.toThrow(SKUNotBelongToShopException)
    })

    it('should throw NotFoundCartItemException when cartItemId not in map during shop validation', async () => {
      // Arrange - cartItemIds includes an ID that DB returns but map lookup fails
      // This tests the defensive !cartItem check in validateShopOwnership (line 264)
      const userId = 1
      // Body references cartItemId 3 which won't be in the map
      const body = createTestData.createOrderBody({ cartItemIds: [1, 3] })
      // DB returns both items (length matches), but cartItem id=3 maps differently
      const mockCartItems = [createTestData.cartItem({ id: 1 }), createTestData.cartItem({ id: 2 })]

      mockPrismaService.cartItem.findMany.mockResolvedValue(mockCartItems)

      // Act & Assert - cartItemId 3 not in map triggers NotFoundCartItemException
      await expect(repository.fetchAndValidateCartItems(userId, body)).rejects.toThrow(NotFoundCartItemException)
    })
  })

  describe('create', () => {
    it('should create order successfully with pre-calculated data', async () => {
      // Arrange - Chuẩn bị dữ liệu
      const userId = 1
      const body = createTestData.createOrderBody()
      const mockCartItems = [
        createTestData.cartItem({
          id: 1,
          sku: {
            ...createTestData.cartItem().sku,
            product: {
              ...createTestData.cartItem().sku.product,
              productTranslations: [
                {
                  id: 1,
                  name: 'Product Name',
                  description: 'Product Description',
                  languageId: 'vi',
                },
              ],
            },
          },
        }),
        createTestData.cartItem({ id: 2 }),
      ]
      const ordersWithCalculations = [
        {
          item: body[0],
          totalAmount: 200000,
          discountAmount: 0,
          voucherId: null,
        },
      ]
      const mockPayment = createTestData.payment()
      const mockOrders = [createTestData.order()]

      mockPrismaService.$transaction.mockImplementation(async (callback) => {
        const tx = {
          payment: {
            create: jest.fn().mockResolvedValue(mockPayment),
          },
          order: {
            create: jest.fn().mockResolvedValue(mockOrders[0]),
          },
          cartItem: {
            deleteMany: jest.fn().mockResolvedValue({ count: 2 }),
          },
          sKU: {
            update: jest.fn().mockResolvedValue({}),
          },
          voucher: {
            update: jest.fn().mockResolvedValue({}),
          },
          userVoucher: {
            updateMany: jest.fn().mockResolvedValue({ count: 1 }),
          },
          $executeRaw: jest.fn().mockResolvedValue(1),
        }
        mockOrderProducer.addCancelPaymentJob.mockResolvedValue(undefined)
        return callback(tx)
      })

      // Act - Thực hiện create
      const result = await repository.create(userId, body, mockCartItems, ordersWithCalculations)

      // Assert - Kiểm tra kết quả
      expect(result.paymentId).toBe(mockPayment.id)
      expect(result.orders).toHaveLength(1)
      expect(mockPrismaService.$transaction).toHaveBeenCalled()
    })

    it('should throw OutOfStockSKUException when $executeRaw returns 0 (concurrent stock depletion)', async () => {
      // Arrange - SKU stock depleted between validation and update
      const userId = 1
      const body = createTestData.createOrderBody()
      const mockCartItems = [
        createTestData.cartItem({
          id: 1,
          sku: {
            ...createTestData.cartItem().sku,
            product: {
              ...createTestData.cartItem().sku.product,
              productTranslations: [],
            },
          },
        }),
        createTestData.cartItem({ id: 2 }),
      ]
      const ordersWithCalculations = [
        {
          item: body[0],
          totalAmount: 200000,
          discountAmount: 0,
          voucherId: null,
        },
      ]

      mockPrismaService.$transaction.mockImplementation(async (callback) => {
        const tx = {
          payment: {
            create: jest.fn().mockResolvedValue(createTestData.payment()),
          },
          order: {
            create: jest.fn().mockResolvedValue(createTestData.order()),
          },
          cartItem: {
            deleteMany: jest.fn().mockResolvedValue({ count: 2 }),
          },
          voucher: {
            update: jest.fn().mockResolvedValue({}),
          },
          userVoucher: {
            updateMany: jest.fn().mockResolvedValue({ count: 1 }),
          },
          $executeRaw: jest.fn().mockResolvedValue(0), // No rows updated = out of stock
        }
        mockOrderProducer.addCancelPaymentJob.mockResolvedValue(undefined)
        return callback(tx)
      })

      // Act & Assert
      await expect(repository.create(userId, body, mockCartItems, ordersWithCalculations)).rejects.toThrow(
        OutOfStockSKUException,
      )
    })

    it('should throw NotFoundCartItemException when cartItemId missing from map in buildOrderCreateData', async () => {
      // Arrange - body references cartItemId 99 which is not in the cartItems array
      const userId = 1
      const body = createTestData.createOrderBody({ cartItemIds: [1, 99] })
      const mockCartItems = [createTestData.cartItem({ id: 1 })]
      const ordersWithCalculations = [
        {
          item: body[0],
          totalAmount: 200000,
          discountAmount: 0,
          voucherId: null,
        },
      ]

      mockPrismaService.$transaction.mockImplementation(async (callback) => {
        const tx = {
          payment: {
            create: jest.fn().mockResolvedValue(createTestData.payment()),
          },
          order: {
            create: jest.fn().mockImplementation(({ data }) => {
              // Force evaluation of the items.create array which triggers buildOrderCreateData
              if (data.items?.create) {
                data.items.create.forEach(() => {})
              }
              return createTestData.order()
            }),
          },
          cartItem: {
            deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
          },
          voucher: {
            update: jest.fn().mockResolvedValue({}),
          },
          userVoucher: {
            updateMany: jest.fn().mockResolvedValue({ count: 1 }),
          },
          $executeRaw: jest.fn().mockResolvedValue(1),
        }
        mockOrderProducer.addCancelPaymentJob.mockResolvedValue(undefined)
        return callback(tx)
      })

      // Act & Assert - cartItemId 99 not in map triggers NotFoundCartItemException
      await expect(repository.create(userId, body, mockCartItems, ordersWithCalculations)).rejects.toThrow(
        NotFoundCartItemException,
      )
    })

    it('should create order with voucher discount', async () => {
      // Arrange - Chuẩn bị dữ liệu với voucher
      const userId = 1
      const voucherId = 1
      const body = createTestData.createOrderBody({ voucherId })
      const mockCartItems = [
        createTestData.cartItem({
          id: 1,
          sku: {
            ...createTestData.cartItem().sku,
            price: 100000,
            product: {
              ...createTestData.cartItem().sku.product,
              productTranslations: [
                {
                  id: 1,
                  name: 'Product Name',
                  description: 'Product Description',
                  languageId: 'vi',
                },
              ],
            },
          },
          quantity: 2,
        }),
        createTestData.cartItem({ id: 2, quantity: 1 }),
      ]
      const ordersWithCalculations = [
        {
          item: body[0],
          totalAmount: 270000, // 300000 - 30000 (10% discount)
          discountAmount: 30000,
          voucherId: 1,
        },
      ]
      const mockPayment = createTestData.payment()
      const mockOrders = [createTestData.order()]

      mockPrismaService.$transaction.mockImplementation(async (callback) => {
        const tx = {
          payment: {
            create: jest.fn().mockResolvedValue(mockPayment),
          },
          order: {
            create: jest.fn().mockResolvedValue(mockOrders[0]),
          },
          cartItem: {
            deleteMany: jest.fn().mockResolvedValue({ count: 2 }),
          },
          sKU: {
            update: jest.fn().mockResolvedValue({}),
          },
          voucher: {
            update: jest.fn().mockResolvedValue({}),
          },
          userVoucher: {
            updateMany: jest.fn().mockResolvedValue({ count: 1 }),
          },
          $executeRaw: jest.fn().mockResolvedValue(1),
        }
        mockOrderProducer.addCancelPaymentJob.mockResolvedValue(undefined)
        return callback(tx)
      })

      // Act - Thực hiện create với voucher
      const result = await repository.create(userId, body, mockCartItems, ordersWithCalculations)

      // Assert - Kiểm tra kết quả
      expect(result.paymentId).toBe(mockPayment.id)
    })
  })

  describe('cancel', () => {
    it('should cancel order successfully', async () => {
      // Arrange - Chuẩn bị dữ liệu
      const userId = 1
      const orderId = 1
      const mockOrder = createTestData.order({ status: OrderStatus.PENDING_PAYMENT })
      const mockUpdatedOrder = createTestData.order({ status: OrderStatus.CANCELLED })

      mockPrismaService.order.findUniqueOrThrow.mockResolvedValue(mockOrder)
      mockPrismaService.order.update.mockResolvedValue(mockUpdatedOrder)

      // Act - Thực hiện cancel
      const result = await repository.cancel(userId, orderId)

      // Assert - Kiểm tra kết quả
      expect(result.status).toBe(OrderStatus.CANCELLED)
      expect(mockPrismaService.order.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            id: orderId,
            userId,
            deletedAt: null,
          },
          data: {
            status: OrderStatus.CANCELLED,
            updatedById: userId,
          },
        }),
      )
    })

    it('should throw CannotCancelOrderException when order status is not PENDING_PAYMENT', async () => {
      // Arrange - Chuẩn bị dữ liệu với order status không phải PENDING_PAYMENT
      const userId = 1
      const orderId = 1
      const mockOrder = createTestData.order({ status: OrderStatus.DELIVERED })

      mockPrismaService.order.findUniqueOrThrow.mockResolvedValue(mockOrder)

      // Act & Assert - Kiểm tra lỗi
      await expect(repository.cancel(userId, orderId)).rejects.toThrow(CannotCancelOrderException)
    })

    it('should throw OrderNotFoundException when order not found', async () => {
      // Arrange - Chuẩn bị dữ liệu với order không tồn tại
      const userId = 1
      const orderId = 999
      const prismaError = new Error('Not found') as any
      prismaError.code = 'P2025'

      mockPrismaService.order.findUniqueOrThrow.mockRejectedValue(prismaError)
      mockIsNotFoundPrismaError.mockReturnValue(true)

      // Act & Assert - Kiểm tra lỗi
      await expect(repository.cancel(userId, orderId)).rejects.toThrow(OrderNotFoundException)
    })

    it('should re-throw non-Prisma errors', async () => {
      // Arrange
      const userId = 1
      const orderId = 1
      const genericError = new Error('Database connection lost')

      mockPrismaService.order.findUniqueOrThrow.mockRejectedValue(genericError)
      mockIsNotFoundPrismaError.mockReturnValue(false)

      // Act & Assert
      await expect(repository.cancel(userId, orderId)).rejects.toThrow('Database connection lost')
    })
  })
})
