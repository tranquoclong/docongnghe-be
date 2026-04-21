import { Test, TestingModule } from '@nestjs/testing'
import { Server } from 'socket.io'
import { MessageService } from 'src/routes/conversation/message.service'
import { ConversationService } from 'src/routes/conversation/conversation.service'
import { ChatRedisService } from '../../services/chat-redis.service'
import { AuthenticatedSocket } from '../../websocket.interfaces'
import { ChatMessageHandler, DeleteMessageData, EditMessageData, SendMessageData } from '../chat-message.handler'

/**
 * CHAT MESSAGE HANDLER UNIT TESTS
 *
 * Test coverage cho message operations
 * - Send message (text, attachments, reply)
 * - Edit message
 * - Delete message (for self, for everyone)
 * - Real-time broadcasting
 * - Error handling
 */

describe('ChatMessageHandler', () => {
  let handler: ChatMessageHandler
  let mockMessageService: jest.Mocked<MessageService>
  let mockConversationService: jest.Mocked<ConversationService>
  let mockRedisService: jest.Mocked<ChatRedisService>
  let mockServer: jest.Mocked<Server>
  let mockClient: jest.Mocked<AuthenticatedSocket>

  const CONVERSATION_ID = '550e8400-e29b-41d4-a716-446655440000'
  const MESSAGE_ID = '550e8400-e29b-41d4-a716-446655440001'
  const REPLY_MESSAGE_ID = '550e8400-e29b-41d4-a716-446655440002'

  const createMockMessage = (overrides = {}) =>
    ({
      id: MESSAGE_ID,
      conversationId: CONVERSATION_ID,
      fromUserId: 1,
      content: 'Test message',
      type: 'TEXT',
      replyToId: null,
      isEdited: false,
      editedAt: null,
      isDeleted: false,
      deletedAt: null,
      deletedForEveryone: false,
      createdAt: new Date(),
      updatedAt: new Date(),
      attachments: [],
      reactions: [],
      readBy: [],
      fromUser: null,
      replyTo: null,
      conversation: null,
      ...overrides,
    }) as any

  beforeEach(async () => {
    mockMessageService = {
      sendMessage: jest.fn(),
      editMessage: jest.fn(),
      deleteMessage: jest.fn(),
      getMessageById: jest.fn(),
    } as any

    mockConversationService = {
      getConversationById: jest.fn(),
    } as any

    mockRedisService = {
      removeUserTyping: jest.fn(),
      areUsersOnline: jest.fn(),
      isUserOnline: jest.fn(),
    } as any

    mockServer = {
      to: jest.fn().mockReturnThis(),
      emit: jest.fn(),
    } as any

    mockClient = {
      id: 'socket-123',
      userId: 1,
      user: {
        id: 1,
        name: 'Test User',
        email: 'test@example.com',
      },
      emit: jest.fn(),
      to: jest.fn().mockReturnThis(),
    } as any

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ChatMessageHandler,
        { provide: MessageService, useValue: mockMessageService },
        { provide: ConversationService, useValue: mockConversationService },
        { provide: ChatRedisService, useValue: mockRedisService },
      ],
    }).compile()

    handler = module.get<ChatMessageHandler>(ChatMessageHandler)
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  // ============================================
  // SEND MESSAGE TESTS
  // ============================================

  describe('handleSendMessage', () => {
    describe('✅ Success Cases', () => {
      it('should send text message successfully', async () => {
        const data: SendMessageData = {
          conversationId: CONVERSATION_ID,
          content: 'Hello world',
          type: 'TEXT',
        }
        const mockMessage = createMockMessage()
        mockMessageService.sendMessage.mockResolvedValue(mockMessage)

        await handler.handleSendMessage(mockServer, mockClient, data)

        expect(mockMessageService.sendMessage).toHaveBeenCalledWith(1, {
          conversationId: CONVERSATION_ID,
          content: 'Hello world',
          type: 'TEXT',
          replyToId: undefined,
          attachments: undefined,
        })
        expect(mockRedisService.removeUserTyping).toHaveBeenCalledWith(CONVERSATION_ID, 1)
        expect(mockServer.to).toHaveBeenCalledWith(`conversation:${CONVERSATION_ID}`)
        expect(mockServer.emit).toHaveBeenCalledWith(
          'new_message',
          expect.objectContaining({
            message: mockMessage,
          }),
        )
      })

      it('should send message with attachments', async () => {
        const data: SendMessageData = {
          conversationId: CONVERSATION_ID,
          content: 'Check this image',
          type: 'IMAGE',
          attachments: [
            {
              type: 'IMAGE',
              fileName: 'photo.jpg',
              fileUrl: 'https://example.com/photo.jpg',
              fileSize: 1024,
              mimeType: 'image/jpeg',
            },
          ],
        }
        const mockMessage = createMockMessage({ type: 'IMAGE' })
        mockMessageService.sendMessage.mockResolvedValue(mockMessage)

        await handler.handleSendMessage(mockServer, mockClient, data)

        expect(mockMessageService.sendMessage).toHaveBeenCalledWith(
          1,
          expect.objectContaining({
            attachments: expect.arrayContaining([expect.objectContaining({ type: 'IMAGE', fileName: 'photo.jpg' })]),
          }),
        )
      })

      it('should send reply message', async () => {
        const data: SendMessageData = {
          conversationId: CONVERSATION_ID,
          content: 'Reply to previous message',
          type: 'TEXT',
          replyToId: REPLY_MESSAGE_ID,
        }
        const mockMessage = createMockMessage({ replyToId: REPLY_MESSAGE_ID })
        mockMessageService.sendMessage.mockResolvedValue(mockMessage)

        await handler.handleSendMessage(mockServer, mockClient, data)

        expect(mockMessageService.sendMessage).toHaveBeenCalledWith(
          1,
          expect.objectContaining({
            replyToId: REPLY_MESSAGE_ID,
          }),
        )
      })

      it('should handle tempId for client-side deduplication', async () => {
        const data: SendMessageData = {
          conversationId: CONVERSATION_ID,
          content: 'Test',
          tempId: 'temp-123',
        }
        const mockMessage = createMockMessage()
        mockMessageService.sendMessage.mockResolvedValue(mockMessage)

        await handler.handleSendMessage(mockServer, mockClient, data)

        expect(mockServer.emit).toHaveBeenCalledWith(
          'new_message',
          expect.objectContaining({
            tempId: 'temp-123',
          }),
        )
      })

      it('should remove typing indicator after sending message', async () => {
        const data: SendMessageData = {
          conversationId: CONVERSATION_ID,
          content: 'Test',
        }
        mockMessageService.sendMessage.mockResolvedValue(createMockMessage())

        await handler.handleSendMessage(mockServer, mockClient, data)

        expect(mockRedisService.removeUserTyping).toHaveBeenCalledWith(CONVERSATION_ID, 1)
      })

      it('should send message with multiple attachments', async () => {
        const data: SendMessageData = {
          conversationId: CONVERSATION_ID,
          content: 'Multiple files',
          attachments: [
            { type: 'IMAGE', fileName: 'img1.jpg', fileUrl: 'https://example.com/img1.jpg' },
            { type: 'DOCUMENT', fileName: 'doc.pdf', fileUrl: 'https://example.com/doc.pdf' },
          ],
        }
        mockMessageService.sendMessage.mockResolvedValue(createMockMessage())

        await handler.handleSendMessage(mockServer, mockClient, data)

        expect(mockMessageService.sendMessage).toHaveBeenCalledWith(
          1,
          expect.objectContaining({
            attachments: expect.arrayContaining([
              expect.objectContaining({ fileName: 'img1.jpg' }),
              expect.objectContaining({ fileName: 'doc.pdf' }),
            ]),
          }),
        )
      })

      it('should handle different message types', async () => {
        const types: Array<SendMessageData['type']> = ['TEXT', 'IMAGE', 'VIDEO', 'AUDIO', 'FILE', 'STICKER']

        for (const type of types) {
          const data: SendMessageData = {
            conversationId: CONVERSATION_ID,
            content: `Message of type ${type}`,
            type,
          }
          mockMessageService.sendMessage.mockResolvedValue(createMockMessage({ type }))

          await handler.handleSendMessage(mockServer, mockClient, data)

          expect(mockMessageService.sendMessage).toHaveBeenCalledWith(1, expect.objectContaining({ type }))
        }
      })

      it('should broadcast to conversation room', async () => {
        const data: SendMessageData = {
          conversationId: CONVERSATION_ID,
          content: 'Test',
        }
        mockMessageService.sendMessage.mockResolvedValue(createMockMessage())

        await handler.handleSendMessage(mockServer, mockClient, data)

        expect(mockServer.to).toHaveBeenCalledWith(`conversation:${CONVERSATION_ID}`)
      })

      it('should send confirmation to sender', async () => {
        const data: SendMessageData = {
          conversationId: CONVERSATION_ID,
          content: 'Test',
        }
        const mockMessage = createMockMessage()
        mockMessageService.sendMessage.mockResolvedValue(mockMessage)

        await handler.handleSendMessage(mockServer, mockClient, data)

        expect(mockClient.emit).toHaveBeenCalledWith(
          'message_sent',
          expect.objectContaining({
            message: mockMessage,
          }),
        )
      })

      it('should use batch areUsersOnline() for offline notifications instead of individual calls', async () => {
        const data: SendMessageData = {
          conversationId: CONVERSATION_ID,
          content: 'Test message',
        }
        const mockMessage = createMockMessage()
        mockMessageService.sendMessage.mockResolvedValue(mockMessage)

        // Mock conversation with multiple members
        mockConversationService.getConversationById.mockResolvedValue({
          id: CONVERSATION_ID,
          members: [
            {
              userId: 1,
              isActive: true,
              isMuted: false,
              user: { id: 1, name: 'Sender', email: 's@test.com', avatar: null, status: 'ACTIVE' },
            },
            {
              userId: 2,
              isActive: true,
              isMuted: false,
              user: { id: 2, name: 'User 2', email: 'u2@test.com', avatar: null, status: 'ACTIVE' },
            },
            {
              userId: 3,
              isActive: true,
              isMuted: false,
              user: { id: 3, name: 'User 3', email: 'u3@test.com', avatar: null, status: 'ACTIVE' },
            },
            {
              userId: 4,
              isActive: true,
              isMuted: true,
              user: { id: 4, name: 'Muted User', email: 'u4@test.com', avatar: null, status: 'ACTIVE' },
            },
            {
              userId: 5,
              isActive: false,
              isMuted: false,
              user: { id: 5, name: 'Inactive User', email: 'u5@test.com', avatar: null, status: 'ACTIVE' },
            },
          ],
        } as any)

        // Mock batch online check - user 2 online, user 3 offline
        mockRedisService.areUsersOnline.mockResolvedValue(
          new Map([
            [2, true],
            [3, false],
          ]),
        )

        await handler.handleSendMessage(mockServer, mockClient, data)

        // Verify batch call was made with eligible member IDs (excluding sender=1, muted=4, inactive=5)
        expect(mockRedisService.areUsersOnline).toHaveBeenCalledTimes(1)
        expect(mockRedisService.areUsersOnline).toHaveBeenCalledWith([2, 3])

        // Verify individual isUserOnline was NOT called
        expect(mockRedisService.isUserOnline).not.toHaveBeenCalled()
      })
    })

    describe('❌ Error Cases', () => {
      it('should handle service errors', async () => {
        const data: SendMessageData = {
          conversationId: CONVERSATION_ID,
          content: 'Test',
        }
        mockMessageService.sendMessage.mockRejectedValue(new Error('Database error'))

        await handler.handleSendMessage(mockServer, mockClient, data)

        expect(mockClient.emit).toHaveBeenCalledWith(
          'error',
          expect.objectContaining({
            event: 'send_message',
            message: 'Database error',
          }),
        )
      })

      it('should handle permission errors', async () => {
        const data: SendMessageData = {
          conversationId: CONVERSATION_ID,
          content: 'Test',
        }
        mockMessageService.sendMessage.mockRejectedValue(new Error('Not a member of conversation'))

        await handler.handleSendMessage(mockServer, mockClient, data)

        expect(mockClient.emit).toHaveBeenCalledWith(
          'error',
          expect.objectContaining({
            event: 'send_message',
            message: 'Not a member of conversation',
          }),
        )
      })

      it('should handle empty content gracefully', async () => {
        const data: SendMessageData = {
          conversationId: CONVERSATION_ID,
          content: '',
        }
        mockMessageService.sendMessage.mockRejectedValue(new Error('Content is required'))

        await handler.handleSendMessage(mockServer, mockClient, data)

        expect(mockClient.emit).toHaveBeenCalledWith(
          'error',
          expect.objectContaining({
            event: 'send_message',
            message: 'Content is required',
          }),
        )
      })
    })
  })

  // ============================================
  // EDIT MESSAGE TESTS
  // ============================================

  describe('handleEditMessage', () => {
    describe('✅ Success Cases', () => {
      it('should edit message successfully', async () => {
        const data: EditMessageData = {
          messageId: MESSAGE_ID,
          content: 'Updated content',
        }
        const mockMessage = createMockMessage({ content: 'Updated content' })
        mockMessageService.editMessage.mockResolvedValue(mockMessage)

        await handler.handleEditMessage(mockServer, mockClient, data)

        expect(mockMessageService.editMessage).toHaveBeenCalledWith(MESSAGE_ID, 1, 'Updated content')
        expect(mockServer.to).toHaveBeenCalledWith(`conversation:${CONVERSATION_ID}`)
        expect(mockServer.emit).toHaveBeenCalledWith(
          'message_edited',
          expect.objectContaining({
            message: mockMessage,
          }),
        )
      })

      it('should send confirmation to editor', async () => {
        const data: EditMessageData = {
          messageId: MESSAGE_ID,
          content: 'Updated',
        }
        const mockMessage = createMockMessage()
        mockMessageService.editMessage.mockResolvedValue(mockMessage)

        await handler.handleEditMessage(mockServer, mockClient, data)

        expect(mockClient.emit).toHaveBeenCalledWith(
          'message_edit_success',
          expect.objectContaining({
            message: mockMessage,
          }),
        )
      })

      it('should broadcast edit to conversation members', async () => {
        const data: EditMessageData = {
          messageId: MESSAGE_ID,
          content: 'Updated',
        }
        mockMessageService.editMessage.mockResolvedValue(createMockMessage())

        await handler.handleEditMessage(mockServer, mockClient, data)

        expect(mockServer.to).toHaveBeenCalledWith(`conversation:${CONVERSATION_ID}`)
        expect(mockServer.emit).toHaveBeenCalledWith('message_edited', expect.any(Object))
      })
    })

    describe('❌ Error Cases', () => {
      it('should handle edit permission errors', async () => {
        const data: EditMessageData = {
          messageId: MESSAGE_ID,
          content: 'Updated',
        }
        mockMessageService.editMessage.mockRejectedValue(new Error('Not authorized to edit'))

        await handler.handleEditMessage(mockServer, mockClient, data)

        expect(mockClient.emit).toHaveBeenCalledWith(
          'error',
          expect.objectContaining({
            event: 'edit_message',
            message: 'Not authorized to edit',
          }),
        )
      })

      it('should handle message not found errors', async () => {
        const data: EditMessageData = {
          messageId: '550e8400-e29b-41d4-a716-446655440099',
          content: 'Updated',
        }
        mockMessageService.editMessage.mockRejectedValue(new Error('Message not found'))

        await handler.handleEditMessage(mockServer, mockClient, data)

        expect(mockClient.emit).toHaveBeenCalledWith('error', expect.any(Object))
      })
    })
  })

  // ============================================
  // DELETE MESSAGE TESTS
  // ============================================

  describe('handleDeleteMessage', () => {
    describe('✅ Success Cases', () => {
      it('should delete message for self', async () => {
        const data: DeleteMessageData = {
          messageId: MESSAGE_ID,
          forEveryone: false,
        }
        const mockMessage = createMockMessage()
        mockMessageService.deleteMessage.mockResolvedValue(mockMessage)

        await handler.handleDeleteMessage(mockServer, mockClient, data)

        expect(mockMessageService.deleteMessage).toHaveBeenCalledWith(MESSAGE_ID, 1, false)
        expect(mockServer.emit).toHaveBeenCalledWith(
          'message_deleted',
          expect.objectContaining({
            forEveryone: false,
          }),
        )
      })

      it('should delete message for everyone', async () => {
        const data: DeleteMessageData = {
          messageId: MESSAGE_ID,
          forEveryone: true,
        }
        const mockMessage = createMockMessage()
        mockMessageService.deleteMessage.mockResolvedValue(mockMessage)

        await handler.handleDeleteMessage(mockServer, mockClient, data)

        expect(mockMessageService.deleteMessage).toHaveBeenCalledWith(MESSAGE_ID, 1, true)
        expect(mockServer.emit).toHaveBeenCalledWith(
          'message_deleted',
          expect.objectContaining({
            forEveryone: true,
          }),
        )
      })

      it('should send delete confirmation', async () => {
        const data: DeleteMessageData = {
          messageId: MESSAGE_ID,
        }
        const mockMessage = createMockMessage()
        mockMessageService.deleteMessage.mockResolvedValue(mockMessage)

        await handler.handleDeleteMessage(mockServer, mockClient, data)

        expect(mockClient.emit).toHaveBeenCalledWith('message_delete_success', expect.any(Object))
      })

      it('should default forEveryone to false', async () => {
        const data: DeleteMessageData = {
          messageId: MESSAGE_ID,
        }
        mockMessageService.deleteMessage.mockResolvedValue(createMockMessage())

        await handler.handleDeleteMessage(mockServer, mockClient, data)

        expect(mockMessageService.deleteMessage).toHaveBeenCalledWith(MESSAGE_ID, 1, false)
      })
    })

    describe('❌ Error Cases', () => {
      it('should handle delete permission errors', async () => {
        const data: DeleteMessageData = {
          messageId: MESSAGE_ID,
        }
        mockMessageService.deleteMessage.mockRejectedValue(new Error('Not authorized to delete'))

        await handler.handleDeleteMessage(mockServer, mockClient, data)

        expect(mockClient.emit).toHaveBeenCalledWith(
          'error',
          expect.objectContaining({
            event: 'delete_message',
          }),
        )
      })

      it('should handle message not found errors', async () => {
        const data: DeleteMessageData = {
          messageId: '550e8400-e29b-41d4-a716-446655440099',
        }
        mockMessageService.deleteMessage.mockRejectedValue(new Error('Message not found'))

        await handler.handleDeleteMessage(mockServer, mockClient, data)

        expect(mockClient.emit).toHaveBeenCalledWith('error', expect.any(Object))
      })
    })
  })
})
