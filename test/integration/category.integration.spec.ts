import { CACHE_MANAGER } from '@nestjs/cache-manager'
import { INestApplication } from '@nestjs/common'
import { Test, TestingModule } from '@nestjs/testing'
import { AppModule } from 'src/app.module'
import { HashingService } from 'src/shared/services/hashing.service'
import { PrismaService } from 'src/shared/services/prisma.service'
import { TokenService } from 'src/shared/services/token.service'
import request from 'supertest'
import { createTestUser, resetDatabase } from '../helpers/test-helpers'

describe('Category Integration Tests', () => {
  let app: INestApplication
  let prisma: PrismaService
  let hashingService: HashingService
  let tokenService: TokenService
  let adminAccessToken: string
  let adminUserId: number
  let clientAccessToken: string
  let clientUserId: number

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

  describe('GET /categories - List categories', () => {
    it('should return empty list when no categories exist', async () => {
      const response = await request(app.getHttpServer()).get('/categories').expect(200)

      expect(response.body).toMatchObject({
        data: [],
        totalItems: 0,
      })
    })

    it('should return list of all categories', async () => {
      await prisma.category.createMany({
        data: [
          { name: 'Category 1', logo: 'logo1.png', createdById: adminUserId },
          { name: 'Category 2', logo: 'logo2.png', createdById: adminUserId },
          { name: 'Category 3', logo: 'logo3.png', createdById: adminUserId },
        ],
      })

      const response = await request(app.getHttpServer()).get('/categories').expect(200)

      expect(response.body).toMatchObject({
        totalItems: 3,
      })
      expect(response.body.data).toHaveLength(3)
      expect(response.body.data[0]).toHaveProperty('name')
      expect(response.body.data[0]).toHaveProperty('logo')
    })

    it('should filter by parentCategoryId', async () => {
      const parentCategory = await prisma.category.create({
        data: {
          name: 'Parent Category',
          logo: 'parent.png',
          createdById: adminUserId,
        },
      })

      await prisma.category.createMany({
        data: [
          { name: 'Child 1', logo: 'child1.png', parentCategoryId: parentCategory.id, createdById: adminUserId },
          { name: 'Child 2', logo: 'child2.png', parentCategoryId: parentCategory.id, createdById: adminUserId },
          { name: 'Other Category', logo: 'other.png', createdById: adminUserId },
        ],
      })

      const response = await request(app.getHttpServer())
        .get(`/categories?parentCategoryId=${parentCategory.id}`)
        .expect(200)

      expect(response.body.totalItems).toBe(2)
      expect(response.body.data).toHaveLength(2)
    })

    it('should be accessible without authentication (public endpoint)', async () => {
      await request(app.getHttpServer()).get('/categories').expect(200)
    })
  })

  describe('GET /categories/:categoryId - Get category detail', () => {
    it('should return category detail by id', async () => {
      const category = await prisma.category.create({
        data: {
          name: 'Test Category',
          logo: 'test-logo.png',
          createdById: adminUserId,
        },
      })

      const response = await request(app.getHttpServer()).get(`/categories/${category.id}`).expect(200)

      expect(response.body).toMatchObject({
        id: category.id,
        name: 'Test Category',
        logo: 'test-logo.png',
      })
      expect(response.body).toHaveProperty('categoryTranslations')
    })

    it('should return 404 when category not found', async () => {
      await request(app.getHttpServer()).get('/categories/99999').expect(404)
    })

    it('should be accessible without authentication (public endpoint)', async () => {
      const category = await prisma.category.create({
        data: {
          name: 'Test Category',
          logo: 'test-logo.png',
          createdById: adminUserId,
        },
      })

      await request(app.getHttpServer()).get(`/categories/${category.id}`).expect(200)
    })

    it('should return 400 for invalid category id', async () => {
      await request(app.getHttpServer()).get('/categories/invalid').expect(422)
    })
  })

  describe('POST /categories - Create category', () => {
    it('should create category successfully with admin auth', async () => {
      const categoryData = {
        name: 'New Category',
        logo: 'new-logo.png',
      }

      const response = await request(app.getHttpServer())
        .post('/categories')
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .send(categoryData)
        .expect(201)

      expect(response.body).toMatchObject({
        id: expect.any(Number),
        name: 'New Category',
        logo: 'new-logo.png',
        createdById: adminUserId,
      })

      const categoryInDb = await prisma.category.findUnique({
        where: { id: response.body.id },
      })
      expect(categoryInDb).toBeDefined()
      expect(categoryInDb?.name).toBe('New Category')
    })

    it('should create category with parent category', async () => {
      const parentCategory = await prisma.category.create({
        data: {
          name: 'Parent Category',
          logo: 'parent.png',
          createdById: adminUserId,
        },
      })

      const categoryData = {
        name: 'Child Category',
        logo: 'child.png',
        parentCategoryId: parentCategory.id,
      }

      const response = await request(app.getHttpServer())
        .post('/categories')
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .send(categoryData)
        .expect(201)

      expect(response.body).toMatchObject({
        id: expect.any(Number),
        name: 'Child Category',
        parentCategoryId: parentCategory.id,
      })
    })

    it('should return 401 when not authenticated', async () => {
      const categoryData = {
        name: 'New Category',
        logo: 'new-logo.png',
      }

      await request(app.getHttpServer()).post('/categories').send(categoryData).expect(401)
    })

    it('should return 400 when name is missing', async () => {
      const categoryData = {
        logo: 'new-logo.png',
      }

      await request(app.getHttpServer())
        .post('/categories')
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .send(categoryData)
        .expect(422)
    })

    // SKIPPED: API does not check duplicate category name on create
    it('should return 422 when category name already exists', async () => {
      await prisma.category.create({
        data: {
          name: 'Existing Category',
          logo: 'existing.png',
          createdById: adminUserId,
        },
      })

      const categoryData = {
        name: 'Existing Category',
        logo: 'new-logo.png',
      }

      await request(app.getHttpServer())
        .post('/categories')
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .send(categoryData)
        .expect(422)
    })
  })

  describe('PUT /categories/:categoryId - Update category', () => {
    it('should update category successfully with admin auth', async () => {
      const category = await prisma.category.create({
        data: {
          name: 'Original Category',
          logo: 'original.png',
          createdById: adminUserId,
        },
      })

      const updateData = {
        name: 'Updated Category',
        logo: 'updated.png',
      }

      const response = await request(app.getHttpServer())
        .put(`/categories/${category.id}`)
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .send(updateData)
        .expect(200)

      expect(response.body).toMatchObject({
        id: category.id,
        name: 'Updated Category',
        logo: 'updated.png',
        updatedById: adminUserId,
      })

      const updatedCategory = await prisma.category.findUnique({
        where: { id: category.id },
      })
      expect(updatedCategory?.name).toBe('Updated Category')
    })

    it('should return 401 when not authenticated', async () => {
      const category = await prisma.category.create({
        data: {
          name: 'Test Category',
          logo: 'test.png',
          createdById: adminUserId,
        },
      })

      const updateData = {
        name: 'Updated Category',
        logo: 'updated.png',
      }

      await request(app.getHttpServer()).put(`/categories/${category.id}`).send(updateData).expect(401)
    })

    it('should return 404 when category not found', async () => {
      const updateData = {
        name: 'Updated Category',
        logo: 'updated.png',
      }

      await request(app.getHttpServer())
        .put('/categories/99999')
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .send(updateData)
        .expect(404)
    })

    // SKIPPED: API does not check duplicate category name on update
    it('should return 422 when updating to existing category name', async () => {
      const category1 = await prisma.category.create({
        data: {
          name: 'Category 1',
          logo: 'cat1.png',
          createdById: adminUserId,
        },
      })

      await prisma.category.create({
        data: {
          name: 'Category 2',
          logo: 'cat2.png',
          createdById: adminUserId,
        },
      })

      const updateData = {
        name: 'Category 2',
        logo: 'updated.png',
      }

      await request(app.getHttpServer())
        .put(`/categories/${category1.id}`)
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .send(updateData)
        .expect(422)
    })
  })

  describe('DELETE /categories/:categoryId - Delete category', () => {
    it('should delete category successfully with admin auth', async () => {
      const category = await prisma.category.create({
        data: {
          name: 'Category to Delete',
          logo: 'delete.png',
          createdById: adminUserId,
        },
      })

      const response = await request(app.getHttpServer())
        .delete(`/categories/${category.id}`)
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .expect(200)

      expect(response.body).toHaveProperty('message')

      const deletedCategory = await prisma.category.findUnique({
        where: { id: category.id },
      })
      expect(deletedCategory?.deletedAt).not.toBeNull()
      expect(deletedCategory?.deletedById).toBe(adminUserId)
    })

    it('should return 401 when not authenticated', async () => {
      const category = await prisma.category.create({
        data: {
          name: 'Test Category',
          logo: 'test.png',
          createdById: adminUserId,
        },
      })

      await request(app.getHttpServer()).delete(`/categories/${category.id}`).expect(401)
    })

    it('should return 404 when category not found', async () => {
      await request(app.getHttpServer())
        .delete('/categories/99999')
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .expect(404)
    })

    it('should return 400 for invalid category id', async () => {
      await request(app.getHttpServer())
        .delete('/categories/invalid')
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .expect(422)
    })
  })
})
