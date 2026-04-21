import { Injectable } from '@nestjs/common'
import { Prisma, PrismaClient } from '@prisma/client'
import {
  AddWishlistItemBodyType,
  AddWishlistItemResType,
  CreateCollectionBodyType,
  GetWishlistItemsQueryType,
  GetWishlistItemsResType,
  UpdateCollectionBodyType,
  UpdateWishlistItemBodyType,
} from 'src/routes/wishlist/wishlist.model'
import { SerializeAll } from 'src/shared/decorators/serialize.decorator'
import { PrismaService } from 'src/shared/services/prisma.service'

type TransactionClient = Omit<PrismaClient, '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'>

const WISHLIST_ITEM_INCLUDE = {
  product: {
    select: {
      id: true,
      name: true,
      basePrice: true,
      virtualPrice: true,
      images: true,
    },
  },
  sku: {
    select: {
      id: true,
      value: true,
      price: true,
      stock: true,
      image: true,
    },
  },
} as const

@Injectable()
@SerializeAll()
export class WishlistRepo {
  constructor(private readonly prismaService: PrismaService) {}

  // ============================================
  // WISHLIST ITEM OPERATIONS
  // ============================================

  /**
   * Add item to wishlist (upsert pattern)
   * If item already exists, update it. Otherwise, create new.
   */
  async addItem(userId: number, data: AddWishlistItemBodyType): Promise<AddWishlistItemResType> {
    const currentPrice = await this.getCurrentPrice(data.productId, data.skuId)

    return this.prismaService.$transaction(async (tx) => {
      const existingItem = await this.findExistingWishlistItem(tx, userId, data.productId, data.skuId)

      const wishlistItem = existingItem
        ? await this.updateWishlistItem(tx, existingItem.id, data)
        : await this.createWishlistItem(tx, userId, data)

      await this.upsertPriceAlert(tx, wishlistItem.id, currentPrice)

      return wishlistItem
    }) as any
  }

  private async getCurrentPrice(productId: number, skuId?: number): Promise<number> {
    const sku = skuId
      ? await this.prismaService.sKU.findUnique({
          where: { id: skuId },
          select: { price: true },
        })
      : null

    const product = await this.prismaService.product.findUnique({
      where: { id: productId },
      select: { basePrice: true },
    })

    return sku?.price || product?.basePrice || 0
  }

  private async findExistingWishlistItem(
    tx: TransactionClient,
    userId: number,
    productId: number,
    skuId?: number,
  ): Promise<{ id: number } | null> {
    return tx.wishlistItem.findFirst({
      where: {
        userId,
        productId,
        skuId: skuId ?? null,
      },
      select: { id: true },
    })
  }

  private async updateWishlistItem(tx: TransactionClient, itemId: number, data: AddWishlistItemBodyType) {
    return tx.wishlistItem.update({
      where: { id: itemId },
      data: {
        priority: data.priority ?? 0,
        note: data.note,
        notifyOnPriceDrops: data.notifyOnPriceDrops ?? true,
        notifyOnBackInStock: data.notifyOnBackInStock ?? true,
        notifyOnPromotion: data.notifyOnPromotion ?? true,
        updatedAt: new Date(),
      },
      include: WISHLIST_ITEM_INCLUDE,
    })
  }

  private async createWishlistItem(tx: TransactionClient, userId: number, data: AddWishlistItemBodyType) {
    return tx.wishlistItem.create({
      data: {
        userId,
        productId: data.productId,
        skuId: data.skuId ?? null,
        priority: data.priority ?? 0,
        note: data.note,
        notifyOnPriceDrops: data.notifyOnPriceDrops ?? true,
        notifyOnBackInStock: data.notifyOnBackInStock ?? true,
        notifyOnPromotion: data.notifyOnPromotion ?? true,
      },
      include: WISHLIST_ITEM_INCLUDE,
    })
  }

  private async upsertPriceAlert(tx: TransactionClient, wishlistItemId: number, currentPrice: number) {
    return tx.wishlistPriceAlert.upsert({
      where: { wishlistItemId },
      update: {
        currentPrice,
        lastCheckedAt: new Date(),
      },
      create: {
        wishlistItemId,
        originalPrice: currentPrice,
        currentPrice,
        lastCheckedAt: new Date(),
      },
    })
  }

