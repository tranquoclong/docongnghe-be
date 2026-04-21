import { z } from 'zod'

// ============================================
// WISHLIST ITEM SCHEMAS
// ============================================

export const WishlistItemSchema = z.object({
  id: z.number().int().positive(),
  userId: z.number().int().positive(),
  productId: z.number().int().positive(),
  skuId: z.number().int().positive().nullable(),
  note: z.string().max(500).nullable(),
  priority: z.number().int().min(0).max(2).default(0), // 0=normal, 1=high, 2=urgent
  notifyOnPriceDrops: z.boolean().default(true),
  notifyOnBackInStock: z.boolean().default(true),
  notifyOnPromotion: z.boolean().default(true),
  addedAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
})

export type WishlistItemType = z.infer<typeof WishlistItemSchema>

// ============================================
// ADD WISHLIST ITEM
// ============================================

export const AddWishlistItemBodySchema = z.object({
  productId: z.number().int().positive(),
  skuId: z.number().int().positive().optional(),
  note: z.string().max(500).optional(),
  priority: z.number().int().min(0).max(2).optional().default(0),
  notifyOnPriceDrops: z.boolean().optional().default(true),
  notifyOnBackInStock: z.boolean().optional().default(true),
  notifyOnPromotion: z.boolean().optional().default(true),
})

export type AddWishlistItemBodyType = z.infer<typeof AddWishlistItemBodySchema>

export const AddWishlistItemResSchema = WishlistItemSchema.extend({
  product: z.object({
    id: z.number(),
    name: z.string(),
    basePrice: z.number(),
    virtualPrice: z.number(),
    images: z.array(z.string()),
  }),
  sku: z
    .object({
      id: z.number(),
      value: z.string(),
      price: z.number(),
      stock: z.number(),
      image: z.string(),
    })
    .nullable(),
})

export type AddWishlistItemResType = z.infer<typeof AddWishlistItemResSchema>

// ============================================
// GET WISHLIST ITEMS
// ============================================

export const GetWishlistItemsQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  priority: z.coerce.number().int().min(0).max(2).optional(),
  sortBy: z.enum(['addedAt', 'priority', 'price']).optional().default('addedAt'),
  orderBy: z.enum(['asc', 'desc']).optional().default('desc'),
})

export type GetWishlistItemsQueryType = z.infer<typeof GetWishlistItemsQuerySchema>

export const WishlistItemDetailSchema = WishlistItemSchema.extend({
  product: z.object({
    id: z.number(),
    name: z.string(),
    basePrice: z.number(),
    virtualPrice: z.number(),
    images: z.array(z.string()),
    brandId: z.number(),
    brand: z.object({
      id: z.number(),
      name: z.string(),
      logo: z.string(),
    }),
  }),
  sku: z
    .object({
      id: z.number(),
      value: z.string(),
      price: z.number(),
      stock: z.number(),
      image: z.string(),
    })
    .nullable(),
  priceAlert: z
    .object({
      id: z.number(),
      originalPrice: z.number(),
      currentPrice: z.number(),
      targetPrice: z.number().nullable(),
      priceDropPercentage: z.number().optional(),
    })
    .nullable()
    .optional(),
})

export type WishlistItemDetailType = z.infer<typeof WishlistItemDetailSchema>

export const GetWishlistItemsResSchema = z.object({
  data: z.array(WishlistItemDetailSchema),
  totalItems: z.number().int(),
  page: z.number().int(),
  limit: z.number().int(),
  totalPages: z.number().int(),
})

export type GetWishlistItemsResType = z.infer<typeof GetWishlistItemsResSchema>

// ============================================
// UPDATE WISHLIST ITEM
// ============================================

export const UpdateWishlistItemParamsSchema = z.object({
  itemId: z.coerce.number().int().positive(),
})

export type UpdateWishlistItemParamsType = z.infer<typeof UpdateWishlistItemParamsSchema>

export const UpdateWishlistItemBodySchema = z.object({
  note: z.string().max(500).optional(),
  priority: z.number().int().min(0).max(2).optional(),
  notifyOnPriceDrops: z.boolean().optional(),
  notifyOnBackInStock: z.boolean().optional(),
  notifyOnPromotion: z.boolean().optional(),
})

