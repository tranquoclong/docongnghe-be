import { BrandIncludeTranslationSchema, BrandSchema } from 'src/shared/models/shared-brand.model'
import { z } from 'zod'

export const GetBrandsResSchema = z.object({
  data: z.array(
    BrandIncludeTranslationSchema.pick({
      id: true,
      name: true,
      logo: true,
      brandTranslations: true,
    }),
  ),
  totalItems: z.number(),
  page: z.number(),
  limit: z.number(),
  totalPages: z.number(),
})

export const GetBrandParamsSchema = z
  .object({
    brandId: z.coerce.number().int().positive(),
  })
  .strict()

export const GetBrandDetailResSchema = BrandIncludeTranslationSchema

export const CreateBrandBodySchema = BrandSchema.pick({
  name: true,
  logo: true,
}).strict()

export const GetBrandsQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().default(10),
  name: z.string().optional(),
  categories: z
    .preprocess((value) => {
      if (typeof value === 'string') {
        return [Number(value)]
      }
      return value
    }, z.array(z.coerce.number().int().positive()))
    .optional(),
})

export const UpdateBrandBodySchema = CreateBrandBodySchema

export type BrandType = z.infer<typeof BrandSchema>
export type GetBrandsQueryType = z.infer<typeof GetBrandsQuerySchema>
export type BrandIncludeTranslationType = z.infer<typeof BrandIncludeTranslationSchema>
export type GetBrandsResType = z.infer<typeof GetBrandsResSchema>
export type GetBrandDetailResType = z.infer<typeof GetBrandDetailResSchema>
export type CreateBrandBodyType = z.infer<typeof CreateBrandBodySchema>
export type GetBrandParamsType = z.infer<typeof GetBrandParamsSchema>
export type UpdateBrandBodyType = z.infer<typeof UpdateBrandBodySchema>
