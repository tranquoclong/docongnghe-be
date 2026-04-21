import { Test, TestingModule } from '@nestjs/testing'
import { PrismaService } from 'src/shared/services/prisma.service'
import { HealthService } from '../health.service'

// Mock ioredis with proper implementation
const mockRedisInstance = {
  status: 'ready',
  ping: jest.fn().mockResolvedValue('PONG'),
  connect: jest.fn().mockResolvedValue(undefined),
  quit: jest.fn().mockResolvedValue(undefined),
  on: jest.fn().mockReturnThis(),
}

// Mock the entire ioredis module
jest.mock('ioredis', () => {
  return function () {
    return mockRedisInstance
  }
})

describe('HealthService', () => {
  let service: HealthService
  let prismaService: PrismaService

  const mockPrismaService = {
    $queryRaw: jest.fn(),
  }

  beforeEach(async () => {
    // Reset mocks before each test
    jest.clearAllMocks()
    mockRedisInstance.ping.mockResolvedValue('PONG')
    mockRedisInstance.status = 'ready'

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        HealthService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile()

    service = module.get<HealthService>(HealthService)
    prismaService = module.get<PrismaService>(PrismaService)
  })

  afterEach(async () => {
    if (service) {
      await service.onModuleDestroy()
    }
  })

  describe('checkDatabase', () => {
    it('should return status "up" when database is healthy', async () => {
      mockPrismaService.$queryRaw.mockResolvedValue([{ '?column?': 1 }])

      const result = await service.checkDatabase()

      expect(result.status).toBe('up')
      expect(result.responseTime).toBeGreaterThanOrEqual(0)
      expect(result.error).toBeUndefined()
      expect(mockPrismaService.$queryRaw).toHaveBeenCalledTimes(1)
    })

    it('should return status "down" when database query fails', async () => {
      const dbError = new Error('Connection timeout')
      mockPrismaService.$queryRaw.mockRejectedValue(dbError)

      const result = await service.checkDatabase()

      expect(result.status).toBe('down')
      expect(result.responseTime).toBeGreaterThanOrEqual(0)
      expect(result.error).toBe('Connection timeout')
    })

    it('should measure response time accurately', async () => {
      mockPrismaService.$queryRaw.mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve([{ '?column?': 1 }]), 50)),
      )

      const result = await service.checkDatabase()

      expect(result.status).toBe('up')
      expect(result.responseTime).toBeGreaterThanOrEqual(50)
      expect(result.responseTime).toBeLessThan(100)
    })
  })

  describe('checkRedis', () => {
    it('should return status "up" when Redis is healthy', async () => {
      const result = await service.checkRedis()

      expect(result.status).toBe('up')
      expect(result.responseTime).toBeGreaterThanOrEqual(0)
      expect(result.error).toBeUndefined()
    })

    it('should return status "down" when Redis ping fails', async () => {
      // Mock Redis to throw error for this test
      mockRedisInstance.ping.mockRejectedValueOnce(new Error('Redis connection failed'))

      const result = await service.checkRedis()

      expect(result.status).toBe('down')
      expect(result.error).toBe('Redis connection failed')
    })
  })

  describe('getHealthStatus', () => {
    it('should return status "ok" when all services are healthy', async () => {
      mockPrismaService.$queryRaw.mockResolvedValue([{ '?column?': 1 }])

      const result = await service.getHealthStatus()

      expect(result.status).toBe('ok')
      expect(result.timestamp).toBeDefined()
      expect(result.uptime).toBeGreaterThanOrEqual(0)
      expect(result.checks.database.status).toBe('up')
      expect(result.checks.redis.status).toBe('up')
    })

    it('should return status "error" when database is down', async () => {
      mockPrismaService.$queryRaw.mockRejectedValue(new Error('Database error'))

      const result = await service.getHealthStatus()

      expect(result.status).toBe('error')
      expect(result.checks.database.status).toBe('down')
      expect(result.checks.database.error).toBe('Database error')
    })

    it('should return status "error" when Redis is down', async () => {
      mockPrismaService.$queryRaw.mockResolvedValue([{ '?column?': 1 }])
      mockRedisInstance.ping.mockRejectedValueOnce(new Error('Redis error'))

      const result = await service.getHealthStatus()

      expect(result.status).toBe('error')
      expect(result.checks.redis.status).toBe('down')
    })

    it('should return status "error" when both services are down', async () => {
      mockPrismaService.$queryRaw.mockRejectedValue(new Error('Database error'))
      mockRedisInstance.ping.mockRejectedValueOnce(new Error('Redis error'))

      const result = await service.getHealthStatus()

      expect(result.status).toBe('error')
      expect(result.checks.database.status).toBe('down')
      expect(result.checks.redis.status).toBe('down')
    })

    it('should include timestamp in ISO format', async () => {
      mockPrismaService.$queryRaw.mockResolvedValue([{ '?column?': 1 }])

      const result = await service.getHealthStatus()

      expect(result.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/)
    })

    it('should include process uptime', async () => {
      mockPrismaService.$queryRaw.mockResolvedValue([{ '?column?': 1 }])

      const result = await service.getHealthStatus()

      expect(typeof result.uptime).toBe('number')
      expect(result.uptime).toBeGreaterThanOrEqual(0)
    })
  })

  describe('onModuleDestroy', () => {
    it('should close Redis connection on module destroy', async () => {
      const quitSpy = jest.spyOn(service['redis'], 'quit')

      await service.onModuleDestroy()

      expect(quitSpy).toHaveBeenCalled()
    })
  })
})
