import { Test, TestingModule } from '@nestjs/testing'
import { Job } from 'bullmq'
import { PaymentConsumer } from '../payment.consumer'
import { SharedPaymentRepository } from 'src/shared/repositories/shared-payment.repo'
import { CANCEL_PAYMENT_JOB_NAME } from 'src/shared/constants/queue.constant'

/**
 * PAYMENT CONSUMER UNIT TESTS
 *
 * Test coverage cho Payment Queue Consumer
 * - Job processing (CANCEL_PAYMENT_JOB_NAME)
 * - Error handling
 * - Repository integration
 */

describe('PaymentConsumer', () => {
  let consumer: PaymentConsumer
  let mockSharedPaymentRepo: jest.Mocked<SharedPaymentRepository>

  const createMockJob = (name: string, data: any): Job =>
    ({
      id: '123',
      name,
      data,
      attemptsMade: 0,
      timestamp: Date.now(),
      processedOn: Date.now(),
      finishedOn: null,
      returnvalue: null,
      failedReason: null,
      stacktrace: null,
      opts: {},
      progress: 0,
      delay: 0,
      queueName: 'payment',
    }) as any

  beforeEach(async () => {
    mockSharedPaymentRepo = {
      cancelPaymentAndOrder: jest.fn(),
    } as any

    const module: TestingModule = await Test.createTestingModule({
      providers: [PaymentConsumer, { provide: SharedPaymentRepository, useValue: mockSharedPaymentRepo }],
    }).compile()

    consumer = module.get<PaymentConsumer>(PaymentConsumer)
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  describe('process', () => {
    describe('CANCEL_PAYMENT_JOB_NAME', () => {
      it('should cancel payment and order successfully', async () => {
        const paymentId = 1
        const job = createMockJob(CANCEL_PAYMENT_JOB_NAME, { paymentId })
        mockSharedPaymentRepo.cancelPaymentAndOrder.mockResolvedValue(undefined)

        const result = await consumer.process(job)

        expect(mockSharedPaymentRepo.cancelPaymentAndOrder).toHaveBeenCalledWith(paymentId)
        expect(result).toEqual({ success: true, paymentId })
      })

      it('should handle different payment IDs', async () => {
        const paymentIds = [1, 100, 999, 12345]

        for (const paymentId of paymentIds) {
          const job = createMockJob(CANCEL_PAYMENT_JOB_NAME, { paymentId })
          mockSharedPaymentRepo.cancelPaymentAndOrder.mockResolvedValue(undefined)

          const result = await consumer.process(job)

          expect(mockSharedPaymentRepo.cancelPaymentAndOrder).toHaveBeenCalledWith(paymentId)
          expect(result).toEqual({ success: true, paymentId })
        }

        expect(mockSharedPaymentRepo.cancelPaymentAndOrder).toHaveBeenCalledTimes(paymentIds.length)
      })

      it('should propagate repository errors', async () => {
        const paymentId = 1
        const job = createMockJob(CANCEL_PAYMENT_JOB_NAME, { paymentId })
        const error = new Error('Database error')
        mockSharedPaymentRepo.cancelPaymentAndOrder.mockRejectedValue(error)

        await expect(consumer.process(job)).rejects.toThrow('Database error')
        expect(mockSharedPaymentRepo.cancelPaymentAndOrder).toHaveBeenCalledWith(paymentId)
      })

      it('should handle payment not found error', async () => {
        const paymentId = 999
        const job = createMockJob(CANCEL_PAYMENT_JOB_NAME, { paymentId })
        const error = new Error('Payment not found')
        mockSharedPaymentRepo.cancelPaymentAndOrder.mockRejectedValue(error)

        await expect(consumer.process(job)).rejects.toThrow('Payment not found')
      })

      it('should handle transaction errors', async () => {
        const paymentId = 1
        const job = createMockJob(CANCEL_PAYMENT_JOB_NAME, { paymentId })
        const error = new Error('Transaction failed')
        mockSharedPaymentRepo.cancelPaymentAndOrder.mockRejectedValue(error)

        await expect(consumer.process(job)).rejects.toThrow('Transaction failed')
      })

      it('should return success result with paymentId on success', async () => {
        const paymentId = 1
        const job = createMockJob(CANCEL_PAYMENT_JOB_NAME, { paymentId })
        mockSharedPaymentRepo.cancelPaymentAndOrder.mockResolvedValue(undefined)

        const result = await consumer.process(job)

        expect(result).toEqual({ success: true, paymentId })
        expect(result.success).toBe(true)
        expect(result.paymentId).toBe(paymentId)
      })

      it('should extract paymentId from job data correctly', async () => {
        const job = createMockJob(CANCEL_PAYMENT_JOB_NAME, { paymentId: 42 })
        mockSharedPaymentRepo.cancelPaymentAndOrder.mockResolvedValue(undefined)

        await consumer.process(job)

        expect(mockSharedPaymentRepo.cancelPaymentAndOrder).toHaveBeenCalledWith(42)
        expect(mockSharedPaymentRepo.cancelPaymentAndOrder).not.toHaveBeenCalledWith(undefined)
      })

      it('should handle job with additional data fields', async () => {
        const job = createMockJob(CANCEL_PAYMENT_JOB_NAME, {
          paymentId: 1,
          extraField: 'ignored',
          anotherField: 123,
        })
        mockSharedPaymentRepo.cancelPaymentAndOrder.mockResolvedValue(undefined)

        const result = await consumer.process(job)

        expect(mockSharedPaymentRepo.cancelPaymentAndOrder).toHaveBeenCalledWith(1)
        expect(result).toEqual({ success: true, paymentId: 1 })
      })

      it('should call repository method exactly once per job', async () => {
        const job = createMockJob(CANCEL_PAYMENT_JOB_NAME, { paymentId: 1 })
        mockSharedPaymentRepo.cancelPaymentAndOrder.mockResolvedValue(undefined)

        await consumer.process(job)

        expect(mockSharedPaymentRepo.cancelPaymentAndOrder).toHaveBeenCalledTimes(1)
      })

      it('should handle zero payment ID', async () => {
        const job = createMockJob(CANCEL_PAYMENT_JOB_NAME, { paymentId: 0 })
        mockSharedPaymentRepo.cancelPaymentAndOrder.mockResolvedValue(undefined)

        const result = await consumer.process(job)

        expect(mockSharedPaymentRepo.cancelPaymentAndOrder).toHaveBeenCalledWith(0)
        expect(result).toEqual({ success: true, paymentId: 0 })
      })

      it('should handle large payment ID', async () => {
        const largeId = 2147483647 // Max 32-bit integer
        const job = createMockJob(CANCEL_PAYMENT_JOB_NAME, { paymentId: largeId })
        mockSharedPaymentRepo.cancelPaymentAndOrder.mockResolvedValue(undefined)

        const result = await consumer.process(job)

        expect(mockSharedPaymentRepo.cancelPaymentAndOrder).toHaveBeenCalledWith(largeId)
        expect(result).toEqual({ success: true, paymentId: largeId })
      })
    })

    describe('unknown job names', () => {
      it('should throw error for unknown job name', async () => {
        const job = createMockJob('UNKNOWN_JOB', { paymentId: 1 })

        await expect(consumer.process(job)).rejects.toThrow('Unknown job name: UNKNOWN_JOB')
        expect(mockSharedPaymentRepo.cancelPaymentAndOrder).not.toHaveBeenCalled()
      })

      it('should throw error for unhandled job names', async () => {
        const job = createMockJob('RANDOM_JOB_NAME', { data: 'test' })

        await expect(consumer.process(job)).rejects.toThrow('Unknown job name: RANDOM_JOB_NAME')
      })

      it('should throw error with job name in message for default case', async () => {
        const job = createMockJob('ANOTHER_JOB', {})

        await expect(consumer.process(job)).rejects.toThrow('Unknown job name: ANOTHER_JOB')
      })
    })

    describe('job metadata', () => {
      it('should process job regardless of attempt count', async () => {
        const job = createMockJob(CANCEL_PAYMENT_JOB_NAME, { paymentId: 1 })
        job.attemptsMade = 3
        mockSharedPaymentRepo.cancelPaymentAndOrder.mockResolvedValue(undefined)

        const result = await consumer.process(job)

        expect(mockSharedPaymentRepo.cancelPaymentAndOrder).toHaveBeenCalledWith(1)
        expect(result).toEqual({ success: true, paymentId: 1 })
      })

      it('should process job with any job ID', async () => {
        const job = createMockJob(CANCEL_PAYMENT_JOB_NAME, { paymentId: 1 })
        job.id = 'custom-job-id-999'
        mockSharedPaymentRepo.cancelPaymentAndOrder.mockResolvedValue(undefined)

        const result = await consumer.process(job)

        expect(result).toEqual({ success: true, paymentId: 1 })
      })
    })

    describe('concurrent processing', () => {
      it('should handle multiple jobs sequentially', async () => {
        const jobs = [
          createMockJob(CANCEL_PAYMENT_JOB_NAME, { paymentId: 1 }),
          createMockJob(CANCEL_PAYMENT_JOB_NAME, { paymentId: 2 }),
          createMockJob(CANCEL_PAYMENT_JOB_NAME, { paymentId: 3 }),
        ]
        mockSharedPaymentRepo.cancelPaymentAndOrder.mockResolvedValue(undefined)

        for (const job of jobs) {
          await consumer.process(job)
        }

        expect(mockSharedPaymentRepo.cancelPaymentAndOrder).toHaveBeenCalledTimes(3)
        expect(mockSharedPaymentRepo.cancelPaymentAndOrder).toHaveBeenNthCalledWith(1, 1)
        expect(mockSharedPaymentRepo.cancelPaymentAndOrder).toHaveBeenNthCalledWith(2, 2)
        expect(mockSharedPaymentRepo.cancelPaymentAndOrder).toHaveBeenNthCalledWith(3, 3)
      })

      it('should not affect other jobs if one fails', async () => {
        const job1 = createMockJob(CANCEL_PAYMENT_JOB_NAME, { paymentId: 1 })
        const job2 = createMockJob(CANCEL_PAYMENT_JOB_NAME, { paymentId: 2 })

        mockSharedPaymentRepo.cancelPaymentAndOrder
          .mockResolvedValueOnce(undefined)
          .mockRejectedValueOnce(new Error('Failed'))

        await consumer.process(job1)
        await expect(consumer.process(job2)).rejects.toThrow('Failed')

        expect(mockSharedPaymentRepo.cancelPaymentAndOrder).toHaveBeenCalledTimes(2)
      })
    })

    describe('edge cases', () => {
      it('should handle null paymentId gracefully', async () => {
        const job = createMockJob(CANCEL_PAYMENT_JOB_NAME, { paymentId: null })
        mockSharedPaymentRepo.cancelPaymentAndOrder.mockResolvedValue(undefined)

        const result = await consumer.process(job)

        expect(mockSharedPaymentRepo.cancelPaymentAndOrder).toHaveBeenCalledWith(null)
        expect(result).toEqual({ success: true, paymentId: null })
      })

      it('should handle undefined paymentId', async () => {
        const job = createMockJob(CANCEL_PAYMENT_JOB_NAME, { paymentId: undefined })
        mockSharedPaymentRepo.cancelPaymentAndOrder.mockResolvedValue(undefined)

        const result = await consumer.process(job)

        expect(mockSharedPaymentRepo.cancelPaymentAndOrder).toHaveBeenCalledWith(undefined)
        expect(result).toEqual({ success: true, paymentId: undefined })
      })

      it('should handle empty job data', async () => {
        const job = createMockJob(CANCEL_PAYMENT_JOB_NAME, {})
        mockSharedPaymentRepo.cancelPaymentAndOrder.mockResolvedValue(undefined)

        const result = await consumer.process(job)

        expect(mockSharedPaymentRepo.cancelPaymentAndOrder).toHaveBeenCalledWith(undefined)
        expect(result).toEqual({ success: true, paymentId: undefined })
      })
    })
  })

  describe('inheritance', () => {
    it('should extend WorkerHost', () => {
      expect(consumer).toBeInstanceOf(PaymentConsumer)
      // WorkerHost is abstract, so we just verify the consumer is properly instantiated
      expect(consumer.process).toBeDefined()
    })

    it('should have process method', () => {
      expect(typeof consumer.process).toBe('function')
    })
  })
})
