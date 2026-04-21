import { Test, TestingModule } from '@nestjs/testing'
import { PrismaService } from '../../../shared/services/prisma.service'
import { MessageRepository } from '../message.repo'

// Test data factory để tạo dữ liệu test
const createTestData = {
  message: (overrides = {}) => ({
    id: 'msg-1',
    conversationId: 'conv-1',
    fromUserId: 1,
    content: 'Test message',
    type: 'TEXT',
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
      name: 'User 1',
      email: 'user1@example.com',
      avatar: null,
      status: 'ACTIVE',
    },
    replyTo: null,
    attachments: [],
    reactions: [],
    readReceipts: [],
    ...overrides,
  }),

  attachment: (overrides = {}) => ({
    id: 'att-1',
    messageId: 'msg-1',
    type: 'IMAGE',
    fileName: 'image.jpg',
    fileUrl: 'https://example.com/image.jpg',
    fileSize: 1024,
    mimeType: 'image/jpeg',
    thumbnail: 'https://example.com/thumb.jpg',
    width: 800,
    height: 600,
    duration: null,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    ...overrides,
  }),

  reaction: (overrides = {}) => ({
    id: 'reaction-1',
    messageId: 'msg-1',
    userId: 2,
    emoji: '👍',
    createdAt: new Date('2024-01-01'),
    user: {
      id: 2,
      name: 'User 2',
      email: 'user2@example.com',
      avatar: null,
      status: 'ACTIVE',
    },
    ...overrides,
  }),

  readReceipt: (overrides = {}) => ({
    id: 'receipt-1',
    messageId: 'msg-1',
    userId: 2,
    readAt: new Date('2024-01-01'),
    user: {
      id: 2,
      name: 'User 2',
      email: 'user2@example.com',
      avatar: null,
      status: 'ACTIVE',
    },
    ...overrides,
  }),
}

