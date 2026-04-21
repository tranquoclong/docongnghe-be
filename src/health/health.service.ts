import { Injectable, Logger } from '@nestjs/common'
import { PrismaService } from 'src/shared/services/prisma.service'
import Redis from 'ioredis'

export interface ServiceStatus {
  status: 'up' | 'down'
  responseTime?: number
  error?: string
}

export interface HealthCheckResponse {
  status: 'ok' | 'error'
  timestamp: string
  uptime: number
  checks: {
    database: ServiceStatus
    redis: ServiceStatus
  }
}

@Injectable()
export class HealthService {
  private readonly logger = new Logger(HealthService.name)
  private redis: Redis

  constructor(private readonly prisma: PrismaService) {
    // Create dedicated Redis connection for health checks
    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379'
    this.redis = new Redis(redisUrl, {
      maxRetriesPerRequest: 1,
      connectTimeout: 2000,
      lazyConnect: true,
    })

    this.redis.on('error', (err) => {
      this.logger.warn('Health check Redis connection error:', err.message)
    })
  }

  async checkDatabase(): Promise<ServiceStatus> {
    const startTime = Date.now()
    try {
      // Simple query to check database connectivity
      await this.prisma.$queryRaw`SELECT 1`
      const responseTime = Date.now() - startTime

      return {
        status: 'up',
        responseTime,
      }
    } catch (error) {
      const responseTime = Date.now() - startTime
      this.logger.error('Database health check failed:', error)

      return {
        status: 'down',
        responseTime,
        error: error instanceof Error ? error.message : 'Unknown error',
      }
    }
  }

  async checkRedis(): Promise<ServiceStatus> {
    const startTime = Date.now()
    try {
      // Ensure connection is established
      if (this.redis.status !== 'ready') {
        await this.redis.connect()
      }

      // Ping Redis with 1s timeout
      await this.redis.ping()
      const responseTime = Date.now() - startTime

      return {
        status: 'up',
        responseTime,
      }
    } catch (error) {
      const responseTime = Date.now() - startTime
      this.logger.error('Redis health check failed:', error)

      return {
        status: 'down',
        responseTime,
        error: error instanceof Error ? error.message : 'Unknown error',
      }
    }
  }

  async getHealthStatus(): Promise<HealthCheckResponse> {
    const [databaseStatus, redisStatus] = await Promise.all([this.checkDatabase(), this.checkRedis()])

    const allHealthy = databaseStatus.status === 'up' && redisStatus.status === 'up'

    return {
      status: allHealthy ? 'ok' : 'error',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      checks: {
        database: databaseStatus,
        redis: redisStatus,
      },
    }
  }

  async onModuleDestroy() {
    // Clean up Redis connection
    await this.redis.quit()
  }
}
