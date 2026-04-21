import { CACHE_MANAGER } from '@nestjs/cache-manager'
import { INestApplication } from '@nestjs/common'
import { Test, TestingModule } from '@nestjs/testing'
import request from 'supertest'
import { AppModule } from '../../src/app.module'
import { HashingService } from '../../src/shared/services/hashing.service'
import { PrismaService } from '../../src/shared/services/prisma.service'
import { S3Service } from '../../src/shared/services/s3.service'
import { TokenService } from '../../src/shared/services/token.service'
import { createTestUser, resetDatabase } from '../helpers/test-helpers'

describe('Media Integration Tests', () => {
  let app: INestApplication
  let prisma: PrismaService
  let hashingService: HashingService
  let tokenService: TokenService
  let adminAccessToken: string
  let adminUserId: number

  const mockCacheManager = {
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue(undefined),
    del: jest.fn().mockResolvedValue(undefined),
  }

  const mockS3Service = {
    uploadedFile: jest.fn().mockResolvedValue({
      Location: 'https://s3.example.com/images/test.jpg',
    }),
    createPresignedUrlWithClient: jest
      .fn()
      .mockResolvedValue('https://s3.example.com/images/random-name.jpg?signature=abc'),
  }

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue(global.__GLOBAL_PRISMA__)
      .overrideProvider(CACHE_MANAGER)
      .useValue(mockCacheManager)
      .overrideProvider(S3Service)
      .useValue(mockS3Service)
      .compile()

    app = moduleFixture.createNestApplication()
    prisma = moduleFixture.get<PrismaService>(PrismaService)
    hashingService = moduleFixture.get<HashingService>(HashingService)
    tokenService = moduleFixture.get<TokenService>(TokenService)

    await app.init()
  })

  beforeEach(async () => {
    await resetDatabase()
    jest.clearAllMocks()

    const adminResult = await createTestUser('admin@test.com', 'Admin@123', 1, prisma, hashingService, tokenService)
    adminUserId = adminResult.userId
    adminAccessToken = adminResult.accessToken
  })

  afterAll(async () => {
    await app.close()
  })

  describe('POST /media/images/upload - Upload files', () => {
    it('should return 401 without auth token', async () => {
      await request(app.getHttpServer())
        .post('/media/images/upload')
        .attach('files', Buffer.from('fake image content'), 'test.jpg')
        .expect(401)
    })

    it('should reject files with invalid type (e.g., .txt)', async () => {
      await request(app.getHttpServer())
        .post('/media/images/upload')
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .attach('files', Buffer.from('text content'), 'test.txt')
        .expect(400)
    })
  })

  describe('GET /media/static/:filename - Serve static file', () => {
    it('should return 404 for non-existent file', async () => {
      const response = await request(app.getHttpServer()).get('/media/static/non-existent-file.jpg').expect(404)

      expect(response.body).toMatchObject({
        statusCode: 404,
        message: 'File not found',
      })
    })

    it('should be accessible without authentication (public endpoint)', async () => {
      const response = await request(app.getHttpServer()).get('/media/static/any-file.jpg')

      // Should return 404 (file not found) not 401 (unauthorized)
      expect(response.status).toBe(404)
    })
  })

  describe('POST /media/images/upload/presigned-url - Get presigned URL', () => {
    it('should return presigned URL successfully', async () => {
      const response = await request(app.getHttpServer())
        .post('/media/images/upload/presigned-url')
        .send({ filename: 'test-image.jpg', filesize: 500000 })
        .expect(201)

      expect(response.body).toMatchObject({
        presignedUrl: expect.any(String),
        url: expect.any(String),
      })
      expect(response.body.presignedUrl).toContain('https://s3.example.com')
      expect(response.body.url).toContain('https://s3.example.com')
    })

    it('should work without auth (it is public)', async () => {
      const response = await request(app.getHttpServer())
        .post('/media/images/upload/presigned-url')
        .send({ filename: 'another-image.png', filesize: 300000 })

      // Should return 201 (success) not 401 (unauthorized)
      expect(response.status).toBe(201)
      expect(response.body).toHaveProperty('presignedUrl')
      expect(response.body).toHaveProperty('url')
    })

    it('should call S3Service.createPresignedUrlWithClient', async () => {
      await request(app.getHttpServer())
        .post('/media/images/upload/presigned-url')
        .send({ filename: 'test-image.jpg', filesize: 500000 })
        .expect(201)

      expect(mockS3Service.createPresignedUrlWithClient).toHaveBeenCalled()
    })

    it('should return 422 when filename is missing', async () => {
      await request(app.getHttpServer())
        .post('/media/images/upload/presigned-url')
        .send({ filesize: 500000 })
        .expect(422)
    })

    it('should return 422 when filesize exceeds 1MB', async () => {
      await request(app.getHttpServer())
        .post('/media/images/upload/presigned-url')
        .send({ filename: 'large-image.jpg', filesize: 2 * 1024 * 1024 })
        .expect(422)
    })
  })
})
