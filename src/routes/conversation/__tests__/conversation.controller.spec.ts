import { Test, TestingModule } from '@nestjs/testing'
import { ConversationController } from '../conversation.controller'
import {
  AddMembersBodyDTO,
  ConversationParamsDTO,
  CreateDirectConversationBodyDTO,
  CreateGroupConversationBodyDTO,
  GetConversationsQueryDTO,
  MemberParamsDTO,
  UpdateConversationBodyDTO,
} from '../conversation.dto'
import { ConversationService } from '../conversation.service'
import { MessageService } from '../message.service'

// Test data factory để tạo dữ liệu test
const createTestData = {
  createDirectConversationBody: (overrides = {}): CreateDirectConversationBodyDTO => ({
    recipientId: 2,
    ...overrides,
  }),

  createGroupConversationBody: (overrides = {}): CreateGroupConversationBodyDTO => ({
    name: 'Nhóm chat',
    description: 'Nhóm thảo luận',
    memberIds: [2, 3],
    avatar: 'group-avatar.jpg',
    ...overrides,
  }),

  updateConversationBody: (overrides = {}): UpdateConversationBodyDTO => ({
    name: 'Tên nhóm mới',
    description: 'Mô tả mới',
    avatar: 'new-avatar.jpg',
    ...overrides,
  }),

  addMembersBody: (overrides = {}): AddMembersBodyDTO => ({
    conversationId: 'conv-1',
    memberIds: [4, 5],
    ...overrides,
  }),

  conversationParams: (overrides = {}): ConversationParamsDTO => ({
    conversationId: 'conv-1',
    ...overrides,
  }),

  memberParams: (overrides = {}): MemberParamsDTO => ({
    conversationId: 'conv-1',
    memberId: 2,
    ...overrides,
  }),

  getConversationsQuery: (overrides = {}): GetConversationsQueryDTO => ({
    page: 1,
    limit: 20,
    type: undefined,
    search: undefined,
    isArchived: false,
    ...overrides,
  }),

  user: (overrides = {}) => ({
    id: 1,
    name: 'Nguyễn Văn A',
    email: 'test@example.com',
    avatar: 'avatar.jpg',
    status: 'ACTIVE' as const,
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
    user: createTestData.user(),
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
    members: [createTestData.conversationMember()],
    unreadCount: 0,
    currentUserRole: 'MEMBER' as const,
    isCurrentUserAdmin: false,
    memberCount: 1,
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
    owner: createTestData.user(),
    members: [
      createTestData.conversationMember({ role: 'ADMIN', userId: 1 }),
      createTestData.conversationMember({ role: 'MEMBER', userId: 2, id: 'member-2' }),
    ],
    unreadCount: 0,
    currentUserRole: 'ADMIN' as const,
    isCurrentUserAdmin: true,
    memberCount: 2,
    ...overrides,
  }),

  conversationsList: (overrides = {}) => ({
    data: [createTestData.conversation()],
    pagination: {
      page: 1,
      limit: 20,
      total: 1,
      totalPages: 1,
    },
    stats: {
      totalUnread: 5,
      directCount: 3,
      groupCount: 2,
      archivedCount: 1,
    },
    ...overrides,
  }),

  conversationStats: (overrides = {}) => ({
    totalUnread: 5,
    directCount: 3,
    groupCount: 2,
    archivedCount: 1,
    ...overrides,
  }),

  conversationMembers: (overrides = []) => [
    createTestData.conversationMember(),
    createTestData.conversationMember({ userId: 2, id: 'member-2', role: 'MEMBER' }),
    ...overrides,
  ],

  // Message-related test data
  message: (overrides = {}) => ({
    id: 'msg-1',
    conversationId: 'conv-1',
    fromUserId: 1,
    content: 'Hello world',
    type: 'TEXT' as const,
    isDeleted: false,
    isEdited: false,
    editedAt: null,
    deletedForEveryone: false,
    replyToId: null,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    deletedAt: null,
    fromUser: createTestData.user(),
    attachments: [],
    reactions: [],
    readReceipts: [],
    replyTo: null,
    conversation: undefined,
    isReadByCurrentUser: false,
    readByCount: 0,
    ...overrides,
  }),

  messagesList: (overrides = {}) => ({
    data: [
      {
        ...createTestData.message(),
        isReadByCurrentUser: false,
        readByCount: 0,
      },
    ],
    pagination: {
      limit: 50,
      cursor: undefined,
      direction: 'backward' as const,
      hasMore: false,
      nextCursor: null,
      prevCursor: null,
    },
    ...overrides,
  }),

  sendMessageBody: (overrides = {}) => ({
    conversationId: 'conv-1',
    content: 'Hello world',
    type: 'TEXT' as const,
    ...overrides,
  }),

  getMessagesQuery: (overrides = {}) => ({
    limit: 50,
    cursor: undefined,
    direction: 'backward' as const,
    type: undefined,
    ...overrides,
  }),

  searchMessagesQuery: (overrides = {}) => ({
    q: 'search term',
    limit: 20,
    cursor: undefined,
    type: undefined,
    fromUserId: undefined,
    dateFrom: undefined,
    dateTo: undefined,
    ...overrides,
  }),

  messageParams: (overrides = {}) => ({
    messageId: 'msg-1',
    ...overrides,
  }),

  markAsReadBody: (overrides = {}) => ({
    conversationId: 'conv-1',
    messageId: 'msg-1',
    ...overrides,
  }),

  messageStats: (overrides = {}) => ({
    total: 100,
    byType: {
      TEXT: 80,
      IMAGE: 15,
      VIDEO: 5,
    },
    mediaCount: 20,
    ...overrides,
  }),

  searchResults: (overrides = {}) => ({
    data: [],
    pagination: {
      limit: 20,
      cursor: null,
      hasMore: false,
      nextCursor: null,
    },
    ...overrides,
  }),

  reactionResult: (overrides = {}) => ({
    action: 'added' as const,
    reaction: {
      id: 'reaction-1',
      messageId: 'msg-1',
      userId: 1,
      emoji: '👍',
      createdAt: new Date('2024-01-01'),
      user: createTestData.user(),
    },
    ...overrides,
  }),

  reactionStats: (overrides = {}) => ({
    '👍': 3,
    '❤️': 2,
    ...overrides,
  }),

  readReceiptStats: (overrides = {}) => ({
    readCount: 3,
    totalMembers: 5,
    readPercentage: 60,
    ...overrides,
  }),
}

