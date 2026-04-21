import { CACHE_MANAGER } from '@nestjs/cache-manager'
import { INestApplication } from '@nestjs/common'
import { Test, TestingModule } from '@nestjs/testing'
import request from 'supertest'
import { AppModule } from '../../src/app.module'
import { EmailService } from '../../src/shared/services/email.service'
import { PrismaService } from '../../src/shared/services/prisma.service'
import { resetDatabase } from '../helpers/test-helpers'

/**
 * AI ASSISTANT INTEGRATION TESTS
 *
 * Test Coverage:
 * - Create conversations
 * - Get conversations list
 * - Get conversation details
 * - Send messages
 * - Archive conversations
 * - Delete conversations
 * - Search messages
 * - Get user stats
 * - Test AI assistant (public endpoint)
 */
describe('AI Assistant Integration Tests', () => {
  let app: INestApplication
  let prisma: PrismaService
  let accessToken: string
  let testUserId: number
  let testConversationId: string

  // Mock EmailService
  const mockEmailService = {
    sendEmail: jest.fn().mockResolvedValue(undefined),
    sendOTP: jest.fn().mockResolvedValue(undefined),
  }

  // Mock Cache Manager
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

    await app.init()
  })

  beforeEach(async () => {
    await resetDatabase()

    // Create test user and login
    const testUser = {
      email: 'ai-test@example.com',
      name: 'AI Test User',
      phoneNumber: '0123456789',
      password: 'password123',
      confirmPassword: 'password123',
    }

    // Send OTP
    await request(app.getHttpServer()).post('/auth/otp').send({
      email: testUser.email,
      type: 'REGISTER',
    })

    // Register
    const registerResponse = await request(app.getHttpServer()).post('/auth/register').send(testUser)

    testUserId = registerResponse.body.data.userId

    // Login
    const loginResponse = await request(app.getHttpServer()).post('/auth/login').send({
      email: testUser.email,
      password: testUser.password,
    })

    accessToken = loginResponse.body.data.accessToken

    // Create a test conversation
    const conversationResponse = await request(app.getHttpServer())
      .post('/ai-assistant/conversations')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        context: { source: 'test' },
      })

    testConversationId = conversationResponse.body.data.id
  })

  afterAll(async () => {
    await app.close()
  })

  // ===== POST /ai-assistant/conversations - Create Conversation =====
  describe('POST /ai-assistant/conversations - Create Conversation', () => {
    it('should create conversation successfully', async () => {
      const response = await request(app.getHttpServer())
        .post('/ai-assistant/conversations')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          context: { source: 'integration-test', userIntent: 'shopping' },
        })
        .expect(201)

      expect(response.body.success).toBe(true)
      expect(response.body.data).toHaveProperty('id')
      expect(response.body.data.userId).toBe(testUserId)
      expect(response.body.data.isActive).toBe(true)
      expect(response.body.data.isArchived).toBe(false)
    })

    it('should create conversation without context', async () => {
      const response = await request(app.getHttpServer())
        .post('/ai-assistant/conversations')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({})
        .expect(201)

      expect(response.body.success).toBe(true)
      expect(response.body.data).toHaveProperty('id')
    })

    it('should return 401 when not authenticated', async () => {
      await request(app.getHttpServer()).post('/ai-assistant/conversations').send({}).expect(401)
    })
  })

  // ===== GET /ai-assistant/conversations - Get Conversations =====
  describe('GET /ai-assistant/conversations - Get Conversations', () => {
    it('should get user conversations successfully', async () => {
      const response = await request(app.getHttpServer())
        .get('/ai-assistant/conversations')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200)

      expect(response.body.success).toBe(true)
      expect(response.body.data).toHaveProperty('conversations')
      expect(response.body.data).toHaveProperty('pagination')
      expect(Array.isArray(response.body.data.conversations)).toBe(true)
      expect(response.body.data.conversations.length).toBeGreaterThan(0)
    })

    it('should support pagination', async () => {
      const response = await request(app.getHttpServer())
        .get('/ai-assistant/conversations?page=1&limit=5')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200)

      expect(response.body.data.pagination.page).toBe(1)
      expect(response.body.data.pagination.limit).toBe(5)
    })

    it('should return 401 when not authenticated', async () => {
      await request(app.getHttpServer()).get('/ai-assistant/conversations').expect(401)
    })
  })

  // ===== GET /ai-assistant/conversations/:id - Get Conversation Details =====
  describe('GET /ai-assistant/conversations/:id - Get Conversation Details', () => {
    it('should get conversation details successfully', async () => {
      const response = await request(app.getHttpServer())
        .get(`/ai-assistant/conversations/${testConversationId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200)

      expect(response.body.success).toBe(true)
      expect(response.body.data.id).toBe(testConversationId)
      expect(response.body.data.userId).toBe(testUserId)
    })

    it('should return error for non-existent conversation', async () => {
      const response = await request(app.getHttpServer())
        .get('/ai-assistant/conversations/non-existent-id')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200)

      expect(response.body.success).toBe(false)
    })

    it('should return 401 when not authenticated', async () => {
      await request(app.getHttpServer()).get(`/ai-assistant/conversations/${testConversationId}`).expect(401)
    })
  })

  // ===== POST /ai-assistant/conversations/:id/messages - Send Message =====
  describe('POST /ai-assistant/conversations/:id/messages - Send Message', () => {
    it('should send message successfully', async () => {
      const response = await request(app.getHttpServer())
        .post(`/ai-assistant/conversations/${testConversationId}/messages`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          message: 'Hello AI, can you help me find a laptop?',
        })
        .expect(201)

      expect(response.body.success).toBe(true)
      expect(response.body.data).toHaveProperty('userMessage')
      expect(response.body.data).toHaveProperty('aiMessage')
      expect(response.body.data).toHaveProperty('responseTime')
      expect(response.body.data.userMessage.content).toBe('Hello AI, can you help me find a laptop?')
      expect(response.body.data.aiMessage.role).toBe('ASSISTANT')
    })

    it('should validate message length', async () => {
      const response = await request(app.getHttpServer())
        .post(`/ai-assistant/conversations/${testConversationId}/messages`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          message: '',
        })
        .expect(422)

      expect(response.body.success).toBe(false)
    })

    it('should validate message max length', async () => {
      const longMessage = 'a'.repeat(2001)
      const response = await request(app.getHttpServer())
        .post(`/ai-assistant/conversations/${testConversationId}/messages`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          message: longMessage,
        })
        .expect(422)

      expect(response.body.success).toBe(false)
    })

    it('should return error for non-existent conversation', async () => {
      const response = await request(app.getHttpServer())
        .post('/ai-assistant/conversations/non-existent-id/messages')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          message: 'Hello',
        })
        .expect(201)

      expect(response.body.success).toBe(false)
    })

    it('should return 401 when not authenticated', async () => {
      await request(app.getHttpServer())
        .post(`/ai-assistant/conversations/${testConversationId}/messages`)
        .send({
          message: 'Hello',
        })
        .expect(401)
    })
  })

  // ===== PATCH /ai-assistant/conversations/:id/archive - Archive Conversation =====
  describe('PATCH /ai-assistant/conversations/:id/archive - Archive Conversation', () => {
    it('should archive conversation successfully', async () => {
      const response = await request(app.getHttpServer())
        .patch(`/ai-assistant/conversations/${testConversationId}/archive`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200)

      expect(response.body.success).toBe(true)
      expect(response.body.data.isArchived).toBe(true)
    })

    it('should return error for non-existent conversation', async () => {
      const response = await request(app.getHttpServer())
        .patch('/ai-assistant/conversations/non-existent-id/archive')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200)

      expect(response.body.success).toBe(false)
    })

    it('should return 401 when not authenticated', async () => {
      await request(app.getHttpServer()).patch(`/ai-assistant/conversations/${testConversationId}/archive`).expect(401)
    })
  })

  // ===== DELETE /ai-assistant/conversations/:id - Delete Conversation =====
  describe('DELETE /ai-assistant/conversations/:id - Delete Conversation', () => {
    it('should delete conversation successfully', async () => {
      const response = await request(app.getHttpServer())
        .delete(`/ai-assistant/conversations/${testConversationId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200)

      expect(response.body.success).toBe(true)
    })

    it('should return error for non-existent conversation', async () => {
      const response = await request(app.getHttpServer())
        .delete('/ai-assistant/conversations/non-existent-id')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200)

      expect(response.body.success).toBe(false)
    })

    it('should return 401 when not authenticated', async () => {
      await request(app.getHttpServer()).delete(`/ai-assistant/conversations/${testConversationId}`).expect(401)
    })
  })

  // ===== GET /ai-assistant/search - Search Messages =====
  describe('GET /ai-assistant/search - Search Messages', () => {
    beforeEach(async () => {
      // Send a message to have something to search
      await request(app.getHttpServer())
        .post(`/ai-assistant/conversations/${testConversationId}/messages`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          message: 'I want to buy a laptop for programming',
        })
    })

    it('should search messages successfully', async () => {
      const response = await request(app.getHttpServer())
        .get('/ai-assistant/search?q=laptop')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200)

      expect(response.body.success).toBe(true)
      expect(response.body.data).toHaveProperty('messages')
      expect(response.body.data).toHaveProperty('pagination')
    })

    it('should validate search query', async () => {
      const response = await request(app.getHttpServer())
        .get('/ai-assistant/search?q=')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(422)

      expect(response.body.success).toBe(false)
    })

    it('should return 401 when not authenticated', async () => {
      await request(app.getHttpServer()).get('/ai-assistant/search?q=laptop').expect(401)
    })
  })

  // ===== GET /ai-assistant/stats - Get User Stats =====
  describe('GET /ai-assistant/stats - Get User Stats', () => {
    it('should get user stats successfully', async () => {
      const response = await request(app.getHttpServer())
        .get('/ai-assistant/stats')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200)

      expect(response.body.success).toBe(true)
      expect(response.body.data).toHaveProperty('totalConversations')
      expect(response.body.data).toHaveProperty('totalMessages')
      expect(response.body.data).toHaveProperty('totalTokens')
      expect(response.body.data).toHaveProperty('avgResponseTime')
      expect(response.body.data).toHaveProperty('recentActivity')
    })

    it('should return 401 when not authenticated', async () => {
      await request(app.getHttpServer()).get('/ai-assistant/stats').expect(401)
    })
  })

  // ===== GET /ai-assistant/test - Test AI Assistant (Public) =====
  describe('GET /ai-assistant/test - Test AI Assistant', () => {
    it('should test AI assistant without authentication', async () => {
      const response = await request(app.getHttpServer()).get('/ai-assistant/test?message=Hello').expect(200)

      expect(response.body.success).toBe(true)
      expect(response.body.data).toHaveProperty('userMessage')
      expect(response.body.data).toHaveProperty('aiResponse')
      expect(response.body.data).toHaveProperty('timestamp')
      expect(response.body.data.userMessage).toBe('Hello')
    })

    it('should validate message parameter', async () => {
      const response = await request(app.getHttpServer()).get('/ai-assistant/test?message=').expect(422)

      expect(response.body.success).toBe(false)
    })
  })
})
