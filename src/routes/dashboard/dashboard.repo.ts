// dashboard.repo.ts
import { Injectable } from '@nestjs/common'
import { SerializeAll } from 'src/shared/decorators/serialize.decorator'
import { GetDashboardQueryType, GetDashboardResType } from 'src/routes/dashboard/dashboard.model'
import { PrismaService } from 'src/shared/services/prisma.service'
import { OrderStatus } from '@prisma/client'

@Injectable()
@SerializeAll()
export class DashboardRepo {
  constructor(private readonly prismaService: PrismaService) { }

  async list(query: GetDashboardQueryType): Promise<GetDashboardResType> {
    const fromDate = new Date(query.fromDate)
    const toDate = new Date(query.toDate)

    const dateFilter = {
      gte: fromDate,
      lte: toDate,
    }

    const [orderStats, clientCount, servingOrderCount, products] =
      await Promise.all([
        this.prismaService.$queryRaw<{ date: string; revenue: number; order_count: number }[]>`
  SELECT
    DATE("createdAt")::text    AS date,
    SUM("totalAmount")::float  AS revenue,
    COUNT(*)::int              AS order_count
  FROM "Order"
  WHERE status = ${OrderStatus.DELIVERED}::"OrderStatus"
    AND "createdAt" >= ${fromDate}
    AND "createdAt" <= ${toDate}
  GROUP BY DATE("createdAt")
  ORDER BY date ASC
`,
        // this.prismaService.order.findMany({
        //   where: {
        //     status: OrderStatus.DELIVERED,
        //     createdAt: dateFilter,
        //   },
        //   select: {
        //     totalAmount: true,
        //     createdAt: true,
        //   },
        // }),

        this.prismaService.user.count({
          where: {
            deletedAt: null,
            role: { name: 'CLIENT' },
            createdAt: dateFilter,
          },
        }),

        this.prismaService.order.count({
          where: {
            status: {
              notIn: [OrderStatus.CANCELLED, OrderStatus.DELIVERED],
            },
          },
        }),

        this.prismaService.product.findMany({
          where: {
            deletedAt: null,
            createdAt: dateFilter,
          },
          select: {
            id: true,
            name: true,
            images: true,
            basePrice: true,
            virtualPrice: true,
            brandId: true,
            publishedAt: true,
            ProductSKUSnapshot: {
              where: {
                order: {
                  status: OrderStatus.DELIVERED,
                  createdAt: dateFilter,
                },
              },
              select: { quantity: true },
            },
          },
        }),
      ])

    const revenue = orderStats.reduce((sum, row) => sum + row.revenue, 0)
    const orderCount = orderStats.reduce((sum, row) => sum + row.order_count, 0)
    const revenueByDate = orderStats.map((row) => ({
      date: row.date,
      revenue: row.revenue,
    }))
    // const revenue = orders.reduce((sum, o) => sum + o.totalAmount, 0)
    // const orderCount = orders.length
    // const revenueByDateMap = orders.reduce<Record<string, number>>(
    //   (acc, order) => {
    //     const date = order.createdAt.toISOString().split('T')[0]
    //     acc[date] = (acc[date] ?? 0) + order.totalAmount
    //     return acc
    //   },
    //   {},
    // )
    // const revenueByDate = Object.entries(revenueByDateMap)
    //   .map(([date, revenue]) => ({ date, revenue }))
    //   .sort((a, b) => a.date.localeCompare(b.date))

    const productIndicator = products.map(({ ProductSKUSnapshot, ...product }) => ({
      ...product,
      publishedAt: product.publishedAt?.toISOString() ?? null,
      successOrders: ProductSKUSnapshot.reduce((sum, s) => sum + s.quantity, 0),
    }))

    return {
      message: 'Lấy dữ liệu dashboard thành công',
      data: {
        revenue,
        clientCount,
        orderCount,
        servingOrderCount,
        productIndicator,
        revenueByDate,
      },
    }
  }
}