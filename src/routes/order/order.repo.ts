import { Injectable } from '@nestjs/common'
import { OrderStatus, Prisma } from '@prisma/client'
import { OutOfStockSKUException } from 'src/routes/cart/cart.error'
import {
  CannotCancelOrderException,
  CannotChangeOrderStatusException,
  NotFoundCartItemException,
  OrderNotFoundException,
  ProductNotFoundException,
  SKUNotBelongToShopException,
} from 'src/routes/order/order.error'
import {
  CancelOrderResType,
  CreateOrderBodyType,
  CreateOrderResType,
  GetOrderDetailResType,
  GetOrderListQueryType,
  GetOrderListResType,
  OrderCalculationType,
} from 'src/routes/order/order.model'
import { OrderProducer } from 'src/routes/order/order.producer'
import { PaymentStatus } from 'src/shared/constants/payment.constant'
import { SerializeAll } from 'src/shared/decorators/serialize.decorator'
import { isNotFoundPrismaError } from 'src/shared/helpers'
import { PrismaService } from 'src/shared/services/prisma.service'

export type CartItemWithRelations = {
  id: number
  userId: number
  skuId: number
  quantity: number
  sku: {
    id: number
    value: string
    price: number
    stock: number
    image: string
    productId: number
    createdById: number
    product: {
      id: number
      name: string
      publishedAt: Date | null
      deletedAt: Date | null
      productTranslations: Array<{
        id: number
        name: string
        description: string
        languageId: string
      }>
    }
  }
}

