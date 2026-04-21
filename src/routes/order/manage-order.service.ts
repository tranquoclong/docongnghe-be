import { ForbiddenException, Injectable } from '@nestjs/common'
import { OrderStatus } from '@prisma/client'

import { CreateOrderBodyType, GetOrderListQueryType, OrderCalculationType } from 'src/routes/order/order.model'
import { OrderRepo, CartItemWithRelations } from 'src/routes/order/order.repo'
import { VoucherRepository } from 'src/routes/voucher/voucher.repo'
import { RoleName } from 'src/shared/constants/role.constant'

@Injectable()
export class ManageOrderService {
  constructor(
    private readonly orderRepo: OrderRepo,
    private readonly voucherRepository: VoucherRepository,
  ) { }

  validatePrivilege({
    roleNameRequest,
  }: {
    roleNameRequest: string
  }) {
    console.log(roleNameRequest)
    if (roleNameRequest !== RoleName.Admin) {
      throw new ForbiddenException()
    }
    return true
  }


  async list(props: { query: GetOrderListQueryType, roleNameRequest: string }) {
    this.validatePrivilege({
      roleNameRequest: props.roleNameRequest,
    })
    return this.orderRepo.list(null, props.query)
  }

  detail(props: { userId: number, orderId: number, roleNameRequest: string }) {
    this.validatePrivilege({
      roleNameRequest: props.roleNameRequest,
    })
    return this.orderRepo.detail(props.userId, props.orderId)
  }

  async changeStatus(props: { updatedById: number; userId: number; orderId: number; status: OrderStatus; roleNameRequest: string }) {
    this.validatePrivilege({
      roleNameRequest: props.roleNameRequest,
    })

    const data = await this.orderRepo.changeStatus(props.updatedById, props.userId, props.orderId, props.status)
    return data
  }
}
