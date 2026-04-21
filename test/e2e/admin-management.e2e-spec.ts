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

describe('Admin Management E2E', () => {
  let app: INestApplication
  let prisma: PrismaService
  let hashingService: HashingService
  let tokenService: TokenService
  let adminToken: string
  let clientToken: string
  let adminUserId: number

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
    adminUserId = admin.userId
    const client = await createTestUser('client@test.com', 'password123', 2, prisma, hashingService, tokenService)
    clientToken = client.accessToken
  })

  describe('User CRUD', () => {
    it('should list users as admin', async () => {
      const res = await request(app.getHttpServer())
        .get('/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .query({ page: 1, limit: 10 })
        .expect(200)

      expect(res.body).toHaveProperty('data')
      expect(res.body).toHaveProperty('totalItems')
      expect(res.body).toHaveProperty('page', 1)
      expect(res.body).toHaveProperty('limit', 10)
      expect(res.body).toHaveProperty('totalPages')
      expect(res.body.data.length).toBeGreaterThanOrEqual(2)
    })

    it('should create a new user as admin', async () => {
      const newUser = {
        email: 'newuser@test.com',
        name: 'New User',
        phoneNumber: '0999888777',
        password: 'password123',
        roleId: 2,
        status: 'ACTIVE',
        avatar: null,
      }

      const res = await request(app.getHttpServer())
        .post('/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(newUser)
        .expect(201)

      expect(res.body).toHaveProperty('id')
      expect(res.body.email).toBe(newUser.email)
      expect(res.body.name).toBe(newUser.name)

      // Verify in database
      const dbUser = await prisma.user.findFirst({ where: { email: newUser.email } })
      expect(dbUser).toBeDefined()
      expect(dbUser?.password).not.toBe(newUser.password) // Should be hashed
    })

    it('should get user by ID as admin', async () => {
      const res = await request(app.getHttpServer())
        .get(`/users/${adminUserId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200)

      expect(res.body).toHaveProperty('id', adminUserId)
      expect(res.body).toHaveProperty('email', 'admin@test.com')
      expect(res.body).toHaveProperty('role')
    })

    it('should update user as admin', async () => {
      const target = await createTestUser('target@test.com', 'password123', 2, prisma, hashingService, tokenService)

      const res = await request(app.getHttpServer())
        .put(`/users/${target.userId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          email: 'target@test.com',
          name: 'Updated Name',
          phoneNumber: '0111222333',
          password: 'newpassword123',
          roleId: 2,
          status: 'ACTIVE',
          avatar: null,
        })
        .expect(200)

      expect(res.body.name).toBe('Updated Name')
    })

    it('should delete user as admin', async () => {
      const target = await createTestUser('todelete@test.com', 'password123', 2, prisma, hashingService, tokenService)

      await request(app.getHttpServer())
        .delete(`/users/${target.userId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200)

      const deleted = await prisma.user.findFirst({ where: { id: target.userId, deletedAt: null } })
      expect(deleted).toBeNull()
    })

    it('should reject client creating users', async () => {
      await request(app.getHttpServer())
        .post('/users')
        .set('Authorization', `Bearer ${clientToken}`)
        .send({
          email: 'forbidden@test.com',
          name: 'Forbidden',
          phoneNumber: '0999888777',
          password: 'password123',
          roleId: 2,
          status: 'ACTIVE',
          avatar: null,
        })
        .expect(403)
    })
  })

  describe('Role CRUD', () => {
    it('should list roles as admin', async () => {
      const res = await request(app.getHttpServer())
        .get('/roles')
        .set('Authorization', `Bearer ${adminToken}`)
        .query({ page: 1, limit: 10 })
        .expect(200)

      expect(res.body).toHaveProperty('data')
      expect(res.body.data.length).toBeGreaterThanOrEqual(3) // ADMIN, CLIENT, SELLER
    })

    it('should create a new role as admin', async () => {
      const res = await request(app.getHttpServer())
        .post('/roles')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'MODERATOR', description: 'Moderator role', isActive: true })
        .expect(201)

      expect(res.body).toHaveProperty('id')
      expect(res.body.name).toBe('MODERATOR')
    })

    it('should get role detail with permissions', async () => {
      const res = await request(app.getHttpServer())
        .get('/roles/1')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200)

      expect(res.body).toHaveProperty('id', 1)
      expect(res.body).toHaveProperty('name', 'ADMIN')
      expect(res.body).toHaveProperty('permissions')
      expect(Array.isArray(res.body.permissions)).toBe(true)
    })

    it('should update role with permissions', async () => {
      const perms = await prisma.permission.findMany({ take: 2, select: { id: true } })

      const res = await request(app.getHttpServer())
        .put('/roles/2')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'CLIENT',
          description: 'Updated client role',
          isActive: true,
          permissionIds: perms.map((p) => p.id),
        })
        .expect(200)

      expect(res.body.description).toBe('Updated client role')
    })

    it('should delete role as admin', async () => {
      const newRole = await prisma.role.create({
        data: { name: 'TEMP_ROLE', description: 'Temporary', isActive: true },
      })

      await request(app.getHttpServer())
        .delete(`/roles/${newRole.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200)
    })
  })
  describe('Permission CRUD', () => {
    it('should list permissions as admin', async () => {
      const res = await request(app.getHttpServer())
        .get('/permissions')
        .set('Authorization', `Bearer ${adminToken}`)
        .query({ page: 1, limit: 10 })
        .expect(200)

      expect(res.body).toHaveProperty('data')
      expect(res.body).toHaveProperty('totalItems')
      expect(res.body.data.length).toBeGreaterThan(0)
    })

    it('should create a new permission as admin', async () => {
      const res = await request(app.getHttpServer())
        .post('/permissions')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'test.custom',
          path: '/test/custom',
          method: 'GET',
          description: 'Custom test permission',
          module: 'TEST',
        })
        .expect(201)

      expect(res.body).toHaveProperty('id')
      expect(res.body.name).toBe('test.custom')
    })

    it('should get permission detail', async () => {
      const perm = await prisma.permission.findFirst()

      const res = await request(app.getHttpServer())
        .get(`/permissions/${perm!.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200)

      expect(res.body).toHaveProperty('id', perm!.id)
      expect(res.body).toHaveProperty('name')
      expect(res.body).toHaveProperty('path')
      expect(res.body).toHaveProperty('method')
    })

    it('should update permission as admin', async () => {
      const perm = await prisma.permission.create({
        data: { name: 'temp.perm', path: '/temp', method: 'GET', module: 'TEMP' },
      })

      const res = await request(app.getHttpServer())
        .put(`/permissions/${perm.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'temp.perm.updated',
          path: '/temp/updated',
          method: 'POST',
          description: 'Updated',
          module: 'TEMP',
        })
        .expect(200)

      expect(res.body.name).toBe('temp.perm.updated')
    })

    it('should delete permission as admin', async () => {
      const perm = await prisma.permission.create({
        data: { name: 'to.delete', path: '/delete', method: 'DELETE', module: 'TEMP' },
      })

      await request(app.getHttpServer())
        .delete(`/permissions/${perm.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200)
    })

    it('should reject client accessing admin endpoints', async () => {
      await request(app.getHttpServer())
        .get('/roles')
        .set('Authorization', `Bearer ${clientToken}`)
        .query({ page: 1, limit: 10 })
        .expect(403)

      await request(app.getHttpServer())
        .get('/permissions')
        .set('Authorization', `Bearer ${clientToken}`)
        .query({ page: 1, limit: 10 })
        .expect(403)
    })
  })
})
