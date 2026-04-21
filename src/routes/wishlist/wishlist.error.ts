import { HttpException, HttpStatus } from '@nestjs/common'

export const WishlistItemNotFoundException = new HttpException(
  {
    statusCode: HttpStatus.NOT_FOUND,
    message: 'Wishlist item not found',
    error: 'WISHLIST_ITEM_NOT_FOUND',
  },
  HttpStatus.NOT_FOUND,
)

export const WishlistCollectionNotFoundException = new HttpException(
  {
    statusCode: HttpStatus.NOT_FOUND,
    message: 'Wishlist collection not found',
    error: 'WISHLIST_COLLECTION_NOT_FOUND',
  },
  HttpStatus.NOT_FOUND,
)

export const WishlistItemAlreadyExistsException = new HttpException(
  {
    statusCode: HttpStatus.CONFLICT,
    message: 'Product already in wishlist',
    error: 'WISHLIST_ITEM_ALREADY_EXISTS',
  },
  HttpStatus.CONFLICT,
)

export const NoSKUSelectedException = new HttpException(
  {
    statusCode: HttpStatus.BAD_REQUEST,
    message: 'Cannot add to cart: No SKU selected for this product',
    error: 'NO_SKU_SELECTED',
  },
  HttpStatus.BAD_REQUEST,
)

export const UnauthorizedWishlistAccessException = new HttpException(
  {
    statusCode: HttpStatus.FORBIDDEN,
    message: 'You do not have permission to access this wishlist item',
    error: 'UNAUTHORIZED_WISHLIST_ACCESS',
  },
  HttpStatus.FORBIDDEN,
)
