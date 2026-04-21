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

describe('Voucher Flow E2E', () => {
  let app: INestApplication
  let prisma: PrismaService
  let hashingService: HashingService
  let tokenService: TokenService
  let adminToken: string
  let clientToken: string
  let adminId: number
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
    adminId = admin.userId
    const client = await createTestUser('client@test.com', 'password123', 2, prisma, hashingService, tokenService)
    clientToken = client.accessToken
    clientId = client.userId
  })

  describe('Voucher Creation (Admin)', () => {
    it('should create a percentage voucher', async () => {
      const res = await request(app.getHttpServer())
        .post('/vouchers/manage')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          code: 'SUMMER2025',
          name: 'Summer Sale',
          description: 'Summer discount',
          type: 'PERCENTAGE',
          value: 10,
          minOrderValue: 100000,
          maxDiscount: 50000,
          usageLimit: 100,
          userUsageLimit: 1,
          startDate: new Date().toISOString(),
          endDate: new Date(Date.now() + 30 * 86400000).toISOString(),
          isActive: true,
          applicableProducts: [],
          excludedProducts: [],
        })
        .expect(201)

      expect(res.body).toHaveProperty('data')
      expect(res.body.data.code).toBe('SUMMER2025')
      expect(res.body.data.type).toBe('PERCENTAGE')
      expect(res.body.data.value).toBe(10)
    })

    it('should create a fixed amount voucher', async () => {
      const res = await request(app.getHttpServer())
        .post('/vouchers/manage')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          code: 'FLAT50K',
          name: 'Flat 50K Off',
          type: 'FIXED_AMOUNT',
          value: 50000,
          startDate: new Date().toISOString(),
          endDate: new Date(Date.now() + 30 * 86400000).toISOString(),
        })
        .expect(201)

      expect(res.body.data.code).toBe('FLAT50K')
      expect(res.body.data.type).toBe('FIXED_AMOUNT')
    })

    it('should reject duplicate voucher code', async () => {
      const voucherData = {
        code: 'UNIQUE_CODE',
        name: 'Test',
        type: 'PERCENTAGE',
        value: 5,
        startDate: new Date().toISOString(),
        endDate: new Date(Date.now() + 86400000).toISOString(),
      }

      await request(app.getHttpServer())
        .post('/vouchers/manage')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(voucherData)
        .expect(201)

      await request(app.getHttpServer())
        .post('/vouchers/manage')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(voucherData)
        .expect(400)
    })
  })
  describe('Voucher Application', () => {
    let voucherId: number

    beforeEach(async () => {
      // Create a voucher for testing
      const voucher = await prisma.voucher.create({
        data: {
          code: 'APPLY10',
          name: 'Apply Test',
          type: 'PERCENTAGE',
          value: 10,
          minOrderValue: 50000,
          maxDiscount: 100000,
          usageLimit: 100,
          userUsageLimit: 1,
          startDate: new Date(Date.now() - 86400000),
          endDate: new Date(Date.now() + 30 * 86400000),
          isActive: true,
          createdById: adminId,
          applicableProducts: [],
          excludedProducts: [],
        },
      })
      voucherId = voucher.id
    })

    it('should collect a voucher', async () => {
      const res = await request(app.getHttpServer())
        .post(`/vouchers/${voucherId}/collect`)
        .set('Authorization', `Bearer ${clientToken}`)
        .expect(201)

      expect(res.body).toHaveProperty('data')
    })

    it('should apply voucher and get discount info', async () => {
      // Collect first
      await request(app.getHttpServer())
        .post(`/vouchers/${voucherId}/collect`)
        .set('Authorization', `Bearer ${clientToken}`)
        .expect(201)

      const res = await request(app.getHttpServer())
        .post('/vouchers/apply')
        .set('Authorization', `Bearer ${clientToken}`)
        .send({
          code: 'APPLY10',
          orderAmount: 500000,
          productIds: [],
        })
        .expect(201)

      expect(res.body).toHaveProperty('data')
      expect(res.body.data).toHaveProperty('canApply', true)
      expect(res.body.data).toHaveProperty('discountAmount')
      expect(res.body.data.discountAmount).toBeGreaterThan(0)
    })

    it('should list my vouchers', async () => {
      // Collect voucher first
      await request(app.getHttpServer())
        .post(`/vouchers/${voucherId}/collect`)
        .set('Authorization', `Bearer ${clientToken}`)
        .expect(201)

      const res = await request(app.getHttpServer())
        .get('/vouchers/my')
        .set('Authorization', `Bearer ${clientToken}`)
        .query({ page: 1, limit: 10 })
        .expect(200)

      expect(res.body).toHaveProperty('data')
      expect(res.body.data.length).toBeGreaterThanOrEqual(1)
    })
  })

  describe('Voucher with Order Discount', () => {
    it('should apply voucher discount to order', async () => {
      const seller = await createTestUser('seller@test.com', 'password123', 3, prisma, hashingService, tokenService)
      const brand = await prisma.brand.create({ data: { name: 'VB', logo: 'vb.png', createdById: seller.userId } })
      const product = await prisma.product.create({
        data: {
          name: 'Voucher Product',
          basePrice: 500000,
          virtualPrice: 600000,
          brandId: brand.id,
          images: ['vp.jpg'],
          variants: [{ name: 'Size', options: ['M'] }],
          createdById: seller.userId,
          publishedAt: new Date(),
        },
      })
      const sku = await prisma.sKU.create({
        data: {
          value: 'M',
          price: 500000,
          stock: 10,
          image: 'vm.jpg',
          productId: product.id,
          createdById: seller.userId,
        },
      })

      const voucher = await prisma.voucher.create({
        data: {
          code: 'ORDER10',
          name: 'Order Discount',
          type: 'PERCENTAGE',
          value: 10,
          startDate: new Date(Date.now() - 86400000),
          endDate: new Date(Date.now() + 30 * 86400000),
          isActive: true,
          createdById: adminId,
          applicableProducts: [],
          excludedProducts: [],
        },
      })

      // Collect voucher
      await request(app.getHttpServer())
        .post(`/vouchers/${voucher.id}/collect`)
        .set('Authorization', `Bearer ${clientToken}`)
        .expect(201)

      // Add to cart
      const cartRes = await request(app.getHttpServer())
        .post('/cart')
        .set('Authorization', `Bearer ${clientToken}`)
        .send({ skuId: sku.id, quantity: 1 })
        .expect(201)

      // Create order with voucher
      const orderRes = await request(app.getHttpServer())
        .post('/orders')
        .set('Authorization', `Bearer ${clientToken}`)
        .send([
          {
            shopId: seller.userId,
            receiver: { name: 'Buyer', phone: '0123456789', address: '123 St' },
            cartItemIds: [cartRes.body.id],
            voucherId: voucher.id,
          },
        ])
        .expect(201)

      expect(orderRes.body).toHaveProperty('paymentId')

      // Verify discount was applied
      const order = await prisma.order.findUnique({ where: { id: orderRes.body.orders[0].id } })
      expect(order?.voucherId).toBe(voucher.id)
      expect(order?.totalAmount).toBeLessThan(500000)
    })
  })

  describe('Unauthenticated Restrictions', () => {
    it('should reject voucher operations without auth', async () => {
      await request(app.getHttpServer()).post('/vouchers/1/collect').expect(401)
      await request(app.getHttpServer()).get('/vouchers/my').expect(401)
      await request(app.getHttpServer()).post('/vouchers/apply').send({ code: 'X', orderAmount: 100 }).expect(401)
    })
  })
})
