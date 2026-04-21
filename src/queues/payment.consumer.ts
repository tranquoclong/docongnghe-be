import { Processor, WorkerHost } from '@nestjs/bullmq'
import { Logger } from '@nestjs/common'
import { Job } from 'bullmq'
import { CANCEL_PAYMENT_JOB_NAME, PAYMENT_QUEUE_NAME } from 'src/shared/constants/queue.constant'
import { SharedPaymentRepository } from 'src/shared/repositories/shared-payment.repo'

@Processor(PAYMENT_QUEUE_NAME)
export class PaymentConsumer extends WorkerHost {
  private readonly logger = new Logger(PaymentConsumer.name)

  constructor(private readonly sharedPaymentRepo: SharedPaymentRepository) {
    super()
  }

  async process(job: Job<{ paymentId: number }, any, string>): Promise<any> {
    this.logger.log(`Processing job ${job.name} with ID ${job.id}, attempt ${job.attemptsMade + 1}`)

    try {
      switch (job.name) {
        case CANCEL_PAYMENT_JOB_NAME: {
          const paymentId = job.data.paymentId
          this.logger.log(`Cancelling payment with ID: ${paymentId}`)
          await this.sharedPaymentRepo.cancelPaymentAndOrder(paymentId)
          this.logger.log(`Successfully cancelled payment with ID: ${paymentId}`)
          return { success: true, paymentId }
        }
        default: {
          const errorMessage = `Unknown job name: ${job.name}`
          this.logger.error(errorMessage)
          throw new Error(errorMessage)
        }
      }
    } catch (error) {
      this.logger.error(
        `Failed to process job ${job.name} (ID: ${job.id}): ${error instanceof Error ? error.message : 'Unknown error'}`,
        error instanceof Error ? error.stack : undefined,
      )
      // Re-throw to let BullMQ handle retry logic
      throw error
    }
  }
}
