import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common'
import { Test, TestingModule } from '@nestjs/testing'
import { SharedUserRepository } from '../../../shared/repositories/shared-user.repo'
import { ConversationRepository } from '../conversation.repo'
import { ConversationService } from '../conversation.service'
import { MessageRepository } from '../message.repo'

// Test data factory để tạo dữ liệu test
const createTestData = {
  user: (overrides = {}) => ({
    id: 1,
    name: 'Nguyễn Văn A',
    email: 'test@example.com',
    avatar: 'avatar.jpg',
    status: 'ACTIVE' as const,
    phoneNumber: '0123456789',
    password: 'hashedPassword',
    totpSecret: null,
    roleId: 1,
    createdById: null,
    updatedById: null,
    deletedById: null,
    deletedAt: null,
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
    ...overrides,
  }),

  conversationMember: (overrides = {}) => ({
    id: 'member-1',
    userId: 1,
    conversationId: 'conv-1',
    role: 'MEMBER' as const,
    joinedAt: new Date('2024-01-01'),
    lastReadAt: new Date('2024-01-01'),
    unreadCount: 0,
    isActive: true,
    isMuted: false,
    mutedUntil: null,
    user: {
      id: 1,
      name: 'Nguyễn Văn A',
      email: 'test@example.com',
      avatar: 'avatar.jpg',
      status: 'ACTIVE' as const,
    },
    ...overrides,
  }),

  conversation: (overrides = {}) => ({
    id: 'conv-1',
    type: 'DIRECT' as const,
    name: null,
    description: null,
    avatar: null,
    ownerId: null,
    lastMessage: 'Xin chào',
    lastMessageAt: new Date('2024-01-01'),
    isArchived: false,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    owner: null,
    members: [
      {
        id: 'member-1',
        userId: 1,
        conversationId: 'conv-1',
        role: 'MEMBER' as const,
        joinedAt: new Date('2024-01-01'),
        lastReadAt: new Date('2024-01-01'),
        unreadCount: 0,
        isActive: true,
        isMuted: false,
        mutedUntil: null,
        user: {
          id: 1,
          name: 'Nguyễn Văn A',
          email: 'test@example.com',
          avatar: 'avatar.jpg',
          status: 'ACTIVE' as const,
        },
      },
    ],
    ...overrides,
  }),

  groupConversation: (overrides = {}) => ({
    id: 'conv-2',
    type: 'GROUP' as const,
    name: 'Nhóm chat',
    description: 'Nhóm thảo luận',
    avatar: 'group-avatar.jpg',
    ownerId: 1,
    lastMessage: 'Chào mọi người',
    lastMessageAt: new Date('2024-01-01'),
    isArchived: false,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    owner: {
      id: 1,
      name: 'Nguyễn Văn A',
      email: 'test@example.com',
      avatar: 'avatar.jpg',
      status: 'ACTIVE' as const,
    },
    members: [
      {
        id: 'member-1',
        userId: 1,
        conversationId: 'conv-2',
        role: 'ADMIN' as const,
        joinedAt: new Date('2024-01-01'),
        lastReadAt: new Date('2024-01-01'),
        unreadCount: 0,
        isActive: true,
        isMuted: false,
        mutedUntil: null,
        user: {
          id: 1,
          name: 'Nguyễn Văn A',
          email: 'test@example.com',
          avatar: 'avatar.jpg',
          status: 'ACTIVE' as const,
        },
      },
      {
        id: 'member-2',
        userId: 2,
        conversationId: 'conv-2',
        role: 'MEMBER' as const,
        joinedAt: new Date('2024-01-01'),
        lastReadAt: new Date('2024-01-01'),
        unreadCount: 0,
        isActive: true,
        isMuted: false,
        mutedUntil: null,
        user: {
          id: 2,
          name: 'Nguyễn Văn B',
          email: 'test2@example.com',
          avatar: 'avatar2.jpg',
          status: 'ACTIVE' as const,
        },
      },
    ],
    ...overrides,
  }),

  getUserConversationsOptions: (overrides = {}) => ({
    page: 1,
    limit: 20,
    type: undefined,
    search: undefined,
    isArchived: false,
    ...overrides,
  }),

  conversationStats: (overrides = {}) => ({
    totalUnread: 5,
    directCount: 3,
    groupCount: 2,
    archivedCount: 1,
    ...overrides,
  }),

  createGroupData: (overrides = {}) => ({
    name: 'Nhóm mới',
    description: 'Mô tả nhóm',
    memberIds: [2, 3],
    avatar: 'group-avatar.jpg',
    ...overrides,
  }),

  message: (overrides = {}) => ({
    id: 'msg-1',
    conversationId: 'conv-1',
    fromUserId: 1,
    content: 'Xin chào',
    type: 'TEXT' as const,
    replyToId: null,
    isEdited: false,
    editedAt: null,
    isDeleted: false,
    deletedAt: null,
    deletedForEveryone: false,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    fromUser: {
      id: 1,
      name: 'Nguyễn Văn A',
      email: 'test@example.com',
      avatar: 'avatar.jpg',
      status: 'ACTIVE' as const,
    },
    replyTo: null,
    attachments: [],
    reactions: [],
    readReceipts: [],
    conversation: undefined,
    ...overrides,
  }),
}

