import { BadRequestException, NotFoundException } from '@nestjs/common'
import { Test, TestingModule } from '@nestjs/testing'
import { WishlistController } from '../wishlist.controller'
import { WishlistService } from '../wishlist.service'

describe('WishlistController', () => {
  let controller: WishlistController
  let service: WishlistService

  // Mock WishlistService
  const mockWishlistService = {
    getItems: jest.fn(),
    addItem: jest.fn(),
    updateItem: jest.fn(),
    removeItem: jest.fn(),
    moveToCart: jest.fn(),
    getCount: jest.fn(),
    checkWishlisted: jest.fn(),
    createCollection: jest.fn(),
    getCollections: jest.fn(),
    updateCollection: jest.fn(),
    deleteCollection: jest.fn(),
    addItemToCollection: jest.fn(),
    getSharedCollection: jest.fn(),
    setTargetPrice: jest.fn(),
  }

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [WishlistController],
      providers: [
        {
          provide: WishlistService,
          useValue: mockWishlistService,
        },
      ],
    }).compile()

    controller = module.get<WishlistController>(WishlistController)
    service = module.get<WishlistService>(WishlistService)

    // Reset mocks
    jest.clearAllMocks()
  })

  // ============================================
  // Test Data Factories
  // ============================================

  const createMockWishlistItem = (overrides = {}) => ({
    id: 1,
    userId: 1,
    productId: 100,
    skuId: 200,
    note: 'Test note',
    priority: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  })

  const createMockCollection = (overrides = {}) => ({
    id: 1,
    userId: 1,
    name: 'My Collection',
    description: 'Test collection',
    isPublic: false,
    shareCode: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  })

  // ============================================
  // WISHLIST ITEM ENDPOINTS TESTS
  // ============================================

  describe('getItems', () => {
    it('should get wishlist items successfully', async () => {
      const userId = 1
      const query = { page: 1, limit: 10, sortBy: 'addedAt' as const, orderBy: 'desc' as const }
      const mockResult = {
        data: [createMockWishlistItem()],
        totalItems: 1,
        page: 1,
        limit: 10,
        totalPages: 1,
      }

      mockWishlistService.getItems.mockResolvedValue(mockResult)

      const result = await controller.getItems(userId, query as any)

      expect(result).toEqual(mockResult)
      expect(service.getItems).toHaveBeenCalledWith(userId, query)
      expect(service.getItems).toHaveBeenCalledTimes(1)
    })

    it('should get wishlist items with pagination', async () => {
      const userId = 1
      const query = { page: 2, limit: 20, sortBy: 'priority' as const, orderBy: 'asc' as const }
      const mockResult = {
        data: [createMockWishlistItem({ id: 2 })],
        totalItems: 25,
        page: 2,
        limit: 20,
        totalPages: 2,
      }

      mockWishlistService.getItems.mockResolvedValue(mockResult)

      const result = await controller.getItems(userId, query as any)

      expect(result).toEqual(mockResult)
      expect(service.getItems).toHaveBeenCalledWith(userId, query)
    })

    it('should return empty array when no items', async () => {
      const userId = 1
      const query = { page: 1, limit: 10, sortBy: 'addedAt' as const, orderBy: 'desc' as const }
      const mockResult = {
        data: [],
        totalItems: 0,
        page: 1,
        limit: 10,
        totalPages: 0,
      }

      mockWishlistService.getItems.mockResolvedValue(mockResult)

      const result = await controller.getItems(userId, query as any)

      expect(result.data).toHaveLength(0)
      expect(result.totalItems).toBe(0)
    })
  })

  describe('addItem', () => {
    it('should add item to wishlist successfully', async () => {
      const userId = 1
      const body = {
        productId: 100,
        skuId: 200,
        note: 'Test note',
        priority: 1,
        notifyOnPriceDrops: true,
        notifyOnBackInStock: true,
        notifyOnPromotion: true,
      }
      const mockResult = createMockWishlistItem()

      mockWishlistService.addItem.mockResolvedValue(mockResult)

      const result = await controller.addItem(userId, body as any)

      expect(result).toEqual(mockResult)
      expect(service.addItem).toHaveBeenCalledWith(userId, body)
      expect(service.addItem).toHaveBeenCalledTimes(1)
    })

    it('should add item without SKU', async () => {
      const userId = 1
      const body = {
        productId: 100,
        note: 'No SKU',
        priority: 0,
        notifyOnPriceDrops: true,
        notifyOnBackInStock: true,
        notifyOnPromotion: true,
      }
      const mockResult = createMockWishlistItem({ skuId: null })

      mockWishlistService.addItem.mockResolvedValue(mockResult)

      const result = await controller.addItem(userId, body as any)

      expect(result.skuId).toBeNull()
      expect(service.addItem).toHaveBeenCalledWith(userId, body)
    })

    it('should add item with default priority', async () => {
      const userId = 1
      const body = {
        productId: 100,
        priority: 0,
        notifyOnPriceDrops: true,
        notifyOnBackInStock: true,
        notifyOnPromotion: true,
      }
      const mockResult = createMockWishlistItem({ priority: 0 })

      mockWishlistService.addItem.mockResolvedValue(mockResult)

      const result = await controller.addItem(userId, body as any)

      expect(result.priority).toBe(0)
    })
  })

  describe('updateItem', () => {
    it('should update wishlist item successfully', async () => {
      const userId = 1
      const params = { itemId: 1 }
      const body = { note: 'Updated note', priority: 2 }
      const mockResult = createMockWishlistItem({ note: 'Updated note', priority: 2 })

      mockWishlistService.updateItem.mockResolvedValue(mockResult)

      const result = await controller.updateItem(userId, params, body)

      expect(result).toEqual(mockResult)
      expect(service.updateItem).toHaveBeenCalledWith(userId, params.itemId, body)
      expect(service.updateItem).toHaveBeenCalledTimes(1)
    })

    it('should throw NotFoundException when item not found', async () => {
      const userId = 1
      const params = { itemId: 999 }
      const body = { note: 'Updated' }

      mockWishlistService.updateItem.mockRejectedValue(
        new NotFoundException('Wishlist item not found or you do not have permission'),
      )

      await expect(controller.updateItem(userId, params, body)).rejects.toThrow(NotFoundException)
      expect(service.updateItem).toHaveBeenCalledWith(userId, params.itemId, body)
    })

    it('should update only note', async () => {
      const userId = 1
      const params = { itemId: 1 }
      const body = { note: 'Only note updated' }
      const mockResult = createMockWishlistItem({ note: 'Only note updated' })

      mockWishlistService.updateItem.mockResolvedValue(mockResult)

      const result = await controller.updateItem(userId, params, body)

      expect(result.note).toBe('Only note updated')
    })

    it('should update only priority', async () => {
      const userId = 1
      const params = { itemId: 1 }
      const body = { priority: 2 }
      const mockResult = createMockWishlistItem({ priority: 2 })

      mockWishlistService.updateItem.mockResolvedValue(mockResult)

      const result = await controller.updateItem(userId, params, body)

      expect(result.priority).toBe(2)
    })
  })

  describe('removeItem', () => {
    it('should remove item from wishlist successfully', async () => {
      const userId = 1
      const params = { itemId: 1 }
      const mockResult = { message: 'Item removed from wishlist successfully' }

      mockWishlistService.removeItem.mockResolvedValue(mockResult)

      const result = await controller.removeItem(userId, params)

      expect(result).toEqual(mockResult)
      expect(service.removeItem).toHaveBeenCalledWith(userId, params.itemId)
      expect(service.removeItem).toHaveBeenCalledTimes(1)
    })

    it('should throw NotFoundException when item not found', async () => {
      const userId = 1
      const params = { itemId: 999 }

      mockWishlistService.removeItem.mockRejectedValue(
        new NotFoundException('Wishlist item not found or you do not have permission'),
      )

      await expect(controller.removeItem(userId, params)).rejects.toThrow(NotFoundException)
      expect(service.removeItem).toHaveBeenCalledWith(userId, params.itemId)
    })

    it('should throw NotFoundException when user does not own item', async () => {
      const userId = 2
      const params = { itemId: 1 }

      mockWishlistService.removeItem.mockRejectedValue(
        new NotFoundException('Wishlist item not found or you do not have permission'),
      )

      await expect(controller.removeItem(userId, params)).rejects.toThrow(NotFoundException)
    })
  })

  describe('moveToCart', () => {
    it('should move item to cart successfully', async () => {
      const userId = 1
      const params = { itemId: 1 }
      const body = { quantity: 2 }
      const mockResult = { message: 'Item moved to cart successfully' }

      mockWishlistService.moveToCart.mockResolvedValue(mockResult)

      const result = await controller.moveToCart(userId, params, body)

      expect(result).toEqual(mockResult)
      expect(service.moveToCart).toHaveBeenCalledWith(userId, params.itemId, body.quantity)
      expect(service.moveToCart).toHaveBeenCalledTimes(1)
    })

    it('should move item to cart with default quantity 1', async () => {
      const userId = 1
      const params = { itemId: 1 }
      const body = { quantity: 1 }
      const mockResult = { message: 'Item moved to cart successfully' }

      mockWishlistService.moveToCart.mockResolvedValue(mockResult)

      const result = await controller.moveToCart(userId, params, body)

      expect(service.moveToCart).toHaveBeenCalledWith(userId, params.itemId, 1)
    })

    it('should throw BadRequestException when no SKU selected', async () => {
      const userId = 1
      const params = { itemId: 1 }
      const body = { quantity: 1 }

      mockWishlistService.moveToCart.mockRejectedValue(
        new BadRequestException('Cannot add to cart: No SKU selected for this product'),
      )

      await expect(controller.moveToCart(userId, params, body)).rejects.toThrow(BadRequestException)
      expect(service.moveToCart).toHaveBeenCalledWith(userId, params.itemId, body.quantity)
    })

    it('should throw NotFoundException when item not found', async () => {
      const userId = 1
      const params = { itemId: 999 }
      const body = { quantity: 1 }

      mockWishlistService.moveToCart.mockRejectedValue(
        new NotFoundException('Wishlist item not found or you do not have permission'),
      )

      await expect(controller.moveToCart(userId, params, body)).rejects.toThrow(NotFoundException)
    })
  })

  describe('getCount', () => {
    it('should get wishlist count successfully', async () => {
      const userId = 1
      const mockResult = { count: 5 }

      mockWishlistService.getCount.mockResolvedValue(mockResult)

      const result = await controller.getCount(userId)

      expect(result).toEqual(mockResult)
      expect(service.getCount).toHaveBeenCalledWith(userId)
      expect(service.getCount).toHaveBeenCalledTimes(1)
    })

    it('should return zero count when wishlist is empty', async () => {
      const userId = 1
      const mockResult = { count: 0 }

      mockWishlistService.getCount.mockResolvedValue(mockResult)

      const result = await controller.getCount(userId)

      expect(result.count).toBe(0)
    })

    it('should return cached count', async () => {
      const userId = 1
      const mockResult = { count: 10 }

      mockWishlistService.getCount.mockResolvedValue(mockResult)

      const result = await controller.getCount(userId)

      expect(result.count).toBe(10)
    })
  })

  describe('checkWishlisted', () => {
    it('should check if product is wishlisted', async () => {
      const userId = 1
      const query = { productId: 100, skuId: 200 }
      const mockResult = { isWishlisted: true, wishlistItemId: 1 }

      mockWishlistService.checkWishlisted.mockResolvedValue(mockResult)

      const result = await controller.checkWishlisted(userId, query)

      expect(result).toEqual(mockResult)
      expect(service.checkWishlisted).toHaveBeenCalledWith(userId, query.productId, query.skuId)
      expect(service.checkWishlisted).toHaveBeenCalledTimes(1)
    })

    it('should check product without SKU', async () => {
      const userId = 1
      const query = { productId: 100 }
      const mockResult = { isWishlisted: true, wishlistItemId: 1 }

      mockWishlistService.checkWishlisted.mockResolvedValue(mockResult)

      const result = await controller.checkWishlisted(userId, query)

      expect(service.checkWishlisted).toHaveBeenCalledWith(userId, query.productId, undefined)
    })

    it('should return false when product is not wishlisted', async () => {
      const userId = 1
      const query = { productId: 100 }
      const mockResult = { isWishlisted: false, wishlistItemId: null }

      mockWishlistService.checkWishlisted.mockResolvedValue(mockResult)

      const result = await controller.checkWishlisted(userId, query)

      expect(result.isWishlisted).toBe(false)
      expect(result.wishlistItemId).toBeNull()
    })
  })

  // ============================================
  // WISHLIST COLLECTION ENDPOINTS TESTS
  // ============================================

  describe('getCollections', () => {
    it('should get all collections successfully', async () => {
      const userId = 1
      const mockResult = {
        data: [
          { ...createMockCollection(), itemCount: 5 },
          { ...createMockCollection({ id: 2, name: 'Collection 2' }), itemCount: 3 },
        ],
        totalItems: 2,
      }

      mockWishlistService.getCollections.mockResolvedValue(mockResult)

      const result = await controller.getCollections(userId)

      expect(result).toEqual(mockResult)
      expect(service.getCollections).toHaveBeenCalledWith(userId)
      expect(service.getCollections).toHaveBeenCalledTimes(1)
    })

    it('should return empty array when no collections', async () => {
      const userId = 1
      const mockResult = { data: [], totalItems: 0 }

      mockWishlistService.getCollections.mockResolvedValue(mockResult)

      const result = await controller.getCollections(userId)

      expect(result.data).toHaveLength(0)
    })
  })

  describe('createCollection', () => {
    it('should create collection successfully', async () => {
      const userId = 1
      const body = { name: 'New Collection', description: 'Test description', isPublic: false }
      const mockResult = createMockCollection(body)

      mockWishlistService.createCollection.mockResolvedValue(mockResult)

      const result = await controller.createCollection(userId, body as any)

      expect(result).toEqual(mockResult)
      expect(service.createCollection).toHaveBeenCalledWith(userId, body)
      expect(service.createCollection).toHaveBeenCalledTimes(1)
    })

    it('should create public collection with share code', async () => {
      const userId = 1
      const body = { name: 'Public Collection', isPublic: true }
      const mockResult = createMockCollection({ ...body, shareCode: 'ABC123' })

      mockWishlistService.createCollection.mockResolvedValue(mockResult)

      const result = await controller.createCollection(userId, body as any)

      expect(result.isPublic).toBe(true)
      expect(result.shareCode).toBe('ABC123')
    })

    it('should create collection without description', async () => {
      const userId = 1
      const body = { name: 'Simple Collection', isPublic: false }
      const mockResult = createMockCollection({ name: 'Simple Collection', description: null })

      mockWishlistService.createCollection.mockResolvedValue(mockResult)

      const result = await controller.createCollection(userId, body as any)

      expect(result.description).toBeNull()
    })
  })

  describe('updateCollection', () => {
    it('should update collection successfully', async () => {
      const userId = 1
      const params = { collectionId: 1 }
      const body = { name: 'Updated Collection', description: 'Updated description' }
      const mockResult = createMockCollection(body)

      mockWishlistService.updateCollection.mockResolvedValue(mockResult)

      const result = await controller.updateCollection(userId, params, body)

      expect(result).toEqual(mockResult)
      expect(service.updateCollection).toHaveBeenCalledWith(userId, params.collectionId, body)
      expect(service.updateCollection).toHaveBeenCalledTimes(1)
    })

    it('should throw NotFoundException when collection not found', async () => {
      const userId = 1
      const params = { collectionId: 999 }
      const body = { name: 'Updated' }

      mockWishlistService.updateCollection.mockRejectedValue(
        new NotFoundException('Collection not found or you do not have permission'),
      )

      await expect(controller.updateCollection(userId, params, body)).rejects.toThrow(NotFoundException)
      expect(service.updateCollection).toHaveBeenCalledWith(userId, params.collectionId, body)
    })

    it('should update collection visibility', async () => {
      const userId = 1
      const params = { collectionId: 1 }
      const body = { isPublic: true }
      const mockResult = createMockCollection({ isPublic: true, shareCode: 'XYZ789' })

      mockWishlistService.updateCollection.mockResolvedValue(mockResult)

      const result = await controller.updateCollection(userId, params, body)

      expect(result.isPublic).toBe(true)
      expect(result.shareCode).toBeTruthy()
    })
  })

  describe('deleteCollection', () => {
    it('should delete collection successfully', async () => {
      const userId = 1
      const params = { collectionId: 1 }
      const mockResult = { message: 'Collection deleted successfully' }

      mockWishlistService.deleteCollection.mockResolvedValue(mockResult)

      const result = await controller.deleteCollection(userId, params)

      expect(result).toEqual(mockResult)
      expect(service.deleteCollection).toHaveBeenCalledWith(userId, params.collectionId)
      expect(service.deleteCollection).toHaveBeenCalledTimes(1)
    })

    it('should throw NotFoundException when collection not found', async () => {
      const userId = 1
      const params = { collectionId: 999 }

      mockWishlistService.deleteCollection.mockRejectedValue(
        new NotFoundException('Collection not found or you do not have permission'),
      )

      await expect(controller.deleteCollection(userId, params)).rejects.toThrow(NotFoundException)
      expect(service.deleteCollection).toHaveBeenCalledWith(userId, params.collectionId)
    })

    it('should throw NotFoundException when user does not own collection', async () => {
      const userId = 2
      const params = { collectionId: 1 }

      mockWishlistService.deleteCollection.mockRejectedValue(
        new NotFoundException('Collection not found or you do not have permission'),
      )

      await expect(controller.deleteCollection(userId, params)).rejects.toThrow(NotFoundException)
    })
  })

  describe('addItemToCollection', () => {
    it('should add item to collection successfully', async () => {
      const userId = 1
      const params = { collectionId: 1 }
      const body = { wishlistItemId: 10 }
      const mockResult = { message: 'Item added to collection successfully' }

      mockWishlistService.addItemToCollection.mockResolvedValue(mockResult)

      const result = await controller.addItemToCollection(userId, params, body)

      expect(result).toEqual(mockResult)
      expect(service.addItemToCollection).toHaveBeenCalledWith(userId, params.collectionId, body.wishlistItemId)
      expect(service.addItemToCollection).toHaveBeenCalledTimes(1)
    })

    it('should throw NotFoundException when collection not found', async () => {
      const userId = 1
      const params = { collectionId: 999 }
      const body = { wishlistItemId: 10 }

      mockWishlistService.addItemToCollection.mockRejectedValue(
        new NotFoundException('Collection or wishlist item not found'),
      )

      await expect(controller.addItemToCollection(userId, params, body)).rejects.toThrow(NotFoundException)
      expect(service.addItemToCollection).toHaveBeenCalledWith(userId, params.collectionId, body.wishlistItemId)
    })

    it('should throw NotFoundException when wishlist item not found', async () => {
      const userId = 1
      const params = { collectionId: 1 }
      const body = { wishlistItemId: 999 }

      mockWishlistService.addItemToCollection.mockRejectedValue(
        new NotFoundException('Collection or wishlist item not found'),
      )

      await expect(controller.addItemToCollection(userId, params, body)).rejects.toThrow(NotFoundException)
    })

    it('should throw BadRequestException when item already in collection', async () => {
      const userId = 1
      const params = { collectionId: 1 }
      const body = { wishlistItemId: 10 }

      mockWishlistService.addItemToCollection.mockRejectedValue(
        new BadRequestException('Item already in collection or invalid request'),
      )

      await expect(controller.addItemToCollection(userId, params, body)).rejects.toThrow(BadRequestException)
    })
  })

  describe('getSharedCollection', () => {
    it('should get shared collection successfully', async () => {
      const shareCode = 'ABC123'
      const mockResult = createMockCollection({ isPublic: true, shareCode })

      mockWishlistService.getSharedCollection.mockResolvedValue(mockResult)

      const result = await controller.getSharedCollection(shareCode)

      expect(result).toEqual(mockResult)
      expect(service.getSharedCollection).toHaveBeenCalledWith(shareCode)
      expect(service.getSharedCollection).toHaveBeenCalledTimes(1)
    })

    it('should throw NotFoundException when share code not found', async () => {
      const shareCode = 'INVALID'

      mockWishlistService.getSharedCollection.mockRejectedValue(
        new NotFoundException('Shared collection not found or is private'),
      )

      await expect(controller.getSharedCollection(shareCode)).rejects.toThrow(NotFoundException)
      expect(service.getSharedCollection).toHaveBeenCalledWith(shareCode)
    })

    it('should throw NotFoundException when collection is private', async () => {
      const shareCode = 'PRIVATE123'

      mockWishlistService.getSharedCollection.mockRejectedValue(
        new NotFoundException('Shared collection not found or is private'),
      )

      await expect(controller.getSharedCollection(shareCode)).rejects.toThrow(NotFoundException)
    })
  })

  // ============================================
  // PRICE ALERT ENDPOINTS TESTS
  // ============================================

  describe('setTargetPrice', () => {
    it('should set target price successfully', async () => {
      const userId = 1
      const params = { itemId: 1 }
      const body = { targetPrice: 50000 }
      const mockResult = { message: 'Target price set successfully' }

      mockWishlistService.setTargetPrice.mockResolvedValue(mockResult)

      const result = await controller.setTargetPrice(userId, params, body)

      expect(result).toEqual(mockResult)
      expect(service.setTargetPrice).toHaveBeenCalledWith(userId, params.itemId, body.targetPrice)
      expect(service.setTargetPrice).toHaveBeenCalledTimes(1)
    })

    it('should throw NotFoundException when item not found', async () => {
      const userId = 1
      const params = { itemId: 999 }
      const body = { targetPrice: 50000 }

      mockWishlistService.setTargetPrice.mockRejectedValue(
        new NotFoundException('Wishlist item not found or you do not have permission'),
      )

      await expect(controller.setTargetPrice(userId, params, body)).rejects.toThrow(NotFoundException)
      expect(service.setTargetPrice).toHaveBeenCalledWith(userId, params.itemId, body.targetPrice)
    })

    it('should set target price to zero', async () => {
      const userId = 1
      const params = { itemId: 1 }
      const body = { targetPrice: 0 }
      const mockResult = { message: 'Target price set successfully' }

      mockWishlistService.setTargetPrice.mockResolvedValue(mockResult)

      const result = await controller.setTargetPrice(userId, params, body)

      expect(service.setTargetPrice).toHaveBeenCalledWith(userId, params.itemId, 0)
    })

    it('should update existing target price', async () => {
      const userId = 1
      const params = { itemId: 1 }
      const body = { targetPrice: 75000 }
      const mockResult = { message: 'Target price set successfully' }

      mockWishlistService.setTargetPrice.mockResolvedValue(mockResult)

      const result = await controller.setTargetPrice(userId, params, body)

      expect(service.setTargetPrice).toHaveBeenCalledWith(userId, params.itemId, 75000)
    })
  })

  // ===== RESPONSE STRUCTURE SNAPSHOTS =====

  describe('Response Structure Snapshots', () => {
    const fixedDate = '2024-01-01T00:00:00.000Z'

    it('should match wishlist items list response structure', async () => {
      const mockResult = {
        data: [createMockWishlistItem({ createdAt: fixedDate, updatedAt: fixedDate })],
        totalItems: 1,
        page: 1,
        limit: 10,
        totalPages: 1,
      }
      mockWishlistService.getItems.mockResolvedValue(mockResult)
      const result = await controller.getItems(1, { page: 1, limit: 10, sortBy: 'addedAt', orderBy: 'desc' } as any)
      expect(result).toMatchSnapshot()
    })

    it('should match wishlist collection response structure', async () => {
      const mockResult = {
        data: [createMockCollection({ createdAt: fixedDate, updatedAt: fixedDate })],
        totalItems: 1,
        page: 1,
        limit: 10,
        totalPages: 1,
      }
      mockWishlistService.getCollections.mockResolvedValue(mockResult)
      const result = await controller.getCollections(1)
      expect(result).toMatchSnapshot()
    })

    it('should match wishlist count response structure', async () => {
      mockWishlistService.getCount.mockResolvedValue({ count: 5 })
      const result = await controller.getCount(1)
      expect(result).toMatchSnapshot()
    })
  })
})
