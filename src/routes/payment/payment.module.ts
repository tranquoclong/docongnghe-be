import { Module } from '@nestjs/common'
import { PaymentController } from './payment.controller'
import { PaymentService } from './payment.service'
import { PaymentRepo } from 'src/routes/payment/payment.repo'
import { BullModule } from '@nestjs/bullmq'
import { PAYMENT_QUEUE_NAME } from 'src/shared/constants/queue.constant'
import { PaymentProducer } from 'src/routes/payment/payment.producer'
import { PaymentGateway } from 'src/websockets/payment.gateway'

@Module({
  imports: [
    BullModule.registerQueue({
      name: PAYMENT_QUEUE_NAME,
    }),
  ],
  providers: [PaymentService, PaymentRepo, PaymentProducer, PaymentGateway],
  controllers: [PaymentController],
})
export class PaymentModule {}
