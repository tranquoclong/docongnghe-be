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

describe('Chat Flow E2E', () => {
  let app: INestApplication
  let prisma: PrismaService
  let hashingService: HashingService
  let tokenService: TokenService
  let user1Token: string
  let user2Token: string
  let user1Id: number
  let user2Id: number

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
    const u1 = await createTestUser('user1@test.com', 'password123', 2, prisma, hashingService, tokenService)
    user1Token = u1.accessToken
    user1Id = u1.userId
    const u2 = await createTestUser('user2@test.com', 'password123', 2, prisma, hashingService, tokenService)
    user2Token = u2.accessToken
    user2Id = u2.userId
  })

  describe('Direct Conversation Flow', () => {
    it('should create a direct conversation', async () => {
      const res = await request(app.getHttpServer())
        .post('/conversations/direct')
        .set('Authorization', `Bearer ${user1Token}`)
        .send({ recipientId: user2Id })
        .expect(201)

      expect(res.body).toHaveProperty('id')
      expect(res.body).toHaveProperty('type', 'DIRECT')
    })

    it('should send a message in conversation', async () => {
      // Create conversation first
      const convRes = await request(app.getHttpServer())
        .post('/conversations/direct')
        .set('Authorization', `Bearer ${user1Token}`)
        .send({ recipientId: user2Id })
        .expect(201)

      const conversationId = convRes.body.id

      // Send message
      const msgRes = await request(app.getHttpServer())
        .post('/conversations/messages')
        .set('Authorization', `Bearer ${user1Token}`)
        .send({ conversationId, content: 'Hello there!', type: 'TEXT' })
        .expect(201)

      expect(msgRes.body).toHaveProperty('id')
      expect(msgRes.body.content).toBe('Hello there!')
    })

    it('should retrieve messages from conversation', async () => {
      const convRes = await request(app.getHttpServer())
        .post('/conversations/direct')
        .set('Authorization', `Bearer ${user1Token}`)
        .send({ recipientId: user2Id })
        .expect(201)

      const conversationId = convRes.body.id

      // Send a few messages
      await request(app.getHttpServer())
        .post('/conversations/messages')
        .set('Authorization', `Bearer ${user1Token}`)
        .send({ conversationId, content: 'Message 1', type: 'TEXT' })
        .expect(201)

      await request(app.getHttpServer())
        .post('/conversations/messages')
        .set('Authorization', `Bearer ${user2Token}`)
        .send({ conversationId, content: 'Message 2', type: 'TEXT' })
        .expect(201)

      // Retrieve messages
      const msgsRes = await request(app.getHttpServer())
        .get(`/conversations/${conversationId}/messages`)
        .set('Authorization', `Bearer ${user1Token}`)
        .query({ limit: 20 })
        .expect(200)

      expect(msgsRes.body).toHaveProperty('data')
      expect(msgsRes.body.data.length).toBeGreaterThanOrEqual(2)
    })

    it('should list user conversations', async () => {
      await request(app.getHttpServer())
        .post('/conversations/direct')
        .set('Authorization', `Bearer ${user1Token}`)
        .send({ recipientId: user2Id })
        .expect(201)

      const res = await request(app.getHttpServer())
        .get('/conversations')
        .set('Authorization', `Bearer ${user1Token}`)
        .query({ page: 1, limit: 10 })
        .expect(200)

      expect(res.body).toHaveProperty('data')
      expect(res.body.data.length).toBeGreaterThanOrEqual(1)
    })
  })
  describe('Group Conversation Flow', () => {
    it('should create a group conversation', async () => {
      const user3 = await createTestUser('user3@test.com', 'password123', 2, prisma, hashingService, tokenService)

      const res = await request(app.getHttpServer())
        .post('/conversations/group')
        .set('Authorization', `Bearer ${user1Token}`)
        .send({
          name: 'Test Group',
          memberIds: [user2Id, user3.userId],
        })
        .expect(201)

      expect(res.body).toHaveProperty('id')
      expect(res.body).toHaveProperty('type', 'GROUP')
      expect(res.body).toHaveProperty('name', 'Test Group')
    })

    it('should send and retrieve messages in group', async () => {
      const convRes = await request(app.getHttpServer())
        .post('/conversations/group')
        .set('Authorization', `Bearer ${user1Token}`)
        .send({ name: 'Chat Group', memberIds: [user2Id] })
        .expect(201)

      const conversationId = convRes.body.id

      await request(app.getHttpServer())
        .post('/conversations/messages')
        .set('Authorization', `Bearer ${user1Token}`)
        .send({ conversationId, content: 'Group message!', type: 'TEXT' })
        .expect(201)

      const msgsRes = await request(app.getHttpServer())
        .get(`/conversations/${conversationId}/messages`)
        .set('Authorization', `Bearer ${user2Token}`)
        .query({ limit: 20 })
        .expect(200)

      expect(msgsRes.body.data.length).toBeGreaterThanOrEqual(1)
    })
  })

  describe('Unauthenticated Restrictions', () => {
    it('should reject conversation operations without auth', async () => {
      await request(app.getHttpServer()).get('/conversations').query({ page: 1, limit: 10 }).expect(401)

      await request(app.getHttpServer()).post('/conversations/direct').send({ recipientId: user2Id }).expect(401)

      await request(app.getHttpServer())
        .post('/conversations/messages')
        .send({ conversationId: 'fake', content: 'test', type: 'TEXT' })
        .expect(401)
    })
  })
})
