import { Test, TestingModule } from '@nestjs/testing'
import { SharedWebsocketRepository } from 'src/shared/repositories/shared-websocket.repo'
import { PrismaService } from 'src/shared/services/prisma.service'

describe('SharedWebsocketRepository', () => {
  let repository: SharedWebsocketRepository

  // Mock PrismaService
  const mockPrismaService = {
    websocket: {
      findMany: jest.fn(),
      create: jest.fn(),
      delete: jest.fn(),
    },
  }

  const createTestData = {
    websocket: (overrides = {}) => ({
      id: 'socket-123',
      userId: 1,
      createdAt: '2024-01-01T00:00:00.000Z',
      ...overrides,
    }),
  }

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SharedWebsocketRepository,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile()

    repository = module.get<SharedWebsocketRepository>(SharedWebsocketRepository)

    // Reset mocks
    jest.clearAllMocks()
  })

  describe('findMany', () => {
    it('should find all websockets for a user', async () => {
      const mockWebsockets = [
        createTestData.websocket({ id: 'socket-1', userId: 1 }),
        createTestData.websocket({ id: 'socket-2', userId: 1 }),
      ]
      mockPrismaService.websocket.findMany.mockResolvedValue(mockWebsockets)

      const result = await repository.findMany(1)

      expect(result).toEqual(mockWebsockets)
      expect(mockPrismaService.websocket.findMany).toHaveBeenCalledWith({
        where: { userId: 1 },
      })
    })

    it('should return empty array when user has no websockets', async () => {
      mockPrismaService.websocket.findMany.mockResolvedValue([])

      const result = await repository.findMany(999)

      expect(result).toEqual([])
      expect(mockPrismaService.websocket.findMany).toHaveBeenCalledWith({
        where: { userId: 999 },
      })
    })
  })

  describe('create', () => {
    it('should create a new websocket connection', async () => {
      const mockWebsocket = createTestData.websocket()
      mockPrismaService.websocket.create.mockResolvedValue(mockWebsocket)

      const result = await repository.create({ id: 'socket-123', userId: 1 })

      expect(result).toEqual(mockWebsocket)
      expect(mockPrismaService.websocket.create).toHaveBeenCalledWith({
        data: {
          id: 'socket-123',
          userId: 1,
        },
      })
    })
  })

  describe('delete', () => {
    it('should delete a websocket connection', async () => {
      const mockWebsocket = createTestData.websocket()
      mockPrismaService.websocket.delete.mockResolvedValue(mockWebsocket)

      const result = await repository.delete('socket-123')

      expect(result).toEqual(mockWebsocket)
      expect(mockPrismaService.websocket.delete).toHaveBeenCalledWith({
        where: { id: 'socket-123' },
      })
    })
  })
})
