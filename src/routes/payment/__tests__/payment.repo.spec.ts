import { BadRequestException } from '@nestjs/common'
import { Test, TestingModule } from '@nestjs/testing'
import { OrderStatus } from 'src/shared/constants/order.constant'
import { PREFIX_PAYMENT_CODE } from 'src/shared/constants/other.constant'
import { PaymentStatus } from 'src/shared/constants/payment.constant'
import { PrismaService } from 'src/shared/services/prisma.service'
import { WebhookPaymentBodyType } from '../payment.model'
import { PaymentProducer } from '../payment.producer'
import { PaymentRepo } from '../payment.repo'

/**
 * PAYMENT REPO UNIT TESTS
 *
 * Module này test repository layer của Payment
 * Đây là module CRITICAL vì liên quan đến financial transactions
 *
 * Test Coverage:
 * - Webhook receiver processing
 * - Transaction validation
 * - Payment amount verification
 * - Order status updates
 * - Error handling (duplicate transactions, invalid payment ID, price mismatch)
 * - Database transaction integrity
 */

describe('PaymentRepo', () => {
  let repo: PaymentRepo
  let mockPrismaService: any
  let mockPaymentProducer: jest.Mocked<PaymentProducer>

  // Test data factory
  const createWebhookPayload = (overrides = {}): WebhookPaymentBodyType => ({
    id: 123456,
    gateway: 'VCB',
    transactionDate: '2024-01-15 10:30:00',
    accountNumber: '1234567890',
    code: `${PREFIX_PAYMENT_CODE}100`,
    content: `Thanh toan don hang ${PREFIX_PAYMENT_CODE}100`,
    transferType: 'in' as const,
    transferAmount: 500000,
    accumulated: 10000000,
    subAccount: null,
    referenceCode: 'REF123456',
    description: 'Chuyen khoan thanh toan don hang',
    ...overrides,
  })

  const createMockPayment = (overrides = {}) => {
    const defaultPayment = {
      id: 100,
      status: PaymentStatus.PENDING,
      orders: [
        {
          id: 1,
          userId: 10,
          status: OrderStatus.PENDING_PAYMENT,
          totalAmount: 500000,
          items: [
            {
              id: 1,
              skuPrice: 250000,
              quantity: 2,
            },
          ],
        },
      ],
    }
    return { ...defaultPayment, ...overrides }
  }

  beforeEach(async () => {
    // Mock PrismaService với transaction support
    mockPrismaService = {
      paymentTransaction: {
        findUnique: jest.fn(),
        create: jest.fn(),
      },
      payment: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      order: {
        updateMany: jest.fn(),
      },
      $transaction: jest.fn(async (callback) => await callback(mockPrismaService)),
    }

    // Mock PaymentProducer
    mockPaymentProducer = {
      removeJob: jest.fn().mockResolvedValue(undefined),
    } as any

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentRepo,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: PaymentProducer, useValue: mockPaymentProducer },
      ],
    }).compile()

    repo = module.get<PaymentRepo>(PaymentRepo)
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  // ============================================
  // RECEIVER METHOD TESTS
  // ============================================

  describe('receiver', () => {
    describe('✅ Success Cases', () => {
      it('should process webhook payment successfully with transferType "in"', async () => {
        // Arrange
        const webhookPayload = createWebhookPayload()
        const mockPayment = createMockPayment()

        mockPrismaService.paymentTransaction.findUnique.mockResolvedValue(null)
        mockPrismaService.payment.findUnique.mockResolvedValue(mockPayment)
        mockPrismaService.paymentTransaction.create.mockResolvedValue({} as any)
        mockPrismaService.payment.update.mockResolvedValue({} as any)
        mockPrismaService.order.updateMany.mockResolvedValue({ count: 1 } as any)

        // Act - let real getTotalPrice run (sums order.totalAmount)
        const result = await repo.receiver(webhookPayload)

        // Assert
        expect(result).toBe(10) // userId
        expect(mockPrismaService.paymentTransaction.findUnique).toHaveBeenCalledWith({
          where: { id: webhookPayload.id },
        })
        expect(mockPrismaService.paymentTransaction.create).toHaveBeenCalledWith({
          data: expect.objectContaining({
            id: webhookPayload.id,
            gateway: webhookPayload.gateway,
            amountIn: webhookPayload.transferAmount,
            amountOut: 0,
          }),
        })
        expect(mockPrismaService.payment.update).toHaveBeenCalledWith({
          where: { id: 100 },
          data: { status: PaymentStatus.SUCCESS },
        })
        expect(mockPrismaService.order.updateMany).toHaveBeenCalledWith({
          where: { id: { in: [1] }, deletedAt: null },
          data: { status: OrderStatus.PENDING_PICKUP },
        })
        expect(mockPaymentProducer.removeJob).toHaveBeenCalledWith(100)
      })

      it('should process webhook payment with transferType "out"', async () => {
        // Arrange
        const webhookPayload = createWebhookPayload({ transferType: 'out' })
        const mockPayment = createMockPayment()

        mockPrismaService.paymentTransaction.findUnique.mockResolvedValue(null)
        mockPrismaService.payment.findUnique.mockResolvedValue(mockPayment)
        mockPrismaService.paymentTransaction.create.mockResolvedValue({} as any)
        mockPrismaService.payment.update.mockResolvedValue({} as any)
        mockPrismaService.order.updateMany.mockResolvedValue({ count: 1 } as any)

        // Act - let real getTotalPrice run
        await repo.receiver(webhookPayload)

        // Assert
        expect(mockPrismaService.paymentTransaction.create).toHaveBeenCalledWith({
          data: expect.objectContaining({
            amountIn: 0,
            amountOut: webhookPayload.transferAmount,
          }),
        })
      })

      it('should extract payment ID from content when code is null', async () => {
        // Arrange
        const webhookPayload = createWebhookPayload({
          code: null,
          content: `Thanh toan ${PREFIX_PAYMENT_CODE}200`,
        })
        const mockPayment = createMockPayment({ id: 200 })

        mockPrismaService.paymentTransaction.findUnique.mockResolvedValue(null)
        mockPrismaService.payment.findUnique.mockResolvedValue(mockPayment)
        mockPrismaService.paymentTransaction.create.mockResolvedValue({} as any)
        mockPrismaService.payment.update.mockResolvedValue({} as any)
        mockPrismaService.order.updateMany.mockResolvedValue({ count: 1 } as any)

        // Act - let real getTotalPrice run
        await repo.receiver(webhookPayload)

        // Assert
        expect(mockPrismaService.payment.findUnique).toHaveBeenCalledWith({
          where: { id: 200 },
          include: expect.any(Object),
        })
      })

      it('should handle multiple orders in one payment', async () => {
        // Arrange
        const webhookPayload = createWebhookPayload({ transferAmount: 1000000 })
        const mockPayment = createMockPayment({
          orders: [
            {
              id: 1,
              userId: 10,
              status: OrderStatus.PENDING_PAYMENT,
              totalAmount: 500000,
              items: [{ id: 1, skuPrice: 250000, quantity: 2 }],
            },
            {
              id: 2,
              userId: 10,
              status: OrderStatus.PENDING_PAYMENT,
              totalAmount: 500000,
              items: [{ id: 2, skuPrice: 250000, quantity: 2 }],
            },
          ],
        })

        mockPrismaService.paymentTransaction.findUnique.mockResolvedValue(null)
        mockPrismaService.payment.findUnique.mockResolvedValue(mockPayment)
        mockPrismaService.paymentTransaction.create.mockResolvedValue({} as any)
        mockPrismaService.payment.update.mockResolvedValue({} as any)
        mockPrismaService.order.updateMany.mockResolvedValue({ count: 2 } as any)

        // Act - let real getTotalPrice run (sums totalAmount: 500k + 500k = 1M)
        await repo.receiver(webhookPayload)

        // Assert
        expect(mockPrismaService.order.updateMany).toHaveBeenCalledWith({
          where: { id: { in: [1, 2] }, deletedAt: null },
          data: { status: OrderStatus.PENDING_PICKUP },
        })
      })
    })

    describe('❌ Error Cases', () => {
      it('should throw BadRequestException if transaction already exists', async () => {
        // Arrange
        const webhookPayload = createWebhookPayload()
        mockPrismaService.paymentTransaction.findUnique.mockResolvedValue({ id: 123456 })

        // Act & Assert
        await expect(repo.receiver(webhookPayload)).rejects.toThrow(BadRequestException)
        await expect(repo.receiver(webhookPayload)).rejects.toThrow('Transaction already exists')
      })

      it('should throw BadRequestException if cannot extract payment ID from code/content', async () => {
        // Arrange
        const webhookPayload = createWebhookPayload({
          code: null,
          content: 'Invalid content without payment code',
        })
        mockPrismaService.paymentTransaction.findUnique.mockResolvedValue(null)

        // Act & Assert
        await expect(repo.receiver(webhookPayload)).rejects.toThrow(BadRequestException)
        await expect(repo.receiver(webhookPayload)).rejects.toThrow('Cannot get payment id from content')
      })

      it('should throw BadRequestException if payment not found', async () => {
        // Arrange
        const webhookPayload = createWebhookPayload()
        mockPrismaService.paymentTransaction.findUnique.mockResolvedValue(null)
        mockPrismaService.payment.findUnique.mockResolvedValue(null)

        // Act & Assert
        await expect(repo.receiver(webhookPayload)).rejects.toThrow(BadRequestException)
        await expect(repo.receiver(webhookPayload)).rejects.toThrow('Cannot find payment with id 100')
      })

      it('should throw BadRequestException if payment amount does not match', async () => {
        // Arrange
        const webhookPayload = createWebhookPayload({ transferAmount: 999999 }) // Wrong amount
        const mockPayment = createMockPayment() // Total should be 500000
        mockPrismaService.paymentTransaction.findUnique.mockResolvedValue(null)
        mockPrismaService.payment.findUnique.mockResolvedValue(mockPayment)

        // Act & Assert
        await expect(repo.receiver(webhookPayload)).rejects.toThrow(BadRequestException)
        await expect(repo.receiver(webhookPayload)).rejects.toThrow('Price not match')
      })
    })

    describe('🔒 Transaction Integrity', () => {
      it('should rollback transaction if payment update fails', async () => {
        // Arrange
        const webhookPayload = createWebhookPayload()
        const mockPayment = createMockPayment()

        mockPrismaService.paymentTransaction.findUnique.mockResolvedValue(null)
        mockPrismaService.payment.findUnique.mockResolvedValue(mockPayment)
        mockPrismaService.paymentTransaction.create.mockResolvedValue({} as any)
        mockPrismaService.payment.update.mockRejectedValue(new Error('Database error'))

        // Act & Assert
        await expect(repo.receiver(webhookPayload)).rejects.toThrow('Database error')

        // Verify transaction was called
        expect(mockPrismaService.$transaction).toHaveBeenCalled()
      })

      it('should ensure all operations happen in a transaction', async () => {
        // Arrange
        const webhookPayload = createWebhookPayload()
        const mockPayment = createMockPayment()

        mockPrismaService.paymentTransaction.findUnique.mockResolvedValue(null)
        mockPrismaService.payment.findUnique.mockResolvedValue(mockPayment)
        mockPrismaService.paymentTransaction.create.mockResolvedValue({} as any)
        mockPrismaService.payment.update.mockResolvedValue({} as any)
        mockPrismaService.order.updateMany.mockResolvedValue({ count: 1 } as any)

        // Act
        await repo.receiver(webhookPayload)

        // Assert
        expect(mockPrismaService.$transaction).toHaveBeenCalled()
      })
    })

    describe('Date Parsing Edge Cases', () => {
      it('should parse ISO format date successfully', async () => {
        // Arrange
        const webhookPayload = createWebhookPayload({
          transactionDate: '2024-01-15T10:30:00.000Z',
        })
        const mockPayment = createMockPayment()

        mockPrismaService.paymentTransaction.findUnique.mockResolvedValue(null)
        mockPrismaService.payment.findUnique.mockResolvedValue(mockPayment)
        mockPrismaService.paymentTransaction.create.mockResolvedValue({} as any)
        mockPrismaService.payment.update.mockResolvedValue({} as any)
        mockPrismaService.order.updateMany.mockResolvedValue({ count: 1 } as any)

        // Act
        const result = await repo.receiver(webhookPayload)

        // Assert
        expect(result).toBe(10)
        expect(mockPrismaService.paymentTransaction.create).toHaveBeenCalledWith(
          expect.objectContaining({
            data: expect.objectContaining({
              transactionDate: expect.any(Date),
            }),
          }),
        )
      })

      it('should fallback to custom format when ISO format is invalid', async () => {
        // Arrange - Test invalid ISO format, fallback to 'yyyy-MM-dd HH:mm:ss' (line 57)
        const webhookPayload = createWebhookPayload({
          transactionDate: 'invalid-iso-date', // Invalid ISO, will trigger fallback
        })
        const mockPayment = createMockPayment()

        mockPrismaService.paymentTransaction.findUnique.mockResolvedValue(null)
        mockPrismaService.payment.findUnique.mockResolvedValue(mockPayment)
        mockPrismaService.paymentTransaction.create.mockResolvedValue({} as any)
        mockPrismaService.payment.update.mockResolvedValue({} as any)
        mockPrismaService.order.updateMany.mockResolvedValue({ count: 1 } as any)

        // Act
        const result = await repo.receiver(webhookPayload)

        // Assert - Should still work with fallback parsing
        expect(result).toBe(10)
        expect(mockPrismaService.paymentTransaction.create).toHaveBeenCalled()
      })

      it('should handle custom date format "yyyy-MM-dd HH:mm:ss"', async () => {
        // Arrange - Test custom format that triggers NaN check and fallback to parse()
        const webhookPayload = createWebhookPayload({
          transactionDate: '2024-01-15 10:30:00',
        })
        const mockPayment = createMockPayment()

        mockPrismaService.paymentTransaction.findUnique.mockResolvedValue(null)
        mockPrismaService.payment.findUnique.mockResolvedValue(mockPayment)
        mockPrismaService.paymentTransaction.create.mockResolvedValue({} as any)
        mockPrismaService.payment.update.mockResolvedValue({} as any)
        mockPrismaService.order.updateMany.mockResolvedValue({ count: 1 } as any)

        // Act
        const result = await repo.receiver(webhookPayload)

        // Assert - Should use date-fns parse() fallback
        expect(result).toBe(10)
        expect(mockPrismaService.paymentTransaction.create).toHaveBeenCalledWith(
          expect.objectContaining({
            data: expect.objectContaining({
              transactionDate: expect.any(Date),
            }),
          }),
        )
      })
    })

    describe('Edge Cases', () => {
      it('should throw BadRequestException when payment has no orders', async () => {
        const webhookPayload = createWebhookPayload()
        const mockPayment = createMockPayment({ orders: [] })

        mockPrismaService.paymentTransaction.findUnique.mockResolvedValue(null)
        mockPrismaService.payment.findUnique.mockResolvedValue(mockPayment)
        mockPrismaService.paymentTransaction.create.mockResolvedValue({} as any)

        await expect(repo.receiver(webhookPayload)).rejects.toThrow(BadRequestException)
        await expect(repo.receiver(webhookPayload)).rejects.toThrow('No orders found for payment 100')
      })

      it('should extract payment ID from content when code is null', async () => {
        const webhookPayload = createWebhookPayload({
          code: null,
          content: `Thanh toan ${PREFIX_PAYMENT_CODE}100`,
        })
        const mockPayment = createMockPayment()

        mockPrismaService.paymentTransaction.findUnique.mockResolvedValue(null)
        mockPrismaService.payment.findUnique.mockResolvedValue(mockPayment)
        mockPrismaService.paymentTransaction.create.mockResolvedValue({} as any)
        mockPrismaService.payment.update.mockResolvedValue({} as any)
        mockPrismaService.order.updateMany.mockResolvedValue({ count: 1 } as any)

        const result = await repo.receiver(webhookPayload)

        expect(result).toBe(10)
      })

      it('should set amountOut for transferType "out"', async () => {
        const webhookPayload = createWebhookPayload({
          transferType: 'out',
          transferAmount: 500000,
        })
        const mockPayment = createMockPayment()

        mockPrismaService.paymentTransaction.findUnique.mockResolvedValue(null)
        mockPrismaService.payment.findUnique.mockResolvedValue(mockPayment)
        mockPrismaService.paymentTransaction.create.mockResolvedValue({} as any)
        mockPrismaService.payment.update.mockResolvedValue({} as any)
        mockPrismaService.order.updateMany.mockResolvedValue({ count: 1 } as any)

        await repo.receiver(webhookPayload)

        expect(mockPrismaService.paymentTransaction.create).toHaveBeenCalledWith(
          expect.objectContaining({
            data: expect.objectContaining({
              amountIn: 0,
              amountOut: 500000,
            }),
          }),
        )
      })

      it('should handle Prisma Decimal totalAmount in orders', async () => {
        const webhookPayload = createWebhookPayload({ transferAmount: 750000 })
        const mockPayment = createMockPayment({
          orders: [
            {
              id: 1,
              userId: 10,
              status: OrderStatus.PENDING_PAYMENT,
              totalAmount: { toString: () => '500000' },
              items: [],
            },
            {
              id: 2,
              userId: 10,
              status: OrderStatus.PENDING_PAYMENT,
              totalAmount: { toString: () => '250000' },
              items: [],
            },
          ],
        })

        mockPrismaService.paymentTransaction.findUnique.mockResolvedValue(null)
        mockPrismaService.payment.findUnique.mockResolvedValue(mockPayment)
        mockPrismaService.paymentTransaction.create.mockResolvedValue({} as any)
        mockPrismaService.payment.update.mockResolvedValue({} as any)
        mockPrismaService.order.updateMany.mockResolvedValue({ count: 2 } as any)

        const result = await repo.receiver(webhookPayload)

        expect(result).toBe(10)
      })

      it('should remove scheduled cancellation job on successful payment', async () => {
        const webhookPayload = createWebhookPayload()
        const mockPayment = createMockPayment()

        mockPrismaService.paymentTransaction.findUnique.mockResolvedValue(null)
        mockPrismaService.payment.findUnique.mockResolvedValue(mockPayment)
        mockPrismaService.paymentTransaction.create.mockResolvedValue({} as any)
        mockPrismaService.payment.update.mockResolvedValue({} as any)
        mockPrismaService.order.updateMany.mockResolvedValue({ count: 1 } as any)

        await repo.receiver(webhookPayload)

        expect(mockPaymentProducer.removeJob).toHaveBeenCalledWith(100)
      })
    })
  })
})
