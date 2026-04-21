import { Test, TestingModule } from '@nestjs/testing'
import { PaymentRepo } from '../payment.repo'
import { PaymentService } from '../payment.service'
import { PaymentGateway } from '../../../websockets/payment.gateway'

describe('PaymentService — Edge Cases', () => {
  let service: PaymentService
  let mockPaymentRepo: jest.Mocked<PaymentRepo>
  let mockPaymentGateway: jest.Mocked<PaymentGateway>

  const createWebhookBody = (overrides = {}) => ({
    gateway: 'SEPAY',
    transactionDate: new Date().toISOString(),
    accountNumber: '123456789',
    code: null,
    content: 'PAY100',
    transferType: 'in' as const,
    transferAmount: 500000,
    accumulated: 1000000,
    subAccount: null,
    referenceCode: 'REF123',
    description: 'Payment for order',
    id: 1,
    ...overrides,
  })

  beforeEach(async () => {
    mockPaymentRepo = { receiver: jest.fn() } as any
    mockPaymentGateway = { emitPaymentSuccess: jest.fn() } as any

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentService,
        { provide: PaymentRepo, useValue: mockPaymentRepo },
        { provide: PaymentGateway, useValue: mockPaymentGateway },
      ],
    }).compile()

    service = module.get<PaymentService>(PaymentService)
  })

  afterEach(() => jest.clearAllMocks())

  describe('receiver — success path', () => {
    it('should process webhook, emit WebSocket event, and return success message', async () => {
      const body = createWebhookBody()
      mockPaymentRepo.receiver.mockResolvedValue(42)

      const result = await service.receiver(body)

      expect(mockPaymentRepo.receiver).toHaveBeenCalledWith(body)
      expect(mockPaymentGateway.emitPaymentSuccess).toHaveBeenCalledWith(42)
      expect(result).toEqual({ message: 'Payment received successfully' })
    })
  })

  describe('receiver — error propagation', () => {
    it('should re-throw Error from repo and log with stack trace', async () => {
      const body = createWebhookBody()
      const error = new Error('Transaction already exists')
      mockPaymentRepo.receiver.mockRejectedValue(error)

      await expect(service.receiver(body)).rejects.toThrow('Transaction already exists')
      expect(mockPaymentGateway.emitPaymentSuccess).not.toHaveBeenCalled()
    })

    it('should re-throw non-Error from repo and log without stack', async () => {
      const body = createWebhookBody()
      mockPaymentRepo.receiver.mockRejectedValue('string error')

      await expect(service.receiver(body)).rejects.toBe('string error')
      expect(mockPaymentGateway.emitPaymentSuccess).not.toHaveBeenCalled()
    })

    it('should not emit WebSocket event when repo throws', async () => {
      const body = createWebhookBody()
      mockPaymentRepo.receiver.mockRejectedValue(new Error('Cannot find payment'))

      await expect(service.receiver(body)).rejects.toThrow()
      expect(mockPaymentGateway.emitPaymentSuccess).not.toHaveBeenCalled()
    })

    it('should re-throw BadRequestException for price mismatch', async () => {
      const body = createWebhookBody({ transferAmount: 999 })
      const error = new Error('Price not match, expected 500000 but got 999')
      mockPaymentRepo.receiver.mockRejectedValue(error)

      await expect(service.receiver(body)).rejects.toThrow('Price not match')
    })

    it('should re-throw when no orders found for payment', async () => {
      const body = createWebhookBody()
      const error = new Error('No orders found for payment 100')
      mockPaymentRepo.receiver.mockRejectedValue(error)

      await expect(service.receiver(body)).rejects.toThrow('No orders found')
    })

    it('should re-throw when payment id cannot be parsed from content', async () => {
      const body = createWebhookBody({ content: 'INVALID', code: null })
      const error = new Error('Cannot get payment id from content')
      mockPaymentRepo.receiver.mockRejectedValue(error)

      await expect(service.receiver(body)).rejects.toThrow('Cannot get payment id from content')
    })
  })
})
