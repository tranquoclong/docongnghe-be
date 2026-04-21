import { CACHE_MANAGER } from '@nestjs/cache-manager'
import { INestApplication } from '@nestjs/common'
import { Test, TestingModule } from '@nestjs/testing'
import { AppModule } from 'src/app.module'
import { HashingService } from 'src/shared/services/hashing.service'
import { PrismaService } from 'src/shared/services/prisma.service'
import { TokenService } from 'src/shared/services/token.service'
import request from 'supertest'
import { createTestUser, resetDatabase } from '../helpers/test-helpers'

describe('Role Integration Tests', () => {
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

  describe('GET /roles - List roles', () => {
    it('should return list of roles with pagination', async () => {
      const response = await request(app.getHttpServer())
        .get('/roles?page=1&limit=10')
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
      expect(response.body.data[0]).toHaveProperty('description')
    })

    it('should return 401 when not authenticated', async () => {
      await request(app.getHttpServer()).get('/roles').expect(401)
    })
  })

  describe('GET /roles/:roleId - Get role detail', () => {
    it('should return role detail with permissions', async () => {
      const role = await prisma.role.findFirst({ where: { name: 'ADMIN' } })

      const response = await request(app.getHttpServer())
        .get(`/roles/${role!.id}`)
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .expect(200)

      expect(response.body).toMatchObject({
        id: role!.id,
        name: 'ADMIN',
      })
      expect(response.body).toHaveProperty('permissions')
      expect(Array.isArray(response.body.permissions)).toBe(true)
    })

    it('should return 404 when role not found', async () => {
      await request(app.getHttpServer())
        .get('/roles/99999')
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .expect(404)
    })

    it('should return 401 when not authenticated', async () => {
      const role = await prisma.role.findFirst({ where: { name: 'ADMIN' } })
      await request(app.getHttpServer()).get(`/roles/${role!.id}`).expect(401)
    })

    it('should return 400 for invalid role id', async () => {
      await request(app.getHttpServer())
        .get('/roles/invalid')
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .expect(422)
    })
  })

  describe('POST /roles - Create role', () => {
    it('should create role successfully with admin auth', async () => {
      const roleData = {
        name: 'NEW_ROLE',
        description: 'New role for testing',
        isActive: true,
      }

      const response = await request(app.getHttpServer())
        .post('/roles')
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .send(roleData)
        .expect(201)

      expect(response.body).toMatchObject({
        id: expect.any(Number),
        name: 'NEW_ROLE',
        description: 'New role for testing',
        isActive: true,
        createdById: adminUserId,
      })

      const roleInDb = await prisma.role.findUnique({
        where: { id: response.body.id },
      })
      expect(roleInDb).toBeDefined()
      expect(roleInDb?.name).toBe('NEW_ROLE')
    })

    it('should return 401 when not authenticated', async () => {
      const roleData = {
        name: 'NEW_ROLE',
        description: 'New role',
        isActive: true,
      }

      await request(app.getHttpServer()).post('/roles').send(roleData).expect(401)
    })

    it('should return 400 when name is missing', async () => {
      const roleData = {
        description: 'New role',
        isActive: true,
      }

      await request(app.getHttpServer())
        .post('/roles')
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .send(roleData)
        .expect(422)
    })

    it('should return 400 when description is missing', async () => {
      const roleData = {
        name: 'NEW_ROLE',
        isActive: true,
      }

      await request(app.getHttpServer())
        .post('/roles')
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .send(roleData)
        .expect(422)
    })

    // SKIPPED: API does not check duplicate role name on create
    it('should return 422 when role name already exists', async () => {
      const roleData = {
        name: 'ADMIN',
        description: 'Duplicate admin role',
        isActive: true,
      }

      await request(app.getHttpServer())
        .post('/roles')
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .send(roleData)
        .expect(422)
    })
  })

  describe('PUT /roles/:roleId - Update role', () => {
    it('should update role successfully with admin auth', async () => {
      const role = await prisma.role.create({
        data: {
          name: 'TEST_ROLE',
          description: 'Original description',
          isActive: true,
          createdById: adminUserId,
        },
      })

      const updateData = {
        name: 'UPDATED_ROLE',
        description: 'Updated description',
        isActive: false,
        permissionIds: [],
      }

      const response = await request(app.getHttpServer())
        .put(`/roles/${role.id}`)
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .send(updateData)
        .expect(200)

      expect(response.body).toMatchObject({
        id: role.id,
        name: 'UPDATED_ROLE',
        description: 'Updated description',
        isActive: false,
        updatedById: adminUserId,
      })

      const updatedRole = await prisma.role.findUnique({
        where: { id: role.id },
      })
      expect(updatedRole?.name).toBe('UPDATED_ROLE')
    })

    it('should update role with permissions', async () => {
      const role = await prisma.role.create({
        data: {
          name: 'TEST_ROLE',
          description: 'Test role',
          isActive: true,
          createdById: adminUserId,
        },
      })

      const permission = await prisma.permission.findFirst()

      const updateData = {
        name: 'TEST_ROLE',
        description: 'Test role',
        isActive: true,
        permissionIds: [permission!.id],
      }

      const response = await request(app.getHttpServer())
        .put(`/roles/${role.id}`)
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .send(updateData)
        .expect(200)

      expect(response.body).toHaveProperty('permissions')
    })

    it('should return 401 when not authenticated', async () => {
      const role = await prisma.role.create({
        data: {
          name: 'TEST_ROLE',
          description: 'Test role',
          isActive: true,
          createdById: adminUserId,
        },
      })

      const updateData = {
        name: 'UPDATED_ROLE',
        description: 'Updated',
        isActive: true,
        permissionIds: [],
      }

      await request(app.getHttpServer()).put(`/roles/${role.id}`).send(updateData).expect(401)
    })

    it('should return 404 when role not found', async () => {
      const updateData = {
        name: 'UPDATED_ROLE',
        description: 'Updated',
        isActive: true,
        permissionIds: [],
      }

      await request(app.getHttpServer())
        .put('/roles/99999')
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .send(updateData)
        .expect(404)
    })

    // SKIPPED: API does not check duplicate role name on update
    it('should return 422 when updating to existing role name', async () => {
      const role1 = await prisma.role.create({
        data: {
          name: 'ROLE_1',
          description: 'Role 1',
          isActive: true,
          createdById: adminUserId,
        },
      })

      await prisma.role.create({
        data: {
          name: 'ROLE_2',
          description: 'Role 2',
          isActive: true,
          createdById: adminUserId,
        },
      })

      const updateData = {
        name: 'ROLE_2',
        description: 'Updated',
        isActive: true,
        permissionIds: [],
      }

      await request(app.getHttpServer())
        .put(`/roles/${role1.id}`)
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .send(updateData)
        .expect(422)
    })
  })

  describe('DELETE /roles/:roleId - Delete role', () => {
    it('should delete role successfully with admin auth', async () => {
      const role = await prisma.role.create({
        data: {
          name: 'ROLE_TO_DELETE',
          description: 'Role to delete',
          isActive: true,
          createdById: adminUserId,
        },
      })

      const response = await request(app.getHttpServer())
        .delete(`/roles/${role.id}`)
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .expect(200)

      expect(response.body).toHaveProperty('message')

      const deletedRole = await prisma.role.findUnique({
        where: { id: role.id },
      })
      expect(deletedRole?.deletedAt).not.toBeNull()
      expect(deletedRole?.deletedById).toBe(adminUserId)
    })

    it('should return 401 when not authenticated', async () => {
      const role = await prisma.role.create({
        data: {
          name: 'TEST_ROLE',
          description: 'Test role',
          isActive: true,
          createdById: adminUserId,
        },
      })

      await request(app.getHttpServer()).delete(`/roles/${role.id}`).expect(401)
    })

    it('should return 404 when role not found', async () => {
      await request(app.getHttpServer())
        .delete('/roles/99999')
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .expect(404)
    })

    it('should return 400 for invalid role id', async () => {
      await request(app.getHttpServer())
        .delete('/roles/invalid')
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .expect(422)
    })
  })
})
