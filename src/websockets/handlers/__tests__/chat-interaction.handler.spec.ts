import { Test, TestingModule } from '@nestjs/testing'
import { Server } from 'socket.io'
import { MessageService } from 'src/routes/conversation/message.service'
import { ConversationService } from 'src/routes/conversation/conversation.service'
import { ConversationRepository } from 'src/routes/conversation/conversation.repo'
import { AuthenticatedSocket } from '../../websocket.interfaces'
import {
  ChatInteractionHandler,
  JoinConversationData,
  MarkAsReadData,
  ReactToMessageData,
} from '../chat-interaction.handler'

/**
 * CHAT INTERACTION HANDLER UNIT TESTS
 *
 * Test coverage cho user interactions
 * - Join/leave conversation
 * - Mark as read
 * - React to message
 * - Online status notifications
 * - System messages
 * - Conversation updates
 */

describe('ChatInteractionHandler', () => {
  let handler: ChatInteractionHandler
  let mockMessageService: jest.Mocked<MessageService>
  let mockConversationService: jest.Mocked<ConversationService>
  let mockConversationRepo: jest.Mocked<ConversationRepository>
  let mockServer: jest.Mocked<Server>
  let mockClient: jest.Mocked<AuthenticatedSocket>

  const CONVERSATION_ID = '550e8400-e29b-41d4-a716-446655440000'
  const MESSAGE_ID = '550e8400-e29b-41d4-a716-446655440001'

  const createMockConversation = (overrides = {}) =>
    ({
      id: CONVERSATION_ID,
      name: 'Test Conversation',
      unreadCount: 0,
      currentUserRole: null,
      isCurrentUserAdmin: false,
      memberCount: 2,
      owner: null,
      ...overrides,
    }) as any

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
      isReadByCurrentUser: false,
      readByCount: 0,
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
      markAsRead: jest.fn(),
      reactToMessage: jest.fn(),
      removeReaction: jest.fn(),
      getMessageById: jest.fn(),
      sendMessage: jest.fn(),
    } as any

    mockConversationService = {
      isUserInConversation: jest.fn(),
      getUserConversations: jest.fn(),
    } as any

    mockConversationRepo = {
      findUserConversationIds: jest.fn(),
      getConversationMembers: jest.fn(),
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
      join: jest.fn(),
      leave: jest.fn(),
      to: jest.fn().mockReturnThis(),
      emit: jest.fn(),
    } as any

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ChatInteractionHandler,
        { provide: MessageService, useValue: mockMessageService },
        { provide: ConversationService, useValue: mockConversationService },
        { provide: ConversationRepository, useValue: mockConversationRepo },
      ],
    }).compile()

    handler = module.get<ChatInteractionHandler>(ChatInteractionHandler)
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  // ============================================
  // JOIN CONVERSATION TESTS
  // ============================================

  describe('handleJoinConversation', () => {
    const joinData: JoinConversationData = { conversationId: CONVERSATION_ID }

    describe('✅ Success Cases', () => {
      it('should join conversation successfully', async () => {
        mockConversationService.isUserInConversation.mockResolvedValue(true)

        await handler.handleJoinConversation(mockServer, mockClient, joinData)

        expect(mockConversationService.isUserInConversation).toHaveBeenCalledWith(CONVERSATION_ID, 1)
        expect(mockClient.join).toHaveBeenCalledWith(`conversation:${CONVERSATION_ID}`)
        expect(mockClient.to).toHaveBeenCalledWith(`conversation:${CONVERSATION_ID}`)
        expect(mockClient.emit).toHaveBeenCalledWith('user_joined_conversation', expect.any(Object))
        expect(mockClient.emit).toHaveBeenCalledWith(
          'joined_conversation',
          expect.objectContaining({
            conversationId: CONVERSATION_ID,
            message: 'Successfully joined conversation',
          }),
        )
      })

      it('should verify membership before joining', async () => {
        mockConversationService.isUserInConversation.mockResolvedValue(true)

        await handler.handleJoinConversation(mockServer, mockClient, joinData)

        expect(mockConversationService.isUserInConversation).toHaveBeenCalledWith(CONVERSATION_ID, 1)
      })

      it('should notify other members about new joiner', async () => {
        mockConversationService.isUserInConversation.mockResolvedValue(true)

        await handler.handleJoinConversation(mockServer, mockClient, joinData)

        expect(mockClient.to).toHaveBeenCalledWith(`conversation:${CONVERSATION_ID}`)
        expect(mockClient.emit).toHaveBeenCalledWith(
          'user_joined_conversation',
          expect.objectContaining({
            userId: 1,
            user: mockClient.user,
          }),
        )
      })

      it('should send confirmation to joiner', async () => {
        mockConversationService.isUserInConversation.mockResolvedValue(true)

        await handler.handleJoinConversation(mockServer, mockClient, joinData)

        expect(mockClient.emit).toHaveBeenCalledWith(
          'joined_conversation',
          expect.objectContaining({
            conversationId: CONVERSATION_ID,
          }),
        )
      })

      it('should include timestamp in events', async () => {
        mockConversationService.isUserInConversation.mockResolvedValue(true)

        await handler.handleJoinConversation(mockServer, mockClient, joinData)

        expect(mockClient.emit).toHaveBeenCalledWith(
          'user_joined_conversation',
          expect.objectContaining({
            timestamp: expect.any(Date),
          }),
        )
      })
    })

    describe('❌ Error Cases', () => {
      it('should reject non-member from joining', async () => {
        mockConversationService.isUserInConversation.mockResolvedValue(false)

        await handler.handleJoinConversation(mockServer, mockClient, joinData)

        expect(mockClient.join).not.toHaveBeenCalled()
        expect(mockClient.emit).toHaveBeenCalledWith(
          'error',
          expect.objectContaining({
            event: 'join_conversation',
            code: 'UNAUTHORIZED',
            message: 'Not a member of this conversation',
          }),
        )
      })

      it('should handle membership check errors', async () => {
        mockConversationService.isUserInConversation.mockRejectedValue(new Error('Database error'))

        await handler.handleJoinConversation(mockServer, mockClient, joinData)

        expect(mockClient.emit).toHaveBeenCalledWith(
          'error',
          expect.objectContaining({
            event: 'join_conversation',
          }),
        )
      })
    })
  })

  // ============================================
  // LEAVE CONVERSATION TESTS
  // ============================================

  describe('handleLeaveConversation', () => {
    const leaveData: JoinConversationData = { conversationId: CONVERSATION_ID }

    describe('✅ Success Cases', () => {
      it('should leave conversation successfully', async () => {
        await handler.handleLeaveConversation(mockServer, mockClient, leaveData)

        expect(mockClient.leave).toHaveBeenCalledWith(`conversation:${CONVERSATION_ID}`)
        expect(mockClient.to).toHaveBeenCalledWith(`conversation:${CONVERSATION_ID}`)
        expect(mockClient.emit).toHaveBeenCalledWith('user_left_conversation', expect.any(Object))
        expect(mockClient.emit).toHaveBeenCalledWith(
          'left_conversation',
          expect.objectContaining({
            conversationId: CONVERSATION_ID,
          }),
        )
      })

      it('should notify other members about user leaving', async () => {
        await handler.handleLeaveConversation(mockServer, mockClient, leaveData)

        expect(mockClient.to).toHaveBeenCalledWith(`conversation:${CONVERSATION_ID}`)
        expect(mockClient.emit).toHaveBeenCalledWith(
          'user_left_conversation',
          expect.objectContaining({
            userId: 1,
          }),
        )
      })

      it('should send confirmation to leaver', async () => {
        await handler.handleLeaveConversation(mockServer, mockClient, leaveData)

        expect(mockClient.emit).toHaveBeenCalledWith(
          'left_conversation',
          expect.objectContaining({
            message: 'Left conversation successfully',
          }),
        )
      })
    })

    describe('❌ Error Cases', () => {
      it('should handle leave errors gracefully', async () => {
        mockClient.leave.mockRejectedValue(new Error('Socket error'))

        await handler.handleLeaveConversation(mockServer, mockClient, leaveData)

        expect(mockClient.emit).toHaveBeenCalledWith(
          'error',
          expect.objectContaining({
            event: 'leave_conversation',
          }),
        )
      })
    })
  })

  // ============================================
  // MARK AS READ TESTS
  // ============================================

  describe('handleMarkAsRead', () => {
    describe('✅ Success Cases', () => {
      it('should mark messages as read successfully', async () => {
        const data: MarkAsReadData = { conversationId: CONVERSATION_ID }
        mockMessageService.markAsRead.mockResolvedValue({ markedCount: 5 })

        await handler.handleMarkAsRead(mockServer, mockClient, data)

        expect(mockMessageService.markAsRead).toHaveBeenCalledWith(CONVERSATION_ID, 1, undefined)
        expect(mockClient.to).toHaveBeenCalledWith(`conversation:${CONVERSATION_ID}`)
        expect(mockClient.emit).toHaveBeenCalledWith(
          'messages_read',
          expect.objectContaining({
            markedCount: 5,
          }),
        )
      })

      it('should mark specific message as read', async () => {
        const data: MarkAsReadData = { conversationId: CONVERSATION_ID, messageId: MESSAGE_ID }
        mockMessageService.markAsRead.mockResolvedValue({ markedCount: 1 })

        await handler.handleMarkAsRead(mockServer, mockClient, data)

        expect(mockMessageService.markAsRead).toHaveBeenCalledWith(CONVERSATION_ID, 1, MESSAGE_ID)
      })

      it('should notify conversation members about read receipt', async () => {
        const data: MarkAsReadData = { conversationId: CONVERSATION_ID }
        mockMessageService.markAsRead.mockResolvedValue({ markedCount: 3 })

        await handler.handleMarkAsRead(mockServer, mockClient, data)

        expect(mockClient.to).toHaveBeenCalledWith(`conversation:${CONVERSATION_ID}`)
        expect(mockClient.emit).toHaveBeenCalledWith(
          'messages_read',
          expect.objectContaining({
            userId: 1,
            user: mockClient.user,
          }),
        )
      })

      it('should send confirmation to reader', async () => {
        const data: MarkAsReadData = { conversationId: CONVERSATION_ID }
        mockMessageService.markAsRead.mockResolvedValue({ markedCount: 2 })

        await handler.handleMarkAsRead(mockServer, mockClient, data)

        expect(mockClient.emit).toHaveBeenCalledWith(
          'mark_as_read_success',
          expect.objectContaining({
            markedCount: 2,
          }),
        )
      })
    })

    describe('❌ Error Cases', () => {
      it('should handle mark as read errors', async () => {
        const data: MarkAsReadData = { conversationId: CONVERSATION_ID }
        mockMessageService.markAsRead.mockRejectedValue(new Error('Not authorized'))

        await handler.handleMarkAsRead(mockServer, mockClient, data)

        expect(mockClient.emit).toHaveBeenCalledWith(
          'error',
          expect.objectContaining({
            event: 'mark_as_read',
            message: 'Not authorized',
          }),
        )
      })
    })
  })

  // ============================================
  // REACT TO MESSAGE TESTS
  // ============================================

  describe('handleReactToMessage', () => {
    describe('✅ Success Cases', () => {
      it('should add reaction successfully', async () => {
        const data: ReactToMessageData = { messageId: MESSAGE_ID, emoji: '👍' }
        const mockMessage = createMockMessage()
        mockMessageService.reactToMessage.mockResolvedValue({ action: 'added', reaction: { emoji: '👍' } } as any)
        mockMessageService.getMessageById.mockResolvedValue(mockMessage)

        await handler.handleReactToMessage(mockServer, mockClient, data)

        expect(mockMessageService.reactToMessage).toHaveBeenCalledWith(MESSAGE_ID, 1, '👍')
        expect(mockServer.to).toHaveBeenCalledWith(`conversation:${CONVERSATION_ID}`)
        expect(mockServer.emit).toHaveBeenCalledWith(
          'message_reaction_updated',
          expect.objectContaining({
            action: 'added',
            emoji: '👍',
          }),
        )
      })

      it('should toggle reaction (remove if exists)', async () => {
        const data: ReactToMessageData = { messageId: MESSAGE_ID, emoji: '❤️' }
        const mockMessage = createMockMessage()
        mockMessageService.reactToMessage.mockResolvedValue({ action: 'removed', emoji: '❤️' } as any)
        mockMessageService.getMessageById.mockResolvedValue(mockMessage)

        await handler.handleReactToMessage(mockServer, mockClient, data)

        expect(mockServer.emit).toHaveBeenCalledWith(
          'message_reaction_updated',
          expect.objectContaining({
            action: 'removed',
            reaction: null,
          }),
        )
      })

      it('should send confirmation to reactor', async () => {
        const data: ReactToMessageData = { messageId: MESSAGE_ID, emoji: '😂' }
        mockMessageService.reactToMessage.mockResolvedValue({ action: 'added', reaction: { emoji: '😂' } } as any)
        mockMessageService.getMessageById.mockResolvedValue(createMockMessage())

        await handler.handleReactToMessage(mockServer, mockClient, data)

        expect(mockClient.emit).toHaveBeenCalledWith('react_to_message_success', expect.any(Object))
      })
    })

    describe('❌ Error Cases', () => {
      it('should handle reaction errors', async () => {
        const data: ReactToMessageData = { messageId: MESSAGE_ID, emoji: '👍' }
        mockMessageService.reactToMessage.mockRejectedValue(new Error('Message not found'))

        await handler.handleReactToMessage(mockServer, mockClient, data)

        expect(mockClient.emit).toHaveBeenCalledWith(
          'error',
          expect.objectContaining({
            event: 'react_to_message',
          }),
        )
      })
    })
  })

  // ============================================
  // REMOVE REACTION TESTS
  // ============================================

  describe('handleRemoveReaction', () => {
    describe('✅ Success Cases', () => {
      it('should remove reaction successfully', async () => {
        const data: ReactToMessageData = { messageId: MESSAGE_ID, emoji: '👍' }
        const mockMessage = createMockMessage()
        mockMessageService.getMessageById.mockResolvedValue(mockMessage)

        await handler.handleRemoveReaction(mockServer, mockClient, data)

        expect(mockMessageService.removeReaction).toHaveBeenCalledWith(MESSAGE_ID, 1, '👍')
        expect(mockServer.to).toHaveBeenCalledWith(`conversation:${CONVERSATION_ID}`)
        expect(mockServer.emit).toHaveBeenCalledWith(
          'message_reaction_removed',
          expect.objectContaining({
            emoji: '👍',
          }),
        )
      })

      it('should send confirmation to user', async () => {
        const data: ReactToMessageData = { messageId: MESSAGE_ID, emoji: '❤️' }
        mockMessageService.getMessageById.mockResolvedValue(createMockMessage())

        await handler.handleRemoveReaction(mockServer, mockClient, data)

        expect(mockClient.emit).toHaveBeenCalledWith('remove_reaction_success', expect.any(Object))
      })
    })

    describe('❌ Error Cases', () => {
      it('should handle remove reaction errors', async () => {
        const data: ReactToMessageData = { messageId: MESSAGE_ID, emoji: '👍' }
        mockMessageService.removeReaction.mockRejectedValue(new Error('Reaction not found'))

        await handler.handleRemoveReaction(mockServer, mockClient, data)

        expect(mockClient.emit).toHaveBeenCalledWith(
          'error',
          expect.objectContaining({
            event: 'remove_reaction',
          }),
        )
      })
    })
  })

  // ============================================
  // NOTIFY ONLINE STATUS TESTS
  // ============================================

  describe('notifyUserOnlineStatus', () => {
    describe('✅ Success Cases', () => {
      it('should notify user online status with provided conversation IDs', async () => {
        const conversationIds = [CONVERSATION_ID, '550e8400-e29b-41d4-a716-446655440010']

        await handler.notifyUserOnlineStatus(mockServer, 1, true, conversationIds)

        expect(mockServer.to).toHaveBeenCalledWith(`conversation:${CONVERSATION_ID}`)
        expect(mockServer.to).toHaveBeenCalledWith('conversation:550e8400-e29b-41d4-a716-446655440010')
        expect(mockServer.emit).toHaveBeenCalledWith(
          'user_online',
          expect.objectContaining({
            userId: 1,
          }),
        )
      })

      it('should fetch user conversation IDs if not provided', async () => {
        mockConversationRepo.findUserConversationIds.mockResolvedValue([
          CONVERSATION_ID,
          '550e8400-e29b-41d4-a716-446655440010',
        ])

        await handler.notifyUserOnlineStatus(mockServer, 1, true)

        expect(mockConversationRepo.findUserConversationIds).toHaveBeenCalledWith(1)
        expect(mockServer.to).toHaveBeenCalledWith(`conversation:${CONVERSATION_ID}`)
      })

      it('should emit user_offline event when offline', async () => {
        await handler.notifyUserOnlineStatus(mockServer, 1, false, [CONVERSATION_ID])

        expect(mockServer.emit).toHaveBeenCalledWith(
          'user_offline',
          expect.objectContaining({
            userId: 1,
            lastSeen: expect.any(Date),
          }),
        )
      })

      it('should not include lastSeen when online', async () => {
        await handler.notifyUserOnlineStatus(mockServer, 1, true, [CONVERSATION_ID])

        expect(mockServer.emit).toHaveBeenCalledWith(
          'user_online',
          expect.not.objectContaining({
            lastSeen: expect.any(Date),
          }),
        )
      })
    })

    describe('❌ Error Cases', () => {
      it('should handle errors gracefully', async () => {
        mockConversationRepo.findUserConversationIds.mockRejectedValue(new Error('Database error'))

        await handler.notifyUserOnlineStatus(mockServer, 1, true)

        // Should not throw
        expect(mockConversationRepo.findUserConversationIds).toHaveBeenCalled()
      })
    })
  })

  // ============================================
  // BROADCAST SYSTEM MESSAGE TESTS
  // ============================================

  describe('broadcastSystemMessage', () => {
    describe('✅ Success Cases', () => {
      it('should persist and broadcast system message with valid sender', async () => {
        const mockMessage = createMockMessage({ type: 'SYSTEM' })
        mockMessageService.sendMessage.mockResolvedValue(mockMessage)

        const result = await handler.broadcastSystemMessage(mockServer, CONVERSATION_ID, 'User joined', 1)

        expect(mockMessageService.sendMessage).toHaveBeenCalledWith(1, {
          conversationId: CONVERSATION_ID,
          content: 'User joined',
          type: 'SYSTEM',
        })
        expect(mockServer.to).toHaveBeenCalledWith(`conversation:${CONVERSATION_ID}`)
        expect(mockServer.emit).toHaveBeenCalledWith(
          'new_message',
          expect.objectContaining({
            message: mockMessage,
          }),
        )
        expect(result).toEqual(mockMessage)
      })

      it('should emit directly without persisting when no sender', async () => {
        const result = await handler.broadcastSystemMessage(mockServer, CONVERSATION_ID, 'System notification')

        expect(mockMessageService.sendMessage).not.toHaveBeenCalled()
        expect(mockServer.to).toHaveBeenCalledWith(`conversation:${CONVERSATION_ID}`)
        expect(mockServer.emit).toHaveBeenCalledWith(
          'new_message',
          expect.objectContaining({
            message: expect.objectContaining({
              content: 'System notification',
              type: 'SYSTEM',
              conversationId: CONVERSATION_ID,
            }),
          }),
        )
        expect(result).toMatchObject({
          content: 'System notification',
          type: 'SYSTEM',
          conversationId: CONVERSATION_ID,
        })
      })

      it('should broadcast to conversation members', async () => {
        mockMessageService.sendMessage.mockResolvedValue(createMockMessage({ type: 'SYSTEM' }))

        await handler.broadcastSystemMessage(mockServer, '550e8400-e29b-41d4-a716-446655440456', 'Test message', 1)

        expect(mockServer.to).toHaveBeenCalledWith('conversation:550e8400-e29b-41d4-a716-446655440456')
        expect(mockServer.emit).toHaveBeenCalledWith('new_message', expect.any(Object))
      })
    })

    describe('❌ Error Cases', () => {
      it('should throw error when message creation fails', async () => {
        mockMessageService.sendMessage.mockRejectedValue(new Error('Database error'))

        await expect(handler.broadcastSystemMessage(mockServer, CONVERSATION_ID, 'Test', 1)).rejects.toThrow(
          'Database error',
        )
      })
    })
  })

  // ============================================
  // NOTIFY CONVERSATION UPDATE TESTS
  // ============================================

  describe('notifyConversationUpdate', () => {
    describe('✅ Success Cases', () => {
      it('should notify conversation update', () => {
        const updateData = { name: 'New Name', avatar: 'new-avatar.jpg' }

        handler.notifyConversationUpdate(mockServer, CONVERSATION_ID, 'name_changed', updateData)

        expect(mockServer.to).toHaveBeenCalledWith(`conversation:${CONVERSATION_ID}`)
        expect(mockServer.emit).toHaveBeenCalledWith(
          'conversation_updated',
          expect.objectContaining({
            conversationId: CONVERSATION_ID,
            type: 'name_changed',
            data: updateData,
            timestamp: expect.any(Date),
          }),
        )
      })

      it('should handle different update types', () => {
        const types = ['name_changed', 'avatar_updated', 'member_added', 'member_removed']

        types.forEach((type) => {
          handler.notifyConversationUpdate(mockServer, CONVERSATION_ID, type, {})

          expect(mockServer.emit).toHaveBeenCalledWith(
            'conversation_updated',
            expect.objectContaining({
              type,
            }),
          )
        })
      })

      it('should include timestamp in update', () => {
        handler.notifyConversationUpdate(mockServer, CONVERSATION_ID, 'updated', {})

        expect(mockServer.emit).toHaveBeenCalledWith(
          'conversation_updated',
          expect.objectContaining({
            timestamp: expect.any(Date),
          }),
        )
      })
    })
  })

  // ============================================
  // NOTIFY USER TESTS
  // ============================================

  describe('notifyUser', () => {
    describe('✅ Success Cases', () => {
      it('should send notification to specific user', () => {
        const notificationData = { title: 'New Message', body: 'You have a new message' }

        handler.notifyUser(mockServer, 1, 'notification', notificationData)

        expect(mockServer.to).toHaveBeenCalledWith('user:1')
        expect(mockServer.emit).toHaveBeenCalledWith(
          'notification',
          expect.objectContaining({
            title: 'New Message',
            body: 'You have a new message',
            timestamp: expect.any(Date),
          }),
        )
      })

      it('should handle different event types', () => {
        const events = ['notification', 'alert', 'update', 'reminder']

        events.forEach((event) => {
          handler.notifyUser(mockServer, 1, event, { message: 'Test' })

          expect(mockServer.emit).toHaveBeenCalledWith(event, expect.any(Object))
        })
      })

      it('should include timestamp automatically', () => {
        handler.notifyUser(mockServer, 1, 'test_event', { data: 'test' })

        expect(mockServer.emit).toHaveBeenCalledWith(
          'test_event',
          expect.objectContaining({
            timestamp: expect.any(Date),
          }),
        )
      })

      it('should target user personal room', () => {
        handler.notifyUser(mockServer, 42, 'notification', {})

        expect(mockServer.to).toHaveBeenCalledWith('user:42')
      })
    })
  })
})
