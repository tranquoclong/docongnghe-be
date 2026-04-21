import { CACHE_MANAGER } from '@nestjs/cache-manager'
import { INestApplication } from '@nestjs/common'
import { Test, TestingModule } from '@nestjs/testing'
import request from 'supertest'
import { AppModule } from '../../src/app.module'
import { PrismaService } from '../../src/shared/services/prisma.service'
import { resetDatabase } from '../helpers/test-helpers'

describe('Conversation Integration Tests', () => {
  let app: INestApplication
  let prisma: PrismaService

  // Test users
  let user1Id: number
  let user1Token: string
  let user2Id: number
  let user2Token: string
  let user3Id: number
  let user3Token: string

  // Mock cache manager (force database lookups)
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
    await app.init()
  })

  beforeEach(async () => {
    await resetDatabase()
    await setupTestUsers()
  })

  afterAll(async () => {
    await app.close()
  })

  // ===== HELPER FUNCTIONS =====

  async function setupTestUsers() {
    // Create user 1
    const user1Data = {
      email: 'user1@example.com',
      name: 'User One',
      phoneNumber: '0901234561',
      password: 'Password123!',
      confirmPassword: 'Password123!',
    }
    await createUserAndLogin(user1Data, 'user1-agent')
    const user1Login = await loginUser(user1Data.email, user1Data.password, 'user1-agent')
    user1Token = user1Login.accessToken
    user1Id = user1Login.userId

    // Create user 2
    const user2Data = {
      email: 'user2@example.com',
      name: 'User Two',
      phoneNumber: '0901234562',
      password: 'Password123!',
      confirmPassword: 'Password123!',
    }
    await createUserAndLogin(user2Data, 'user2-agent')
    const user2Login = await loginUser(user2Data.email, user2Data.password, 'user2-agent')
    user2Token = user2Login.accessToken
    user2Id = user2Login.userId

    // Create user 3
    const user3Data = {
      email: 'user3@example.com',
      name: 'User Three',
      phoneNumber: '0901234563',
      password: 'Password123!',
      confirmPassword: 'Password123!',
    }
    await createUserAndLogin(user3Data, 'user3-agent')
    const user3Login = await loginUser(user3Data.email, user3Data.password, 'user3-agent')
    user3Token = user3Login.accessToken
    user3Id = user3Login.userId
  }

  async function createUserAndLogin(userData: any, userAgent: string) {
    // Send OTP
    await request(app.getHttpServer()).post('/auth/otp').send({
      email: userData.email,
      type: 'REGISTER',
    })

    // Get OTP code
    const verificationCode = await prisma.verificationCode.findFirst({
      where: { email: userData.email, type: 'REGISTER' },
    })

    // Register user
    await request(app.getHttpServer())
      .post('/auth/register')
      .send({ ...userData, code: verificationCode?.code })

    // Activate user (set status to ACTIVE)
    const user = await prisma.user.findFirst({ where: { email: userData.email } })
    if (user) {
      await prisma.user.update({
        where: { id: user.id },
        data: { status: 'ACTIVE' },
      })
    }
  }

  async function loginUser(email: string, password: string, userAgent: string) {
    const loginResponse = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email, password })
      .set('User-Agent', userAgent)

    const user = await prisma.user.findFirst({ where: { email } })
    console.log(
      '[TEST] loginUser - email:',
      email,
      'userId:',
      user?.id,
      'status:',
      user?.status,
      'deletedAt:',
      user?.deletedAt,
    )
    return {
      accessToken: loginResponse.body.accessToken,
      userId: user!.id,
    }
  }

  function createDirectConversation(accessToken: string, recipientId: number) {
    return request(app.getHttpServer())
      .post('/conversations/direct')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ recipientId })
  }

  function createGroupConversation(accessToken: string, name: string, memberIds: number[], description?: string) {
    return request(app.getHttpServer())
      .post('/conversations/group')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ name, memberIds, description })
  }

  function sendMessage(accessToken: string, conversationId: string, content: string, type: string = 'TEXT') {
    return request(app.getHttpServer())
      .post('/conversations/messages')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ conversationId, content, type })
  }

  function getMessages(accessToken: string, conversationId: string, query: any = {}) {
    return request(app.getHttpServer())
      .get(`/conversations/${conversationId}/messages`)
      .set('Authorization', `Bearer ${accessToken}`)
      .query(query)
  }

  function searchMessages(accessToken: string, query: any) {
    return request(app.getHttpServer())
      .get('/conversations/messages/search')
      .set('Authorization', `Bearer ${accessToken}`)
      .query(query)
  }

  // ===== GROUP 1: DIRECT CONVERSATION FLOW =====

  describe('Direct Conversation Flow', () => {
    it('should create direct conversation successfully', async () => {
      // ACT: User1 creates direct conversation with User2
      const response = await createDirectConversation(user1Token, user2Id)

      // ASSERT: Response structure
      expect(response.status).toBe(201)
      expect(response.body).toMatchObject({
        id: expect.any(String),
        type: 'DIRECT',
        name: 'User Two', // For direct conversations, name is set to the other user's name
        description: null,
        avatar: null,
        ownerId: null,
        isArchived: false,
      })

      // ASSERT: Members
      expect(response.body.members).toHaveLength(2)
      const memberUserIds = response.body.members.map((m: any) => m.userId)
      expect(memberUserIds).toContain(user1Id)
      expect(memberUserIds).toContain(user2Id)

      // ASSERT: Database record
      const conversation = await prisma.conversation.findUnique({
        where: { id: response.body.id },
        include: { members: true },
      })
      expect(conversation).toBeTruthy()
      expect(conversation?.type).toBe('DIRECT')
      expect(conversation?.members).toHaveLength(2)
    })

    it('should return existing direct conversation if already exists', async () => {
      // ARRANGE: User1 creates conversation with User2
      const firstResponse = await createDirectConversation(user1Token, user2Id)
      const firstConversationId = firstResponse.body.id

      // ACT: User1 tries to create conversation with User2 again
      const secondResponse = await createDirectConversation(user1Token, user2Id)

      // ASSERT: Should return same conversation
      expect(secondResponse.status).toBe(201)
      expect(secondResponse.body.id).toBe(firstConversationId)

      // ASSERT: Only 1 conversation exists in database
      const conversations = await prisma.conversation.findMany({
        where: { type: 'DIRECT' },
      })
      expect(conversations).toHaveLength(1)
    })

    it('should reject creating direct conversation with self', async () => {
      // ACT: User1 tries to create conversation with self
      const response = await createDirectConversation(user1Token, user1Id)

      // ASSERT: Should reject
      expect(response.status).toBe(400)
      expect(response.body.message).toContain('Không thể tạo cuộc trò chuyện với chính mình')
    })

    it('should reject creating direct conversation with non-existent user', async () => {
      // ACT: User1 tries to create conversation with non-existent user
      const response = await createDirectConversation(user1Token, 99999)

      // ASSERT: Should reject
      expect(response.status).toBe(404)
      expect(response.body.message).toContain('Người dùng không tồn tại')
    })

    it('should list user direct conversations with pagination', async () => {
      // ARRANGE: User1 creates conversations with User2 and User3
      await createDirectConversation(user1Token, user2Id)
      await createDirectConversation(user1Token, user3Id)

      // ACT: User1 lists conversations
      const response = await request(app.getHttpServer())
        .get('/conversations')
        .set('Authorization', `Bearer ${user1Token}`)
        .query({ page: 1, limit: 10, type: 'DIRECT' })

      // ASSERT: Response structure
      expect(response.status).toBe(200)
      expect(response.body.data).toHaveLength(2)
      expect(response.body.pagination).toMatchObject({
        page: 1,
        limit: 10,
        total: 2,
      })

      // ASSERT: All conversations are DIRECT type
      response.body.data.forEach((conv: any) => {
        expect(conv.type).toBe('DIRECT')
      })
    })
  })

  // ===== GROUP 2: GROUP CONVERSATION FLOW =====

  describe('Group Conversation Flow', () => {
    it('should create group conversation successfully', async () => {
      // ACT: User1 creates group with User2 and User3
      const response = await createGroupConversation(user1Token, 'Test Group', [user2Id, user3Id], 'Test Description')

      // ASSERT: Response structure
      expect(response.status).toBe(201)
      expect(response.body).toMatchObject({
        id: expect.any(String),
        type: 'GROUP',
        name: 'Test Group',
        description: 'Test Description',
        ownerId: user1Id,
        isArchived: false,
      })

      // ASSERT: Members (creator + 2 members = 3 total)
      expect(response.body.members).toHaveLength(3)
      const memberUserIds = response.body.members.map((m: any) => m.userId)
      expect(memberUserIds).toContain(user1Id)
      expect(memberUserIds).toContain(user2Id)
      expect(memberUserIds).toContain(user3Id)

      // ASSERT: Creator is ADMIN
      const creatorMember = response.body.members.find((m: any) => m.userId === user1Id)
      expect(creatorMember.role).toBe('ADMIN')
    })

    it('should reject group creation with empty memberIds', async () => {
      // ACT: User1 tries to create group with empty members
      const response = await createGroupConversation(user1Token, 'Empty Group', [])

      // ASSERT: Should reject with validation error
      expect(response.status).toBe(422)
    })

    it('should update group info (name, description, avatar)', async () => {
      // ARRANGE: User1 creates group with User2 and User3 (minimum 3 members)
      const createResponse = await createGroupConversation(user1Token, 'Original Name', [user2Id, user3Id])
      const conversationId = createResponse.body.id

      // ACT: User1 updates group info
      const response = await request(app.getHttpServer())
        .put(`/conversations/${conversationId}`)
        .set('Authorization', `Bearer ${user1Token}`)
        .send({
          name: 'Updated Name',
          description: 'Updated Description',
          avatar: 'https://example.com/avatar.jpg',
        })

      // ASSERT: Response updated
      expect(response.status).toBe(200)
      expect(response.body).toMatchObject({
        id: conversationId,
        name: 'Updated Name',
        description: 'Updated Description',
        avatar: 'https://example.com/avatar.jpg',
      })
    })

    it('should archive and unarchive group conversation', async () => {
      // ARRANGE: User1 creates group with User2 and User3 (minimum 3 members)
      const createResponse = await createGroupConversation(user1Token, 'Test Group', [user2Id, user3Id])
      const conversationId = createResponse.body.id

      // ACT: User1 archives conversation
      const archiveResponse = await request(app.getHttpServer())
        .post(`/conversations/${conversationId}/archive`)
        .set('Authorization', `Bearer ${user1Token}`)

      // ASSERT: Archived successfully
      expect(archiveResponse.status).toBe(201)

      // ACT: User1 unarchives conversation
      const unarchiveResponse = await request(app.getHttpServer())
        .post(`/conversations/${conversationId}/unarchive`)
        .set('Authorization', `Bearer ${user1Token}`)

      // ASSERT: Unarchived successfully
      expect(unarchiveResponse.status).toBe(201)
    })
  })

  // ===== GROUP 3: MESSAGE OPERATIONS =====

  describe('Message Operations', () => {
    it('should send text message successfully', async () => {
      // ARRANGE: User1 creates conversation with User2
      const convResponse = await createDirectConversation(user1Token, user2Id)
      const conversationId = convResponse.body.id

      // ACT: User1 sends message
      const response = await sendMessage(user1Token, conversationId, 'Hello User2!')

      // ASSERT: Response structure
      expect(response.status).toBe(201)
      expect(response.body).toMatchObject({
        id: expect.any(String),
        conversationId,
        fromUserId: user1Id,
        content: 'Hello User2!',
        type: 'TEXT',
        isEdited: false,
        isDeleted: false,
      })

      // ASSERT: Database record
      const message = await prisma.conversationMessage.findUnique({
        where: { id: response.body.id },
      })
      expect(message).toBeTruthy()
      expect(message?.content).toBe('Hello User2!')
    })

    it('should send message with attachments', async () => {
      // ARRANGE: User1 creates conversation with User2
      const convResponse = await createDirectConversation(user1Token, user2Id)
      const conversationId = convResponse.body.id

      // ACT: User1 sends message with attachments
      const response = await request(app.getHttpServer())
        .post('/conversations/messages')
        .set('Authorization', `Bearer ${user1Token}`)
        .send({
          conversationId,
          content: 'Check this image!',
          type: 'IMAGE',
          attachments: [
            {
              type: 'IMAGE',
              fileName: 'test.jpg',
              fileUrl: 'https://example.com/test.jpg',
              fileSize: 1024,
              mimeType: 'image/jpeg',
            },
          ],
        })

      // ASSERT: Response structure
      expect(response.status).toBe(201)
      expect(response.body.attachments).toHaveLength(1)
      expect(response.body.attachments[0]).toMatchObject({
        type: 'IMAGE',
        fileName: 'test.jpg',
        fileUrl: 'https://example.com/test.jpg',
      })
    })

    it('should edit own message successfully', async () => {
      // ARRANGE: User1 creates conversation and sends message
      const convResponse = await createDirectConversation(user1Token, user2Id)
      const conversationId = convResponse.body.id
      const msgResponse = await sendMessage(user1Token, conversationId, 'Original message')
      const messageId = msgResponse.body.id

      // ACT: User1 edits message
      const response = await request(app.getHttpServer())
        .put(`/conversations/messages/${messageId}`)
        .set('Authorization', `Bearer ${user1Token}`)
        .send({ content: 'Edited message' })

      // ASSERT: Response updated
      expect(response.status).toBe(200)
      expect(response.body).toMatchObject({
        id: messageId,
        content: 'Edited message',
        isEdited: true,
      })
    })

    it('should delete own message (for self)', async () => {
      // ARRANGE: User1 creates conversation and sends message
      const convResponse = await createDirectConversation(user1Token, user2Id)
      const conversationId = convResponse.body.id
      const msgResponse = await sendMessage(user1Token, conversationId, 'Message to delete')
      const messageId = msgResponse.body.id

      // ACT: User1 deletes message (for self)
      const response = await request(app.getHttpServer())
        .delete(`/conversations/messages/${messageId}`)
        .set('Authorization', `Bearer ${user1Token}`)
        .query({ forEveryone: 'false' })

      // ASSERT: Response deleted
      expect(response.status).toBe(200)
      expect(response.body.isDeleted).toBe(true)
      expect(response.body.deletedForEveryone).toBe(false)
    })

    it('should reject editing other user message', async () => {
      // ARRANGE: User1 creates conversation and sends message
      const convResponse = await createDirectConversation(user1Token, user2Id)
      const conversationId = convResponse.body.id
      const msgResponse = await sendMessage(user1Token, conversationId, 'User1 message')
      const messageId = msgResponse.body.id

      // ACT: User2 tries to edit User1's message
      const response = await request(app.getHttpServer())
        .put(`/conversations/messages/${messageId}`)
        .set('Authorization', `Bearer ${user2Token}`)
        .send({ content: 'Hacked message' })

      // ASSERT: Should reject
      expect(response.status).toBe(403)
      expect(response.body.message).toContain('Bạn chỉ có thể chỉnh sửa tin nhắn của chính mình')
    })
  })

  // ===== GROUP 4: MESSAGE INTERACTIONS =====

  describe('Message Interactions', () => {
    it('should mark messages as read', async () => {
      // ARRANGE: User1 creates conversation and sends message
      const convResponse = await createDirectConversation(user1Token, user2Id)
      const conversationId = convResponse.body.id
      const msgResponse = await sendMessage(user1Token, conversationId, 'Hello!')
      const messageId = msgResponse.body.id

      // ACT: User2 marks message as read
      const response = await request(app.getHttpServer())
        .post('/conversations/messages/read')
        .set('Authorization', `Bearer ${user2Token}`)
        .send({ conversationId, messageId })

      // ASSERT: Response success
      expect(response.status).toBe(201)
      expect(response.body.message).toContain('Đã đánh dấu')

      // ASSERT: Read receipt created
      const readReceipt = await prisma.messageReadReceipt.findFirst({
        where: { messageId, userId: user2Id },
      })
      expect(readReceipt).toBeTruthy()
    })

    it('should add and remove reaction to message', async () => {
      // ARRANGE: User1 creates conversation and sends message
      const convResponse = await createDirectConversation(user1Token, user2Id)
      const conversationId = convResponse.body.id
      const msgResponse = await sendMessage(user1Token, conversationId, 'Hello!')
      const messageId = msgResponse.body.id

      // ACT: User2 adds reaction
      const addResponse = await request(app.getHttpServer())
        .post(`/conversations/messages/${messageId}/react`)
        .set('Authorization', `Bearer ${user2Token}`)
        .send({ emoji: '👍' })

      // ASSERT: Reaction added
      expect(addResponse.status).toBe(201)
      expect(addResponse.body.data.action).toBe('added')

      // ASSERT: Reaction exists in database
      const reaction = await prisma.messageReaction.findFirst({
        where: { messageId, userId: user2Id, emoji: '👍' },
      })
      expect(reaction).toBeTruthy()

      // ACT: User2 removes reaction
      const removeResponse = await request(app.getHttpServer())
        .delete(`/conversations/messages/${messageId}/react`)
        .set('Authorization', `Bearer ${user2Token}`)
        .query({ emoji: '👍' })

      // ASSERT: Reaction removed
      expect(removeResponse.status).toBe(200)
    })
  })

  // ===== GROUP 5: AUTHORIZATION & PERMISSIONS =====

  describe('Authorization & Permissions', () => {
    it('should require authentication for all endpoints', async () => {
      // ACT: Try to access endpoints without token
      const responses = await Promise.all([
        request(app.getHttpServer()).get('/conversations'),
        request(app.getHttpServer()).post('/conversations/direct').send({ recipientId: user2Id }),
        request(app.getHttpServer()).post('/conversations/messages').send({ conversationId: 'test', content: 'test' }),
      ])

      // ASSERT: All should return 401
      responses.forEach((response) => {
        expect(response.status).toBe(401)
      })
    })

    it('should reject non-member from sending message', async () => {
      // ARRANGE: User1 creates conversation with User2 (User3 is NOT a member)
      const convResponse = await createDirectConversation(user1Token, user2Id)
      const conversationId = convResponse.body.id

      // ACT: User3 tries to send message
      const response = await sendMessage(user3Token, conversationId, 'Unauthorized message')

      // ASSERT: Should reject
      expect(response.status).toBe(403)
      expect(response.body.message).toContain('Bạn không có quyền gửi tin nhắn trong cuộc trò chuyện này')
    })
  })

  // ===== GROUP 5: MESSAGE PAGINATION =====

  describe('Message Pagination', () => {
    it('should paginate messages backward (default - newest first)', async () => {
      // ARRANGE: Create conversation with 10 messages
      const convResponse = await createDirectConversation(user1Token, user2Id)
      const conversationId = convResponse.body.id

      const messageIds: string[] = []
      for (let i = 1; i <= 10; i++) {
        const msgResponse = await sendMessage(user1Token, conversationId, `Message ${i}`)
        messageIds.push(msgResponse.body.id)
        // Small delay to ensure different timestamps
        await new Promise((resolve) => setTimeout(resolve, 10))
      }

      // ACT: Fetch first page (5 newest messages)
      const page1Response = await getMessages(user1Token, conversationId, { limit: 5 })

      // ASSERT: First page
      expect(page1Response.status).toBe(200)
      expect(page1Response.body.data).toHaveLength(5)
      expect(page1Response.body.pagination.hasMore).toBe(true)
      expect(page1Response.body.pagination.nextCursor).toBeDefined()

      // Verify messages are in reverse chronological order (newest first)
      const page1Messages = page1Response.body.data
      expect(page1Messages[0].content).toBe('Message 10')
      expect(page1Messages[4].content).toBe('Message 6')

      // ACT: Fetch second page using nextCursor
      const page2Response = await getMessages(user1Token, conversationId, {
        limit: 5,
        cursor: page1Response.body.pagination.nextCursor,
      })

      // ASSERT: Second page
      expect(page2Response.status).toBe(200)
      expect(page2Response.body.data).toHaveLength(5)
      expect(page2Response.body.pagination.hasMore).toBe(false)

      // Verify older messages
      const page2Messages = page2Response.body.data
      expect(page2Messages[0].content).toBe('Message 5')
      expect(page2Messages[4].content).toBe('Message 1')
    })

    it('should paginate messages forward (oldest first)', async () => {
      // ARRANGE: Create conversation with 10 messages
      const convResponse = await createDirectConversation(user1Token, user2Id)
      const conversationId = convResponse.body.id

      const messageIds: string[] = []
      for (let i = 1; i <= 10; i++) {
        const msgResponse = await sendMessage(user1Token, conversationId, `Message ${i}`)
        messageIds.push(msgResponse.body.id)
        await new Promise((resolve) => setTimeout(resolve, 10))
      }

      // ACT: Fetch from oldest message with forward direction
      const response = await getMessages(user1Token, conversationId, {
        limit: 5,
        cursor: messageIds[0], // Start from first message
        direction: 'forward',
      })

      // ASSERT: Should return 5 newer messages after Message 1
      expect(response.status).toBe(200)
      expect(response.body.data).toHaveLength(5)
      expect(response.body.pagination.prevCursor).toBeDefined()

      // Verify messages are newer than cursor
      const messages = response.body.data
      expect(messages[0].content).toBe('Message 2')
      expect(messages[4].content).toBe('Message 6')
    })

    it('should handle invalid cursor gracefully', async () => {
      // ARRANGE: Create conversation
      const convResponse = await createDirectConversation(user1Token, user2Id)
      const conversationId = convResponse.body.id
      await sendMessage(user1Token, conversationId, 'Test message')

      // ACT: Request with invalid cursor
      const response = await getMessages(user1Token, conversationId, {
        cursor: 'invalid_message_id_12345',
      })

      // ASSERT: Should return error
      expect([400, 404]).toContain(response.status)
      expect(response.body.message).toBeDefined()
    })

    it('should search messages with cursor pagination', async () => {
      // ARRANGE: Create conversation with 15 messages containing "test"
      const convResponse = await createDirectConversation(user1Token, user2Id)
      const conversationId = convResponse.body.id

      for (let i = 1; i <= 15; i++) {
        await sendMessage(user1Token, conversationId, `This is test message ${i}`)
        await new Promise((resolve) => setTimeout(resolve, 10))
      }

      // Also create some messages without "test" keyword
      await sendMessage(user1Token, conversationId, 'Different content 1')
      await sendMessage(user1Token, conversationId, 'Different content 2')

      // ACT: Search with limit=10
      const page1Response = await searchMessages(user1Token, {
        q: 'test',
        limit: 10,
      })

      // ASSERT: First page
      expect(page1Response.status).toBe(200)
      expect(page1Response.body.data).toHaveLength(10)
      expect(page1Response.body.pagination.hasMore).toBe(true)
      expect(page1Response.body.pagination.nextCursor).toBeDefined()

      // Verify all messages contain "test"
      page1Response.body.data.forEach((msg: any) => {
        expect(msg.content.toLowerCase()).toContain('test')
      })

      // ACT: Fetch second page
      const page2Response = await searchMessages(user1Token, {
        q: 'test',
        limit: 10,
        cursor: page1Response.body.pagination.nextCursor,
      })

      // ASSERT: Second page (remaining 5 messages)
      expect(page2Response.status).toBe(200)
      expect(page2Response.body.data).toHaveLength(5)
      expect(page2Response.body.pagination.hasMore).toBe(false)

      // Verify all messages contain "test"
      page2Response.body.data.forEach((msg: any) => {
        expect(msg.content.toLowerCase()).toContain('test')
      })
    })
  })
})