describe('ConversationService', () => {
  let service: ConversationService
  let module: TestingModule
  let mockConversationRepo: jest.Mocked<ConversationRepository>
  let mockMessageRepo: jest.Mocked<MessageRepository>
  let mockUserRepo: jest.Mocked<SharedUserRepository>

  beforeEach(async () => {
    // Tạo mock cho tất cả dependencies
    mockConversationRepo = {
      findUserConversations: jest.fn(),
      findById: jest.fn(),
      create: jest.fn(),
      findDirectConversation: jest.fn(),
      update: jest.fn(),
      archive: jest.fn(),
      isUserMember: jest.fn(),
      getUserRole: jest.fn(),
      removeMember: jest.fn(),
      addMember: jest.fn(),
      updateMemberRole: jest.fn(),
      muteMember: jest.fn(),
      unmuteMember: jest.fn(),
      getConversationMembers: jest.fn(),
      getConversationStats: jest.fn(),
    } as any

    mockMessageRepo = {
      create: jest.fn(),
    } as any

    mockUserRepo = {
      findById: jest.fn(),
      findByIds: jest.fn(),
    } as any

    module = await Test.createTestingModule({
      providers: [
        ConversationService,
        { provide: ConversationRepository, useValue: mockConversationRepo },
        { provide: MessageRepository, useValue: mockMessageRepo },
        { provide: SharedUserRepository, useValue: mockUserRepo },
      ],
    }).compile()

    service = module.get<ConversationService>(ConversationService)
  })

  afterEach(() => {
    jest.clearAllMocks()
    jest.resetAllMocks()
  })

  afterAll(async () => {
    jest.restoreAllMocks()
    if (module) {
      await module.close()
    }
  })

  describe('getUserConversations', () => {
    it('should get user conversations successfully', async () => {
      // Arrange - Chuẩn bị dữ liệu lấy danh sách cuộc trò chuyện
      const userId = 1
      const options = createTestData.getUserConversationsOptions()
      const mockConversation = createTestData.conversation()
      const mockResult = {
        data: [mockConversation],
        pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
        stats: createTestData.conversationStats(),
      }

      mockConversationRepo.findUserConversations.mockResolvedValue(mockResult)

      // Act - Thực hiện lấy danh sách cuộc trò chuyện
      const result = await service.getUserConversations(userId, options)

      // Assert - Kiểm tra kết quả
      expect(result.data).toHaveLength(1)
      expect(result.data[0]).toMatchObject({
        ...mockConversation,
        unreadCount: 0,
        currentUserRole: 'MEMBER',
        isCurrentUserAdmin: false,
        memberCount: 1,
      })
      expect(mockConversationRepo.findUserConversations).toHaveBeenCalledWith(userId, options)
    })

    it('should enrich direct conversation with other user info when no name', async () => {
      // Arrange - Chuẩn bị dữ liệu cuộc trò chuyện direct không có tên
      const userId = 1
      const options = createTestData.getUserConversationsOptions()
      const otherUser = createTestData.user({ id: 2, name: 'Trần Thị B' })
      const mockConversation = createTestData.conversation({
        type: 'DIRECT',
        name: null,
        members: [
          createTestData.conversationMember({ userId: 1 }),
          createTestData.conversationMember({ userId: 2, id: 'member-2', user: otherUser }),
        ],
      })
      const mockResult = {
        data: [mockConversation],
        pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
        stats: createTestData.conversationStats(),
      }

      mockConversationRepo.findUserConversations.mockResolvedValue(mockResult)

      // Act - Thực hiện lấy danh sách cuộc trò chuyện
      const result = await service.getUserConversations(userId, options)

      // Assert - Kiểm tra tên được gán từ user khác
      expect(result.data[0].name).toBe('Trần Thị B')
      expect(result.data[0].avatar).toBe(otherUser.avatar)
    })

    it('should handle group conversations with admin role', async () => {
      // Arrange - Chuẩn bị dữ liệu cuộc trò chuyện nhóm với role admin
      const userId = 1
      const options = createTestData.getUserConversationsOptions()
      const mockGroupConversation = createTestData.groupConversation({
        members: [createTestData.conversationMember({ userId: 1, role: 'ADMIN' })],
      })
      const mockResult = {
        data: [mockGroupConversation],
        pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
        stats: createTestData.conversationStats(),
      }

      mockConversationRepo.findUserConversations.mockResolvedValue(mockResult)

      // Act - Thực hiện lấy danh sách cuộc trò chuyện
      const result = await service.getUserConversations(userId, options)

      // Assert - Kiểm tra role admin
      expect(result.data[0].currentUserRole).toBe('ADMIN')
      expect(result.data[0].isCurrentUserAdmin).toBe(true)
    })
  })

  describe('getConversationById', () => {
    it('should get conversation by ID successfully', async () => {
      // Arrange - Chuẩn bị dữ liệu lấy cuộc trò chuyện theo ID
      const conversationId = 'conv-1'
      const userId = 1
      const mockConversation = createTestData.conversation()

      mockConversationRepo.findById.mockResolvedValue(mockConversation)

      // Act - Thực hiện lấy cuộc trò chuyện
      const result = await service.getConversationById(conversationId, userId)

      // Assert - Kiểm tra kết quả
      expect(result).toMatchObject({
        ...mockConversation,
        unreadCount: 0,
        currentUserRole: 'MEMBER',
        isCurrentUserAdmin: false,
        memberCount: 1,
      })
      expect(mockConversationRepo.findById).toHaveBeenCalledWith(conversationId, userId)
    })

    it('should throw error when conversation not found', async () => {
      // Arrange - Chuẩn bị dữ liệu cuộc trò chuyện không tồn tại
      const conversationId = 'conv-999'
      const userId = 1

      mockConversationRepo.findById.mockResolvedValue(null)

      // Act & Assert - Thực hiện test và kiểm tra lỗi
      await expect(service.getConversationById(conversationId, userId)).rejects.toThrow(
        new NotFoundException('Cuộc trò chuyện không tồn tại hoặc bạn không có quyền truy cập'),
      )
    })
  })

  describe('createDirectConversation', () => {
    it('should create direct conversation successfully', async () => {
      // Arrange - Chuẩn bị dữ liệu tạo cuộc trò chuyện direct
      const userId = 1
      const recipientId = 2
      const recipient = createTestData.user({ id: 2, status: 'ACTIVE' })
      const mockCreatedConversation = createTestData.conversation({
        type: 'DIRECT',
        members: [
          createTestData.conversationMember({ userId: 1 }),
          createTestData.conversationMember({ userId: 2, id: 'member-2' }),
        ],
      })

      mockUserRepo.findById.mockResolvedValue(recipient)
      mockConversationRepo.findDirectConversation.mockResolvedValue(null)
      mockConversationRepo.create.mockResolvedValue(mockCreatedConversation)
      mockConversationRepo.findById.mockResolvedValue(mockCreatedConversation)

      // Act - Thực hiện tạo cuộc trò chuyện direct
      const result = await service.createDirectConversation(userId, recipientId)

      // Assert - Kiểm tra kết quả
      expect(result).toMatchObject(mockCreatedConversation)
      expect(mockUserRepo.findById).toHaveBeenCalledWith(recipientId)
      expect(mockConversationRepo.findDirectConversation).toHaveBeenCalledWith(userId, recipientId)
      expect(mockConversationRepo.create).toHaveBeenCalledWith({
        type: 'DIRECT',
        memberIds: [userId, recipientId],
      })
    })

    it('should return existing direct conversation if already exists', async () => {
      // Arrange - Chuẩn bị dữ liệu cuộc trò chuyện đã tồn tại
      const userId = 1
      const recipientId = 2
      const recipient = createTestData.user({ id: 2, status: 'ACTIVE' })
      const existingConversation = createTestData.conversation({ id: 'existing-conv' })

      mockUserRepo.findById.mockResolvedValue(recipient)
      mockConversationRepo.findDirectConversation.mockResolvedValue(existingConversation)
      mockConversationRepo.findById.mockResolvedValue(existingConversation)

      // Act - Thực hiện tạo cuộc trò chuyện direct
      const result = await service.createDirectConversation(userId, recipientId)

      // Assert - Kiểm tra trả về conversation đã tồn tại
      expect(result.id).toBe('existing-conv')
      expect(mockConversationRepo.create).not.toHaveBeenCalled()
    })

    it('should throw error when recipient not found or inactive', async () => {
      // Arrange - Chuẩn bị dữ liệu recipient không tồn tại
      const userId = 1
      const recipientId = 999

      mockUserRepo.findById.mockResolvedValue(null)

      // Act & Assert - Thực hiện test và kiểm tra lỗi
      await expect(service.createDirectConversation(userId, recipientId)).rejects.toThrow(
        new NotFoundException('Người dùng không tồn tại hoặc không hoạt động'),
      )
    })

    it('should throw error when trying to create conversation with self', async () => {
      // Arrange - Chuẩn bị dữ liệu tạo cuộc trò chuyện với chính mình
      const userId = 1
      const recipientId = 1

      const recipient = createTestData.user({ id: 1, status: 'ACTIVE' })
      mockUserRepo.findById.mockResolvedValue(recipient)

      // Act & Assert - Thực hiện test và kiểm tra lỗi
      await expect(service.createDirectConversation(userId, recipientId)).rejects.toThrow(
        new BadRequestException('Không thể tạo cuộc trò chuyện với chính mình'),
      )
    })
  })

  describe('createGroupConversation', () => {
    it('should create group conversation successfully', async () => {
      // Arrange - Chuẩn bị dữ liệu tạo cuộc trò chuyện nhóm
      const ownerId = 1
      const groupData = createTestData.createGroupData()
      const members = [
        createTestData.user({ id: 1, status: 'ACTIVE' }),
        createTestData.user({ id: 2, status: 'ACTIVE' }),
        createTestData.user({ id: 3, status: 'ACTIVE' }),
      ]
      const mockCreatedConversation = createTestData.groupConversation()

      mockUserRepo.findByIds.mockResolvedValue(members)
      mockConversationRepo.create.mockResolvedValue(mockCreatedConversation)
      mockConversationRepo.findById.mockResolvedValue(mockCreatedConversation)
      mockMessageRepo.create.mockResolvedValue(createTestData.message())

      // Act - Thực hiện tạo cuộc trò chuyện nhóm
      const result = await service.createGroupConversation(ownerId, groupData)

      // Assert - Kiểm tra kết quả
      expect(result).toMatchObject(mockCreatedConversation)
      expect(mockUserRepo.findByIds).toHaveBeenCalledWith([1, 2, 3])
      expect(mockConversationRepo.create).toHaveBeenCalledWith({
        type: 'GROUP',
        name: groupData.name,
        description: groupData.description,
        avatar: groupData.avatar,
        ownerId,
        memberIds: [1, 2, 3],
      })
      expect(mockMessageRepo.create).toHaveBeenCalled()
    })

    it('should throw error when group name is empty', async () => {
      // Arrange - Chuẩn bị dữ liệu với tên nhóm trống
      const ownerId = 1
      const groupData = createTestData.createGroupData({ name: '   ' })

      // Act & Assert - Thực hiện test và kiểm tra lỗi
      await expect(service.createGroupConversation(ownerId, groupData)).rejects.toThrow(
        new BadRequestException('Tên nhóm không được để trống'),
      )
    })

    it('should throw error when group has less than 3 members', async () => {
      // Arrange - Chuẩn bị dữ liệu với ít hơn 3 thành viên
      const ownerId = 1
      const groupData = createTestData.createGroupData({ memberIds: [2] }) // chỉ có owner + 1 member = 2 người
      const members = [
        createTestData.user({ id: 1, status: 'ACTIVE' }),
        createTestData.user({ id: 2, status: 'ACTIVE' }),
      ]

      mockUserRepo.findByIds.mockResolvedValue(members)

      // Act & Assert - Thực hiện test và kiểm tra lỗi
      await expect(service.createGroupConversation(ownerId, groupData)).rejects.toThrow(
        new BadRequestException('Nhóm phải có ít nhất 3 thành viên'),
      )
    })

    it('should throw error when group has more than 100 members', async () => {
      // Arrange - Chuẩn bị dữ liệu với hơn 100 thành viên
      const ownerId = 1
      const memberIds = Array.from({ length: 100 }, (_, i) => i + 2) // 100 members + owner = 101
      const groupData = createTestData.createGroupData({ memberIds })
      const members = Array.from({ length: 101 }, (_, i) => createTestData.user({ id: i + 1, status: 'ACTIVE' }))

      mockUserRepo.findByIds.mockResolvedValue(members)

      // Act & Assert - Thực hiện test và kiểm tra lỗi
      await expect(service.createGroupConversation(ownerId, groupData)).rejects.toThrow(
        new BadRequestException('Nhóm không thể có quá 100 thành viên'),
      )
    })

    it('should throw error when some members are inactive', async () => {
      // Arrange - Chuẩn bị dữ liệu với thành viên không hoạt động
      const ownerId = 1
      const groupData = createTestData.createGroupData()
      const members = [
        createTestData.user({ id: 1, status: 'ACTIVE' }),
        createTestData.user({ id: 2, status: 'INACTIVE' }), // Inactive member
        createTestData.user({ id: 3, status: 'ACTIVE' }),
      ]

      mockUserRepo.findByIds.mockResolvedValue(members)

      // Act & Assert - Thực hiện test và kiểm tra lỗi
      await expect(service.createGroupConversation(ownerId, groupData)).rejects.toThrow(
        new BadRequestException('Một số thành viên không tồn tại hoặc không hoạt động'),
      )
    })
  })

  describe('updateConversation', () => {
    it('should update group conversation successfully', async () => {
      // Arrange - Chuẩn bị dữ liệu cập nhật cuộc trò chuyện nhóm
      const conversationId = 'conv-1'
      const userId = 1
      const updateData = { name: 'Tên nhóm mới', description: 'Mô tả mới' }
      const mockConversation = createTestData.groupConversation({ type: 'GROUP' })
      const mockUpdatedConversation = createTestData.groupConversation({
        ...updateData,
      })
      const user = createTestData.user()

      mockConversationRepo.findById.mockResolvedValue(mockConversation)
      mockConversationRepo.getUserRole.mockResolvedValue('ADMIN')
      mockConversationRepo.update.mockResolvedValue(mockUpdatedConversation)
      mockConversationRepo.findById.mockResolvedValue(mockUpdatedConversation)
      mockUserRepo.findById.mockResolvedValue(user)
      mockMessageRepo.create.mockResolvedValue(createTestData.message())

      // Act - Thực hiện cập nhật cuộc trò chuyện
      const result = await service.updateConversation(conversationId, userId, updateData)

      // Assert - Kiểm tra kết quả
      expect(result).toMatchObject(mockUpdatedConversation)
      expect(mockConversationRepo.getUserRole).toHaveBeenCalledWith(conversationId, userId)
      expect(mockConversationRepo.update).toHaveBeenCalledWith(conversationId, {
        name: updateData.name.trim(),
        description: updateData.description.trim(),
      })
      expect(mockMessageRepo.create).toHaveBeenCalled()
    })

    it('should throw error when trying to update direct conversation', async () => {
      // Arrange - Chuẩn bị dữ liệu cập nhật cuộc trò chuyện direct
      const conversationId = 'conv-1'
      const userId = 1
      const updateData = { name: 'Tên mới' }
      const mockDirectConversation = createTestData.conversation({ type: 'DIRECT' })

      mockConversationRepo.findById.mockResolvedValue(mockDirectConversation)

      // Act & Assert - Thực hiện test và kiểm tra lỗi
      await expect(service.updateConversation(conversationId, userId, updateData)).rejects.toThrow(
        new BadRequestException('Không thể cập nhật thông tin cuộc trò chuyện 1-1'),
      )
    })

    it('should throw error when user is not admin', async () => {
      // Arrange - Chuẩn bị dữ liệu với user không phải admin
      const conversationId = 'conv-1'
      const userId = 2
      const updateData = { name: 'Tên mới' }
      const mockConversation = createTestData.groupConversation()

      mockConversationRepo.findById.mockResolvedValue(mockConversation)
      mockConversationRepo.getUserRole.mockResolvedValue('MEMBER')

      // Act & Assert - Thực hiện test và kiểm tra lỗi
      await expect(service.updateConversation(conversationId, userId, updateData)).rejects.toThrow(
        new ForbiddenException('Chỉ quản trị viên mới có thể cập nhật thông tin nhóm'),
      )
    })

    it('should throw error when name is empty', async () => {
      // Arrange - Chuẩn bị dữ liệu với tên trống
      const conversationId = 'conv-1'
      const userId = 1
      const updateData = { name: '   ' }
      const mockConversation = createTestData.groupConversation()

      mockConversationRepo.findById.mockResolvedValue(mockConversation)
      mockConversationRepo.getUserRole.mockResolvedValue('ADMIN')

      // Act & Assert - Thực hiện test và kiểm tra lỗi
      await expect(service.updateConversation(conversationId, userId, updateData)).rejects.toThrow(
        new BadRequestException('Tên nhóm không được để trống'),
      )
    })
  })

  describe('archiveConversation', () => {
    it('should archive conversation successfully', async () => {
      // Arrange - Chuẩn bị dữ liệu lưu trữ cuộc trò chuyện
      const conversationId = 'conv-1'
      const userId = 1

      mockConversationRepo.isUserMember.mockResolvedValue(true)
      mockConversationRepo.archive.mockResolvedValue({} as any)

      // Act - Thực hiện lưu trữ cuộc trò chuyện
      const result = await service.archiveConversation(conversationId, userId)

      // Assert - Kiểm tra kết quả
      expect(result).toEqual({ message: 'Đã lưu trữ cuộc trò chuyện' })
      expect(mockConversationRepo.isUserMember).toHaveBeenCalledWith(conversationId, userId)
      expect(mockConversationRepo.archive).toHaveBeenCalledWith(conversationId, true)
    })

    it('should throw error when user is not member', async () => {
      // Arrange - Chuẩn bị dữ liệu với user không phải thành viên
      const conversationId = 'conv-1'
      const userId = 999

      mockConversationRepo.isUserMember.mockResolvedValue(false)

      // Act & Assert - Thực hiện test và kiểm tra lỗi
      await expect(service.archiveConversation(conversationId, userId)).rejects.toThrow(
        new ForbiddenException('Bạn không có quyền thực hiện hành động này'),
      )
    })
  })

  describe('leaveConversation', () => {
    it('should leave direct conversation successfully', async () => {
      // Arrange - Chuẩn bị dữ liệu rời cuộc trò chuyện direct
      const conversationId = 'conv-1'
      const userId = 1
      const mockDirectConversation = createTestData.conversation({ type: 'DIRECT' })

      mockConversationRepo.findById.mockResolvedValue(mockDirectConversation)
      mockConversationRepo.getUserRole.mockResolvedValue('MEMBER')
      mockConversationRepo.removeMember.mockResolvedValue({} as any)

      // Act - Thực hiện rời cuộc trò chuyện
      const result = await service.leaveConversation(conversationId, userId)

      // Assert - Kiểm tra kết quả
      expect(result).toEqual({ message: 'Đã rời khỏi cuộc trò chuyện' })
      expect(mockConversationRepo.removeMember).toHaveBeenCalledWith(conversationId, userId)
    })

    it('should leave group conversation and transfer ownership when owner leaves', async () => {
      // Arrange - Chuẩn bị dữ liệu owner rời nhóm
      const conversationId = 'conv-1'
      const userId = 1
      const newOwner = createTestData.user({ id: 2, name: 'New Owner' })
      const mockGroupConversation = createTestData.groupConversation({
        type: 'GROUP',
        ownerId: 1,
        members: [
          createTestData.conversationMember({ userId: 1, role: 'ADMIN' }),
          createTestData.conversationMember({ userId: 2, role: 'MEMBER', id: 'member-2', user: newOwner }),
        ],
      })

      mockConversationRepo.findById.mockResolvedValue(mockGroupConversation)
      mockConversationRepo.getUserRole.mockResolvedValue('ADMIN')
      mockConversationRepo.update.mockResolvedValue({} as any)
      mockConversationRepo.updateMemberRole.mockResolvedValue({} as any)
      mockConversationRepo.removeMember.mockResolvedValue({} as any)
      mockUserRepo.findById.mockResolvedValue(createTestData.user())
      mockMessageRepo.create.mockResolvedValue(createTestData.message())

      // Act - Thực hiện owner rời nhóm
      const result = await service.leaveConversation(conversationId, userId)

      // Assert - Kiểm tra kết quả
      expect(result).toEqual({ message: 'Đã rời khỏi nhóm' })
      expect(mockConversationRepo.update).toHaveBeenCalledWith(conversationId, { ownerId: 2 })
      expect(mockConversationRepo.updateMemberRole).toHaveBeenCalledWith(conversationId, 2, 'ADMIN')
      expect(mockMessageRepo.create).toHaveBeenCalledTimes(2) // Transfer ownership + leave message
    })

    it('should archive conversation when last member leaves', async () => {
      // Arrange - Chuẩn bị dữ liệu thành viên cuối cùng rời nhóm
      const conversationId = 'conv-1'
      const userId = 1
      const mockGroupConversation = createTestData.groupConversation({
        ownerId: 1,
        members: [createTestData.conversationMember({ userId: 1, role: 'ADMIN' })],
      })

      mockConversationRepo.findById.mockResolvedValue(mockGroupConversation)
      mockConversationRepo.getUserRole.mockResolvedValue('ADMIN')
      mockConversationRepo.archive.mockResolvedValue({} as any)
      mockConversationRepo.removeMember.mockResolvedValue({} as any)
      mockUserRepo.findById.mockResolvedValue(createTestData.user())
      mockMessageRepo.create.mockResolvedValue(createTestData.message())

      // Act - Thực hiện thành viên cuối rời nhóm
      const result = await service.leaveConversation(conversationId, userId)

      // Assert - Kiểm tra kết quả
      expect(result).toEqual({ message: 'Đã rời khỏi nhóm' })
      expect(mockConversationRepo.archive).toHaveBeenCalledWith(conversationId, true)
    })
  })

  describe('addMembers', () => {
    it('should add members to group successfully', async () => {
      // Arrange - Chuẩn bị dữ liệu thêm thành viên vào nhóm
      const conversationId = 'conv-1'
      const userId = 1
      const memberIds = [3, 4]
      const mockGroupConversation = createTestData.groupConversation({
        members: [createTestData.conversationMember({ userId: 1, role: 'ADMIN' })],
      })
      const newMembers = [
        createTestData.user({ id: 3, status: 'ACTIVE' }),
        createTestData.user({ id: 4, status: 'ACTIVE' }),
      ]
      const addedMember = createTestData.conversationMember({ userId: 3, id: 'member-3' })

      mockConversationRepo.findById.mockResolvedValue(mockGroupConversation)
      mockConversationRepo.getUserRole.mockResolvedValue('ADMIN')
      mockUserRepo.findByIds.mockResolvedValue(newMembers)
      mockConversationRepo.isUserMember.mockResolvedValue(false)
      mockConversationRepo.addMember.mockResolvedValue(addedMember)
      mockUserRepo.findById.mockResolvedValue(createTestData.user())
      mockMessageRepo.create.mockResolvedValue(createTestData.message())

      // Act - Thực hiện thêm thành viên
      const result = await service.addMembers(conversationId, userId, memberIds)

      // Assert - Kiểm tra kết quả
      expect(mockUserRepo.findByIds).toHaveBeenCalledWith(memberIds)
      expect(mockConversationRepo.addMember).toHaveBeenCalledTimes(2)
      expect(mockMessageRepo.create).toHaveBeenCalled()
    })

    it('should throw error when trying to add members to direct conversation', async () => {
      // Arrange - Chuẩn bị dữ liệu thêm thành viên vào cuộc trò chuyện direct
      const conversationId = 'conv-1'
      const userId = 1
      const memberIds = [2]
      const mockDirectConversation = createTestData.conversation({ type: 'DIRECT' })

      mockConversationRepo.findById.mockResolvedValue(mockDirectConversation)

      // Act & Assert - Thực hiện test và kiểm tra lỗi
      await expect(service.addMembers(conversationId, userId, memberIds)).rejects.toThrow(
        new BadRequestException('Không thể thêm thành viên vào cuộc trò chuyện 1-1'),
      )
    })

    it('should throw error when user is not admin or moderator', async () => {
      // Arrange - Chuẩn bị dữ liệu với user không có quyền
      const conversationId = 'conv-1'
      const userId = 2
      const memberIds = [3]
      const mockGroupConversation = createTestData.groupConversation()

      mockConversationRepo.findById.mockResolvedValue(mockGroupConversation)
      mockConversationRepo.getUserRole.mockResolvedValue('MEMBER')

      // Act & Assert - Thực hiện test và kiểm tra lỗi
      await expect(service.addMembers(conversationId, userId, memberIds)).rejects.toThrow(
        new ForbiddenException('Chỉ quản trị viên và điều hành viên mới có thể thêm thành viên'),
      )
    })

    it('should throw error when exceeding member limit', async () => {
      // Arrange - Chuẩn bị dữ liệu vượt quá giới hạn thành viên
      const conversationId = 'conv-1'
      const userId = 1
      const memberIds = [3, 4]
      // Create conversation with 99 active members
      const existingMembers = Array.from({ length: 99 }, (_, i) =>
        createTestData.conversationMember({ userId: i + 1, id: `member-${i + 1}` }),
      )
      const mockGroupConversation = createTestData.groupConversation({
        members: existingMembers,
      })
      const newMembers = [
        createTestData.user({ id: 3, status: 'ACTIVE' }),
        createTestData.user({ id: 4, status: 'ACTIVE' }),
      ]

      mockConversationRepo.findById.mockResolvedValue(mockGroupConversation)
      mockConversationRepo.getUserRole.mockResolvedValue('ADMIN')
      mockUserRepo.findByIds.mockResolvedValue(newMembers)

      // Act & Assert - Thực hiện test và kiểm tra lỗi
      await expect(service.addMembers(conversationId, userId, memberIds)).rejects.toThrow(
        new BadRequestException('Nhóm không thể có quá 100 thành viên'),
      )
    })
  })

  describe('edge cases and error handling', () => {
    it('should handle repository errors gracefully', async () => {
      // Arrange - Chuẩn bị lỗi từ repository
      const userId = 1
      const options = createTestData.getUserConversationsOptions()
      const repositoryError = new Error('Database connection failed')

      mockConversationRepo.findUserConversations.mockRejectedValue(repositoryError)

      // Act & Assert - Thực hiện test và kiểm tra lỗi từ repository
      await expect(service.getUserConversations(userId, options)).rejects.toThrow('Database connection failed')
    })

    it('should handle concurrent member updates', async () => {
      // Arrange - Chuẩn bị test concurrent member updates
      const conversationId = 'conv-1'
      const userId = 1
      const memberId = 2
      const role = 'ADMIN' as const
      const mockConversation = createTestData.groupConversation()

      mockConversationRepo.findById.mockResolvedValue(mockConversation)
      mockConversationRepo.getUserRole.mockResolvedValue('ADMIN')
      mockConversationRepo.updateMemberRole.mockResolvedValue({} as any)
      mockUserRepo.findById.mockResolvedValue(createTestData.user())
      mockMessageRepo.create.mockResolvedValue(createTestData.message())

      // Act - Thực hiện cập nhật role
      const result = await service.updateMemberRole(conversationId, userId, memberId, role)

      // Assert - Kiểm tra kết quả
      expect(result).toEqual({ message: 'Đã cập nhật vai trò thành viên' })
      expect(mockConversationRepo.updateMemberRole).toHaveBeenCalledWith(conversationId, memberId, role)
    })

    it('should handle invalid user data', async () => {
      // Arrange - Chuẩn bị dữ liệu user không hợp lệ
      const userId = 1
      const recipientId = 2

      mockUserRepo.findById.mockResolvedValue(createTestData.user({ id: 2, status: 'BLOCKED' }))

      // Act & Assert - Thực hiện test và kiểm tra lỗi
      await expect(service.createDirectConversation(userId, recipientId)).rejects.toThrow(
        new NotFoundException('Người dùng không tồn tại hoặc không hoạt động'),
      )
    })

    // NEW: Test for updateConversation with empty name
    it('should throw error when updating conversation with empty name', async () => {
      const conversationId = 'conv-1'
      const userId = 1
      const mockConversation = createTestData.groupConversation()

      mockConversationRepo.findById.mockResolvedValue(mockConversation)
      mockConversationRepo.getUserRole.mockResolvedValue('ADMIN')

      await expect(service.updateConversation(conversationId, userId, { name: '   ' })).rejects.toThrow(
        new BadRequestException('Tên nhóm không được để trống'),
      )
    })

    // NEW: Test for updateConversation with description only
    it('should update conversation with description only', async () => {
      const conversationId = 'conv-1'
      const userId = 1
      const mockConversation = createTestData.groupConversation()
      const mockUser = createTestData.user()

      mockConversationRepo.findById.mockResolvedValue(mockConversation)
      mockConversationRepo.getUserRole.mockResolvedValue('ADMIN')
      mockConversationRepo.update.mockResolvedValue(mockConversation)
      mockUserRepo.findById.mockResolvedValue(mockUser)
      mockMessageRepo.create.mockResolvedValue(createTestData.message())

      const result = await service.updateConversation(conversationId, userId, { description: 'New description' })

      expect(mockConversationRepo.update).toHaveBeenCalledWith(conversationId, { description: 'New description' })
      expect(mockMessageRepo.create).toHaveBeenCalled()
    })

    // NEW: Test for updateConversation with avatar only
    it('should update conversation with avatar only', async () => {
      const conversationId = 'conv-1'
      const userId = 1
      const mockConversation = createTestData.groupConversation()
      const mockUser = createTestData.user()

      mockConversationRepo.findById.mockResolvedValue(mockConversation)
      mockConversationRepo.getUserRole.mockResolvedValue('ADMIN')
      mockConversationRepo.update.mockResolvedValue(mockConversation)
      mockUserRepo.findById.mockResolvedValue(mockUser)
      mockMessageRepo.create.mockResolvedValue(createTestData.message())

      const result = await service.updateConversation(conversationId, userId, { avatar: 'new-avatar.jpg' })

      expect(mockConversationRepo.update).toHaveBeenCalledWith(conversationId, { avatar: 'new-avatar.jpg' })
      expect(mockMessageRepo.create).toHaveBeenCalled()
    })

    // NEW: Test for updateConversation with empty description (should set to null)
    it('should set description to null when updating with empty string', async () => {
      const conversationId = 'conv-1'
      const userId = 1
      const mockConversation = createTestData.groupConversation()
      const mockUser = createTestData.user()

      mockConversationRepo.findById.mockResolvedValue(mockConversation)
      mockConversationRepo.getUserRole.mockResolvedValue('ADMIN')
      mockConversationRepo.update.mockResolvedValue(mockConversation)
      mockUserRepo.findById.mockResolvedValue(mockUser)
      mockMessageRepo.create.mockResolvedValue(createTestData.message())

      const result = await service.updateConversation(conversationId, userId, { description: '' })

      expect(mockConversationRepo.update).toHaveBeenCalledWith(conversationId, { description: null })
    })

    // NEW: Test for leaveConversation when user is not a member
    it('should throw error when leaving conversation as non-member', async () => {
      const conversationId = 'conv-1'
      const userId = 999
      const mockConversation = createTestData.groupConversation()

      mockConversationRepo.findById.mockResolvedValue(mockConversation)
      mockConversationRepo.getUserRole.mockResolvedValue(null)

      await expect(service.leaveConversation(conversationId, userId)).rejects.toThrow(
        new NotFoundException('Bạn không phải thành viên của cuộc trò chuyện này'),
      )
    })

    // NEW: Test for leaveConversation when owner leaves and transfers ownership to admin
    it('should transfer ownership to admin when owner leaves group', async () => {
      const conversationId = 'conv-1'
      const userId = 1 // owner
      const mockConversation = createTestData.groupConversation({
        ownerId: 1,
        members: [
          createTestData.conversationMember({ userId: 1, role: 'ADMIN' }),
          createTestData.conversationMember({ userId: 2, role: 'ADMIN' }),
          createTestData.conversationMember({ userId: 3, role: 'MEMBER' }),
        ],
      })
      const mockUser = createTestData.user()

      mockConversationRepo.findById.mockResolvedValue(mockConversation)
      mockConversationRepo.getUserRole.mockResolvedValue('ADMIN')
      mockConversationRepo.update.mockResolvedValue(mockConversation)
      mockConversationRepo.removeMember.mockResolvedValue({} as any)
      mockUserRepo.findById.mockResolvedValue(mockUser)
      mockMessageRepo.create.mockResolvedValue(createTestData.message())

      const result = await service.leaveConversation(conversationId, userId)

      expect(mockConversationRepo.update).toHaveBeenCalledWith(conversationId, { ownerId: 2 })
      expect(result).toEqual({ message: 'Đã rời khỏi nhóm' })
    })

    // NEW: Test for leaveConversation when owner leaves and transfers ownership to first member
    it('should transfer ownership to first member when owner leaves and no admin exists', async () => {
      const conversationId = 'conv-1'
      const userId = 1 // owner
      const mockConversation = createTestData.groupConversation({
        ownerId: 1,
        members: [
          createTestData.conversationMember({ userId: 1, role: 'ADMIN' }),
          createTestData.conversationMember({ userId: 2, role: 'MEMBER' }),
          createTestData.conversationMember({ userId: 3, role: 'MEMBER' }),
        ],
      })
      const mockUser = createTestData.user()

      mockConversationRepo.findById.mockResolvedValue(mockConversation)
      mockConversationRepo.getUserRole.mockResolvedValue('ADMIN')
      mockConversationRepo.update.mockResolvedValue(mockConversation)
      mockConversationRepo.updateMemberRole.mockResolvedValue({} as any)
      mockConversationRepo.removeMember.mockResolvedValue({} as any)
      mockUserRepo.findById.mockResolvedValue(mockUser)
      mockMessageRepo.create.mockResolvedValue(createTestData.message())

      const result = await service.leaveConversation(conversationId, userId)

      expect(mockConversationRepo.update).toHaveBeenCalledWith(conversationId, { ownerId: 2 })
      expect(mockConversationRepo.updateMemberRole).toHaveBeenCalledWith(conversationId, 2, 'ADMIN')
      expect(result).toEqual({ message: 'Đã rời khỏi nhóm' })
    })

    // NEW: Test for leaveConversation when last member leaves (should archive)
    it('should archive conversation when last member leaves', async () => {
      const conversationId = 'conv-1'
      const userId = 1
      const mockConversation = createTestData.groupConversation({
        ownerId: 1,
        members: [createTestData.conversationMember({ userId: 1, role: 'ADMIN' })],
      })
      const mockUser = createTestData.user()

      mockConversationRepo.findById.mockResolvedValue(mockConversation)
      mockConversationRepo.getUserRole.mockResolvedValue('ADMIN')
      mockConversationRepo.archive.mockResolvedValue({} as any)
      mockConversationRepo.removeMember.mockResolvedValue({} as any)
      mockUserRepo.findById.mockResolvedValue(mockUser)
      mockMessageRepo.create.mockResolvedValue(createTestData.message())

      const result = await service.leaveConversation(conversationId, userId)

      expect(mockConversationRepo.archive).toHaveBeenCalledWith(conversationId, true)
      expect(result).toEqual({ message: 'Đã rời khỏi nhóm' })
    })

    // NEW: Test for addMembers when member already exists
    it('should skip adding member if already exists', async () => {
      const conversationId = 'conv-1'
      const userId = 1
      const memberIds = [2, 3]
      const mockConversation = createTestData.groupConversation()
      const newMembers = [
        createTestData.user({ id: 2, status: 'ACTIVE' }),
        createTestData.user({ id: 3, status: 'ACTIVE' }),
      ]
      const mockUser = createTestData.user()

      mockConversationRepo.findById.mockResolvedValue(mockConversation)
      mockConversationRepo.getUserRole.mockResolvedValue('ADMIN')
      mockUserRepo.findByIds.mockResolvedValue(newMembers)
      mockConversationRepo.isUserMember.mockResolvedValueOnce(true).mockResolvedValueOnce(false)
      mockConversationRepo.addMember.mockResolvedValue(createTestData.conversationMember({ userId: 3 }))
      mockUserRepo.findById.mockResolvedValue(mockUser)
      mockMessageRepo.create.mockResolvedValue(createTestData.message())

      const result = await service.addMembers(conversationId, userId, memberIds)

      expect(mockConversationRepo.addMember).toHaveBeenCalledTimes(1)
      expect(mockConversationRepo.addMember).toHaveBeenCalledWith(conversationId, 3)
    })
  })

  // ===== ERROR CASES TESTS =====

  describe('unarchiveConversation', () => {
    it('should unarchive conversation successfully', async () => {
      const conversationId = 'conv-1'
      const userId = 1

      mockConversationRepo.isUserMember.mockResolvedValue(true)
      mockConversationRepo.archive.mockResolvedValue(createTestData.conversation() as any)

      const result = await service.unarchiveConversation(conversationId, userId)

      expect(result).toEqual({ message: 'Đã khôi phục cuộc trò chuyện' })
      expect(mockConversationRepo.isUserMember).toHaveBeenCalledWith(conversationId, userId)
      expect(mockConversationRepo.archive).toHaveBeenCalledWith(conversationId, false)
    })

    it('should throw ForbiddenException when user is not a member', async () => {
      const conversationId = 'conv-1'
      const userId = 1

      mockConversationRepo.isUserMember.mockResolvedValue(false)

      await expect(service.unarchiveConversation(conversationId, userId)).rejects.toThrow(ForbiddenException)
      expect(mockConversationRepo.isUserMember).toHaveBeenCalledWith(conversationId, userId)
    })
  })

  describe('leaveConversation - error cases', () => {
    it('should throw NotFoundException when conversation not found', async () => {
      const conversationId = 'conv-1'
      const userId = 1

      mockConversationRepo.findById.mockResolvedValue(null)

      await expect(service.leaveConversation(conversationId, userId)).rejects.toThrow(NotFoundException)
      expect(mockConversationRepo.findById).toHaveBeenCalledWith(conversationId)
    })
  })

  describe('addMembers - error cases', () => {
    it('should throw NotFoundException when conversation not found', async () => {
      const conversationId = 'conv-1'
      const userId = 1
      const memberIds = [2, 3]

      mockConversationRepo.findById.mockResolvedValue(null)

      await expect(service.addMembers(conversationId, userId, memberIds)).rejects.toThrow(NotFoundException)
      expect(mockConversationRepo.findById).toHaveBeenCalledWith(conversationId)
    })

    it('should throw BadRequestException when adding members to direct conversation', async () => {
      const conversationId = 'conv-1'
      const userId = 1
      const memberIds = [2, 3]

      mockConversationRepo.findById.mockResolvedValue(
        createTestData.conversation({
          type: 'DIRECT',
        }),
      )

      await expect(service.addMembers(conversationId, userId, memberIds)).rejects.toThrow(BadRequestException)
    })

    it('should throw BadRequestException when some users are invalid', async () => {
      const conversationId = 'conv-2'
      const userId = 1
      const memberIds = [2, 3, 4]

      mockConversationRepo.findById.mockResolvedValue(
        createTestData.groupConversation({
          id: conversationId,
        }),
      )
      mockConversationRepo.getUserRole.mockResolvedValue('ADMIN')
      mockUserRepo.findByIds.mockResolvedValue([
        createTestData.user({ id: 2, status: 'ACTIVE' }),
        createTestData.user({ id: 3, status: 'INACTIVE' }), // Invalid user
      ])

      await expect(service.addMembers(conversationId, userId, memberIds)).rejects.toThrow(BadRequestException)
    })
  })

  describe('removeMember - error cases', () => {
    it('should throw NotFoundException when conversation not found', async () => {
      const conversationId = 'conv-1'
      const userId = 1
      const memberId = 2

      mockConversationRepo.findById.mockResolvedValue(null)

      await expect(service.removeMember(conversationId, userId, memberId)).rejects.toThrow(NotFoundException)
    })

    it('should throw BadRequestException when removing from direct conversation', async () => {
      const conversationId = 'conv-1'
      const userId = 1
      const memberId = 2

      mockConversationRepo.findById.mockResolvedValue(
        createTestData.conversation({
          type: 'DIRECT',
        }),
      )

      await expect(service.removeMember(conversationId, userId, memberId)).rejects.toThrow(BadRequestException)
    })

    it('should throw ForbiddenException when user is not admin', async () => {
      const conversationId = 'conv-2'
      const userId = 1
      const memberId = 2

      mockConversationRepo.findById.mockResolvedValue(createTestData.groupConversation())
      mockConversationRepo.getUserRole.mockResolvedValue('MEMBER')

      await expect(service.removeMember(conversationId, userId, memberId)).rejects.toThrow(ForbiddenException)
    })

    it('should throw BadRequestException when removing conversation owner', async () => {
      const conversationId = 'conv-2'
      const userId = 1
      const memberId = 1 // Owner

      mockConversationRepo.findById.mockResolvedValue(
        createTestData.groupConversation({
          ownerId: 1,
        }),
      )
      mockConversationRepo.getUserRole.mockResolvedValue('ADMIN')

      await expect(service.removeMember(conversationId, userId, memberId)).rejects.toThrow(BadRequestException)
    })

    it('should throw BadRequestException when removing self', async () => {
      const conversationId = 'conv-2'
      const userId = 1
      const memberId = 1 // Same as userId

      mockConversationRepo.findById.mockResolvedValue(
        createTestData.groupConversation({
          ownerId: 2,
        }),
      )
      mockConversationRepo.getUserRole.mockResolvedValue('ADMIN')

      await expect(service.removeMember(conversationId, userId, memberId)).rejects.toThrow(BadRequestException)
    })

    it('should throw NotFoundException when member not found in group', async () => {
      const conversationId = 'conv-2'
      const userId = 1
      const memberId = 999

      mockConversationRepo.findById.mockResolvedValue(
        createTestData.groupConversation({
          ownerId: 1,
          members: [
            createTestData.conversationMember({
              userId: 1,
              role: 'ADMIN',
            }),
            createTestData.conversationMember({
              userId: 2,
              role: 'MEMBER',
            }),
          ],
        }),
      )
      mockConversationRepo.getUserRole.mockResolvedValue('ADMIN')

      await expect(service.removeMember(conversationId, userId, memberId)).rejects.toThrow(NotFoundException)
    })
  })

  describe('updateMemberRole - error cases', () => {
    it('should throw NotFoundException when conversation not found', async () => {
      const conversationId = 'conv-1'
      const userId = 1
      const memberId = 2
      const role = 'MODERATOR' as const

      mockConversationRepo.findById.mockResolvedValue(null)

      await expect(service.updateMemberRole(conversationId, userId, memberId, role)).rejects.toThrow(NotFoundException)
    })

    it('should throw BadRequestException when updating role in direct conversation', async () => {
      const conversationId = 'conv-1'
      const userId = 1
      const memberId = 2
      const role = 'MODERATOR' as const

      mockConversationRepo.findById.mockResolvedValue(
        createTestData.conversation({
          type: 'DIRECT',
        }),
      )

      await expect(service.updateMemberRole(conversationId, userId, memberId, role)).rejects.toThrow(
        BadRequestException,
      )
    })

    it('should throw ForbiddenException when user is not admin', async () => {
      const conversationId = 'conv-2'
      const userId = 1
      const memberId = 2
      const role = 'MODERATOR' as const

      mockConversationRepo.findById.mockResolvedValue(createTestData.groupConversation())
      mockConversationRepo.getUserRole.mockResolvedValue('MEMBER')

      await expect(service.updateMemberRole(conversationId, userId, memberId, role)).rejects.toThrow(ForbiddenException)
    })

    it('should throw BadRequestException when updating owner role', async () => {
      const conversationId = 'conv-2'
      const userId = 1
      const memberId = 1 // Owner
      const role = 'MODERATOR' as const

      mockConversationRepo.findById.mockResolvedValue(
        createTestData.groupConversation({
          ownerId: 1,
        }),
      )
      mockConversationRepo.getUserRole.mockResolvedValue('ADMIN')

      await expect(service.updateMemberRole(conversationId, userId, memberId, role)).rejects.toThrow(
        BadRequestException,
      )
    })

    it('should throw BadRequestException when updating own role', async () => {
      const conversationId = 'conv-2'
      const userId = 1
      const memberId = 1 // Same as userId
      const role = 'MODERATOR' as const

      mockConversationRepo.findById.mockResolvedValue(
        createTestData.groupConversation({
          ownerId: 2,
        }),
      )
      mockConversationRepo.getUserRole.mockResolvedValue('ADMIN')

      await expect(service.updateMemberRole(conversationId, userId, memberId, role)).rejects.toThrow(
        BadRequestException,
      )
    })

    it('should throw NotFoundException when member not found in group', async () => {
      const conversationId = 'conv-2'
      const userId = 1
      const memberId = 999
      const role = 'MODERATOR' as const

      mockConversationRepo.findById.mockResolvedValue(
        createTestData.groupConversation({
          ownerId: 1,
          members: [
            createTestData.conversationMember({
              userId: 1,
              role: 'ADMIN',
            }),
            createTestData.conversationMember({
              userId: 2,
              role: 'MEMBER',
            }),
          ],
        }),
      )
      mockConversationRepo.getUserRole.mockResolvedValue('ADMIN')

      await expect(service.updateMemberRole(conversationId, userId, memberId, role)).rejects.toThrow(NotFoundException)
    })
  })

  describe('muteConversation - error cases', () => {
    it('should throw ForbiddenException when user is not a member', async () => {
      const conversationId = 'conv-1'
      const userId = 1

      mockConversationRepo.isUserMember.mockResolvedValue(false)

      await expect(service.muteConversation(conversationId, userId)).rejects.toThrow(ForbiddenException)
    })
  })

  describe('unmuteConversation - error cases', () => {
    it('should throw ForbiddenException when user is not a member', async () => {
      const conversationId = 'conv-1'
      const userId = 1

      mockConversationRepo.isUserMember.mockResolvedValue(false)

      await expect(service.unmuteConversation(conversationId, userId)).rejects.toThrow(ForbiddenException)
    })
  })

  describe('getConversationMembers - error cases', () => {
    it('should throw ForbiddenException when user is not a member', async () => {
      const conversationId = 'conv-1'
      const userId = 1

      mockConversationRepo.isUserMember.mockResolvedValue(false)

      await expect(service.getConversationMembers(conversationId, userId)).rejects.toThrow(ForbiddenException)
    })
  })
})
