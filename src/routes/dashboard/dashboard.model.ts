import { ProductSchema } from 'src/shared/models/shared-product.model'
import { z } from 'zod'

export const GetDashboardResSchema = z.object({
  data: z.object({
    revenue: z.number(),
    clientCount: z.number(),
    orderCount: z.number(),
    servingOrderCount: z.number(),
    productIndicator: z.array(
      ProductSchema.omit({
        variants: true,
        createdAt: true,
        updatedAt: true,
        createdById: true,
        updatedById: true,
        deletedById: true,
        deletedAt: true,
      }).extend({
        successOrders: z.number()
      })
    ),
    revenueByDate: z.array(
      z.object({
        date: z.string(),
        revenue: z.number()
      })
    )
  }),
  message: z.string()
})

export const GetDashboardQuerySchema = z.object({
  fromDate: z.iso.datetime(),
  toDate: z.iso.datetime(),
})

export type GetDashboardResType = z.infer<typeof GetDashboardResSchema>
export type GetDashboardQueryType = z.infer<typeof GetDashboardQuerySchema>
