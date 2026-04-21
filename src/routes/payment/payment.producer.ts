import { InjectQueue } from '@nestjs/bullmq'
import { Injectable, Logger } from '@nestjs/common'
import { Queue } from 'bullmq'
import { PAYMENT_QUEUE_NAME } from 'src/shared/constants/queue.constant'
import { generateCancelPaymentJobId } from 'src/shared/helpers'

@Injectable()
export class PaymentProducer {
  private readonly logger = new Logger(PaymentProducer.name)

  constructor(@InjectQueue(PAYMENT_QUEUE_NAME) private paymentQueue: Queue) {}

  /**
   * Remove a scheduled cancel payment job
   * Called when payment is completed successfully
   */
  async removeJob(paymentId: number): Promise<boolean> {
    const jobId = generateCancelPaymentJobId(paymentId)

    try {
      const job = await this.paymentQueue.getJob(jobId)

      if (!job) {
        this.logger.warn(`Cancel payment job not found for paymentId: ${paymentId}`)
        return false
      }

      const state = await job.getState()

      // Only remove if job is still pending (waiting or delayed)
      if (state === 'waiting' || state === 'delayed') {
        await job.remove()
        this.logger.log(`Cancel payment job removed for paymentId: ${paymentId}`)
        return true
      }

      this.logger.warn(`Cannot remove job for paymentId: ${paymentId}, current state: ${state}`)
      return false
    } catch (error) {
      this.logger.error(`Failed to remove cancel payment job for paymentId: ${paymentId}`, error)
      return false
    }
  }

  /**
   * Get the status of a cancel payment job
   */
  async getJobStatus(paymentId: number): Promise<string | null> {
    const jobId = generateCancelPaymentJobId(paymentId)

    try {
      const job = await this.paymentQueue.getJob(jobId)
      if (!job) {
        return null
      }
      return await job.getState()
    } catch (error) {
      this.logger.error(`Failed to get job status for paymentId: ${paymentId}`, error)
      return null
    }
  }
}
