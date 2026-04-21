import { CACHE_MANAGER } from '@nestjs/cache-manager'
import { INestApplication } from '@nestjs/common'
import { Test, TestingModule } from '@nestjs/testing'
import request from 'supertest'
import { AppModule } from '../../src/app.module'
import { HashingService } from '../../src/shared/services/hashing.service'
import { PrismaService } from '../../src/shared/services/prisma.service'
import { TokenService } from '../../src/shared/services/token.service'
import { createTestUser, resetDatabase } from '../helpers/test-helpers'

describe('Language Integration Tests', () => {
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

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue(global.__GLOBAL_PRISMA__)
      .overrideProvider(CACHE_MANAGER)
      .useValue(mockCacheManager)
      .compile()

    app = moduleFixture.createNestApplication()
    prisma = moduleFixture.get<PrismaService>(PrismaService)
    hashingService = moduleFixture.get<HashingService>(HashingService)
    tokenService = moduleFixture.get<TokenService>(TokenService)

    await app.init()
  })

  beforeEach(async () => {
    await resetDatabase()
    const adminResult = await createTestUser('admin@test.com', 'Admin@123', 1, prisma, hashingService, tokenService)
    adminUserId = adminResult.userId
    adminAccessToken = adminResult.accessToken
  })

  afterAll(async () => {
    await app.close()
  })

  describe('GET /languages - List languages', () => {
    it('should return empty list when no languages exist', async () => {
      const response = await request(app.getHttpServer())
        .get('/languages')
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .expect(200)

      expect(response.body).toMatchObject({
        data: [],
        totalItems: 0,
      })
    })

    it('should return list of languages after creating some', async () => {
      await prisma.language.createMany({
        data: [
          { id: 'en', name: 'English', createdById: adminUserId },
          { id: 'vi', name: 'Vietnamese', createdById: adminUserId },
        ],
      })

      const response = await request(app.getHttpServer())
        .get('/languages')
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .expect(200)

      expect(response.body).toMatchObject({
        data: expect.arrayContaining([
          expect.objectContaining({ id: 'en', name: 'English' }),
          expect.objectContaining({ id: 'vi', name: 'Vietnamese' }),
        ]),
        totalItems: 2,
      })
    })
  })

  describe('POST /languages - Create language', () => {
    it('should create a language successfully (admin)', async () => {
      const languageData = { id: 'en', name: 'English' }

      const response = await request(app.getHttpServer())
        .post('/languages')
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .send(languageData)
        .expect(201)

      expect(response.body).toMatchObject({
        id: 'en',
        name: 'English',
        createdById: adminUserId,
      })

      const languageInDb = await prisma.language.findUnique({ where: { id: 'en' } })
      expect(languageInDb).toBeDefined()
      expect(languageInDb?.name).toBe('English')
    })

    it('should return 422 when creating duplicate language id', async () => {
      await prisma.language.create({
        data: { id: 'en', name: 'English', createdById: adminUserId },
      })

      const languageData = { id: 'en', name: 'English Duplicate' }

      await request(app.getHttpServer())
        .post('/languages')
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .send(languageData)
        .expect(422)
    })

    it('should return 401 without auth token', async () => {
      const languageData = { id: 'en', name: 'English' }
      await request(app.getHttpServer()).post('/languages').send(languageData).expect(401)
    })
  })

  describe('GET /languages/:languageId - Get language detail', () => {
    it('should return language detail', async () => {
      await prisma.language.create({
        data: { id: 'en', name: 'English', createdById: adminUserId },
      })

      const response = await request(app.getHttpServer())
        .get('/languages/en')
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .expect(200)

      expect(response.body).toMatchObject({ id: 'en', name: 'English' })
    })

    it('should return 404 for non-existent language', async () => {
      await request(app.getHttpServer())
        .get('/languages/xx')
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .expect(404)
    })
  })

  describe('PUT /languages/:languageId - Update language', () => {
    it('should update language name', async () => {
      await prisma.language.create({
        data: { id: 'en', name: 'English', createdById: adminUserId },
      })

      const response = await request(app.getHttpServer())
        .put('/languages/en')
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .send({ name: 'English Updated' })
        .expect(200)

      expect(response.body).toMatchObject({
        id: 'en',
        name: 'English Updated',
        updatedById: adminUserId,
      })

      const updatedLanguage = await prisma.language.findUnique({ where: { id: 'en' } })
      expect(updatedLanguage?.name).toBe('English Updated')
    })

    it('should return 404 for non-existent language', async () => {
      await request(app.getHttpServer())
        .put('/languages/xx')
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .send({ name: 'Updated Name' })
        .expect(404)
    })
  })

  describe('DELETE /languages/:languageId - Delete language', () => {
    it('should delete language (hard delete)', async () => {
      await prisma.language.create({
        data: { id: 'en', name: 'English', createdById: adminUserId },
      })

      const response = await request(app.getHttpServer())
        .delete('/languages/en')
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .expect(200)

      expect(response.body).toMatchObject({ message: 'Delete successfully' })

      const deletedLanguage = await prisma.language.findUnique({ where: { id: 'en' } })
      expect(deletedLanguage).toBeNull()
    })

    it('should return 404 for non-existent language', async () => {
      await request(app.getHttpServer())
        .delete('/languages/xx')
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .expect(404)
    })
  })
})
