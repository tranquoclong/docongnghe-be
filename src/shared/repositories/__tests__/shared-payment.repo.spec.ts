import { Test, TestingModule } from '@nestjs/testing'
import { OrderStatus } from '@prisma/client'
import { PaymentStatus } from 'src/shared/constants/payment.constant'
import { SharedPaymentRepository } from 'src/shared/repositories/shared-payment.repo'
import { PrismaService } from 'src/shared/services/prisma.service'

describe('SharedPaymentRepository', () => {
  let repository: SharedPaymentRepository

  // Mock PrismaService
  const mockPrismaService = {
    payment: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    order: {
      updateMany: jest.fn(),
    },
    sKU: {
      update: jest.fn(),
    },
    $transaction: jest.fn(),
  }

  const createTestData = {
    payment: (overrides = {}) => ({
      id: 1,
      userId: 1,
      amount: 100000,
      status: PaymentStatus.PENDING,
      method: 'VNPAY',
      transactionId: 'TXN123',
      createdAt: new Date('2024-01-01'),
      updatedAt: new Date('2024-01-01'),
      orders: [
        {
          id: 1,
          userId: 1,
          paymentId: 1,
          status: OrderStatus.PENDING_PAYMENT,
          totalAmount: 100000,
          items: [
            {
              id: 1,
              orderId: 1,
              skuId: 1,
              quantity: 2,
              price: 50000,
            },
            {
              id: 2,
              orderId: 1,
              skuId: 2,
              quantity: 1,
              price: 50000,
            },
          ],
        },
      ],
      ...overrides,
    }),
  }

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SharedPaymentRepository,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile()

    repository = module.get<SharedPaymentRepository>(SharedPaymentRepository)

    // Reset mocks
    jest.clearAllMocks()
  })

  describe('cancelPaymentAndOrder', () => {
    it('should cancel payment and orders successfully', async () => {
      const mockPayment = createTestData.payment()
      mockPrismaService.payment.findUnique.mockResolvedValue(mockPayment)

      mockPrismaService.$transaction.mockImplementation(async (callback) => {
        const mockTx = {
          order: {
            updateMany: jest.fn().mockResolvedValue({ count: 1 }),
          },
          sKU: {
            update: jest.fn().mockResolvedValue({}),
          },
          payment: {
            update: jest.fn().mockResolvedValue({}),
          },
        }
        return callback(mockTx)
      })

      await repository.cancelPaymentAndOrder(1)

      expect(mockPrismaService.payment.findUnique).toHaveBeenCalledWith({
        where: { id: 1 },
        include: {
          orders: {
            include: {
              items: true,
            },
          },
        },
      })
      expect(mockPrismaService.$transaction).toHaveBeenCalled()
    })

    it('should restore SKU stock when cancelling orders', async () => {
      const mockPayment = createTestData.payment()
      mockPrismaService.payment.findUnique.mockResolvedValue(mockPayment)

      const mockSkuUpdate = jest.fn().mockResolvedValue({})
      mockPrismaService.$transaction.mockImplementation(async (callback) => {
        const mockTx = {
          order: {
            updateMany: jest.fn().mockResolvedValue({ count: 1 }),
          },
          sKU: {
            update: mockSkuUpdate,
          },
          payment: {
            update: jest.fn().mockResolvedValue({}),
          },
        }
        return callback(mockTx)
      })

      await repository.cancelPaymentAndOrder(1)

      expect(mockSkuUpdate).toHaveBeenCalledTimes(2)
      expect(mockSkuUpdate).toHaveBeenCalledWith({
        where: { id: 1 },
        data: { stock: { increment: 2 } },
      })
      expect(mockSkuUpdate).toHaveBeenCalledWith({
        where: { id: 2 },
        data: { stock: { increment: 1 } },
      })
    })

    it('should update order status to CANCELLED', async () => {
      const mockPayment = createTestData.payment()
      mockPrismaService.payment.findUnique.mockResolvedValue(mockPayment)

      const mockOrderUpdate = jest.fn().mockResolvedValue({ count: 1 })
      mockPrismaService.$transaction.mockImplementation(async (callback) => {
        const mockTx = {
          order: {
            updateMany: mockOrderUpdate,
          },
          sKU: {
            update: jest.fn().mockResolvedValue({}),
          },
          payment: {
            update: jest.fn().mockResolvedValue({}),
          },
        }
        return callback(mockTx)
      })

      await repository.cancelPaymentAndOrder(1)

      expect(mockOrderUpdate).toHaveBeenCalledWith({
        where: {
          id: { in: [1] },
          status: OrderStatus.PENDING_PAYMENT,
          deletedAt: null,
        },
        data: {
          status: OrderStatus.CANCELLED,
        },
      })
    })

    it('should update payment status to FAILED', async () => {
      const mockPayment = createTestData.payment()
      mockPrismaService.payment.findUnique.mockResolvedValue(mockPayment)

      const mockPaymentUpdate = jest.fn().mockResolvedValue({})
      mockPrismaService.$transaction.mockImplementation(async (callback) => {
        const mockTx = {
          order: {
            updateMany: jest.fn().mockResolvedValue({ count: 1 }),
          },
          sKU: {
            update: jest.fn().mockResolvedValue({}),
          },
          payment: {
            update: mockPaymentUpdate,
          },
        }
        return callback(mockTx)
      })

      await repository.cancelPaymentAndOrder(1)

      expect(mockPaymentUpdate).toHaveBeenCalledWith({
        where: { id: 1 },
        data: { status: PaymentStatus.FAILED },
      })
    })

    it('should throw error when payment not found', async () => {
      mockPrismaService.payment.findUnique.mockResolvedValue(null)

      await expect(repository.cancelPaymentAndOrder(999)).rejects.toThrow('Payment not found')
    })

    it('should handle orders with items without skuId', async () => {
      const mockPayment = createTestData.payment({
        orders: [
          {
            id: 1,
            userId: 1,
            paymentId: 1,
            status: OrderStatus.PENDING_PAYMENT,
            totalAmount: 100000,
            items: [
              {
                id: 1,
                orderId: 1,
                skuId: null,
                quantity: 2,
                price: 50000,
              },
              {
                id: 2,
                orderId: 1,
                skuId: 2,
                quantity: 1,
                price: 50000,
              },
            ],
          },
        ],
      })
      mockPrismaService.payment.findUnique.mockResolvedValue(mockPayment)

      const mockSkuUpdate = jest.fn().mockResolvedValue({})
      mockPrismaService.$transaction.mockImplementation(async (callback) => {
        const mockTx = {
          order: {
            updateMany: jest.fn().mockResolvedValue({ count: 1 }),
          },
          sKU: {
            update: mockSkuUpdate,
          },
          payment: {
            update: jest.fn().mockResolvedValue({}),
          },
        }
        return callback(mockTx)
      })

      await repository.cancelPaymentAndOrder(1)

      expect(mockSkuUpdate).toHaveBeenCalledTimes(1)
      expect(mockSkuUpdate).toHaveBeenCalledWith({
        where: { id: 2 },
        data: { stock: { increment: 1 } },
      })
    })
  })
})
