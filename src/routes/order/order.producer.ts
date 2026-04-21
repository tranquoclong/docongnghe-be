import { InjectQueue } from '@nestjs/bullmq'
import { Injectable, Logger } from '@nestjs/common'
import { CANCEL_PAYMENT_JOB_NAME, PAYMENT_QUEUE_NAME } from 'src/shared/constants/queue.constant'
import { Queue } from 'bullmq'
import { generateCancelPaymentJobId } from 'src/shared/helpers'

// Payment cancellation delay: 24 hours in milliseconds
const PAYMENT_CANCEL_DELAY_MS = 1000 * 60 * 60 * 24

@Injectable()
export class OrderProducer {
  private readonly logger = new Logger(OrderProducer.name)

  constructor(@InjectQueue(PAYMENT_QUEUE_NAME) private paymentQueue: Queue) {}

  async addCancelPaymentJob(paymentId: number): Promise<void> {
    const jobId = generateCancelPaymentJobId(paymentId)

    try {
      // Check if job already exists to prevent duplicates
      const existingJob = await this.paymentQueue.getJob(jobId)
      if (existingJob) {
        this.logger.warn(`Cancel payment job already exists for paymentId: ${paymentId}`)
        return
      }

      await this.paymentQueue.add(
        CANCEL_PAYMENT_JOB_NAME,
        { paymentId },
        {
          delay: PAYMENT_CANCEL_DELAY_MS,
          jobId,
          removeOnComplete: {
            age: 3600, // Keep completed jobs for 1 hour
            count: 100,
          },
          removeOnFail: {
            age: 86400, // Keep failed jobs for 24 hours for debugging
            count: 500,
          },
        },
      )

      this.logger.log(`Cancel payment job scheduled for paymentId: ${paymentId}, will execute in 24 hours`)
    } catch (error) {
      this.logger.error(`Failed to add cancel payment job for paymentId: ${paymentId}`, error)
      throw error
    }
  }

  async removeCancelPaymentJob(paymentId: number): Promise<boolean> {
    const jobId = generateCancelPaymentJobId(paymentId)

    try {
      const result = await this.paymentQueue.remove(jobId)
      if (result) {
        this.logger.log(`Cancel payment job removed for paymentId: ${paymentId}`)
      } else {
        this.logger.warn(`Cancel payment job not found for paymentId: ${paymentId}`)
      }
      return !!result
    } catch (error) {
      this.logger.error(`Failed to remove cancel payment job for paymentId: ${paymentId}`, error)
      return false
    }
  }
}
