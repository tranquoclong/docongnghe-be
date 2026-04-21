import { Test, TestingModule } from '@nestjs/testing'
import { INestApplication } from '@nestjs/common'
import request from 'supertest'
import { AppController } from 'src/app.controller'
import { AppService } from 'src/app.service'

describe('Simple Supertest Fix Verification', () => {
  let app: INestApplication

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [AppService],
    }).compile()

    app = moduleFixture.createNestApplication()
    await app.init()
  })

  afterAll(async () => {
    await app.close()
  })

  it('should verify supertest import fix works', () => {
    console.log('✅ Supertest import fix successful!')
    expect(typeof request).toBe('function')
    console.log('✅ Default import syntax works correctly')
  })

  it('should make HTTP request successfully', async () => {
    const response = await request(app.getHttpServer()).get('/').expect(200)
    expect(response.text).toBe('Hello World!')
    console.log('✅ Supertest HTTP requests work correctly!')
  })

  it('should handle 404 for non-existent routes', async () => {
    const response = await request(app.getHttpServer()).get('/non-existent-route').expect(404)
    expect(response.body).toEqual(
      expect.objectContaining({
        statusCode: 404,
        message: 'Cannot GET /non-existent-route',
      }),
    )
    console.log('✅ Supertest error handling works correctly!')
  })
})
