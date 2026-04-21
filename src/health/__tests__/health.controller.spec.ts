import { HttpStatus } from '@nestjs/common'
import { Test, TestingModule } from '@nestjs/testing'
import { Response } from 'express'
import { HealthController } from '../health.controller'
import { HealthService } from '../health.service'

describe('HealthController', () => {
  let controller: HealthController
  let healthService: HealthService

  const mockHealthService = {
    getHealthStatus: jest.fn(),
  }

  const mockResponse = () => {
    const res: Partial<Response> = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    }
    return res as Response
  }

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        {
          provide: HealthService,
          useValue: mockHealthService,
        },
      ],
    }).compile()

    controller = module.get<HealthController>(HealthController)
    healthService = module.get<HealthService>(HealthService)

    jest.clearAllMocks()
  })

  describe('check', () => {
    it('should return 200 when all services are healthy', async () => {
      const healthyResponse = {
        status: 'ok' as const,
        timestamp: '2026-03-11T10:00:00.000Z',
        uptime: 123.456,
        checks: {
          database: { status: 'up' as const, responseTime: 5 },
          redis: { status: 'up' as const, responseTime: 2 },
        },
      }

      mockHealthService.getHealthStatus.mockResolvedValue(healthyResponse)

      const res = mockResponse()
      await controller.check(res)

      expect(healthService.getHealthStatus).toHaveBeenCalledTimes(1)
      expect(res.status).toHaveBeenCalledWith(HttpStatus.OK)
      expect(res.json).toHaveBeenCalledWith(healthyResponse)
    })

    it('should return 503 when database is down', async () => {
      const unhealthyResponse = {
        status: 'error' as const,
        timestamp: '2026-03-11T10:00:00.000Z',
        uptime: 123.456,
        checks: {
          database: { status: 'down' as const, responseTime: 2000, error: 'Connection timeout' },
          redis: { status: 'up' as const, responseTime: 2 },
        },
      }

      mockHealthService.getHealthStatus.mockResolvedValue(unhealthyResponse)

      const res = mockResponse()
      await controller.check(res)

      expect(healthService.getHealthStatus).toHaveBeenCalledTimes(1)
      expect(res.status).toHaveBeenCalledWith(HttpStatus.SERVICE_UNAVAILABLE)
      expect(res.json).toHaveBeenCalledWith(unhealthyResponse)
    })

    it('should return 503 when Redis is down', async () => {
      const unhealthyResponse = {
        status: 'error' as const,
        timestamp: '2026-03-11T10:00:00.000Z',
        uptime: 123.456,
        checks: {
          database: { status: 'up' as const, responseTime: 5 },
          redis: { status: 'down' as const, responseTime: 1000, error: 'Redis connection failed' },
        },
      }

      mockHealthService.getHealthStatus.mockResolvedValue(unhealthyResponse)

      const res = mockResponse()
      await controller.check(res)

      expect(healthService.getHealthStatus).toHaveBeenCalledTimes(1)
      expect(res.status).toHaveBeenCalledWith(HttpStatus.SERVICE_UNAVAILABLE)
      expect(res.json).toHaveBeenCalledWith(unhealthyResponse)
    })

    it('should return 503 when all services are down', async () => {
      const unhealthyResponse = {
        status: 'error' as const,
        timestamp: '2026-03-11T10:00:00.000Z',
        uptime: 123.456,
        checks: {
          database: { status: 'down' as const, responseTime: 2000, error: 'Database error' },
          redis: { status: 'down' as const, responseTime: 1000, error: 'Redis error' },
        },
      }

      mockHealthService.getHealthStatus.mockResolvedValue(unhealthyResponse)

      const res = mockResponse()
      await controller.check(res)

      expect(healthService.getHealthStatus).toHaveBeenCalledTimes(1)
      expect(res.status).toHaveBeenCalledWith(HttpStatus.SERVICE_UNAVAILABLE)
      expect(res.json).toHaveBeenCalledWith(unhealthyResponse)
    })

    it('should include all health check details in response', async () => {
      const healthResponse = {
        status: 'ok' as const,
        timestamp: '2026-03-11T10:00:00.000Z',
        uptime: 123.456,
        checks: {
          database: { status: 'up' as const, responseTime: 5 },
          redis: { status: 'up' as const, responseTime: 2 },
        },
      }

      mockHealthService.getHealthStatus.mockResolvedValue(healthResponse)

      const res = mockResponse()
      await controller.check(res)

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          status: expect.any(String),
          timestamp: expect.any(String),
          uptime: expect.any(Number),
          checks: expect.objectContaining({
            database: expect.any(Object),
            redis: expect.any(Object),
          }),
        }),
      )
    })
  })
})
