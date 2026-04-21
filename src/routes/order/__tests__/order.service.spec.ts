import { Test, TestingModule } from '@nestjs/testing'
import { OrderService } from '../order.service'
import { OrderRepo, CartItemWithRelations } from '../order.repo'
import { CreateOrderBodyType, GetOrderListQueryType } from '../order.model'
import { OrderStatus } from 'src/shared/constants/order.constant'
import { VoucherRepository } from 'src/routes/voucher/voucher.repo'

// Test data factory để tạo dữ liệu test
const createTestData = {
  orderListQuery: (overrides = {}): GetOrderListQueryType => ({
    page: 1,
    limit: 10,
    ...overrides,
  }),

  createOrderBody: (overrides = {}): CreateOrderBodyType => [
    {
      shopId: 1,
      receiver: {
        name: 'Nguyễn Văn A',
        phone: '0123456789',
        address: '123 Đường ABC, Quận 1, TP.HCM',
      },
      cartItemIds: [1, 2],
      ...overrides,
    },
  ],

  order: (overrides = {}) => ({
    id: 1,
    userId: 1,
    shopId: 1,
    status: OrderStatus.PENDING_PAYMENT,
    totalAmount: 100000,
    receiver: {
      name: 'Nguyễn Văn A',
      phone: '0123456789',
      address: '123 Đường ABC, Quận 1, TP.HCM',
    },
    paymentId: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }),

  orderListResponse: (overrides = {}) => ({
    data: [
      {
        id: 1,
        userId: 1,
        shopId: 1,
        status: OrderStatus.PENDING_PAYMENT,
        totalAmount: 100000,
        paymentId: 1,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        items: [
          {
            id: 1,
            productId: 1,
            productName: 'Test Product',
            productTranslations: [
              {
                id: 1,
                name: 'Test Product',
                description: 'Test Description',
                languageId: 'vi',
              },
            ],
            skuPrice: 50000,
            image: 'test-image.jpg',
            skuValue: 'Size: M, Color: Red',
            skuId: 1,
            orderId: 1,
            quantity: 2,
            createdAt: new Date().toISOString(),
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

  createOrderResponse: (overrides = {}) => ({
    paymentId: 1,
    orders: [
      {
        id: 1,
        userId: 1,
        shopId: 1,
        status: OrderStatus.PENDING_PAYMENT,
        totalAmount: 100000,
        receiver: {
          name: 'Nguyễn Văn A',
          phone: '0123456789',
          address: '123 Đường ABC, Quận 1, TP.HCM',
        },
        paymentId: 1,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        createdById: null,
        updatedById: null,
        deletedById: null,
        deletedAt: null,
      },
    ],
    ...overrides,
  }),

  orderDetail: (overrides = {}) => ({
    id: 1,
    userId: 1,
    shopId: 1,
    status: OrderStatus.PENDING_PAYMENT,
    totalAmount: 100000,
    receiver: {
      name: 'Nguyễn Văn A',
      phone: '0123456789',
      address: '123 Đường ABC, Quận 1, TP.HCM',
    },
    paymentId: 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    createdById: null,
    updatedById: null,
    deletedById: null,
    deletedAt: null,
    items: [
      {
        id: 1,
        productId: 1,
        productName: 'Test Product',
        productTranslations: [
          {
            id: 1,
            name: 'Test Product',
            description: 'Test Description',
            languageId: 'vi',
          },
        ],
        skuPrice: 50000,
        image: 'test-image.jpg',
        skuValue: 'Size: M, Color: Red',
        skuId: 1,
        orderId: 1,
        quantity: 2,
        createdAt: new Date().toISOString(),
      },
    ],
    ...overrides,
  }),

  cancelOrderResponse: (overrides = {}) => ({
    id: 1,
    userId: 1,
    shopId: 1,
    status: OrderStatus.CANCELLED,
    totalAmount: 100000,
    receiver: {
      name: 'Nguyễn Văn A',
      phone: '0123456789',
      address: '123 Đường ABC, Quận 1, TP.HCM',
    },
    paymentId: 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    createdById: null,
    updatedById: null,
    deletedById: null,
    deletedAt: null,
    ...overrides,
  }),
}

describe('OrderService', () => {
  let service: OrderService
  let module: TestingModule
  let mockOrderRepo: jest.Mocked<OrderRepo>
  let mockVoucherRepository: jest.Mocked<VoucherRepository>

  // Helper to create cart items for testing
  const createMockCartItems = (overrides: any[] = []): CartItemWithRelations[] => {
    const defaultCartItem: CartItemWithRelations = {
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
    }
    if (overrides.length === 0) {
      return [defaultCartItem, { ...defaultCartItem, id: 2 }]
    }
    return overrides.map((override, index) => ({
      ...defaultCartItem,
      id: index + 1,
      ...override,
    }))
  }

  beforeEach(async () => {
    // Tạo mock cho OrderRepo với tất cả methods cần thiết
    mockOrderRepo = {
      list: jest.fn(),
      create: jest.fn(),
      cancel: jest.fn(),
      detail: jest.fn(),
      fetchAndValidateCartItems: jest.fn(),
    } as any

    mockVoucherRepository = {
      findById: jest.fn(),
    } as any

    module = await Test.createTestingModule({
      providers: [
        OrderService,
        { provide: OrderRepo, useValue: mockOrderRepo },
        { provide: VoucherRepository, useValue: mockVoucherRepository },
      ],
    }).compile()

    service = module.get<OrderService>(OrderService)
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
    it('should get order list successfully', async () => {
      // Arrange - Chuẩn bị dữ liệu test
      const userId = 1
      const query = createTestData.orderListQuery({
        page: 1,
        limit: 10,
      })
      const mockOrderListResponse = createTestData.orderListResponse()

      mockOrderRepo.list.mockResolvedValue(mockOrderListResponse)

      // Act - Thực hiện lấy danh sách orders
      const result = await service.list(userId, query)

      // Assert - Kiểm tra kết quả
      expect(result).toEqual(mockOrderListResponse)
      expect(mockOrderRepo.list).toHaveBeenCalledWith(userId, query)
      expect(mockOrderRepo.list).toHaveBeenCalledTimes(1)
    })

    it('should handle order list with status filter', async () => {
      // Arrange - Chuẩn bị dữ liệu test với filter status
      const userId = 1
      const query = createTestData.orderListQuery({
        page: 1,
        limit: 10,
        status: OrderStatus.DELIVERED,
      })
      const mockOrderListResponse = createTestData.orderListResponse({
        data: [
          {
            ...createTestData.orderListResponse().data[0],
            status: OrderStatus.DELIVERED,
          },
        ],
      })

      mockOrderRepo.list.mockResolvedValue(mockOrderListResponse)

      // Act - Thực hiện lấy danh sách orders
      const result = await service.list(userId, query)

      // Assert - Kiểm tra kết quả
      expect(result).toEqual(mockOrderListResponse)
      expect(result.data[0].status).toBe(OrderStatus.DELIVERED)
      expect(mockOrderRepo.list).toHaveBeenCalledWith(userId, query)
    })

    it('should handle different pagination parameters', async () => {
      // Arrange - Chuẩn bị dữ liệu test với pagination khác
      const userId = 2
      const query = createTestData.orderListQuery({
        page: 2,
        limit: 5,
      })
      const mockOrderListResponse = createTestData.orderListResponse({
        page: 2,
        limit: 5,
        totalPages: 3,
      })

      mockOrderRepo.list.mockResolvedValue(mockOrderListResponse)

      // Act - Thực hiện lấy danh sách orders
      const result = await service.list(userId, query)

      // Assert - Kiểm tra kết quả
      expect(result).toEqual(mockOrderListResponse)
      expect(result.page).toBe(2)
      expect(result.limit).toBe(5)
      expect(mockOrderRepo.list).toHaveBeenCalledWith(userId, query)
    })

    it('should handle empty order list', async () => {
      // Arrange - Chuẩn bị dữ liệu order list trống
      const userId = 1
      const query = createTestData.orderListQuery()
      const emptyOrderListResponse = createTestData.orderListResponse({
        data: [],
        totalItems: 0,
        totalPages: 0,
      })

      mockOrderRepo.list.mockResolvedValue(emptyOrderListResponse)

      // Act - Thực hiện lấy danh sách orders
      const result = await service.list(userId, query)

      // Assert - Kiểm tra kết quả
      expect(result).toEqual(emptyOrderListResponse)
      expect(result.data).toHaveLength(0)
      expect(result.totalItems).toBe(0)
    })
  })

  describe('create', () => {
    it('should create order successfully', async () => {
      // Arrange - Chuẩn bị dữ liệu tạo order
      const userId = 1
      const body = createTestData.createOrderBody()
      const mockCartItems = createMockCartItems()
      const mockCartItemMap = new Map<number, CartItemWithRelations>()
      mockCartItems.forEach((item) => mockCartItemMap.set(item.id, item))
      const mockCreateOrderResponse = createTestData.createOrderResponse()

      mockOrderRepo.fetchAndValidateCartItems.mockResolvedValue({
        cartItems: mockCartItems,
        cartItemMap: mockCartItemMap,
      })
      mockOrderRepo.create.mockResolvedValue(mockCreateOrderResponse)

      // Act - Thực hiện tạo order
      const result = await service.create(userId, body)

      // Assert - Kiểm tra kết quả
      expect(result).toEqual(mockCreateOrderResponse)
      expect(mockOrderRepo.fetchAndValidateCartItems).toHaveBeenCalledWith(userId, body)
      expect(mockOrderRepo.create).toHaveBeenCalledTimes(1)
    })

    it('should create order with multiple shops', async () => {
      // Arrange - Chuẩn bị dữ liệu tạo order với nhiều shop
      const userId = 1
      const body: CreateOrderBodyType = [
        {
          shopId: 1,
          receiver: {
            name: 'Nguyễn Văn A',
            phone: '0123456789',
            address: '123 Đường ABC, Quận 1, TP.HCM',
          },
          cartItemIds: [1, 2],
        },
        {
          shopId: 2,
          receiver: {
            name: 'Nguyễn Văn A',
            phone: '0123456789',
            address: '123 Đường ABC, Quận 1, TP.HCM',
          },
          cartItemIds: [3, 4],
        },
      ]
      const mockCartItems = createMockCartItems([{}, {}, {}, {}])
      const mockCartItemMap = new Map<number, CartItemWithRelations>()
      mockCartItems.forEach((item) => mockCartItemMap.set(item.id, item))
      const mockCreateOrderResponse = createTestData.createOrderResponse({
        orders: [
          createTestData.createOrderResponse().orders[0],
          {
            ...createTestData.createOrderResponse().orders[0],
            id: 2,
            shopId: 2,
          },
        ],
      })

      mockOrderRepo.fetchAndValidateCartItems.mockResolvedValue({
        cartItems: mockCartItems,
        cartItemMap: mockCartItemMap,
      })
      mockOrderRepo.create.mockResolvedValue(mockCreateOrderResponse)

      // Act - Thực hiện tạo order
      const result = await service.create(userId, body)

      // Assert - Kiểm tra kết quả
      expect(result).toEqual(mockCreateOrderResponse)
      expect(result.orders).toHaveLength(2)
      expect(result.orders[0].shopId).toBe(1)
      expect(result.orders[1].shopId).toBe(2)
      expect(mockOrderRepo.fetchAndValidateCartItems).toHaveBeenCalledWith(userId, body)
    })

    it('should apply PERCENTAGE voucher correctly', async () => {
      // Arrange - Chuẩn bị dữ liệu với voucher PERCENTAGE
      const userId = 1
      const voucherId = 1
      const body: CreateOrderBodyType = [
        {
          shopId: 1,
          receiver: {
            name: 'Nguyễn Văn A',
            phone: '0123456789',
            address: '123 Đường ABC, Quận 1, TP.HCM',
          },
          cartItemIds: [1, 2],
          voucherId,
        },
      ]
      const mockCartItems = createMockCartItems([{ quantity: 2 }, { quantity: 1 }])
      const mockCartItemMap = new Map<number, CartItemWithRelations>()
      mockCartItems.forEach((item) => mockCartItemMap.set(item.id, item))
      const mockVoucher = {
        id: 1,
        type: 'PERCENTAGE',
        value: 10, // 10% discount
        maxDiscount: null,
      }
      const mockCreateOrderResponse = createTestData.createOrderResponse()

      mockOrderRepo.fetchAndValidateCartItems.mockResolvedValue({
        cartItems: mockCartItems,
        cartItemMap: mockCartItemMap,
      })
      mockVoucherRepository.findById.mockResolvedValue(mockVoucher as any)
      mockOrderRepo.create.mockResolvedValue(mockCreateOrderResponse)

      // Act - Thực hiện tạo order với voucher
      const result = await service.create(userId, body)

      // Assert - Kiểm tra kết quả
      expect(result).toEqual(mockCreateOrderResponse)
      expect(mockVoucherRepository.findById).toHaveBeenCalledWith(voucherId)
      // Verify that create was called with calculated discount
      expect(mockOrderRepo.create).toHaveBeenCalledWith(
        userId,
        body,
        mockCartItems,
        expect.arrayContaining([
          expect.objectContaining({
            voucherId: 1,
            discountAmount: expect.any(Number),
          }),
        ]),
      )
    })

    it('should apply PERCENTAGE voucher with maxDiscount cap', async () => {
      // Arrange - Chuẩn bị dữ liệu với voucher PERCENTAGE có maxDiscount
      const userId = 1
      const voucherId = 1
      const body: CreateOrderBodyType = [
        {
          shopId: 1,
          receiver: {
            name: 'Nguyễn Văn A',
            phone: '0123456789',
            address: '123 Đường ABC, Quận 1, TP.HCM',
          },
          cartItemIds: [1, 2],
          voucherId,
        },
      ]
      const mockCartItems = createMockCartItems([
        { sku: { ...createMockCartItems()[0].sku, price: 1000000 }, quantity: 2 },
        { quantity: 1 },
      ])
      const mockCartItemMap = new Map<number, CartItemWithRelations>()
      mockCartItems.forEach((item) => mockCartItemMap.set(item.id, item))
      const mockVoucher = {
        id: 1,
        type: 'PERCENTAGE',
        value: 50, // 50% discount
        maxDiscount: 100000, // Max 100k
      }
      const mockCreateOrderResponse = createTestData.createOrderResponse()

      mockOrderRepo.fetchAndValidateCartItems.mockResolvedValue({
        cartItems: mockCartItems,
        cartItemMap: mockCartItemMap,
      })
      mockVoucherRepository.findById.mockResolvedValue(mockVoucher as any)
      mockOrderRepo.create.mockResolvedValue(mockCreateOrderResponse)

      // Act - Thực hiện tạo order với voucher có maxDiscount
      const result = await service.create(userId, body)

      // Assert - Kiểm tra kết quả
      expect(result).toEqual(mockCreateOrderResponse)
      expect(mockVoucherRepository.findById).toHaveBeenCalledWith(voucherId)
      // Verify discount is capped at maxDiscount
      expect(mockOrderRepo.create).toHaveBeenCalledWith(
        userId,
        body,
        mockCartItems,
        expect.arrayContaining([
          expect.objectContaining({
            voucherId: 1,
            discountAmount: 100000, // Should be capped at maxDiscount
          }),
        ]),
      )
    })

    it('should apply FIXED_AMOUNT voucher correctly', async () => {
      // Arrange - Chuẩn bị dữ liệu với voucher FIXED_AMOUNT
      const userId = 1
      const voucherId = 1
      const body: CreateOrderBodyType = [
        {
          shopId: 1,
          receiver: {
            name: 'Nguyễn Văn A',
            phone: '0123456789',
            address: '123 Đường ABC, Quận 1, TP.HCM',
          },
          cartItemIds: [1, 2],
          voucherId,
        },
      ]
      const mockCartItems = createMockCartItems([{ quantity: 2 }, { quantity: 1 }])
      const mockCartItemMap = new Map<number, CartItemWithRelations>()
      mockCartItems.forEach((item) => mockCartItemMap.set(item.id, item))
      const mockVoucher = {
        id: 1,
        type: 'FIXED_AMOUNT',
        value: 50000, // Giảm 50k
      }
      const mockCreateOrderResponse = createTestData.createOrderResponse()

      mockOrderRepo.fetchAndValidateCartItems.mockResolvedValue({
        cartItems: mockCartItems,
        cartItemMap: mockCartItemMap,
      })
      mockVoucherRepository.findById.mockResolvedValue(mockVoucher as any)
      mockOrderRepo.create.mockResolvedValue(mockCreateOrderResponse)

      // Act - Thực hiện tạo order với voucher FIXED_AMOUNT
      const result = await service.create(userId, body)

      // Assert - Kiểm tra kết quả
      expect(result).toEqual(mockCreateOrderResponse)
      expect(mockVoucherRepository.findById).toHaveBeenCalledWith(voucherId)
      expect(mockOrderRepo.create).toHaveBeenCalledWith(
        userId,
        body,
        mockCartItems,
        expect.arrayContaining([
          expect.objectContaining({
            voucherId: 1,
            discountAmount: 50000,
          }),
        ]),
      )
    })

    it('should handle voucher not found gracefully', async () => {
      // Arrange - Chuẩn bị dữ liệu với voucher không tồn tại
      const userId = 1
      const voucherId = 999
      const body: CreateOrderBodyType = [
        {
          shopId: 1,
          receiver: {
            name: 'Nguyễn Văn A',
            phone: '0123456789',
            address: '123 Đường ABC, Quận 1, TP.HCM',
          },
          cartItemIds: [1, 2],
          voucherId,
        },
      ]
      const mockCartItems = createMockCartItems()
      const mockCartItemMap = new Map<number, CartItemWithRelations>()
      mockCartItems.forEach((item) => mockCartItemMap.set(item.id, item))
      const mockCreateOrderResponse = createTestData.createOrderResponse()

      mockOrderRepo.fetchAndValidateCartItems.mockResolvedValue({
        cartItems: mockCartItems,
        cartItemMap: mockCartItemMap,
      })
      mockVoucherRepository.findById.mockResolvedValue(null) // Voucher không tồn tại
      mockOrderRepo.create.mockResolvedValue(mockCreateOrderResponse)

      // Act - Thực hiện tạo order với voucher không tồn tại
      const result = await service.create(userId, body)

      // Assert - Kiểm tra kết quả (không apply voucher, không throw error)
      expect(result).toEqual(mockCreateOrderResponse)
      expect(mockVoucherRepository.findById).toHaveBeenCalledWith(voucherId)
      // Verify discount is 0 when voucher not found
      expect(mockOrderRepo.create).toHaveBeenCalledWith(
        userId,
        body,
        mockCartItems,
        expect.arrayContaining([
          expect.objectContaining({
            voucherId: 999,
            discountAmount: 0,
          }),
        ]),
      )
    })
  })

  describe('cancel', () => {
    it('should cancel order successfully', async () => {
      // Arrange - Chuẩn bị dữ liệu hủy order
      const userId = 1
      const orderId = 1
      const mockCancelOrderResponse = createTestData.cancelOrderResponse()

      mockOrderRepo.cancel.mockResolvedValue(mockCancelOrderResponse)

      // Act - Thực hiện hủy order
      const result = await service.cancel(userId, orderId)

      // Assert - Kiểm tra kết quả
      expect(result).toEqual(mockCancelOrderResponse)
      expect(result.status).toBe(OrderStatus.CANCELLED)
      expect(mockOrderRepo.cancel).toHaveBeenCalledWith(userId, orderId)
      expect(mockOrderRepo.cancel).toHaveBeenCalledTimes(1)
    })

    it('should handle cancel different orders', async () => {
      // Arrange - Chuẩn bị dữ liệu hủy order khác
      const userId = 2
      const orderId = 5
      const mockCancelOrderResponse = createTestData.cancelOrderResponse({
        id: 5,
        userId: 2,
      })

      mockOrderRepo.cancel.mockResolvedValue(mockCancelOrderResponse)

      // Act - Thực hiện hủy order
      const result = await service.cancel(userId, orderId)

      // Assert - Kiểm tra kết quả
      expect(result).toEqual(mockCancelOrderResponse)
      expect(result.id).toBe(5)
      expect(result.userId).toBe(2)
      expect(mockOrderRepo.cancel).toHaveBeenCalledWith(userId, orderId)
    })

    it('should handle cancel order with different user', async () => {
      // Arrange - Chuẩn bị dữ liệu hủy order với user khác
      const userId = 3
      const orderId = 1
      const mockCancelOrderResponse = createTestData.cancelOrderResponse({
        userId: 3,
      })

      mockOrderRepo.cancel.mockResolvedValue(mockCancelOrderResponse)

      // Act - Thực hiện hủy order
      const result = await service.cancel(userId, orderId)

      // Assert - Kiểm tra kết quả
      expect(result).toEqual(mockCancelOrderResponse)
      expect(result.userId).toBe(3)
      expect(mockOrderRepo.cancel).toHaveBeenCalledWith(userId, orderId)
    })
  })

  describe('detail', () => {
    it('should get order detail successfully', async () => {
      // Arrange - Chuẩn bị dữ liệu lấy chi tiết order
      const userId = 1
      const orderId = 1
      const mockOrderDetail = createTestData.orderDetail()

      mockOrderRepo.detail.mockResolvedValue(mockOrderDetail)

      // Act - Thực hiện lấy chi tiết order
      const result = await service.detail(userId, orderId)

      // Assert - Kiểm tra kết quả
      expect(result).toEqual(mockOrderDetail)
      expect(result.id).toBe(orderId)
      expect(result.userId).toBe(userId)
      expect(result.items).toBeDefined()
      expect(result.items).toHaveLength(1)
      expect(mockOrderRepo.detail).toHaveBeenCalledWith(userId, orderId)
      expect(mockOrderRepo.detail).toHaveBeenCalledTimes(1)
    })

    it('should handle different order details', async () => {
      // Arrange - Chuẩn bị dữ liệu lấy chi tiết order khác
      const userId = 2
      const orderId = 3
      const mockOrderDetail = createTestData.orderDetail({
        id: 3,
        userId: 2,
        status: OrderStatus.DELIVERED,
        totalAmount: 200000,
      })

      mockOrderRepo.detail.mockResolvedValue(mockOrderDetail)

      // Act - Thực hiện lấy chi tiết order
      const result = await service.detail(userId, orderId)

      // Assert - Kiểm tra kết quả
      expect(result).toEqual(mockOrderDetail)
      expect(result.id).toBe(3)
      expect(result.userId).toBe(2)
      expect(result.status).toBe(OrderStatus.DELIVERED)
      // expect(result.totalAmount).toBe(200000) // totalAmount not in response type
      expect(mockOrderRepo.detail).toHaveBeenCalledWith(userId, orderId)
    })

    it('should handle order detail with multiple items', async () => {
      // Arrange - Chuẩn bị dữ liệu order có nhiều items
      const userId = 1
      const orderId = 1
      const mockOrderDetail = createTestData.orderDetail({
        items: [
          createTestData.orderDetail().items[0],
          {
            ...createTestData.orderDetail().items[0],
            id: 2,
            productName: 'Test Product 2',
            skuPrice: 75000,
            quantity: 1,
          },
        ],
        totalAmount: 175000, // 50000*2 + 75000*1
      })

      mockOrderRepo.detail.mockResolvedValue(mockOrderDetail)

      // Act - Thực hiện lấy chi tiết order
      const result = await service.detail(userId, orderId)

      // Assert - Kiểm tra kết quả
      expect(result).toEqual(mockOrderDetail)
      expect(result.items).toHaveLength(2)
      expect(result.items[0].productName).toBe('Test Product')
      expect(result.items[1].productName).toBe('Test Product 2')
      // expect(result.totalAmount).toBe(175000) // totalAmount not in response type
    })
  })

  describe('edge cases and error handling', () => {
    it('should handle repository errors in list', async () => {
      const userId = 1
      const query = createTestData.orderListQuery()
      const repositoryError = new Error('Database connection failed')

      mockOrderRepo.list.mockRejectedValue(repositoryError)

      await expect(service.list(userId, query)).rejects.toThrow('Database connection failed')
      expect(mockOrderRepo.list).toHaveBeenCalledWith(userId, query)
    })

    it('should handle repository errors in create', async () => {
      const userId = 1
      const body = createTestData.createOrderBody()
      const repositoryError = new Error('Cart item not found')

      mockOrderRepo.fetchAndValidateCartItems.mockRejectedValue(repositoryError)

      await expect(service.create(userId, body)).rejects.toThrow('Cart item not found')
    })

    it('should handle repository errors in cancel', async () => {
      const userId = 1
      const orderId = 1
      const repositoryError = new Error('Order not found')

      mockOrderRepo.cancel.mockRejectedValue(repositoryError)

      await expect(service.cancel(userId, orderId)).rejects.toThrow('Order not found')
      expect(mockOrderRepo.cancel).toHaveBeenCalledWith(userId, orderId)
    })

    it('should handle repository errors in detail', async () => {
      const userId = 1
      const orderId = 1
      const repositoryError = new Error('Order not found')

      mockOrderRepo.detail.mockRejectedValue(repositoryError)

      await expect(service.detail(userId, orderId)).rejects.toThrow('Order not found')
      expect(mockOrderRepo.detail).toHaveBeenCalledWith(userId, orderId)
    })

    it('should pass through repository responses without modification', async () => {
      const userId = 1
      const query = createTestData.orderListQuery()
      const originalResponse = createTestData.orderListResponse()

      mockOrderRepo.list.mockResolvedValue(originalResponse)

      const result = await service.list(userId, query)

      expect(result).toBe(originalResponse)
      expect(result).toEqual(originalResponse)
    })

    it('should cap FIXED_AMOUNT voucher at order total when voucher exceeds total', async () => {
      const userId = 1
      const body: CreateOrderBodyType = [
        {
          shopId: 1,
          receiver: { name: 'Test', phone: '0123456789', address: 'Test Address' },
          cartItemIds: [1],
          voucherId: 1,
        },
      ]
      const mockCartItems = createMockCartItems([{ quantity: 1, sku: { ...createMockCartItems()[0].sku, price: 50000 } }])
      const mockCartItemMap = new Map<number, CartItemWithRelations>()
      mockCartItems.forEach((item) => mockCartItemMap.set(item.id, item))
      const mockVoucher = { id: 1, type: 'FIXED_AMOUNT', value: 999999 } // exceeds order total

      mockOrderRepo.fetchAndValidateCartItems.mockResolvedValue({ cartItems: mockCartItems, cartItemMap: mockCartItemMap })
      mockVoucherRepository.findById.mockResolvedValue(mockVoucher as any)
      mockOrderRepo.create.mockResolvedValue(createTestData.createOrderResponse())

      await service.create(userId, body)

      expect(mockOrderRepo.create).toHaveBeenCalledWith(
        userId,
        body,
        mockCartItems,
        expect.arrayContaining([
          expect.objectContaining({
            discountAmount: 50000, // capped at itemsTotal
            totalAmount: 0,
          }),
        ]),
      )
    })

    it('should create order without voucher (no voucherId)', async () => {
      const userId = 1
      const body: CreateOrderBodyType = [
        {
          shopId: 1,
          receiver: { name: 'Test', phone: '0123456789', address: 'Test Address' },
          cartItemIds: [1, 2],
        },
      ]
      const mockCartItems = createMockCartItems()
      const mockCartItemMap = new Map<number, CartItemWithRelations>()
      mockCartItems.forEach((item) => mockCartItemMap.set(item.id, item))

      mockOrderRepo.fetchAndValidateCartItems.mockResolvedValue({ cartItems: mockCartItems, cartItemMap: mockCartItemMap })
      mockOrderRepo.create.mockResolvedValue(createTestData.createOrderResponse())

      await service.create(userId, body)

      expect(mockVoucherRepository.findById).not.toHaveBeenCalled()
      expect(mockOrderRepo.create).toHaveBeenCalledWith(
        userId,
        body,
        mockCartItems,
        expect.arrayContaining([
          expect.objectContaining({
            discountAmount: 0,
            voucherId: null,
          }),
        ]),
      )
    })

    it('should handle voucher not found (expired/used voucher)', async () => {
      const userId = 1
      const body: CreateOrderBodyType = [
        {
          shopId: 1,
          receiver: { name: 'Test', phone: '0123456789', address: 'Test Address' },
          cartItemIds: [1, 2],
          voucherId: 999,
        },
      ]
      const mockCartItems = createMockCartItems()
      const mockCartItemMap = new Map<number, CartItemWithRelations>()
      mockCartItems.forEach((item) => mockCartItemMap.set(item.id, item))

      mockOrderRepo.fetchAndValidateCartItems.mockResolvedValue({ cartItems: mockCartItems, cartItemMap: mockCartItemMap })
      mockVoucherRepository.findById.mockResolvedValue(null)
      mockOrderRepo.create.mockResolvedValue(createTestData.createOrderResponse())

      await service.create(userId, body)

      expect(mockOrderRepo.create).toHaveBeenCalledWith(
        userId,
        body,
        mockCartItems,
        expect.arrayContaining([
          expect.objectContaining({
            discountAmount: 0,
            voucherId: 999,
          }),
        ]),
      )
    })

    it('should handle concurrent order creation (fetchAndValidateCartItems race)', async () => {
      const userId = 1
      const body = createTestData.createOrderBody()
      const mockCartItems = createMockCartItems()
      const mockCartItemMap = new Map<number, CartItemWithRelations>()
      mockCartItems.forEach((item) => mockCartItemMap.set(item.id, item))

      mockOrderRepo.fetchAndValidateCartItems.mockResolvedValue({ cartItems: mockCartItems, cartItemMap: mockCartItemMap })
      mockOrderRepo.create.mockResolvedValue(createTestData.createOrderResponse())

      // Concurrent calls should both succeed at service level (repo handles locking)
      const [result1, result2] = await Promise.all([service.create(userId, body), service.create(userId, body)])

      expect(result1).toBeDefined()
      expect(result2).toBeDefined()
      expect(mockOrderRepo.fetchAndValidateCartItems).toHaveBeenCalledTimes(2)
    })

    it('should handle pagination with page beyond total pages', async () => {
      const userId = 1
      const query = createTestData.orderListQuery({ page: 999, limit: 10 })
      const emptyResponse = createTestData.orderListResponse({ data: [], totalItems: 5, page: 999, totalPages: 1 })

      mockOrderRepo.list.mockResolvedValue(emptyResponse)

      const result = await service.list(userId, query)

      expect(result.data).toEqual([])
      expect(mockOrderRepo.list).toHaveBeenCalledWith(userId, query)
    })

    it('should handle multiple shops with different vouchers in single order', async () => {
      const userId = 1
      const body: CreateOrderBodyType = [
        {
          shopId: 1,
          receiver: { name: 'Test', phone: '0123456789', address: 'Test Address' },
          cartItemIds: [1],
          voucherId: 1,
        },
        {
          shopId: 2,
          receiver: { name: 'Test', phone: '0123456789', address: 'Test Address' },
          cartItemIds: [2],
          voucherId: 2,
        },
      ]
      const mockCartItems = createMockCartItems()
      const mockCartItemMap = new Map<number, CartItemWithRelations>()
      mockCartItems.forEach((item) => mockCartItemMap.set(item.id, item))
      const mockVoucher1 = { id: 1, type: 'PERCENTAGE', value: 10, maxDiscount: null }
      const mockVoucher2 = { id: 2, type: 'FIXED_AMOUNT', value: 20000 }

      mockOrderRepo.fetchAndValidateCartItems.mockResolvedValue({ cartItems: mockCartItems, cartItemMap: mockCartItemMap })
      mockVoucherRepository.findById.mockResolvedValueOnce(mockVoucher1 as any).mockResolvedValueOnce(mockVoucher2 as any)
      mockOrderRepo.create.mockResolvedValue(createTestData.createOrderResponse())

      await service.create(userId, body)

      expect(mockVoucherRepository.findById).toHaveBeenCalledTimes(2)
      expect(mockVoucherRepository.findById).toHaveBeenCalledWith(1)
      expect(mockVoucherRepository.findById).toHaveBeenCalledWith(2)
    })
  })
})
