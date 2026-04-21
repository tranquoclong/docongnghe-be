import { Test, TestingModule } from '@nestjs/testing'
import { WebhookPaymentBodyType } from '../payment.model'
import { PaymentRepo } from '../payment.repo'
import { PaymentService } from '../payment.service'
import { PaymentGateway } from 'src/websockets/payment.gateway'

/**
 * PAYMENT SERVICE UNIT TESTS
 *
 * Module này test service layer của Payment
 * Đây là module CRITICAL vì xử lý webhook từ payment gateway
 *
 * Test Coverage:
 * - Webhook receiver processing
 * - WebSocket notification to user via PaymentGateway
 * - Error handling
 * - Integration với PaymentRepo
 */

describe('PaymentService', () => {
  let service: PaymentService
  let mockPaymentRepo: jest.Mocked<PaymentRepo>
  let mockPaymentGateway: jest.Mocked<PaymentGateway>

  // Test data factory
  const createWebhookPayload = (overrides = {}): WebhookPaymentBodyType => ({
    id: 123456,
    gateway: 'VCB',
    transactionDate: '2024-01-15 10:30:00',
    accountNumber: '1234567890',
    code: 'PAY100',
    content: 'Thanh toan don hang PAY100',
    transferType: 'in' as const,
    transferAmount: 500000,
    accumulated: 10000000,
    subAccount: null,
    referenceCode: 'REF123456',
    description: 'Chuyen khoan thanh toan don hang',
    ...overrides,
  })

  beforeEach(async () => {
    // Mock PaymentRepo
    mockPaymentRepo = {
      receiver: jest.fn(),
    } as any

    // Mock PaymentGateway
    mockPaymentGateway = {
      emitPaymentSuccess: jest.fn(),
    } as any

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentService,
        { provide: PaymentRepo, useValue: mockPaymentRepo },
        { provide: PaymentGateway, useValue: mockPaymentGateway },
      ],
    }).compile()

    service = module.get<PaymentService>(PaymentService)
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  // ============================================
  // RECEIVER METHOD TESTS
  // ============================================

  describe('receiver', () => {
    describe('✅ Success Cases', () => {
      it('should process webhook payment and emit WebSocket event to user room', async () => {
        // Arrange
        const webhookPayload = createWebhookPayload()
        const userId = 10
        mockPaymentRepo.receiver.mockResolvedValue(userId)

        // Act
        const result = await service.receiver(webhookPayload)

        // Assert
        expect(result).toEqual({ message: 'Payment received successfully' })
        expect(mockPaymentRepo.receiver).toHaveBeenCalledWith(webhookPayload)
        expect(mockPaymentRepo.receiver).toHaveBeenCalledTimes(1)
      })

      it('should emit payment success event to correct user room', async () => {
        // Arrange
        const webhookPayload = createWebhookPayload()
        const userId = 10
        mockPaymentRepo.receiver.mockResolvedValue(userId)

        // Act
        await service.receiver(webhookPayload)

        // Assert
        expect(mockPaymentGateway.emitPaymentSuccess).toHaveBeenCalledWith(10)
      })

      it('should handle payment for different users correctly', async () => {
        // Arrange
        const webhookPayload1 = createWebhookPayload({ id: 111 })
        const webhookPayload2 = createWebhookPayload({ id: 222 })

        mockPaymentRepo.receiver.mockResolvedValueOnce(10).mockResolvedValueOnce(20)

        // Act
        await service.receiver(webhookPayload1)
        await service.receiver(webhookPayload2)

        // Assert
        expect(mockPaymentGateway.emitPaymentSuccess).toHaveBeenNthCalledWith(1, 10)
        expect(mockPaymentGateway.emitPaymentSuccess).toHaveBeenNthCalledWith(2, 20)
        expect(mockPaymentGateway.emitPaymentSuccess).toHaveBeenCalledTimes(2)
      })

      it('should return success message after processing', async () => {
        // Arrange
        const webhookPayload = createWebhookPayload()
        mockPaymentRepo.receiver.mockResolvedValue(10)

        // Act
        const result = await service.receiver(webhookPayload)

        // Assert
        expect(result).toEqual({
          message: 'Payment received successfully',
        })
      })
    })

    describe('❌ Error Cases', () => {
      it('should propagate error from PaymentRepo', async () => {
        // Arrange
        const webhookPayload = createWebhookPayload()
        const error = new Error('Database error')
        mockPaymentRepo.receiver.mockRejectedValue(error)

        // Act & Assert
        await expect(service.receiver(webhookPayload)).rejects.toThrow('Database error')
        expect(mockPaymentRepo.receiver).toHaveBeenCalledWith(webhookPayload)
      })

      it('should not emit WebSocket event if repo throws error', async () => {
        // Arrange
        const webhookPayload = createWebhookPayload()
        mockPaymentRepo.receiver.mockRejectedValue(new Error('Payment processing failed'))

        // Act & Assert
        await expect(service.receiver(webhookPayload)).rejects.toThrow()
        expect(mockPaymentGateway.emitPaymentSuccess).not.toHaveBeenCalled()
      })

      it('should handle WebSocket emission error gracefully', async () => {
        // Arrange
        const webhookPayload = createWebhookPayload()
        const userId = 10
        mockPaymentRepo.receiver.mockResolvedValue(userId)
        mockPaymentGateway.emitPaymentSuccess.mockImplementation(() => {
          throw new Error('WebSocket error')
        })

        // Act & Assert
        await expect(service.receiver(webhookPayload)).rejects.toThrow('WebSocket error')
      })
    })

    describe('🔄 Integration Tests', () => {
      it('should process complete payment flow', async () => {
        // Arrange
        const webhookPayload = createWebhookPayload({
          id: 999,
          transferAmount: 1500000,
          gateway: 'MB Bank',
        })
        const userId = 15
        mockPaymentRepo.receiver.mockResolvedValue(userId)

        // Act
        const result = await service.receiver(webhookPayload)

        // Assert - Verify complete flow
        expect(mockPaymentRepo.receiver).toHaveBeenCalledWith(webhookPayload)
        expect(mockPaymentGateway.emitPaymentSuccess).toHaveBeenCalledWith(15)
        expect(result).toEqual({ message: 'Payment received successfully' })
      })

      it('should handle concurrent webhook requests', async () => {
        // Arrange
        const webhooks = [
          createWebhookPayload({ id: 1 }),
          createWebhookPayload({ id: 2 }),
          createWebhookPayload({ id: 3 }),
        ]
        mockPaymentRepo.receiver.mockResolvedValueOnce(10).mockResolvedValueOnce(11).mockResolvedValueOnce(12)

        // Act
        const results = await Promise.all(webhooks.map((webhook) => service.receiver(webhook)))

        // Assert
        expect(results).toHaveLength(3)
        expect(mockPaymentRepo.receiver).toHaveBeenCalledTimes(3)
        expect(mockPaymentGateway.emitPaymentSuccess).toHaveBeenCalledTimes(3)
      })
    })

    describe('📊 Edge Cases', () => {
      it('should handle userId = 0', async () => {
        // Arrange
        const webhookPayload = createWebhookPayload()
        mockPaymentRepo.receiver.mockResolvedValue(0)

        // Act
        await service.receiver(webhookPayload)

        // Assert
        expect(mockPaymentGateway.emitPaymentSuccess).toHaveBeenCalledWith(0)
      })

      it('should handle very large transaction amounts', async () => {
        // Arrange
        const webhookPayload = createWebhookPayload({
          transferAmount: 999999999999,
        })
        mockPaymentRepo.receiver.mockResolvedValue(10)

        // Act
        const result = await service.receiver(webhookPayload)

        // Assert
        expect(result).toEqual({ message: 'Payment received successfully' })
        expect(mockPaymentRepo.receiver).toHaveBeenCalledWith(webhookPayload)
      })

      it('should handle special characters in payment content', async () => {
        // Arrange
        const webhookPayload = createWebhookPayload({
          content: 'Thanh toán đơn hàng #123 - Khách hàng: Nguyễn Văn A',
          description: 'Chuyển khoản có ký tự đặc biệt: @#$%^&*()',
        })
        mockPaymentRepo.receiver.mockResolvedValue(10)

        // Act
        const result = await service.receiver(webhookPayload)

        // Assert
        expect(result).toEqual({ message: 'Payment received successfully' })
      })

      it('should handle null/undefined values in webhook payload', async () => {
        // Arrange
        const webhookPayload = createWebhookPayload({
          subAccount: null,
          code: null,
          accountNumber: null,
        })
        mockPaymentRepo.receiver.mockResolvedValue(10)

        // Act
        const result = await service.receiver(webhookPayload)

        // Assert
        expect(result).toEqual({ message: 'Payment received successfully' })
        expect(mockPaymentRepo.receiver).toHaveBeenCalledWith(webhookPayload)
      })

      it('should handle duplicate webhook with same transaction id', async () => {
        // Arrange - same payload sent twice
        const webhookPayload = createWebhookPayload({ id: 12345 })
        mockPaymentRepo.receiver.mockResolvedValueOnce(10)
        mockPaymentRepo.receiver.mockRejectedValueOnce(new Error('Duplicate transaction'))

        // Act - first call succeeds
        const result1 = await service.receiver(webhookPayload)
        expect(result1).toEqual({ message: 'Payment received successfully' })

        // Act - second call with same id fails at repo level
        await expect(service.receiver(webhookPayload)).rejects.toThrow('Duplicate transaction')
      })

      it('should handle repo returning negative userId', async () => {
        // Arrange
        const webhookPayload = createWebhookPayload()
        mockPaymentRepo.receiver.mockResolvedValue(-1)

        // Act
        await service.receiver(webhookPayload)

        // Assert - still emits, validation is repo's responsibility
        expect(mockPaymentGateway.emitPaymentSuccess).toHaveBeenCalledWith(-1)
      })

      it('should handle timeout-like errors from repo', async () => {
        // Arrange
        const webhookPayload = createWebhookPayload()
        mockPaymentRepo.receiver.mockRejectedValue(new Error('Connection timeout'))

        // Act & Assert
        await expect(service.receiver(webhookPayload)).rejects.toThrow('Connection timeout')
        expect(mockPaymentGateway.emitPaymentSuccess).not.toHaveBeenCalled()
      })
    })
  })

  // ============================================
  // WEBSOCKET INTEGRATION TESTS
  // ============================================

  describe('WebSocket Integration', () => {
    it('should delegate WebSocket emission to PaymentGateway', async () => {
      // Arrange
      const webhookPayload = createWebhookPayload()
      const userId = 10
      mockPaymentRepo.receiver.mockResolvedValue(userId)

      // Act
      await service.receiver(webhookPayload)

      // Assert
      expect(mockPaymentGateway.emitPaymentSuccess).toHaveBeenCalledWith(10)
    })

    it('should emit for each receiver call', async () => {
      // Arrange
      const webhookPayload = createWebhookPayload()
      mockPaymentRepo.receiver.mockResolvedValue(10)

      // Act
      await service.receiver(webhookPayload)

      // Assert
      expect(mockPaymentGateway.emitPaymentSuccess).toHaveBeenCalledTimes(1)
    })
  })
})