export type UpdateWishlistItemBodyType = z.infer<typeof UpdateWishlistItemBodySchema>

// ============================================
// DELETE WISHLIST ITEM
// ============================================

export const DeleteWishlistItemParamsSchema = z.object({
  itemId: z.coerce.number().int().positive(),
})

export type DeleteWishlistItemParamsType = z.infer<typeof DeleteWishlistItemParamsSchema>

// ============================================
// MOVE TO CART
// ============================================

export const MoveToCartParamsSchema = z.object({
  itemId: z.coerce.number().int().positive(),
})

export type MoveToCartParamsType = z.infer<typeof MoveToCartParamsSchema>

export const MoveToCartBodySchema = z.object({
  quantity: z.number().int().positive().default(1),
})

export type MoveToCartBodyType = z.infer<typeof MoveToCartBodySchema>

// ============================================
// GET WISHLIST COUNT
// ============================================

export const GetWishlistCountResSchema = z.object({
  count: z.number().int(),
})

export type GetWishlistCountResType = z.infer<typeof GetWishlistCountResSchema>

// ============================================
// CHECK IF WISHLISTED
// ============================================

export const CheckWishlistedQuerySchema = z.object({
  productId: z.coerce.number().int().positive(),
  skuId: z.coerce.number().int().positive().optional(),
})

export type CheckWishlistedQueryType = z.infer<typeof CheckWishlistedQuerySchema>

export const CheckWishlistedResSchema = z.object({
  isWishlisted: z.boolean(),
  wishlistItemId: z.number().int().positive().nullable(),
})

export type CheckWishlistedResType = z.infer<typeof CheckWishlistedResSchema>

// ============================================
// WISHLIST COLLECTION SCHEMAS
// ============================================

export const WishlistCollectionSchema = z.object({
  id: z.number().int().positive(),
  userId: z.number().int().positive(),
  name: z.string().max(200),
  description: z.string().max(1000).nullable(),
  isPublic: z.boolean().default(false),
  shareCode: z.string().max(50).nullable(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
})

export type WishlistCollectionType = z.infer<typeof WishlistCollectionSchema>

// ============================================
// CREATE COLLECTION
// ============================================

export const CreateCollectionBodySchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(1000).optional(),
  isPublic: z.boolean().optional().default(false),
})

export type CreateCollectionBodyType = z.infer<typeof CreateCollectionBodySchema>

// ============================================
// UPDATE COLLECTION
// ============================================

export const UpdateCollectionParamsSchema = z.object({
  collectionId: z.coerce.number().int().positive(),
})

export type UpdateCollectionParamsType = z.infer<typeof UpdateCollectionParamsSchema>

export const UpdateCollectionBodySchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(1000).optional(),
  isPublic: z.boolean().optional(),
})

export type UpdateCollectionBodyType = z.infer<typeof UpdateCollectionBodySchema>

// ============================================
// GET COLLECTIONS
// ============================================

export const GetCollectionsResSchema = z.object({
  data: z.array(
    WishlistCollectionSchema.extend({
      itemCount: z.number().int(),
    }),
  ),
  totalItems: z.number().int(),
})

export type GetCollectionsResType = z.infer<typeof GetCollectionsResSchema>

// ============================================
// ADD ITEM TO COLLECTION
// ============================================

export const AddItemToCollectionParamsSchema = z.object({
  collectionId: z.coerce.number().int().positive(),
})

export type AddItemToCollectionParamsType = z.infer<typeof AddItemToCollectionParamsSchema>

export const AddItemToCollectionBodySchema = z.object({
  wishlistItemId: z.number().int().positive(),
})

export type AddItemToCollectionBodyType = z.infer<typeof AddItemToCollectionBodySchema>

// ============================================
// SET TARGET PRICE
// ============================================

export const SetTargetPriceParamsSchema = z.object({
  itemId: z.coerce.number().int().positive(),
})

export type SetTargetPriceParamsType = z.infer<typeof SetTargetPriceParamsSchema>

export const SetTargetPriceBodySchema = z.object({
  targetPrice: z.number().positive(),
})

export type SetTargetPriceBodyType = z.infer<typeof SetTargetPriceBodySchema>