describe('MessageRepository', () => {
  let repository: MessageRepository
  let module: TestingModule
  let mockPrismaService: any

  beforeEach(async () => {
    // Tạo mock cho PrismaService
    mockPrismaService = {
      conversationMessage: {
        create: jest.fn(),
        findUnique: jest.fn(),
        findMany: jest.fn(),
        findFirst: jest.fn(),
        update: jest.fn(),
        count: jest.fn(),
        groupBy: jest.fn(),
      },
      messageAttachment: {
        count: jest.fn(),
      },
      messageReaction: {
        upsert: jest.fn(),
        delete: jest.fn(),
        findMany: jest.fn(),
        groupBy: jest.fn(),
      },
      messageReadReceipt: {
        upsert: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
        createMany: jest.fn(),
      },
      conversationMember: {
        count: jest.fn(),
      },
    } as any

    module = await Test.createTestingModule({
      providers: [MessageRepository, { provide: PrismaService, useValue: mockPrismaService }],
    }).compile()

    repository = module.get<MessageRepository>(MessageRepository)
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

  describe('create', () => {
    it('should create message successfully', async () => {
      // Arrange - Chuẩn bị dữ liệu tạo tin nhắn
      const data = {
        conversationId: 'conv-1',
        fromUserId: 1,
        content: 'Test message',
        type: 'TEXT' as const,
      }
      const mockMessage = createTestData.message()

      mockPrismaService.conversationMessage.create.mockResolvedValue(mockMessage)

      // Act - Thực hiện tạo tin nhắn
      const result = await repository.create(data)

      // Assert - Kiểm tra kết quả
      expect(result).toBeDefined()
      expect(result.id).toBe('msg-1')
      expect(result.content).toBe('Test message')
      expect(mockPrismaService.conversationMessage.create).toHaveBeenCalledWith({
        data: {
          conversationId: data.conversationId,
          fromUserId: data.fromUserId,
          content: data.content,
          type: data.type,
          replyToId: undefined,
          attachments: undefined,
        },
        include: expect.any(Object),
      })
    })

    it('should create message with attachments successfully', async () => {
      // Arrange - Chuẩn bị dữ liệu tạo tin nhắn có attachments
      const data = {
        conversationId: 'conv-1',
        fromUserId: 1,
        content: null,
        type: 'IMAGE' as const,
        attachments: [
          {
            type: 'IMAGE' as const,
            fileName: 'image.jpg',
            fileUrl: 'https://example.com/image.jpg',
            fileSize: 1024,
            mimeType: 'image/jpeg',
          },
        ],
      }
      const mockMessage = createTestData.message({
        content: null,
        type: 'IMAGE',
        attachments: [createTestData.attachment()],
      })

      mockPrismaService.conversationMessage.create.mockResolvedValue(mockMessage)

      // Act - Thực hiện tạo tin nhắn
      const result = await repository.create(data)

      // Assert - Kiểm tra kết quả
      expect(result).toBeDefined()
      expect(result.attachments).toHaveLength(1)
      expect(mockPrismaService.conversationMessage.create).toHaveBeenCalledWith({
        data: {
          conversationId: data.conversationId,
          fromUserId: data.fromUserId,
          content: data.content,
          type: data.type,
          replyToId: undefined,
          attachments: {
            create: data.attachments,
          },
        },
        include: expect.any(Object),
      })
    })
  })

  describe('findById', () => {
    it('should find message by ID successfully', async () => {
      // Arrange - Chuẩn bị dữ liệu tìm tin nhắn
      const messageId = 'msg-1'
      const mockMessage = createTestData.message()

      mockPrismaService.conversationMessage.findUnique.mockResolvedValue(mockMessage)

      // Act - Thực hiện tìm tin nhắn
      const result = await repository.findById(messageId)

      // Assert - Kiểm tra kết quả
      expect(result).toBeDefined()
      expect(result?.id).toBe(messageId)
      expect(mockPrismaService.conversationMessage.findUnique).toHaveBeenCalledWith({
        where: { id: messageId },
        include: expect.any(Object),
      })
    })

    it('should return null when message not found', async () => {
      // Arrange - Chuẩn bị dữ liệu tin nhắn không tồn tại
      const messageId = 'msg-nonexistent'

      mockPrismaService.conversationMessage.findUnique.mockResolvedValue(null)

      // Act - Thực hiện tìm tin nhắn
      const result = await repository.findById(messageId)

      // Assert - Kiểm tra kết quả
      expect(result).toBeNull()
    })
  })

  describe('findConversationMessages', () => {
    it('should find conversation messages with pagination', async () => {
      // Arrange - Chuẩn bị dữ liệu lấy tin nhắn
      const conversationId = 'conv-1'
      const options = { limit: 20, direction: 'backward' as const }
      const mockMessages = [createTestData.message(), createTestData.message({ id: 'msg-2' })]

      mockPrismaService.conversationMessage.findMany.mockResolvedValue(mockMessages)

      // Act - Thực hiện lấy tin nhắn
      const result = await repository.findConversationMessages(conversationId, options)

      // Assert - Kiểm tra kết quả
      expect(result).toBeDefined()
      expect(result.data).toHaveLength(2)
      expect(result.pagination).toBeDefined()
      expect(result.pagination.hasMore).toBe(false)
      expect(mockPrismaService.conversationMessage.findMany).toHaveBeenCalled()
    })

    it('should handle cursor-based pagination', async () => {
      // Arrange - Chuẩn bị dữ liệu pagination với cursor
      const conversationId = 'conv-1'
      const options = { limit: 20, cursor: 'msg-cursor', direction: 'backward' as const }
      const mockCursorMessage = createTestData.message({ id: 'msg-cursor' })
      const mockMessages = [createTestData.message({ id: 'msg-3' })]

      mockPrismaService.conversationMessage.findUnique.mockResolvedValue(mockCursorMessage)
      mockPrismaService.conversationMessage.findMany.mockResolvedValue(mockMessages)

      // Act - Thực hiện lấy tin nhắn
      const result = await repository.findConversationMessages(conversationId, options)

      // Assert - Kiểm tra kết quả
      expect(result).toBeDefined()
      expect(result.data).toHaveLength(1)
      expect(mockPrismaService.conversationMessage.findUnique).toHaveBeenCalledWith({
        where: { id: 'msg-cursor' },
        select: { createdAt: true, id: true },
      })
    })

    it('should filter by message type', async () => {
      // Arrange - Chuẩn bị dữ liệu filter theo type
      const conversationId = 'conv-1'
      const options = { limit: 20, direction: 'backward' as const, type: 'IMAGE' }
      const mockMessages = [createTestData.message({ type: 'IMAGE' })]

      mockPrismaService.conversationMessage.findMany.mockResolvedValue(mockMessages)

      // Act - Thực hiện lấy tin nhắn
      const result = await repository.findConversationMessages(conversationId, options)

      // Assert - Kiểm tra where clause có type filter
      expect(mockPrismaService.conversationMessage.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            type: 'IMAGE',
          }),
        }),
      )
    })

    it('should throw error when cursor message not found', async () => {
      // Arrange - Chuẩn bị dữ liệu cursor không hợp lệ
      const conversationId = 'conv-1'
      const options = { limit: 20, direction: 'backward' as const, cursor: 'invalid-cursor' }

      mockPrismaService.conversationMessage.findUnique.mockResolvedValue(null)

      // Act & Assert - Kiểm tra lỗi
      await expect(repository.findConversationMessages(conversationId, options)).rejects.toThrow(
        'Invalid cursor: Message not found',
      )
    })

    it('should handle forward direction pagination', async () => {
      // Arrange - Chuẩn bị dữ liệu forward pagination
      const conversationId = 'conv-1'
      const options = { limit: 20, direction: 'forward' as const, cursor: 'msg-cursor' }
      const mockCursorMessage = { id: 'msg-cursor', createdAt: new Date() }
      const mockMessages = [createTestData.message({ id: 'msg-3' })]

      mockPrismaService.conversationMessage.findUnique.mockResolvedValue(mockCursorMessage)
      mockPrismaService.conversationMessage.findMany.mockResolvedValue(mockMessages)

      // Act - Thực hiện lấy tin nhắn
      const result = await repository.findConversationMessages(conversationId, options)

      // Assert - Kiểm tra where clause có gt (greater than)
      expect(mockPrismaService.conversationMessage.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            createdAt: { gt: mockCursorMessage.createdAt },
          }),
        }),
      )
    })

    it('should use default backward direction when not specified', async () => {
      // Arrange - Không truyền direction, mặc định là backward
      const conversationId = 'conv-1'
      const options = { limit: 20, cursor: 'msg-cursor' }
      const mockCursorMessage = { id: 'msg-cursor', createdAt: new Date() }
      const mockMessages = [createTestData.message()]

      mockPrismaService.conversationMessage.findUnique.mockResolvedValue(mockCursorMessage)
      mockPrismaService.conversationMessage.findMany.mockResolvedValue(mockMessages)

      // Act
      const result = await repository.findConversationMessages(conversationId, options)

      // Assert - Kiểm tra where clause có lt (less than) - backward direction
      expect(mockPrismaService.conversationMessage.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            createdAt: { lt: mockCursorMessage.createdAt },
          }),
        }),
      )
      expect(result.pagination.direction).toBe('backward')
    })

    it('should handle hasMore = true when messages exceed limit', async () => {
      // Arrange - Trả về nhiều hơn limit để test hasMore
      const conversationId = 'conv-1'
      const options = { limit: 2 }
      const mockMessages = [
        createTestData.message({ id: 'msg-1' }),
        createTestData.message({ id: 'msg-2' }),
        createTestData.message({ id: 'msg-3' }), // Extra message
      ]

      mockPrismaService.conversationMessage.findMany.mockResolvedValue(mockMessages)

      // Act
      const result = await repository.findConversationMessages(conversationId, options)

      // Assert
      expect(result.pagination.hasMore).toBe(true)
      expect(result.data).toHaveLength(2) // Should only return limit
      expect(result.pagination.nextCursor).toBe('msg-2') // Last message in result
    })

    it('should handle hasMore = false when messages do not exceed limit', async () => {
      // Arrange
      const conversationId = 'conv-1'
      const options = { limit: 5 }
      const mockMessages = [createTestData.message({ id: 'msg-1' }), createTestData.message({ id: 'msg-2' })]

      mockPrismaService.conversationMessage.findMany.mockResolvedValue(mockMessages)

      // Act
      const result = await repository.findConversationMessages(conversationId, options)

      // Assert
      expect(result.pagination.hasMore).toBe(false)
      expect(result.data).toHaveLength(2)
      expect(result.pagination.nextCursor).toBeNull()
    })

    it('should handle empty results', async () => {
      // Arrange
      const conversationId = 'conv-1'
      const options = { limit: 20 }

      mockPrismaService.conversationMessage.findMany.mockResolvedValue([])

      // Act
      const result = await repository.findConversationMessages(conversationId, options)

      // Assert
      expect(result.data).toHaveLength(0)
      expect(result.pagination.hasMore).toBe(false)
      expect(result.pagination.nextCursor).toBeNull()
      expect(result.pagination.prevCursor).toBeNull()
    })

    it('should normalize messages with optional fields (replyTo, attachments, reactions)', async () => {
      // Arrange - Message với đầy đủ optional fields
      const conversationId = 'conv-1'
      const options = { limit: 20 }
      const mockMessages = [
        {
          ...createTestData.message(),
          replyTo: {
            id: 'reply-1',
            content: 'Original message',
            type: 'TEXT',
            fromUserId: 2,
            createdAt: new Date(),
            isDeleted: false,
            deletedForEveryone: false,
            fromUser: {
              id: 2,
              name: 'User 2',
              email: 'user2@example.com',
              avatar: null,
              status: 'ACTIVE',
            },
            attachments: [createTestData.attachment()],
          },
          attachments: [createTestData.attachment()],
          reactions: [createTestData.reaction()],
          readReceipts: [createTestData.readReceipt()],
        },
      ]

      mockPrismaService.conversationMessage.findMany.mockResolvedValue(mockMessages)

      // Act
      const result = await repository.findConversationMessages(conversationId, options)

      // Assert - Kiểm tra normalization
      expect(result.data[0].replyTo).toBeDefined()
      expect(result.data[0].replyTo?.attachments).toHaveLength(1)
      expect(result.data[0].attachments).toHaveLength(1)
      expect(result.data[0].reactions).toHaveLength(1)
      expect(result.data[0].readReceipts).toHaveLength(1)
    })

    it('should normalize messages with null replyTo and empty arrays', async () => {
      // Arrange - Message không có replyTo và empty arrays
      const conversationId = 'conv-1'
      const options = { limit: 20 }
      const mockMessages = [
        {
          ...createTestData.message(),
          replyTo: null,
          attachments: [],
          reactions: [],
          readReceipts: [],
        },
      ]

      mockPrismaService.conversationMessage.findMany.mockResolvedValue(mockMessages)

      // Act
      const result = await repository.findConversationMessages(conversationId, options)

      // Assert
      expect(result.data[0].replyTo).toBeNull()
      expect(result.data[0].attachments).toEqual([])
      expect(result.data[0].reactions).toEqual([])
      expect(result.data[0].readReceipts).toEqual([])
    })
  })

  describe('update', () => {
    it('should update message successfully', async () => {
      // Arrange - Chuẩn bị dữ liệu cập nhật tin nhắn
      const messageId = 'msg-1'
      const data = {
        content: 'Updated content',
        isEdited: true,
        editedAt: new Date(),
      }
      const mockUpdatedMessage = createTestData.message({ ...data })

      mockPrismaService.conversationMessage.update.mockResolvedValue(mockUpdatedMessage)

      // Act - Thực hiện cập nhật
      const result = await repository.update(messageId, data)

      // Assert - Kiểm tra kết quả
      expect(result).toBeDefined()
      expect(result.content).toBe('Updated content')
      expect(result.isEdited).toBe(true)
      expect(mockPrismaService.conversationMessage.update).toHaveBeenCalledWith({
        where: { id: messageId },
        data,
        include: expect.any(Object),
      })
    })
  })

  describe('delete', () => {
    it('should soft delete message successfully', async () => {
      // Arrange - Chuẩn bị dữ liệu xóa tin nhắn
      const messageId = 'msg-1'
      const mockDeletedMessage = createTestData.message({ isDeleted: true, deletedAt: new Date() })

      mockPrismaService.conversationMessage.update.mockResolvedValue(mockDeletedMessage)

      // Act - Thực hiện xóa
      const result = await repository.delete(messageId, false)

      // Assert - Kiểm tra kết quả
      expect(result).toBeDefined()
      expect(result.isDeleted).toBe(true)
      expect(mockPrismaService.conversationMessage.update).toHaveBeenCalledWith({
        where: { id: messageId },
        data: {
          isDeleted: true,
          deletedAt: expect.any(Date),
        },
        include: expect.any(Object),
      })
    })

    it('should delete message for everyone and clear content', async () => {
      // Arrange - Chuẩn bị dữ liệu xóa cho tất cả mọi người
      const messageId = 'msg-1'
      const mockDeletedMessage = createTestData.message({
        isDeleted: true,
        deletedForEveryone: true,
        deletedAt: new Date(),
        content: null,
      })

      mockPrismaService.conversationMessage.update.mockResolvedValue(mockDeletedMessage)

      // Act - Thực hiện xóa
      const result = await repository.delete(messageId, true)

      // Assert - Kiểm tra kết quả
      expect(result).toBeDefined()
      expect(result.isDeleted).toBe(true)
      expect(result.deletedForEveryone).toBe(true)
      expect(mockPrismaService.conversationMessage.update).toHaveBeenCalledWith({
        where: { id: messageId },
        data: {
          isDeleted: true,
          deletedAt: expect.any(Date),
          deletedForEveryone: true,
          content: null,
        },
        include: expect.any(Object),
      })
    })
  })

  describe('searchMessages', () => {
    it('should search messages with query successfully', async () => {
      // Arrange - Chuẩn bị dữ liệu tìm kiếm
      const conversationIds = ['conv-1', 'conv-2']
      const query = 'test'
      const options = { limit: 20 }
      const mockMessages = [createTestData.message(), createTestData.message({ id: 'msg-2' })]

      mockPrismaService.conversationMessage.findMany.mockResolvedValue(mockMessages)
      // Mock groupBy được gọi 3 lần: byType, byUser, byConversation
      mockPrismaService.conversationMessage.groupBy
        .mockResolvedValueOnce([{ type: 'TEXT', _count: { type: 2 } }])
        .mockResolvedValueOnce([{ fromUserId: 1, _count: { fromUserId: 2 } }])
        .mockResolvedValueOnce([{ conversationId: 'conv-1', _count: { conversationId: 2 } }])

      // Act - Thực hiện tìm kiếm
      const result = await repository.searchMessages(conversationIds, query, options)

      // Assert - Kiểm tra kết quả
      expect(result).toBeDefined()
      expect(result.data).toHaveLength(2)
      expect(result.facets).toBeDefined()
      expect(mockPrismaService.conversationMessage.findMany).toHaveBeenCalled()
    })

    it('should return facets grouped by type, user, and conversation', async () => {
      // Arrange - Chuẩn bị dữ liệu với facets
      const conversationIds = ['conv-1']
      const query = 'test'
      const options = { limit: 20 }
      const mockMessages = [
        createTestData.message({ type: 'TEXT' }),
        createTestData.message({ id: 'msg-2', type: 'IMAGE' }),
      ]

      mockPrismaService.conversationMessage.findMany.mockResolvedValue(mockMessages)
      mockPrismaService.conversationMessage.groupBy
        .mockResolvedValueOnce([
          { type: 'TEXT', _count: { type: 1 } },
          { type: 'IMAGE', _count: { type: 1 } },
        ])
        .mockResolvedValueOnce([{ fromUserId: 1, _count: { fromUserId: 2 } }])
        .mockResolvedValueOnce([{ conversationId: 'conv-1', _count: { conversationId: 2 } }])

      // Act - Thực hiện tìm kiếm
      const result = await repository.searchMessages(conversationIds, query, options)

      // Assert - Kiểm tra facets
      expect(result.facets).toBeDefined()
      expect(result.facets.byType).toBeDefined()
      expect(result.facets.byUser).toBeDefined()
      expect(result.facets.byConversation).toBeDefined()
    })

    it('should filter by conversationIds', async () => {
      // Arrange - Chuẩn bị dữ liệu filter
      const conversationIds = ['conv-1', 'conv-2']
      const query = 'test'
      const options = { limit: 20 }
      const mockMessages = [createTestData.message()]

      mockPrismaService.conversationMessage.findMany.mockResolvedValue(mockMessages)
      mockPrismaService.conversationMessage.groupBy
        .mockResolvedValueOnce([{ type: 'TEXT', _count: { type: 1 } }])
        .mockResolvedValueOnce([{ fromUserId: 1, _count: { fromUserId: 1 } }])
        .mockResolvedValueOnce([{ conversationId: 'conv-1', _count: { conversationId: 1 } }])

      // Act - Thực hiện tìm kiếm
      await repository.searchMessages(conversationIds, query, options)

      // Assert - Kiểm tra where clause
      expect(mockPrismaService.conversationMessage.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            conversationId: { in: conversationIds },
          }),
        }),
      )
    })

    it('should filter by type', async () => {
      // Arrange - Chuẩn bị dữ liệu filter theo type
      const conversationIds = ['conv-1']
      const query = 'test'
      const options = { limit: 20, type: 'IMAGE' }
      const mockMessages = [createTestData.message({ type: 'IMAGE' })]

      mockPrismaService.conversationMessage.findMany.mockResolvedValue(mockMessages)
      mockPrismaService.conversationMessage.groupBy
        .mockResolvedValueOnce([{ type: 'IMAGE', _count: { type: 1 } }])
        .mockResolvedValueOnce([{ fromUserId: 1, _count: { fromUserId: 1 } }])
        .mockResolvedValueOnce([{ conversationId: 'conv-1', _count: { conversationId: 1 } }])

      // Act - Thực hiện tìm kiếm
      await repository.searchMessages(conversationIds, query, options)

      // Assert - Kiểm tra where clause có type filter
      expect(mockPrismaService.conversationMessage.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            type: 'IMAGE',
          }),
        }),
      )
    })

    it('should filter by fromUserId', async () => {
      // Arrange - Chuẩn bị dữ liệu filter theo user
      const conversationIds = ['conv-1']
      const query = 'test'
      const options = { limit: 20, fromUserId: 1 }
      const mockMessages = [createTestData.message({ fromUserId: 1 })]

      mockPrismaService.conversationMessage.findMany.mockResolvedValue(mockMessages)
      mockPrismaService.conversationMessage.groupBy
        .mockResolvedValueOnce([{ type: 'TEXT', _count: { type: 1 } }])
        .mockResolvedValueOnce([{ fromUserId: 1, _count: { fromUserId: 1 } }])
        .mockResolvedValueOnce([{ conversationId: 'conv-1', _count: { conversationId: 1 } }])

      // Act - Thực hiện tìm kiếm
      await repository.searchMessages(conversationIds, query, options)

      // Assert - Kiểm tra where clause có fromUserId filter
      expect(mockPrismaService.conversationMessage.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            fromUserId: 1,
          }),
        }),
      )
    })

    it('should handle pagination with cursor', async () => {
      // Arrange - Chuẩn bị dữ liệu pagination
      const conversationIds = ['conv-1']
      const query = 'test'
      const options = { limit: 20, cursor: 'msg-cursor' }
      const mockCursorMessage = createTestData.message({ id: 'msg-cursor' })
      const mockMessages = [createTestData.message({ id: 'msg-3' })]

      mockPrismaService.conversationMessage.findUnique.mockResolvedValue(mockCursorMessage)
      mockPrismaService.conversationMessage.findMany.mockResolvedValue(mockMessages)
      mockPrismaService.conversationMessage.groupBy
        .mockResolvedValueOnce([{ type: 'TEXT', _count: { type: 1 } }])
        .mockResolvedValueOnce([{ fromUserId: 1, _count: { fromUserId: 1 } }])
        .mockResolvedValueOnce([{ conversationId: 'conv-1', _count: { conversationId: 1 } }])

      // Act - Thực hiện tìm kiếm
      const result = await repository.searchMessages(conversationIds, query, options)

      // Assert - Kiểm tra kết quả
      expect(result).toBeDefined()
      expect(mockPrismaService.conversationMessage.findUnique).toHaveBeenCalledWith({
        where: { id: 'msg-cursor' },
        select: { createdAt: true, id: true },
      })
    })

    it('should filter by dateFrom', async () => {
      // Arrange
      const conversationIds = ['conv-1']
      const query = 'test'
      const dateFrom = new Date('2024-01-01')
      const options = { limit: 20, dateFrom }
      const mockMessages = [createTestData.message()]

      mockPrismaService.conversationMessage.findMany.mockResolvedValue(mockMessages)
      mockPrismaService.conversationMessage.groupBy
        .mockResolvedValueOnce([{ type: 'TEXT', _count: { type: 1 } }])
        .mockResolvedValueOnce([{ fromUserId: 1, _count: { fromUserId: 1 } }])
        .mockResolvedValueOnce([{ conversationId: 'conv-1', _count: { conversationId: 1 } }])

      // Act
      await repository.searchMessages(conversationIds, query, options)

      // Assert - Kiểm tra where clause có dateFrom filter
      expect(mockPrismaService.conversationMessage.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            createdAt: expect.objectContaining({
              gte: dateFrom,
            }),
          }),
        }),
      )
    })

    it('should filter by dateTo', async () => {
      // Arrange
      const conversationIds = ['conv-1']
      const query = 'test'
      const dateTo = new Date('2024-12-31')
      const options = { limit: 20, dateTo }
      const mockMessages = [createTestData.message()]

      mockPrismaService.conversationMessage.findMany.mockResolvedValue(mockMessages)
      mockPrismaService.conversationMessage.groupBy
        .mockResolvedValueOnce([{ type: 'TEXT', _count: { type: 1 } }])
        .mockResolvedValueOnce([{ fromUserId: 1, _count: { fromUserId: 1 } }])
        .mockResolvedValueOnce([{ conversationId: 'conv-1', _count: { conversationId: 1 } }])

      // Act
      await repository.searchMessages(conversationIds, query, options)

      // Assert - Kiểm tra where clause có dateTo filter
      expect(mockPrismaService.conversationMessage.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            createdAt: expect.objectContaining({
              lte: dateTo,
            }),
          }),
        }),
      )
    })

    it('should filter by both dateFrom and dateTo', async () => {
      // Arrange
      const conversationIds = ['conv-1']
      const query = 'test'
      const dateFrom = new Date('2024-01-01')
      const dateTo = new Date('2024-12-31')
      const options = { limit: 20, dateFrom, dateTo }
      const mockMessages = [createTestData.message()]

      mockPrismaService.conversationMessage.findMany.mockResolvedValue(mockMessages)
      mockPrismaService.conversationMessage.groupBy
        .mockResolvedValueOnce([{ type: 'TEXT', _count: { type: 1 } }])
        .mockResolvedValueOnce([{ fromUserId: 1, _count: { fromUserId: 1 } }])
        .mockResolvedValueOnce([{ conversationId: 'conv-1', _count: { conversationId: 1 } }])

      // Act
      await repository.searchMessages(conversationIds, query, options)

      // Assert - Kiểm tra where clause có cả dateFrom và dateTo
      expect(mockPrismaService.conversationMessage.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            createdAt: expect.objectContaining({
              gte: dateFrom,
              lte: dateTo,
            }),
          }),
        }),
      )
    })

    it('should handle invalid cursor gracefully (cursor not found)', async () => {
      // Arrange - Cursor không tồn tại
      const conversationIds = ['conv-1']
      const query = 'test'
      const options = { limit: 20, cursor: 'invalid-cursor' }
      const mockMessages = [createTestData.message()]

      mockPrismaService.conversationMessage.findUnique.mockResolvedValue(null) // Cursor not found
      mockPrismaService.conversationMessage.findMany.mockResolvedValue(mockMessages)
      mockPrismaService.conversationMessage.groupBy
        .mockResolvedValueOnce([{ type: 'TEXT', _count: { type: 1 } }])
        .mockResolvedValueOnce([{ fromUserId: 1, _count: { fromUserId: 1 } }])
        .mockResolvedValueOnce([{ conversationId: 'conv-1', _count: { conversationId: 1 } }])

      // Act
      const result = await repository.searchMessages(conversationIds, query, options)

      // Assert - Vẫn trả về kết quả, không throw error (khác với findConversationMessages)
      expect(result).toBeDefined()
      expect(result.data).toHaveLength(1)
    })

    it('should handle hasMore = true when search results exceed limit', async () => {
      // Arrange
      const conversationIds = ['conv-1']
      const query = 'test'
      const options = { limit: 2 }
      const mockMessages = [
        createTestData.message({ id: 'msg-1' }),
        createTestData.message({ id: 'msg-2' }),
        createTestData.message({ id: 'msg-3' }), // Extra
      ]

      mockPrismaService.conversationMessage.findMany.mockResolvedValue(mockMessages)
      mockPrismaService.conversationMessage.groupBy
        .mockResolvedValueOnce([{ type: 'TEXT', _count: { type: 3 } }])
        .mockResolvedValueOnce([{ fromUserId: 1, _count: { fromUserId: 3 } }])
        .mockResolvedValueOnce([{ conversationId: 'conv-1', _count: { conversationId: 3 } }])

      // Act
      const result = await repository.searchMessages(conversationIds, query, options)

      // Assert
      expect(result.pagination.hasMore).toBe(true)
      expect(result.data).toHaveLength(2)
      expect(result.pagination.nextCursor).toBe('msg-2')
    })

    it('should handle empty search results', async () => {
      // Arrange
      const conversationIds = ['conv-1']
      const query = 'nonexistent'
      const options = { limit: 20 }

      mockPrismaService.conversationMessage.findMany.mockResolvedValue([])
      mockPrismaService.conversationMessage.groupBy
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])

      // Act
      const result = await repository.searchMessages(conversationIds, query, options)

      // Assert
      expect(result.data).toHaveLength(0)
      expect(result.pagination.hasMore).toBe(false)
      expect(result.pagination.nextCursor).toBeNull()
    })
  })

  describe('addReaction / removeReaction', () => {
    it('should add reaction successfully (upsert)', async () => {
      // Arrange - Chuẩn bị dữ liệu thêm reaction
      const messageId = 'msg-1'
      const userId = 1
      const emoji = '👍'
      const mockReaction = createTestData.reaction({ emoji })

      mockPrismaService.messageReaction.upsert.mockResolvedValue(mockReaction)

      // Act - Thực hiện thêm reaction
      const result = await repository.addReaction(messageId, userId, emoji)

      // Assert - Kiểm tra kết quả
      expect(result).toBeDefined()
      expect(result.emoji).toBe(emoji)
      expect(mockPrismaService.messageReaction.upsert).toHaveBeenCalledWith({
        where: {
          messageId_userId_emoji: {
            messageId,
            userId,
            emoji,
          },
        },
        create: expect.any(Object),
        update: expect.any(Object),
        include: expect.any(Object),
      })
    })

    it('should remove reaction successfully', async () => {
      // Arrange - Chuẩn bị dữ liệu xóa reaction
      const messageId = 'msg-1'
      const userId = 1
      const emoji = '👍'

      mockPrismaService.messageReaction.delete.mockResolvedValue({})

      // Act - Thực hiện xóa reaction
      await repository.removeReaction(messageId, userId, emoji)

      // Assert - Kiểm tra kết quả
      expect(mockPrismaService.messageReaction.delete).toHaveBeenCalledWith({
        where: {
          messageId_userId_emoji: {
            messageId,
            userId,
            emoji,
          },
        },
      })
    })
  })

  describe('markAsRead / markConversationAsRead', () => {
    it('should mark single message as read (upsert read receipt)', async () => {
      // Arrange - Chuẩn bị dữ liệu đánh dấu đã đọc
      const messageId = 'msg-1'
      const userId = 1
      const mockReadReceipt = createTestData.readReceipt()

      mockPrismaService.messageReadReceipt.upsert.mockResolvedValue(mockReadReceipt)

      // Act - Thực hiện đánh dấu đã đọc
      const result = await repository.markAsRead(messageId, userId)

      // Assert - Kiểm tra kết quả
      expect(result).toBeDefined()
      expect(mockPrismaService.messageReadReceipt.upsert).toHaveBeenCalledWith({
        where: {
          messageId_userId: {
            messageId,
            userId,
          },
        },
        create: expect.any(Object),
        update: expect.any(Object),
        include: expect.any(Object),
      })
    })

    it('should mark multiple messages as read', async () => {
      // Arrange - Chuẩn bị dữ liệu đánh dấu nhiều tin nhắn đã đọc
      const conversationId = 'conv-1'
      const userId = 1
      const mockMessages = [createTestData.message(), createTestData.message({ id: 'msg-2' })]

      mockPrismaService.conversationMessage.findMany.mockResolvedValue(mockMessages)
      mockPrismaService.messageReadReceipt.createMany.mockResolvedValue({ count: 2 })

      // Act - Thực hiện đánh dấu đã đọc
      const result = await repository.markConversationAsRead(conversationId, userId)

      // Assert - Kiểm tra kết quả
      expect(result).toBe(2)
      expect(mockPrismaService.conversationMessage.findMany).toHaveBeenCalled()
      expect(mockPrismaService.messageReadReceipt.createMany).toHaveBeenCalled()
    })

    it('should exclude own messages when marking as read', async () => {
      // Arrange - Chuẩn bị dữ liệu không đánh dấu tin nhắn của chính mình
      const conversationId = 'conv-1'
      const userId = 1

      mockPrismaService.conversationMessage.findMany.mockResolvedValue([])
      mockPrismaService.messageReadReceipt.createMany.mockResolvedValue({ count: 0 })

      // Act - Thực hiện đánh dấu đã đọc
      const result = await repository.markConversationAsRead(conversationId, userId)

      // Assert - Kiểm tra kết quả
      expect(result).toBe(0)
      expect(mockPrismaService.conversationMessage.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            fromUserId: { not: userId },
          }),
        }),
      )
    })
  })

  describe('getLastMessage', () => {
    it('should get last non-deleted message', async () => {
      // Arrange - Chuẩn bị dữ liệu lấy tin nhắn cuối
      const conversationId = 'conv-1'
      const mockMessage = createTestData.message()

      mockPrismaService.conversationMessage.findFirst.mockResolvedValue(mockMessage)

      // Act - Thực hiện lấy tin nhắn cuối
      const result = await repository.getLastMessage(conversationId)

      // Assert - Kiểm tra kết quả
      expect(result).toBeDefined()
      expect(result?.id).toBe('msg-1')
      expect(mockPrismaService.conversationMessage.findFirst).toHaveBeenCalledWith({
        where: {
          conversationId,
          isDeleted: false,
        },
        orderBy: { createdAt: 'desc' },
        include: expect.any(Object),
      })
    })

    it('should return null when no messages', async () => {
      // Arrange - Chuẩn bị dữ liệu không có tin nhắn
      const conversationId = 'conv-empty'

      mockPrismaService.conversationMessage.findFirst.mockResolvedValue(null)

      // Act - Thực hiện lấy tin nhắn cuối
      const result = await repository.getLastMessage(conversationId)

      // Assert - Kiểm tra kết quả
      expect(result).toBeNull()
    })
  })

  describe('getUnreadCount', () => {
    it('should count unread messages for user', async () => {
      // Arrange - Chuẩn bị dữ liệu đếm tin nhắn chưa đọc
      const conversationId = 'conv-1'
      const userId = 1

      mockPrismaService.conversationMessage.count.mockResolvedValue(5)

      // Act - Thực hiện đếm
      const result = await repository.getUnreadCount(conversationId, userId)

      // Assert - Kiểm tra kết quả
      expect(result).toBe(5)
      expect(mockPrismaService.conversationMessage.count).toHaveBeenCalledWith({
        where: {
          conversationId,
          fromUserId: { not: userId },
          createdAt: undefined,
          isDeleted: false,
        },
      })
    })

    it('should exclude messages after lastReadAt', async () => {
      // Arrange - Chuẩn bị dữ liệu với lastReadAt
      const conversationId = 'conv-1'
      const userId = 1
      const lastReadAt = new Date('2024-01-01')

      mockPrismaService.conversationMessage.count.mockResolvedValue(3)

      // Act - Thực hiện đếm
      const result = await repository.getUnreadCount(conversationId, userId, lastReadAt)

      // Assert - Kiểm tra kết quả
      expect(result).toBe(3)
      expect(mockPrismaService.conversationMessage.count).toHaveBeenCalledWith({
        where: {
          conversationId,
          fromUserId: { not: userId },
          createdAt: { gt: lastReadAt },
          isDeleted: false,
        },
      })
    })

    it('should return 0 when all messages are read', async () => {
      // Arrange - Chuẩn bị dữ liệu tất cả đã đọc
      const conversationId = 'conv-1'
      const userId = 1

      mockPrismaService.conversationMessage.count.mockResolvedValue(0)

      // Act - Thực hiện đếm
      const result = await repository.getUnreadCount(conversationId, userId)

      // Assert - Kiểm tra kết quả
      expect(result).toBe(0)
    })
  })

  describe('getMessageStats', () => {
    it('should aggregate message statistics', async () => {
      // Arrange - Chuẩn bị dữ liệu thống kê
      const conversationId = 'conv-1'

      mockPrismaService.conversationMessage.count.mockResolvedValue(100)
      mockPrismaService.conversationMessage.groupBy.mockResolvedValue([
        { type: 'TEXT', _count: { type: 80 } },
        { type: 'IMAGE', _count: { type: 20 } },
      ])
      mockPrismaService.messageAttachment.count.mockResolvedValue(20)

      // Act - Thực hiện lấy thống kê
      const result = await repository.getMessageStats(conversationId)

      // Assert - Kiểm tra kết quả
      expect(result).toBeDefined()
      expect(result.total).toBe(100)
      expect(result.byType).toEqual({ TEXT: 80, IMAGE: 20 })
      expect(result.mediaCount).toBe(20)
    })

    it('should group by type correctly', async () => {
      // Arrange - Chuẩn bị dữ liệu group by type
      const conversationId = 'conv-1'

      mockPrismaService.conversationMessage.count.mockResolvedValue(50)
      mockPrismaService.conversationMessage.groupBy.mockResolvedValue([
        { type: 'TEXT', _count: { type: 30 } },
        { type: 'IMAGE', _count: { type: 15 } },
        { type: 'VIDEO', _count: { type: 5 } },
      ])
      mockPrismaService.messageAttachment.count.mockResolvedValue(20)

      // Act - Thực hiện lấy thống kê
      const result = await repository.getMessageStats(conversationId)

      // Assert - Kiểm tra kết quả
      expect(result.byType).toEqual({
        TEXT: 30,
        IMAGE: 15,
        VIDEO: 5,
      })
    })

    it('should handle empty conversation', async () => {
      // Arrange - Chuẩn bị dữ liệu conversation rỗng
      const conversationId = 'conv-empty'

      mockPrismaService.conversationMessage.count.mockResolvedValue(0)
      mockPrismaService.conversationMessage.groupBy.mockResolvedValue([])
      mockPrismaService.messageAttachment.count.mockResolvedValue(0)

      // Act - Thực hiện lấy thống kê
      const result = await repository.getMessageStats(conversationId)

      // Assert - Kiểm tra kết quả
      expect(result.total).toBe(0)
      expect(result.byType).toEqual({})
      expect(result.mediaCount).toBe(0)
    })
  })

  describe('getReactionStats', () => {
    it('should group reactions by emoji', async () => {
      // Arrange - Chuẩn bị dữ liệu thống kê reaction
      const messageId = 'msg-1'

      mockPrismaService.messageReaction.groupBy.mockResolvedValue([
        { emoji: '👍', _count: { emoji: 5 } },
        { emoji: '❤️', _count: { emoji: 3 } },
      ])

      // Act - Thực hiện lấy thống kê
      const result = await repository.getReactionStats(messageId)

      // Assert - Kiểm tra kết quả
      expect(result).toEqual({
        '👍': 5,
        '❤️': 3,
      })
    })

    it('should count reactions per emoji correctly', async () => {
      // Arrange - Chuẩn bị dữ liệu đếm reaction
      const messageId = 'msg-1'

      mockPrismaService.messageReaction.groupBy.mockResolvedValue([
        { emoji: '👍', _count: { emoji: 10 } },
        { emoji: '😂', _count: { emoji: 7 } },
        { emoji: '❤️', _count: { emoji: 5 } },
      ])

      // Act - Thực hiện lấy thống kê
      const result = await repository.getReactionStats(messageId)

      // Assert - Kiểm tra kết quả
      expect(result).toEqual({
        '👍': 10,
        '😂': 7,
        '❤️': 5,
      })
    })

    it('should handle messages without reactions', async () => {
      // Arrange - Chuẩn bị dữ liệu không có reaction
      const messageId = 'msg-1'

      mockPrismaService.messageReaction.groupBy.mockResolvedValue([])

      // Act - Thực hiện lấy thống kê
      const result = await repository.getReactionStats(messageId)

      // Assert - Kiểm tra kết quả
      expect(result).toEqual({})
    })
  })

  describe('getReadReceiptStats', () => {
    it('should calculate read percentage', async () => {
      // Arrange - Chuẩn bị dữ liệu thống kê đã đọc
      const messageId = 'msg-1'
      const mockMessage = {
        ...createTestData.message(),
        conversation: {
          _count: {
            members: 10,
          },
        },
      }

      mockPrismaService.messageReadReceipt.count.mockResolvedValue(5)
      mockPrismaService.conversationMessage.findUnique.mockResolvedValue(mockMessage as any)

      // Act - Thực hiện lấy thống kê
      const result = await repository.getReadReceiptStats(messageId)

      // Assert - Kiểm tra kết quả
      expect(result).toBeDefined()
      expect(result.readCount).toBe(5)
      expect(result.totalMembers).toBe(9) // 10 - 1 (author)
      expect(result.readPercentage).toBeCloseTo(55.56, 1)
    })

    it('should count total members and readers correctly', async () => {
      // Arrange - Chuẩn bị dữ liệu đếm members
      const messageId = 'msg-1'
      const mockMessage = {
        ...createTestData.message(),
        conversation: {
          _count: {
            members: 10,
          },
        },
      }

      mockPrismaService.messageReadReceipt.count.mockResolvedValue(8)
      mockPrismaService.conversationMessage.findUnique.mockResolvedValue(mockMessage as any)

      // Act - Thực hiện lấy thống kê
      const result = await repository.getReadReceiptStats(messageId)

      // Assert - Kiểm tra kết quả
      expect(result.readCount).toBe(8)
      expect(result.totalMembers).toBe(9) // 10 - 1 (author)
      expect(result.readPercentage).toBeCloseTo(88.89, 1)
    })

    it('should exclude author from totalMembers count', async () => {
      // Arrange - Test author exclusion logic
      const messageId = 'msg-1'
      const mockMessage = {
        ...createTestData.message({ fromUserId: 1 }), // Author is user 1
        conversation: {
          _count: {
            members: 5, // Total 5 members including author
          },
        },
      }

      mockPrismaService.messageReadReceipt.count.mockResolvedValue(3)
      mockPrismaService.conversationMessage.findUnique.mockResolvedValue(mockMessage as any)

      // Act
      const result = await repository.getReadReceiptStats(messageId)

      // Assert - totalMembers should be 4 (5 - 1 author)
      expect(result.totalMembers).toBe(4)
      expect(result.readPercentage).toBe(75) // 3/4 = 75%
    })

    it('should handle conversation with only author (totalMembers = 0)', async () => {
      // Arrange - Conversation chỉ có 1 member (author)
      const messageId = 'msg-1'
      const mockMessage = {
        ...createTestData.message({ fromUserId: 1 }),
        conversation: {
          _count: {
            members: 1, // Only author
          },
        },
      }

      mockPrismaService.messageReadReceipt.count.mockResolvedValue(0)
      mockPrismaService.conversationMessage.findUnique.mockResolvedValue(mockMessage as any)

      // Act
      const result = await repository.getReadReceiptStats(messageId)

      // Assert - totalMembers = 0, readPercentage = 0
      expect(result.totalMembers).toBe(0)
      expect(result.readPercentage).toBe(0)
    })

    it('should handle message with _count.members = 0', async () => {
      // Arrange - Conversation không có members
      const messageId = 'msg-1'
      const mockMessage = {
        ...createTestData.message(),
        conversation: {
          _count: {
            members: 0,
          },
        },
      }

      mockPrismaService.messageReadReceipt.count.mockResolvedValue(0)
      mockPrismaService.conversationMessage.findUnique.mockResolvedValue(mockMessage as any)

      // Act
      const result = await repository.getReadReceiptStats(messageId)

      // Assert - totalMembers = 0 (0 - 1 author = -1, clamped to 0 via Math.max)
      expect(result.totalMembers).toBe(0)
      expect(result.readPercentage).toBe(0)
    })

    it('should handle messages without read receipts', async () => {
      // Arrange - Chuẩn bị dữ liệu không có read receipt
      const messageId = 'msg-1'
      const mockMessage = {
        ...createTestData.message(),
        conversation: {
          _count: {
            members: 10,
          },
        },
      }

      mockPrismaService.messageReadReceipt.count.mockResolvedValue(0)
      mockPrismaService.conversationMessage.findUnique.mockResolvedValue(mockMessage as any)

      // Act - Thực hiện lấy thống kê
      const result = await repository.getReadReceiptStats(messageId)

      // Assert - Kiểm tra kết quả
      expect(result.readCount).toBe(0)
      expect(result.totalMembers).toBe(9) // 10 - 1 (author)
      expect(result.readPercentage).toBe(0)
    })
  })

  describe('getMessageReactions', () => {
    it('should get all reactions for a message', async () => {
      // Arrange - Chuẩn bị dữ liệu reactions
      const messageId = 'msg-1'
      const mockReactions = [
        { id: 'react-1', messageId, userId: 1, emoji: '👍', createdAt: new Date() },
        { id: 'react-2', messageId, userId: 2, emoji: '❤️', createdAt: new Date() },
      ]

      mockPrismaService.messageReaction.findMany.mockResolvedValue(mockReactions)

      // Act - Thực hiện lấy reactions
      const result = await repository.getMessageReactions(messageId)

      // Assert - Kiểm tra kết quả
      expect(result).toHaveLength(2)
      expect(mockPrismaService.messageReaction.findMany).toHaveBeenCalledWith({
        where: { messageId },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              avatar: true,
              status: true,
            },
          },
        },
        orderBy: { createdAt: 'asc' },
      })
    })
  })

  describe('markConversationAsRead', () => {
    it('should mark conversation as read up to specific message', async () => {
      // Arrange - Chuẩn bị dữ liệu đánh dấu đã đọc
      const conversationId = 'conv-1'
      const userId = 1
      const upToMessageId = 'msg-10'
      const mockMessage = createTestData.message({ id: upToMessageId, createdAt: new Date() })
      const mockMessages = [
        createTestData.message({ id: 'msg-8' }),
        createTestData.message({ id: 'msg-9' }),
        mockMessage,
      ]

      mockPrismaService.conversationMessage.findUnique.mockResolvedValue(mockMessage)
      mockPrismaService.conversationMessage.findMany.mockResolvedValue(mockMessages)
      mockPrismaService.messageReadReceipt.createMany.mockResolvedValue({ count: 3 })

      // Act - Thực hiện đánh dấu đã đọc
      await repository.markConversationAsRead(conversationId, userId, upToMessageId)

      // Assert - Kiểm tra where clause có createdAt filter
      expect(mockPrismaService.conversationMessage.findUnique).toHaveBeenCalledWith({
        where: { id: upToMessageId },
        select: { createdAt: true },
      })
      expect(mockPrismaService.conversationMessage.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            conversationId,
            createdAt: { lte: mockMessage.createdAt },
          }),
        }),
      )
    })
  })

  describe('getReadReceipts', () => {
    it('should get all read receipts for a message', async () => {
      // Arrange - Chuẩn bị dữ liệu read receipts
      const messageId = 'msg-1'
      const mockReceipts = [
        { id: 'receipt-1', messageId, userId: 1, readAt: new Date() },
        { id: 'receipt-2', messageId, userId: 2, readAt: new Date() },
      ]

      mockPrismaService.messageReadReceipt.findMany.mockResolvedValue(mockReceipts)

      // Act - Thực hiện lấy read receipts
      const result = await repository.getReadReceipts(messageId)

      // Assert - Kiểm tra kết quả
      expect(result).toHaveLength(2)
      expect(mockPrismaService.messageReadReceipt.findMany).toHaveBeenCalledWith({
        where: { messageId },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              avatar: true,
              status: true,
            },
          },
        },
        orderBy: { readAt: 'asc' },
      })
    })
  })

  describe('isMessageAuthor', () => {
    it('should return true when user is message author', async () => {
      // Arrange - Chuẩn bị dữ liệu user là tác giả
      const messageId = 'msg-1'
      const userId = 1
      const mockMessage = createTestData.message({ id: messageId, fromUserId: userId })

      mockPrismaService.conversationMessage.findUnique.mockResolvedValue(mockMessage)

      // Act - Thực hiện kiểm tra
      const result = await repository.isMessageAuthor(messageId, userId)

      // Assert - Kiểm tra kết quả
      expect(result).toBe(true)
    })

    it('should return false when user is not message author', async () => {
      // Arrange - Chuẩn bị dữ liệu user không phải tác giả
      const messageId = 'msg-1'
      const userId = 2
      const mockMessage = createTestData.message({ id: messageId, fromUserId: 1 })

      mockPrismaService.conversationMessage.findUnique.mockResolvedValue(mockMessage)

      // Act - Thực hiện kiểm tra
      const result = await repository.isMessageAuthor(messageId, userId)

      // Assert - Kiểm tra kết quả
      expect(result).toBe(false)
    })

    it('should return false when message not found', async () => {
      // Arrange - Chuẩn bị dữ liệu tin nhắn không tồn tại
      const messageId = 'msg-nonexistent'
      const userId = 1

      mockPrismaService.conversationMessage.findUnique.mockResolvedValue(null)

      // Act - Thực hiện kiểm tra
      const result = await repository.isMessageAuthor(messageId, userId)

      // Assert - Kiểm tra kết quả
      expect(result).toBe(false)
    })
  })
})
