import { CACHE_MANAGER } from '@nestjs/cache-manager'
import { INestApplication } from '@nestjs/common'
import { Test, TestingModule } from '@nestjs/testing'
import request from 'supertest'
import { AppModule } from '../../src/app.module'
import { OrderStatus } from '../../src/shared/constants/order.constant'
import { PrismaService } from '../../src/shared/services/prisma.service'
import { resetDatabase } from '../helpers/test-helpers'

describe('Review Integration Tests', () => {
  let app: INestApplication
  let prisma: PrismaService
  let buyerAccessToken: string
  let buyerUserId: number
  let buyer2AccessToken: string
  let buyer2UserId: number
  let sellerUserId: number
  let testProductId: number
  let testSKUId: number

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
      .overrideProvider(CACHE_MANAGER)
      .useValue(mockCacheManager)
      .compile()

    app = moduleFixture.createNestApplication()
    prisma = moduleFixture.get<PrismaService>(PrismaService)
    await app.init()
  })

  beforeEach(async () => {
    await resetDatabase()
    await setupTestUsers()
    await setupTestData()
  })

  afterAll(async () => {
    await app.close()
  })

  // ===== HELPER FUNCTIONS =====

  async function setupTestUsers() {
    // Create buyer user 1 (CLIENT role)
    const buyerUser = {
      email: 'buyer@test.com',
      name: 'Buyer User',
      phoneNumber: '0123456789',
      password: 'password123',
      confirmPassword: 'password123',
    }

    await createUserAndLogin(buyerUser, 'buyer-agent')
    const buyerLogin = await loginUser(buyerUser.email, buyerUser.password, 'buyer-agent')
    buyerAccessToken = buyerLogin.accessToken
    buyerUserId = buyerLogin.userId

    // Create buyer user 2 (for ownership tests)
    const buyer2User = {
      email: 'buyer2@test.com',
      name: 'Buyer User 2',
      phoneNumber: '0987654321',
      password: 'password123',
      confirmPassword: 'password123',
    }

    await createUserAndLogin(buyer2User, 'buyer2-agent')
    const buyer2Login = await loginUser(buyer2User.email, buyer2User.password, 'buyer2-agent')
    buyer2AccessToken = buyer2Login.accessToken
    buyer2UserId = buyer2Login.userId
  }

  async function createUserAndLogin(userData: any, userAgent: string) {
    // Send OTP
    await request(app.getHttpServer()).post('/auth/otp').send({
      email: userData.email,
      type: 'REGISTER',
    })

    // Get OTP code
    const verificationCode = await prisma.verificationCode.findFirst({
      where: { email: userData.email, type: 'REGISTER' },
    })

    // Register user
    await request(app.getHttpServer())
      .post('/auth/register')
      .send({ ...userData, code: verificationCode?.code })
  }

  async function loginUser(email: string, password: string, userAgent: string) {
    const response = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email, password })
      .set('User-Agent', userAgent)

    const user = await prisma.user.findFirst({ where: { email } })
    return {
      accessToken: response.body.accessToken,
      userId: user!.id,
    }
  }

  async function setupTestData() {
    // Create seller user
    const seller = await prisma.user.create({
      data: {
        email: 'seller@test.com',
        name: 'Test Seller',
        phoneNumber: '0111222333',
        password: '$2b$10$hashedPasswordExample',
        roleId: 3, // SELLER role
        status: 'ACTIVE',
      },
    })
    sellerUserId = seller.id

    // Create category
    const category = await prisma.category.create({
      data: {
        name: 'Test Category',
        logo: 'test-logo.png',
        createdById: seller.id,
      },
    })

    // Create brand
    const brand = await prisma.brand.create({
      data: {
        name: 'Test Brand',
        logo: 'test-brand.png',
        createdById: seller.id,
      },
    })

    // Create product (MUST be created by seller)
    const product = await prisma.product.create({
      data: {
        name: 'Test Product',
        brandId: brand.id,
        images: ['test-product.png'],
        basePrice: 200000,
        virtualPrice: 200000,
        variants: [],
        publishedAt: new Date('2024-01-01'), // Fixed date
        createdById: seller.id,
        categories: { connect: { id: category.id } },
      },
    })
    testProductId = product.id

    // Create SKU (MUST be created by seller)
    const sku = await prisma.sKU.create({
      data: {
        productId: product.id,
        value: 'Size: M, Color: Blue',
        price: 200000,
        stock: 100,
        image: 'test-sku.png',
        createdById: seller.id,
      },
    })
    testSKUId = sku.id
  }

  async function createDeliveredOrder(accessToken: string): Promise<number> {
    // Create cart item
    const cartItem = await request(app.getHttpServer())
      .post('/cart')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ skuId: testSKUId, quantity: 2 })
      .expect(201)

    // Create order
    const orderResponse = await request(app.getHttpServer())
      .post('/orders')
      .set('Authorization', `Bearer ${accessToken}`)
      .send([
        {
          shopId: sellerUserId,
          receiver: {
            name: 'John Doe',
            phone: '0123456789',
            address: '123 Test Street',
          },
          cartItemIds: [cartItem.body.id],
        },
      ])
      .expect(201)

    const orderId = orderResponse.body.orders[0].id

    // Update order status to DELIVERED
    await prisma.order.update({
      where: { id: orderId },
      data: { status: OrderStatus.DELIVERED },
    })

    return orderId
  }

  function createReview(
    accessToken: string,
    productId: number,
    orderId: number,
    medias: Array<{ url: string; type: string }> = [{ url: 'https://example.com/image1.jpg', type: 'IMAGE' }],
  ) {
    return request(app.getHttpServer()).post('/reviews').set('Authorization', `Bearer ${accessToken}`).send({
      content: 'Great product!',
      rating: 5,
      productId,
      orderId,
      medias,
    })
  }

  // ===== TEST SUITES =====

  describe('Group 1: Complete Review Flow', () => {
    it('should create review successfully with medias', async () => {
      // ARRANGE: Create delivered order
      const orderId = await createDeliveredOrder(buyerAccessToken)

      // ACT: Create review
      const reviewResponse = await createReview(buyerAccessToken, testProductId, orderId, [
        { url: 'https://example.com/image1.jpg', type: 'IMAGE' },
        { url: 'https://example.com/image2.jpg', type: 'IMAGE' },
      ]).expect(201)

      // ASSERT
      expect(reviewResponse.body).toMatchObject({
        id: expect.any(Number),
        productId: testProductId,
        orderId: orderId,
        userId: buyerUserId,
        rating: 5,
        content: 'Great product!',
        updateCount: 0,
        createdAt: expect.any(String),
        updatedAt: expect.any(String),
        user: {
          id: buyerUserId,
          name: 'Buyer User',
        },
        medias: expect.arrayContaining([
          expect.objectContaining({
            id: expect.any(Number),
            url: 'https://example.com/image1.jpg',
            type: 'IMAGE',
            reviewId: expect.any(Number),
            createdAt: expect.any(String),
          }),
          expect.objectContaining({
            url: 'https://example.com/image2.jpg',
            type: 'IMAGE',
          }),
        ]),
      })
      expect(reviewResponse.body.medias).toHaveLength(2)
    })

    it('should create review with empty medias array', async () => {
      // ARRANGE
      const orderId = await createDeliveredOrder(buyerAccessToken)

      // ACT
      const reviewResponse = await createReview(buyerAccessToken, testProductId, orderId, []).expect(201)

      // ASSERT
      expect(reviewResponse.body).toMatchObject({
        id: expect.any(Number),
        productId: testProductId,
        orderId: orderId,
        userId: buyerUserId,
        updateCount: 0,
        medias: [],
      })
    })

    it('should update review successfully (first time)', async () => {
      // ARRANGE: Create review
      const orderId = await createDeliveredOrder(buyerAccessToken)
      const createResponse = await createReview(buyerAccessToken, testProductId, orderId).expect(201)
      const reviewId = createResponse.body.id

      // ACT: Update review
      const updateResponse = await request(app.getHttpServer())
        .put(`/reviews/${reviewId}`)
        .set('Authorization', `Bearer ${buyerAccessToken}`)
        .send({
          content: 'Updated review content',
          rating: 4,
          productId: testProductId,
          orderId: orderId,
          medias: [{ url: 'https://example.com/updated-image.jpg', type: 'IMAGE' }],
        })
        .expect(200)

      // ASSERT
      expect(updateResponse.body).toMatchObject({
        id: reviewId,
        content: 'Updated review content',
        rating: 4,
        updateCount: 1, // Incremented from 0 to 1
        medias: [
          expect.objectContaining({
            url: 'https://example.com/updated-image.jpg',
            type: 'IMAGE',
          }),
        ],
      })
    })

    it('should replace medias when updating review', async () => {
      // ARRANGE: Create review with 2 medias
      const orderId = await createDeliveredOrder(buyerAccessToken)
      const createResponse = await createReview(buyerAccessToken, testProductId, orderId, [
        { url: 'https://example.com/old1.jpg', type: 'IMAGE' },
        { url: 'https://example.com/old2.jpg', type: 'IMAGE' },
      ]).expect(201)
      const reviewId = createResponse.body.id

      // ACT: Update with 3 new medias
      const updateResponse = await request(app.getHttpServer())
        .put(`/reviews/${reviewId}`)
        .set('Authorization', `Bearer ${buyerAccessToken}`)
        .send({
          content: 'Updated review',
          rating: 5,
          productId: testProductId,
          orderId: orderId,
          medias: [
            { url: 'https://example.com/new1.jpg', type: 'IMAGE' },
            { url: 'https://example.com/new2.jpg', type: 'IMAGE' },
            { url: 'https://example.com/new3.jpg', type: 'IMAGE' },
          ],
        })
        .expect(200)

      // ASSERT: Old medias deleted, new medias created
      expect(updateResponse.body.medias).toHaveLength(3)
      expect(updateResponse.body.medias).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ url: 'https://example.com/new1.jpg' }),
          expect.objectContaining({ url: 'https://example.com/new2.jpg' }),
          expect.objectContaining({ url: 'https://example.com/new3.jpg' }),
        ]),
      )

      // Verify old medias are deleted
      const oldMedias = await prisma.reviewMedia.findMany({
        where: {
          url: { in: ['https://example.com/old1.jpg', 'https://example.com/old2.jpg'] },
        },
      })
      expect(oldMedias).toHaveLength(0)
    })
  })

  describe('Group 2: Validation & Error Handling', () => {
    it('should reject review when order not found', async () => {
      // ACT & ASSERT
      await request(app.getHttpServer())
        .post('/reviews')
        .set('Authorization', `Bearer ${buyerAccessToken}`)
        .send({
          content: 'Great product!',
          rating: 5,
          productId: testProductId,
          orderId: 99999, // Non-existent order
          medias: [],
        })
        .expect(400)
        .expect((res) => {
          expect(res.body.message).toBe('Đơn hàng không tồn tại hoặc không thuộc về bạn')
        })
    })

    it('should reject review when order not belongs to user', async () => {
      // ARRANGE: Create order for buyer1
      const orderId = await createDeliveredOrder(buyerAccessToken)

      // ACT & ASSERT: Buyer2 tries to review buyer1's order
      await request(app.getHttpServer())
        .post('/reviews')
        .set('Authorization', `Bearer ${buyer2AccessToken}`)
        .send({
          content: 'Great product!',
          rating: 5,
          productId: testProductId,
          orderId: orderId,
          medias: [],
        })
        .expect(400)
        .expect((res) => {
          expect(res.body.message).toBe('Đơn hàng không tồn tại hoặc không thuộc về bạn')
        })
    })

    it('should reject review when order status is not DELIVERED', async () => {
      // ARRANGE: Create order with PENDING_PAYMENT status
      const cartItem = await request(app.getHttpServer())
        .post('/cart')
        .set('Authorization', `Bearer ${buyerAccessToken}`)
        .send({ skuId: testSKUId, quantity: 2 })
        .expect(201)

      const orderResponse = await request(app.getHttpServer())
        .post('/orders')
        .set('Authorization', `Bearer ${buyerAccessToken}`)
        .send([
          {
            shopId: sellerUserId,
            receiver: {
              name: 'John Doe',
              phone: '0123456789',
              address: '123 Test Street',
            },
            cartItemIds: [cartItem.body.id],
          },
        ])
        .expect(201)

      const orderId = orderResponse.body.orders[0].id
      // Order status is PENDING_PAYMENT (default)

      // ACT & ASSERT
      await request(app.getHttpServer())
        .post('/reviews')
        .set('Authorization', `Bearer ${buyerAccessToken}`)
        .send({
          content: 'Great product!',
          rating: 5,
          productId: testProductId,
          orderId: orderId,
          medias: [],
        })
        .expect(400)
        .expect((res) => {
          expect(res.body.message).toBe('Đơn hàng chưa được giao')
        })
    })

    it('should reject duplicate review for same product in same order', async () => {
      // ARRANGE: Create first review
      const orderId = await createDeliveredOrder(buyerAccessToken)
      await createReview(buyerAccessToken, testProductId, orderId).expect(201)

      // ACT & ASSERT: Try to create duplicate review
      await request(app.getHttpServer())
        .post('/reviews')
        .set('Authorization', `Bearer ${buyerAccessToken}`)
        .send({
          content: 'Another review',
          rating: 4,
          productId: testProductId,
          orderId: orderId,
          medias: [],
        })
        .expect(409)
        .expect((res) => {
          expect(res.body.message).toBe('Bạn đã đánh giá sản phẩm này rồi')
        })
    })

    it('should reject update review when updateCount >= 1', async () => {
      // ARRANGE: Create review and update once
      const orderId = await createDeliveredOrder(buyerAccessToken)
      const createResponse = await createReview(buyerAccessToken, testProductId, orderId).expect(201)
      const reviewId = createResponse.body.id

      // First update (updateCount: 0 -> 1)
      await request(app.getHttpServer())
        .put(`/reviews/${reviewId}`)
        .set('Authorization', `Bearer ${buyerAccessToken}`)
        .send({
          content: 'First update',
          rating: 4,
          productId: testProductId,
          orderId: orderId,
          medias: [],
        })
        .expect(200)

      // ACT & ASSERT: Second update should fail
      await request(app.getHttpServer())
        .put(`/reviews/${reviewId}`)
        .set('Authorization', `Bearer ${buyerAccessToken}`)
        .send({
          content: 'Second update',
          rating: 3,
          productId: testProductId,
          orderId: orderId,
          medias: [],
        })
        .expect(400)
        .expect((res) => {
          expect(res.body.message).toBe('Bạn chỉ được phép sửa đánh giá 1 lần')
        })
    })

    it('should require authentication for review operations', async () => {
      // ACT & ASSERT: Create review without auth
      await request(app.getHttpServer())
        .post('/reviews')
        .send({
          content: 'Great product!',
          rating: 5,
          productId: testProductId,
          orderId: 1,
          medias: [],
        })
        .expect(401)

      // ACT & ASSERT: Update review without auth
      await request(app.getHttpServer()).put('/reviews/1').send({}).expect(401)
    })
  })

  describe('Group 3: Review Listing & Pagination', () => {
    it('should list reviews with pagination correctly', async () => {
      // ARRANGE: Create 15 reviews for the same product
      const reviews: any[] = []
      for (let i = 0; i < 15; i++) {
        const orderId = await createDeliveredOrder(buyerAccessToken)
        const reviewResponse = await createReview(buyerAccessToken, testProductId, orderId, [
          { url: `https://example.com/image${i}.jpg`, type: 'IMAGE' },
        ]).expect(201)
        reviews.push(reviewResponse.body)
      }

      // ACT: Get first page (10 items)
      const page1Response = await request(app.getHttpServer())
        .get(`/reviews/products/${testProductId}?page=1&limit=10`)
        .expect(200)

      // ASSERT: Page 1
      expect(page1Response.body).toMatchObject({
        data: expect.any(Array),
        totalItems: 15,
        page: 1,
        limit: 10,
        totalPages: 2,
      })
      expect(page1Response.body.data).toHaveLength(10)

      // ACT: Get second page (5 items)
      const page2Response = await request(app.getHttpServer())
        .get(`/reviews/products/${testProductId}?page=2&limit=10`)
        .expect(200)

      // ASSERT: Page 2
      expect(page2Response.body).toMatchObject({
        totalItems: 15,
        page: 2,
        limit: 10,
        totalPages: 2,
      })
      expect(page2Response.body.data).toHaveLength(5)
    })

    it('should filter reviews by productId', async () => {
      // ARRANGE: Create second product
      const product2 = await prisma.product.create({
        data: {
          name: 'Test Product 2',
          brandId: (await prisma.brand.findFirst())!.id,
          images: ['test-product2.png'],
          basePrice: 300000,
          virtualPrice: 300000,
          variants: [],
          publishedAt: new Date('2024-01-01'),
          createdById: sellerUserId,
          categories: { connect: { id: (await prisma.category.findFirst())!.id } },
        },
      })

      const sku2 = await prisma.sKU.create({
        data: {
          productId: product2.id,
          value: 'Size: L',
          price: 300000,
          stock: 50,
          image: 'test-sku2.png',
          createdById: sellerUserId,
        },
      })

      // Create 5 reviews for product 1
      for (let i = 0; i < 5; i++) {
        const orderId = await createDeliveredOrder(buyerAccessToken)
        await createReview(buyerAccessToken, testProductId, orderId).expect(201)
      }

      // Create 3 reviews for product 2
      for (let i = 0; i < 3; i++) {
        // Create cart item for product 2
        const cartItem = await request(app.getHttpServer())
          .post('/cart')
          .set('Authorization', `Bearer ${buyerAccessToken}`)
          .send({ skuId: sku2.id, quantity: 1 })
          .expect(201)

        // Create order
        const orderResponse = await request(app.getHttpServer())
          .post('/orders')
          .set('Authorization', `Bearer ${buyerAccessToken}`)
          .send([
            {
              shopId: sellerUserId,
              receiver: { name: 'John Doe', phone: '0123456789', address: '123 Test Street' },
              cartItemIds: [cartItem.body.id],
            },
          ])
          .expect(201)

        const orderId = orderResponse.body.orders[0].id
        await prisma.order.update({ where: { id: orderId }, data: { status: OrderStatus.DELIVERED } })

        await createReview(buyerAccessToken, product2.id, orderId).expect(201)
      }

      // ACT: Get reviews for product 1
      const product1Reviews = await request(app.getHttpServer()).get(`/reviews/products/${testProductId}`).expect(200)

      // ASSERT: Only product 1 reviews
      expect(product1Reviews.body.totalItems).toBe(5)
      expect(product1Reviews.body.data.every((review: any) => review.productId === testProductId)).toBe(true)

      // ACT: Get reviews for product 2
      const product2Reviews = await request(app.getHttpServer()).get(`/reviews/products/${product2.id}`).expect(200)

      // ASSERT: Only product 2 reviews
      expect(product2Reviews.body.totalItems).toBe(3)
      expect(product2Reviews.body.data.every((review: any) => review.productId === product2.id)).toBe(true)
    })

    it('should handle empty review list', async () => {
      // ARRANGE: Create product with no reviews
      const product2 = await prisma.product.create({
        data: {
          name: 'Product Without Reviews',
          brandId: (await prisma.brand.findFirst())!.id,
          images: ['test-product2.png'],
          basePrice: 100000,
          virtualPrice: 100000,
          variants: [],
          publishedAt: new Date('2024-01-01'),
          createdById: sellerUserId,
          categories: { connect: { id: (await prisma.category.findFirst())!.id } },
        },
      })

      // ACT
      const response = await request(app.getHttpServer()).get(`/reviews/products/${product2.id}`).expect(200)

      // ASSERT
      expect(response.body).toMatchObject({
        data: [],
        totalItems: 0,
        page: 1,
        limit: 10,
        totalPages: 0,
      })
    })
  })

  describe('Group 4: Cross-Module Integration', () => {
    it('should verify order-review relationship', async () => {
      // ARRANGE: Create order with 1 product, create review
      const orderId = await createDeliveredOrder(buyerAccessToken)
      const reviewResponse = await createReview(buyerAccessToken, testProductId, orderId).expect(201)

      // ACT: Get reviews
      const listResponse = await request(app.getHttpServer()).get(`/reviews/products/${testProductId}`).expect(200)

      // ASSERT: Review linked to correct order
      expect(listResponse.body.data[0]).toMatchObject({
        id: reviewResponse.body.id,
        orderId: orderId,
        productId: testProductId,
        userId: buyerUserId,
      })

      // Verify order exists in database
      const order = await prisma.order.findUnique({ where: { id: orderId } })
      expect(order).toBeTruthy()
      expect(order?.userId).toBe(buyerUserId)
      expect(order?.status).toBe(OrderStatus.DELIVERED)
    })

    it('should include user info in review response', async () => {
      // ARRANGE: Create review
      const orderId = await createDeliveredOrder(buyerAccessToken)
      await createReview(buyerAccessToken, testProductId, orderId).expect(201)

      // ACT: Get reviews
      const listResponse = await request(app.getHttpServer()).get(`/reviews/products/${testProductId}`).expect(200)

      // ASSERT: User info included
      expect(listResponse.body.data[0]).toMatchObject({
        user: {
          id: buyerUserId,
          name: 'Buyer User',
        },
      })

      // Verify user info structure (avatar can be null or string)
      const userInfo = listResponse.body.data[0].user
      expect(userInfo).toHaveProperty('id')
      expect(userInfo).toHaveProperty('name')
      expect(userInfo).toHaveProperty('avatar')
      expect(userInfo.avatar).toBeNull() // In test environment, avatar is null
    })
  })
})
