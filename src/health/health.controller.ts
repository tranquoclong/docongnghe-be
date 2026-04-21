import { Controller, Get, HttpStatus, Res } from '@nestjs/common'
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger'
import { Response } from 'express'
import { IsPublic } from 'src/shared/decorators/auth.decorator'
import { HealthService } from './health.service'

@ApiTags('Health')
@Controller('health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get()
  @IsPublic()
  @ApiOperation({
    summary: 'Health check endpoint',
    description: 'Returns the health status of the application and its dependencies (database, Redis)',
  })
  @ApiResponse({
    status: 200,
    description: 'All services are healthy',
    schema: {
      type: 'object',
      properties: {
        status: { type: 'string', example: 'ok' },
        timestamp: { type: 'string', example: '2026-03-11T10:00:00.000Z' },
        uptime: { type: 'number', example: 123.456 },
        checks: {
          type: 'object',
          properties: {
            database: {
              type: 'object',
              properties: {
                status: { type: 'string', example: 'up' },
                responseTime: { type: 'number', example: 5 },
              },
            },
            redis: {
              type: 'object',
              properties: {
                status: { type: 'string', example: 'up' },
                responseTime: { type: 'number', example: 2 },
              },
            },
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 503,
    description: 'One or more services are unhealthy',
    schema: {
      type: 'object',
      properties: {
        status: { type: 'string', example: 'error' },
        timestamp: { type: 'string', example: '2026-03-11T10:00:00.000Z' },
        uptime: { type: 'number', example: 123.456 },
        checks: {
          type: 'object',
          properties: {
            database: {
              type: 'object',
              properties: {
                status: { type: 'string', example: 'down' },
                responseTime: { type: 'number', example: 2000 },
                error: { type: 'string', example: 'Connection timeout' },
              },
            },
            redis: {
              type: 'object',
              properties: {
                status: { type: 'string', example: 'up' },
                responseTime: { type: 'number', example: 2 },
              },
            },
          },
        },
      },
    },
  })
  async check(@Res() res: Response) {
    const health = await this.healthService.getHealthStatus()

    const statusCode = health.status === 'ok' ? HttpStatus.OK : HttpStatus.SERVICE_UNAVAILABLE

    return res.status(statusCode).json(health)
  }
}
