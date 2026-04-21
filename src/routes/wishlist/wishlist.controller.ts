import { Body, Controller, Delete, Get, Param, Post, Put, Query } from '@nestjs/common'
import { ZodResponse } from 'nestjs-zod'
import {
  AddItemToCollectionBodyDTO,
  AddItemToCollectionParamsDTO,
  AddWishlistItemBodyDTO,
  AddWishlistItemResDTO,
  CheckWishlistedQueryDTO,
  CheckWishlistedResDTO,
  CreateCollectionBodyDTO,
  DeleteWishlistItemParamsDTO,
  GetCollectionsResDTO,
  GetWishlistCountResDTO,
  GetWishlistItemsQueryDTO,
  GetWishlistItemsResDTO,
  MoveToCartBodyDTO,
  MoveToCartParamsDTO,
  SetTargetPriceBodyDTO,
  SetTargetPriceParamsDTO,
  UpdateCollectionBodyDTO,
  UpdateCollectionParamsDTO,
  UpdateWishlistItemBodyDTO,
  UpdateWishlistItemParamsDTO,
  WishlistCollectionDTO,
} from 'src/routes/wishlist/wishlist.dto'
import { WishlistService } from 'src/routes/wishlist/wishlist.service'
import { ActiveUser } from 'src/shared/decorators/active-user.decorator'
import { IsPublic } from 'src/shared/decorators/auth.decorator'
import { MessageResDTO } from 'src/shared/dtos/response.dto'
import { AccessTokenPayload } from 'src/shared/types/jwt.type'
import { ApiBearerAuth } from '@nestjs/swagger'

@Controller('wishlist')
@ApiBearerAuth()
export class WishlistController {
  constructor(private readonly wishlistService: WishlistService) { }

  // ============================================
  // WISHLIST ITEM ENDPOINTS
  // ============================================

  /**
   * Get wishlist items
   * GET /wishlist/items
   */
  @Get('items')
  @ZodResponse({ type: GetWishlistItemsResDTO })
  async getItems(@ActiveUser('userId') userId: number, @Query() query: GetWishlistItemsQueryDTO) {
    return this.wishlistService.getItems(userId, query)
  }

  /**
   * Add item to wishlist
   * POST /wishlist/items
   */
  @Post('items')
  @ZodResponse({ type: AddWishlistItemResDTO })
  async addItem(@ActiveUser('userId') userId: number, @Body() body: AddWishlistItemBodyDTO) {
    return this.wishlistService.addItem(userId, body)
  }

  /**
   * Update wishlist item
   * PUT /wishlist/items/:itemId
   */
  @Put('items/:itemId')
  @ZodResponse({ type: AddWishlistItemResDTO })
  async updateItem(
    @ActiveUser('userId') userId: number,
    @Param() params: UpdateWishlistItemParamsDTO,
    @Body() body: UpdateWishlistItemBodyDTO,
  ) {
    return this.wishlistService.updateItem(userId, params.itemId, body)
  }

  /**
   * Remove item from wishlist
   * DELETE /wishlist/items/:itemId
   */
  @Delete('items/:itemId')
  @ZodResponse({ type: MessageResDTO })
  async removeItem(@ActiveUser('userId') userId: number, @Param() params: DeleteWishlistItemParamsDTO) {
    return this.wishlistService.removeItem(userId, params.itemId)
  }

  /**
   * Move wishlist item to cart
   * POST /wishlist/items/:itemId/move-to-cart
   */
  @Post('items/:itemId/move-to-cart')
  @ZodResponse({ type: MessageResDTO })
  async moveToCart(
    @ActiveUser('userId') userId: number,
    @Param() params: MoveToCartParamsDTO,
    @Body() body: MoveToCartBodyDTO,
  ) {
    return this.wishlistService.moveToCart(userId, params.itemId, body.quantity)
  }

  /**
   * Get wishlist count
   * GET /wishlist/count
   */
  @Get('count')
  @ZodResponse({ type: GetWishlistCountResDTO })
  async getCount(@ActiveUser('userId') userId: number) {
    return this.wishlistService.getCount(userId)
  }

  /**
   * Check if product is wishlisted
   * GET /wishlist/check
   */
  @Get('check')
  @ZodResponse({ type: CheckWishlistedResDTO })
  async checkWishlisted(@ActiveUser('userId') userId: number, @Query() query: CheckWishlistedQueryDTO) {
    return this.wishlistService.checkWishlisted(userId, query.productId, query.skuId)
  }

  // ============================================
  // WISHLIST COLLECTION ENDPOINTS
  // ============================================

  /**
   * Get all collections
   * GET /wishlist/collections
   */
  @Get('collections')
  @ZodResponse({ type: GetCollectionsResDTO })
  async getCollections(@ActiveUser('userId') userId: number) {
    return this.wishlistService.getCollections(userId)
  }

  /**
   * Create new collection
   * POST /wishlist/collections
   */
  @Post('collections')
  @ZodResponse({ type: WishlistCollectionDTO })
  async createCollection(@ActiveUser('userId') userId: number, @Body() body: CreateCollectionBodyDTO) {
    return this.wishlistService.createCollection(userId, body)
  }

  /**
   * Update collection
   * PUT /wishlist/collections/:collectionId
   */
  @Put('collections/:collectionId')
  @ZodResponse({ type: WishlistCollectionDTO })
  async updateCollection(
    @ActiveUser('userId') userId: number,
    @Param() params: UpdateCollectionParamsDTO,
    @Body() body: UpdateCollectionBodyDTO,
  ) {
    return this.wishlistService.updateCollection(userId, params.collectionId, body)
  }

  /**
   * Delete collection
   * DELETE /wishlist/collections/:collectionId
   */
  @Delete('collections/:collectionId')
  @ZodResponse({ type: MessageResDTO })
  async deleteCollection(@ActiveUser('userId') userId: number, @Param() params: UpdateCollectionParamsDTO) {
    return this.wishlistService.deleteCollection(userId, params.collectionId)
  }

  /**
   * Add item to collection
   * POST /wishlist/collections/:collectionId/items
   */
  @Post('collections/:collectionId/items')
  @ZodResponse({ type: MessageResDTO })
  async addItemToCollection(
    @ActiveUser('userId') userId: number,
    @Param() params: AddItemToCollectionParamsDTO,
    @Body() body: AddItemToCollectionBodyDTO,
  ) {
    return this.wishlistService.addItemToCollection(userId, params.collectionId, body.wishlistItemId)
  }

  /**
   * Get shared collection (public endpoint)
   * GET /wishlist/collections/shared/:shareCode
   */
  @Get('collections/shared/:shareCode')
  @IsPublic()
  @ZodResponse({ type: WishlistCollectionDTO })
  async getSharedCollection(@Param('shareCode') shareCode: string) {
    return this.wishlistService.getSharedCollection(shareCode)
  }

  // ============================================
  // PRICE ALERT ENDPOINTS
  // ============================================

  /**
   * Set target price for wishlist item
   * POST /wishlist/items/:itemId/set-target-price
   */
  @Post('items/:itemId/set-target-price')
  @ZodResponse({ type: MessageResDTO })
  async setTargetPrice(
    @ActiveUser('userId') userId: number,
    @Param() params: SetTargetPriceParamsDTO,
    @Body() body: SetTargetPriceBodyDTO,
  ) {
    return this.wishlistService.setTargetPrice(userId, params.itemId, body.targetPrice)
  }
}
