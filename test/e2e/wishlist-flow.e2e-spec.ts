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

describe('Wishlist Flow E2E', () => {
  let app: INestApplication
  let prisma: PrismaService
  let hashingService: HashingService
  let tokenService: TokenService
  let clientToken: string
  let clientId: number
  let testProductId: number
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
    const client = await createTestUser('client@test.com', 'password123', 2, prisma, hashingService, tokenService)
    clientToken = client.accessToken
    clientId = client.userId

    const seller = await createTestUser('seller@test.com', 'password123', 3, prisma, hashingService, tokenService)
    const brand = await prisma.brand.create({
      data: { name: 'WishBrand', logo: 'wb.png', createdById: seller.userId },
    })
    const product = await prisma.product.create({
      data: {
        name: 'Wishlist Product',
        basePrice: 2000000,
        virtualPrice: 2500000,
        brandId: brand.id,
        images: ['wp.jpg'],
        variants: [{ name: 'Color', options: ['Blue'] }],
        createdById: seller.userId,
        publishedAt: new Date(),
      },
    })
    testProductId = product.id
    const sku = await prisma.sKU.create({
      data: {
        value: 'Blue',
        price: 2000000,
        stock: 30,
        image: 'blue.jpg',
        productId: product.id,
        createdById: seller.userId,
      },
    })
    testSKUId = sku.id
  })

  describe('Wishlist Item Management', () => {
    it('should add item to wishlist', async () => {
      const res = await request(app.getHttpServer())
        .post('/wishlist/items')
        .set('Authorization', `Bearer ${clientToken}`)
        .send({ productId: testProductId, skuId: testSKUId, note: 'Want this!' })
        .expect(201)

      expect(res.body).toHaveProperty('id')
      expect(res.body.productId).toBe(testProductId)
    })

    it('should list wishlist items', async () => {
      await request(app.getHttpServer())
        .post('/wishlist/items')
        .set('Authorization', `Bearer ${clientToken}`)
        .send({ productId: testProductId })
        .expect(201)

      const res = await request(app.getHttpServer())
        .get('/wishlist/items')
        .set('Authorization', `Bearer ${clientToken}`)
        .query({ page: 1, limit: 10 })
        .expect(200)

      expect(res.body).toHaveProperty('data')
      expect(res.body.data.length).toBeGreaterThanOrEqual(1)
    })

    it('should remove item from wishlist', async () => {
      const addRes = await request(app.getHttpServer())
        .post('/wishlist/items')
        .set('Authorization', `Bearer ${clientToken}`)
        .send({ productId: testProductId })
        .expect(201)

      await request(app.getHttpServer())
        .delete(`/wishlist/items/${addRes.body.id}`)
        .set('Authorization', `Bearer ${clientToken}`)
        .expect(200)

      const listRes = await request(app.getHttpServer())
        .get('/wishlist/items')
        .set('Authorization', `Bearer ${clientToken}`)
        .query({ page: 1, limit: 10 })
        .expect(200)

      expect(listRes.body.data).toHaveLength(0)
    })

    it('should get wishlist count', async () => {
      await request(app.getHttpServer())
        .post('/wishlist/items')
        .set('Authorization', `Bearer ${clientToken}`)
        .send({ productId: testProductId })
        .expect(201)

      const res = await request(app.getHttpServer())
        .get('/wishlist/count')
        .set('Authorization', `Bearer ${clientToken}`)
        .expect(200)

      expect(res.body).toHaveProperty('count')
      expect(res.body.count).toBeGreaterThanOrEqual(1)
    })
  })
  describe('Wishlist Collections & Sharing', () => {
    it('should create a collection', async () => {
      const res = await request(app.getHttpServer())
        .post('/wishlist/collections')
        .set('Authorization', `Bearer ${clientToken}`)
        .send({ name: 'Birthday Gifts', description: 'Gift ideas', isPublic: true })
        .expect(201)

      expect(res.body).toHaveProperty('id')
      expect(res.body.name).toBe('Birthday Gifts')
      expect(res.body.isPublic).toBe(true)
    })

    it('should add item to collection', async () => {
      // Add item to wishlist
      const itemRes = await request(app.getHttpServer())
        .post('/wishlist/items')
        .set('Authorization', `Bearer ${clientToken}`)
        .send({ productId: testProductId })
        .expect(201)

      // Create collection
      const collRes = await request(app.getHttpServer())
        .post('/wishlist/collections')
        .set('Authorization', `Bearer ${clientToken}`)
        .send({ name: 'My Collection' })
        .expect(201)

      // Add item to collection
      await request(app.getHttpServer())
        .post(`/wishlist/collections/${collRes.body.id}/items`)
        .set('Authorization', `Bearer ${clientToken}`)
        .send({ wishlistItemId: itemRes.body.id })
        .expect(201)
    })

    it('should list collections', async () => {
      await request(app.getHttpServer())
        .post('/wishlist/collections')
        .set('Authorization', `Bearer ${clientToken}`)
        .send({ name: 'Collection 1' })
        .expect(201)

      const res = await request(app.getHttpServer())
        .get('/wishlist/collections')
        .set('Authorization', `Bearer ${clientToken}`)
        .expect(200)

      expect(res.body).toHaveProperty('data')
      expect(res.body.data.length).toBeGreaterThanOrEqual(1)
    })

    it('should access shared collection publicly', async () => {
      // Create public collection
      const collRes = await request(app.getHttpServer())
        .post('/wishlist/collections')
        .set('Authorization', `Bearer ${clientToken}`)
        .send({ name: 'Shared Collection', isPublic: true })
        .expect(201)

      // Get the share code from database
      const collection = await prisma.wishlistCollection.findUnique({ where: { id: collRes.body.id } })
      expect(collection?.shareCode).toBeDefined()

      const res = await request(app.getHttpServer())
        .get(`/wishlist/collections/shared/${collection!.shareCode}`)
        .expect(200)

      expect(res.body).toHaveProperty('name', 'Shared Collection')
    })

    it('should delete a collection', async () => {
      const collRes = await request(app.getHttpServer())
        .post('/wishlist/collections')
        .set('Authorization', `Bearer ${clientToken}`)
        .send({ name: 'To Delete' })
        .expect(201)

      await request(app.getHttpServer())
        .delete(`/wishlist/collections/${collRes.body.id}`)
        .set('Authorization', `Bearer ${clientToken}`)
        .expect(200)
    })
  })

  describe('Unauthenticated Restrictions', () => {
    it('should reject wishlist operations without auth', async () => {
      await request(app.getHttpServer()).get('/wishlist/items').query({ page: 1, limit: 10 }).expect(401)
      await request(app.getHttpServer()).post('/wishlist/items').send({ productId: 1 }).expect(401)
      await request(app.getHttpServer()).get('/wishlist/collections').expect(401)
    })
  })
})
