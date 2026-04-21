import { Test, TestingModule } from '@nestjs/testing'
import { WishlistRepo } from 'src/routes/wishlist/wishlist.repo'
import { PrismaService } from 'src/shared/services/prisma.service'

describe('WishlistRepo', () => {
  let repository: WishlistRepo
  let mockPrismaService: any

  // Test data factories
  const createTestData = {
    wishlistItem: (overrides = {}) => ({
      id: 1,
      userId: 1,
      productId: 1,
      skuId: 1,
      note: 'Test note',
      priority: 0,
      notifyOnPriceDrops: true,
      notifyOnBackInStock: true,
      notifyOnPromotion: true,
      addedAt: new Date('2024-01-01'),
      updatedAt: new Date('2024-01-01'),
      ...overrides,
    }),
    product: (overrides = {}) => ({
      id: 1,
      name: 'Test Product',
      basePrice: 100000,
      virtualPrice: 90000,
      images: ['image1.jpg', 'image2.jpg'],
      brandId: 1,
      brand: {
        id: 1,
        name: 'Test Brand',
        logo: 'logo.jpg',
      },
      ...overrides,
    }),
    sku: (overrides = {}) => ({
      id: 1,
      value: JSON.stringify({ color: 'red', size: 'M' }),
      price: 95000,
      stock: 10,
      image: 'sku-image.jpg',
      ...overrides,
    }),
    priceAlert: (overrides = {}) => ({
      id: 1,
      wishlistItemId: 1,
      originalPrice: 100000,
      currentPrice: 95000,
      targetPrice: 80000,
      lastCheckedAt: new Date('2024-01-01'),
      alertSentAt: null,
      ...overrides,
    }),
    collection: (overrides = {}) => ({
      id: 1,
      userId: 1,
      name: 'My Collection',
      description: 'Test collection',
      isPublic: false,
      shareCode: null,
      createdAt: new Date('2024-01-01'),
      updatedAt: new Date('2024-01-01'),
      ...overrides,
    }),
  }

  beforeEach(async () => {
    // Tạo mock cho PrismaService
    mockPrismaService = {
      wishlistItem: {
        upsert: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        count: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      wishlistPriceAlert: {
        upsert: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
      },
      wishlistCollection: {
        create: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      wishlistCollectionItem: {
        create: jest.fn(),
        delete: jest.fn(),
      },
      sKU: {
        findUnique: jest.fn(),
      },
      product: {
        findUnique: jest.fn(),
      },
      cartItem: {
        upsert: jest.fn(),
      },
      $transaction: jest.fn(),
    } as any

    const module: TestingModule = await Test.createTestingModule({
      providers: [WishlistRepo, { provide: PrismaService, useValue: mockPrismaService }],
    }).compile()

    repository = module.get<WishlistRepo>(WishlistRepo)
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  describe('addItem', () => {
    it('should add item to wishlist with SKU', async () => {
      // Arrange - Chuẩn bị dữ liệu
      const userId = 1
      const body = {
        productId: 1,
        skuId: 1,
        note: 'Test note',
        priority: 1,
        notifyOnPriceDrops: true,
        notifyOnBackInStock: true,
        notifyOnPromotion: true,
      }
      const mockSku = createTestData.sku()
      const mockProduct = createTestData.product()
      const mockWishlistItem = {
        ...createTestData.wishlistItem(),
        product: mockProduct,
        sku: mockSku,
      }

      mockPrismaService.sKU.findUnique.mockResolvedValue(mockSku)
      mockPrismaService.product.findUnique.mockResolvedValue(mockProduct)

      mockPrismaService.$transaction.mockImplementation(async (callback) => {
        const tx = {
          wishlistItem: {
            findFirst: jest.fn().mockResolvedValue(null),
            create: jest.fn().mockResolvedValue(mockWishlistItem),
            update: jest.fn().mockResolvedValue(mockWishlistItem),
            upsert: jest.fn().mockResolvedValue(mockWishlistItem),
          },
          wishlistPriceAlert: {
            upsert: jest.fn().mockResolvedValue(createTestData.priceAlert()),
          },
        }
        return callback(tx)
      })

      // Act - Thực thi
      const result = await repository.addItem(userId, body)

      // Assert - Kiểm tra
      expect(result).toMatchObject({
        id: mockWishlistItem.id,
        userId: mockWishlistItem.userId,
        productId: mockWishlistItem.productId,
        skuId: mockWishlistItem.skuId,
      })
      expect(mockPrismaService.sKU.findUnique).toHaveBeenCalledWith({
        where: { id: body.skuId },
        select: { price: true },
      })
      expect(mockPrismaService.$transaction).toHaveBeenCalled()
    })

    it('should add item to wishlist without SKU', async () => {
      // Arrange - Chuẩn bị dữ liệu
      const userId = 1
      const body = {
        productId: 1,
        priority: 0,
        notifyOnPriceDrops: true,
        notifyOnBackInStock: true,
        notifyOnPromotion: true,
      }
      const mockProduct = createTestData.product()
      const mockWishlistItem = {
        ...createTestData.wishlistItem({ skuId: null }),
        product: mockProduct,
        sku: null,
      }

      mockPrismaService.sKU.findUnique.mockResolvedValue(null)
      mockPrismaService.product.findUnique.mockResolvedValue(mockProduct)

      mockPrismaService.$transaction.mockImplementation(async (callback) => {
        const tx = {
          wishlistItem: {
            findFirst: jest.fn().mockResolvedValue(null),
            create: jest.fn().mockResolvedValue(mockWishlistItem),
            update: jest.fn().mockResolvedValue(mockWishlistItem),
            upsert: jest.fn().mockResolvedValue(mockWishlistItem),
          },
          wishlistPriceAlert: {
            upsert: jest.fn().mockResolvedValue(createTestData.priceAlert()),
          },
        }
        return callback(tx)
      })

      // Act - Thực thi
      const result = await repository.addItem(userId, body)

      // Assert - Kiểm tra
      expect(result).toMatchObject({
        id: mockWishlistItem.id,
        userId: mockWishlistItem.userId,
        productId: mockWishlistItem.productId,
      })
      expect(result.skuId).toBeNull()
      expect(mockPrismaService.product.findUnique).toHaveBeenCalled()
    })

    it('should add item with default values when optional fields not provided', async () => {
      // Arrange - Chuẩn bị dữ liệu
      const userId = 1
      const body = {
        productId: 1,
      }
      const mockProduct = createTestData.product()
      const mockWishlistItem = {
        ...createTestData.wishlistItem({ skuId: null, priority: 0 }),
        product: mockProduct,
        sku: null,
      }

      mockPrismaService.sKU.findUnique.mockResolvedValue(null)
      mockPrismaService.product.findUnique.mockResolvedValue(mockProduct)

      mockPrismaService.$transaction.mockImplementation(async (callback) => {
        const tx = {
          wishlistItem: {
            findFirst: jest.fn().mockResolvedValue(null),
            create: jest.fn().mockResolvedValue(mockWishlistItem),
            update: jest.fn().mockResolvedValue(mockWishlistItem),
            upsert: jest.fn().mockResolvedValue(mockWishlistItem),
          },
          wishlistPriceAlert: {
            upsert: jest.fn().mockResolvedValue(createTestData.priceAlert()),
          },
        }
        return callback(tx)
      })

      // Act - Thực thi
      const result = await repository.addItem(userId, body as any)

      // Assert - Kiểm tra
      expect(result).toMatchObject({
        id: mockWishlistItem.id,
        userId: mockWishlistItem.userId,
        productId: mockWishlistItem.productId,
      })
    })

    it('should use basePrice when SKU not found', async () => {
      // Arrange - Chuẩn bị dữ liệu
      const userId = 1
      const body = {
        productId: 1,
        skuId: 999,
        priority: 0,
        notifyOnPriceDrops: true,
        notifyOnBackInStock: true,
        notifyOnPromotion: true,
      }
      const mockProduct = createTestData.product({ basePrice: 100000 })
      const mockWishlistItem = {
        ...createTestData.wishlistItem(),
        product: mockProduct,
        sku: null,
      }

      mockPrismaService.sKU.findUnique.mockResolvedValue(null)
      mockPrismaService.product.findUnique.mockResolvedValue(mockProduct)

      mockPrismaService.$transaction.mockImplementation(async (callback) => {
        const tx = {
          wishlistItem: {
            findFirst: jest.fn().mockResolvedValue(null),
            create: jest.fn().mockResolvedValue(mockWishlistItem),
            update: jest.fn().mockResolvedValue(mockWishlistItem),
            upsert: jest.fn().mockResolvedValue(mockWishlistItem),
          },
          wishlistPriceAlert: {
            upsert: jest.fn().mockResolvedValue(createTestData.priceAlert({ currentPrice: 100000 })),
          },
        }
        return callback(tx)
      })

      // Act - Thực thi
      const result = await repository.addItem(userId, body)

      // Assert - Kiểm tra
      expect(result).toBeDefined()
      expect(mockPrismaService.product.findUnique).toHaveBeenCalled()
    })

    it('should use 0 as currentPrice when both SKU and product not found', async () => {
      // Arrange - Chuẩn bị dữ liệu
      const userId = 1
      const body = {
        productId: 1,
        priority: 0,
        notifyOnPriceDrops: true,
        notifyOnBackInStock: true,
        notifyOnPromotion: true,
      }
      const mockWishlistItem = {
        ...createTestData.wishlistItem({ skuId: null }),
        product: createTestData.product(),
        sku: null,
      }

      mockPrismaService.sKU.findUnique.mockResolvedValue(null)
      mockPrismaService.product.findUnique.mockResolvedValue(null)

      mockPrismaService.$transaction.mockImplementation(async (callback) => {
        const tx = {
          wishlistItem: {
            findFirst: jest.fn().mockResolvedValue(null),
            create: jest.fn().mockResolvedValue(mockWishlistItem),
            update: jest.fn().mockResolvedValue(mockWishlistItem),
            upsert: jest.fn().mockResolvedValue(mockWishlistItem),
          },
          wishlistPriceAlert: {
            upsert: jest.fn().mockResolvedValue(createTestData.priceAlert({ currentPrice: 0 })),
          },
        }
        return callback(tx)
      })

      // Act - Thực thi
      const result = await repository.addItem(userId, body)

      // Assert - Kiểm tra
      expect(result).toBeDefined()
      expect(mockPrismaService.sKU.findUnique).not.toHaveBeenCalled()
      expect(mockPrismaService.product.findUnique).toHaveBeenCalled()
    })
  })

  describe('getItems', () => {
    it('should get wishlist items with pagination', async () => {
      // Arrange - Chuẩn bị dữ liệu
      const userId = 1
      const query = {
        page: 1,
        limit: 20,
        sortBy: 'addedAt' as const,
        orderBy: 'desc' as const,
      }
      const mockItems = [
        {
          ...createTestData.wishlistItem(),
          product: createTestData.product(),
          sku: createTestData.sku(),
          priceAlerts: [createTestData.priceAlert()],
        },
      ]

      mockPrismaService.wishlistItem.findMany.mockResolvedValue(mockItems)
      mockPrismaService.wishlistItem.count.mockResolvedValue(1)

      // Act - Thực thi
      const result = await repository.getItems(userId, query)

      // Assert - Kiểm tra
      expect(result.data).toHaveLength(1)
      expect(result.totalItems).toBe(1)
      expect(result.page).toBe(1)
      expect(result.limit).toBe(20)
      expect(result.totalPages).toBe(1)
      expect(result.data[0].priceAlert).toBeDefined()
      expect(result.data[0].priceAlert?.priceDropPercentage).toBeDefined()
      expect(mockPrismaService.wishlistItem.findMany).toHaveBeenCalled()
      expect(mockPrismaService.wishlistItem.count).toHaveBeenCalled()
    })

    it('should filter by priority', async () => {
      // Arrange - Chuẩn bị dữ liệu
      const userId = 1
      const query = {
        page: 1,
        limit: 20,
        priority: 1,
        sortBy: 'priority' as const,
        orderBy: 'desc' as const,
      }

      mockPrismaService.wishlistItem.findMany.mockResolvedValue([])
      mockPrismaService.wishlistItem.count.mockResolvedValue(0)

      // Act - Thực thi
      await repository.getItems(userId, query)

      // Assert - Kiểm tra
      expect(mockPrismaService.wishlistItem.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            userId,
            priority: 1,
          }),
        }),
      )
    })

    it('should sort by price', async () => {
      // Arrange - Chuẩn bị dữ liệu
      const userId = 1
      const query = {
        page: 1,
        limit: 20,
        sortBy: 'price' as const,
        orderBy: 'asc' as const,
      }

      mockPrismaService.wishlistItem.findMany.mockResolvedValue([])
      mockPrismaService.wishlistItem.count.mockResolvedValue(0)

      // Act - Thực thi
      await repository.getItems(userId, query)

      // Assert - Kiểm tra
      expect(mockPrismaService.wishlistItem.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { sku: { price: 'asc' } },
        }),
      )
    })

    it('should handle items without price alerts', async () => {
      // Arrange - Chuẩn bị dữ liệu
      const userId = 1
      const query = {
        page: 1,
        limit: 20,
        sortBy: 'addedAt' as const,
        orderBy: 'desc' as const,
      }
      const mockItems = [
        {
          ...createTestData.wishlistItem(),
          product: createTestData.product(),
          sku: createTestData.sku(),
          priceAlerts: [], // No price alerts
        },
      ]

      mockPrismaService.wishlistItem.findMany.mockResolvedValue(mockItems)
      mockPrismaService.wishlistItem.count.mockResolvedValue(1)

      // Act - Thực thi
      const result = await repository.getItems(userId, query)

      // Assert - Kiểm tra
      expect(result.data).toHaveLength(1)
      expect(result.data[0].priceAlert).toBeNull()
    })
  })

  describe('updateItem', () => {
    it('should update wishlist item', async () => {
      // Arrange - Chuẩn bị dữ liệu
      const userId = 1
      const itemId = 1
      const data = {
        note: 'Updated note',
        priority: 2,
        notifyOnPriceDrops: false,
      }
      const mockUpdatedItem = {
        ...createTestData.wishlistItem(data),
        product: createTestData.product(),
        sku: createTestData.sku(),
      }

      mockPrismaService.wishlistItem.update.mockResolvedValue(mockUpdatedItem)

      // Act - Thực thi
      const result = await repository.updateItem(userId, itemId, data)

      // Assert - Kiểm tra
      expect(result).toMatchObject({
        id: itemId,
        note: data.note,
        priority: data.priority,
      })
      expect(mockPrismaService.wishlistItem.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: itemId, userId },
          data: expect.objectContaining(data),
        }),
      )
    })
  })

  describe('removeItem', () => {
    it('should remove wishlist item', async () => {
      // Arrange - Chuẩn bị dữ liệu
      const userId = 1
      const itemId = 1
      const mockDeletedItem = createTestData.wishlistItem()

      mockPrismaService.wishlistItem.delete.mockResolvedValue(mockDeletedItem)

      // Act - Thực thi
      const result = await repository.removeItem(userId, itemId)

      // Assert - Kiểm tra
      expect(result).toMatchObject({ id: itemId })
      expect(mockPrismaService.wishlistItem.delete).toHaveBeenCalledWith({
        where: { id: itemId, userId },
      })
    })
  })

  describe('moveToCart', () => {
    it('should move wishlist item to cart', async () => {
      // Arrange - Chuẩn bị dữ liệu
      const userId = 1
      const itemId = 1
      const quantity = 2
      const mockWishlistItem = {
        ...createTestData.wishlistItem(),
        sku: createTestData.sku(),
      }

      mockPrismaService.$transaction.mockImplementation(async (callback) => {
        const tx = {
          wishlistItem: {
            findUnique: jest.fn().mockResolvedValue(mockWishlistItem),
            delete: jest.fn().mockResolvedValue(mockWishlistItem),
          },
          cartItem: {
            upsert: jest.fn().mockResolvedValue({}),
          },
        }
        return callback(tx)
      })

      // Act - Thực thi
      const result = await repository.moveToCart(userId, itemId, quantity)

      // Assert - Kiểm tra
      expect(result).toEqual({ success: true })
      expect(mockPrismaService.$transaction).toHaveBeenCalled()
    })

    it('should move wishlist item to cart with default quantity', async () => {
      // Arrange - Chuẩn bị dữ liệu
      const userId = 1
      const itemId = 1
      const mockWishlistItem = {
        ...createTestData.wishlistItem(),
        sku: createTestData.sku(),
      }

      mockPrismaService.$transaction.mockImplementation(async (callback) => {
        const tx = {
          wishlistItem: {
            findUnique: jest.fn().mockResolvedValue(mockWishlistItem),
            delete: jest.fn().mockResolvedValue(mockWishlistItem),
          },
          cartItem: {
            upsert: jest.fn().mockResolvedValue({}),
          },
        }
        return callback(tx)
      })

      // Act - Thực thi (không truyền quantity, sử dụng default = 1)
      const result = await repository.moveToCart(userId, itemId)

      // Assert - Kiểm tra
      expect(result).toEqual({ success: true })
      expect(mockPrismaService.$transaction).toHaveBeenCalled()
    })

    it('should throw error when wishlist item not found', async () => {
      // Arrange - Chuẩn bị dữ liệu
      const userId = 1
      const itemId = 999

      mockPrismaService.$transaction.mockImplementation(async (callback) => {
        const tx = {
          wishlistItem: {
            findUnique: jest.fn().mockResolvedValue(null),
          },
        }
        return callback(tx)
      })

      // Act & Assert - Thực thi và kiểm tra
      await expect(repository.moveToCart(userId, itemId, 1)).rejects.toThrow('Wishlist item not found')
    })

    it('should throw error when no SKU selected', async () => {
      // Arrange - Chuẩn bị dữ liệu
      const userId = 1
      const itemId = 1
      const mockWishlistItem = {
        ...createTestData.wishlistItem({ skuId: null }),
        sku: null,
      }

      mockPrismaService.$transaction.mockImplementation(async (callback) => {
        const tx = {
          wishlistItem: {
            findUnique: jest.fn().mockResolvedValue(mockWishlistItem),
          },
        }
        return callback(tx)
      })

      // Act & Assert - Thực thi và kiểm tra
      await expect(repository.moveToCart(userId, itemId, 1)).rejects.toThrow('Cannot add to cart: No SKU selected')
    })
  })

  describe('getCount', () => {
    it('should get wishlist count', async () => {
      // Arrange - Chuẩn bị dữ liệu
      const userId = 1
      const mockCount = 5

      mockPrismaService.wishlistItem.count.mockResolvedValue(mockCount)

      // Act - Thực thi
      const result = await repository.getCount(userId)

      // Assert - Kiểm tra
      expect(result).toBe(mockCount)
      expect(mockPrismaService.wishlistItem.count).toHaveBeenCalledWith({
        where: { userId },
      })
    })
  })

  describe('isWishlisted', () => {
    it('should return true when item is wishlisted', async () => {
      // Arrange - Chuẩn bị dữ liệu
      const userId = 1
      const productId = 1
      const skuId = 1
      const mockItem = { id: 1 }

      mockPrismaService.wishlistItem.findFirst.mockResolvedValue(mockItem)

      // Act - Thực thi
      const result = await repository.isWishlisted(userId, productId, skuId)

      // Assert - Kiểm tra
      expect(result.isWishlisted).toBe(true)
      expect(result.wishlistItemId).toBe(1)
      expect(mockPrismaService.wishlistItem.findFirst).toHaveBeenCalled()
    })

    it('should return false when item is not wishlisted', async () => {
      // Arrange - Chuẩn bị dữ liệu
      const userId = 1
      const productId = 1

      mockPrismaService.wishlistItem.findFirst.mockResolvedValue(null)

      // Act - Thực thi
      const result = await repository.isWishlisted(userId, productId)

      // Assert - Kiểm tra
      expect(result.isWishlisted).toBe(false)
      expect(result.wishlistItemId).toBeNull()
    })
  })

  describe('createCollection', () => {
    it('should create public collection with share code', async () => {
      // Arrange - Chuẩn bị dữ liệu
      const userId = 1
      const data = {
        name: 'My Collection',
        description: 'Test collection',
        isPublic: true,
      }
      const mockCollection = createTestData.collection({
        ...data,
        shareCode: 'ABC123XYZ0',
      })

      mockPrismaService.wishlistCollection.create.mockResolvedValue(mockCollection)

      // Act - Thực thi
      const result = await repository.createCollection(userId, data)

      // Assert - Kiểm tra
      expect(result.name).toBe(data.name)
      expect(result.isPublic).toBe(true)
      expect(result.shareCode).toBeTruthy()
      expect(result.shareCode).toHaveLength(10)
      expect(mockPrismaService.wishlistCollection.create).toHaveBeenCalled()
    })

    it('should create private collection without share code', async () => {
      // Arrange - Chuẩn bị dữ liệu
      const userId = 1
      const data = {
        name: 'Private Collection',
        isPublic: false,
      }
      const mockCollection = createTestData.collection(data)

      mockPrismaService.wishlistCollection.create.mockResolvedValue(mockCollection)

      // Act - Thực thi
      const result = await repository.createCollection(userId, data)

      // Assert - Kiểm tra
      expect(result.name).toBe(data.name)
      expect(result.isPublic).toBe(false)
      expect(result.shareCode).toBeNull()
    })

    it('should create collection with default isPublic false when not specified', async () => {
      // Arrange - Chuẩn bị dữ liệu
      const userId = 1
      const data = {
        name: 'Default Collection',
      }
      const mockCollection = createTestData.collection({
        ...data,
        isPublic: false,
        shareCode: null,
      })

      mockPrismaService.wishlistCollection.create.mockResolvedValue(mockCollection)

      // Act - Thực thi
      const result = await repository.createCollection(userId, data as any)

      // Assert - Kiểm tra
      expect(result.name).toBe(data.name)
      expect(result.isPublic).toBe(false)
      expect(result.shareCode).toBeNull()
    })
  })

  describe('getCollections', () => {
    it('should get all collections for user', async () => {
      // Arrange - Chuẩn bị dữ liệu
      const userId = 1
      const mockCollections = [
        {
          ...createTestData.collection(),
          _count: { items: 5 },
        },
        {
          ...createTestData.collection({ id: 2, name: 'Collection 2' }),
          _count: { items: 3 },
        },
      ]

      mockPrismaService.wishlistCollection.findMany.mockResolvedValue(mockCollections)

      // Act - Thực thi
      const result = await repository.getCollections(userId)

      // Assert - Kiểm tra
      expect(result.data).toHaveLength(2)
      expect(result.totalItems).toBe(2)
      expect(result.data[0].itemCount).toBe(5)
      expect(result.data[1].itemCount).toBe(3)
      expect(mockPrismaService.wishlistCollection.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId },
        }),
      )
    })
  })

  describe('updateCollection', () => {
    it('should update collection and generate share code when changing to public', async () => {
      // Arrange - Chuẩn bị dữ liệu
      const userId = 1
      const collectionId = 1
      const data = {
        name: 'Updated Collection',
        isPublic: true,
      }
      const mockExisting = { shareCode: null }
      const mockUpdated = createTestData.collection({
        ...data,
        shareCode: 'NEWCODE123',
      })

      mockPrismaService.wishlistCollection.findUnique.mockResolvedValue(mockExisting)
      mockPrismaService.wishlistCollection.update.mockResolvedValue(mockUpdated)

      // Act - Thực thi
      const result = await repository.updateCollection(userId, collectionId, data)

      // Assert - Kiểm tra
      expect(result.name).toBe(data.name)
      expect(result.isPublic).toBe(true)
      expect(result.shareCode).toBeTruthy()
      expect(mockPrismaService.wishlistCollection.update).toHaveBeenCalled()
    })

    it('should update collection without generating new share code if already exists', async () => {
      // Arrange - Chuẩn bị dữ liệu
      const userId = 1
      const collectionId = 1
      const data = {
        description: 'Updated description',
        isPublic: true,
      }
      const mockExisting = { shareCode: 'EXISTING123' }
      const mockUpdated = createTestData.collection({
        ...data,
        shareCode: 'EXISTING123',
      })

      mockPrismaService.wishlistCollection.findUnique.mockResolvedValue(mockExisting)
      mockPrismaService.wishlistCollection.update.mockResolvedValue(mockUpdated)

      // Act - Thực thi
      const result = await repository.updateCollection(userId, collectionId, data)

      // Assert - Kiểm tra
      expect(result.shareCode).toBe('EXISTING123')
    })
  })

  describe('deleteCollection', () => {
    it('should delete collection', async () => {
      // Arrange - Chuẩn bị dữ liệu
      const userId = 1
      const collectionId = 1
      const mockDeleted = createTestData.collection()

      mockPrismaService.wishlistCollection.delete.mockResolvedValue(mockDeleted)

      // Act - Thực thi
      const result = await repository.deleteCollection(userId, collectionId)

      // Assert - Kiểm tra
      expect(result).toMatchObject({ id: collectionId })
      expect(mockPrismaService.wishlistCollection.delete).toHaveBeenCalledWith({
        where: { id: collectionId, userId },
      })
    })
  })

  describe('addItemToCollection', () => {
    it('should add item to collection', async () => {
      // Arrange - Chuẩn bị dữ liệu
      const userId = 1
      const collectionId = 1
      const wishlistItemId = 1
      const mockCollection = createTestData.collection()
      const mockWishlistItem = createTestData.wishlistItem()
      const mockCollectionItem = {
        id: 1,
        collectionId,
        wishlistItemId,
      }

      mockPrismaService.wishlistCollection.findUnique.mockResolvedValue(mockCollection)
      mockPrismaService.wishlistItem.findUnique.mockResolvedValue(mockWishlistItem)
      mockPrismaService.wishlistCollectionItem.create.mockResolvedValue(mockCollectionItem)

      // Act - Thực thi
      const result = await repository.addItemToCollection(userId, collectionId, wishlistItemId)

      // Assert - Kiểm tra
      expect(result.collectionId).toBe(collectionId)
      expect(result.wishlistItemId).toBe(wishlistItemId)
      expect(mockPrismaService.wishlistCollectionItem.create).toHaveBeenCalled()
    })

    it('should throw error when collection not found', async () => {
      // Arrange - Chuẩn bị dữ liệu
      const userId = 1
      const collectionId = 999
      const wishlistItemId = 1

      mockPrismaService.wishlistCollection.findUnique.mockResolvedValue(null)
      mockPrismaService.wishlistItem.findUnique.mockResolvedValue(createTestData.wishlistItem())

      // Act & Assert - Thực thi và kiểm tra
      await expect(repository.addItemToCollection(userId, collectionId, wishlistItemId)).rejects.toThrow(
        'Collection or wishlist item not found',
      )
    })

    it('should throw error when wishlist item not found', async () => {
      // Arrange - Chuẩn bị dữ liệu
      const userId = 1
      const collectionId = 1
      const wishlistItemId = 999

      mockPrismaService.wishlistCollection.findUnique.mockResolvedValue(createTestData.collection())
      mockPrismaService.wishlistItem.findUnique.mockResolvedValue(null)

      // Act & Assert - Thực thi và kiểm tra
      await expect(repository.addItemToCollection(userId, collectionId, wishlistItemId)).rejects.toThrow(
        'Collection or wishlist item not found',
      )
    })
  })

  describe('removeItemFromCollection', () => {
    it('should remove item from collection', async () => {
      // Arrange - Chuẩn bị dữ liệu
      const collectionId = 1
      const wishlistItemId = 1
      const mockDeleted = {
        id: 1,
        collectionId,
        wishlistItemId,
      }

      mockPrismaService.wishlistCollectionItem.delete.mockResolvedValue(mockDeleted)

      // Act - Thực thi
      const result = await repository.removeItemFromCollection(collectionId, wishlistItemId)

      // Assert - Kiểm tra
      expect(result.collectionId).toBe(collectionId)
      expect(result.wishlistItemId).toBe(wishlistItemId)
      expect(mockPrismaService.wishlistCollectionItem.delete).toHaveBeenCalledWith({
        where: {
          collectionId_wishlistItemId: {
            collectionId,
            wishlistItemId,
          },
        },
      })
    })
  })

  describe('getCollectionByShareCode', () => {
    it('should get collection by share code', async () => {
      // Arrange - Chuẩn bị dữ liệu
      const shareCode = 'ABC123XYZ0'
      const mockCollection = {
        ...createTestData.collection({ shareCode, isPublic: true }),
        items: [
          {
            id: 1,
            wishlistItem: {
              ...createTestData.wishlistItem(),
              product: createTestData.product(),
              sku: createTestData.sku(),
            },
          },
        ],
      }

      mockPrismaService.wishlistCollection.findUnique.mockResolvedValue(mockCollection)

      // Act - Thực thi
      const result = await repository.getCollectionByShareCode(shareCode)

      // Assert - Kiểm tra
      expect(result?.shareCode).toBe(shareCode)
      expect(result?.isPublic).toBe(true)
      expect(result?.items).toHaveLength(1)
      expect(mockPrismaService.wishlistCollection.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { shareCode, isPublic: true },
        }),
      )
    })
  })

  describe('setTargetPrice', () => {
    it('should set target price for wishlist item', async () => {
      // Arrange - Chuẩn bị dữ liệu
      const userId = 1
      const itemId = 1
      const targetPrice = 80000
      const mockWishlistItem = createTestData.wishlistItem()
      const mockPriceAlert = createTestData.priceAlert({ wishlistItemId: itemId })
      const mockUpdatedPriceAlert = { ...mockPriceAlert, targetPrice }

      mockPrismaService.wishlistItem.findUnique.mockResolvedValue(mockWishlistItem)
      mockPrismaService.wishlistPriceAlert.findUnique.mockResolvedValue(mockPriceAlert)
      mockPrismaService.wishlistPriceAlert.update.mockResolvedValue(mockUpdatedPriceAlert)

      // Act - Thực thi
      const result = await repository.setTargetPrice(userId, itemId, targetPrice)

      // Assert - Kiểm tra
      expect(result.targetPrice).toBe(targetPrice)
      expect(mockPrismaService.wishlistPriceAlert.findUnique).toHaveBeenCalledWith({
        where: { wishlistItemId: itemId },
      })
      expect(mockPrismaService.wishlistPriceAlert.update).toHaveBeenCalledWith({
        where: { wishlistItemId: itemId },
        data: { targetPrice },
      })
    })

    it('should throw error when wishlist item not found', async () => {
      // Arrange - Chuẩn bị dữ liệu
      const userId = 1
      const itemId = 999
      const targetPrice = 80000

      mockPrismaService.wishlistItem.findUnique.mockResolvedValue(null)

      // Act & Assert - Thực thi và kiểm tra
      await expect(repository.setTargetPrice(userId, itemId, targetPrice)).rejects.toThrow('Wishlist item not found')
    })
  })

  describe('getItemsForPriceCheck', () => {
    it('should get items that need price check', async () => {
      // Arrange - Chuẩn bị dữ liệu
      const mockItems = [
        {
          ...createTestData.wishlistItem(),
          sku: createTestData.sku(),
          product: createTestData.product(),
          priceAlerts: [createTestData.priceAlert()],
          user: {
            id: 1,
            email: 'user@example.com',
            name: 'Test User',
          },
        },
      ]

      mockPrismaService.wishlistItem.findMany.mockResolvedValue(mockItems)

      // Act - Thực thi
      const result = await repository.getItemsForPriceCheck()

      // Assert - Kiểm tra
      expect(result).toHaveLength(1)
      expect(result[0].notifyOnPriceDrops).toBe(true)
      expect(mockPrismaService.wishlistItem.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { notifyOnPriceDrops: true },
        }),
      )
    })
  })

  describe('updatePriceAlert', () => {
    it('should update price alert without sending alert', async () => {
      // Arrange - Chuẩn bị dữ liệu
      const wishlistItemId = 1
      const currentPrice = 85000
      const mockUpdated = { count: 1 }

      mockPrismaService.wishlistPriceAlert.updateMany.mockResolvedValue(mockUpdated)

      // Act - Thực thi
      const result = await repository.updatePriceAlert(wishlistItemId, currentPrice, false)

      // Assert - Kiểm tra
      expect(result.count).toBe(1)
      expect(mockPrismaService.wishlistPriceAlert.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { wishlistItemId },
          data: expect.objectContaining({
            currentPrice,
            lastCheckedAt: expect.any(Date),
          }),
        }),
      )
    })

    it('should update price alert and mark alert as sent', async () => {
      // Arrange - Chuẩn bị dữ liệu
      const wishlistItemId = 1
      const currentPrice = 75000
      const mockUpdated = { count: 1 }

      mockPrismaService.wishlistPriceAlert.updateMany.mockResolvedValue(mockUpdated)

      // Act - Thực thi
      const result = await repository.updatePriceAlert(wishlistItemId, currentPrice, true)

      // Assert - Kiểm tra
      expect(result.count).toBe(1)
      expect(mockPrismaService.wishlistPriceAlert.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { wishlistItemId },
          data: expect.objectContaining({
            currentPrice,
            lastCheckedAt: expect.any(Date),
            alertSentAt: expect.any(Date),
          }),
        }),
      )
    })

    it('should update price alert with default alertSent false when not specified', async () => {
      // Arrange - Chuẩn bị dữ liệu
      const wishlistItemId = 1
      const currentPrice = 90000
      const mockUpdated = { count: 1 }

      mockPrismaService.wishlistPriceAlert.updateMany.mockResolvedValue(mockUpdated)

      // Act - Thực thi (không truyền alertSent, sử dụng default = false)
      const result = await repository.updatePriceAlert(wishlistItemId, currentPrice)

      // Assert - Kiểm tra
      expect(result.count).toBe(1)
      expect(mockPrismaService.wishlistPriceAlert.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { wishlistItemId },
          data: expect.objectContaining({
            currentPrice,
            lastCheckedAt: expect.any(Date),
          }),
        }),
      )
    })
  })
})
