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

describe('Product Catalog Flow E2E', () => {
  let app: INestApplication
  let prisma: PrismaService
  let hashingService: HashingService
  let tokenService: TokenService
  let adminToken: string
  let sellerToken: string
  let clientToken: string
  let sellerId: number
  let clientId: number

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
    const admin = await createTestUser('admin@test.com', 'password123', 1, prisma, hashingService, tokenService)
    adminToken = admin.accessToken
    const seller = await createTestUser('seller@test.com', 'password123', 3, prisma, hashingService, tokenService)
    sellerToken = seller.accessToken
    sellerId = seller.userId
    const client = await createTestUser('client@test.com', 'password123', 2, prisma, hashingService, tokenService)
    clientToken = client.accessToken
    clientId = client.userId
  })

  describe('Brand & Category Management', () => {
    it('should create brand as admin', async () => {
      const res = await request(app.getHttpServer())
        .post('/brands')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'Samsung', logo: 'samsung.png' })
        .expect(201)

      expect(res.body).toHaveProperty('id')
      expect(res.body.name).toBe('Samsung')
    })

    it('should create category as admin', async () => {
      const res = await request(app.getHttpServer())
        .post('/categories')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'Electronics', logo: 'electronics.png' })
        .expect(201)

      expect(res.body).toHaveProperty('id')
      expect(res.body.name).toBe('Electronics')
    })

    it('should list brands publicly', async () => {
      await prisma.brand.create({ data: { name: 'Apple', logo: 'apple.png', createdById: sellerId } })

      const res = await request(app.getHttpServer()).get('/brands').query({ page: 1, limit: 10 }).expect(200)

      expect(res.body).toHaveProperty('data')
      expect(res.body.data.length).toBeGreaterThanOrEqual(1)
    })

    it('should list categories publicly', async () => {
      await prisma.category.create({ data: { name: 'Phones', logo: 'phones.png', createdById: sellerId } })

      const res = await request(app.getHttpServer()).get('/categories').expect(200)

      expect(res.body).toHaveProperty('data')
      expect(res.body.data.length).toBeGreaterThanOrEqual(1)
    })
  })

  describe('Product Catalog: Create → Search → Detail', () => {
    let brandId: number
    let categoryId: number
    let productId: number
    let skuId: number

    beforeEach(async () => {
      const brand = await prisma.brand.create({ data: { name: 'TestBrand', logo: 'b.png', createdById: sellerId } })
      brandId = brand.id
      const category = await prisma.category.create({
        data: { name: 'TestCat', logo: 'c.png', createdById: sellerId },
      })
      categoryId = category.id
    })

    it('should create product as seller via manage-product', async () => {
      const res = await request(app.getHttpServer())
        .post('/manage-product/products')
        .set('Authorization', `Bearer ${sellerToken}`)
        .send({
          name: 'Galaxy S24',
          basePrice: 25000000,
          virtualPrice: 28000000,
          brandId,
          images: ['galaxy.jpg'],
          variants: [{ name: 'Color', options: ['Black', 'White'] }],
          categories: [categoryId],
          skus: [
            { value: 'Black', price: 25000000, stock: 100, image: 'black.jpg' },
            { value: 'White', price: 25000000, stock: 80, image: 'white.jpg' },
          ],
        })
        .expect(201)

      expect(res.body).toHaveProperty('id')
      expect(res.body.name).toBe('Galaxy S24')
      productId = res.body.id
    })

    it('should list products publicly with pagination', async () => {
      // Create product directly for listing test
      const product = await prisma.product.create({
        data: {
          name: 'Test Product',
          basePrice: 1000000,
          virtualPrice: 1200000,
          brandId,
          images: ['test.jpg'],
          variants: [{ name: 'Size', options: ['M'] }],
          createdById: sellerId,
          publishedAt: new Date(),
          categories: { connect: [{ id: categoryId }] },
        },
      })
      await prisma.sKU.create({
        data: {
          value: 'M',
          price: 1000000,
          stock: 10,
          image: 'test-m.jpg',
          productId: product.id,
          createdById: sellerId,
        },
      })

      const res = await request(app.getHttpServer()).get('/products').query({ page: 1, limit: 10 }).expect(200)

      expect(res.body).toHaveProperty('data')
      expect(res.body).toHaveProperty('totalItems')
      expect(res.body.data.length).toBeGreaterThanOrEqual(1)
    })

    it('should get product detail publicly', async () => {
      const product = await prisma.product.create({
        data: {
          name: 'Detail Product',
          basePrice: 5000000,
          virtualPrice: 6000000,
          brandId,
          images: ['detail.jpg'],
          variants: [{ name: 'Color', options: ['Red'] }],
          createdById: sellerId,
          publishedAt: new Date(),
          categories: { connect: [{ id: categoryId }] },
        },
      })
      await prisma.sKU.create({
        data: {
          value: 'Red',
          price: 5000000,
          stock: 20,
          image: 'red.jpg',
          productId: product.id,
          createdById: sellerId,
        },
      })

      const res = await request(app.getHttpServer()).get(`/products/${product.id}`).expect(200)

      expect(res.body).toHaveProperty('id', product.id)
      expect(res.body).toHaveProperty('name', 'Detail Product')
    })
  })
  describe('Product Review Flow', () => {
    it('should create review after purchasing product', async () => {
      // Setup: brand, category, product, sku
      const brand = await prisma.brand.create({ data: { name: 'ReviewBrand', logo: 'rb.png', createdById: sellerId } })
      const category = await prisma.category.create({
        data: { name: 'ReviewCat', logo: 'rc.png', createdById: sellerId },
      })
      const product = await prisma.product.create({
        data: {
          name: 'Review Product',
          basePrice: 1000000,
          virtualPrice: 1200000,
          brandId: brand.id,
          images: ['rp.jpg'],
          variants: [{ name: 'Size', options: ['L'] }],
          createdById: sellerId,
          publishedAt: new Date(),
          categories: { connect: [{ id: category.id }] },
        },
      })
      const sku = await prisma.sKU.create({
        data: {
          value: 'L',
          price: 1000000,
          stock: 10,
          image: 'l.jpg',
          productId: product.id,
          createdById: sellerId,
        },
      })

      // Add to cart, create order
      const cartRes = await request(app.getHttpServer())
        .post('/cart')
        .set('Authorization', `Bearer ${clientToken}`)
        .send({ skuId: sku.id, quantity: 1 })
        .expect(201)

      const orderRes = await request(app.getHttpServer())
        .post('/orders')
        .set('Authorization', `Bearer ${clientToken}`)
        .send([
          {
            shopId: sellerId,
            receiver: { name: 'Reviewer', phone: '0123456789', address: '123 Review St' },
            cartItemIds: [cartRes.body.id],
          },
        ])
        .expect(201)

      const orderId = orderRes.body.orders[0].id

      // Mark order as delivered (simulate)
      await prisma.order.update({ where: { id: orderId }, data: { status: 'DELIVERED' } })

      // Create review
      const reviewRes = await request(app.getHttpServer())
        .post('/reviews')
        .set('Authorization', `Bearer ${clientToken}`)
        .send({
          content: 'Great product, highly recommend!',
          rating: 5,
          productId: product.id,
          orderId,
          medias: [],
        })
        .expect(201)

      expect(reviewRes.body).toHaveProperty('id')
      expect(reviewRes.body.content).toBe('Great product, highly recommend!')
      expect(reviewRes.body.rating).toBe(5)
    })

    it('should list product reviews publicly', async () => {
      const brand = await prisma.brand.create({ data: { name: 'LB', logo: 'lb.png', createdById: sellerId } })
      const product = await prisma.product.create({
        data: {
          name: 'Listed Product',
          basePrice: 500000,
          virtualPrice: 600000,
          brandId: brand.id,
          images: ['lp.jpg'],
          variants: [],
          createdById: sellerId,
          publishedAt: new Date(),
        },
      })

      const res = await request(app.getHttpServer())
        .get(`/reviews/products/${product.id}`)
        .query({ page: 1, limit: 10 })
        .expect(200)

      expect(res.body).toHaveProperty('data')
      expect(res.body).toHaveProperty('totalItems')
    })
  })
})
