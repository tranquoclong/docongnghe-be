import { Processor, WorkerHost } from '@nestjs/bullmq'
import { Job } from 'bullmq'
import {
  WISHLIST_QUEUE_NAME,
  PRICE_CHECK_JOB_NAME,
  SEND_PRICE_ALERT_JOB_NAME,
} from 'src/shared/constants/queue.constant'
import { WishlistRepo } from 'src/routes/wishlist/wishlist.repo'
import { WishlistProducer } from 'src/routes/wishlist/wishlist.producer'
import { EmailService } from '../shared/services/email.service'
import { Logger } from '@nestjs/common'

@Processor(WISHLIST_QUEUE_NAME)
export class WishlistConsumer extends WorkerHost {
  private readonly logger = new Logger(WishlistConsumer.name)

  constructor(
    private readonly wishlistRepo: WishlistRepo,
    private readonly wishlistProducer: WishlistProducer,
    private readonly emailService: EmailService,
  ) {
    super()
  }

  async process(job: Job<any, any, string>): Promise<any> {
    switch (job.name) {
      case PRICE_CHECK_JOB_NAME: {
        return this.handlePriceCheck()
      }
      case SEND_PRICE_ALERT_JOB_NAME: {
        return this.handleSendPriceAlert(job.data)
      }
      default: {
        this.logger.warn(`Unknown job name: ${job.name}`)
        break
      }
    }
  }

  /**
   * Check prices for all wishlist items
   * This runs daily via cron job
   */
  private async handlePriceCheck() {
    this.logger.log('Starting price check job...')

    try {
      // Get all items that need price check
      const items = await this.wishlistRepo.getItemsForPriceCheck()

      this.logger.log(`Found ${items.length} items to check`)

      let alertsSent = 0
      const processedAlerts = new Set<string>()

      for (const item of items) {
        try {
          const currentPrice = item.sku?.price || item.product?.basePrice || 0

          const priceAlert = item.priceAlerts[0]

          if (!priceAlert) {
            continue
          }

          const alertKey = `${item.user.id}-${item.product.id}`

          if (processedAlerts.has(alertKey)) {
            this.logger.debug(`Skipping duplicate alert for user ${item.user.id}, product ${item.product.id}`)
            continue
          }

          const priceDropPercentage = ((priceAlert.originalPrice - currentPrice) / priceAlert.originalPrice) * 100

          await this.wishlistRepo.updatePriceAlert(item.id, currentPrice, false)

          const shouldAlert =
            priceDropPercentage >= 5 || (priceAlert.targetPrice && currentPrice <= priceAlert.targetPrice)

          if (shouldAlert) {
            processedAlerts.add(alertKey)

            await this.wishlistProducer.addSendPriceAlertJob({
              userId: item.user.id,
              userEmail: item.user.email,
              userName: item.user.name,
              productId: item.product.id,
              productName: item.product.name || 'Product',
              oldPrice: priceAlert.originalPrice,
              newPrice: currentPrice,
              priceDropPercentage: Math.round(priceDropPercentage * 100) / 100,
              wishlistItemId: item.id,
            })

            alertsSent++
          }
        } catch (error) {
          this.logger.error(`Error checking price for item ${item.id}:`, error)
        }
      }

      this.logger.log(`Price check completed. Sent ${alertsSent} alerts.`)

      return { success: true, itemsChecked: items.length, alertsSent }
    } catch (error) {
      this.logger.error('Error in price check job:', error)
      throw error
    }
  }

  /**
   * Send price drop alert email
   */
  private async handleSendPriceAlert(data: {
    userId: number
    userEmail: string
    userName: string
    productId: number
    productName: string
    oldPrice: number
    newPrice: number
    priceDropPercentage: number
    wishlistItemId: number
  }) {
    this.logger.log(`Sending price alert to ${data.userEmail} for product ${data.productName}`)

    try {
      // Send email (you'll need to create a price alert email template)
      // For now, using OTP template as placeholder
      await this.emailService.sendOTP({
        email: data.userEmail,
        code: `Price Drop Alert: ${data.productName} is now ${data.priceDropPercentage}% off!`,
      })

      // Update price alert as sent
      await this.wishlistRepo.updatePriceAlert(data.wishlistItemId, data.newPrice, true)

      this.logger.log(`Price alert sent successfully to ${data.userEmail}`)

      return { success: true }
    } catch (error) {
      this.logger.error(`Error sending price alert to ${data.userEmail}:`, error)
      throw error
    }
  }
}
