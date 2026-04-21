import { Test, TestingModule } from '@nestjs/testing'
import { Reflector } from '@nestjs/core'
import { PaymentController } from '../payment.controller'
import { PaymentService } from '../payment.service'
import { WebhookPaymentBodyDTO } from '../payment.dto.'
import { AUTH_TYPE_KEY, AuthTypeDecoratorPayload } from 'src/shared/decorators/auth.decorator'
import { AuthType, ConditionGuard } from 'src/shared/constants/auth.constant'
import { WebhookPaymentBodyType } from '../payment.model'

/**
 * PAYMENT CONTROLLER UNIT TESTS
 *
 * Module này test controller layer của Payment
 * Đây là module CRITICAL vì là entry point cho webhook từ payment gateway
 *
 * Test Coverage:
 * - Webhook receiver endpoint
 * - Request validation
 * - Response formatting
 * - Error handling
 * - Authentication (PaymentAPIKey)
 */

describe('PaymentController', () => {
  let controller: PaymentController
  let mockPaymentService: jest.Mocked<PaymentService>

  // Test data factory - properly typed, no `as any`
  const createWebhookDTO = (overrides: Partial<WebhookPaymentBodyType> = {}): WebhookPaymentBodyDTO => {
    const base: WebhookPaymentBodyType = {
      id: 123456,
      gateway: 'VCB',
      transactionDate: '2024-01-15T10:30:00.000Z',
      accountNumber: '1234567890',
      code: 'PAY100',
      content: 'Thanh toan don hang PAY100',
      transferType: 'in',
      transferAmount: 500000,
      accumulated: 10000000,
      subAccount: null,
      referenceCode: 'REF123456',
      description: 'Chuyen khoan thanh toan don hang',
      ...overrides,
    }
    return base as WebhookPaymentBodyDTO
  }

  beforeEach(async () => {
    // Mock PaymentService
    mockPaymentService = {
      receiver: jest.fn(),
    } as any

    const module: TestingModule = await Test.createTestingModule({
      controllers: [PaymentController],
      providers: [{ provide: PaymentService, useValue: mockPaymentService }],
    }).compile()

    controller = module.get<PaymentController>(PaymentController)
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  // ============================================
  // RECEIVER ENDPOINT TESTS
  // ============================================

  describe('POST /payment/receiver', () => {
    describe('✅ Success Cases', () => {
      it('should process webhook payment successfully', async () => {
        // Arrange
        const webhookDTO = createWebhookDTO()
        const expectedResponse = { message: 'Payment received successfully' } as const
        mockPaymentService.receiver.mockResolvedValue(expectedResponse)

        // Act
        const result = await controller.receiver(webhookDTO)

        // Assert
        expect(result).toEqual(expectedResponse)
        expect(mockPaymentService.receiver).toHaveBeenCalledWith(webhookDTO)
        expect(mockPaymentService.receiver).toHaveBeenCalledTimes(1)
      })

      it('should handle webhook with transferType "in"', async () => {
        // Arrange
        const webhookDTO = createWebhookDTO({ transferType: 'in' })
        mockPaymentService.receiver.mockResolvedValue({ message: 'Payment received successfully' })

        // Act
        const result = await controller.receiver(webhookDTO)

        // Assert
        expect(result).toBeDefined()
        expect(mockPaymentService.receiver).toHaveBeenCalledWith(expect.objectContaining({ transferType: 'in' }))
      })

      it('should handle webhook with transferType "out"', async () => {
        // Arrange
        const webhookDTO = createWebhookDTO({ transferType: 'out' })
        mockPaymentService.receiver.mockResolvedValue({ message: 'Payment received successfully' })

        // Act
        const result = await controller.receiver(webhookDTO)

        // Assert
        expect(result).toBeDefined()
        expect(mockPaymentService.receiver).toHaveBeenCalledWith(expect.objectContaining({ transferType: 'out' }))
      })

      it('should handle webhook from different gateways', async () => {
        // Arrange
        const gateways = ['VCB', 'MB Bank', 'Techcombank', 'ACB', 'Vietinbank']
        mockPaymentService.receiver.mockResolvedValue({ message: 'Payment received successfully' })

        // Act & Assert
        for (const gateway of gateways) {
          const webhookDTO = createWebhookDTO({ gateway })
          await controller.receiver(webhookDTO)
          expect(mockPaymentService.receiver).toHaveBeenCalledWith(expect.objectContaining({ gateway }))
        }
      })

      it('should handle large transaction amounts', async () => {
        // Arrange
        const webhookDTO = createWebhookDTO({
          transferAmount: 999999999,
          accumulated: 9999999999,
        })
        mockPaymentService.receiver.mockResolvedValue({ message: 'Payment received successfully' })

        // Act
        const result = await controller.receiver(webhookDTO)

        // Assert
        expect(result).toBeDefined()
        expect(mockPaymentService.receiver).toHaveBeenCalledWith(webhookDTO)
      })

      it('should handle webhook with null optional fields', async () => {
        // Arrange
        const webhookDTO = createWebhookDTO({
          code: null,
          content: null,
          subAccount: null,
          accountNumber: null,
          referenceCode: null,
        })
        mockPaymentService.receiver.mockResolvedValue({ message: 'Payment received successfully' })

        // Act
        const result = await controller.receiver(webhookDTO)

        // Assert
        expect(result).toBeDefined()
        expect(mockPaymentService.receiver).toHaveBeenCalledWith(webhookDTO)
      })
    })

    describe('❌ Error Cases', () => {
      it('should propagate service errors', async () => {
        // Arrange
        const webhookDTO = createWebhookDTO()
        const error = new Error('Payment processing failed')
        mockPaymentService.receiver.mockRejectedValue(error)

        // Act & Assert
        await expect(controller.receiver(webhookDTO)).rejects.toThrow('Payment processing failed')
        expect(mockPaymentService.receiver).toHaveBeenCalledWith(webhookDTO)
      })

      it('should handle BadRequestException from service', async () => {
        // Arrange
        const webhookDTO = createWebhookDTO()
        const error = new Error('Transaction already exists')
        error.name = 'BadRequestException'
        mockPaymentService.receiver.mockRejectedValue(error)

        // Act & Assert
        await expect(controller.receiver(webhookDTO)).rejects.toThrow('Transaction already exists')
      })

      it('should handle database errors from service', async () => {
        // Arrange
        const webhookDTO = createWebhookDTO()
        const error = new Error('Database connection failed')
        mockPaymentService.receiver.mockRejectedValue(error)

        // Act & Assert
        await expect(controller.receiver(webhookDTO)).rejects.toThrow('Database connection failed')
      })
    })

    describe('🔒 Security & Validation', () => {
      it('should be protected by PaymentAPIKey authentication', () => {
        // Verify @Auth([AuthType.PaymentAPIKey]) decorator metadata is set on the receiver method
        const reflector = new Reflector()
        const metadata = reflector.get<AuthTypeDecoratorPayload>(AUTH_TYPE_KEY, PaymentController.prototype.receiver)

        expect(metadata).toBeDefined()
        expect(metadata.authTypes).toEqual([AuthType.PaymentAPIKey])
        expect(metadata.options).toEqual({ condition: ConditionGuard.And })
      })

      it('should validate webhook payload structure', async () => {
        // Arrange
        const webhookDTO = createWebhookDTO()
        mockPaymentService.receiver.mockResolvedValue({ message: 'Payment received successfully' })

        // Act
        await controller.receiver(webhookDTO)

        // Assert - Verify all required fields are passed
        expect(mockPaymentService.receiver).toHaveBeenCalledWith(
          expect.objectContaining({
            id: expect.any(Number),
            gateway: expect.any(String),
            transactionDate: expect.any(String),
            transferType: expect.stringMatching(/^(in|out)$/),
            transferAmount: expect.any(Number),
            accumulated: expect.any(Number),
            description: expect.any(String),
          }),
        )
      })
    })

    describe('🔄 Integration Scenarios', () => {
      it('should handle rapid consecutive webhook calls', async () => {
        // Arrange
        const webhooks = [createWebhookDTO({ id: 1 }), createWebhookDTO({ id: 2 }), createWebhookDTO({ id: 3 })]
        mockPaymentService.receiver.mockResolvedValue({ message: 'Payment received successfully' })

        // Act
        const results = await Promise.all(webhooks.map((webhook) => controller.receiver(webhook)))

        // Assert
        expect(results).toHaveLength(3)
        expect(mockPaymentService.receiver).toHaveBeenCalledTimes(3)
      })

      it('should handle webhook retry scenarios', async () => {
        // Arrange
        const webhookDTO = createWebhookDTO()
        mockPaymentService.receiver
          .mockRejectedValueOnce(new Error('Temporary error'))
          .mockResolvedValueOnce({ message: 'Payment received successfully' })

        // Act & Assert - First call fails
        await expect(controller.receiver(webhookDTO)).rejects.toThrow('Temporary error')

        // Second call succeeds (retry)
        const result = await controller.receiver(webhookDTO)
        expect(result).toEqual({ message: 'Payment received successfully' })
      })
    })

    describe('📊 Edge Cases', () => {
      it('should handle minimum valid transaction amount', async () => {
        // Arrange
        const webhookDTO = createWebhookDTO({
          transferAmount: 1,
          accumulated: 1,
        })
        mockPaymentService.receiver.mockResolvedValue({ message: 'Payment received successfully' })

        // Act
        const result = await controller.receiver(webhookDTO)

        // Assert
        expect(result).toBeDefined()
      })

      it('should handle special characters in description', async () => {
        // Arrange
        const webhookDTO = createWebhookDTO({
          description: 'Chuyển khoản có ký tự đặc biệt: @#$%^&*() - Tiếng Việt có dấu',
          content: 'Nội dung: Nguyễn Văn A - 123.456.789',
        })
        mockPaymentService.receiver.mockResolvedValue({ message: 'Payment received successfully' })

        // Act
        const result = await controller.receiver(webhookDTO)

        // Assert
        expect(result).toBeDefined()
        expect(mockPaymentService.receiver).toHaveBeenCalledWith(
          expect.objectContaining({
            description: expect.stringContaining('Tiếng Việt'),
          }),
        )
      })

      it('should handle very long transaction IDs', async () => {
        // Arrange
        const webhookDTO = createWebhookDTO({
          id: 999999999999,
        })
        mockPaymentService.receiver.mockResolvedValue({ message: 'Payment received successfully' })

        // Act
        const result = await controller.receiver(webhookDTO)

        // Assert
        expect(result).toBeDefined()
      })

      it('should handle different date formats', async () => {
        // Arrange
        const webhookDTO = createWebhookDTO({
          transactionDate: '2024-12-31T23:59:59.999Z',
        })
        mockPaymentService.receiver.mockResolvedValue({ message: 'Payment received successfully' })

        // Act
        const result = await controller.receiver(webhookDTO)

        // Assert
        expect(result).toBeDefined()
      })
    })
  })

  // ===== RESPONSE STRUCTURE SNAPSHOTS =====

  describe('Response Structure Snapshots', () => {
    it('should match webhook receiver success response structure', async () => {
      const webhookDTO = createWebhookDTO()
      mockPaymentService.receiver.mockResolvedValue({ message: 'Payment received successfully' })
      const result = await controller.receiver(webhookDTO)
      expect(result).toMatchSnapshot()
    })

    it('should match webhook DTO input structure', () => {
      const webhookDTO = createWebhookDTO()
      expect(webhookDTO).toMatchSnapshot()
    })
  })
})
