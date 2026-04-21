import { CACHE_MANAGER } from '@nestjs/cache-manager'
import { BadRequestException, NotFoundException } from '@nestjs/common'
import { Test, TestingModule } from '@nestjs/testing'
import { Cache } from 'cache-manager'
import { WishlistRepo } from '../wishlist.repo'
import { WishlistService } from '../wishlist.service'

/**
 * WISHLIST SERVICE UNIT TESTS
 *
 * Module này test service layer của Wishlist
 * Wishlist là module mới với nhiều tính năng phức tạp:
 * - Wishlist item management
 * - Collection management
 * - Price alert system
 * - Cache management
 *
 * Test Coverage:
 * - Add/Update/Remove wishlist items
 * - Move to cart functionality
 * - Get wishlist count (with caching)
 * - Collection CRUD operations
 * - Price alert management
 * - Cache invalidation
 * - Error handling
 */

describe('WishlistService', () => {
  let service: WishlistService
  let mockWishlistRepo: jest.Mocked<WishlistRepo>
  let mockCacheManager: jest.Mocked<Cache>

  // Test data factories
  const createAddItemData = (overrides = {}) => ({
    productId: 100,
    skuId: 200,
    priority: 1,
    note: 'Test note',
    notifyOnPriceDrops: true,
    notifyOnBackInStock: true,
    notifyOnPromotion: true,
    ...overrides,
  })

  const createWishlistItem = (overrides = {}) => ({
    id: 1,
    userId: 10,
    productId: 100,
    skuId: 200,
    priority: 1,
    note: 'Test note',
    notifyOnPriceDrops: true,
    notifyOnBackInStock: true,
    notifyOnPromotion: true,
    addedAt: new Date(),
    updatedAt: new Date(),
    product: {
      id: 100,
      name: 'Test Product',
      basePrice: 500000,
      virtualPrice: 450000,
      images: ['image1.jpg'],
    },
    sku: {
      id: 200,
      value: 'Size: M, Color: Red',
      price: 450000,
      stock: 50,
      image: 'sku-image.jpg',
    },
    ...overrides,
  })

  const createCollection = (overrides = {}) => ({
    id: 1,
    userId: 10,
    name: 'My Favorites',
    description: 'My favorite products',
    isPublic: false,
    shareCode: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  })

  beforeEach(async () => {
    // Mock WishlistRepo
    mockWishlistRepo = {
      addItem: jest.fn(),
      getItems: jest.fn(),
      updateItem: jest.fn(),
      removeItem: jest.fn(),
      moveToCart: jest.fn(),
      getCount: jest.fn(),
      isWishlisted: jest.fn(),
      setTargetPrice: jest.fn(),
      createCollection: jest.fn(),
      getCollections: jest.fn(),
      updateCollection: jest.fn(),
      deleteCollection: jest.fn(),
      addItemToCollection: jest.fn(),
      removeItemFromCollection: jest.fn(),
      getCollectionByShareCode: jest.fn(),
    } as any

    // Mock Cache Manager
    mockCacheManager = {
      get: jest.fn(),
      set: jest.fn(),
      del: jest.fn(),
    } as any

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WishlistService,
        { provide: WishlistRepo, useValue: mockWishlistRepo },
        { provide: CACHE_MANAGER, useValue: mockCacheManager },
      ],
    }).compile()

    service = module.get<WishlistService>(WishlistService)
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  // ============================================
  // WISHLIST ITEM OPERATIONS
  // ============================================

  describe('addItem', () => {
    it('should add item to wishlist successfully', async () => {
      // Arrange
      const userId = 10
      const data = createAddItemData()
      const expectedItem = createWishlistItem()
      mockWishlistRepo.addItem.mockResolvedValue(expectedItem as any)

      // Act
      const result = await service.addItem(userId, data)

      // Assert
      expect(result).toEqual(expectedItem)
      expect(mockWishlistRepo.addItem).toHaveBeenCalledWith(userId, data)
      expect(mockCacheManager.del).toHaveBeenCalledWith(`wishlist:count:${userId}`)
    })

    it('should invalidate cache after adding item', async () => {
      // Arrange
      const userId = 10
      const data = createAddItemData()
      mockWishlistRepo.addItem.mockResolvedValue(createWishlistItem() as any)

      // Act
      await service.addItem(userId, data)

      // Assert
      expect(mockCacheManager.del).toHaveBeenCalledWith(`wishlist:count:${userId}`)
    })

    it('should handle adding item without SKU', async () => {
      // Arrange
      const userId = 10
      const data = createAddItemData({ skuId: undefined })
      const expectedItem = createWishlistItem({ skuId: null })
      mockWishlistRepo.addItem.mockResolvedValue(expectedItem as any)

      // Act
      const result = await service.addItem(userId, data)

      // Assert
      expect(result).toEqual(expectedItem)
      expect(mockWishlistRepo.addItem).toHaveBeenCalledWith(userId, data)
    })
  })

  describe('getItems', () => {
    it('should get wishlist items with pagination', async () => {
      // Arrange
      const userId = 10
      const query = { page: 1, limit: 20, sortBy: 'addedAt', orderBy: 'desc' } as any
      const expectedResult = {
        data: [createWishlistItem()],
        totalItems: 1,
        page: 1,
        limit: 20,
        totalPages: 1,
      }
      mockWishlistRepo.getItems.mockResolvedValue(expectedResult as any)

      // Act
      const result = await service.getItems(userId, query)

      // Assert
      expect(result).toEqual(expectedResult)
      expect(mockWishlistRepo.getItems).toHaveBeenCalledWith(userId, query)
    })

    it('should handle empty wishlist', async () => {
      // Arrange
      const userId = 10
      const query = { page: 1, limit: 20 } as any
      const expectedResult = {
        data: [],
        totalItems: 0,
        page: 1,
        limit: 20,
        totalPages: 0,
      }
      mockWishlistRepo.getItems.mockResolvedValue(expectedResult as any)

      // Act
      const result = await service.getItems(userId, query)

      // Assert
      expect(result).toEqual(expectedResult)
      expect(result.data).toHaveLength(0)
    })
  })

  describe('updateItem', () => {
    it('should update wishlist item successfully', async () => {
      // Arrange
      const userId = 10
      const itemId = 1
      const data = { priority: 2, note: 'Updated note' }
      const expectedItem = createWishlistItem({ ...data })
      mockWishlistRepo.updateItem.mockResolvedValue(expectedItem as any)

      // Act
      const result = await service.updateItem(userId, itemId, data)

      // Assert
      expect(result).toEqual(expectedItem)
      expect(mockWishlistRepo.updateItem).toHaveBeenCalledWith(userId, itemId, data)
      expect(mockCacheManager.del).toHaveBeenCalledWith(`wishlist:count:${userId}`)
    })

    it('should throw NotFoundException if item not found', async () => {
      // Arrange
      const userId = 10
      const itemId = 999
      const data = { priority: 2 }
      mockWishlistRepo.updateItem.mockRejectedValue(new Error('Not found'))

      // Act & Assert
      await expect(service.updateItem(userId, itemId, data)).rejects.toThrow(NotFoundException)
      await expect(service.updateItem(userId, itemId, data)).rejects.toThrow(
        'Wishlist item not found or you do not have permission',
      )
    })
  })

  describe('removeItem', () => {
    it('should remove item from wishlist successfully', async () => {
      // Arrange
      const userId = 10
      const itemId = 1
      mockWishlistRepo.removeItem.mockResolvedValue({} as any)

      // Act
      const result = await service.removeItem(userId, itemId)

      // Assert
      expect(result).toEqual({ message: 'Item removed from wishlist successfully' })
      expect(mockWishlistRepo.removeItem).toHaveBeenCalledWith(userId, itemId)
      expect(mockCacheManager.del).toHaveBeenCalledWith(`wishlist:count:${userId}`)
    })

    it('should throw NotFoundException if item not found', async () => {
      // Arrange
      const userId = 10
      const itemId = 999
      mockWishlistRepo.removeItem.mockRejectedValue(new Error('Not found'))

      // Act & Assert
      await expect(service.removeItem(userId, itemId)).rejects.toThrow(NotFoundException)
    })
  })

  describe('moveToCart', () => {
    it('should move item to cart successfully', async () => {
      // Arrange
      const userId = 10
      const itemId = 1
      const quantity = 2
      mockWishlistRepo.moveToCart.mockResolvedValue({ success: true } as any)

      // Act
      const result = await service.moveToCart(userId, itemId, quantity)

      // Assert
      expect(result).toEqual({ message: 'Item moved to cart successfully' })
      expect(mockWishlistRepo.moveToCart).toHaveBeenCalledWith(userId, itemId, quantity)
      expect(mockCacheManager.del).toHaveBeenCalledWith(`wishlist:count:${userId}`)
    })

    it('should use default quantity of 1 if not provided', async () => {
      // Arrange
      const userId = 10
      const itemId = 1
      mockWishlistRepo.moveToCart.mockResolvedValue({ success: true } as any)

      // Act
      await service.moveToCart(userId, itemId)

      // Assert
      expect(mockWishlistRepo.moveToCart).toHaveBeenCalledWith(userId, itemId, 1)
    })

    it('should throw BadRequestException if no SKU selected', async () => {
      // Arrange
      const userId = 10
      const itemId = 1
      mockWishlistRepo.moveToCart.mockRejectedValue(new Error('No SKU selected'))

      // Act & Assert
      await expect(service.moveToCart(userId, itemId)).rejects.toThrow(BadRequestException)
      await expect(service.moveToCart(userId, itemId)).rejects.toThrow(
        'Cannot add to cart: No SKU selected for this product',
      )
    })

    it('should throw NotFoundException if item not found', async () => {
      // Arrange
      const userId = 10
      const itemId = 999
      mockWishlistRepo.moveToCart.mockRejectedValue(new Error('Not found'))

      // Act & Assert
      await expect(service.moveToCart(userId, itemId)).rejects.toThrow(NotFoundException)
    })
  })

  describe('getCount', () => {
    it('should return count from cache if available', async () => {
      // Arrange
      const userId = 10
      const cachedCount = 5
      mockCacheManager.get.mockResolvedValue(cachedCount)

      // Act
      const result = await service.getCount(userId)

      // Assert
      expect(result).toEqual({ count: cachedCount })
      expect(mockCacheManager.get).toHaveBeenCalledWith(`wishlist:count:${userId}`)
      expect(mockWishlistRepo.getCount).not.toHaveBeenCalled()
    })

    it('should fetch from database and cache if cache miss', async () => {
      // Arrange
      const userId = 10
      const dbCount = 10
      mockCacheManager.get.mockResolvedValue(null)
      mockWishlistRepo.getCount.mockResolvedValue(dbCount)

      // Act
      const result = await service.getCount(userId)

      // Assert
      expect(result).toEqual({ count: dbCount })
      expect(mockWishlistRepo.getCount).toHaveBeenCalledWith(userId)
      expect(mockCacheManager.set).toHaveBeenCalledWith(`wishlist:count:${userId}`, dbCount, 300000)
    })

    it('should handle count of 0', async () => {
      // Arrange
      const userId = 10
      mockCacheManager.get.mockResolvedValue(0)

      // Act
      const result = await service.getCount(userId)

      // Assert
      expect(result).toEqual({ count: 0 })
    })
  })

  describe('checkWishlisted', () => {
    it('should check if product is wishlisted', async () => {
      // Arrange
      const userId = 10
      const productId = 100
      const skuId = 200
      const expectedResult = { isWishlisted: true, wishlistItemId: 1 }
      mockWishlistRepo.isWishlisted.mockResolvedValue(expectedResult)

      // Act
      const result = await service.checkWishlisted(userId, productId, skuId)

      // Assert
      expect(result).toEqual(expectedResult)
      expect(mockWishlistRepo.isWishlisted).toHaveBeenCalledWith(userId, productId, skuId)
    })

    it('should check without SKU', async () => {
      // Arrange
      const userId = 10
      const productId = 100
      const expectedResult = { isWishlisted: false, wishlistItemId: null }
      mockWishlistRepo.isWishlisted.mockResolvedValue(expectedResult)

      // Act
      const result = await service.checkWishlisted(userId, productId)

      // Assert
      expect(result).toEqual(expectedResult)
      expect(mockWishlistRepo.isWishlisted).toHaveBeenCalledWith(userId, productId, undefined)
    })
  })

  // ============================================
  // COLLECTION OPERATIONS
  // ============================================

  describe('createCollection', () => {
    it('should create collection successfully', async () => {
      // Arrange
      const userId = 10
      const data = { name: 'My Favorites', description: 'Test', isPublic: false }
      const expectedCollection = createCollection()
      mockWishlistRepo.createCollection.mockResolvedValue(expectedCollection as any)

      // Act
      const result = await service.createCollection(userId, data)

      // Assert
      expect(result).toEqual(expectedCollection)
      expect(mockWishlistRepo.createCollection).toHaveBeenCalledWith(userId, data)
    })

    it('should create public collection with share code', async () => {
      // Arrange
      const userId = 10
      const data = { name: 'Public Collection', description: 'Test', isPublic: true }
      const expectedCollection = createCollection({ isPublic: true, shareCode: 'ABC123' })
      mockWishlistRepo.createCollection.mockResolvedValue(expectedCollection as any)

      // Act
      const result = await service.createCollection(userId, data)

      // Assert
      expect(result).toEqual(expectedCollection)
      expect(result.shareCode).toBeDefined()
    })
  })

  describe('getCollections', () => {
    it('should get all collections for user', async () => {
      // Arrange
      const userId = 10
      const expectedResult = {
        data: [createCollection()],
        totalItems: 1,
      }
      mockWishlistRepo.getCollections.mockResolvedValue(expectedResult as any)

      // Act
      const result = await service.getCollections(userId)

      // Assert
      expect(result).toEqual(expectedResult)
      expect(mockWishlistRepo.getCollections).toHaveBeenCalledWith(userId)
    })
  })

  describe('updateCollection', () => {
    it('should update collection successfully', async () => {
      // Arrange
      const userId = 10
      const collectionId = 1
      const data = { name: 'Updated Name' }
      const expectedCollection = createCollection({ name: 'Updated Name' })
      mockWishlistRepo.updateCollection.mockResolvedValue(expectedCollection as any)

      // Act
      const result = await service.updateCollection(userId, collectionId, data)

      // Assert
      expect(result).toEqual(expectedCollection)
      expect(mockWishlistRepo.updateCollection).toHaveBeenCalledWith(userId, collectionId, data)
    })

    it('should throw NotFoundException if collection not found', async () => {
      // Arrange
      const userId = 10
      const collectionId = 999
      const data = { name: 'Updated' }
      mockWishlistRepo.updateCollection.mockRejectedValue(new Error('Not found'))

      // Act & Assert
      await expect(service.updateCollection(userId, collectionId, data)).rejects.toThrow(NotFoundException)
    })
  })

  describe('deleteCollection', () => {
    it('should delete collection successfully', async () => {
      // Arrange
      const userId = 10
      const collectionId = 1
      mockWishlistRepo.deleteCollection.mockResolvedValue({} as any)

      // Act
      const result = await service.deleteCollection(userId, collectionId)

      // Assert
      expect(result).toEqual({ message: 'Collection deleted successfully' })
      expect(mockWishlistRepo.deleteCollection).toHaveBeenCalledWith(userId, collectionId)
    })

    it('should throw NotFoundException if collection not found', async () => {
      // Arrange
      const userId = 10
      const collectionId = 999
      mockWishlistRepo.deleteCollection.mockRejectedValue(new Error('Not found'))

      // Act & Assert
      await expect(service.deleteCollection(userId, collectionId)).rejects.toThrow(NotFoundException)
    })
  })

  describe('addItemToCollection', () => {
    it('should add item to collection successfully', async () => {
      // Arrange
      const userId = 10
      const collectionId = 1
      const wishlistItemId = 5
      mockWishlistRepo.addItemToCollection.mockResolvedValue({} as any)

      // Act
      const result = await service.addItemToCollection(userId, collectionId, wishlistItemId)

      // Assert
      expect(result).toEqual({ message: 'Item added to collection successfully' })
      expect(mockWishlistRepo.addItemToCollection).toHaveBeenCalledWith(userId, collectionId, wishlistItemId)
    })

    it('should throw NotFoundException if collection or item not found', async () => {
      // Arrange
      const userId = 10
      const collectionId = 999
      const wishlistItemId = 5
      mockWishlistRepo.addItemToCollection.mockRejectedValue(new Error('Collection not found'))

      // Act & Assert
      await expect(service.addItemToCollection(userId, collectionId, wishlistItemId)).rejects.toThrow(NotFoundException)
    })

    it('should throw BadRequestException if item already in collection', async () => {
      // Arrange
      const userId = 10
      const collectionId = 1
      const wishlistItemId = 5
      mockWishlistRepo.addItemToCollection.mockRejectedValue(new Error('Already exists'))

      // Act & Assert
      await expect(service.addItemToCollection(userId, collectionId, wishlistItemId)).rejects.toThrow(
        BadRequestException,
      )
    })
  })

  describe('removeItemFromCollection', () => {
    it('should remove item from collection successfully', async () => {
      // Arrange
      const collectionId = 1
      const wishlistItemId = 5
      mockWishlistRepo.removeItemFromCollection.mockResolvedValue({} as any)

      // Act
      const result = await service.removeItemFromCollection(collectionId, wishlistItemId)

      // Assert
      expect(result).toEqual({ message: 'Item removed from collection successfully' })
      expect(mockWishlistRepo.removeItemFromCollection).toHaveBeenCalledWith(collectionId, wishlistItemId)
    })

    it('should throw NotFoundException if collection item not found', async () => {
      // Arrange
      const collectionId = 999
      const wishlistItemId = 5
      mockWishlistRepo.removeItemFromCollection.mockRejectedValue(new Error('Not found'))

      // Act & Assert
      await expect(service.removeItemFromCollection(collectionId, wishlistItemId)).rejects.toThrow(NotFoundException)
    })
  })

  describe('getSharedCollection', () => {
    it('should get shared collection by share code', async () => {
      // Arrange
      const shareCode = 'ABC123'
      const expectedCollection = createCollection({ isPublic: true, shareCode })
      mockWishlistRepo.getCollectionByShareCode.mockResolvedValue(expectedCollection as any)

      // Act
      const result = await service.getSharedCollection(shareCode)

      // Assert
      expect(result).toEqual(expectedCollection)
      expect(mockWishlistRepo.getCollectionByShareCode).toHaveBeenCalledWith(shareCode)
    })

    it('should throw NotFoundException if shared collection not found', async () => {
      // Arrange
      const shareCode = 'INVALID'
      mockWishlistRepo.getCollectionByShareCode.mockResolvedValue(null)

      // Act & Assert
      await expect(service.getSharedCollection(shareCode)).rejects.toThrow(NotFoundException)
      await expect(service.getSharedCollection(shareCode)).rejects.toThrow('Shared collection not found or is private')
    })
  })

  // ============================================
  // PRICE ALERT OPERATIONS
  // ============================================

  describe('setTargetPrice', () => {
    it('should set target price successfully', async () => {
      // Arrange
      const userId = 10
      const itemId = 1
      const targetPrice = 400000
      mockWishlistRepo.setTargetPrice.mockResolvedValue({ count: 1 } as any)

      // Act
      const result = await service.setTargetPrice(userId, itemId, targetPrice)

      // Assert
      expect(result).toEqual({ message: 'Target price set successfully' })
      expect(mockWishlistRepo.setTargetPrice).toHaveBeenCalledWith(userId, itemId, targetPrice)
    })

    it('should throw NotFoundException if item not found', async () => {
      // Arrange
      const userId = 10
      const itemId = 999
      const targetPrice = 400000
      mockWishlistRepo.setTargetPrice.mockRejectedValue(new Error('Not found'))

      // Act & Assert
      await expect(service.setTargetPrice(userId, itemId, targetPrice)).rejects.toThrow(NotFoundException)
    })
  })

  // ============================================
  // ADDITIONAL EDGE CASES
  // ============================================

  describe('Edge Cases', () => {
    it('should handle duplicate product add (repo handles uniqueness)', async () => {
      const userId = 10
      const data = { productId: 100, skuId: 10 }
      mockWishlistRepo.addItem.mockRejectedValue(new Error('Unique constraint failed'))

      await expect(service.addItem(userId, data as any)).rejects.toThrow()
    })

    it('should handle removing non-existent item', async () => {
      const userId = 10
      const itemId = 99999
      mockWishlistRepo.removeItem.mockRejectedValue(new Error('Record not found'))

      await expect(service.removeItem(userId, itemId)).rejects.toThrow(NotFoundException)
    })

    it('should handle concurrent addItem and removeItem', async () => {
      const userId = 10
      mockWishlistRepo.addItem.mockResolvedValue({} as any)
      mockWishlistRepo.removeItem.mockResolvedValue({} as any)
      mockCacheManager.del.mockResolvedValue(true)

      await Promise.all([service.addItem(userId, { productId: 1 } as any), service.removeItem(userId, 1)])

      expect(mockWishlistRepo.addItem).toHaveBeenCalledTimes(1)
      expect(mockWishlistRepo.removeItem).toHaveBeenCalledTimes(1)
    })

    it('should handle empty pagination result for getItems', async () => {
      const userId = 10
      const query = { page: 100, limit: 10 }
      mockWishlistRepo.getItems.mockResolvedValue({ data: [], totalItems: 0, page: 100, limit: 10, totalPages: 0 })

      const result = await service.getItems(userId, query as any)

      expect(result.data).toEqual([])
      expect(result.totalItems).toBe(0)
    })

    it('should handle moveToCart when no SKU selected', async () => {
      const userId = 10
      const itemId = 1
      const error = new Error('No SKU')
      ;(error as any).code = 'NO_SKU'
      mockWishlistRepo.moveToCart.mockRejectedValue(error)

      await expect(service.moveToCart(userId, itemId)).rejects.toThrow()
    })

    it('should handle cache invalidation failure gracefully in addItem', async () => {
      const userId = 10
      const data = { productId: 100, skuId: 10 }
      mockWishlistRepo.addItem.mockResolvedValue({} as any)
      mockCacheManager.del.mockRejectedValue(new Error('Redis connection failed'))

      // addItem calls invalidateWishlistCache which may throw
      await expect(service.addItem(userId, data as any)).rejects.toThrow('Redis connection failed')
    })
  })
})
