import { CACHE_MANAGER } from '@nestjs/cache-manager'
import { INestApplication } from '@nestjs/common'
import { Test, TestingModule } from '@nestjs/testing'
import request from 'supertest'
import { AppModule } from '../../src/app.module'
import { EmailService } from '../../src/shared/services/email.service'
import { HashingService } from '../../src/shared/services/hashing.service'
import { PrismaService } from '../../src/shared/services/prisma.service'
import { resetDatabase } from '../helpers/test-helpers'

describe('User Integration Tests', () => {
  let app: INestApplication
  let prisma: PrismaService
  let hashingService: HashingService
  let adminAccessToken: string
  let adminUserId: number
  let clientAccessToken: string
  let clientUserId: number

  // Mock EmailService
  const mockEmailService = {
    sendEmail: jest.fn().mockResolvedValue(undefined),
    sendOTP: jest.fn().mockResolvedValue(undefined),
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
      .useValue({
        get: jest.fn().mockResolvedValue(null),
        set: jest.fn().mockResolvedValue(undefined),
        del: jest.fn().mockResolvedValue(undefined),
      })
      .compile()

    app = moduleFixture.createNestApplication()
    prisma = moduleFixture.get<PrismaService>(PrismaService)
    hashingService = moduleFixture.get<HashingService>(HashingService)

    await app.init()
  })

  beforeEach(async () => {
    await resetDatabase()

    // Create ADMIN user
    const hashedPassword = await hashingService.hash('admin123')
    const adminUser = await prisma.user.create({
      data: {
        email: 'admin@test.com',
        name: 'Admin User',
        phoneNumber: '0123456789',
        password: hashedPassword,
        roleId: 1, // ADMIN role
        status: 'ACTIVE',
      },
    })
    adminUserId = adminUser.id

    // Create device for admin
    const adminDevice = await prisma.device.create({
      data: {
        userId: adminUserId,
        userAgent: 'admin-test-agent',
        ip: '127.0.0.1',
        isActive: true,
      },
    })

    // Login admin to get access token
    const adminLoginResponse = await request(app.getHttpServer())
      .post('/auth/login')
      .send({
        email: 'admin@test.com',
        password: 'admin123',
      })
      .set('User-Agent', 'admin-test-agent')

    adminAccessToken = adminLoginResponse.body.accessToken

    // Create CLIENT user
    const clientHashedPassword = await hashingService.hash('client123')
    const clientUser = await prisma.user.create({
      data: {
        email: 'client@test.com',
        name: 'Client User',
        phoneNumber: '0987654321',
        password: clientHashedPassword,
        roleId: 2, // CLIENT role
        status: 'ACTIVE',
      },
    })
    clientUserId = clientUser.id

    // Create device for client
    const clientDevice = await prisma.device.create({
      data: {
        userId: clientUserId,
        userAgent: 'client-test-agent',
        ip: '127.0.0.1',
        isActive: true,
      },
    })

    // Login client to get access token
    const clientLoginResponse = await request(app.getHttpServer())
      .post('/auth/login')
      .send({
        email: 'client@test.com',
        password: 'client123',
      })
      .set('User-Agent', 'client-test-agent')

    clientAccessToken = clientLoginResponse.body.accessToken
  })

  afterAll(async () => {
    await app.close()
  })

  describe('User List Tests', () => {
    it('should get user list successfully with default pagination', async () => {
      const response = await request(app.getHttpServer())
        .get('/users')
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
      expect(response.body.data[0]).toHaveProperty('id')
      expect(response.body.data[0]).toHaveProperty('email')
      expect(response.body.data[0]).toHaveProperty('name')
      expect(response.body.data[0]).toHaveProperty('role')
      expect(response.body.data[0]).not.toHaveProperty('password')
      expect(response.body.data[0]).not.toHaveProperty('totpSecret')
    })

    it('should handle pagination correctly', async () => {
      // Create additional users
      for (let i = 1; i <= 15; i++) {
        await prisma.user.create({
          data: {
            email: `user${i}@test.com`,
            name: `User ${i}`,
            phoneNumber: `012345678${i}`,
            password: await hashingService.hash('password123'),
            roleId: 2,
            status: 'ACTIVE',
          },
        })
      }

      // Get page 1 with limit 5
      const page1Response = await request(app.getHttpServer())
        .get('/users?page=1&limit=5')
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .expect(200)

      expect(page1Response.body.data.length).toBe(5)
      expect(page1Response.body.page).toBe(1)
      expect(page1Response.body.limit).toBe(5)
      expect(page1Response.body.totalItems).toBeGreaterThanOrEqual(17) // 2 initial + 15 created

      // Get page 2 with limit 5
      const page2Response = await request(app.getHttpServer())
        .get('/users?page=2&limit=5')
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .expect(200)

      expect(page2Response.body.data.length).toBe(5)
      expect(page2Response.body.page).toBe(2)
    })
  })

  describe('User Detail Tests', () => {
    it('should get user detail successfully', async () => {
      const response = await request(app.getHttpServer())
        .get(`/users/${clientUserId}`)
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .expect(200)

      expect(response.body).toMatchObject({
        id: clientUserId,
        email: 'client@test.com',
        name: 'Client User',
        phoneNumber: '0987654321',
        status: 'ACTIVE',
        roleId: 2,
      })

      expect(response.body).toHaveProperty('role')
      expect(response.body.role).toHaveProperty('id')
      expect(response.body.role).toHaveProperty('name')
      expect(response.body.role).toHaveProperty('permissions')
      expect(response.body).not.toHaveProperty('password')
      expect(response.body).not.toHaveProperty('totpSecret')
    })

    it('should return 404 for non-existent user', async () => {
      const response = await request(app.getHttpServer())
        .get('/users/99999')
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .expect(404)

      expect(response.body.message).toBe('Error.NotFound')
    })
  })

  describe('Create User Tests', () => {
    it('should create user successfully', async () => {
      const newUser = {
        email: 'newuser@test.com',
        name: 'New User',
        phoneNumber: '0111222333',
        password: 'password123',
        avatar: null,
        status: 'ACTIVE',
        roleId: 2,
      }

      const response = await request(app.getHttpServer())
        .post('/users')
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .send(newUser)
        .expect(201)

      expect(response.body).toMatchObject({
        id: expect.any(Number),
        email: newUser.email,
        name: newUser.name,
        phoneNumber: newUser.phoneNumber,
        status: newUser.status,
        roleId: newUser.roleId,
      })

      expect(response.body).not.toHaveProperty('password')

      // Verify user was created in database
      const createdUser = await prisma.user.findUnique({
        where: { id: response.body.id },
      })

      expect(createdUser).toBeDefined()
      expect(createdUser?.email).toBe(newUser.email)
    })

    it('should validate required fields', async () => {
      const response = await request(app.getHttpServer())
        .post('/users')
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .send({
          email: 'test@test.com',
          // Missing required fields
        })
        .expect(422)

      // Validation errors are returned in response.body.message as array
      expect(Array.isArray(response.body.message)).toBe(true)
      expect(response.body.message.length).toBeGreaterThan(0)
    })

    it('should validate email format', async () => {
      const response = await request(app.getHttpServer())
        .post('/users')
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .send({
          email: 'invalid-email',
          name: 'Test User',
          phoneNumber: '0123456789',
          password: 'password123',
          avatar: null,
          status: 'ACTIVE',
          roleId: 2,
        })
        .expect(422)

      // Validation errors are returned in response.body.message as array
      expect(Array.isArray(response.body.message)).toBe(true)
      expect(response.body.message.length).toBeGreaterThan(0)
    })

    // TODO: Fix this test - unique constraint on email is not working in test environment
    // The partial unique index (WHERE deletedAt IS NULL) might not be properly set up in test DB
    it('should not allow duplicate email', async () => {
      // First create a user
      const firstUser = {
        email: 'duplicate-test@example.com',
        name: 'First User',
        phoneNumber: '0123456789',
        password: 'password123',
        avatar: 'https://example.com/avatar.jpg',
        status: 'ACTIVE' as const,
        roleId: 2,
      }

      await request(app.getHttpServer())
        .post('/users')
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .send(firstUser)
        .expect(201)

      // Try to create another user with same email
      const response = await request(app.getHttpServer())
        .post('/users')
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .send({
          ...firstUser,
          name: 'Duplicate User',
          phoneNumber: '0987654321',
        })
        .expect(422)

      // Validation errors are returned in response.body.message as array
      expect(Array.isArray(response.body.message)).toBe(true)
      expect(response.body.message.length).toBeGreaterThan(0)
      expect(response.body.message[0].message).toBe('Error.UserAlreadyExists')
    })

    it('should not allow non-admin to create admin user', async () => {
      // Create a SELLER user
      const sellerHashedPassword = await hashingService.hash('seller123')
      const sellerUser = await prisma.user.create({
        data: {
          email: 'seller@test.com',
          name: 'Seller User',
          phoneNumber: '0555666777',
          password: sellerHashedPassword,
          roleId: 3, // SELLER role
          status: 'ACTIVE',
        },
      })

      // Create device for seller
      await prisma.device.create({
        data: {
          userId: sellerUser.id,
          userAgent: 'seller-test-agent',
          ip: '127.0.0.1',
          isActive: true,
        },
      })

      // Login seller
      const sellerLoginResponse = await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          email: 'seller@test.com',
          password: 'seller123',
        })
        .set('User-Agent', 'seller-test-agent')

      const sellerAccessToken = sellerLoginResponse.body.accessToken

      // Try to create admin user as seller - should fail with permission denied
      // because SELLER doesn't have 'users.create' permission
      const response = await request(app.getHttpServer())
        .post('/users')
        .set('Authorization', `Bearer ${sellerAccessToken}`)
        .send({
          email: 'newadmin@test.com',
          name: 'New Admin',
          phoneNumber: '0888999000',
          password: 'password123',
          avatar: null,
          status: 'ACTIVE',
          roleId: 1, // ADMIN role
        })
        .expect(403)

      // SELLER user doesn't have permission to create users at all
      expect(response.body.message).toBe('Error.PermissionDenied')
    })

    it('should return 422 for invalid roleId', async () => {
      const response = await request(app.getHttpServer())
        .post('/users')
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .send({
          email: 'newuser@test.com',
          name: 'New User',
          phoneNumber: '0111222333',
          password: 'password123',
          avatar: null,
          status: 'ACTIVE',
          roleId: 99999, // Non-existent role
        })
        .expect(422)

      // Validation errors are returned in response.body.message as array
      expect(Array.isArray(response.body.message)).toBe(true)
      expect(response.body.message.length).toBeGreaterThan(0)
      expect(response.body.message[0].message).toBe('Error.RoleNotFound')
    })
  })

  describe('Update User Tests', () => {
    it('should update user successfully', async () => {
      const updateData = {
        email: 'client@test.com',
        name: 'Updated Client Name',
        phoneNumber: '0999888777',
        password: 'newpassword123',
        avatar: 'https://example.com/avatar.png',
        status: 'ACTIVE',
        roleId: 2,
      }

      const response = await request(app.getHttpServer())
        .put(`/users/${clientUserId}`)
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .send(updateData)
        .expect(200)

      expect(response.body).toMatchObject({
        id: clientUserId,
        name: updateData.name,
        phoneNumber: updateData.phoneNumber,
        avatar: updateData.avatar,
      })

      // Verify update in database
      const updatedUser = await prisma.user.findUnique({
        where: { id: clientUserId },
      })

      expect(updatedUser?.name).toBe(updateData.name)
      expect(updatedUser?.phoneNumber).toBe(updateData.phoneNumber)
    })

    it('should not allow user to update themselves', async () => {
      const response = await request(app.getHttpServer())
        .put(`/users/${adminUserId}`)
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .send({
          email: 'admin@test.com',
          name: 'Updated Admin Name',
          phoneNumber: '0123456789',
          password: 'newpassword123',
          avatar: null,
          status: 'ACTIVE',
          roleId: 1,
        })
        .expect(403)

      expect(response.body.message).toBe('Error.CannotUpdateOrDeleteYourself')
    })

    it('should return 404 for non-existent user', async () => {
      const response = await request(app.getHttpServer())
        .put('/users/99999')
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .send({
          email: 'test@test.com',
          name: 'Test User',
          phoneNumber: '0123456789',
          password: 'password123',
          avatar: null,
          status: 'ACTIVE',
          roleId: 2,
        })
        .expect(404)

      expect(response.body.message).toBe('Error.NotFound')
    })

    it('should validate update data', async () => {
      const response = await request(app.getHttpServer())
        .put(`/users/${clientUserId}`)
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .send({
          email: 'invalid-email',
          name: 'Test',
          phoneNumber: '123', // Too short
          password: 'pass', // Too short
          avatar: null,
          status: 'ACTIVE',
          roleId: 2,
        })
        .expect(422)

      // Validation errors are returned in response.body.message as array
      expect(Array.isArray(response.body.message)).toBe(true)
      expect(response.body.message.length).toBeGreaterThan(0)
    })
  })

  describe('Delete User Tests', () => {
    it('should delete user successfully (soft delete)', async () => {
      const response = await request(app.getHttpServer())
        .delete(`/users/${clientUserId}`)
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .expect(200)

      expect(response.body.message).toBe('User deleted successfully')

      // Verify soft delete in database
      const deletedUser = await prisma.user.findUnique({
        where: { id: clientUserId },
      })

      expect(deletedUser?.deletedAt).not.toBeNull()
      expect(deletedUser?.deletedById).toBe(adminUserId)
    })

    it('should not allow user to delete themselves', async () => {
      const response = await request(app.getHttpServer())
        .delete(`/users/${adminUserId}`)
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .expect(403)

      expect(response.body.message).toBe('Error.CannotUpdateOrDeleteYourself')
    })

    it('should return 404 for non-existent user', async () => {
      const response = await request(app.getHttpServer())
        .delete('/users/99999')
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .expect(404)

      expect(response.body.message).toBe('Error.NotFound')
    })
  })

  describe('Authentication Tests', () => {
    it('should require authentication for all user endpoints', async () => {
      // GET /users
      await request(app.getHttpServer()).get('/users').expect(401)

      // GET /users/:userId
      await request(app.getHttpServer()).get(`/users/${clientUserId}`).expect(401)

      // POST /users
      await request(app.getHttpServer())
        .post('/users')
        .send({
          email: 'test@test.com',
          name: 'Test',
          phoneNumber: '0123456789',
          password: 'password123',
          avatar: null,
          status: 'ACTIVE',
          roleId: 2,
        })
        .expect(401)

      // PUT /users/:userId
      await request(app.getHttpServer())
        .put(`/users/${clientUserId}`)
        .send({
          email: 'test@test.com',
          name: 'Test',
          phoneNumber: '0123456789',
          password: 'password123',
          avatar: null,
          status: 'ACTIVE',
          roleId: 2,
        })
        .expect(401)

      // DELETE /users/:userId
      await request(app.getHttpServer()).delete(`/users/${clientUserId}`).expect(401)
    })
  })
})
