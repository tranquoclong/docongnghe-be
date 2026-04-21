import { Injectable } from '@nestjs/common'

import { CreateOrderBodyType, GetOrderListQueryType, OrderCalculationType } from 'src/routes/order/order.model'
import { OrderRepo, CartItemWithRelations } from 'src/routes/order/order.repo'
import { VoucherRepository } from 'src/routes/voucher/voucher.repo'

@Injectable()
export class OrderService {
  constructor(
    private readonly orderRepo: OrderRepo,
    private readonly voucherRepository: VoucherRepository,
  ) { }

  async list(userId: number, query: GetOrderListQueryType) {
    return this.orderRepo.list(userId, query)
  }

  async create(userId: number, body: CreateOrderBodyType) {
    const { cartItems, cartItemMap } = await this.orderRepo.fetchAndValidateCartItems(userId, body)
    const ordersWithCalculations = await this.calculateOrderDiscounts(body, cartItemMap)
    const result = await this.orderRepo.create(userId, body, cartItems, ordersWithCalculations)
    return result
  }

  cancel(userId: number, orderId: number) {
    return this.orderRepo.cancel(userId, orderId)
  }

  detail(userId: number, orderId: number) {
    return this.orderRepo.detail(userId, orderId)
  }

  private async calculateOrderDiscounts(
    body: CreateOrderBodyType,
    cartItemMap: Map<number, CartItemWithRelations>,
  ): Promise<OrderCalculationType[]> {
    return Promise.all(
      body.map(async (item) => {
        const itemsTotal = item.cartItemIds.reduce((total, cartItemId) => {
          const cartItem = cartItemMap.get(cartItemId)!
          return total + cartItem.sku.price * cartItem.quantity
        }, 0)

        let discountAmount = 0
        const voucherId = item.voucherId || null

        if (voucherId) {
          const voucherResult = await this.voucherRepository.findById(voucherId)
          if (voucherResult) {
            if (voucherResult.type === 'PERCENTAGE') {
              discountAmount = (itemsTotal * voucherResult.value) / 100
              if (voucherResult.maxDiscount && discountAmount > voucherResult.maxDiscount) {
                discountAmount = voucherResult.maxDiscount
              }
            } else if (voucherResult.type === 'FIXED_AMOUNT') {
              discountAmount = Math.min(voucherResult.value, itemsTotal)
            }
            discountAmount = Math.round(discountAmount)
          }
        }

        const totalAmount = itemsTotal - discountAmount

        return {
          item,
          totalAmount,
          discountAmount,
          voucherId,
        }
      }),
    )
  }
}
