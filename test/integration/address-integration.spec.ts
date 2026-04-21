import { CACHE_MANAGER } from '@nestjs/cache-manager'
import { INestApplication } from '@nestjs/common'
import { Test, TestingModule } from '@nestjs/testing'
import request from 'supertest'
import { AppModule } from '../../src/app.module'
import { HashingService } from '../../src/shared/services/hashing.service'
import { PrismaService } from '../../src/shared/services/prisma.service'
import { TokenService } from '../../src/shared/services/token.service'
import { createTestUser, resetDatabase } from '../helpers/test-helpers'

describe('Address Integration Tests', () => {
  let app: INestApplication
  let prisma: PrismaService
  let hashingService: HashingService
  let tokenService: TokenService
  let adminAccessToken: string
  let adminUserId: number
  let clientAccessToken: string
  let clientUserId: number

  const mockCacheManager = {
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue(undefined),
    del: jest.fn().mockResolvedValue(undefined),
  }

  const validAddress = {
    name: 'Nguyen Van A',
    phone: '0912345678',
    provinceId: '01',
    provinceName: 'Ha Noi',
    districtId: '001',
    districtName: 'Ba Dinh',
    wardId: '00001',
    wardName: 'Phuc Xa',
    detail: '123 Hoang Hoa Tham',
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

    const clientResult = await createTestUser('client@test.com', 'Client@123', 2, prisma, hashingService, tokenService)
    clientUserId = clientResult.userId
    clientAccessToken = clientResult.accessToken
  })

  afterAll(async () => {
    await app.close()
  })

  describe('POST /addresses - Create address', () => {
    it('should create first address as default automatically', async () => {
      const response = await request(app.getHttpServer())
        .post('/addresses')
        .set('Authorization', `Bearer ${clientAccessToken}`)
        .send(validAddress)
        .expect(201)

      expect(response.body.data).toMatchObject({
        id: expect.any(Number),
        name: validAddress.name,
        phone: validAddress.phone,
        isDefault: true,
      })

      const addressInDb = await prisma.address.findUnique({
        where: { id: response.body.data.id },
      })
      expect(addressInDb?.isDefault).toBe(true)
    })

    it('should create non-default address when one already exists', async () => {
      await request(app.getHttpServer())
        .post('/addresses')
        .set('Authorization', `Bearer ${clientAccessToken}`)
        .send(validAddress)
        .expect(201)

      const secondAddress = { ...validAddress, name: 'Nguyen Van B', detail: '456 Kim Ma' }
      const response = await request(app.getHttpServer())
        .post('/addresses')
        .set('Authorization', `Bearer ${clientAccessToken}`)
        .send(secondAddress)
        .expect(201)

      expect(response.body.data.isDefault).toBe(false)
    })

    it('should return 401 without auth', async () => {
      await request(app.getHttpServer()).post('/addresses').send(validAddress).expect(401)
    })
  })

  describe('GET /addresses - List addresses', () => {
    it('should return empty list when no addresses', async () => {
      const response = await request(app.getHttpServer())
        .get('/addresses')
        .set('Authorization', `Bearer ${clientAccessToken}`)
        .expect(200)

      expect(response.body.data).toEqual([])
      expect(response.body.pagination.total).toBe(0)
    })

    it('should return list with pagination', async () => {
      const fullAddr = `${validAddress.detail}, ${validAddress.wardName}, ${validAddress.districtName}, ${validAddress.provinceName}`
      await prisma.address.createMany({
        data: [
          { ...validAddress, fullAddress: fullAddr, userId: clientUserId, isDefault: true },
          { ...validAddress, fullAddress: fullAddr, name: 'Address 2', userId: clientUserId, isDefault: false },
          { ...validAddress, fullAddress: fullAddr, name: 'Address 3', userId: clientUserId, isDefault: false },
        ],
      })

      const response = await request(app.getHttpServer())
        .get('/addresses?page=1&limit=2')
        .set('Authorization', `Bearer ${clientAccessToken}`)
        .expect(200)

      expect(response.body.data).toHaveLength(2)
      expect(response.body.pagination.total).toBe(3)
      expect(response.body.pagination.totalPages).toBe(2)
    })
  })

  describe('GET /addresses/:id - Get address detail', () => {
    it('should return address detail', async () => {
      const fullAddr = `${validAddress.detail}, ${validAddress.wardName}, ${validAddress.districtName}, ${validAddress.provinceName}`
      const address = await prisma.address.create({
        data: { ...validAddress, fullAddress: fullAddr, userId: clientUserId, isDefault: true },
      })

      const response = await request(app.getHttpServer())
        .get(`/addresses/${address.id}`)
        .set('Authorization', `Bearer ${clientAccessToken}`)
        .expect(200)

      expect(response.body.data).toMatchObject({
        id: address.id,
        name: validAddress.name,
        phone: validAddress.phone,
      })
    })

    it('should return 404 for non-existent address', async () => {
      await request(app.getHttpServer())
        .get('/addresses/99999')
        .set('Authorization', `Bearer ${clientAccessToken}`)
        .expect(404)
    })
  })

  describe('PUT /addresses/:id - Update address', () => {
    it('should update address', async () => {
      const fullAddr = `${validAddress.detail}, ${validAddress.wardName}, ${validAddress.districtName}, ${validAddress.provinceName}`
      const address = await prisma.address.create({
        data: { ...validAddress, fullAddress: fullAddr, userId: clientUserId, isDefault: true },
      })

      const updateData = { name: 'Updated Name', phone: '0987654321' }
      const response = await request(app.getHttpServer())
        .put(`/addresses/${address.id}`)
        .set('Authorization', `Bearer ${clientAccessToken}`)
        .send(updateData)
        .expect(200)

      expect(response.body.data.name).toBe('Updated Name')
      expect(response.body.data.phone).toBe('0987654321')
    })
  })

  describe('PUT /addresses/:id/default - Set default address', () => {
    it('should set address as default', async () => {
      const fullAddr = `${validAddress.detail}, ${validAddress.wardName}, ${validAddress.districtName}, ${validAddress.provinceName}`
      const address1 = await prisma.address.create({
        data: { ...validAddress, fullAddress: fullAddr, userId: clientUserId, isDefault: true },
      })
      const address2 = await prisma.address.create({
        data: { ...validAddress, fullAddress: fullAddr, name: 'Address 2', userId: clientUserId, isDefault: false },
      })

      const response = await request(app.getHttpServer())
        .put(`/addresses/${address2.id}/default`)
        .set('Authorization', `Bearer ${clientAccessToken}`)
        .expect(200)

      expect(response.body.data.isDefault).toBe(true)

      const oldDefault = await prisma.address.findUnique({ where: { id: address1.id } })
      expect(oldDefault?.isDefault).toBe(false)
    })
  })

  describe('DELETE /addresses/:id - Delete address', () => {
    it('should delete non-default address', async () => {
      const fullAddr = `${validAddress.detail}, ${validAddress.wardName}, ${validAddress.districtName}, ${validAddress.provinceName}`
      await prisma.address.create({
        data: { ...validAddress, fullAddress: fullAddr, userId: clientUserId, isDefault: true },
      })
      const address2 = await prisma.address.create({
        data: { ...validAddress, fullAddress: fullAddr, name: 'Address 2', userId: clientUserId, isDefault: false },
      })

      await request(app.getHttpServer())
        .delete(`/addresses/${address2.id}`)
        .set('Authorization', `Bearer ${clientAccessToken}`)
        .expect(200)

      // Address repo uses isActive = false for soft delete
      const deletedAddress = await prisma.address.findUnique({ where: { id: address2.id } })
      expect(deletedAddress?.isActive).toBe(false)
    })

    it('should return 400 when deleting default address', async () => {
      const fullAddr = `${validAddress.detail}, ${validAddress.wardName}, ${validAddress.districtName}, ${validAddress.provinceName}`
      const address = await prisma.address.create({
        data: { ...validAddress, fullAddress: fullAddr, userId: clientUserId, isDefault: true },
      })

      await request(app.getHttpServer())
        .delete(`/addresses/${address.id}`)
        .set('Authorization', `Bearer ${clientAccessToken}`)
        .expect(400)
    })
  })

  describe('GET /addresses/stats - Get address stats', () => {
    it('should return address stats', async () => {
      const fullAddr = `${validAddress.detail}, ${validAddress.wardName}, ${validAddress.districtName}, ${validAddress.provinceName}`
      await prisma.address.createMany({
        data: [
          { ...validAddress, fullAddress: fullAddr, userId: clientUserId, isDefault: true, isActive: true },
          {
            ...validAddress,
            fullAddress: fullAddr,
            name: 'Address 2',
            userId: clientUserId,
            isDefault: false,
            isActive: true,
          },
        ],
      })

      const response = await request(app.getHttpServer())
        .get('/addresses/stats')
        .set('Authorization', `Bearer ${clientAccessToken}`)
        .expect(200)

      expect(response.body.data).toMatchObject({
        total: 2,
        defaultAddress: expect.objectContaining({
          name: validAddress.name,
          isDefault: true,
        }),
      })
    })
  })

  describe('GET /addresses/default - Get default address', () => {
    it('should return default address', async () => {
      const fullAddr = `${validAddress.detail}, ${validAddress.wardName}, ${validAddress.districtName}, ${validAddress.provinceName}`
      await prisma.address.create({
        data: { ...validAddress, fullAddress: fullAddr, userId: clientUserId, isDefault: true },
      })

      const response = await request(app.getHttpServer())
        .get('/addresses/default')
        .set('Authorization', `Bearer ${clientAccessToken}`)
        .expect(200)

      expect(response.body.data).toMatchObject({
        name: validAddress.name,
        isDefault: true,
      })
    })

    it('should return null when no default address', async () => {
      const response = await request(app.getHttpServer())
        .get('/addresses/default')
        .set('Authorization', `Bearer ${clientAccessToken}`)
        .expect(200)

      expect(response.body.data).toBeNull()
    })
  })
})
