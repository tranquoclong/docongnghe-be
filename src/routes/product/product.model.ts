import { UpsertSKUBodySchema } from 'src/routes/product/sku.model'
import { OrderBy, SortBy } from 'src/shared/constants/other.constant'
import { BrandIncludeTranslationSchema, BrandSchema } from 'src/shared/models/shared-brand.model'
import { CategoryIncludeTranslationSchema, CategorySchema } from 'src/shared/models/shared-category.model'
import { ProductTranslationSchema } from 'src/shared/models/shared-product-translation.model'
import { VariantsSchema, VariantsType } from 'src/shared/models/shared-product.model'
import { SKUSchema } from 'src/shared/models/shared-sku.model'
import { z } from 'zod'

function generateSKUs(variants: VariantsType) {
  function getCombinations(arrays: string[][]): string[] {
    return arrays.reduce((acc, curr) => acc.flatMap((x) => curr.map((y) => `${x}${x ? '-' : ''}${y}`)), [''])
  }
  const options = variants.map((variant) => variant.options)
  const combinations = getCombinations(options)
  return combinations.map((value) => ({
    value,
    price: 0,
    stock: 100,
    image: '',
  }))
}

// ─── Spec translation ─────────────────────────────────────────────────────────
// Dùng cho cả input (create/update) và output (response)
export const SpecTranslationSchema = z.object({
  id: z.number(),
  specId: z.number(),
  languageId: z.string(),
  label: z.string(),
  value: z.string(),
})

// ─── SpecGroup translation ────────────────────────────────────────────────────
export const SpecGroupTranslationSchema = z.object({
  id: z.number(),
  groupId: z.number(),
  languageId: z.string(),
  label: z.string(),
})

