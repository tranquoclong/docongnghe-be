import { createZodDto } from 'nestjs-zod'
import {
  CancelOrderBodySchema,
  CancelOrderResSchema,
  ChangeStatusBodySchema,
  CreateOrderBodySchema,
  CreateOrderResSchema,
  GetManageOrderParamsSchema,
  GetOrderDetailResSchema,
  GetOrderListQuerySchema,
  GetOrderListResSchema,
  GetOrderParamsSchema,
} from 'src/routes/order/order.model'

export class GetOrderListResDTO extends createZodDto(GetOrderListResSchema) { }

export class GetOrderListQueryDTO extends createZodDto(GetOrderListQuerySchema) { }

export class GetOrderDetailResDTO extends createZodDto(GetOrderDetailResSchema) { }

export class CreateOrderBodyDTO extends createZodDto(CreateOrderBodySchema) { }

export class CreateOrderResDTO extends createZodDto(CreateOrderResSchema) { }

export class CancelOrderResDTO extends createZodDto(CancelOrderResSchema) { }

export class GetOrderParamsDTO extends createZodDto(GetOrderParamsSchema) { }

export class GetManageOrderParamsDTO extends createZodDto(GetManageOrderParamsSchema) { }

export class CancelOrderBodyDTO extends createZodDto(CancelOrderBodySchema) { }

export class ChangeStatusBodyDTO extends createZodDto(ChangeStatusBodySchema) { }
