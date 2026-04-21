import { CACHE_MANAGER } from '@nestjs/cache-manager'
import { INestApplication } from '@nestjs/common'
import { Test, TestingModule } from '@nestjs/testing'
import request from 'supertest'
import { AppModule } from '../../src/app.module'
import { EmailService } from '../../src/shared/services/email.service'
import { PrismaService } from '../../src/shared/services/prisma.service'
import { resetDatabase } from '../helpers/test-helpers'

/**
 * WISHLIST INTEGRATION TESTS
 *
 * Test Coverage:
 * - Add/Remove wishlist items
 * - Update wishlist items
 * - Get wishlist items with pagination
 * - Move item to cart
 * - Set target price (price alerts)
 * - Collection management (create, update, delete, add/remove items)
 * - Check if product is wishlisted
 * - Get wishlist count
 */
describe('Wishlist Integration Tests', () => {
  let app: INestApplication
  let prisma: PrismaService
  let accessToken: string
  let testUserId: number
  let testProductId: number
  let testSKUId: number
  let testBrandId: number
  let testCategoryId: number

  // Mock EmailService
  const mockEmailService = {
    sendEmail: jest.fn().mockResolvedValue(undefined),
    sendOTP: jest.fn().mockResolvedValue(undefined),
  }

  // Mock Cache Manager
  const mockCacheManager = {
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue(undefined),
    del: jest.fn().mockResolvedValue(undefined),
  }

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue(global.__GLOBAL_PRISMA__)
      .overrideProvider(EmailService)
      .useValue(mockEmailService)
      .overrideProvider(CACHE_MANAGER)
      .useValue(mockCacheManager)
      .compile()

    app = moduleFixture.createNestApplication()
    prisma = moduleFixture.get<PrismaService>(PrismaService)

    await app.init()
  })

  beforeEach(async () => {
    await resetDatabase()

    // Create test user and login
    const testUser = {
      email: 'wishlist-test@example.com',
      name: 'Wishlist Test User',
      phoneNumber: '0123456789',
      password: 'password123',
      confirmPassword: 'password123',
    }

    // Send OTP
    await request(app.getHttpServer()).post('/auth/otp').send({
      email: testUser.email,
      type: 'REGISTER',
    })

    // Get OTP code
    const verificationCode = await prisma.verificationCode.findFirst({
      where: {
        email: testUser.email,
        type: 'REGISTER',
      },
    })

    // Register user
    const registerResponse = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        ...testUser,
        code: verificationCode?.code,
      })

    testUserId = registerResponse.body.id

    // Login to get access token
    const loginResponse = await request(app.getHttpServer())
      .post('/auth/login')
      .send({
        email: testUser.email,
        password: testUser.password,
      })
      .set('User-Agent', 'wishlist-test-agent')

    accessToken = loginResponse.body.accessToken

    // Create test brand
    testBrandId = (
      await prisma.brand.create({
        data: {
          name: 'Test Brand',
          logo: 'https://example.com/logo.png',
        },
      })
    ).id

    // Create test category
    testCategoryId = (
      await prisma.category.create({
        data: {
          name: 'Test Category',
        },
      })
    ).id

    // Create test product
    testProductId = (
      await prisma.product.create({
        data: {
          name: 'Test Product',
          basePrice: 100000,
          virtualPrice: 90000,
          images: ['https://example.com/product.jpg'],
          brandId: testBrandId,
          variants: [],
          createdById: testUserId,
          publishedAt: new Date(),
          categories: {
            connect: [{ id: testCategoryId }],
          },
        },
      })
    ).id

    // Create test SKU
    testSKUId = (
      await prisma.sKU.create({
        data: {
          productId: testProductId,
          value: 'Red-L',
          price: 90000,
          stock: 100,
          image: 'https://example.com/sku.jpg',
          createdById: testUserId,
        },
      })
    ).id
  })

  afterAll(async () => {
    await app.close()
  })

  // ============================================
  // WISHLIST ITEM TESTS
  // ============================================

  describe('POST /wishlist/items - Add Item to Wishlist', () => {
    it('should add item to wishlist successfully', async () => {
      const response = await request(app.getHttpServer())
        .post('/wishlist/items')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          productId: testProductId,
          skuId: testSKUId,
          priority: 1,
          notifyOnPriceDrops: true,
          notifyOnBackInStock: true,
          notifyOnPromotion: true,
          note: 'Want to buy this',
        })
        .expect(201)

      expect(response.body).toHaveProperty('id')
      expect(response.body.productId).toBe(testProductId)
      expect(response.body.skuId).toBe(testSKUId)
      expect(response.body.priority).toBe(1)
      expect(response.body.note).toBe('Want to buy this')
    })

    it('should add item without SKU (use base product)', async () => {
      const response = await request(app.getHttpServer())
        .post('/wishlist/items')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          productId: testProductId,
          // Don't send skuId at all (optional field)
          priority: 0,
          notifyOnPriceDrops: true,
        })
        .expect(201)

      expect(response.body).toHaveProperty('id')
      expect(response.body.productId).toBe(testProductId)
      expect(response.body.skuId).toBeNull()
    })

    it('should return 401 when not authenticated', async () => {
      await request(app.getHttpServer())
        .post('/wishlist/items')
        .send({
          productId: testProductId,
          priority: 0,
        })
        .expect(401)
    })

    it('should validate required fields', async () => {
      const response = await request(app.getHttpServer())
        .post('/wishlist/items')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          // Missing productId
          priority: 0,
        })
        .expect(422)

      expect(response.body.statusCode).toBe(422)
    })
  })

  describe('GET /wishlist/items - Get Wishlist Items', () => {
    beforeEach(async () => {
      // Add some items to wishlist
      await prisma.wishlistItem.createMany({
        data: [
          {
            userId: testUserId,
            productId: testProductId,
            skuId: testSKUId,
            priority: 1,
            notifyOnPriceDrops: true,
          },
        ],
      })
    })

    it('should get wishlist items successfully', async () => {
      const response = await request(app.getHttpServer())
        .get('/wishlist/items')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200)

      expect(response.body).toHaveProperty('data')
      expect(Array.isArray(response.body.data)).toBe(true)
      expect(response.body.data.length).toBeGreaterThan(0)
    })

    it('should support pagination', async () => {
      const response = await request(app.getHttpServer())
        .get('/wishlist/items?page=1&limit=10')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200)

      expect(response.body).toHaveProperty('data')
      expect(response.body).toHaveProperty('page')
      expect(response.body).toHaveProperty('limit')
      expect(response.body).toHaveProperty('totalItems')
      expect(response.body).toHaveProperty('totalPages')
    })

    it('should return 401 when not authenticated', async () => {
      await request(app.getHttpServer()).get('/wishlist/items').expect(401)
    })
  })

  describe('PUT /wishlist/items/:itemId - Update Wishlist Item', () => {
    let wishlistItemId: number

    beforeEach(async () => {
      const item = await prisma.wishlistItem.create({
        data: {
          userId: testUserId,
          productId: testProductId,
          skuId: testSKUId,
          priority: 0,
          notifyOnPriceDrops: false,
        },
      })
      wishlistItemId = item.id
    })

    it('should update wishlist item successfully', async () => {
      const response = await request(app.getHttpServer())
        .put(`/wishlist/items/${wishlistItemId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          priority: 2,
          note: 'Updated note',
          notifyOnPriceDrops: true,
        })
        .expect(200)

      expect(response.body.priority).toBe(2)
      expect(response.body.note).toBe('Updated note')
      expect(response.body.notifyOnPriceDrops).toBe(true)
    })

    it('should return 404 for non-existent item', async () => {
      await request(app.getHttpServer())
        .put('/wishlist/items/99999')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          priority: 1,
        })
        .expect(404)
    })
  })

  describe('DELETE /wishlist/items/:itemId - Remove Wishlist Item', () => {
    let wishlistItemId: number

    beforeEach(async () => {
      const item = await prisma.wishlistItem.create({
        data: {
          userId: testUserId,
          productId: testProductId,
          skuId: testSKUId,
          priority: 0,
        },
      })
      wishlistItemId = item.id
    })

    it('should remove wishlist item successfully', async () => {
      const response = await request(app.getHttpServer())
        .delete(`/wishlist/items/${wishlistItemId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200)

      expect(response.body).toHaveProperty('message')

      // Verify item is deleted
      const deletedItem = await prisma.wishlistItem.findUnique({
        where: { id: wishlistItemId },
      })
      expect(deletedItem).toBeNull()
    })

    it('should return 404 for non-existent item', async () => {
      await request(app.getHttpServer())
        .delete('/wishlist/items/99999')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(404)
    })
  })

  // ============================================
  // MOVE TO CART TESTS
  // ============================================

  describe('POST /wishlist/items/:itemId/move-to-cart - Move Item to Cart', () => {
    let wishlistItemId: number

    beforeEach(async () => {
      const item = await prisma.wishlistItem.create({
        data: {
          userId: testUserId,
          productId: testProductId,
          skuId: testSKUId,
          priority: 0,
        },
      })
      wishlistItemId = item.id
    })

    it('should move wishlist item to cart successfully', async () => {
      const response = await request(app.getHttpServer())
        .post(`/wishlist/items/${wishlistItemId}/move-to-cart`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          quantity: 2,
        })
        .expect(201)

      expect(response.body).toHaveProperty('message')

      // Verify item is removed from wishlist
      const wishlistItem = await prisma.wishlistItem.findUnique({
        where: { id: wishlistItemId },
      })
      expect(wishlistItem).toBeNull()

      // Verify item is added to cart
      const cartItem = await prisma.cartItem.findFirst({
        where: {
          userId: testUserId,
          skuId: testSKUId,
        },
      })
      expect(cartItem).toBeDefined()
      expect(cartItem?.quantity).toBe(2)
    })

    it('should return 404 for non-existent wishlist item', async () => {
      await request(app.getHttpServer())
        .post('/wishlist/items/99999/move-to-cart')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          quantity: 1,
        })
        .expect(404)
    })
  })

  // ============================================
  // PRICE ALERT TESTS
  // ============================================

  describe('POST /wishlist/items/:itemId/set-target-price - Set Target Price', () => {
    let wishlistItemId: number

    beforeEach(async () => {
      const item = await prisma.wishlistItem.create({
        data: {
          userId: testUserId,
          productId: testProductId,
          skuId: testSKUId,
          priority: 0,
          notifyOnPriceDrops: true,
        },
      })
      wishlistItemId = item.id

      // Create price alert for the wishlist item
      await prisma.wishlistPriceAlert.create({
        data: {
          wishlistItemId: item.id,
          originalPrice: 100000,
          currentPrice: 100000,
          lastCheckedAt: new Date(),
        },
      })
    })

    it('should set target price successfully', async () => {
      const response = await request(app.getHttpServer())
        .post(`/wishlist/items/${wishlistItemId}/set-target-price`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          targetPrice: 80000,
        })
        .expect(201)

      expect(response.body).toHaveProperty('message')

      // Verify price alert is updated with target price
      const priceAlert = await prisma.wishlistPriceAlert.findFirst({
        where: {
          wishlistItemId,
        },
      })
      expect(priceAlert).toBeDefined()
      expect(priceAlert?.targetPrice).toBe(80000)
    })

    it('should return 404 for non-existent wishlist item', async () => {
      await request(app.getHttpServer())
        .post('/wishlist/items/99999/set-target-price')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          targetPrice: 80000,
        })
        .expect(404)
    })
  })

  // ============================================
  // WISHLIST COUNT & CHECK TESTS
  // ============================================

  describe('GET /wishlist/count - Get Wishlist Count', () => {
    beforeEach(async () => {
      await prisma.wishlistItem.createMany({
        data: [
          {
            userId: testUserId,
            productId: testProductId,
            skuId: testSKUId,
            priority: 0,
          },
        ],
      })
    })

    it('should get wishlist count successfully', async () => {
      const response = await request(app.getHttpServer())
        .get('/wishlist/count')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200)

      expect(response.body).toHaveProperty('count')
      expect(response.body.count).toBeGreaterThan(0)
    })
  })

  describe('GET /wishlist/check - Check if Product is Wishlisted', () => {
    beforeEach(async () => {
      await prisma.wishlistItem.create({
        data: {
          userId: testUserId,
          productId: testProductId,
          skuId: testSKUId,
          priority: 0,
        },
      })
    })

    it('should return true if product is wishlisted', async () => {
      const response = await request(app.getHttpServer())
        .get(`/wishlist/check?productId=${testProductId}&skuId=${testSKUId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200)

      expect(response.body.isWishlisted).toBe(true)
      expect(response.body).toHaveProperty('wishlistItemId')
    })

    it('should return false if product is not wishlisted', async () => {
      const response = await request(app.getHttpServer())
        .get('/wishlist/check?productId=99999')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200)

      expect(response.body.isWishlisted).toBe(false)
      expect(response.body.wishlistItemId).toBeNull()
    })
  })

  // ============================================
  // COLLECTION MANAGEMENT TESTS
  // ============================================

  describe('POST /wishlist/collections - Create Collection', () => {
    it('should create collection successfully', async () => {
      const response = await request(app.getHttpServer())
        .post('/wishlist/collections')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          name: 'My Favorites',
          description: 'Products I love',
          isPublic: false,
        })
        .expect(201)

      expect(response.body).toHaveProperty('id')
      expect(response.body.name).toBe('My Favorites')
      expect(response.body.description).toBe('Products I love')
      expect(response.body.isPublic).toBe(false)
    })

    it('should validate required fields', async () => {
      const response = await request(app.getHttpServer())
        .post('/wishlist/collections')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          // Missing name
          description: 'Test',
        })
        .expect(422)

      expect(response.body.statusCode).toBe(422)
    })
  })

  describe('GET /wishlist/collections - Get Collections', () => {
    beforeEach(async () => {
      await prisma.wishlistCollection.create({
        data: {
          userId: testUserId,
          name: 'Test Collection',
          description: 'Test description',
          isPublic: false,
        },
      })
    })

    it('should get all collections successfully', async () => {
      const response = await request(app.getHttpServer())
        .get('/wishlist/collections')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200)

      expect(response.body).toHaveProperty('data')
      expect(Array.isArray(response.body.data)).toBe(true)
      expect(response.body.data.length).toBeGreaterThan(0)
    })
  })

  describe('PUT /wishlist/collections/:collectionId - Update Collection', () => {
    let collectionId: number

    beforeEach(async () => {
      const collection = await prisma.wishlistCollection.create({
        data: {
          userId: testUserId,
          name: 'Old Name',
          description: 'Old description',
          isPublic: false,
        },
      })
      collectionId = collection.id
    })

    it('should update collection successfully', async () => {
      const response = await request(app.getHttpServer())
        .put(`/wishlist/collections/${collectionId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          name: 'New Name',
          description: 'New description',
          isPublic: true,
        })
        .expect(200)

      expect(response.body.name).toBe('New Name')
      expect(response.body.description).toBe('New description')
      expect(response.body.isPublic).toBe(true)
    })

    it('should return 404 for non-existent collection', async () => {
      await request(app.getHttpServer())
        .put('/wishlist/collections/99999')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          name: 'New Name',
        })
        .expect(404)
    })
  })

  describe('DELETE /wishlist/collections/:collectionId - Delete Collection', () => {
    let collectionId: number

    beforeEach(async () => {
      const collection = await prisma.wishlistCollection.create({
        data: {
          userId: testUserId,
          name: 'Test Collection',
          description: 'Test description',
          isPublic: false,
        },
      })
      collectionId = collection.id
    })

    it('should delete collection successfully', async () => {
      const response = await request(app.getHttpServer())
        .delete(`/wishlist/collections/${collectionId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200)

      expect(response.body).toHaveProperty('message')

      // Verify collection is deleted
      const deletedCollection = await prisma.wishlistCollection.findUnique({
        where: { id: collectionId },
      })
      expect(deletedCollection).toBeNull()
    })

    it('should return 404 for non-existent collection', async () => {
      await request(app.getHttpServer())
        .delete('/wishlist/collections/99999')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(404)
    })
  })

  describe('POST /wishlist/collections/:collectionId/items - Add Item to Collection', () => {
    let collectionId: number
    let wishlistItemId: number

    beforeEach(async () => {
      const collection = await prisma.wishlistCollection.create({
        data: {
          userId: testUserId,
          name: 'Test Collection',
          description: 'Test description',
          isPublic: false,
        },
      })
      collectionId = collection.id

      const item = await prisma.wishlistItem.create({
        data: {
          userId: testUserId,
          productId: testProductId,
          skuId: testSKUId,
          priority: 0,
        },
      })
      wishlistItemId = item.id
    })

    it('should add item to collection successfully', async () => {
      const response = await request(app.getHttpServer())
        .post(`/wishlist/collections/${collectionId}/items`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          wishlistItemId,
        })
        .expect(201)

      expect(response.body).toHaveProperty('message')

      // Verify item is added to collection
      const collectionItem = await prisma.wishlistCollectionItem.findFirst({
        where: {
          collectionId,
          wishlistItemId,
        },
      })
      expect(collectionItem).toBeDefined()
    })

    it('should return 404 for non-existent collection', async () => {
      await request(app.getHttpServer())
        .post('/wishlist/collections/99999/items')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          wishlistItemId,
        })
        .expect(404)
    })
  })
})
