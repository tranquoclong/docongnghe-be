import { Body, Controller, Get, Param, Post, Put, Query } from '@nestjs/common'
import { ZodResponse } from 'nestjs-zod'
import {
  CancelOrderBodyDTO,
  CancelOrderResDTO,
  ChangeStatusBodyDTO,
  CreateOrderBodyDTO,
  CreateOrderResDTO,
  GetManageOrderParamsDTO,
  GetOrderDetailResDTO,
  GetOrderListQueryDTO,
  GetOrderListResDTO,
  GetOrderParamsDTO,
} from 'src/routes/order/order.dto'
import { ManageOrderService } from 'src/routes/order/manage-order.service'
import { ActiveUser } from 'src/shared/decorators/active-user.decorator'
import { AccessTokenPayload } from 'src/shared/types/jwt.type'
import { ApiBearerAuth } from '@nestjs/swagger'

@Controller('manage-order/orders')
@ApiBearerAuth()
export class ManageOrderController {
  constructor(private readonly manageOrderService: ManageOrderService) { }

  @Get()
  @ZodResponse({ type: GetOrderListResDTO })
  getCart(@ActiveUser() user: AccessTokenPayload, @Query() query: GetOrderListQueryDTO) {
    return this.manageOrderService.list({ query, roleNameRequest: user.roleName })
  }

  @Get(':orderId/user/:userId')
  @ZodResponse({ type: GetOrderDetailResDTO })
  detail(@ActiveUser() user: AccessTokenPayload, @Param() param: GetManageOrderParamsDTO) {
    return this.manageOrderService.detail({ userId: param.userId, orderId: param.orderId, roleNameRequest: user.roleName })
  }

  @Put(':orderId/status/:userId')
  @ZodResponse({ type: CancelOrderResDTO })
  changeStatus(@ActiveUser() user: AccessTokenPayload, @Param() param: GetManageOrderParamsDTO, @Body() body: ChangeStatusBodyDTO) {
    return this.manageOrderService.changeStatus({ updatedById: user.userId, userId: param.userId, orderId: param.orderId, status: body.status, roleNameRequest: user.roleName })
  }
}
