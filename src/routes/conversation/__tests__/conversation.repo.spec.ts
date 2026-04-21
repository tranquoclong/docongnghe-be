import { Test, TestingModule } from '@nestjs/testing'
import { PrismaService } from '../../../shared/services/prisma.service'
import { ConversationRepository } from '../conversation.repo'

describe('ConversationRepository', () => {
  let repository: ConversationRepository
  let prismaService: PrismaService

  // Mock PrismaService
  const mockPrismaService = {
    conversation: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      count: jest.fn(),
    },
    conversationMember: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
      delete: jest.fn(),
      count: jest.fn(),
      aggregate: jest.fn(),
      upsert: jest.fn(),
    },
    message: {
      findMany: jest.fn(),
      count: jest.fn(),
    },
    typingIndicator: {
      upsert: jest.fn(),
      delete: jest.fn(),
      findMany: jest.fn(),
      deleteMany: jest.fn(),
    },
    $transaction: jest.fn(),
  }

  // Test data factories
  const createTestData = {
    conversation: (overrides = {}) => ({
      id: 1,
      type: 'DIRECT',
      name: null,
      description: null,
      avatar: null,
      ownerId: null,
      lastMessageId: null,
      lastMessageAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
      ...overrides,
    }),
    member: (overrides = {}) => ({
      id: 1,
      conversationId: 1,
      userId: 1,
      role: 'MEMBER',
      joinedAt: new Date(),
      leftAt: null,
      ...overrides,
    }),
  }

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ConversationRepository,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile()

    repository = module.get<ConversationRepository>(ConversationRepository)
    prismaService = module.get<PrismaService>(PrismaService)

    // Reset mocks
    jest.clearAllMocks()
  })

  describe('create', () => {
    it('should create DIRECT conversation successfully', async () => {
      // Arrange - Chuẩn bị dữ liệu
      const data = {
        type: 'DIRECT' as const,
        memberIds: [1, 2],
      }
      const mockConversation = createTestData.conversation({ type: 'DIRECT' })
      const mockConversationWithMembers = {
        ...mockConversation,
        owner: null,
        members: [
          { ...createTestData.member({ userId: 1 }), user: { id: 1, name: 'User 1' } },
          { ...createTestData.member({ userId: 2 }), user: { id: 2, name: 'User 2' } },
        ],
      }

      mockPrismaService.conversation.create.mockResolvedValue(mockConversation)
      mockPrismaService.conversation.findUnique.mockResolvedValue(mockConversationWithMembers)

      // Act - Thực hiện tạo conversation
      const result = await repository.create(data)

      // Assert - Kiểm tra kết quả
      expect(result).toMatchObject({
        id: mockConversationWithMembers.id,
        type: mockConversationWithMembers.type,
        members: expect.arrayContaining([
          expect.objectContaining({ userId: 1 }),
          expect.objectContaining({ userId: 2 }),
        ]),
      })
      expect(mockPrismaService.conversation.create).toHaveBeenCalled()
    })

    it('should create GROUP conversation with admin role', async () => {
      // Arrange - Chuẩn bị dữ liệu GROUP
      const data = {
        type: 'GROUP' as const,
        name: 'Test Group',
        description: 'Test Description',
        ownerId: 1,
        memberIds: [1, 2, 3],
      }
      const mockConversation = createTestData.conversation({ type: 'GROUP', name: 'Test Group', ownerId: 1 })
      const mockConversationWithMembers = {
        ...mockConversation,
        owner: { id: 1, name: 'Owner' },
        members: [
          { ...createTestData.member({ userId: 1, role: 'ADMIN' }), user: { id: 1, name: 'User 1' } },
          { ...createTestData.member({ userId: 2 }), user: { id: 2, name: 'User 2' } },
          { ...createTestData.member({ userId: 3 }), user: { id: 3, name: 'User 3' } },
        ],
      }

      mockPrismaService.conversation.create.mockResolvedValue(mockConversation)
      mockPrismaService.conversation.findUnique.mockResolvedValue(mockConversationWithMembers)

      // Act - Thực hiện tạo conversation
      const result = await repository.create(data)

      // Assert - Kiểm tra kết quả
      expect(result).toMatchObject({
        id: mockConversationWithMembers.id,
        type: 'GROUP',
        name: 'Test Group',
        ownerId: 1,
        members: expect.arrayContaining([
          expect.objectContaining({ userId: 1, role: 'ADMIN' }),
          expect.objectContaining({ userId: 2, role: 'MEMBER' }),
          expect.objectContaining({ userId: 3, role: 'MEMBER' }),
        ]),
      })
      expect(mockPrismaService.conversation.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            type: 'GROUP',
            name: 'Test Group',
            ownerId: 1,
          }),
        }),
      )
    })
  })

  describe('findById', () => {
    it('should find conversation by id successfully', async () => {
      // Arrange - Chuẩn bị dữ liệu
      const id = 'conv-1'
      const mockConversation = createTestData.conversation({ id })

      mockPrismaService.conversation.findUnique.mockResolvedValue(mockConversation)

      // Act - Thực hiện tìm kiếm
      const result = await repository.findById(id)

      // Assert - Kiểm tra kết quả
      expect(result).toMatchObject({
        id: mockConversation.id,
        type: mockConversation.type,
      })
      expect(mockPrismaService.conversation.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id },
        }),
      )
    })

    it('should return null when conversation not found', async () => {
      // Arrange - Chuẩn bị dữ liệu không tồn tại
      const id = 'conv-999'

      mockPrismaService.conversation.findUnique.mockResolvedValue(null)

      // Act - Thực hiện tìm kiếm
      const result = await repository.findById(id)

      // Assert - Kiểm tra kết quả
      expect(result).toBeNull()
    })

    it('should return null when user is not a member', async () => {
      // Arrange - Chuẩn bị dữ liệu
      const id = 'conv-1'
      const userId = 999
      const mockConversation = createTestData.conversation({
        id,
        members: [
          createTestData.member({ conversationId: id, userId: 1, isActive: true }),
          createTestData.member({ conversationId: id, userId: 2, isActive: true }),
        ],
      })

      mockPrismaService.conversation.findUnique.mockResolvedValue(mockConversation)

      // Act - Thực hiện tìm kiếm với userId không phải member
      const result = await repository.findById(id, userId)

      // Assert - Kiểm tra kết quả
      expect(result).toBeNull()
    })

    it('should return conversation when user is a member', async () => {
      // Arrange - Chuẩn bị dữ liệu
      const id = 'conv-1'
      const userId = 1
      const mockConversation = createTestData.conversation({
        id,
        members: [
          createTestData.member({ conversationId: id, userId: 1, isActive: true }),
          createTestData.member({ conversationId: id, userId: 2, isActive: true }),
        ],
      })

      mockPrismaService.conversation.findUnique.mockResolvedValue(mockConversation)

      // Act - Thực hiện tìm kiếm với userId là member
      const result = await repository.findById(id, userId)

      // Assert - Kiểm tra kết quả
      expect(result).toMatchObject({
        id: mockConversation.id,
        type: mockConversation.type,
      })
    })
  })

  describe('findUserConversations', () => {
    it('should find conversations by userId successfully', async () => {
      // Arrange - Chuẩn bị dữ liệu
      const userId = 1
      const options = { page: 1, limit: 20 }
      const mockConversations = [
        createTestData.conversation({ id: 'conv-1' }),
        createTestData.conversation({ id: 'conv-2' }),
      ]
      const mockStats = {
        total: 2,
        unread: 1,
        direct: 1,
        group: 1,
        archived: 0,
      }

      mockPrismaService.conversation.findMany.mockResolvedValue(mockConversations)
      mockPrismaService.conversation.count.mockResolvedValue(2)

      // Mock getConversationStats - được gọi trong findUserConversations
      jest.spyOn(repository, 'getConversationStats').mockResolvedValue(mockStats as any)

      // Act - Thực hiện tìm kiếm
      const result = await repository.findUserConversations(userId, options)

      // Assert - Kiểm tra kết quả
      expect(result.data).toHaveLength(2)
      expect(result.data[0]).toMatchObject({ id: 'conv-1', type: 'DIRECT' })
      expect(result.data[1]).toMatchObject({ id: 'conv-2', type: 'DIRECT' })
      expect(result.pagination.total).toBe(2)
      expect(result.pagination.page).toBe(1)
      expect(result.pagination.limit).toBe(20)
      expect(result.stats).toEqual(mockStats)
      expect(mockPrismaService.conversation.findMany).toHaveBeenCalled()
    })

    it('should filter by conversation type', async () => {
      // Arrange - Chuẩn bị dữ liệu
      const userId = 1
      const options = { page: 1, limit: 20, type: 'GROUP' as const }
      const mockConversations = [createTestData.conversation({ id: 'conv-group', type: 'GROUP' })]
      const mockStats = { total: 1, unread: 0, direct: 0, group: 1, archived: 0 }

      mockPrismaService.conversation.findMany.mockResolvedValue(mockConversations)
      mockPrismaService.conversation.count.mockResolvedValue(1)
      jest.spyOn(repository, 'getConversationStats').mockResolvedValue(mockStats as any)

      // Act - Thực hiện tìm kiếm với type filter
      const result = await repository.findUserConversations(userId, options)

      // Assert - Kiểm tra kết quả
      expect(result.data).toHaveLength(1)
      expect(result.data[0]).toMatchObject({ type: 'GROUP' })
    })

    it('should filter by search query', async () => {
      // Arrange - Chuẩn bị dữ liệu
      const userId = 1
      const options = { page: 1, limit: 20, search: 'test' }
      const mockConversations = [createTestData.conversation({ id: 'conv-1', name: 'Test Group' })]
      const mockStats = { total: 1, unread: 0, direct: 0, group: 1, archived: 0 }

      mockPrismaService.conversation.findMany.mockResolvedValue(mockConversations)
      mockPrismaService.conversation.count.mockResolvedValue(1)
      jest.spyOn(repository, 'getConversationStats').mockResolvedValue(mockStats as any)

      // Act - Thực hiện tìm kiếm với search filter
      const result = await repository.findUserConversations(userId, options)

      // Assert - Kiểm tra kết quả
      expect(result.data).toHaveLength(1)
      expect(result.data[0]).toMatchObject({ name: 'Test Group' })
    })
  })

  describe('update', () => {
    it('should update conversation successfully', async () => {
      // Arrange - Chuẩn bị dữ liệu
      const id = 'conv-1'
      const data = { name: 'Updated Name', description: 'Updated Description' }
      const mockConversation = createTestData.conversation({ id, ...data })

      mockPrismaService.conversation.update.mockResolvedValue(mockConversation)

      // Act - Thực hiện cập nhật
      const result = await repository.update(id, data)

      // Assert - Kiểm tra kết quả
      expect(result).toMatchObject({
        id: mockConversation.id,
        name: data.name,
        description: data.description,
      })
      expect(mockPrismaService.conversation.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id },
          data,
        }),
      )
    })
  })

  describe('archive', () => {
    it('should archive conversation successfully', async () => {
      // Arrange - Chuẩn bị dữ liệu
      const id = 'conv-1'
      const mockConversation = createTestData.conversation({ id, isArchived: true })

      mockPrismaService.conversation.update.mockResolvedValue(mockConversation)

      // Act - Thực hiện archive
      const result = await repository.archive(id, true)

      // Assert - Kiểm tra kết quả
      expect(result).toMatchObject({
        id: mockConversation.id,
        isArchived: true,
      })
      expect(mockPrismaService.conversation.update).toHaveBeenCalled()
    })
  })

  describe('isUserMember', () => {
    it('should return true when user is active member', async () => {
      // Arrange - Chuẩn bị dữ liệu
      const conversationId = 'conv-1'
      const userId = 1
      const mockMember = createTestData.member({ conversationId, userId, isActive: true })

      mockPrismaService.conversationMember.findUnique.mockResolvedValue(mockMember)

      // Act - Thực hiện kiểm tra
      const result = await repository.isUserMember(conversationId, userId)

      // Assert - Kiểm tra kết quả
      expect(result).toBe(true)
    })

    it('should return false when user is not member', async () => {
      // Arrange - Chuẩn bị dữ liệu
      const conversationId = 'conv-1'
      const userId = 999

      mockPrismaService.conversationMember.findUnique.mockResolvedValue(null)

      // Act - Thực hiện kiểm tra
      const result = await repository.isUserMember(conversationId, userId)

      // Assert - Kiểm tra kết quả
      expect(result).toBe(false)
    })

    it('should return false when user is inactive member', async () => {
      // Arrange - Chuẩn bị dữ liệu
      const conversationId = 'conv-1'
      const userId = 1
      const mockMember = createTestData.member({ conversationId, userId, isActive: false })

      mockPrismaService.conversationMember.findUnique.mockResolvedValue(mockMember)

      // Act - Thực hiện kiểm tra
      const result = await repository.isUserMember(conversationId, userId)

      // Assert - Kiểm tra kết quả
      expect(result).toBe(false)
    })
  })

  describe('findDirectConversation', () => {
    it('should find direct conversation between two users', async () => {
      // Arrange - Chuẩn bị dữ liệu
      const userId1 = 1
      const userId2 = 2
      const mockConversation = createTestData.conversation({ id: 'conv-direct', type: 'DIRECT' })

      mockPrismaService.conversation.findFirst.mockResolvedValue(mockConversation)

      // Act - Thực hiện tìm kiếm
      const result = await repository.findDirectConversation(userId1, userId2)

      // Assert - Kiểm tra kết quả
      expect(result).toMatchObject({
        id: 'conv-direct',
        type: 'DIRECT',
      })
      expect(mockPrismaService.conversation.findFirst).toHaveBeenCalled()
    })

    it('should return null when no direct conversation exists', async () => {
      // Arrange - Chuẩn bị dữ liệu
      const userId1 = 1
      const userId2 = 999

      mockPrismaService.conversation.findFirst.mockResolvedValue(null)

      // Act - Thực hiện tìm kiếm
      const result = await repository.findDirectConversation(userId1, userId2)

      // Assert - Kiểm tra kết quả
      expect(result).toBeNull()
    })
  })

  describe('addMember', () => {
    it('should add new member to conversation', async () => {
      // Arrange - Chuẩn bị dữ liệu
      const conversationId = 'conv-1'
      const userId = 3
      const role = 'MEMBER'
      const mockMember = createTestData.member({ conversationId, userId, role })

      mockPrismaService.conversationMember.upsert.mockResolvedValue(mockMember)

      // Act - Thực hiện thêm member
      const result = await repository.addMember(conversationId, userId, role)

      // Assert - Kiểm tra kết quả
      expect(result).toMatchObject({
        conversationId,
        userId,
        role,
      })
      expect(mockPrismaService.conversationMember.upsert).toHaveBeenCalled()
    })

    it('should add member with default MEMBER role', async () => {
      // Arrange - Chuẩn bị dữ liệu
      const conversationId = 'conv-1'
      const userId = 3
      const mockMember = createTestData.member({ conversationId, userId, role: 'MEMBER' })

      mockPrismaService.conversationMember.upsert.mockResolvedValue(mockMember)

      // Act - Thực hiện thêm member không truyền role
      const result = await repository.addMember(conversationId, userId)

      // Assert - Kiểm tra kết quả
      expect(result).toMatchObject({
        conversationId,
        userId,
        role: 'MEMBER',
      })
    })
  })

  describe('removeMember', () => {
    it('should remove member from conversation', async () => {
      // Arrange - Chuẩn bị dữ liệu
      const conversationId = 'conv-1'
      const userId = 2
      const mockMember = createTestData.member({ conversationId, userId, isActive: false })

      mockPrismaService.conversationMember.update.mockResolvedValue(mockMember)

      // Act - Thực hiện xóa member
      const result = await repository.removeMember(conversationId, userId)

      // Assert - Kiểm tra kết quả
      expect(result).toMatchObject({
        conversationId,
        userId,
        isActive: false,
      })
      expect(mockPrismaService.conversationMember.update).toHaveBeenCalled()
    })
  })

  describe('updateMemberRole', () => {
    it('should update member role successfully', async () => {
      // Arrange - Chuẩn bị dữ liệu
      const conversationId = 'conv-1'
      const userId = 2
      const newRole = 'MODERATOR'
      const mockMember = createTestData.member({ conversationId, userId, role: newRole })

      mockPrismaService.conversationMember.update.mockResolvedValue(mockMember)

      // Act - Thực hiện cập nhật role
      const result = await repository.updateMemberRole(conversationId, userId, newRole)

      // Assert - Kiểm tra kết quả
      expect(result).toMatchObject({
        conversationId,
        userId,
        role: newRole,
      })
      expect(mockPrismaService.conversationMember.update).toHaveBeenCalled()
    })
  })

  describe('updateMemberLastRead', () => {
    it('should update member last read timestamp', async () => {
      // Arrange - Chuẩn bị dữ liệu
      const conversationId = 'conv-1'
      const userId = 1
      const lastReadAt = new Date('2024-01-15')
      const mockMember = createTestData.member({ conversationId, userId, unreadCount: 0 })

      mockPrismaService.conversationMember.update.mockResolvedValue(mockMember)

      // Act - Thực hiện cập nhật last read
      const result = await repository.updateMemberLastRead(conversationId, userId, lastReadAt)

      // Assert - Kiểm tra kết quả
      expect(result).toMatchObject({
        conversationId,
        userId,
        unreadCount: 0,
      })
      expect(mockPrismaService.conversationMember.update).toHaveBeenCalled()
    })

    it('should use current date when lastReadAt not provided', async () => {
      // Arrange - Chuẩn bị dữ liệu
      const conversationId = 'conv-1'
      const userId = 1
      const mockMember = createTestData.member({ conversationId, userId, unreadCount: 0 })

      mockPrismaService.conversationMember.update.mockResolvedValue(mockMember)

      // Act - Thực hiện cập nhật last read không truyền lastReadAt
      const result = await repository.updateMemberLastRead(conversationId, userId)

      // Assert - Kiểm tra kết quả
      expect(result).toMatchObject({
        conversationId,
        userId,
        unreadCount: 0,
      })
    })
  })

  describe('incrementUnreadCount', () => {
    it('should increment unread count for all members except sender', async () => {
      // Arrange - Chuẩn bị dữ liệu
      const conversationId = 'conv-1'
      const excludeUserId = 1
      const mockResult = { count: 2 }

      mockPrismaService.conversationMember.updateMany.mockResolvedValue(mockResult)

      // Act - Thực hiện tăng unread count
      const result = await repository.incrementUnreadCount(conversationId, excludeUserId)

      // Assert - Kiểm tra kết quả
      expect(result).toEqual(mockResult)
      expect(mockPrismaService.conversationMember.updateMany).toHaveBeenCalled()
    })
  })

  describe('resetUnreadCount', () => {
    it('should reset unread count to zero', async () => {
      // Arrange - Chuẩn bị dữ liệu
      const conversationId = 'conv-1'
      const userId = 1
      const mockMember = createTestData.member({ conversationId, userId, unreadCount: 0 })

      mockPrismaService.conversationMember.update.mockResolvedValue(mockMember)

      // Act - Thực hiện reset unread count
      const result = await repository.resetUnreadCount(conversationId, userId)

      // Assert - Kiểm tra kết quả
      expect(result).toMatchObject({
        conversationId,
        userId,
        unreadCount: 0,
      })
      expect(mockPrismaService.conversationMember.update).toHaveBeenCalled()
    })
  })

  describe('getUserRole', () => {
    it('should return user role when user is active member', async () => {
      // Arrange - Chuẩn bị dữ liệu
      const conversationId = 'conv-1'
      const userId = 1
      const mockMember = createTestData.member({ conversationId, userId, role: 'ADMIN', isActive: true })

      mockPrismaService.conversationMember.findUnique.mockResolvedValue(mockMember)

      // Act - Thực hiện lấy role
      const result = await repository.getUserRole(conversationId, userId)

      // Assert - Kiểm tra kết quả
      expect(result).toBe('ADMIN')
    })

    it('should return null when user is not member', async () => {
      // Arrange - Chuẩn bị dữ liệu
      const conversationId = 'conv-1'
      const userId = 999

      mockPrismaService.conversationMember.findUnique.mockResolvedValue(null)

      // Act - Thực hiện lấy role
      const result = await repository.getUserRole(conversationId, userId)

      // Assert - Kiểm tra kết quả
      expect(result).toBeNull()
    })

    it('should return null when user is inactive member', async () => {
      // Arrange - Chuẩn bị dữ liệu
      const conversationId = 'conv-1'
      const userId = 1
      const mockMember = createTestData.member({ conversationId, userId, role: 'ADMIN', isActive: false })

      mockPrismaService.conversationMember.findUnique.mockResolvedValue(mockMember)

      // Act - Thực hiện lấy role
      const result = await repository.getUserRole(conversationId, userId)

      // Assert - Kiểm tra kết quả
      expect(result).toBeNull()
    })
  })

  describe('getConversationMembers', () => {
    it('should get all active members by default', async () => {
      // Arrange - Chuẩn bị dữ liệu
      const conversationId = 'conv-1'
      const mockMembers = [
        createTestData.member({ conversationId, userId: 1, role: 'ADMIN' }),
        createTestData.member({ conversationId, userId: 2, role: 'MEMBER' }),
      ]

      mockPrismaService.conversationMember.findMany.mockResolvedValue(mockMembers)

      // Act - Thực hiện lấy members
      const result = await repository.getConversationMembers(conversationId)

      // Assert - Kiểm tra kết quả
      expect(result).toHaveLength(2)
      expect(result[0]).toMatchObject({ userId: 1, role: 'ADMIN' })
      expect(result[1]).toMatchObject({ userId: 2, role: 'MEMBER' })
    })

    it('should get all members including inactive when activeOnly is false', async () => {
      // Arrange - Chuẩn bị dữ liệu
      const conversationId = 'conv-1'
      const mockMembers = [
        createTestData.member({ conversationId, userId: 1, isActive: true }),
        createTestData.member({ conversationId, userId: 2, isActive: false }),
      ]

      mockPrismaService.conversationMember.findMany.mockResolvedValue(mockMembers)

      // Act - Thực hiện lấy tất cả members
      const result = await repository.getConversationMembers(conversationId, false)

      // Assert - Kiểm tra kết quả
      expect(result).toHaveLength(2)
    })
  })

  describe('getConversationStats', () => {
    it('should get conversation statistics for user', async () => {
      // Arrange - Chuẩn bị dữ liệu
      const userId = 1
      const mockStats = {
        totalUnread: 5,
        directCount: 3,
        groupCount: 2,
        archivedCount: 1,
      }

      // Mock các Promise.all calls
      mockPrismaService.conversation.count
        .mockResolvedValueOnce(5) // total
        .mockResolvedValueOnce(3) // direct
        .mockResolvedValueOnce(2) // group
        .mockResolvedValueOnce(1) // archived

      mockPrismaService.conversationMember.aggregate.mockResolvedValue({
        _sum: { unreadCount: 5 },
      })

      // Act - Thực hiện lấy stats
      const result = await repository.getConversationStats(userId)

      // Assert - Kiểm tra kết quả
      expect(result).toEqual(mockStats)
      expect(mockPrismaService.conversation.count).toHaveBeenCalledTimes(4)
      expect(mockPrismaService.conversationMember.aggregate).toHaveBeenCalled()
    })

    it('should handle null unread count', async () => {
      // Arrange - Chuẩn bị dữ liệu
      const userId = 1

      mockPrismaService.conversation.count
        .mockResolvedValueOnce(0)
        .mockResolvedValueOnce(0)
        .mockResolvedValueOnce(0)
        .mockResolvedValueOnce(0)

      mockPrismaService.conversationMember.aggregate.mockResolvedValue({
        _sum: { unreadCount: null },
      })

      // Act - Thực hiện lấy stats
      const result = await repository.getConversationStats(userId)

      // Assert - Kiểm tra kết quả
      expect(result.totalUnread).toBe(0)
    })
  })

  describe('setTypingIndicator', () => {
    it('should set typing indicator for user', async () => {
      // Arrange - Chuẩn bị dữ liệu
      const conversationId = 'conv-1'
      const userId = 1
      const mockIndicator = {
        conversationId,
        userId,
        startedAt: new Date(),
        expiresAt: new Date(Date.now() + 10000),
      }

      mockPrismaService.typingIndicator.upsert.mockResolvedValue(mockIndicator)

      // Act - Thực hiện set typing indicator
      const result = await repository.setTypingIndicator(conversationId, userId)

      // Assert - Kiểm tra kết quả
      expect(result).toMatchObject({
        conversationId,
        userId,
      })
      expect(mockPrismaService.typingIndicator.upsert).toHaveBeenCalled()
    })
  })

  describe('removeTypingIndicator', () => {
    it('should remove typing indicator successfully', async () => {
      // Arrange - Chuẩn bị dữ liệu
      const conversationId = 'conv-1'
      const userId = 1

      mockPrismaService.typingIndicator.delete.mockResolvedValue({})

      // Act - Thực hiện remove typing indicator
      await repository.removeTypingIndicator(conversationId, userId)

      // Assert - Kiểm tra kết quả
      expect(mockPrismaService.typingIndicator.delete).toHaveBeenCalled()
    })

    it('should ignore errors when indicator does not exist', async () => {
      // Arrange - Chuẩn bị dữ liệu
      const conversationId = 'conv-1'
      const userId = 1

      mockPrismaService.typingIndicator.delete.mockRejectedValue(new Error('Not found'))

      // Act - Thực hiện remove typing indicator
      await repository.removeTypingIndicator(conversationId, userId)

      // Assert - Kiểm tra không throw error
      expect(mockPrismaService.typingIndicator.delete).toHaveBeenCalled()
    })
  })

  describe('getTypingIndicators', () => {
    it('should get active typing indicators', async () => {
      // Arrange - Chuẩn bị dữ liệu
      const conversationId = 'conv-1'
      const mockIndicators = [
        {
          conversationId,
          userId: 1,
          startedAt: new Date(),
          expiresAt: new Date(Date.now() + 5000),
          user: { id: 1, name: 'User 1', email: 'user1@test.com', avatar: null },
        },
      ]

      mockPrismaService.typingIndicator.findMany.mockResolvedValue(mockIndicators)

      // Act - Thực hiện lấy typing indicators
      const result = await repository.getTypingIndicators(conversationId)

      // Assert - Kiểm tra kết quả
      expect(result).toHaveLength(1)
      expect(result[0]).toMatchObject({
        conversationId,
        userId: 1,
      })
    })
  })

  describe('cleanupExpiredTypingIndicators', () => {
    it('should cleanup expired typing indicators', async () => {
      // Arrange - Chuẩn bị dữ liệu
      const mockResult = { count: 3 }

      mockPrismaService.typingIndicator.deleteMany.mockResolvedValue(mockResult)

      // Act - Thực hiện cleanup
      const result = await repository.cleanupExpiredTypingIndicators()

      // Assert - Kiểm tra kết quả
      expect(result).toEqual(mockResult)
      expect(mockPrismaService.typingIndicator.deleteMany).toHaveBeenCalled()
    })
  })

  describe('muteMember', () => {
    it('should mute member successfully', async () => {
      // Arrange - Chuẩn bị dữ liệu
      const conversationId = 'conv-1'
      const userId = 1
      const mockMember = createTestData.member({ conversationId, userId, isMuted: true })

      mockPrismaService.conversationMember.update.mockResolvedValue(mockMember)

      // Act - Thực hiện mute member
      const result = await repository.muteMember(conversationId, userId)

      // Assert - Kiểm tra kết quả
      expect(result).toMatchObject({
        conversationId,
        userId,
        isMuted: true,
      })
      expect(mockPrismaService.conversationMember.update).toHaveBeenCalled()
    })

    it('should mute member with mutedUntil date', async () => {
      // Arrange - Chuẩn bị dữ liệu
      const conversationId = 'conv-1'
      const userId = 1
      const mutedUntil = new Date('2024-12-31')
      const mockMember = createTestData.member({ conversationId, userId, isMuted: true })

      mockPrismaService.conversationMember.update.mockResolvedValue(mockMember)

      // Act - Thực hiện mute member với mutedUntil
      const result = await repository.muteMember(conversationId, userId, mutedUntil)

      // Assert - Kiểm tra kết quả
      expect(result).toMatchObject({
        conversationId,
        userId,
        isMuted: true,
      })
    })
  })

  describe('unmuteMember', () => {
    it('should unmute member successfully', async () => {
      // Arrange - Chuẩn bị dữ liệu
      const conversationId = 'conv-1'
      const userId = 1
      const mockMember = createTestData.member({ conversationId, userId, isMuted: false })

      mockPrismaService.conversationMember.update.mockResolvedValue(mockMember)

      // Act - Thực hiện unmute member
      const result = await repository.unmuteMember(conversationId, userId)

      // Assert - Kiểm tra kết quả
      expect(result).toMatchObject({
        conversationId,
        userId,
        isMuted: false,
      })
      expect(mockPrismaService.conversationMember.update).toHaveBeenCalled()
    })
  })
})
