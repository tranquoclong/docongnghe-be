import { Test, TestingModule } from '@nestjs/testing'
import { Socket } from 'socket.io'
import { SharedUserRepository } from 'src/shared/repositories/shared-user.repo'
import { ChatRedisService } from '../../services/chat-redis.service'
import { ChatConnectionHandler } from '../chat-connection.handler'
import { AuthenticatedSocket } from '../../websocket.interfaces'

/**
 * CHAT CONNECTION HANDLER UNIT TESTS
 *
 * Test coverage cho connection lifecycle của WebSocket
 * NOTE: Authentication is handled by WebsocketAdapter middleware
 * This handler reads userId from socket.data (set by adapter)
 * - User data enrichment & validation
 * - User tracking trong Redis
 * - Connection/disconnection events
 */

describe('ChatConnectionHandler', () => {
  let handler: ChatConnectionHandler
  let mockUserRepo: jest.Mocked<SharedUserRepository>
  let mockRedisService: jest.Mocked<ChatRedisService>

  // Mock socket factory
  const createMockSocket = (overrides = {}): Socket =>
    ({
      id: 'socket-123',
      data: { userId: 1 },
      handshake: {
        auth: { authorization: 'Bearer valid-token' },
        headers: {},
      },
      emit: jest.fn(),
      join: jest.fn(),
      disconnect: jest.fn(),
      ...overrides,
    }) as any

  const createMockUser = (overrides = {}) => ({
    id: 1,
    name: 'Test User',
    email: 'test@example.com',
    password: 'hashed_password',
    phoneNumber: '1234567890',
    avatar: 'avatar.jpg',
    totpSecret: null,
    status: 'ACTIVE' as const,
    roleId: 1,
    createdAt: '2024-01-01',
    updatedAt: '2024-01-01',
    emailVerifiedAt: '2024-01-01',
    phoneVerifiedAt: null,
    lastLoginAt: null,
    deletedAt: null,
    createdById: null,
    updatedById: null,
    deletedById: null,
    ...overrides,
  })

  beforeEach(async () => {
    mockUserRepo = {
      findUnique: jest.fn(),
    } as any

    mockRedisService = {
      addOnlineUser: jest.fn(),
      setSocketUser: jest.fn(),
      removeOnlineUser: jest.fn(),
      removeUserFromAllTyping: jest.fn(),
      removeSocket: jest.fn(),
    } as any

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ChatConnectionHandler,
        { provide: SharedUserRepository, useValue: mockUserRepo },
        { provide: ChatRedisService, useValue: mockRedisService },
      ],
    }).compile()

    handler = module.get<ChatConnectionHandler>(ChatConnectionHandler)
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  // ============================================
  // HANDLE CONNECTION TESTS
  // ============================================

  describe('handleConnection', () => {
    describe('✅ Success Cases', () => {
      it('should authenticate user and setup connection successfully', async () => {
        const mockSocket = createMockSocket()
        const mockUser = createMockUser()

        mockUserRepo.findUnique.mockResolvedValue(mockUser as any)

        const result = await handler.handleConnection(mockSocket)

        expect(result).toBeDefined()
        expect(result?.userId).toBe(1)
        expect(result?.user).toEqual({
          id: 1,
          name: 'Test User',
          email: 'test@example.com',
          avatar: 'avatar.jpg',
          status: 'ACTIVE',
        })
        expect(mockRedisService.addOnlineUser).toHaveBeenCalledWith(1, 'socket-123')
        expect(mockRedisService.setSocketUser).toHaveBeenCalledWith('socket-123', expect.any(Object))
        expect(mockSocket.emit).toHaveBeenCalledWith(
          'connected',
          expect.objectContaining({
            userId: 1,
            message: 'Successfully connected to chat server',
          }),
        )
      })

      it('should read userId from socket data (set by adapter middleware)', async () => {
        const mockSocket = createMockSocket({
          data: { userId: 5 },
        })
        const mockUser = createMockUser({ id: 5 })
        mockUserRepo.findUnique.mockResolvedValue(mockUser as any)

        const result = await handler.handleConnection(mockSocket)

        expect(result?.userId).toBe(5)
        expect(mockUserRepo.findUnique).toHaveBeenCalledWith({ id: 5 })
      })

      it('should reject connection when socket data has no userId', async () => {
        const mockSocket = createMockSocket({
          data: {},
        })

        const result = await handler.handleConnection(mockSocket)

        expect(result).toBeNull()
        expect(mockSocket.emit).toHaveBeenCalledWith(
          'error',
          expect.objectContaining({
            event: 'connection',
            code: 'INTERNAL_ERROR',
          }),
        )
        expect(mockSocket.disconnect).toHaveBeenCalled()
      })

      it('should handle user without avatar', async () => {
        const mockSocket = createMockSocket()
        const mockUser = createMockUser({ avatar: null })

        mockUserRepo.findUnique.mockResolvedValue(mockUser as any)

        const result = await handler.handleConnection(mockSocket)

        expect(result?.user.avatar).toBeUndefined()
      })

      it('should attach user info to socket correctly', async () => {
        const mockSocket = createMockSocket()
        const mockUser = createMockUser()

        mockUserRepo.findUnique.mockResolvedValue(mockUser as any)

        const result = await handler.handleConnection(mockSocket)

        expect(result).toHaveProperty('userId', 1)
        expect(result).toHaveProperty('user')
        expect(result?.user).toMatchObject({
          id: 1,
          name: 'Test User',
          email: 'test@example.com',
        })
      })
    })

    describe('❌ Error Cases', () => {
      it('should reject connection when no userId in socket data', async () => {
        const mockSocket = createMockSocket({
          data: {},
        })

        const result = await handler.handleConnection(mockSocket)

        expect(result).toBeNull()
        expect(mockSocket.emit).toHaveBeenCalledWith(
          'error',
          expect.objectContaining({
            event: 'connection',
            code: 'INTERNAL_ERROR',
          }),
        )
        expect(mockSocket.disconnect).toHaveBeenCalled()
      })

      it('should reject connection when database lookup fails', async () => {
        const mockSocket = createMockSocket()
        mockUserRepo.findUnique.mockRejectedValue(new Error('Database error'))

        const result = await handler.handleConnection(mockSocket)

        expect(result).toBeNull()
        expect(mockSocket.disconnect).toHaveBeenCalled()
      })

      it('should reject connection when user not found', async () => {
        const mockSocket = createMockSocket({ data: { userId: 999 } })
        mockUserRepo.findUnique.mockResolvedValue(null)

        const result = await handler.handleConnection(mockSocket)

        expect(result).toBeNull()
        expect(mockSocket.disconnect).toHaveBeenCalled()
      })

      it('should reject connection when user is inactive', async () => {
        const mockSocket = createMockSocket()
        const mockUser = createMockUser({ status: 'INACTIVE' })

        mockUserRepo.findUnique.mockResolvedValue(mockUser as any)

        const result = await handler.handleConnection(mockSocket)

        expect(result).toBeNull()
        expect(mockSocket.disconnect).toHaveBeenCalled()
      })

      it('should reject connection when user is blocked', async () => {
        const mockSocket = createMockSocket()
        const mockUser = createMockUser({ status: 'BLOCKED' })

        mockUserRepo.findUnique.mockResolvedValue(mockUser as any)

        const result = await handler.handleConnection(mockSocket)

        expect(result).toBeNull()
        expect(mockSocket.disconnect).toHaveBeenCalled()
      })

      it('should handle errors gracefully and emit error event', async () => {
        const mockSocket = createMockSocket()
        mockUserRepo.findUnique.mockRejectedValue(new Error('Unexpected error'))

        const result = await handler.handleConnection(mockSocket)

        expect(result).toBeNull()
        expect(mockSocket.emit).toHaveBeenCalledWith(
          'error',
          expect.objectContaining({
            event: 'connection',
            code: 'INTERNAL_ERROR',
          }),
        )
      })
    })
  })

  // ============================================
  // HANDLE DISCONNECT TESTS
  // ============================================

  describe('handleDisconnect', () => {
    describe('✅ Success Cases', () => {
      it('should cleanup user data when disconnecting', async () => {
        const mockSocket = createMockSocket({ userId: 1 }) as AuthenticatedSocket
        mockRedisService.removeOnlineUser.mockResolvedValue(true)

        const result = await handler.handleDisconnect(mockSocket)

        expect(result).toBe(true)
        expect(mockRedisService.removeOnlineUser).toHaveBeenCalledWith(1, 'socket-123')
        expect(mockRedisService.removeUserFromAllTyping).toHaveBeenCalledWith(1)
        expect(mockRedisService.removeSocket).toHaveBeenCalledWith('socket-123')
      })

      it('should return true when user goes completely offline', async () => {
        const mockSocket = createMockSocket({ userId: 1 }) as AuthenticatedSocket
        mockRedisService.removeOnlineUser.mockResolvedValue(true)

        const result = await handler.handleDisconnect(mockSocket)

        expect(result).toBe(true)
      })

      it('should return false when user still has other connections', async () => {
        const mockSocket = createMockSocket({ userId: 1 }) as AuthenticatedSocket
        mockRedisService.removeOnlineUser.mockResolvedValue(false)

        const result = await handler.handleDisconnect(mockSocket)

        expect(result).toBe(false)
      })

      it('should cleanup typing indicators on disconnect', async () => {
        const mockSocket = createMockSocket({ userId: 1 }) as AuthenticatedSocket
        mockRedisService.removeOnlineUser.mockResolvedValue(true)

        await handler.handleDisconnect(mockSocket)

        expect(mockRedisService.removeUserFromAllTyping).toHaveBeenCalledWith(1)
      })
    })

    describe('❌ Error Cases', () => {
      it('should return false when socket has no userId', async () => {
        const mockSocket = createMockSocket() as AuthenticatedSocket

        const result = await handler.handleDisconnect(mockSocket)

        expect(result).toBe(false)
        expect(mockRedisService.removeOnlineUser).not.toHaveBeenCalled()
      })

      it('should handle Redis errors gracefully', async () => {
        const mockSocket = createMockSocket({ userId: 1 }) as AuthenticatedSocket
        mockRedisService.removeOnlineUser.mockRejectedValue(new Error('Redis error'))

        const result = await handler.handleDisconnect(mockSocket)

        expect(result).toBe(false)
      })
    })
  })
})
