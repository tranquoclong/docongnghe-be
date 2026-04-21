import { CACHE_MANAGER } from '@nestjs/cache-manager'
import { INestApplication } from '@nestjs/common'
import { Test, TestingModule } from '@nestjs/testing'
import request from 'supertest'
import { AppModule } from '../../src/app.module'
import { EmailService } from '../../src/shared/services/email.service'
import { HashingService } from '../../src/shared/services/hashing.service'
import { PrismaService } from '../../src/shared/services/prisma.service'
import { resetDatabase } from '../helpers/test-helpers'

describe('Profile Integration Tests', () => {
  let app: INestApplication
  let prisma: PrismaService
  let hashingService: HashingService
  let clientAccessToken: string
  let clientUserId: number

  // Mock EmailService
  const mockEmailService = {
    sendOTP: jest.fn().mockResolvedValue({
      data: { id: 'test-email-id' },
      error: null,
    }),
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

    // Create a client user for testing
    const hashedPassword = await hashingService.hash('password123')
    const clientRole = await prisma.role.findFirst({
      where: { name: 'CLIENT' },
    })

    const clientUser = await prisma.user.create({
      data: {
        email: 'client@test.com',
        name: 'Client User',
        phoneNumber: '0123456789',
        password: hashedPassword,
        status: 'ACTIVE',
        roleId: clientRole!.id,
      },
    })

    clientUserId = clientUser.id

    // Login to get access token
    const loginResponse = await request(app.getHttpServer())
      .post('/auth/login')
      .send({
        email: 'client@test.com',
        password: 'password123',
      })
      .set('User-Agent', 'test-agent')
      .expect(201)

    clientAccessToken = loginResponse.body.accessToken
  })

  afterAll(async () => {
    await app.close()
  })

  describe('GET /profile - Get Profile', () => {
    it('should get current user profile successfully', async () => {
      const response = await request(app.getHttpServer())
        .get('/profile')
        .set('Authorization', `Bearer ${clientAccessToken}`)
        .expect(200)

      expect(response.body).toMatchObject({
        id: clientUserId,
        email: 'client@test.com',
        name: 'Client User',
        phoneNumber: '0123456789',
        status: 'ACTIVE',
        role: {
          id: expect.any(Number),
          name: 'CLIENT',
          permissions: expect.any(Array),
        },
      })

      // Should not include password and totpSecret
      expect(response.body.password).toBeUndefined()
      expect(response.body.totpSecret).toBeUndefined()
    })

    it('should return 401 when not authenticated', async () => {
      await request(app.getHttpServer()).get('/profile').expect(401)
    })

    it('should return 401 with invalid token', async () => {
      await request(app.getHttpServer()).get('/profile').set('Authorization', 'Bearer invalid-token').expect(401)
    })
  })

  describe('PUT /profile - Update Profile', () => {
    it('should update profile successfully', async () => {
      const updateData = {
        name: 'Updated Name',
        phoneNumber: '0987654321',
        avatar: 'https://example.com/new-avatar.jpg',
      }

      const response = await request(app.getHttpServer())
        .put('/profile')
        .set('Authorization', `Bearer ${clientAccessToken}`)
        .send(updateData)
        .expect(200)

      expect(response.body).toMatchObject({
        id: clientUserId,
        email: 'client@test.com',
        name: 'Updated Name',
        phoneNumber: '0987654321',
        avatar: 'https://example.com/new-avatar.jpg',
      })

      // Verify in database
      const updatedUser = await prisma.user.findUnique({
        where: { id: clientUserId },
      })

      expect(updatedUser).toMatchObject({
        name: 'Updated Name',
        phoneNumber: '0987654321',
        avatar: 'https://example.com/new-avatar.jpg',
      })
    })

    it('should update only name', async () => {
      const response = await request(app.getHttpServer())
        .put('/profile')
        .set('Authorization', `Bearer ${clientAccessToken}`)
        .send({
          name: 'Only Name Updated',
          phoneNumber: '0123456789',
        })
        .expect(200)

      expect(response.body.name).toBe('Only Name Updated')
    })

    it('should validate required fields', async () => {
      const response = await request(app.getHttpServer())
        .put('/profile')
        .set('Authorization', `Bearer ${clientAccessToken}`)
        .send({
          name: '',
          phoneNumber: '0123456789',
        })
        .expect(422)

      expect(response.body.message).toBeDefined()
    })

    it('should validate phone number format', async () => {
      const response = await request(app.getHttpServer())
        .put('/profile')
        .set('Authorization', `Bearer ${clientAccessToken}`)
        .send({
          name: 'Test User',
          phoneNumber: '123', // Too short
        })
        .expect(422)

      expect(response.body.message).toBeDefined()
    })

    it('should not allow updating email', async () => {
      const response = await request(app.getHttpServer())
        .put('/profile')
        .set('Authorization', `Bearer ${clientAccessToken}`)
        .send({
          name: 'Test User',
          phoneNumber: '0123456789',
          email: 'newemail@test.com', // Should be ignored
        })
        .expect(422)

      // Strict mode should reject extra fields
      expect(response.body.message).toBeDefined()
    })

    it('should return 401 when not authenticated', async () => {
      await request(app.getHttpServer())
        .put('/profile')
        .send({
          name: 'Test User',
          phoneNumber: '0123456789',
        })
        .expect(401)
    })
  })

  describe('PUT /profile/change-password - Change Password', () => {
    it('should change password successfully', async () => {
      const response = await request(app.getHttpServer())
        .put('/profile/change-password')
        .set('Authorization', `Bearer ${clientAccessToken}`)
        .send({
          password: 'password123',
          newPassword: 'newPassword123',
          confirmNewPassword: 'newPassword123',
        })
        .expect(200)

      expect(response.body.message).toBe('Password changed successfully')

      // Verify can login with new password
      const loginResponse = await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          email: 'client@test.com',
          password: 'newPassword123',
        })
        .set('User-Agent', 'test-agent')
        .expect(201)

      expect(loginResponse.body.accessToken).toBeDefined()
    })

    it('should not login with old password after change', async () => {
      // Change password
      await request(app.getHttpServer())
        .put('/profile/change-password')
        .set('Authorization', `Bearer ${clientAccessToken}`)
        .send({
          password: 'password123',
          newPassword: 'newPassword123',
          confirmNewPassword: 'newPassword123',
        })
        .expect(200)

      // Try to login with old password
      await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          email: 'client@test.com',
          password: 'password123',
        })
        .set('User-Agent', 'test-agent')
        .expect(422)
    })

    it('should reject wrong current password', async () => {
      const response = await request(app.getHttpServer())
        .put('/profile/change-password')
        .set('Authorization', `Bearer ${clientAccessToken}`)
        .send({
          password: 'wrongPassword',
          newPassword: 'newPassword123',
          confirmNewPassword: 'newPassword123',
        })
        .expect(422)

      expect(response.body.message).toBeDefined()
    })

    it('should reject when new password does not match confirm password', async () => {
      const response = await request(app.getHttpServer())
        .put('/profile/change-password')
        .set('Authorization', `Bearer ${clientAccessToken}`)
        .send({
          password: 'password123',
          newPassword: 'newPassword123',
          confirmNewPassword: 'differentPassword',
        })
        .expect(422)

      expect(response.body.message).toBeDefined()
    })

    it('should reject when new password is same as current password', async () => {
      const response = await request(app.getHttpServer())
        .put('/profile/change-password')
        .set('Authorization', `Bearer ${clientAccessToken}`)
        .send({
          password: 'password123',
          newPassword: 'password123',
          confirmNewPassword: 'password123',
        })
        .expect(422)

      expect(response.body.message).toBeDefined()
    })

    it('should validate password length', async () => {
      const response = await request(app.getHttpServer())
        .put('/profile/change-password')
        .set('Authorization', `Bearer ${clientAccessToken}`)
        .send({
          password: 'password123',
          newPassword: '123', // Too short
          confirmNewPassword: '123',
        })
        .expect(422)

      expect(response.body.message).toBeDefined()
    })

    it('should return 401 when not authenticated', async () => {
      await request(app.getHttpServer())
        .put('/profile/change-password')
        .send({
          password: 'password123',
          newPassword: 'newPassword123',
          confirmNewPassword: 'newPassword123',
        })
        .expect(401)
    })
  })
})
