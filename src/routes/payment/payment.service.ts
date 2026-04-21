import { Injectable, Logger } from '@nestjs/common'
import { PaymentRepo } from 'src/routes/payment/payment.repo'
import { WebhookPaymentBodyType } from 'src/routes/payment/payment.model'
import { PaymentGateway } from 'src/websockets/payment.gateway'
import { MESSAGES } from 'src/shared/constants/app.constant'

@Injectable()
export class PaymentService {
  private readonly logger = new Logger(PaymentService.name)

  constructor(
    private readonly paymentRepo: PaymentRepo,
    private readonly paymentGateway: PaymentGateway,
  ) {}

  async receiver(body: WebhookPaymentBodyType) {
    try {
      const userId = await this.paymentRepo.receiver(body)
      this.paymentGateway.emitPaymentSuccess(userId)

      return {
        message: MESSAGES.PAYMENT_RECEIVED,
      }
    } catch (error) {
      this.logger.error(
        `Failed to process payment webhook: ${error instanceof Error ? error.message : error}`,
        error instanceof Error ? error.stack : undefined,
      )
      throw error
    }
  }
}