// ─── Spec (response shape từ DB) ─────────────────────────────────────────────
// Dùng trong GetProductDetailResSchema
export const SpecItemResSchema = z.object({
  id: z.number(),
  groupId: z.number(),
  key: z.string(),
  sortOrder: z.number(),
  deletedAt: z.iso.datetime().nullable(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
  translations: z.array(SpecTranslationSchema),
})

// ─── SpecGroup (response shape từ DB) ────────────────────────────────────────
// Dùng trong GetProductDetailResSchema
export const SpecGroupResSchema = z.object({
  id: z.number(),
  productId: z.number(),
  key: z.string(),
  sortOrder: z.number(),
  deletedAt: z.iso.datetime().nullable(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
  translations: z.array(SpecGroupTranslationSchema),
  specs: z.array(SpecItemResSchema),
})

// ─── Spec input (body gửi lên khi create/update) ──────────────────────────────
// FIX: tách riêng input schema (không có id, groupId, timestamps)
// Spec value có thể khác nhau theo language → dùng translations[]
// Nếu không cần dịch label/value riêng từng spec → dùng label + value chung
// (BE sẽ tạo translation cho tất cả language của group)
export const SpecItemInputSchema = z.object({
  key: z.string().min(1),
  sortOrder: z.number().int().nonnegative().optional().default(0),
  // FIX: label + value chung (BE tự map sang tất cả language của group)
  label: z.string().optional(),
  value: z.string().optional(),
  // Optional: nếu muốn override label/value riêng theo từng language
  translations: z
    .array(
      z.object({
        languageId: z.string().min(1),
        label: z.string().min(1),
        value: z.string().min(1),
      })
    )
})

// ─── SpecGroup input (body gửi lên khi create/update) ────────────────────────
export const SpecGroupInputSchema = z.object({
  key: z.string().min(1),
  sortOrder: z.number().int().nonnegative().optional().default(0),
  // FIX: translations[] thay vì label string đơn → hỗ trợ đa ngôn ngữ
  translations: z
    .array(
      z.object({
        languageId: z.string().min(1),
        label: z.string().min(1),
      })
    )
    .min(1, 'Phải có ít nhất 1 translation cho group'),
  specs: z.array(SpecItemInputSchema).min(1, 'Phải có ít nhất 1 spec trong group'),
})

// ─── Highlight ────────────────────────────────────────────────────────────────
export const HighlightSectionSchema = z.object({
  heading: z.string().min(1),
  content: z.string().min(1),
  sortOrder: z.number().int().nonnegative(),
})

// FIX: HighlightsSchema là 1 entry per language
export const HighlightsSchema = z.object({
  languageId: z.string().min(1),
  summary: z.string().optional().default(''),
  sections: z.array(HighlightSectionSchema).optional().default([]),
})

// ─── Product base ─────────────────────────────────────────────────────────────
export const ProductSchema = z.object({
  id: z.number(),
  publishedAt: z.iso.datetime().nullable(),
  name: z.string().trim().max(500),
  basePrice: z.number().min(0),
  virtualPrice: z.number().min(0),
  brandId: z.number().positive(),
  images: z.array(z.string()),
  variants: VariantsSchema,
  createdById: z.number().nullable(),
  updatedById: z.number().nullable(),
  deletedById: z.number().nullable(),
  deletedAt: z.iso.datetime().nullable(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
})

// ─── Query schemas ────────────────────────────────────────────────────────────
export const GetProductsQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().default(10),
  name: z.string().optional(),
  brandIds: z
    .preprocess((value) => {
      if (typeof value === 'string') return [Number(value)]
      return value
    }, z.array(z.coerce.number().int().positive()))
    .optional(),
  categories: z
    .preprocess((value) => {
      if (typeof value === 'string') return [Number(value)]
      return value
    }, z.array(z.coerce.number().int().positive()))
    .optional(),
  minPrice: z.coerce.number().positive().optional(),
  maxPrice: z.coerce.number().positive().optional(),
  createdById: z.coerce.number().int().positive().optional(),
  orderBy: z.enum([OrderBy.Asc, OrderBy.Desc]).default(OrderBy.Desc),
  sortBy: z.enum([SortBy.CreatedAt, SortBy.Price, SortBy.Sale]).default(SortBy.CreatedAt),
})

export const GetManageProductsQuerySchema = GetProductsQuerySchema.extend({
  isPublic: z.stringbool().optional(),
  createdById: z.coerce.number().int().positive(),
})

// ─── Response schemas ─────────────────────────────────────────────────────────
export const GetProductsResSchema = z.object({
  data: z.array(
    ProductSchema.extend({
      categories: z.array(
        CategorySchema.extend({
          childrenCategories: z.array(CategorySchema),
        }),
      ),
      // FIX: brand là object, không phải array
      brand: BrandSchema,
      productTranslations: z.array(ProductTranslationSchema),
      _count: z
        .object({
          orders: z.number(),
        })
        .optional(),
    }),
  ),
  totalItems: z.number(),
  page: z.number(),
  limit: z.number(),
  totalPages: z.number(),
})

export const GetProductParamsSchema = z
  .object({
    productId: z.coerce.number().int().positive(),
  })
  .strict()

// FIX: ProductTranslationSchema.extend thêm highlights nullable + optional
// vì không phải translation nào cũng có highlights
export const GetProductDetailResSchema = ProductSchema.extend({
  productTranslations: z.array(
    ProductTranslationSchema.extend({
      highlights: z
        .object({
          summary: z.string(),
          sections: z.array(
            z.object({
              heading: z.string(),
              content: z.string(),
              sortOrder: z.number(),
            })
          ),
        })
        .nullable()
        .optional(),
    })
  ),
  skus: z.array(SKUSchema),
  categories: z.array(CategoryIncludeTranslationSchema),
  brand: BrandIncludeTranslationSchema,
  // FIX: dùng SpecGroupResSchema (có id, timestamps) thay vì SpecGroupSchema (input)
  specGroups: z.array(SpecGroupResSchema).optional().default([]),
})

// ─── Create / Update body ─────────────────────────────────────────────────────
export const CreateProductBodySchema = ProductSchema.pick({
  publishedAt: true,
  name: true,
  basePrice: true,
  virtualPrice: true,
  brandId: true,
  images: true,
  variants: true,
})
  .extend({
    categories: z.array(z.coerce.number().int().positive()),
    skus: z.array(UpsertSKUBodySchema),
    // FIX: dùng SpecGroupInputSchema (input) thay vì SpecGroupSchema (response)
    specGroups: z.array(SpecGroupInputSchema).optional().default([]),
    highlights: z.array(HighlightsSchema).optional().default([]),
  })
  .strict()
  .superRefine(({ variants, skus }, ctx) => {
    const skuValueArray = generateSKUs(variants)
    if (skus.length !== skuValueArray.length) {
      return ctx.addIssue({
        code: 'custom',
        path: ['skus'],
        message: `Số lượng SKU nên là ${skuValueArray.length}. Vui lòng kiểm tra lại.`,
      })
    }
    let wrongSKUIndex = -1
    const isValidSKUs = skus.every((sku, index) => {
      const isValid = sku.value === skuValueArray[index].value
      if (!isValid) wrongSKUIndex = index
      return isValid
    })
    if (!isValidSKUs) {
      ctx.addIssue({
        code: 'custom',
        path: ['skus'],
        message: `Giá trị SKU index ${wrongSKUIndex} không hợp lệ. Vui lòng kiểm tra lại.`,
      })
    }
  })

export const UpdateProductBodySchema = CreateProductBodySchema

// ─── Exported types ───────────────────────────────────────────────────────────
export type GetProductsResType = z.infer<typeof GetProductsResSchema>
export type GetProductsQueryType = z.infer<typeof GetProductsQuerySchema>
export type GetProductDetailResType = z.infer<typeof GetProductDetailResSchema>
export type GetManageProductsQueryType = z.infer<typeof GetManageProductsQuerySchema>
export type CreateProductBodyType = z.infer<typeof CreateProductBodySchema>
export type UpdateProductBodyType = z.infer<typeof UpdateProductBodySchema>
export type GetProductParamsType = z.infer<typeof GetProductParamsSchema>
export type SpecGroupInputType = z.infer<typeof SpecGroupInputSchema>
export type SpecItemInputType = z.infer<typeof SpecItemInputSchema>