@Injectable()
@SerializeAll([
  'validateStock',
  'validateProductAvailability',
  'validateShopOwnership',
  'buildOrderCreateData',
  'fetchAndValidateCartItems',
])
export class OrderRepo {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly orderProducer: OrderProducer,
  ) { }

  async list(userId: number | null, query: GetOrderListQueryType): Promise<GetOrderListResType> {
    const { page, limit, status } = query
    const skip = (page - 1) * limit
    const take = limit
    const where: Prisma.OrderWhereInput = {
      userId: userId || undefined,
      status,
    }

    // Đếm tổng số order
    const totalItem$ = this.prismaService.order.count({
      where,
    })
    // Lấy list order
    const data$ = await this.prismaService.order.findMany({
      where,
      include: {
        items: true,
      },
      skip,
      take,
      orderBy: {
        createdAt: 'desc',
      },
    })
    const [data, totalItems] = await Promise.all([data$, totalItem$])
    return {
      data,
      page,
      limit,
      totalItems,
      totalPages: Math.ceil(totalItems / limit),
    } as any
  }

  async create(
    userId: number,
    body: CreateOrderBodyType,
    cartItems: CartItemWithRelations[],
    ordersWithCalculations: OrderCalculationType[],
  ): Promise<{
    paymentId: number
    orders: CreateOrderResType['orders']
  }> {
    const allBodyCartItemIds = body.map((item) => item.cartItemIds).flat()
    const cartItemMap = new Map<number, CartItemWithRelations>()
    cartItems.forEach((item) => {
      cartItemMap.set(item.id, item)
    })

    const [paymentId, orders] = await this.prismaService.$transaction(async (tx) => {
      const payment = await tx.payment.create({
        data: {
          status: PaymentStatus.PENDING,
        },
      })

      const orders$ = Promise.all(
        ordersWithCalculations.map(({ item, totalAmount, discountAmount, voucherId }) =>
          tx.order.create({
            data: this.buildOrderCreateData(
              item,
              cartItemMap,
              userId,
              payment.id,
              totalAmount,
              discountAmount,
              voucherId,
            ),
          }),
        ),
      )

      const cartItem$ = tx.cartItem.deleteMany({
        where: {
          id: {
            in: allBodyCartItemIds,
          },
        },
      })

      const sku$ = Promise.all(
        cartItems.map(async (item) => {
          const result = await tx.$executeRaw`
            UPDATE "SKU"
            SET stock = stock - ${item.quantity},
                "updatedAt" = NOW()
            WHERE id = ${item.sku.id}
            AND stock >= ${item.quantity}
            AND "deletedAt" IS NULL
          `
          if (result === 0) {
            throw OutOfStockSKUException
          }
          return result
        }),
      )

      const voucher$ = Promise.all(
        ordersWithCalculations
          .filter(({ voucherId }) => voucherId !== null)
          .map(({ voucherId }) => {
            const validVoucherId = voucherId as number
            return Promise.all([
              tx.voucher.update({
                where: { id: validVoucherId },
                data: { usedCount: { increment: 1 } },
              }),
              tx.userVoucher.updateMany({
                where: {
                  userId,
                  voucherId: validVoucherId,
                },
                data: {
                  usedCount: { increment: 1 },
                  usedAt: new Date(),
                },
              }),
            ])
          }),
      )

      const addCancelPaymentJob$ = this.orderProducer.addCancelPaymentJob(payment.id)
      const [orders] = await Promise.all([orders$, cartItem$, sku$, voucher$, addCancelPaymentJob$])
      return [payment.id, orders]
    })

    return {
      paymentId,
      orders,
    } as any
  }

  async fetchAndValidateCartItems(
    userId: number,
    body: CreateOrderBodyType,
  ): Promise<{ cartItems: CartItemWithRelations[]; cartItemMap: Map<number, CartItemWithRelations> }> {
    const cartItemIds = body.map((item) => item.cartItemIds).flat()
    const cartItems = (await this.prismaService.cartItem.findMany({
      where: {
        id: {
          in: cartItemIds,
        },
        userId,
      },
      include: {
        sku: {
          include: {
            product: {
              include: {
                productTranslations: true,
              },
            },
          },
        },
      },
    })) as CartItemWithRelations[]

    if (cartItems.length !== cartItemIds.length) {
      throw NotFoundCartItemException
    }

    const cartItemMap = new Map<number, CartItemWithRelations>()
    cartItems.forEach((item) => {
      cartItemMap.set(item.id, item)
    })

    this.validateStock(cartItems)
    this.validateProductAvailability(cartItems)
    this.validateShopOwnership(body, cartItemMap)

    return { cartItems, cartItemMap }
  }

  private validateStock(cartItems: CartItemWithRelations[]): void {
    const isOutOfStock = cartItems.some((item) => item.sku.stock < item.quantity)
    if (isOutOfStock) {
      throw OutOfStockSKUException
    }
  }

  private validateProductAvailability(cartItems: CartItemWithRelations[]): void {
    const isExistNotReadyProduct = cartItems.some(
      (item) =>
        item.sku.product.deletedAt !== null ||
        item.sku.product.publishedAt === null ||
        item.sku.product.publishedAt > new Date(),
    )
    if (isExistNotReadyProduct) {
      throw ProductNotFoundException
    }
  }

  private validateShopOwnership(body: CreateOrderBodyType, cartItemMap: Map<number, CartItemWithRelations>): void {
    const isValidShop = body.every((item) => {
      return item.cartItemIds.every((cartItemId) => {
        const cartItem = cartItemMap.get(cartItemId)
        if (!cartItem) throw NotFoundCartItemException
        return item.shopId === cartItem.sku.createdById
      })
    })
    if (!isValidShop) {
      throw SKUNotBelongToShopException
    }
  }

  private buildOrderCreateData(
    item: CreateOrderBodyType[number],
    cartItemMap: Map<number, CartItemWithRelations>,
    userId: number,
    paymentId: number,
    totalAmount: number,
    discountAmount: number,
    voucherId: number | null,
  ) {
    return {
      userId,
      status: OrderStatus.PENDING_PAYMENT,
      receiver: item.receiver,
      createdById: userId,
      shopId: item.shopId,
      paymentId,
      totalAmount,
      discountAmount,
      voucherId,
      items: {
        create: item.cartItemIds.map((cartItemId) => {
          const cartItem = cartItemMap.get(cartItemId)
          if (!cartItem) throw NotFoundCartItemException
          return {
            productName: cartItem.sku.product.name,
            skuPrice: cartItem.sku.price,
            image: cartItem.sku.image,
            skuId: cartItem.sku.id,
            skuValue: cartItem.sku.value,
            quantity: cartItem.quantity,
            productId: cartItem.sku.product.id,
            productTranslations: cartItem.sku.product.productTranslations.map((translation) => ({
              id: translation.id,
              name: translation.name,
              description: translation.description,
              languageId: translation.languageId,
            })),
          }
        }),
      },
      products: {
        connect: item.cartItemIds.map((cartItemId) => {
          const cartItem = cartItemMap.get(cartItemId)
          if (!cartItem) throw NotFoundCartItemException
          return {
            id: cartItem.sku.product.id,
          }
        }),
      },
    }
  }

  async detail(userId: number, orderid: number): Promise<GetOrderDetailResType> {
    const order = await this.prismaService.order.findUnique({
      where: {
        id: orderid,
        userId,
        deletedAt: null,
      },
      include: {
        items: true,
      },
    })
    if (!order) {
      throw OrderNotFoundException
    }
    return order as any
  }

  async cancel(userId: number, orderId: number): Promise<CancelOrderResType> {
    try {
      const order = await this.prismaService.order.findUniqueOrThrow({
        where: {
          id: orderId,
          userId,
          deletedAt: null,
        },
      })
      if (order.status !== OrderStatus.PENDING_PAYMENT) {
        throw CannotCancelOrderException
      }
      const updatedOrder = await this.prismaService.order.update({
        where: {
          id: orderId,
          userId,
          deletedAt: null,
        },
        data: {
          status: OrderStatus.CANCELLED,
          updatedById: userId,
        },
      })
      return updatedOrder as any
    } catch (error) {
      if (isNotFoundPrismaError(error)) {
        throw OrderNotFoundException
      }
      throw error
    }
  }

  async changeStatus(updatedById: number, userId: number, orderId: number, status: OrderStatus): Promise<CancelOrderResType> {
    try {
      const order = await this.prismaService.order.findUniqueOrThrow({
        where: {
          id: orderId,
          userId,
          deletedAt: null,
        },
      })
      if (order.status === OrderStatus.CANCELLED) {
        throw CannotChangeOrderStatusException
      }
      const updatedOrder = await this.prismaService.order.update({
        where: {
          id: orderId,
          userId,
          deletedAt: null,
        },
        data: {
          status,
          updatedById,
        },
      })
      return updatedOrder as any
    } catch (error) {
      if (isNotFoundPrismaError(error)) {
        throw OrderNotFoundException
      }
      throw error
    }
  }
}
