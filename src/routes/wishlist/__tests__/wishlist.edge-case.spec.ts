import { CACHE_MANAGER } from '@nestjs/cache-manager'
import { BadRequestException, NotFoundException } from '@nestjs/common'
import { Test, TestingModule } from '@nestjs/testing'
import { WishlistRepo } from '../wishlist.repo'
import { WishlistService } from '../wishlist.service'

describe('WishlistService — Edge Cases', () => {
  let service: WishlistService
  let mockWishlistRepo: jest.Mocked<WishlistRepo>
  let mockCacheManager: { get: jest.Mock; set: jest.Mock; del: jest.Mock }

  beforeEach(async () => {
    mockWishlistRepo = {
      addItem: jest.fn(),
      getItems: jest.fn(),
      updateItem: jest.fn(),
      removeItem: jest.fn(),
      moveToCart: jest.fn(),
      getCount: jest.fn(),
      isWishlisted: jest.fn(),
      createCollection: jest.fn(),
      getCollections: jest.fn(),
      updateCollection: jest.fn(),
      deleteCollection: jest.fn(),
      addItemToCollection: jest.fn(),
      removeItemFromCollection: jest.fn(),
      getCollectionByShareCode: jest.fn(),
      setTargetPrice: jest.fn(),
    } as any
    mockCacheManager = { get: jest.fn(), set: jest.fn(), del: jest.fn() }

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WishlistService,
        { provide: WishlistRepo, useValue: mockWishlistRepo },
        { provide: CACHE_MANAGER, useValue: mockCacheManager },
      ],
    }).compile()
    service = module.get<WishlistService>(WishlistService)
  })

  afterEach(() => jest.clearAllMocks())

  describe('updateItem — error handling', () => {
    it('should throw NotFoundException when item not found', async () => {
      mockWishlistRepo.updateItem.mockRejectedValue(new Error('Record not found'))
      await expect(service.updateItem(1, 999, { priority: 1 })).rejects.toThrow(NotFoundException)
    })
  })

  describe('removeItem — error handling', () => {
    it('should throw NotFoundException when item not found', async () => {
      mockWishlistRepo.removeItem.mockRejectedValue(new Error('Record not found'))
      await expect(service.removeItem(1, 999)).rejects.toThrow(NotFoundException)
    })

    it('should invalidate cache on successful removal', async () => {
      mockWishlistRepo.removeItem.mockResolvedValue({} as any)
      await service.removeItem(1, 1)
      expect(mockCacheManager.del).toHaveBeenCalledWith('wishlist:count:1')
    })
  })

  describe('moveToCart — edge cases', () => {
    it('should throw BadRequestException when no SKU selected', async () => {
      mockWishlistRepo.moveToCart.mockRejectedValue(new Error('Cannot add to cart: No SKU selected'))
      await expect(service.moveToCart(1, 1)).rejects.toThrow(BadRequestException)
    })

    it('should throw NotFoundException when wishlist item not found', async () => {
      mockWishlistRepo.moveToCart.mockRejectedValue(new Error('Wishlist item not found'))
      await expect(service.moveToCart(1, 999)).rejects.toThrow(NotFoundException)
    })

    it('should invalidate cache on successful move', async () => {
      mockWishlistRepo.moveToCart.mockResolvedValue({ success: true })
      await service.moveToCart(1, 1, 2)
      expect(mockCacheManager.del).toHaveBeenCalledWith('wishlist:count:1')
    })
  })

  describe('getCount — caching', () => {
    it('should return cached count when available', async () => {
      mockCacheManager.get.mockResolvedValue(5)
      const result = await service.getCount(1)
      expect(result).toEqual({ count: 5 })
      expect(mockWishlistRepo.getCount).not.toHaveBeenCalled()
    })

    it('should fetch from DB and cache when cache miss', async () => {
      mockCacheManager.get.mockResolvedValue(null)
      mockWishlistRepo.getCount.mockResolvedValue(3)
      const result = await service.getCount(1)
      expect(result).toEqual({ count: 3 })
      expect(mockCacheManager.set).toHaveBeenCalledWith('wishlist:count:1', 3, expect.any(Number))
    })

    it('should treat undefined cache as miss', async () => {
      mockCacheManager.get.mockResolvedValue(undefined)
      mockWishlistRepo.getCount.mockResolvedValue(0)
      const result = await service.getCount(1)
      expect(result).toEqual({ count: 0 })
      expect(mockWishlistRepo.getCount).toHaveBeenCalled()
    })
  })

  describe('collection operations — error handling', () => {
    it('should throw NotFoundException when updating non-existent collection', async () => {
      mockWishlistRepo.updateCollection.mockRejectedValue(new Error('Record not found'))
      await expect(service.updateCollection(1, 999, { name: 'New' })).rejects.toThrow(NotFoundException)
    })

    it('should throw NotFoundException when deleting non-existent collection', async () => {
      mockWishlistRepo.deleteCollection.mockRejectedValue(new Error('Record not found'))
      await expect(service.deleteCollection(1, 999)).rejects.toThrow(NotFoundException)
    })

    it('should throw NotFoundException when adding to non-existent collection', async () => {
      mockWishlistRepo.addItemToCollection.mockRejectedValue(new Error('Collection or wishlist item not found'))
      await expect(service.addItemToCollection(1, 999, 1)).rejects.toThrow(NotFoundException)
    })

    it('should throw BadRequestException when item already in collection', async () => {
      mockWishlistRepo.addItemToCollection.mockRejectedValue(new Error('Unique constraint failed'))
      await expect(service.addItemToCollection(1, 1, 1)).rejects.toThrow(BadRequestException)
    })

    it('should throw NotFoundException when removing non-existent collection item', async () => {
      mockWishlistRepo.removeItemFromCollection.mockRejectedValue(new Error('Record not found'))
      await expect(service.removeItemFromCollection(1, 999)).rejects.toThrow(NotFoundException)
    })
  })

  describe('getSharedCollection — edge cases', () => {
    it('should throw NotFoundException when share code not found', async () => {
      mockWishlistRepo.getCollectionByShareCode.mockResolvedValue(null)
      await expect(service.getSharedCollection('INVALID')).rejects.toThrow(NotFoundException)
    })

    it('should return collection when share code is valid', async () => {
      const collection = { id: 1, name: 'My List', shareCode: 'ABC123', items: [] }
      mockWishlistRepo.getCollectionByShareCode.mockResolvedValue(collection)
      const result = await service.getSharedCollection('ABC123')
      expect(result).toEqual(collection)
    })
  })

  describe('setTargetPrice — error handling', () => {
    it('should throw NotFoundException when item not found', async () => {
      mockWishlistRepo.setTargetPrice.mockRejectedValue(new Error('Wishlist item not found'))
      await expect(service.setTargetPrice(1, 999, 50000)).rejects.toThrow(NotFoundException)
    })

    it('should return success on valid target price', async () => {
      mockWishlistRepo.setTargetPrice.mockResolvedValue({} as any)
      const result = await service.setTargetPrice(1, 1, 50000)
      expect(result).toEqual({ message: 'Target price set successfully' })
    })
  })
})
