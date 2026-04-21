import { CACHE_MANAGER } from '@nestjs/cache-manager'
import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common'
import { Cache } from 'cache-manager'
import {
  AddWishlistItemBodyType,
  CreateCollectionBodyType,
  GetWishlistItemsQueryType,
  UpdateCollectionBodyType,
  UpdateWishlistItemBodyType,
} from 'src/routes/wishlist/wishlist.model'
import { WishlistRepo } from 'src/routes/wishlist/wishlist.repo'
import { CACHE_TTL } from 'src/shared/constants/app.constant'

@Injectable()
export class WishlistService {
  constructor(
    private readonly wishlistRepo: WishlistRepo,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
  ) {}

  // ============================================
  // WISHLIST ITEM OPERATIONS
  // ============================================

  /**
   * Add item to wishlist
   */
  async addItem(userId: number, data: AddWishlistItemBodyType) {
    const item = await this.wishlistRepo.addItem(userId, data)

    // Invalidate cache
    await this.invalidateWishlistCache(userId)

    return item
  }

  /**
   * Get wishlist items with pagination
   */
  async getItems(userId: number, query: GetWishlistItemsQueryType) {
    return this.wishlistRepo.getItems(userId, query)
  }

  /**
   * Update wishlist item
   */
  async updateItem(userId: number, itemId: number, data: UpdateWishlistItemBodyType) {
    try {
      const item = await this.wishlistRepo.updateItem(userId, itemId, data)

      // Invalidate cache
      await this.invalidateWishlistCache(userId)

      return item
    } catch (error) {
      throw new NotFoundException('Wishlist item not found or you do not have permission')
    }
  }

  /**
   * Remove item from wishlist
   */
  async removeItem(userId: number, itemId: number) {
    try {
      await this.wishlistRepo.removeItem(userId, itemId)

      // Invalidate cache
      await this.invalidateWishlistCache(userId)

      return { message: 'Item removed from wishlist successfully' }
    } catch (error) {
      throw new NotFoundException('Wishlist item not found or you do not have permission')
    }
  }

  /**
   * Move wishlist item to cart
   */
  async moveToCart(userId: number, itemId: number, quantity: number = 1) {
    try {
      const result = await this.wishlistRepo.moveToCart(userId, itemId, quantity)

      // Invalidate cache
      await this.invalidateWishlistCache(userId)

      return { message: 'Item moved to cart successfully' }
    } catch (error) {
      if (error.message.includes('No SKU selected')) {
        throw new BadRequestException('Cannot add to cart: No SKU selected for this product')
      }
      throw new NotFoundException('Wishlist item not found or you do not have permission')
    }
  }

  /**
   * Get wishlist count (with caching)
   */
  async getCount(userId: number) {
    const cacheKey = `wishlist:count:${userId}`

    // Try to get from cache
    const cached = await this.cacheManager.get<number>(cacheKey)
    if (cached !== null && cached !== undefined) {
      return { count: cached }
    }

    // Get from database
    const count = await this.wishlistRepo.getCount(userId)

    // Cache for 5 minutes
    await this.cacheManager.set(cacheKey, count, CACHE_TTL.MEDIUM)

    return { count }
  }

  /**
   * Check if product/sku is wishlisted
   */
  async checkWishlisted(userId: number, productId: number, skuId?: number) {
    return this.wishlistRepo.isWishlisted(userId, productId, skuId)
  }

  // ============================================
  // WISHLIST COLLECTION OPERATIONS
  // ============================================

  /**
   * Create a new collection
   */
  async createCollection(userId: number, data: CreateCollectionBodyType) {
    return this.wishlistRepo.createCollection(userId, data)
  }

  /**
   * Get all collections for user
   */
  async getCollections(userId: number) {
    return this.wishlistRepo.getCollections(userId)
  }

  /**
   * Update collection
   */
  async updateCollection(userId: number, collectionId: number, data: UpdateCollectionBodyType) {
    try {
      return await this.wishlistRepo.updateCollection(userId, collectionId, data)
    } catch (error) {
      throw new NotFoundException('Collection not found or you do not have permission')
    }
  }

  /**
   * Delete collection
   */
  async deleteCollection(userId: number, collectionId: number) {
    try {
      await this.wishlistRepo.deleteCollection(userId, collectionId)
      return { message: 'Collection deleted successfully' }
    } catch (error) {
      throw new NotFoundException('Collection not found or you do not have permission')
    }
  }

  /**
   * Add item to collection
   */
  async addItemToCollection(userId: number, collectionId: number, wishlistItemId: number) {
    try {
      await this.wishlistRepo.addItemToCollection(userId, collectionId, wishlistItemId)
      return { message: 'Item added to collection successfully' }
    } catch (error) {
      if (error.message.includes('not found')) {
        throw new NotFoundException('Collection or wishlist item not found')
      }
      throw new BadRequestException('Item already in collection or invalid request')
    }
  }

  /**
   * Remove item from collection
   */
  async removeItemFromCollection(collectionId: number, wishlistItemId: number) {
    try {
      await this.wishlistRepo.removeItemFromCollection(collectionId, wishlistItemId)
      return { message: 'Item removed from collection successfully' }
    } catch (error) {
      throw new NotFoundException('Collection item not found')
    }
  }

  /**
   * Get shared collection by share code
   */
  async getSharedCollection(shareCode: string) {
    const collection = await this.wishlistRepo.getCollectionByShareCode(shareCode)

    if (!collection) {
      throw new NotFoundException('Shared collection not found or is private')
    }

    return collection
  }

  // ============================================
  // PRICE ALERT OPERATIONS
  // ============================================

  /**
   * Set target price for wishlist item
   */
  async setTargetPrice(userId: number, itemId: number, targetPrice: number) {
    try {
      await this.wishlistRepo.setTargetPrice(userId, itemId, targetPrice)
      return { message: 'Target price set successfully' }
    } catch (error) {
      throw new NotFoundException('Wishlist item not found or you do not have permission')
    }
  }

  // ============================================
  // HELPER METHODS
  // ============================================

  /**
   * Invalidate wishlist cache for user
   */
  private async invalidateWishlistCache(userId: number) {
    const cacheKey = `wishlist:count:${userId}`
    await this.cacheManager.del(cacheKey)
  }
}