describe('ConversationController', () => {
  let controller: ConversationController
  let module: TestingModule
  let mockConversationService: jest.Mocked<ConversationService>
  let mockMessageService: jest.Mocked<MessageService>

  beforeEach(async () => {
    // Tạo mock cho tất cả services
    mockConversationService = {
      getUserConversations: jest.fn(),
      getConversationById: jest.fn(),
      createDirectConversation: jest.fn(),
      createGroupConversation: jest.fn(),
      updateConversation: jest.fn(),
      archiveConversation: jest.fn(),
      unarchiveConversation: jest.fn(),
      muteConversation: jest.fn(),
      unmuteConversation: jest.fn(),
      leaveConversation: jest.fn(),
      addMembers: jest.fn(),
      removeMember: jest.fn(),
      updateMemberRole: jest.fn(),
      getConversationMembers: jest.fn(),
      getConversationStats: jest.fn(),
    } as any

    mockMessageService = {
      getConversationMessages: jest.fn(),
      getMessageStats: jest.fn(),
      searchMessages: jest.fn(),
      sendMessage: jest.fn(),
      getMessageById: jest.fn(),
      editMessage: jest.fn(),
      deleteMessage: jest.fn(),
      markAsRead: jest.fn(),
      reactToMessage: jest.fn(),
      removeReaction: jest.fn(),
      getReactionStats: jest.fn(),
      getReadReceiptStats: jest.fn(),
    } as any

    module = await Test.createTestingModule({
      controllers: [ConversationController],
      providers: [
        { provide: ConversationService, useValue: mockConversationService },
        { provide: MessageService, useValue: mockMessageService },
      ],
    }).compile()

    controller = module.get<ConversationController>(ConversationController)
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

  describe('getConversations', () => {
    it('should get conversations list successfully', async () => {
      // Arrange - Chuẩn bị dữ liệu lấy danh sách cuộc trò chuyện
      const userId = 1
      const query = createTestData.getConversationsQuery()
      const mockConversationsList = createTestData.conversationsList()

      mockConversationService.getUserConversations.mockResolvedValue(mockConversationsList)

      // Act - Thực hiện lấy danh sách cuộc trò chuyện
      const result = await controller.getConversations(userId, query)

      // Assert - Kiểm tra kết quả
      expect(result).toEqual(mockConversationsList)
      expect(mockConversationService.getUserConversations).toHaveBeenCalledWith(userId, query)
      expect(mockConversationService.getUserConversations).toHaveBeenCalledTimes(1)
    })

    it('should handle conversations list with type filter', async () => {
      // Arrange - Chuẩn bị dữ liệu với filter type
      const userId = 1
      const query = createTestData.getConversationsQuery({ type: 'GROUP' })
      const mockGroupConversationsList = createTestData.conversationsList({
        data: [createTestData.groupConversation()],
      })

      mockConversationService.getUserConversations.mockResolvedValue(mockGroupConversationsList)

      // Act - Thực hiện lấy danh sách cuộc trò chuyện nhóm
      const result = await controller.getConversations(userId, query)

      // Assert - Kiểm tra kết quả
      expect(result.data[0].type).toBe('GROUP')
      expect(mockConversationService.getUserConversations).toHaveBeenCalledWith(userId, query)
    })

    it('should handle conversations list with search query', async () => {
      // Arrange - Chuẩn bị dữ liệu với từ khóa tìm kiếm
      const userId = 1
      const query = createTestData.getConversationsQuery({ search: 'test' })
      const mockConversationsList = createTestData.conversationsList()

      mockConversationService.getUserConversations.mockResolvedValue(mockConversationsList)

      // Act - Thực hiện tìm kiếm cuộc trò chuyện
      const result = await controller.getConversations(userId, query)

      // Assert - Kiểm tra kết quả
      expect(result).toEqual(mockConversationsList)
      expect(mockConversationService.getUserConversations).toHaveBeenCalledWith(userId, query)
    })

    it('should handle conversations list with pagination', async () => {
      // Arrange - Chuẩn bị dữ liệu với pagination
      const userId = 1
      const query = createTestData.getConversationsQuery({ page: 2, limit: 10 })
      const mockConversationsList = createTestData.conversationsList({
        pagination: {
          page: 2,
          limit: 10,
          total: 25,
          totalPages: 3,
        },
      })

      mockConversationService.getUserConversations.mockResolvedValue(mockConversationsList)

      // Act - Thực hiện lấy danh sách cuộc trò chuyện
      const result = await controller.getConversations(userId, query)

      // Assert - Kiểm tra pagination
      expect(result.pagination.page).toBe(2)
      expect(result.pagination.limit).toBe(10)
      expect(result.pagination.totalPages).toBe(3)
    })
  })

  describe('getConversationStats', () => {
    it('should get conversation stats successfully', async () => {
      // Arrange - Chuẩn bị dữ liệu thống kê cuộc trò chuyện
      const userId = 1
      const mockStats = createTestData.conversationStats()

      mockConversationService.getConversationStats.mockResolvedValue(mockStats)

      // Act - Thực hiện lấy thống kê
      const result = await controller.getConversationStats(userId)

      // Assert - Kiểm tra kết quả
      expect(result).toEqual({
        message: 'Thống kê cuộc trò chuyện',
        data: mockStats,
      })
      expect(mockConversationService.getConversationStats).toHaveBeenCalledWith(userId)
    })
  })

  describe('getConversation', () => {
    it('should get conversation detail successfully', async () => {
      // Arrange - Chuẩn bị dữ liệu lấy chi tiết cuộc trò chuyện
      const userId = 1
      const params = createTestData.conversationParams()
      const mockConversation = createTestData.conversation()

      mockConversationService.getConversationById.mockResolvedValue(mockConversation)

      // Act - Thực hiện lấy chi tiết cuộc trò chuyện
      const result = await controller.getConversation(userId, params)

      // Assert - Kiểm tra kết quả
      expect(result).toEqual(mockConversation)
      expect(mockConversationService.getConversationById).toHaveBeenCalledWith(params.conversationId, userId)
      expect(mockConversationService.getConversationById).toHaveBeenCalledTimes(1)
    })

    it('should handle different conversation IDs', async () => {
      // Arrange - Chuẩn bị dữ liệu với conversation ID khác
      const userId = 1
      const params = createTestData.conversationParams({ conversationId: 'conv-2' })
      const mockGroupConversation = createTestData.groupConversation({ id: 'conv-2' })

      mockConversationService.getConversationById.mockResolvedValue(mockGroupConversation)

      // Act - Thực hiện lấy chi tiết cuộc trò chuyện
      const result = await controller.getConversation(userId, params)

      // Assert - Kiểm tra kết quả
      expect(result.id).toBe('conv-2')
      expect(result.type).toBe('GROUP')
      expect(mockConversationService.getConversationById).toHaveBeenCalledWith('conv-2', userId)
    })
  })

  describe('createDirectConversation', () => {
    it('should create direct conversation successfully', async () => {
      // Arrange - Chuẩn bị dữ liệu tạo cuộc trò chuyện direct
      const userId = 1
      const body = createTestData.createDirectConversationBody()
      const mockDirectConversation = createTestData.conversation()

      mockConversationService.createDirectConversation.mockResolvedValue(mockDirectConversation)

      // Act - Thực hiện tạo cuộc trò chuyện direct
      const result = await controller.createDirectConversation(userId, body)

      // Assert - Kiểm tra kết quả
      expect(result).toEqual(mockDirectConversation)
      expect(mockConversationService.createDirectConversation).toHaveBeenCalledWith(userId, body.recipientId)
      expect(mockConversationService.createDirectConversation).toHaveBeenCalledTimes(1)
    })

    it('should handle creating conversation with different recipients', async () => {
      // Arrange - Chuẩn bị dữ liệu với recipient khác
      const userId = 1
      const body = createTestData.createDirectConversationBody({ recipientId: 3 })
      const mockDirectConversation = createTestData.conversation()

      mockConversationService.createDirectConversation.mockResolvedValue(mockDirectConversation)

      // Act - Thực hiện tạo cuộc trò chuyện direct
      const result = await controller.createDirectConversation(userId, body)

      // Assert - Kiểm tra kết quả
      expect(result).toEqual(mockDirectConversation)
      expect(mockConversationService.createDirectConversation).toHaveBeenCalledWith(userId, 3)
    })
  })

  describe('createGroupConversation', () => {
    it('should create group conversation successfully', async () => {
      // Arrange - Chuẩn bị dữ liệu tạo cuộc trò chuyện nhóm
      const userId = 1
      const body = createTestData.createGroupConversationBody()
      const mockGroupConversation = createTestData.groupConversation()

      mockConversationService.createGroupConversation.mockResolvedValue(mockGroupConversation)

      // Act - Thực hiện tạo cuộc trò chuyện nhóm
      const result = await controller.createGroupConversation(userId, body)

      // Assert - Kiểm tra kết quả
      expect(result).toEqual(mockGroupConversation)
      expect(mockConversationService.createGroupConversation).toHaveBeenCalledWith(userId, body)
      expect(mockConversationService.createGroupConversation).toHaveBeenCalledTimes(1)
    })

    it('should handle creating group with different configurations', async () => {
      // Arrange - Chuẩn bị dữ liệu tạo nhóm với cấu hình khác
      const userId = 1
      const body = createTestData.createGroupConversationBody({
        name: 'Nhóm công việc',
        description: 'Nhóm thảo luận công việc',
        memberIds: [2, 3, 4],
      })
      const mockGroupConversation = createTestData.groupConversation({
        name: 'Nhóm công việc',
        description: 'Nhóm thảo luận công việc',
      })

      mockConversationService.createGroupConversation.mockResolvedValue(mockGroupConversation)

      // Act - Thực hiện tạo cuộc trò chuyện nhóm
      const result = await controller.createGroupConversation(userId, body)

      // Assert - Kiểm tra kết quả
      expect(result.name).toBe('Nhóm công việc')
      expect(result.description).toBe('Nhóm thảo luận công việc')
      expect(mockConversationService.createGroupConversation).toHaveBeenCalledWith(userId, body)
    })
  })

  describe('updateConversation', () => {
    it('should update conversation successfully', async () => {
      // Arrange - Chuẩn bị dữ liệu cập nhật cuộc trò chuyện
      const userId = 1
      const params = createTestData.conversationParams()
      const body = createTestData.updateConversationBody()
      const mockUpdatedConversation = createTestData.groupConversation({
        name: body.name,
        description: body.description,
      })

      mockConversationService.updateConversation.mockResolvedValue(mockUpdatedConversation)

      // Act - Thực hiện cập nhật cuộc trò chuyện
      const result = await controller.updateConversation(userId, params, body)

      // Assert - Kiểm tra kết quả
      expect(result).toEqual(mockUpdatedConversation)
      expect(mockConversationService.updateConversation).toHaveBeenCalledWith(params.conversationId, userId, body)
      expect(mockConversationService.updateConversation).toHaveBeenCalledTimes(1)
    })

    it('should handle partial updates', async () => {
      // Arrange - Chuẩn bị dữ liệu cập nhật một phần
      const userId = 1
      const params = createTestData.conversationParams()
      const body = createTestData.updateConversationBody({ name: 'Tên mới only' })
      const mockUpdatedConversation = createTestData.groupConversation({ name: 'Tên mới only' })

      mockConversationService.updateConversation.mockResolvedValue(mockUpdatedConversation)

      // Act - Thực hiện cập nhật một phần
      const result = await controller.updateConversation(userId, params, body)

      // Assert - Kiểm tra kết quả
      expect(result.name).toBe('Tên mới only')
      expect(mockConversationService.updateConversation).toHaveBeenCalledWith(params.conversationId, userId, body)
    })
  })

  describe('archiveConversation', () => {
    it('should archive conversation successfully', async () => {
      // Arrange - Chuẩn bị dữ liệu lưu trữ cuộc trò chuyện
      const userId = 1
      const params = createTestData.conversationParams()
      const mockResponse = { message: 'Đã lưu trữ cuộc trò chuyện' }

      mockConversationService.archiveConversation.mockResolvedValue(mockResponse)

      // Act - Thực hiện lưu trữ cuộc trò chuyện
      const result = await controller.archiveConversation(userId, params)

      // Assert - Kiểm tra kết quả
      expect(result).toEqual(mockResponse)
      expect(mockConversationService.archiveConversation).toHaveBeenCalledWith(params.conversationId, userId)
      expect(mockConversationService.archiveConversation).toHaveBeenCalledTimes(1)
    })
  })

  describe('unarchiveConversation', () => {
    it('should unarchive conversation successfully', async () => {
      // Arrange - Chuẩn bị dữ liệu khôi phục cuộc trò chuyện
      const userId = 1
      const params = createTestData.conversationParams()
      const mockResponse = { message: 'Đã khôi phục cuộc trò chuyện' }

      mockConversationService.unarchiveConversation.mockResolvedValue(mockResponse)

      // Act - Thực hiện khôi phục cuộc trò chuyện
      const result = await controller.unarchiveConversation(userId, params)

      // Assert - Kiểm tra kết quả
      expect(result).toEqual(mockResponse)
      expect(mockConversationService.unarchiveConversation).toHaveBeenCalledWith(params.conversationId, userId)
    })
  })

  describe('muteConversation', () => {
    it('should mute conversation successfully', async () => {
      // Arrange - Chuẩn bị dữ liệu tắt thông báo cuộc trò chuyện
      const userId = 1
      const params = createTestData.conversationParams()
      const body = { mutedUntil: '2024-12-31T23:59:59.000Z' }
      const mockResponse = { message: 'Đã tắt thông báo cuộc trò chuyện' }

      mockConversationService.muteConversation.mockResolvedValue(mockResponse)

      // Act - Thực hiện tắt thông báo
      const result = await controller.muteConversation(userId, params, body)

      // Assert - Kiểm tra kết quả
      expect(result).toEqual(mockResponse)
      expect(mockConversationService.muteConversation).toHaveBeenCalledWith(
        params.conversationId,
        userId,
        new Date(body.mutedUntil),
      )
    })

    it('should mute conversation permanently when no mutedUntil provided', async () => {
      // Arrange - Chuẩn bị dữ liệu tắt thông báo vĩnh viễn
      const userId = 1
      const params = createTestData.conversationParams()
      const body = {}
      const mockResponse = { message: 'Đã tắt thông báo cuộc trò chuyện' }

      mockConversationService.muteConversation.mockResolvedValue(mockResponse)

      // Act - Thực hiện tắt thông báo vĩnh viễn
      const result = await controller.muteConversation(userId, params, body)

      // Assert - Kiểm tra kết quả
      expect(result).toEqual(mockResponse)
      expect(mockConversationService.muteConversation).toHaveBeenCalledWith(params.conversationId, userId, undefined)
    })
  })

  describe('unmuteConversation', () => {
    it('should unmute conversation successfully', async () => {
      // Arrange - Chuẩn bị dữ liệu bật thông báo cuộc trò chuyện
      const userId = 1
      const params = createTestData.conversationParams()
      const mockResponse = { message: 'Đã bật thông báo cuộc trò chuyện' }

      mockConversationService.unmuteConversation.mockResolvedValue(mockResponse)

      // Act - Thực hiện bật thông báo
      const result = await controller.unmuteConversation(userId, params)

      // Assert - Kiểm tra kết quả
      expect(result).toEqual(mockResponse)
      expect(mockConversationService.unmuteConversation).toHaveBeenCalledWith(params.conversationId, userId)
    })
  })

  describe('leaveConversation', () => {
    it('should leave conversation successfully', async () => {
      // Arrange - Chuẩn bị dữ liệu rời cuộc trò chuyện
      const userId = 1
      const params = createTestData.conversationParams()
      const mockResponse = { message: 'Đã rời khỏi cuộc trò chuyện' }

      mockConversationService.leaveConversation.mockResolvedValue(mockResponse)

      // Act - Thực hiện rời cuộc trò chuyện
      const result = await controller.leaveConversation(userId, params)

      // Assert - Kiểm tra kết quả
      expect(result).toEqual(mockResponse)
      expect(mockConversationService.leaveConversation).toHaveBeenCalledWith(params.conversationId, userId)
    })
  })

  describe('getConversationMembers', () => {
    it('should get conversation members successfully', async () => {
      // Arrange - Chuẩn bị dữ liệu lấy danh sách thành viên
      const userId = 1
      const params = createTestData.conversationParams()
      const mockMembers = createTestData.conversationMembers()

      mockConversationService.getConversationMembers.mockResolvedValue(mockMembers)

      // Act - Thực hiện lấy danh sách thành viên
      const result = await controller.getConversationMembers(userId, params)

      // Assert - Kiểm tra kết quả
      expect(result).toEqual({
        message: 'Danh sách thành viên',
        data: mockMembers,
      })
      expect(mockConversationService.getConversationMembers).toHaveBeenCalledWith(params.conversationId, userId)
    })
  })

  describe('addMembers', () => {
    it('should add members successfully', async () => {
      // Arrange - Chuẩn bị dữ liệu thêm thành viên
      const userId = 1
      const params = createTestData.conversationParams()
      const body = createTestData.addMembersBody()
      const mockUpdatedConversation = createTestData.groupConversation()

      mockConversationService.addMembers.mockResolvedValue(mockUpdatedConversation)

      // Act - Thực hiện thêm thành viên
      const result = await controller.addMembers(userId, params, body)

      // Assert - Kiểm tra kết quả
      expect(result).toEqual(mockUpdatedConversation)
      expect(mockConversationService.addMembers).toHaveBeenCalledWith(params.conversationId, userId, body.memberIds)
    })
  })

  describe('removeMember', () => {
    it('should remove member successfully', async () => {
      // Arrange - Chuẩn bị dữ liệu xóa thành viên
      const userId = 1
      const params = createTestData.memberParams()
      const mockResponse = { message: 'Đã xóa thành viên khỏi nhóm' }

      mockConversationService.removeMember.mockResolvedValue(mockResponse)

      // Act - Thực hiện xóa thành viên
      const result = await controller.removeMember(userId, params)

      // Assert - Kiểm tra kết quả
      expect(result).toEqual(mockResponse)
      expect(mockConversationService.removeMember).toHaveBeenCalledWith(params.conversationId, userId, params.memberId)
    })
  })

  describe('updateMemberRole', () => {
    it('should update member role successfully', async () => {
      // Arrange - Chuẩn bị dữ liệu cập nhật vai trò thành viên
      const userId = 1
      const params = createTestData.memberParams()
      const body = { role: 'ADMIN' as const }
      const mockResponse = { message: 'Đã cập nhật vai trò thành viên' }

      mockConversationService.updateMemberRole.mockResolvedValue(mockResponse)

      // Act - Thực hiện cập nhật vai trò
      const result = await controller.updateMemberRole(userId, params, body)

      // Assert - Kiểm tra kết quả
      expect(result).toEqual(mockResponse)
      expect(mockConversationService.updateMemberRole).toHaveBeenCalledWith(
        params.conversationId,
        userId,
        params.memberId,
        body.role,
      )
    })

    it('should handle different role updates', async () => {
      // Arrange - Chuẩn bị dữ liệu cập nhật vai trò khác
      const userId = 1
      const params = createTestData.memberParams()
      const body = { role: 'MODERATOR' as const }
      const mockResponse = { message: 'Đã cập nhật vai trò thành viên' }

      mockConversationService.updateMemberRole.mockResolvedValue(mockResponse)

      // Act - Thực hiện cập nhật vai trò
      const result = await controller.updateMemberRole(userId, params, body)

      // Assert - Kiểm tra kết quả
      expect(result).toEqual(mockResponse)
      expect(mockConversationService.updateMemberRole).toHaveBeenCalledWith(
        params.conversationId,
        userId,
        params.memberId,
        'MODERATOR',
      )
    })
  })

  describe('edge cases and error handling', () => {
    it('should handle service errors in getConversations', async () => {
      // Arrange - Chuẩn bị lỗi từ service
      const userId = 1
      const query = createTestData.getConversationsQuery()
      const serviceError = new Error('Service unavailable')

      mockConversationService.getUserConversations.mockRejectedValue(serviceError)

      // Act & Assert - Thực hiện test và kiểm tra lỗi
      await expect(controller.getConversations(userId, query)).rejects.toThrow('Service unavailable')
      expect(mockConversationService.getUserConversations).toHaveBeenCalledWith(userId, query)
    })

    it('should handle service errors in createDirectConversation', async () => {
      // Arrange - Chuẩn bị lỗi từ service
      const userId = 1
      const body = createTestData.createDirectConversationBody()
      const serviceError = new Error('Recipient not found')

      mockConversationService.createDirectConversation.mockRejectedValue(serviceError)

      // Act & Assert - Thực hiện test và kiểm tra lỗi
      await expect(controller.createDirectConversation(userId, body)).rejects.toThrow('Recipient not found')
    })

    it('should handle service errors in createGroupConversation', async () => {
      // Arrange - Chuẩn bị lỗi từ service
      const userId = 1
      const body = createTestData.createGroupConversationBody()
      const serviceError = new Error('Invalid group name')

      mockConversationService.createGroupConversation.mockRejectedValue(serviceError)

      // Act & Assert - Thực hiện test và kiểm tra lỗi
      await expect(controller.createGroupConversation(userId, body)).rejects.toThrow('Invalid group name')
    })

    it('should handle service errors in updateConversation', async () => {
      // Arrange - Chuẩn bị lỗi từ service
      const userId = 1
      const params = createTestData.conversationParams()
      const body = createTestData.updateConversationBody()
      const serviceError = new Error('Permission denied')

      mockConversationService.updateConversation.mockRejectedValue(serviceError)

      // Act & Assert - Thực hiện test và kiểm tra lỗi
      await expect(controller.updateConversation(userId, params, body)).rejects.toThrow('Permission denied')
    })

    it('should pass through service responses without modification', async () => {
      // Arrange - Chuẩn bị test để đảm bảo controller không modify data
      const userId = 1
      const query = createTestData.getConversationsQuery()
      const originalResponse = createTestData.conversationsList()

      mockConversationService.getUserConversations.mockResolvedValue(originalResponse)

      // Act - Thực hiện lấy danh sách cuộc trò chuyện
      const result = await controller.getConversations(userId, query)

      // Assert - Kiểm tra kết quả không bị thay đổi
      expect(result).toBe(originalResponse) // Same reference
      expect(result).toEqual(originalResponse) // Same content
    })

    it('should handle concurrent requests correctly', async () => {
      // Arrange - Chuẩn bị test concurrent requests
      const userId = 1
      const query = createTestData.getConversationsQuery()
      const mockResponse = createTestData.conversationsList()

      mockConversationService.getUserConversations.mockResolvedValue(mockResponse)

      // Act - Thực hiện multiple concurrent requests
      const promises = Array(3)
        .fill(null)
        .map(() => controller.getConversations(userId, query))
      const results = await Promise.all(promises)

      // Assert - Kiểm tra tất cả requests đều thành công
      results.forEach((result) => {
        expect(result).toEqual(mockResponse)
      })
      expect(mockConversationService.getUserConversations).toHaveBeenCalledTimes(3)
    })

    it('should handle invalid conversation IDs', async () => {
      // Arrange - Chuẩn bị dữ liệu với conversation ID không hợp lệ
      const userId = 1
      const params = createTestData.conversationParams({ conversationId: 'invalid-id' })
      const serviceError = new Error('Conversation not found')

      mockConversationService.getConversationById.mockRejectedValue(serviceError)

      // Act & Assert - Thực hiện test và kiểm tra lỗi
      await expect(controller.getConversation(userId, params)).rejects.toThrow('Conversation not found')
    })

    it('should handle empty member lists', async () => {
      // Arrange - Chuẩn bị dữ liệu danh sách thành viên trống
      const userId = 1
      const params = createTestData.conversationParams()

      mockConversationService.getConversationMembers.mockResolvedValue([])

      // Act - Thực hiện lấy danh sách thành viên
      const result = await controller.getConversationMembers(userId, params)

      // Assert - Kiểm tra kết quả
      expect(result.data).toHaveLength(0)
      expect(result.message).toBe('Danh sách thành viên')
    })
  })

  // ===== MESSAGE MANAGEMENT TESTS =====

  describe('getMessages', () => {
    it('should get conversation messages successfully', async () => {
      // Arrange - Chuẩn bị dữ liệu lấy tin nhắn
      const userId = 1
      const params = createTestData.conversationParams()
      const query = createTestData.getMessagesQuery()
      const mockMessages = createTestData.messagesList()

      mockMessageService.getConversationMessages.mockResolvedValue(mockMessages)

      // Act - Thực hiện lấy tin nhắn
      const result = await controller.getMessages(userId, params, query)

      // Assert - Kiểm tra kết quả
      expect(result).toEqual(mockMessages)
      expect(mockMessageService.getConversationMessages).toHaveBeenCalledWith(params.conversationId, userId, query)
      expect(mockMessageService.getConversationMessages).toHaveBeenCalledTimes(1)
    })

    it('should handle messages with pagination cursor', async () => {
      // Arrange - Chuẩn bị dữ liệu với cursor
      const userId = 1
      const params = createTestData.conversationParams()
      const query = createTestData.getMessagesQuery({ cursor: 'msg-100', limit: 20 })
      const mockMessages = createTestData.messagesList({
        pagination: {
          hasMore: true,
          nextCursor: 'msg-80',
          prevCursor: 'msg-120',
        },
      })

      mockMessageService.getConversationMessages.mockResolvedValue(mockMessages)

      // Act - Thực hiện lấy tin nhắn
      const result = await controller.getMessages(userId, params, query)

      // Assert - Kiểm tra kết quả
      expect(result.pagination.hasMore).toBe(true)
      expect(result.pagination.nextCursor).toBe('msg-80')
      expect(mockMessageService.getConversationMessages).toHaveBeenCalledWith(params.conversationId, userId, query)
    })

    it('should handle messages with type filter', async () => {
      // Arrange - Chuẩn bị dữ liệu với filter type
      const userId = 1
      const params = createTestData.conversationParams()
      const query = createTestData.getMessagesQuery({ type: 'IMAGE' })
      const mockMessages = createTestData.messagesList({
        data: [createTestData.message({ type: 'IMAGE' })],
      })

      mockMessageService.getConversationMessages.mockResolvedValue(mockMessages)

      // Act - Thực hiện lấy tin nhắn
      const result = await controller.getMessages(userId, params, query)

      // Assert - Kiểm tra kết quả
      expect(result.data[0].type).toBe('IMAGE')
      expect(mockMessageService.getConversationMessages).toHaveBeenCalledWith(params.conversationId, userId, query)
    })
  })

  describe('getMessageStats', () => {
    it('should get message stats successfully', async () => {
      // Arrange - Chuẩn bị dữ liệu thống kê tin nhắn
      const userId = 1
      const params = createTestData.conversationParams()
      const mockStats = createTestData.messageStats()

      mockMessageService.getMessageStats.mockResolvedValue(mockStats)

      // Act - Thực hiện lấy thống kê
      const result = await controller.getMessageStats(userId, params)

      // Assert - Kiểm tra kết quả
      expect(result).toEqual({
        message: 'Thống kê tin nhắn',
        data: mockStats,
      })
      expect(mockMessageService.getMessageStats).toHaveBeenCalledWith(params.conversationId, userId)
      expect(mockMessageService.getMessageStats).toHaveBeenCalledTimes(1)
    })
  })

  describe('searchMessages', () => {
    it('should search messages successfully', async () => {
      // Arrange - Chuẩn bị dữ liệu tìm kiếm tin nhắn
      const userId = 1
      const query = createTestData.searchMessagesQuery()
      const mockResults = createTestData.searchResults()

      mockMessageService.searchMessages.mockResolvedValue(mockResults)

      // Act - Thực hiện tìm kiếm
      const result = await controller.searchMessages(userId, query)

      // Assert - Kiểm tra kết quả
      expect(result).toEqual(mockResults)
      expect(mockMessageService.searchMessages).toHaveBeenCalledWith(userId, query.q, {
        limit: query.limit,
        cursor: query.cursor,
        type: query.type,
        fromUserId: query.fromUserId,
        dateFrom: undefined,
        dateTo: undefined,
      })
      expect(mockMessageService.searchMessages).toHaveBeenCalledTimes(1)
    })

    it('should search messages with date range', async () => {
      // Arrange - Chuẩn bị dữ liệu tìm kiếm với khoảng thời gian
      const userId = 1
      const query = createTestData.searchMessagesQuery({
        dateFrom: '2024-01-01T00:00:00.000Z',
        dateTo: '2024-01-31T23:59:59.999Z',
      })
      const mockResults = createTestData.searchResults()

      mockMessageService.searchMessages.mockResolvedValue(mockResults)

      // Act - Thực hiện tìm kiếm
      const result = await controller.searchMessages(userId, query)

      // Assert - Kiểm tra kết quả
      expect(result).toEqual(mockResults)
      expect(mockMessageService.searchMessages).toHaveBeenCalledWith(userId, query.q, {
        limit: query.limit,
        cursor: query.cursor,
        type: query.type,
        fromUserId: query.fromUserId,
        dateFrom: new Date('2024-01-01T00:00:00.000Z'),
        dateTo: new Date('2024-01-31T23:59:59.999Z'),
      })
    })
  })

  describe('sendMessage', () => {
    it('should send message successfully', async () => {
      // Arrange - Chuẩn bị dữ liệu gửi tin nhắn
      const userId = 1
      const body = createTestData.sendMessageBody()
      const mockMessage = createTestData.message()

      mockMessageService.sendMessage.mockResolvedValue(mockMessage)

      // Act - Thực hiện gửi tin nhắn
      const result = await controller.sendMessage(userId, body)

      // Assert - Kiểm tra kết quả
      expect(result).toEqual(mockMessage)
      expect(mockMessageService.sendMessage).toHaveBeenCalledWith(userId, body)
      expect(mockMessageService.sendMessage).toHaveBeenCalledTimes(1)
    })

    it('should send message with attachments', async () => {
      // Arrange - Chuẩn bị dữ liệu gửi tin nhắn với file đính kèm
      const userId = 1
      const body = createTestData.sendMessageBody({
        type: 'IMAGE',
        attachments: [
          {
            type: 'IMAGE',
            fileName: 'photo.jpg',
            fileUrl: 'https://example.com/photo.jpg',
            fileSize: 1024000,
            mimeType: 'image/jpeg',
            width: 1920,
            height: 1080,
          },
        ],
      })
      const mockMessage = createTestData.message({ type: 'IMAGE' })

      mockMessageService.sendMessage.mockResolvedValue(mockMessage)

      // Act - Thực hiện gửi tin nhắn
      const result = await controller.sendMessage(userId, body)

      // Assert - Kiểm tra kết quả
      expect(result).toEqual(mockMessage)
      expect(mockMessageService.sendMessage).toHaveBeenCalledWith(userId, body)
    })
  })

  describe('getMessage', () => {
    it('should get message by ID successfully', async () => {
      // Arrange - Chuẩn bị dữ liệu lấy tin nhắn theo ID
      const userId = 1
      const params = createTestData.messageParams()
      const mockMessage = createTestData.message()

      mockMessageService.getMessageById.mockResolvedValue(mockMessage)

      // Act - Thực hiện lấy tin nhắn
      const result = await controller.getMessage(userId, params)

      // Assert - Kiểm tra kết quả
      expect(result).toEqual(mockMessage)
      expect(mockMessageService.getMessageById).toHaveBeenCalledWith(params.messageId, userId)
      expect(mockMessageService.getMessageById).toHaveBeenCalledTimes(1)
    })
  })

  describe('editMessage', () => {
    it('should edit message successfully', async () => {
      // Arrange - Chuẩn bị dữ liệu chỉnh sửa tin nhắn
      const userId = 1
      const params = createTestData.messageParams()
      const body = { content: 'Updated content' }
      const mockMessage = createTestData.message({ content: 'Updated content', isEdited: true })

      mockMessageService.editMessage.mockResolvedValue(mockMessage)

      // Act - Thực hiện chỉnh sửa tin nhắn
      const result = await controller.editMessage(userId, params, body)

      // Assert - Kiểm tra kết quả
      expect(result).toEqual(mockMessage)
      expect(mockMessageService.editMessage).toHaveBeenCalledWith(params.messageId, userId, body.content)
      expect(mockMessageService.editMessage).toHaveBeenCalledTimes(1)
    })
  })

  describe('deleteMessage', () => {
    it('should delete message for self successfully', async () => {
      // Arrange - Chuẩn bị dữ liệu xóa tin nhắn cho bản thân
      const userId = 1
      const params = createTestData.messageParams()
      const mockDeletedMessage = createTestData.message({ isDeleted: true, deletedAt: new Date('2024-01-01') })

      mockMessageService.deleteMessage.mockResolvedValue(mockDeletedMessage)

      // Act - Thực hiện xóa tin nhắn
      const result = await controller.deleteMessage(userId, params, undefined)

      // Assert - Kiểm tra kết quả
      expect(result).toEqual(mockDeletedMessage)
      expect(mockMessageService.deleteMessage).toHaveBeenCalledWith(params.messageId, userId, false)
      expect(mockMessageService.deleteMessage).toHaveBeenCalledTimes(1)
    })

    it('should delete message for everyone when forEveryone=true', async () => {
      // Arrange - Chuẩn bị dữ liệu xóa tin nhắn cho mọi người
      const userId = 1
      const params = createTestData.messageParams()
      const mockDeletedMessage = createTestData.message({
        isDeleted: true,
        deletedForEveryone: true,
        deletedAt: new Date('2024-01-01'),
      })

      mockMessageService.deleteMessage.mockResolvedValue(mockDeletedMessage)

      // Act - Thực hiện xóa tin nhắn cho mọi người
      const result = await controller.deleteMessage(userId, params, 'true')

      // Assert - Kiểm tra kết quả
      expect(result).toEqual(mockDeletedMessage)
      expect(mockMessageService.deleteMessage).toHaveBeenCalledWith(params.messageId, userId, true)
    })

    it('should handle forEveryone=false correctly', async () => {
      // Arrange - Chuẩn bị dữ liệu với forEveryone=false
      const userId = 1
      const params = createTestData.messageParams()
      const mockDeletedMessage = createTestData.message({ isDeleted: true, deletedAt: new Date('2024-01-01') })

      mockMessageService.deleteMessage.mockResolvedValue(mockDeletedMessage)

      // Act - Thực hiện xóa tin nhắn
      const result = await controller.deleteMessage(userId, params, 'false')

      // Assert - Kiểm tra kết quả
      expect(result).toEqual(mockDeletedMessage)
      expect(mockMessageService.deleteMessage).toHaveBeenCalledWith(params.messageId, userId, false)
    })
  })

  // ===== MESSAGE INTERACTIONS TESTS =====

  describe('markAsRead', () => {
    it('should mark messages as read successfully', async () => {
      // Arrange - Chuẩn bị dữ liệu đánh dấu đã đọc
      const userId = 1
      const body = createTestData.markAsReadBody()
      const mockResult = { markedCount: 5 }

      mockMessageService.markAsRead.mockResolvedValue(mockResult)

      // Act - Thực hiện đánh dấu đã đọc
      const result = await controller.markAsRead(userId, body)

      // Assert - Kiểm tra kết quả
      expect(result).toEqual({
        message: 'Đã đánh dấu 5 tin nhắn là đã đọc',
      })
      expect(mockMessageService.markAsRead).toHaveBeenCalledWith(body.conversationId, userId, body.messageId)
      expect(mockMessageService.markAsRead).toHaveBeenCalledTimes(1)
    })

    it('should mark all messages as read when messageId is not provided', async () => {
      // Arrange - Chuẩn bị dữ liệu đánh dấu tất cả đã đọc
      const userId = 1
      const body = createTestData.markAsReadBody({ messageId: undefined })
      const mockResult = { markedCount: 10 }

      mockMessageService.markAsRead.mockResolvedValue(mockResult)

      // Act - Thực hiện đánh dấu tất cả đã đọc
      const result = await controller.markAsRead(userId, body)

      // Assert - Kiểm tra kết quả
      expect(result.message).toBe('Đã đánh dấu 10 tin nhắn là đã đọc')
      expect(mockMessageService.markAsRead).toHaveBeenCalledWith(body.conversationId, userId, undefined)
    })
  })

  describe('reactToMessage', () => {
    it('should add reaction to message successfully', async () => {
      // Arrange - Chuẩn bị dữ liệu thêm reaction
      const userId = 1
      const params = createTestData.messageParams()
      const body = { emoji: '👍' }
      const mockResult = createTestData.reactionResult()

      mockMessageService.reactToMessage.mockResolvedValue(mockResult)

      // Act - Thực hiện thêm reaction
      const result = await controller.reactToMessage(userId, params, body)

      // Assert - Kiểm tra kết quả
      expect(result).toEqual({
        message: 'Đã thêm reaction',
        data: mockResult,
      })
      expect(mockMessageService.reactToMessage).toHaveBeenCalledWith(params.messageId, userId, body.emoji)
      expect(mockMessageService.reactToMessage).toHaveBeenCalledTimes(1)
    })

    it('should remove reaction when reacting with same emoji', async () => {
      // Arrange - Chuẩn bị dữ liệu xóa reaction
      const userId = 1
      const params = createTestData.messageParams()
      const body = { emoji: '👍' }
      const mockResult = createTestData.reactionResult({ action: 'removed' })

      mockMessageService.reactToMessage.mockResolvedValue(mockResult)

      // Act - Thực hiện xóa reaction
      const result = await controller.reactToMessage(userId, params, body)

      // Assert - Kiểm tra kết quả
      expect(result).toEqual({
        message: 'Đã xóa reaction',
        data: mockResult,
      })
      expect(mockMessageService.reactToMessage).toHaveBeenCalledWith(params.messageId, userId, body.emoji)
    })
  })

  describe('removeReaction', () => {
    it('should remove reaction successfully', async () => {
      // Arrange - Chuẩn bị dữ liệu xóa reaction
      const userId = 1
      const params = createTestData.messageParams()
      const emoji = '👍'
      const mockResponse = { message: 'Đã xóa reaction' }

      mockMessageService.removeReaction.mockResolvedValue(mockResponse)

      // Act - Thực hiện xóa reaction
      const result = await controller.removeReaction(userId, params, emoji)

      // Assert - Kiểm tra kết quả
      expect(result).toEqual(mockResponse)
      expect(mockMessageService.removeReaction).toHaveBeenCalledWith(params.messageId, userId, emoji)
      expect(mockMessageService.removeReaction).toHaveBeenCalledTimes(1)
    })
  })

  describe('getReactionStats', () => {
    it('should get reaction stats successfully', async () => {
      // Arrange - Chuẩn bị dữ liệu thống kê reaction
      const userId = 1
      const params = createTestData.messageParams()
      const mockStats = createTestData.reactionStats()

      mockMessageService.getReactionStats.mockResolvedValue(mockStats)

      // Act - Thực hiện lấy thống kê reaction
      const result = await controller.getReactionStats(userId, params)

      // Assert - Kiểm tra kết quả
      expect(result).toEqual({
        message: 'Thống kê reaction',
        data: mockStats,
      })
      expect(mockMessageService.getReactionStats).toHaveBeenCalledWith(params.messageId, userId)
      expect(mockMessageService.getReactionStats).toHaveBeenCalledTimes(1)
    })
  })

  describe('getReadReceiptStats', () => {
    it('should get read receipt stats successfully', async () => {
      // Arrange - Chuẩn bị dữ liệu thống kê đã đọc
      const userId = 1
      const params = createTestData.messageParams()
      const mockStats = createTestData.readReceiptStats()

      mockMessageService.getReadReceiptStats.mockResolvedValue(mockStats)

      // Act - Thực hiện lấy thống kê đã đọc
      const result = await controller.getReadReceiptStats(userId, params)

      // Assert - Kiểm tra kết quả
      expect(result).toEqual({
        message: 'Thống kê đã đọc',
        data: mockStats,
      })
      expect(mockMessageService.getReadReceiptStats).toHaveBeenCalledWith(params.messageId, userId)
      expect(mockMessageService.getReadReceiptStats).toHaveBeenCalledTimes(1)
    })
  })

  // ===== RESPONSE STRUCTURE SNAPSHOTS =====

  describe('Response Structure Snapshots', () => {
    it('should match conversations list response structure', async () => {
      const mockResponse = createTestData.conversationsList()
      mockConversationService.getUserConversations.mockResolvedValue(mockResponse)
      const result = await controller.getConversations(1, createTestData.getConversationsQuery())
      expect(result).toMatchSnapshot()
    })

    it('should match direct conversation response structure', async () => {
      const mockConversation = createTestData.conversation()
      mockConversationService.createDirectConversation.mockResolvedValue(mockConversation)
      const result = await controller.createDirectConversation(1, createTestData.createDirectConversationBody())
      expect(result).toMatchSnapshot()
    })

    it('should match group conversation response structure', async () => {
      const mockConversation = createTestData.groupConversation()
      mockConversationService.createGroupConversation.mockResolvedValue(mockConversation)
      const result = await controller.createGroupConversation(1, createTestData.createGroupConversationBody())
      expect(result).toMatchSnapshot()
    })
  })
})
