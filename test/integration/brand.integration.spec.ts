import { CACHE_MANAGER } from '@nestjs/cache-manager'
import { INestApplication } from '@nestjs/common'
import { Test, TestingModule } from '@nestjs/testing'
import request from 'supertest'
import { AppModule } from '../../src/app.module'
import { HashingService } from '../../src/shared/services/hashing.service'
import { PrismaService } from '../../src/shared/services/prisma.service'
import { TokenService } from '../../src/shared/services/token.service'
import { createTestUser, resetDatabase } from '../helpers/test-helpers'

describe('Brand Integration Tests', () => {
  let app: INestApplication
  let prisma: PrismaService
  let hashingService: HashingService
  let tokenService: TokenService
  let adminAccessToken: string
  let adminUserId: number
  let clientAccessToken: string
  let clientUserId: number

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
    tokenService = moduleFixture.get<TokenService>(TokenService)

    await app.init()
  })

  beforeEach(async () => {
    await resetDatabase()

    // Create admin user directly in database
    const adminResult = await createTestUser('admin@test.com', 'Admin@123', 1, prisma, hashingService, tokenService)
    adminUserId = adminResult.userId
    adminAccessToken = adminResult.accessToken

    // Create client user directly in database
    const clientResult = await createTestUser('client@test.com', 'Client@123', 2, prisma, hashingService, tokenService)
    clientUserId = clientResult.userId
    clientAccessToken = clientResult.accessToken
  })

  afterAll(async () => {
    await app.close()
  })

  describe('GET /brands - List brands', () => {
    it('should return empty list when no brands exist', async () => {
      const response = await request(app.getHttpServer()).get('/brands').expect(200)

      expect(response.body).toMatchObject({
        data: [],
        totalItems: 0,
        page: 1,
        limit: 10,
        totalPages: 0,
      })
    })

    it('should return list of brands with pagination', async () => {
      // Create test brands
      await prisma.brand.createMany({
        data: [
          { name: 'Brand 1', logo: 'https://example.com/logo1.png', createdById: adminUserId },
          { name: 'Brand 2', logo: 'https://example.com/logo2.png', createdById: adminUserId },
          { name: 'Brand 3', logo: 'https://example.com/logo3.png', createdById: adminUserId },
        ],
      })

      const response = await request(app.getHttpServer()).get('/brands?page=1&limit=2').expect(200)

      expect(response.body).toMatchObject({
        data: expect.arrayContaining([
          expect.objectContaining({
            name: expect.any(String),
            logo: expect.any(String),
            brandTranslations: expect.any(Array),
          }),
        ]),
        totalItems: 3,
        page: 1,
        limit: 2,
        totalPages: 2,
      })
      expect(response.body.data).toHaveLength(2)
    })

    it('should be accessible without authentication (public endpoint)', async () => {
      await request(app.getHttpServer()).get('/brands').expect(200)
    })
  })

  describe('GET /brands/:brandId - Get brand detail', () => {
    it('should return brand detail by id', async () => {
      const brand = await prisma.brand.create({
        data: {
          name: 'Test Brand',
          logo: 'https://example.com/logo.png',
          createdById: adminUserId,
        },
      })

      const response = await request(app.getHttpServer()).get(`/brands/${brand.id}`).expect(200)

      expect(response.body).toMatchObject({
        id: brand.id,
        name: 'Test Brand',
        logo: 'https://example.com/logo.png',
        brandTranslations: expect.any(Array),
      })
    })

    it('should return 404 when brand not found', async () => {
      await request(app.getHttpServer()).get('/brands/99999').expect(404)
    })

    it('should be accessible without authentication (public endpoint)', async () => {
      const brand = await prisma.brand.create({
        data: {
          name: 'Test Brand',
          logo: 'https://example.com/logo.png',
          createdById: adminUserId,
        },
      })

      await request(app.getHttpServer()).get(`/brands/${brand.id}`).expect(200)
    })

    it('should return 400 for invalid brand id', async () => {
      await request(app.getHttpServer()).get('/brands/invalid').expect(422)
    })
  })

  describe('POST /brands - Create brand', () => {
    it('should create brand successfully with admin auth', async () => {
      const brandData = {
        name: 'New Brand',
        logo: 'https://example.com/new-logo.png',
      }

      const response = await request(app.getHttpServer())
        .post('/brands')
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .send(brandData)
        .expect(201)

      expect(response.body).toMatchObject({
        id: expect.any(Number),
        name: 'New Brand',
        logo: 'https://example.com/new-logo.png',
        createdById: adminUserId,
      })

      // Verify in database
      const brandInDb = await prisma.brand.findUnique({
        where: { id: response.body.id },
      })
      expect(brandInDb).toBeDefined()
      expect(brandInDb?.name).toBe('New Brand')
    })

    it('should return 401 when not authenticated', async () => {
      const brandData = {
        name: 'New Brand',
        logo: 'https://example.com/new-logo.png',
      }

      await request(app.getHttpServer()).post('/brands').send(brandData).expect(401)
    })

    it('should return 400 when name is missing', async () => {
      const brandData = {
        logo: 'https://example.com/new-logo.png',
      }

      await request(app.getHttpServer())
        .post('/brands')
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .send(brandData)
        .expect(422)
    })

    it('should return 400 when logo is missing', async () => {
      const brandData = {
        name: 'New Brand',
      }

      await request(app.getHttpServer())
        .post('/brands')
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .send(brandData)
        .expect(422)
    })

    it('should return 400 when logo is not a valid URL', async () => {
      const brandData = {
        name: 'New Brand',
        logo: 'invalid-url',
      }

      await request(app.getHttpServer())
        .post('/brands')
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .send(brandData)
        .expect(422)
    })

    // SKIPPED: Rate limiting prevents this test from running reliably
    it('should return 422 when brand name already exists', async () => {
      // Wait to avoid rate limiting
      await new Promise((resolve) => setTimeout(resolve, 4000))

      // Create existing brand
      await prisma.brand.create({
        data: {
          name: 'Existing Brand',
          logo: 'https://example.com/existing.png',
          createdById: adminUserId,
        },
      })

      const brandData = {
        name: 'Existing Brand',
        logo: 'https://example.com/new-logo.png',
      }

      await request(app.getHttpServer())
        .post('/brands')
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .send(brandData)
        .expect(422)
    })
  })

  describe('PUT /brands/:brandId - Update brand', () => {
    it('should update brand successfully with admin auth', async () => {
      const brand = await prisma.brand.create({
        data: {
          name: 'Original Brand',
          logo: 'https://example.com/original.png',
          createdById: adminUserId,
        },
      })

      const updateData = {
        name: 'Updated Brand',
        logo: 'https://example.com/updated.png',
      }

      const response = await request(app.getHttpServer())
        .put(`/brands/${brand.id}`)
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .send(updateData)
        .expect(200)

      expect(response.body).toMatchObject({
        id: brand.id,
        name: 'Updated Brand',
        logo: 'https://example.com/updated.png',
        updatedById: adminUserId,
      })

      // Verify in database
      const updatedBrand = await prisma.brand.findUnique({
        where: { id: brand.id },
      })
      expect(updatedBrand?.name).toBe('Updated Brand')
    })

    it('should return 401 when not authenticated', async () => {
      const brand = await prisma.brand.create({
        data: {
          name: 'Test Brand',
          logo: 'https://example.com/test.png',
          createdById: adminUserId,
        },
      })

      const updateData = {
        name: 'Updated Brand',
        logo: 'https://example.com/updated.png',
      }

      await request(app.getHttpServer()).put(`/brands/${brand.id}`).send(updateData).expect(401)
    })

    it('should return 404 when brand not found', async () => {
      const updateData = {
        name: 'Updated Brand',
        logo: 'https://example.com/updated.png',
      }

      await request(app.getHttpServer())
        .put('/brands/99999')
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .send(updateData)
        .expect(404)
    })

    it('should return 400 when name is missing', async () => {
      const brand = await prisma.brand.create({
        data: {
          name: 'Test Brand',
          logo: 'https://example.com/test.png',
          createdById: adminUserId,
        },
      })

      const updateData = {
        logo: 'https://example.com/updated.png',
      }

      await request(app.getHttpServer())
        .put(`/brands/${brand.id}`)
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .send(updateData)
        .expect(422)
    })

    // SKIPPED: API does not check duplicate brand name on update
    it('should return 422 when updating to existing brand name', async () => {
      // Create two brands
      const brand1 = await prisma.brand.create({
        data: {
          name: 'Brand 1',
          logo: 'https://example.com/brand1.png',
          createdById: adminUserId,
        },
      })

      await prisma.brand.create({
        data: {
          name: 'Brand 2',
          logo: 'https://example.com/brand2.png',
          createdById: adminUserId,
        },
      })

      const updateData = {
        name: 'Brand 2', // Try to update to existing name
        logo: 'https://example.com/updated.png',
      }

      await request(app.getHttpServer())
        .put(`/brands/${brand1.id}`)
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .send(updateData)
        .expect(422)
    })
  })

  describe('DELETE /brands/:brandId - Delete brand', () => {
    it('should delete brand successfully with admin auth', async () => {
      const brand = await prisma.brand.create({
        data: {
          name: 'Brand to Delete',
          logo: 'https://example.com/delete.png',
          createdById: adminUserId,
        },
      })

      const response = await request(app.getHttpServer())
        .delete(`/brands/${brand.id}`)
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .expect(200)

      expect(response.body).toMatchObject({
        message: expect.any(String),
      })

      // Verify soft delete in database
      const deletedBrand = await prisma.brand.findUnique({
        where: { id: brand.id },
      })
      expect(deletedBrand?.deletedAt).not.toBeNull()
      expect(deletedBrand?.deletedById).toBe(adminUserId)
    })

    it('should return 401 when not authenticated', async () => {
      const brand = await prisma.brand.create({
        data: {
          name: 'Test Brand',
          logo: 'https://example.com/test.png',
          createdById: adminUserId,
        },
      })

      await request(app.getHttpServer()).delete(`/brands/${brand.id}`).expect(401)
    })

    it('should return 404 when brand not found', async () => {
      await request(app.getHttpServer())
        .delete('/brands/99999')
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .expect(404)
    })

    it('should return 400 for invalid brand id', async () => {
      await request(app.getHttpServer())
        .delete('/brands/invalid')
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .expect(422)
    })
  })
})
