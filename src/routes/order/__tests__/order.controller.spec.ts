import { Test, TestingModule } from '@nestjs/testing'
import { OrderController } from '../order.controller'
import { OrderService } from '../order.service'
import { CancelOrderBodyDTO, CreateOrderBodyDTO, GetOrderListQueryDTO, GetOrderParamsDTO } from '../order.dto'
import { OrderStatus } from 'src/shared/constants/order.constant'

// Test data factory để tạo dữ liệu test
const createTestData = {
  orderListQuery: (overrides = {}): GetOrderListQueryDTO => ({
    page: 1,
    limit: 10,
    ...overrides,
  }),

  createOrderBody: (overrides = {}): CreateOrderBodyDTO => [
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

  orderParams: (overrides = {}): GetOrderParamsDTO => ({
    orderId: 1,
    ...overrides,
  }),

  cancelOrderBody: (overrides = {}): CancelOrderBodyDTO => ({
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

describe('OrderController', () => {
  let controller: OrderController
  let module: TestingModule
  let mockOrderService: jest.Mocked<OrderService>

  beforeEach(async () => {
    // Tạo mock cho OrderService với tất cả methods cần thiết
    mockOrderService = {
      list: jest.fn(),
      create: jest.fn(),
      cancel: jest.fn(),
      detail: jest.fn(),
    } as any

    module = await Test.createTestingModule({
      controllers: [OrderController],
      providers: [{ provide: OrderService, useValue: mockOrderService }],
    }).compile()

    controller = module.get<OrderController>(OrderController)
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

  describe('getCart (order list)', () => {
    it('should get order list successfully', async () => {
      // Arrange - Chuẩn bị dữ liệu test
      const userId = 1
      const query = createTestData.orderListQuery({
        page: 1,
        limit: 10,
      })
      const mockOrderListResponse = createTestData.orderListResponse()

      mockOrderService.list.mockResolvedValue(mockOrderListResponse)

      // Act - Thực hiện lấy danh sách orders
      const result = await controller.getCart(userId, query)

      // Assert - Kiểm tra kết quả
      expect(result).toEqual(mockOrderListResponse)
      expect(mockOrderService.list).toHaveBeenCalledWith(userId, query)
      expect(mockOrderService.list).toHaveBeenCalledTimes(1)
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

      mockOrderService.list.mockResolvedValue(mockOrderListResponse)

      // Act - Thực hiện lấy danh sách orders
      const result = await controller.getCart(userId, query)

      // Assert - Kiểm tra kết quả
      expect(result).toEqual(mockOrderListResponse)
      expect(result.data[0].status).toBe(OrderStatus.DELIVERED)
      expect(mockOrderService.list).toHaveBeenCalledWith(userId, query)
    })

    it('should handle different pagination parameters', async () => {
      // Arrange - Chuẩn bị dữ liệu test với pagination khác
      const userId = 2
      const query = createTestData.orderListQuery({
        page: 3,
        limit: 5,
      })
      const mockOrderListResponse = createTestData.orderListResponse({
        page: 3,
        limit: 5,
        totalPages: 5,
      })

      mockOrderService.list.mockResolvedValue(mockOrderListResponse)

      // Act - Thực hiện lấy danh sách orders
      const result = await controller.getCart(userId, query)

      // Assert - Kiểm tra kết quả
      expect(result).toEqual(mockOrderListResponse)
      expect(result.page).toBe(3)
      expect(result.limit).toBe(5)
      expect(mockOrderService.list).toHaveBeenCalledWith(userId, query)
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

      mockOrderService.list.mockResolvedValue(emptyOrderListResponse)

      // Act - Thực hiện lấy danh sách orders
      const result = await controller.getCart(userId, query)

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
      const mockCreateOrderResponse = createTestData.createOrderResponse()

      mockOrderService.create.mockResolvedValue(mockCreateOrderResponse)

      // Act - Thực hiện tạo order
      const result = await controller.create(userId, body)

      // Assert - Kiểm tra kết quả
      expect(result).toEqual(mockCreateOrderResponse)
      expect(mockOrderService.create).toHaveBeenCalledWith(userId, body)
      expect(mockOrderService.create).toHaveBeenCalledTimes(1)
    })

    it('should create order with multiple shops', async () => {
      // Arrange - Chuẩn bị dữ liệu tạo order với nhiều shop
      const userId = 1
      const body: CreateOrderBodyDTO = [
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

      mockOrderService.create.mockResolvedValue(mockCreateOrderResponse)

      // Act - Thực hiện tạo order
      const result = await controller.create(userId, body)

      // Assert - Kiểm tra kết quả
      expect(result).toEqual(mockCreateOrderResponse)
      expect(result.orders).toHaveLength(2)
      expect(result.orders[0].shopId).toBe(1)
      expect(result.orders[1].shopId).toBe(2)
      expect(mockOrderService.create).toHaveBeenCalledWith(userId, body)
    })

    it('should create order with different receiver information', async () => {
      // Arrange - Chuẩn bị dữ liệu tạo order với thông tin receiver khác
      const userId = 2
      const body: CreateOrderBodyDTO = [
        {
          shopId: 1,
          receiver: {
            name: 'Trần Thị B',
            phone: '0987654321',
            address: '456 Đường XYZ, Quận 2, TP.HCM',
          },
          cartItemIds: [5, 6],
        },
      ]
      const mockCreateOrderResponse = createTestData.createOrderResponse({
        orders: [
          {
            ...createTestData.createOrderResponse().orders[0],
            userId: 2,
            receiver: {
              name: 'Trần Thị B',
              phone: '0987654321',
              address: '456 Đường XYZ, Quận 2, TP.HCM',
            },
          },
        ],
      })

      mockOrderService.create.mockResolvedValue(mockCreateOrderResponse)

      // Act - Thực hiện tạo order
      const result = await controller.create(userId, body)

      // Assert - Kiểm tra kết quả
      expect(result).toEqual(mockCreateOrderResponse)
      expect(result.orders[0].receiver.name).toBe('Trần Thị B')
      expect(result.orders[0].receiver.phone).toBe('0987654321')
      expect(mockOrderService.create).toHaveBeenCalledWith(userId, body)
    })

    it('should handle single cart item order', async () => {
      // Arrange - Chuẩn bị dữ liệu tạo order với 1 cart item
      const userId = 1
      const body: CreateOrderBodyDTO = [
        {
          shopId: 1,
          receiver: {
            name: 'Nguyễn Văn A',
            phone: '0123456789',
            address: '123 Đường ABC, Quận 1, TP.HCM',
          },
          cartItemIds: [1],
        },
      ]
      const mockCreateOrderResponse = createTestData.createOrderResponse()

      mockOrderService.create.mockResolvedValue(mockCreateOrderResponse)

      // Act - Thực hiện tạo order
      const result = await controller.create(userId, body)

      // Assert - Kiểm tra kết quả
      expect(result).toEqual(mockCreateOrderResponse)
      expect(body[0].cartItemIds).toHaveLength(1)
      expect(mockOrderService.create).toHaveBeenCalledWith(userId, body)
    })
  })

  describe('detail', () => {
    it('should get order detail successfully', async () => {
      // Arrange - Chuẩn bị dữ liệu lấy chi tiết order
      const userId = 1
      const param = createTestData.orderParams({
        orderId: 1,
      })
      const mockOrderDetail = createTestData.orderDetail()

      mockOrderService.detail.mockResolvedValue(mockOrderDetail)

      // Act - Thực hiện lấy chi tiết order
      const result = await controller.detail(userId, param)

      // Assert - Kiểm tra kết quả
      expect(result).toEqual(mockOrderDetail)
      expect(result.id).toBe(param.orderId)
      expect(result.userId).toBe(userId)
      expect(result.items).toBeDefined()
      expect(result.items).toHaveLength(1)
      expect(mockOrderService.detail).toHaveBeenCalledWith(userId, param.orderId)
      expect(mockOrderService.detail).toHaveBeenCalledTimes(1)
    })

    it('should handle different order details', async () => {
      // Arrange - Chuẩn bị dữ liệu lấy chi tiết order khác
      const userId = 2
      const param = createTestData.orderParams({
        orderId: 3,
      })
      const mockOrderDetail = createTestData.orderDetail({
        id: 3,
        userId: 2,
        status: OrderStatus.DELIVERED,
        totalAmount: 200000,
      })

      mockOrderService.detail.mockResolvedValue(mockOrderDetail)

      // Act - Thực hiện lấy chi tiết order
      const result = await controller.detail(userId, param)

      // Assert - Kiểm tra kết quả
      expect(result).toEqual(mockOrderDetail)
      expect(result.id).toBe(3)
      expect(result.userId).toBe(2)
      expect(result.status).toBe(OrderStatus.DELIVERED)
      // expect(result.totalAmount).toBe(200000) // totalAmount not in response type
      expect(mockOrderService.detail).toHaveBeenCalledWith(userId, param.orderId)
    })

    it('should handle order detail with multiple items', async () => {
      // Arrange - Chuẩn bị dữ liệu order có nhiều items
      const userId = 1
      const param = createTestData.orderParams({
        orderId: 1,
      })
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

      mockOrderService.detail.mockResolvedValue(mockOrderDetail)

      // Act - Thực hiện lấy chi tiết order
      const result = await controller.detail(userId, param)

      // Assert - Kiểm tra kết quả
      expect(result).toEqual(mockOrderDetail)
      expect(result.items).toHaveLength(2)
      expect(result.items[0].productName).toBe('Test Product')
      expect(result.items[1].productName).toBe('Test Product 2')
      // expect(result.totalAmount).toBe(175000) // totalAmount not in response type
    })
  })

  describe('cancel', () => {
    it('should cancel order successfully', async () => {
      // Arrange - Chuẩn bị dữ liệu hủy order
      const userId = 1
      const param = createTestData.orderParams({
        orderId: 1,
      })
      const body = createTestData.cancelOrderBody()
      const mockCancelOrderResponse = createTestData.cancelOrderResponse()

      mockOrderService.cancel.mockResolvedValue(mockCancelOrderResponse)

      // Act - Thực hiện hủy order
      const result = await controller.cancel(userId, param, body)

      // Assert - Kiểm tra kết quả
      expect(result).toEqual(mockCancelOrderResponse)
      expect(result.status).toBe(OrderStatus.CANCELLED)
      expect(mockOrderService.cancel).toHaveBeenCalledWith(userId, param.orderId)
      expect(mockOrderService.cancel).toHaveBeenCalledTimes(1)
    })

    it('should handle cancel different orders', async () => {
      // Arrange - Chuẩn bị dữ liệu hủy order khác
      const userId = 2
      const param = createTestData.orderParams({
        orderId: 5,
      })
      const body = createTestData.cancelOrderBody()
      const mockCancelOrderResponse = createTestData.cancelOrderResponse({
        id: 5,
        userId: 2,
      })

      mockOrderService.cancel.mockResolvedValue(mockCancelOrderResponse)

      // Act - Thực hiện hủy order
      const result = await controller.cancel(userId, param, body)

      // Assert - Kiểm tra kết quả
      expect(result).toEqual(mockCancelOrderResponse)
      expect(result.id).toBe(5)
      expect(result.userId).toBe(2)
      expect(mockOrderService.cancel).toHaveBeenCalledWith(userId, param.orderId)
    })

    it('should handle cancel order with different user', async () => {
      // Arrange - Chuẩn bị dữ liệu hủy order với user khác
      const userId = 3
      const param = createTestData.orderParams({
        orderId: 1,
      })
      const body = createTestData.cancelOrderBody()
      const mockCancelOrderResponse = createTestData.cancelOrderResponse({
        userId: 3,
      })

      mockOrderService.cancel.mockResolvedValue(mockCancelOrderResponse)

      // Act - Thực hiện hủy order
      const result = await controller.cancel(userId, param, body)

      // Assert - Kiểm tra kết quả
      expect(result).toEqual(mockCancelOrderResponse)
      expect(result.userId).toBe(3)
      expect(mockOrderService.cancel).toHaveBeenCalledWith(userId, param.orderId)
    })

    it('should ignore cancel body content', async () => {
      // Arrange - Chuẩn bị test để đảm bảo body không được sử dụng
      const userId = 1
      const param = createTestData.orderParams({
        orderId: 1,
      })
      const body = createTestData.cancelOrderBody()
      const mockCancelOrderResponse = createTestData.cancelOrderResponse()

      mockOrderService.cancel.mockResolvedValue(mockCancelOrderResponse)

      // Act - Thực hiện hủy order
      const result = await controller.cancel(userId, param, body)

      // Assert - Kiểm tra kết quả và service chỉ nhận userId và orderId
      expect(result).toEqual(mockCancelOrderResponse)
      expect(mockOrderService.cancel).toHaveBeenCalledWith(userId, param.orderId)
      expect(mockOrderService.cancel).not.toHaveBeenCalledWith(userId, param.orderId, body)
    })
  })

  describe('edge cases and error handling', () => {
    it('should handle service errors in order list', async () => {
      // Arrange - Chuẩn bị lỗi từ service
      const userId = 1
      const query = createTestData.orderListQuery()
      const serviceError = new Error('Service unavailable')

      mockOrderService.list.mockRejectedValue(serviceError)

      // Act & Assert - Thực hiện test và kiểm tra lỗi
      await expect(controller.getCart(userId, query)).rejects.toThrow('Service unavailable')
      expect(mockOrderService.list).toHaveBeenCalledWith(userId, query)
    })

    it('should handle service errors in create order', async () => {
      // Arrange - Chuẩn bị lỗi từ service
      const userId = 1
      const body = createTestData.createOrderBody()
      const serviceError = new Error('Cart item not found')

      mockOrderService.create.mockRejectedValue(serviceError)

      // Act & Assert - Thực hiện test và kiểm tra lỗi
      await expect(controller.create(userId, body)).rejects.toThrow('Cart item not found')
      expect(mockOrderService.create).toHaveBeenCalledWith(userId, body)
    })

    it('should handle service errors in order detail', async () => {
      // Arrange - Chuẩn bị lỗi từ service
      const userId = 1
      const param = createTestData.orderParams()
      const serviceError = new Error('Order not found')

      mockOrderService.detail.mockRejectedValue(serviceError)

      // Act & Assert - Thực hiện test và kiểm tra lỗi
      await expect(controller.detail(userId, param)).rejects.toThrow('Order not found')
      expect(mockOrderService.detail).toHaveBeenCalledWith(userId, param.orderId)
    })

    it('should handle service errors in cancel order', async () => {
      // Arrange - Chuẩn bị lỗi từ service
      const userId = 1
      const param = createTestData.orderParams()
      const body = createTestData.cancelOrderBody()
      const serviceError = new Error('Cannot cancel order')

      mockOrderService.cancel.mockRejectedValue(serviceError)

      // Act & Assert - Thực hiện test và kiểm tra lỗi
      await expect(controller.cancel(userId, param, body)).rejects.toThrow('Cannot cancel order')
      expect(mockOrderService.cancel).toHaveBeenCalledWith(userId, param.orderId)
    })

    it('should pass through service responses without modification', async () => {
      // Arrange - Chuẩn bị test để đảm bảo controller không modify data
      const userId = 1
      const query = createTestData.orderListQuery()
      const originalResponse = createTestData.orderListResponse()

      mockOrderService.list.mockResolvedValue(originalResponse)

      // Act - Thực hiện lấy danh sách orders
      const result = await controller.getCart(userId, query)

      // Assert - Kiểm tra kết quả không bị thay đổi
      expect(result).toBe(originalResponse) // Same reference
      expect(result).toEqual(originalResponse) // Same content
    })
  })

  // ===== RESPONSE STRUCTURE SNAPSHOTS =====

  describe('Response Structure Snapshots', () => {
    const fixedDate = '2024-01-01T00:00:00.000Z'

    it('should match order list response structure', async () => {
      const mockResponse = createTestData.orderListResponse({
        data: [
          {
            id: 1,
            userId: 1,
            shopId: 1,
            status: OrderStatus.PENDING_PAYMENT,
            totalAmount: 100000,
            paymentId: 1,
            createdAt: fixedDate,
            updatedAt: fixedDate,
            items: [
              {
                id: 1,
                productId: 1,
                productName: 'Test Product',
                productTranslations: [{ id: 1, name: 'Test Product', description: 'Test Description', languageId: 'vi' }],
                skuPrice: 50000,
                image: 'test-image.jpg',
                skuValue: 'Size: M, Color: Red',
                skuId: 1,
                orderId: 1,
                quantity: 2,
                createdAt: fixedDate,
              },
            ],
          },
        ],
      })
      mockOrderService.list.mockResolvedValue(mockResponse)
      const result = await controller.getCart(1, createTestData.orderListQuery())
      expect(result).toMatchSnapshot()
    })

    it('should match create order response structure', async () => {
      const mockResponse = createTestData.createOrderResponse({
        orders: [
          {
            id: 1,
            userId: 1,
            shopId: 1,
            status: OrderStatus.PENDING_PAYMENT,
            totalAmount: 100000,
            receiver: { name: 'Nguyễn Văn A', phone: '0123456789', address: '123 Đường ABC, Quận 1, TP.HCM' },
            paymentId: 1,
            createdAt: fixedDate,
            updatedAt: fixedDate,
            createdById: null,
            updatedById: null,
            deletedById: null,
            deletedAt: null,
          },
        ],
      })
      mockOrderService.create.mockResolvedValue(mockResponse)
      const result = await controller.create(1, createTestData.createOrderBody())
      expect(result).toMatchSnapshot()
    })

    it('should match cancel order response structure', async () => {
      const mockResponse = createTestData.cancelOrderResponse({
        createdAt: fixedDate,
        updatedAt: fixedDate,
      })
      mockOrderService.cancel.mockResolvedValue(mockResponse)
      const result = await controller.cancel(1, createTestData.orderParams(), createTestData.cancelOrderBody())
      expect(result).toMatchSnapshot()
    })
  })
})
