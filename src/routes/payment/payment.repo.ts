import { BadRequestException, Injectable } from '@nestjs/common'
import { parse } from 'date-fns'
import { WebhookPaymentBodyType } from 'src/routes/payment/payment.model'
import { PaymentProducer } from 'src/routes/payment/payment.producer'
import { OrderStatus } from 'src/shared/constants/order.constant'
import { PREFIX_PAYMENT_CODE } from 'src/shared/constants/other.constant'
import { PaymentStatus } from 'src/shared/constants/payment.constant'
import { SerializeAll } from 'src/shared/decorators/serialize.decorator'
import { PrismaService } from 'src/shared/services/prisma.service'

@Injectable()
@SerializeAll(['getTotalPrice'])
export class PaymentRepo {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly paymentProducer: PaymentProducer,
  ) {}

  private getTotalPrice(orders: any[]): number {
    const result = orders.reduce((total, order) => {
      // Handle Prisma Decimal type by converting to number
      const amount =
        typeof order.totalAmount === 'object' && order.totalAmount !== null
          ? Number(order.totalAmount.toString())
          : Number(order.totalAmount)
      return total + amount
    }, 0)
    return result
  }

  async receiver(body: WebhookPaymentBodyType): Promise<number> {
    // 1. Thêm thông tin giao dịch vào DB
    // Tham khảo: https://docs.sepay.vn/lap-trinh-webhooks.html
    let amountIn = 0
    let amountOut = 0
    if (body.transferType === 'in') {
      amountIn = body.transferAmount
    } else if (body.transferType === 'out') {
      amountOut = body.transferAmount
    }
    const paymentTransaction = await this.prismaService.paymentTransaction.findUnique({
      where: {
        id: body.id,
      },
    })
    if (paymentTransaction) {
      throw new BadRequestException('Transaction already exists')
    }
    const userId = await this.prismaService.$transaction(async (tx) => {
      // Parse transactionDate - support both ISO format and 'yyyy-MM-dd HH:mm:ss' format
      let transactionDate: Date
      try {
        // Try ISO format first
        transactionDate = new Date(body.transactionDate)
        if (isNaN(transactionDate.getTime())) {
          // If ISO fails, try custom format
          transactionDate = parse(body.transactionDate, 'yyyy-MM-dd HH:mm:ss', new Date())
        }
      } catch {
        transactionDate = parse(body.transactionDate, 'yyyy-MM-dd HH:mm:ss', new Date())
      }

      await tx.paymentTransaction.create({
        data: {
          id: body.id,
          gateway: body.gateway,
          transactionDate,
          accountNumber: body.accountNumber,
          subAccount: body.subAccount,
          amountIn,
          amountOut,
          accumulated: body.accumulated,
          code: body.code,
          transactionContent: body.content,
          referenceNumber: body.referenceCode,
          body: body.description,
        },
      })

      // 2. Kiểm tra nội dung chuyển khoản và tổng số tiền có khớp hay không
      const paymentId = body.code
        ? Number(body.code.split(PREFIX_PAYMENT_CODE)[1])
        : Number(body.content?.split(PREFIX_PAYMENT_CODE)[1])
      if (isNaN(paymentId)) {
        throw new BadRequestException('Cannot get payment id from content')
      }

      const payment = await tx.payment.findUnique({
        where: {
          id: paymentId,
        },
        include: {
          orders: {
            where: {
              deletedAt: null,
            },
            include: {
              items: true,
            },
          },
        },
      })
      if (!payment) {
        throw new BadRequestException(`Cannot find payment with id ${paymentId}`)
      }
      const { orders } = payment
      if (!orders || orders.length === 0) {
        throw new BadRequestException(`No orders found for payment ${paymentId}`)
      }
      const userId = orders[0].userId
      const totalPrice = this.getTotalPrice(orders as any)
      if (totalPrice !== body.transferAmount) {
        throw new BadRequestException(`Price not match, expected ${totalPrice} but got ${body.transferAmount}`)
      }

      // 3. Cập nhật trạng thái đơn hàng
      await Promise.all([
        tx.payment.update({
          where: {
            id: paymentId,
          },
          data: {
            status: PaymentStatus.SUCCESS,
          },
        }),
        tx.order.updateMany({
          where: {
            id: {
              in: orders.map((order) => order.id),
            },
            deletedAt: null,
          },
          data: {
            status: OrderStatus.PENDING_PICKUP,
          },
        }),
        this.paymentProducer.removeJob(paymentId),
      ])
      return userId
    })

    return userId
  }
}
