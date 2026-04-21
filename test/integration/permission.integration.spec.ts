import { CACHE_MANAGER } from '@nestjs/cache-manager'
import { INestApplication } from '@nestjs/common'
import { Test, TestingModule } from '@nestjs/testing'
import { AppModule } from 'src/app.module'
import { HashingService } from 'src/shared/services/hashing.service'
import { PrismaService } from 'src/shared/services/prisma.service'
import { TokenService } from 'src/shared/services/token.service'
import request from 'supertest'
import { createTestUser, resetDatabase } from '../helpers/test-helpers'

describe('Permission Integration Tests', () => {
  let app: INestApplication
  let prisma: PrismaService
  let hashingService: HashingService
  let tokenService: TokenService
  let adminAccessToken: string
  let adminUserId: number

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
  })

  afterAll(async () => {
    await app.close()
  })

  describe('GET /permissions - List permissions', () => {
    it('should return list of permissions with pagination', async () => {
      const response = await request(app.getHttpServer())
        .get('/permissions?page=1&limit=10')
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .expect(200)

      expect(response.body).toMatchObject({
        data: expect.any(Array),
        totalItems: expect.any(Number),
        page: 1,
        limit: 10,
        totalPages: expect.any(Number),
      })
      expect(response.body.data.length).toBeGreaterThan(0)
      expect(response.body.data[0]).toHaveProperty('name')
      expect(response.body.data[0]).toHaveProperty('path')
      expect(response.body.data[0]).toHaveProperty('method')
    })

    it('should return 401 when not authenticated', async () => {
      await request(app.getHttpServer()).get('/permissions').expect(401)
    })
  })

  describe('GET /permissions/:permissionId - Get permission detail', () => {
    it('should return permission detail', async () => {
      const permission = await prisma.permission.findFirst()

      const response = await request(app.getHttpServer())
        .get(`/permissions/${permission!.id}`)
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .expect(200)

      expect(response.body).toMatchObject({
        id: permission!.id,
        name: permission!.name,
        path: permission!.path,
        method: permission!.method,
      })
    })

    it('should return 404 when permission not found', async () => {
      await request(app.getHttpServer())
        .get('/permissions/99999')
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .expect(404)
    })

    it('should return 401 when not authenticated', async () => {
      const permission = await prisma.permission.findFirst()
      await request(app.getHttpServer()).get(`/permissions/${permission!.id}`).expect(401)
    })

    it('should return 400 for invalid permission id', async () => {
      await request(app.getHttpServer())
        .get('/permissions/invalid')
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .expect(422)
    })
  })

  describe('POST /permissions - Create permission', () => {
    it('should create permission successfully with admin auth', async () => {
      const permissionData = {
        name: 'test.create',
        description: 'Create test permission',
        module: 'TEST',
        path: '/test',
        method: 'POST',
      }

      const response = await request(app.getHttpServer())
        .post('/permissions')
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .send(permissionData)
        .expect(201)

      expect(response.body).toMatchObject({
        id: expect.any(Number),
        name: 'test.create',
        description: 'Create test permission',
        module: 'TEST',
        path: '/test',
        method: 'POST',
        createdById: adminUserId,
      })

      const permissionInDb = await prisma.permission.findUnique({
        where: { id: response.body.id },
      })
      expect(permissionInDb).toBeDefined()
      expect(permissionInDb?.name).toBe('test.create')
    })

    it('should create permission without description', async () => {
      const permissionData = {
        name: 'test.read',
        module: 'TEST',
        path: '/test',
        method: 'GET',
      }

      const response = await request(app.getHttpServer())
        .post('/permissions')
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .send(permissionData)
        .expect(201)

      expect(response.body).toMatchObject({
        id: expect.any(Number),
        name: 'test.read',
        module: 'TEST',
        path: '/test',
        method: 'GET',
      })
    })

    it('should return 401 when not authenticated', async () => {
      const permissionData = {
        name: 'test.create',
        description: 'Test permission',
        module: 'TEST',
        path: '/test',
        method: 'POST',
      }

      await request(app.getHttpServer()).post('/permissions').send(permissionData).expect(401)
    })

    it('should return 400 when name is missing', async () => {
      const permissionData = {
        description: 'Test permission',
        module: 'TEST',
        path: '/test',
        method: 'POST',
      }

      await request(app.getHttpServer())
        .post('/permissions')
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .send(permissionData)
        .expect(422)
    })

    it('should return 400 when path is missing', async () => {
      const permissionData = {
        name: 'test.create',
        description: 'Test permission',
        module: 'TEST',
        method: 'POST',
      }

      await request(app.getHttpServer())
        .post('/permissions')
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .send(permissionData)
        .expect(422)
    })

    // SKIPPED: Rate limiting issue (429 Too Many Requests)
    it('should return 422 when method is missing', async () => {
      const permissionData = {
        name: 'test.create',
        description: 'Test permission',
        module: 'TEST',
        path: '/test',
      }

      await request(app.getHttpServer())
        .post('/permissions')
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .send(permissionData)
        .expect(422)
    })

    // SKIPPED: API does not check duplicate permission name on create
    it('should return 422 when permission name already exists', async () => {
      const existingPermission = await prisma.permission.findFirst()

      const permissionData = {
        name: existingPermission!.name,
        description: 'Duplicate permission',
        module: 'TEST',
        path: '/test',
        method: 'POST',
      }

      await request(app.getHttpServer())
        .post('/permissions')
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .send(permissionData)
        .expect(422)
    })
  })

  describe('PUT /permissions/:permissionId - Update permission', () => {
    it('should update permission successfully with admin auth', async () => {
      const permission = await prisma.permission.create({
        data: {
          name: 'test.original',
          description: 'Original permission',
          module: 'TEST',
          path: '/test/original',
          method: 'GET',
          createdById: adminUserId,
        },
      })

      const updateData = {
        name: 'test.updated',
        description: 'Updated permission',
        module: 'TEST_UPDATED',
        path: '/test/updated',
        method: 'POST',
      }

      const response = await request(app.getHttpServer())
        .put(`/permissions/${permission.id}`)
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .send(updateData)
        .expect(200)

      expect(response.body).toMatchObject({
        id: permission.id,
        name: 'test.updated',
        description: 'Updated permission',
        module: 'TEST_UPDATED',
        path: '/test/updated',
        method: 'POST',
        updatedById: adminUserId,
      })

      const updatedPermission = await prisma.permission.findUnique({
        where: { id: permission.id },
      })
      expect(updatedPermission?.name).toBe('test.updated')
    })

    it('should return 401 when not authenticated', async () => {
      const permission = await prisma.permission.create({
        data: {
          name: 'test.permission',
          description: 'Test permission',
          module: 'TEST',
          path: '/test',
          method: 'GET',
          createdById: adminUserId,
        },
      })

      const updateData = {
        name: 'test.updated',
        description: 'Updated',
        module: 'TEST',
        path: '/test',
        method: 'POST',
      }

      await request(app.getHttpServer()).put(`/permissions/${permission.id}`).send(updateData).expect(401)
    })

    it('should return 404 when permission not found', async () => {
      const updateData = {
        name: 'test.updated',
        description: 'Updated',
        module: 'TEST',
        path: '/test',
        method: 'POST',
      }

      await request(app.getHttpServer())
        .put('/permissions/99999')
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .send(updateData)
        .expect(404)
    })

    // SKIPPED: API does not check duplicate permission name on update
    it('should return 422 when updating to existing permission name', async () => {
      const permission1 = await prisma.permission.create({
        data: {
          name: 'test.permission1',
          description: 'Permission 1',
          module: 'TEST',
          path: '/test1',
          method: 'GET',
          createdById: adminUserId,
        },
      })

      await prisma.permission.create({
        data: {
          name: 'test.permission2',
          description: 'Permission 2',
          module: 'TEST',
          path: '/test2',
          method: 'GET',
          createdById: adminUserId,
        },
      })

      const updateData = {
        name: 'test.permission2',
        description: 'Updated',
        module: 'TEST',
        path: '/test',
        method: 'POST',
      }

      await request(app.getHttpServer())
        .put(`/permissions/${permission1.id}`)
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .send(updateData)
        .expect(422)
    })
  })

  describe('DELETE /permissions/:permissionId - Delete permission', () => {
    it('should delete permission successfully with admin auth', async () => {
      const permission = await prisma.permission.create({
        data: {
          name: 'test.delete',
          description: 'Permission to delete',
          module: 'TEST',
          path: '/test/delete',
          method: 'DELETE',
          createdById: adminUserId,
        },
      })

      const response = await request(app.getHttpServer())
        .delete(`/permissions/${permission.id}`)
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .expect(200)

      expect(response.body).toHaveProperty('message')

      const deletedPermission = await prisma.permission.findUnique({
        where: { id: permission.id },
      })
      expect(deletedPermission?.deletedAt).not.toBeNull()
      expect(deletedPermission?.deletedById).toBe(adminUserId)
    })

    it('should return 401 when not authenticated', async () => {
      const permission = await prisma.permission.create({
        data: {
          name: 'test.permission',
          description: 'Test permission',
          module: 'TEST',
          path: '/test',
          method: 'GET',
          createdById: adminUserId,
        },
      })

      await request(app.getHttpServer()).delete(`/permissions/${permission.id}`).expect(401)
    })

    it('should return 404 when permission not found', async () => {
      await request(app.getHttpServer())
        .delete('/permissions/99999')
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .expect(404)
    })

    it('should return 400 for invalid permission id', async () => {
      await request(app.getHttpServer())
        .delete('/permissions/invalid')
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .expect(422)
    })
  })
})