  /**
   * Get wishlist items with pagination and filters
   */
  async getItems(userId: number, query: GetWishlistItemsQueryType): Promise<GetWishlistItemsResType> {
    const { page, limit, priority, sortBy, orderBy } = query
    const skip = (page - 1) * limit

    const where: Prisma.WishlistItemWhereInput = {
      userId,
      ...(priority !== undefined && { priority }),
    }

    // Determine order by
    let orderByClause: Prisma.WishlistItemOrderByWithRelationInput | Prisma.WishlistItemOrderByWithRelationInput[] = {}
    if (sortBy === 'addedAt') {
      orderByClause = { addedAt: orderBy }
    } else if (sortBy === 'priority') {
      orderByClause = [{ priority: orderBy }, { addedAt: 'desc' as const }]
    } else if (sortBy === 'price') {
      orderByClause = { sku: { price: orderBy } }
    }

    const [items, totalItems] = await Promise.all([
      this.prismaService.wishlistItem.findMany({
        where,
        include: {
          product: {
            select: {
              id: true,
              name: true,
              basePrice: true,
              virtualPrice: true,
              images: true,
              brandId: true,
              brand: {
                select: {
                  id: true,
                  name: true,
                  logo: true,
                },
              },
            },
          },
          sku: {
            select: {
              id: true,
              value: true,
              price: true,
              stock: true,
              image: true,
            },
          },
          priceAlerts: {
            take: 1,
            orderBy: { lastCheckedAt: 'desc' },
            select: {
              id: true,
              originalPrice: true,
              currentPrice: true,
              targetPrice: true,
            },
          },
        },
        orderBy: orderByClause,
        skip,
        take: limit,
      }),
      this.prismaService.wishlistItem.count({ where }),
    ])

    // Transform data to include price drop percentage
    const transformedItems = items.map((item) => {
      const priceAlert = item.priceAlerts[0] || null
      const priceDropPercentage = priceAlert
        ? ((priceAlert.originalPrice - priceAlert.currentPrice) / priceAlert.originalPrice) * 100
        : 0

      return {
        ...item,
        priceAlert: priceAlert
          ? {
              ...priceAlert,
              priceDropPercentage: Math.round(priceDropPercentage * 100) / 100,
            }
          : null,
        priceAlerts: undefined, // Remove the array, keep only single priceAlert
      }
    })

    return {
      data: transformedItems as any,
      totalItems,
      page,
      limit,
      totalPages: Math.ceil(totalItems / limit),
    }
  }

  /**
   * Update wishlist item
   */
  async updateItem(userId: number, itemId: number, data: UpdateWishlistItemBodyType) {
    return this.prismaService.wishlistItem.update({
      where: {
        id: itemId,
        userId, // Ensure user owns this item
      },
      data: {
        ...data,
        updatedAt: new Date(),
      },
      include: {
        product: {
          select: {
            id: true,
            name: true,
            basePrice: true,
            virtualPrice: true,
            images: true,
          },
        },
        sku: {
          select: {
            id: true,
            value: true,
            price: true,
            stock: true,
            image: true,
          },
        },
      },
    }) as any
  }

  /**
   * Remove item from wishlist
   */
  async removeItem(userId: number, itemId: number) {
    return this.prismaService.wishlistItem.delete({
      where: {
        id: itemId,
        userId, // Ensure user owns this item
      },
    })
  }

  /**
   * Move wishlist item to cart
   */
  async moveToCart(userId: number, itemId: number, quantity: number = 1) {
    return this.prismaService.$transaction(async (tx) => {
      // Get wishlist item
      const wishlistItem = await tx.wishlistItem.findUnique({
        where: { id: itemId, userId },
        include: { sku: true },
      })

      if (!wishlistItem) {
        throw new Error('Wishlist item not found')
      }

      if (!wishlistItem.skuId) {
        throw new Error('Cannot add to cart: No SKU selected')
      }

      // Add to cart (upsert)
      await tx.cartItem.upsert({
        where: {
          userId_skuId: {
            userId,
            skuId: wishlistItem.skuId,
          },
        },
        update: {
          quantity: { increment: quantity },
        },
        create: {
          userId,
          skuId: wishlistItem.skuId,
          quantity,
        },
      })

      // Remove from wishlist
      await tx.wishlistItem.delete({
        where: { id: itemId },
      })

      return { success: true }
    })
  }

  /**
   * Get wishlist count for user
   */
  async getCount(userId: number): Promise<number> {
    return this.prismaService.wishlistItem.count({
      where: { userId },
    })
  }

  /**
   * Check if product/sku is wishlisted
   */
  async isWishlisted(userId: number, productId: number, skuId?: number) {
    // Use findFirst because Prisma doesn't support null in unique constraint where clause
    const item = await this.prismaService.wishlistItem.findFirst({
      where: {
        userId,
        productId,
        skuId: skuId ?? null,
      },
      select: { id: true },
    })

    return {
      isWishlisted: !!item,
      wishlistItemId: item?.id || null,
    }
  }

  // ============================================
  // WISHLIST COLLECTION OPERATIONS
  // ============================================

  /**
   * Create a new collection
   */
  async createCollection(userId: number, data: CreateCollectionBodyType) {
    // Generate share code if public
    const shareCode = data.isPublic ? this.generateShareCode() : null

    return this.prismaService.wishlistCollection.create({
      data: {
        userId,
        name: data.name,
        description: data.description,
        isPublic: data.isPublic ?? false,
        shareCode,
      },
    }) as any
  }

