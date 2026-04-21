import { CACHE_MANAGER } from '@nestjs/cache-manager'
import { INestApplication } from '@nestjs/common'
import { Test, TestingModule } from '@nestjs/testing'
import request from 'supertest'
import { AppModule } from '../../src/app.module'
import { HashingService } from '../../src/shared/services/hashing.service'
import { PrismaService } from '../../src/shared/services/prisma.service'
import { resetDatabase } from '../helpers/test-helpers'

describe('Product Integration Tests', () => {
  let app: INestApplication
  let prisma: PrismaService
  let hashingService: HashingService
  let sellerAccessToken: string
  let sellerUserId: number
  let brandId: number
  let categoryId: number
  let productId: number

  // Mock CacheManager to disable cache for integration tests
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
    hashingService = moduleFixture.get<HashingService>(HashingService)

    await app.init()
  })

  beforeEach(async () => {
    await resetDatabase()

    // Create a seller user for testing
    const hashedPassword = await hashingService.hash('password123')
    const sellerRole = await prisma.role.findFirst({
      where: { name: 'SELLER' },
      include: {
        permissions: {
          where: {
            module: 'MANAGE-PRODUCT',
          },
        },
      },
    })

    // Debug: Log permissions
    // console.log('SELLER role permissions:', sellerRole?.permissions.length)
    // console.log(
    //   'Permissions:',
    //   sellerRole?.permissions.map((p) => `${p.path}:${p.method}`),
    // )

    const sellerUser = await prisma.user.create({
      data: {
        email: 'seller@test.com',
        name: 'Seller User',
        phoneNumber: '0987654321',
        password: hashedPassword,
        status: 'ACTIVE',
        roleId: sellerRole!.id,
      },
    })

    sellerUserId = sellerUser.id

    // Login to get access token
    const loginResponse = await request(app.getHttpServer())
      .post('/auth/login')
      .send({
        email: 'seller@test.com',
        password: 'password123',
      })
      .set('User-Agent', 'test-agent')
      .expect(201)

    sellerAccessToken = loginResponse.body.accessToken

    // Create brand for testing
    const brand = await prisma.brand.create({
      data: {
        name: 'Test Brand',
        logo: 'https://example.com/logo.jpg',
        createdById: sellerUserId,
      },
    })
    brandId = brand.id

    // Create category for testing
    const category = await prisma.category.create({
      data: {
        name: 'Test Category',
        createdById: sellerUserId,
      },
    })
    categoryId = category.id

    // Create a test product (published)
    const product = await prisma.product.create({
      data: {
        name: 'Test Product',
        basePrice: 100000,
        virtualPrice: 150000,
        brandId: brandId,
        images: ['https://example.com/image.jpg'],
        variants: [],
        createdById: sellerUserId,
        publishedAt: new Date(), // Publish the product
        categories: {
          connect: {
            id: category.id,
          },
        },
      },
    })
    productId = product.id
  })

  afterAll(async () => {
    await app.close()
  })

  describe('GET /products - List Products (Public)', () => {
    it('should list products without authentication', async () => {
      const response = await request(app.getHttpServer()).get('/products').expect(200)

      expect(response.body).toMatchObject({
        data: expect.any(Array),
        totalItems: expect.any(Number),
        page: expect.any(Number),
        limit: expect.any(Number),
        totalPages: expect.any(Number),
      })
    })

    it('should support pagination', async () => {
      const response = await request(app.getHttpServer()).get('/products?page=1&limit=10').expect(200)

      expect(response.body.page).toBe(1)
      expect(response.body.limit).toBe(10)
    })

    it('should filter by brandId', async () => {
      const response = await request(app.getHttpServer()).get(`/products?brandId=${brandId}`).expect(200)

      expect(response.body.data.length).toBeGreaterThanOrEqual(0)
    })
  })

  describe('GET /products/:productId - Get Product Detail (Public)', () => {
    it('should get product detail without authentication', async () => {
      const response = await request(app.getHttpServer()).get(`/products/${productId}`).expect(200)

      expect(response.body).toMatchObject({
        id: productId,
        name: 'Test Product',
        basePrice: 100000,
        virtualPrice: 150000,
      })
    })

    it('should return 404 for non-existent product', async () => {
      await request(app.getHttpServer()).get('/products/999999').expect(404)
    })
  })

  describe('GET /manage-product/products - List Products (Seller)', () => {
    it('should list products for seller', async () => {
      const response = await request(app.getHttpServer())
        .get(`/manage-product/products?createdById=${sellerUserId}`)
        .set('Authorization', `Bearer ${sellerAccessToken}`)
        .expect(200)

      expect(response.body).toMatchObject({
        data: expect.any(Array),
        totalItems: expect.any(Number),
      })
    })

    it('should return 401 when not authenticated', async () => {
      await request(app.getHttpServer()).get('/manage-product/products').expect(401)
    })
  })

  describe('GET /manage-product/products/:productId - Get Product Detail (Seller)', () => {
    it('should get product detail for seller', async () => {
      const response = await request(app.getHttpServer())
        .get(`/manage-product/products/${productId}`)
        .set('Authorization', `Bearer ${sellerAccessToken}`)
        .expect(200)

      expect(response.body).toMatchObject({
        id: productId,
        name: 'Test Product',
      })
    })

    it('should return 401 when not authenticated', async () => {
      await request(app.getHttpServer()).get(`/manage-product/products/${productId}`).expect(401)
    })
  })

  describe('POST /manage-product/products - Create Product', () => {
    it('should create product successfully', async () => {
      const newProduct = {
        name: 'New Product',
        basePrice: 200000,
        virtualPrice: 250000,
        brandId: brandId,
        images: ['https://example.com/new-image.jpg'],
        variants: [],
        categories: [categoryId],
        skus: [
          {
            price: 200000,
            stock: 100,
            value: '',
            image: 'https://example.com/sku-image.jpg',
          },
        ],
        publishedAt: new Date().toISOString(),
      }

      const response = await request(app.getHttpServer())
        .post('/manage-product/products')
        .set('Authorization', `Bearer ${sellerAccessToken}`)
        .send(newProduct)
        .expect(201)

      expect(response.body).toMatchObject({
        name: 'New Product',
        basePrice: 200000,
        virtualPrice: 250000,
      })
    })

    it('should return 401 when not authenticated', async () => {
      await request(app.getHttpServer())
        .post('/manage-product/products')
        .send({
          name: 'New Product',
          basePrice: 200000,
        })
        .expect(401)
    })

    it('should validate required fields', async () => {
      const response = await request(app.getHttpServer())
        .post('/manage-product/products')
        .set('Authorization', `Bearer ${sellerAccessToken}`)
        .send({
          name: '',
        })
        .expect(422)

      expect(response.body.message).toBeDefined()
    })
  })

  describe('PUT /manage-product/products/:productId - Update Product', () => {
    it('should update product successfully', async () => {
      const updateData = {
        name: 'Updated Product',
        basePrice: 120000,
        virtualPrice: 180000,
        brandId: brandId,
        images: ['https://example.com/updated-image.jpg'],
        variants: [],
        categories: [categoryId],
        skus: [
          {
            price: 120000,
            stock: 50,
            value: '',
            image: 'https://example.com/sku-image.jpg',
          },
        ],
        publishedAt: new Date().toISOString(),
      }

      const response = await request(app.getHttpServer())
        .put(`/manage-product/products/${productId}`)
        .set('Authorization', `Bearer ${sellerAccessToken}`)
        .send(updateData)
        .expect(200)

      expect(response.body.name).toBe('Updated Product')
      expect(response.body.basePrice).toBe(120000)
    })

    it('should return 401 when not authenticated', async () => {
      const updateData = {
        name: 'Updated',
        basePrice: 100000,
        virtualPrice: 150000,
        brandId: brandId,
        images: ['https://example.com/image.jpg'],
        variants: [],
        categories: [categoryId],
        skus: [
          {
            price: 100000,
            stock: 100,
            value: '',
            image: 'https://example.com/sku-image.jpg',
          },
        ],
        publishedAt: new Date().toISOString(),
      }

      await request(app.getHttpServer()).put(`/manage-product/products/${productId}`).send(updateData).expect(401)
    })

    it('should return 404 for non-existent product', async () => {
      const updateData = {
        name: 'Updated',
        basePrice: 100000,
        virtualPrice: 150000,
        brandId: brandId,
        images: ['https://example.com/image.jpg'],
        variants: [],
        categories: [categoryId],
        skus: [
          {
            price: 100000,
            stock: 100,
            value: '',
            image: 'https://example.com/sku-image.jpg',
          },
        ],
        publishedAt: new Date().toISOString(),
      }

      await request(app.getHttpServer())
        .put('/manage-product/products/999999')
        .set('Authorization', `Bearer ${sellerAccessToken}`)
        .send(updateData)
        .expect(404)
    })
  })

  describe('DELETE /manage-product/products/:productId - Delete Product', () => {
    it('should delete product successfully', async () => {
      const response = await request(app.getHttpServer())
        .delete(`/manage-product/products/${productId}`)
        .set('Authorization', `Bearer ${sellerAccessToken}`)
        .expect(200)

      expect(response.body.message).toBeDefined()

      // Verify product is deleted
      await request(app.getHttpServer()).get(`/products/${productId}`).expect(404)
    })

    it('should return 401 when not authenticated', async () => {
      await request(app.getHttpServer()).delete(`/manage-product/products/${productId}`).expect(401)
    })

    it('should return 404 for non-existent product', async () => {
      await request(app.getHttpServer())
        .delete('/manage-product/products/999999')
        .set('Authorization', `Bearer ${sellerAccessToken}`)
        .expect(404)
    })
  })
})
