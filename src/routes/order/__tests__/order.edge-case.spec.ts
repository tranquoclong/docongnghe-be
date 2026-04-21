import { Test, TestingModule } from '@nestjs/testing'
import { OrderService } from '../order.service'
import { OrderRepo, CartItemWithRelations } from '../order.repo'
import { CreateOrderBodyType } from '../order.model'
import { VoucherRepository } from '../../voucher/voucher.repo'

describe('OrderService — Edge Cases', () => {
  let service: OrderService
  let mockOrderRepo: jest.Mocked<OrderRepo>
  let mockVoucherRepository: jest.Mocked<VoucherRepository>

  const createCartItem = (overrides: Partial<CartItemWithRelations> = {}): CartItemWithRelations => ({
    id: 1,
    userId: 1,
    skuId: 1,
    quantity: 2,
    sku: {
      id: 1,
      value: 'Size: M',
      price: 100000,
      stock: 10,
      image: 'img.jpg',
      productId: 1,
      createdById: 1,
      product: {
        id: 1,
        name: 'Product',
        publishedAt: new Date('2024-01-01'),
        deletedAt: null,
        productTranslations: [],
      },
    },
    ...overrides,
  })

  const createBody = (overrides = {}): CreateOrderBodyType => [
    {
      shopId: 1,
      receiver: { name: 'User', phone: '0123456789', address: 'Address' },
      cartItemIds: [1, 2],
      ...overrides,
    },
  ]

  beforeEach(async () => {
    mockOrderRepo = {
      list: jest.fn(),
      create: jest.fn(),
      cancel: jest.fn(),
      detail: jest.fn(),
      fetchAndValidateCartItems: jest.fn(),
    } as any
    mockVoucherRepository = { findById: jest.fn() } as any

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrderService,
        { provide: OrderRepo, useValue: mockOrderRepo },
        { provide: VoucherRepository, useValue: mockVoucherRepository },
      ],
    }).compile()
    service = module.get<OrderService>(OrderService)
  })

  afterEach(() => jest.clearAllMocks())

  describe('create — voucher discount edge cases', () => {
    const setupCreate = (cartItems: CartItemWithRelations[]) => {
      const cartItemMap = new Map<number, CartItemWithRelations>()
      cartItems.forEach((item) => cartItemMap.set(item.id, item))
      mockOrderRepo.fetchAndValidateCartItems.mockResolvedValue({ cartItems, cartItemMap })
      mockOrderRepo.create.mockResolvedValue({ paymentId: 1, orders: [] } as any)
    }

    it('should round PERCENTAGE discount to integer', async () => {
      const items = [createCartItem({ id: 1, quantity: 1, sku: { ...createCartItem().sku, price: 33333 } })]
      setupCreate(items)
      mockVoucherRepository.findById.mockResolvedValue({ id: 1, type: 'PERCENTAGE', value: 33, maxDiscount: null } as any)

      await service.create(1, createBody({ cartItemIds: [1], voucherId: 1 }))

      expect(mockOrderRepo.create).toHaveBeenCalledWith(
        1,
        expect.anything(),
        items,
        expect.arrayContaining([
          expect.objectContaining({ discountAmount: Math.round((33333 * 33) / 100) }),
        ]),
      )
    })

    it('should handle 0% PERCENTAGE voucher', async () => {
      const items = [createCartItem({ id: 1 })]
      setupCreate(items)
      mockVoucherRepository.findById.mockResolvedValue({ id: 1, type: 'PERCENTAGE', value: 0, maxDiscount: null } as any)

      await service.create(1, createBody({ cartItemIds: [1], voucherId: 1 }))

      expect(mockOrderRepo.create).toHaveBeenCalledWith(
        1,
        expect.anything(),
        items,
        expect.arrayContaining([expect.objectContaining({ discountAmount: 0 })]),
      )
    })

    it('should handle 100% PERCENTAGE voucher without maxDiscount', async () => {
      const items = [createCartItem({ id: 1, quantity: 1, sku: { ...createCartItem().sku, price: 50000 } })]
      setupCreate(items)
      mockVoucherRepository.findById.mockResolvedValue({ id: 1, type: 'PERCENTAGE', value: 100, maxDiscount: null } as any)

      await service.create(1, createBody({ cartItemIds: [1], voucherId: 1 }))

      expect(mockOrderRepo.create).toHaveBeenCalledWith(
        1,
        expect.anything(),
        items,
        expect.arrayContaining([expect.objectContaining({ discountAmount: 50000, totalAmount: 0 })]),
      )
    })

    it('should cap PERCENTAGE discount at maxDiscount when exceeded', async () => {
      const items = [createCartItem({ id: 1, quantity: 1, sku: { ...createCartItem().sku, price: 100000 } })]
      setupCreate(items)
      mockVoucherRepository.findById.mockResolvedValue({ id: 1, type: 'PERCENTAGE', value: 50, maxDiscount: 30000 } as any)

      await service.create(1, createBody({ cartItemIds: [1], voucherId: 1 }))

      expect(mockOrderRepo.create).toHaveBeenCalledWith(
        1,
        expect.anything(),
        items,
        expect.arrayContaining([expect.objectContaining({ discountAmount: 30000, totalAmount: 70000 })]),
      )
    })

    it('should apply FIXED_AMOUNT voucher capped at itemsTotal', async () => {
      const items = [createCartItem({ id: 1, quantity: 1, sku: { ...createCartItem().sku, price: 20000 } })]
      setupCreate(items)
      mockVoucherRepository.findById.mockResolvedValue({ id: 1, type: 'FIXED_AMOUNT', value: 50000 } as any)

      await service.create(1, createBody({ cartItemIds: [1], voucherId: 1 }))

      expect(mockOrderRepo.create).toHaveBeenCalledWith(
        1,
        expect.anything(),
        items,
        expect.arrayContaining([expect.objectContaining({ discountAmount: 20000, totalAmount: 0 })]),
      )
    })

    it('should apply FIXED_AMOUNT voucher when value < itemsTotal', async () => {
      const items = [createCartItem({ id: 1, quantity: 1, sku: { ...createCartItem().sku, price: 100000 } })]
      setupCreate(items)
      mockVoucherRepository.findById.mockResolvedValue({ id: 1, type: 'FIXED_AMOUNT', value: 25000 } as any)

      await service.create(1, createBody({ cartItemIds: [1], voucherId: 1 }))

      expect(mockOrderRepo.create).toHaveBeenCalledWith(
        1,
        expect.anything(),
        items,
        expect.arrayContaining([expect.objectContaining({ discountAmount: 25000, totalAmount: 75000 })]),
      )
    })

    it('should apply no discount when voucher not found', async () => {
      const items = [createCartItem({ id: 1, quantity: 1, sku: { ...createCartItem().sku, price: 100000 } })]
      setupCreate(items)
      mockVoucherRepository.findById.mockResolvedValue(null)

      await service.create(1, createBody({ cartItemIds: [1], voucherId: 999 }))

      expect(mockOrderRepo.create).toHaveBeenCalledWith(
        1,
        expect.anything(),
        items,
        expect.arrayContaining([expect.objectContaining({ discountAmount: 0, totalAmount: 100000 })]),
      )
    })
  })

  describe('create — fetchAndValidateCartItems errors', () => {
    it('should propagate NotFoundCartItemException from repo', async () => {
      mockOrderRepo.fetchAndValidateCartItems.mockRejectedValue(new Error('Error.NotFoundCartItem'))
      await expect(service.create(1, createBody())).rejects.toThrow('Error.NotFoundCartItem')
    })

    it('should propagate OutOfStockSKUException from repo', async () => {
      mockOrderRepo.fetchAndValidateCartItems.mockRejectedValue(new Error('Error.OutOfStockSKU'))
      await expect(service.create(1, createBody())).rejects.toThrow('Error.OutOfStockSKU')
    })

    it('should propagate SKUNotBelongToShopException from repo', async () => {
      mockOrderRepo.fetchAndValidateCartItems.mockRejectedValue(new Error('Error.SKUNotBelongToShop'))
      await expect(service.create(1, createBody())).rejects.toThrow('Error.SKUNotBelongToShop')
    })

    it('should propagate ProductNotFoundException from repo', async () => {
      mockOrderRepo.fetchAndValidateCartItems.mockRejectedValue(new Error('Error.ProductNotFound'))
      await expect(service.create(1, createBody())).rejects.toThrow('Error.ProductNotFound')
    })
  })

  describe('cancel — error propagation', () => {
    it('should propagate OrderNotFoundException from repo', async () => {
      mockOrderRepo.cancel.mockRejectedValue(new Error('Error.OrderNotFound'))
      await expect(service.cancel(1, 999)).rejects.toThrow('Error.OrderNotFound')
    })

    it('should propagate CannotCancelOrderException from repo', async () => {
      mockOrderRepo.cancel.mockRejectedValue(new Error('Error.CannotCancelOrder'))
      await expect(service.cancel(1, 1)).rejects.toThrow('Error.CannotCancelOrder')
    })
  })

  describe('detail — error propagation', () => {
    it('should propagate OrderNotFoundException from repo', async () => {
      mockOrderRepo.detail.mockRejectedValue(new Error('Error.OrderNotFound'))
      await expect(service.detail(1, 999)).rejects.toThrow('Error.OrderNotFound')
    })
  })
})
