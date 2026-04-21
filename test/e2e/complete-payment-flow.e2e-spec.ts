import { CACHE_MANAGER } from '@nestjs/cache-manager'
import { INestApplication } from '@nestjs/common'
import { Test, TestingModule } from '@nestjs/testing'
import request from 'supertest'
import { AppModule } from '../../src/app.module'
import { EmailService } from '../../src/shared/services/email.service'
import { PrismaService } from '../../src/shared/services/prisma.service'
import { createTestUser, resetDatabase } from '../helpers/test-helpers'
import { HashingService } from '../../src/shared/services/hashing.service'
import { TokenService } from '../../src/shared/services/token.service'

describe('Complete Payment Flow E2E', () => {
  let app: INestApplication
  let prisma: PrismaService
  let hashingService: HashingService
  let tokenService: TokenService
  let buyerToken: string
  let buyerId: number
  let sellerId: number
  let testSKUId: number

  const mockEmailService = {
    sendEmail: jest.fn().mockResolvedValue({ error: null }),
    sendOTP: jest.fn().mockResolvedValue({ error: null }),
  }
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
    hashingService = moduleFixture.get<HashingService>(HashingService)
    tokenService = moduleFixture.get<TokenService>(TokenService)
    await app.init()
  })

  afterAll(async () => {
    await app.close()
  })

  beforeEach(async () => {
    await resetDatabase()
    const buyer = await createTestUser('buyer@test.com', 'password123', 2, prisma, hashingService, tokenService)
    buyerToken = buyer.accessToken
    buyerId = buyer.userId
    const seller = await createTestUser('seller@test.com', 'password123', 3, prisma, hashingService, tokenService)
    sellerId = seller.userId

    const brand = await prisma.brand.create({ data: { name: 'TestBrand', logo: 'b.png', createdById: sellerId } })
    const category = await prisma.category.create({
      data: { name: 'Electronics', logo: 'e.png', createdById: sellerId },
    })
    const product = await prisma.product.create({
      data: {
        name: 'Test Phone',
        basePrice: 10000000,
        virtualPrice: 12000000,
        brandId: brand.id,
        images: ['phone.jpg'],
        variants: [{ name: 'Color', options: ['Black'] }],
        createdById: sellerId,
        publishedAt: new Date(),
        categories: { connect: [{ id: category.id }] },
      },
    })
    const sku = await prisma.sKU.create({
      data: {
        value: 'Black',
        price: 10000000,
        stock: 50,
        image: 'phone-black.jpg',
        productId: product.id,
        createdById: sellerId,
      },
    })
    testSKUId = sku.id
  })

  describe('Full Payment Flow: Cart → Order → Pay → Verify', () => {
    it('should complete the full payment flow', async () => {
      // Add item to cart
      const addToCartRes = await request(app.getHttpServer())
        .post('/cart')
        .set('Authorization', `Bearer ${buyerToken}`)
        .send({ skuId: testSKUId, quantity: 2 })
        .expect(201)

      expect(addToCartRes.body).toHaveProperty('id')
      const cartItemId = addToCartRes.body.id

      // Create order
      const createOrderRes = await request(app.getHttpServer())
        .post('/orders')
        .set('Authorization', `Bearer ${buyerToken}`)
        .send([
          {
            shopId: sellerId,
            receiver: { name: 'Test Buyer', phone: '0123456789', address: '123 Test St' },
            cartItemIds: [cartItemId],
          },
        ])
        .expect(201)

      expect(createOrderRes.body).toHaveProperty('paymentId')
      expect(createOrderRes.body.orders).toHaveLength(1)
      const paymentId = createOrderRes.body.paymentId
      const orderId = createOrderRes.body.orders[0].id

      // Verify order is PENDING_PAYMENT
      const order = await prisma.order.findUnique({ where: { id: orderId } })
      expect(order?.status).toBe('PENDING_PAYMENT')

      // Verify payment is PENDING
      const payment = await prisma.payment.findUnique({ where: { id: paymentId } })
      expect(payment?.status).toBe('PENDING')

      // Verify cart is cleared
      const cartItems = await prisma.cartItem.findMany({ where: { userId: buyerId } })
      expect(cartItems).toHaveLength(0)

      // Verify stock was decremented
      const updatedSku = await prisma.sKU.findUnique({ where: { id: testSKUId } })
      expect(updatedSku?.stock).toBe(48)

      // Verify order detail endpoint
      const orderDetailRes = await request(app.getHttpServer())
        .get(`/orders/${orderId}`)
        .set('Authorization', `Bearer ${buyerToken}`)
        .expect(200)

      expect(orderDetailRes.body).toHaveProperty('id', orderId)
      expect(orderDetailRes.body).toHaveProperty('items')
      expect(orderDetailRes.body).toHaveProperty('receiver')
    })

    it('should reject order creation with non-existent cart items', async () => {
      await request(app.getHttpServer())
        .post('/orders')
        .set('Authorization', `Bearer ${buyerToken}`)
        .send([
          {
            shopId: sellerId,
            receiver: { name: 'Test', phone: '0123456789', address: '123 St' },
            cartItemIds: [999999],
          },
        ])
        .expect(422)
    })
  })

  describe('Unauthenticated Restrictions', () => {
    it('should reject cart operations without auth', async () => {
      await request(app.getHttpServer()).post('/cart').send({ skuId: testSKUId, quantity: 1 }).expect(401)
    })

    it('should reject order creation without auth', async () => {
      await request(app.getHttpServer())
        .post('/orders')
        .send([
          {
            shopId: sellerId,
            receiver: { name: 'Test', phone: '0123456789', address: '123 St' },
            cartItemIds: [1],
          },
        ])
        .expect(401)
    })
  })

  describe('Order Cancellation', () => {
    it('should cancel a pending order and restore stock', async () => {
      const addRes = await request(app.getHttpServer())
        .post('/cart')
        .set('Authorization', `Bearer ${buyerToken}`)
        .send({ skuId: testSKUId, quantity: 1 })
        .expect(201)

      const orderRes = await request(app.getHttpServer())
        .post('/orders')
        .set('Authorization', `Bearer ${buyerToken}`)
        .send([
          {
            shopId: sellerId,
            receiver: { name: 'Test', phone: '0123456789', address: '123 St' },
            cartItemIds: [addRes.body.id],
          },
        ])
        .expect(201)

      const orderId = orderRes.body.orders[0].id

      const cancelRes = await request(app.getHttpServer())
        .put(`/orders/${orderId}`)
        .set('Authorization', `Bearer ${buyerToken}`)
        .send({})
        .expect(200)

      expect(cancelRes.body.status).toBe('CANCELLED')

      const sku = await prisma.sKU.findUnique({ where: { id: testSKUId } })
      expect(sku?.stock).toBe(50)
    })
  })

  describe('Order Listing', () => {
    it('should list user orders with pagination', async () => {
      const addRes = await request(app.getHttpServer())
        .post('/cart')
        .set('Authorization', `Bearer ${buyerToken}`)
        .send({ skuId: testSKUId, quantity: 1 })
        .expect(201)

      await request(app.getHttpServer())
        .post('/orders')
        .set('Authorization', `Bearer ${buyerToken}`)
        .send([
          {
            shopId: sellerId,
            receiver: { name: 'Test', phone: '0123456789', address: '123 St' },
            cartItemIds: [addRes.body.id],
          },
        ])
        .expect(201)

      const listRes = await request(app.getHttpServer())
        .get('/orders')
        .set('Authorization', `Bearer ${buyerToken}`)
        .query({ page: 1, limit: 10 })
        .expect(200)

      expect(listRes.body).toHaveProperty('data')
      expect(listRes.body).toHaveProperty('totalItems')
      expect(listRes.body).toHaveProperty('page', 1)
      expect(listRes.body).toHaveProperty('limit', 10)
      expect(listRes.body.data.length).toBeGreaterThanOrEqual(1)
    })
  })
})