  /**
   * Get all collections for user
   */
  async getCollections(userId: number) {
    const collections = await this.prismaService.wishlistCollection.findMany({
      where: { userId },
      include: {
        _count: {
          select: { items: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    return {
      data: collections.map((col) => ({
        ...col,
        itemCount: col._count.items,
        _count: undefined,
      })),
      totalItems: collections.length,
    } as any
  }

  /**
   * Update collection
   */
  async updateCollection(userId: number, collectionId: number, data: UpdateCollectionBodyType) {
    // If changing to public and no shareCode exists, generate one
    const updateData: any = { ...data }
    if (data.isPublic) {
      const existing = await this.prismaService.wishlistCollection.findUnique({
        where: { id: collectionId },
        select: { shareCode: true },
      })
      if (!existing?.shareCode) {
        updateData.shareCode = this.generateShareCode()
      }
    }

    return this.prismaService.wishlistCollection.update({
      where: {
        id: collectionId,
        userId, // Ensure user owns this collection
      },
      data: updateData,
    }) as any
  }

  /**
   * Delete collection
   */
  async deleteCollection(userId: number, collectionId: number) {
    return this.prismaService.wishlistCollection.delete({
      where: {
        id: collectionId,
        userId, // Ensure user owns this collection
      },
    })
  }

  /**
   * Add item to collection
   */
  async addItemToCollection(userId: number, collectionId: number, wishlistItemId: number) {
    // Verify ownership
    const [collection, wishlistItem] = await Promise.all([
      this.prismaService.wishlistCollection.findUnique({
        where: { id: collectionId, userId },
      }),
      this.prismaService.wishlistItem.findUnique({
        where: { id: wishlistItemId, userId },
      }),
    ])

    if (!collection || !wishlistItem) {
      throw new Error('Collection or wishlist item not found')
    }

    return this.prismaService.wishlistCollectionItem.create({
      data: {
        collectionId,
        wishlistItemId,
      },
    })
  }

  /**
   * Remove item from collection
   */
  async removeItemFromCollection(collectionId: number, wishlistItemId: number) {
    return this.prismaService.wishlistCollectionItem.delete({
      where: {
        collectionId_wishlistItemId: {
          collectionId,
          wishlistItemId,
        },
      },
    })
  }

  /**
   * Get collection by share code
   */
  async getCollectionByShareCode(shareCode: string) {
    return this.prismaService.wishlistCollection.findUnique({
      where: { shareCode, isPublic: true },
      include: {
        items: {
          include: {
            wishlistItem: {
              include: {
                product: {
                  select: {
                    id: true,
                    name: true,
                    basePrice: true,
                    images: true,
                  },
                },
                sku: {
                  select: {
                    id: true,
                    value: true,
                    price: true,
                    image: true,
                  },
                },
              },
            },
          },
        },
      },
    }) as any
  }

  // ============================================
  // PRICE ALERT OPERATIONS
  // ============================================

  /**
   * Set target price for wishlist item
   */
  async setTargetPrice(userId: number, itemId: number, targetPrice: number) {
    // Verify ownership
    const wishlistItem = await this.prismaService.wishlistItem.findUnique({
      where: { id: itemId, userId },
    })

    if (!wishlistItem) {
      throw new Error('Wishlist item not found')
    }

    // Find the price alert first
    const priceAlert = await this.prismaService.wishlistPriceAlert.findUnique({
      where: { wishlistItemId: itemId },
    })

    if (!priceAlert) {
      throw new Error('Price alert not found')
    }

    // Update and return the updated record
    return this.prismaService.wishlistPriceAlert.update({
      where: { wishlistItemId: itemId },
      data: { targetPrice },
    })
  }

  /**
   * Get all items that need price check
   */
  async getItemsForPriceCheck() {
    return this.prismaService.wishlistItem.findMany({
      where: {
        notifyOnPriceDrops: true,
      },
      include: {
        sku: {
          select: {
            id: true,
            price: true,
          },
        },
        product: {
          select: {
            id: true,
            name: true,
            basePrice: true,
          },
        },
        priceAlerts: {
          take: 1,
          orderBy: { lastCheckedAt: 'desc' },
        },
        user: {
          select: {
            id: true,
            email: true,
            name: true,
          },
        },
      },
    })
  }

  /**
   * Update price alert
   */
  async updatePriceAlert(wishlistItemId: number, currentPrice: number, alertSent: boolean = false) {
    return this.prismaService.wishlistPriceAlert.updateMany({
      where: { wishlistItemId },
      data: {
        currentPrice,
        lastCheckedAt: new Date(),
        ...(alertSent && { alertSentAt: new Date() }),
      },
    })
  }

  // ============================================
  // HELPER METHODS
  // ============================================

  /**
   * Generate random share code
   */
  private generateShareCode(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
    let code = ''
    for (let i = 0; i < 10; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length))
    }
    return code
  }
}

// Tích hợp Stripe để thanh toán như là Stripe ở trong dự án Cellera -> Tích hợp giống như vậy thì nó sẽ hay hơn nhiều
