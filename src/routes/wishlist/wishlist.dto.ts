import { createZodDto } from 'nestjs-zod'
import {
  AddItemToCollectionBodySchema,
  AddItemToCollectionParamsSchema,
  AddWishlistItemBodySchema,
  AddWishlistItemResSchema,
  CheckWishlistedQuerySchema,
  CheckWishlistedResSchema,
  CreateCollectionBodySchema,
  DeleteWishlistItemParamsSchema,
  GetCollectionsResSchema,
  GetWishlistCountResSchema,
  GetWishlistItemsQuerySchema,
  GetWishlistItemsResSchema,
  MoveToCartBodySchema,
  MoveToCartParamsSchema,
  SetTargetPriceBodySchema,
  SetTargetPriceParamsSchema,
  UpdateCollectionBodySchema,
  UpdateCollectionParamsSchema,
  UpdateWishlistItemBodySchema,
  UpdateWishlistItemParamsSchema,
  WishlistCollectionSchema,
  WishlistItemSchema,
} from 'src/routes/wishlist/wishlist.model'

// ============================================
// WISHLIST ITEM DTOs
// ============================================

export class WishlistItemDTO extends createZodDto(WishlistItemSchema) {}

export class AddWishlistItemBodyDTO extends createZodDto(AddWishlistItemBodySchema) {}

export class AddWishlistItemResDTO extends createZodDto(AddWishlistItemResSchema) {}

export class GetWishlistItemsQueryDTO extends createZodDto(GetWishlistItemsQuerySchema) {}

export class GetWishlistItemsResDTO extends createZodDto(GetWishlistItemsResSchema) {}

export class UpdateWishlistItemParamsDTO extends createZodDto(UpdateWishlistItemParamsSchema) {}

export class UpdateWishlistItemBodyDTO extends createZodDto(UpdateWishlistItemBodySchema) {}

export class DeleteWishlistItemParamsDTO extends createZodDto(DeleteWishlistItemParamsSchema) {}

export class MoveToCartParamsDTO extends createZodDto(MoveToCartParamsSchema) {}

export class MoveToCartBodyDTO extends createZodDto(MoveToCartBodySchema) {}

export class GetWishlistCountResDTO extends createZodDto(GetWishlistCountResSchema) {}

export class CheckWishlistedQueryDTO extends createZodDto(CheckWishlistedQuerySchema) {}

export class CheckWishlistedResDTO extends createZodDto(CheckWishlistedResSchema) {}

// ============================================
// WISHLIST COLLECTION DTOs
// ============================================

export class WishlistCollectionDTO extends createZodDto(WishlistCollectionSchema) {}

export class CreateCollectionBodyDTO extends createZodDto(CreateCollectionBodySchema) {}

export class UpdateCollectionParamsDTO extends createZodDto(UpdateCollectionParamsSchema) {}

export class UpdateCollectionBodyDTO extends createZodDto(UpdateCollectionBodySchema) {}

export class GetCollectionsResDTO extends createZodDto(GetCollectionsResSchema) {}

export class AddItemToCollectionParamsDTO extends createZodDto(AddItemToCollectionParamsSchema) {}

export class AddItemToCollectionBodyDTO extends createZodDto(AddItemToCollectionBodySchema) {}

export class SetTargetPriceParamsDTO extends createZodDto(SetTargetPriceParamsSchema) {}

export class SetTargetPriceBodyDTO extends createZodDto(SetTargetPriceBodySchema) {}
