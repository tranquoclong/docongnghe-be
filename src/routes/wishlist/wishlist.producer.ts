import { InjectQueue } from '@nestjs/bullmq'
import { Injectable, Logger } from '@nestjs/common'
import { Queue } from 'bullmq'
import {
  WISHLIST_QUEUE_NAME,
  PRICE_CHECK_JOB_NAME,
  SEND_PRICE_ALERT_JOB_NAME,
} from 'src/shared/constants/queue.constant'

// Constants for job configuration
const PRICE_CHECK_JOB_ID = 'daily-price-check'

@Injectable()
export class WishlistProducer {
  private readonly logger = new Logger(WishlistProducer.name)

  constructor(@InjectQueue(WISHLIST_QUEUE_NAME) private wishlistQueue: Queue) {}

  /**
   * Add price check job to queue
   * This will be triggered by cron job daily
   * Uses a fixed jobId to prevent duplicate jobs
   */
  async addPriceCheckJob(): Promise<void> {
    try {
      // Check if job already exists to prevent duplicates
      const existingJob = await this.wishlistQueue.getJob(PRICE_CHECK_JOB_ID)
      if (existingJob) {
        const state = await existingJob.getState()
        if (state === 'active' || state === 'waiting' || state === 'delayed') {
          this.logger.warn('Price check job already in queue, skipping...')
          return
        }
        // Remove completed/failed job to allow new one
        await existingJob.remove()
      }

      await this.wishlistQueue.add(
        PRICE_CHECK_JOB_NAME,
        {},
        {
          jobId: PRICE_CHECK_JOB_ID,
          removeOnComplete: {
            age: 3600, // Keep for 1 hour
            count: 10,
          },
          removeOnFail: {
            age: 86400, // Keep failed for 24 hours
            count: 50,
          },
        },
      )

      this.logger.log('Price check job added to queue')
    } catch (error) {
      this.logger.error('Failed to add price check job:', error)
      throw error
    }
  }

  /**
   * Add send price alert job to queue
   */
  async addSendPriceAlertJob(data: {
    userId: number
    userEmail: string
    userName: string
    productId: number
    productName: string
    oldPrice: number
    newPrice: number
    priceDropPercentage: number
    wishlistItemId: number
  }): Promise<void> {
    // Create unique job ID to prevent duplicate alerts
    const jobId = `price-alert-${data.userId}-${data.productId}-${Date.now()}`

    try {
      await this.wishlistQueue.add(SEND_PRICE_ALERT_JOB_NAME, data, {
        jobId,
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
        removeOnComplete: {
          age: 3600,
          count: 100,
        },
        removeOnFail: {
          age: 86400,
          count: 500,
        },
      })

      this.logger.log(`Price alert job added for user ${data.userId}, product ${data.productId}`)
    } catch (error) {
      this.logger.error(`Failed to add price alert job for user ${data.userId}:`, error)
      throw error
    }
  }
}
