import { Test, TestingModule } from '@nestjs/testing'
import { CartService } from '../cart.service'
import { CartRepo } from '../cart.repo'

describe('CartService — Edge Cases', () => {
  let service: CartService
  let mockCartRepo: jest.Mocked<CartRepo>

  beforeEach(async () => {
    mockCartRepo = {
      list: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    } as any

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CartService,
        { provide: CartRepo, useValue: mockCartRepo },
      ],
    }).compile()
    service = module.get<CartService>(CartService)
  })

  afterEach(() => jest.clearAllMocks())

  describe('addToCart — error propagation', () => {
    it('should propagate NotFoundSKUException when SKU does not exist', async () => {
      mockCartRepo.create.mockRejectedValue(Object.assign(new Error('Error.SKU.NotFound'), { status: 404 }))
      await expect(service.addToCart(1, { skuId: 999, quantity: 1 })).rejects.toThrow('Error.SKU.NotFound')
    })

    it('should propagate OutOfStockSKUException when stock is insufficient', async () => {
      mockCartRepo.create.mockRejectedValue(Object.assign(new Error('Error.SKU.OutOfStock'), { status: 400 }))
      await expect(service.addToCart(1, { skuId: 1, quantity: 100 })).rejects.toThrow('Error.SKU.OutOfStock')
    })

    it('should propagate InvalidQuantityException when existing + new > stock', async () => {
      mockCartRepo.create.mockRejectedValue(Object.assign(new Error('Error.CartItem.InvalidQuantity'), { status: 400 }))
      await expect(service.addToCart(1, { skuId: 1, quantity: 5 })).rejects.toThrow('Error.CartItem.InvalidQuantity')
    })

    it('should propagate ProductNotFoundException when product is deleted/unpublished', async () => {
      mockCartRepo.create.mockRejectedValue(Object.assign(new Error('Error.Product.NotFound'), { status: 404 }))
      await expect(service.addToCart(1, { skuId: 1, quantity: 1 })).rejects.toThrow('Error.Product.NotFound')
    })
  })

  describe('updateCartItem — error propagation', () => {
    it('should propagate NotFoundCartItemException when cart item not found', async () => {
      mockCartRepo.update.mockRejectedValue(Object.assign(new Error('Error.CartItem.NotFound'), { status: 404 }))
      await expect(
        service.updateCartItem({ userId: 1, cartItemId: 999, body: { skuId: 1, quantity: 2 } }),
      ).rejects.toThrow('Error.CartItem.NotFound')
    })

    it('should propagate OutOfStockSKUException during update', async () => {
      mockCartRepo.update.mockRejectedValue(Object.assign(new Error('Error.SKU.OutOfStock'), { status: 400 }))
      await expect(
        service.updateCartItem({ userId: 1, cartItemId: 1, body: { skuId: 1, quantity: 999 } }),
      ).rejects.toThrow('Error.SKU.OutOfStock')
    })
  })

  describe('deleteCart — edge cases', () => {
    it('should return count 0 when no items match', async () => {
      mockCartRepo.delete.mockResolvedValue({ count: 0 })
      const result = await service.deleteCart(1, { cartItemIds: [999] })
      expect(result).toEqual({ message: '0 item(s) deleted from cart' })
    })

    it('should return correct count for multiple deletions', async () => {
      mockCartRepo.delete.mockResolvedValue({ count: 3 })
      const result = await service.deleteCart(1, { cartItemIds: [1, 2, 3] })
      expect(result).toEqual({ message: '3 item(s) deleted from cart' })
    })
  })

  describe('addToCart — success path', () => {
    it('should call repo.create with correct params', async () => {
      const body = { skuId: 1, quantity: 2 }
      mockCartRepo.create.mockResolvedValue({ id: 1, userId: 1, skuId: 1, quantity: 2 } as any)

      const result = await service.addToCart(1, body)

      expect(mockCartRepo.create).toHaveBeenCalledWith(1, body)
      expect(result).toEqual({ id: 1, userId: 1, skuId: 1, quantity: 2 })
    })
  })
})
