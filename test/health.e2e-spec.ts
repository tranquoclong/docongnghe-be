import { INestApplication } from '@nestjs/common'
import { Test, TestingModule } from '@nestjs/testing'
import request from 'supertest'
import { App } from 'supertest/types'
import { AppModule } from '../src/app.module'

describe('Health Endpoint (e2e)', () => {
  let app: INestApplication<App>

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile()

    app = moduleFixture.createNestApplication()
    await app.init()
  })

  afterAll(async () => {
    await app.close()
  })

  describe('GET /health', () => {
    it('should return 200 with health status when all services are healthy', async () => {
      const response = await request(app.getHttpServer()).get('/health').expect(200)

      expect(response.body).toHaveProperty('status')
      expect(response.body).toHaveProperty('timestamp')
      expect(response.body).toHaveProperty('uptime')
      expect(response.body).toHaveProperty('checks')
      expect(response.body.checks).toHaveProperty('database')
      expect(response.body.checks).toHaveProperty('redis')
    })

    it('should return status "ok" when all services are up', async () => {
      const response = await request(app.getHttpServer()).get('/health').expect(200)

      expect(response.body.status).toBe('ok')
      expect(response.body.checks.database.status).toBe('up')
      expect(response.body.checks.redis.status).toBe('up')
    })

    it('should include response times for each service', async () => {
      const response = await request(app.getHttpServer()).get('/health').expect(200)

      expect(response.body.checks.database).toHaveProperty('responseTime')
      expect(response.body.checks.redis).toHaveProperty('responseTime')
      expect(typeof response.body.checks.database.responseTime).toBe('number')
      expect(typeof response.body.checks.redis.responseTime).toBe('number')
    })

    it('should include timestamp in ISO format', async () => {
      const response = await request(app.getHttpServer()).get('/health').expect(200)

      expect(response.body.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/)
    })

    it('should include process uptime', async () => {
      const response = await request(app.getHttpServer()).get('/health').expect(200)

      expect(typeof response.body.uptime).toBe('number')
      expect(response.body.uptime).toBeGreaterThanOrEqual(0)
    })

    it('should be accessible without authentication', async () => {
      // No Authorization header provided
      const response = await request(app.getHttpServer()).get('/health').expect(200)

      expect(response.body.status).toBeDefined()
    })

    it('should return JSON content type', async () => {
      const response = await request(app.getHttpServer()).get('/health').expect(200)

      expect(response.headers['content-type']).toMatch(/application\/json/)
    })

    it('should complete within 3 seconds', async () => {
      const startTime = Date.now()

      await request(app.getHttpServer()).get('/health').expect(200)

      const duration = Date.now() - startTime
      expect(duration).toBeLessThan(3000)
    })

    it('should handle multiple concurrent requests', async () => {
      const requests = Array.from({ length: 10 }, () => request(app.getHttpServer()).get('/health'))

      const responses = await Promise.all(requests)

      responses.forEach((response) => {
        expect(response.status).toBe(200)
        expect(response.body.status).toBeDefined()
      })
    })
  })
})
