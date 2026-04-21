import { CACHE_MANAGER } from '@nestjs/cache-manager'
import { INestApplication } from '@nestjs/common'
import { Test, TestingModule } from '@nestjs/testing'
import request from 'supertest'
import { AppModule } from '../../src/app.module'
import { PrismaService } from '../../src/shared/services/prisma.service'
import { resetDatabase } from '../helpers/test-helpers'

describe('Voucher Integration Tests', () => {
  let app: INestApplication
  let prisma: PrismaService
  let userAccessToken: string
  let adminAccessToken: string
  let sellerAccessToken: string
  let testUserId: number
  let adminUserId: number
  let sellerUserId: number
  let testVoucherId: number
  let testProductId: number

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

    await app.init()
  })

  beforeEach(async () => {
    await resetDatabase()
    await setupTestUsers()
    await setupTestData()
  })

  afterAll(async () => {
    await app.close()
  })

  async function setupTestUsers() {
    // Create regular user
    const regularUser = {
      email: 'user@test.com',
      name: 'Regular User',
      phoneNumber: '0123456789',
      password: 'password123',
      confirmPassword: 'password123',
    }

    await createUserAndLogin(regularUser, 'user-agent')
    const userLogin = await loginUser(regularUser.email, regularUser.password, 'user-agent')
    userAccessToken = userLogin.accessToken
    testUserId = userLogin.userId

    // Create admin user
    const adminUser = {
      email: 'admin@test.com',
      name: 'Admin User',
      phoneNumber: '0123456788',
      password: 'password123',
      confirmPassword: 'password123',
    }

    await createUserAndLogin(adminUser, 'admin-agent')
    const adminCreated = await prisma.user.findFirst({ where: { email: adminUser.email } })
    await prisma.user.update({
      where: { id: adminCreated!.id },
      data: { roleId: 1 }, // ADMIN role
    })
    const adminLogin = await loginUser(adminUser.email, adminUser.password, 'admin-agent')
    adminAccessToken = adminLogin.accessToken
    adminUserId = adminLogin.userId

    // Create seller user
    const sellerUser = {
      email: 'seller@test.com',
      name: 'Seller User',
      phoneNumber: '0123456787',
      password: 'password123',
      confirmPassword: 'password123',
    }

    await createUserAndLogin(sellerUser, 'seller-agent')
    const sellerCreated = await prisma.user.findFirst({ where: { email: sellerUser.email } })
    await prisma.user.update({
      where: { id: sellerCreated!.id },
      data: { roleId: 3 }, // SELLER role (roleId: 3)
    })
    const sellerLogin = await loginUser(sellerUser.email, sellerUser.password, 'seller-agent')
    sellerAccessToken = sellerLogin.accessToken
    sellerUserId = sellerLogin.userId
  }

  async function createUserAndLogin(userData: any, userAgent: string) {
    // Send OTP
    await request(app.getHttpServer()).post('/auth/otp').send({
      email: userData.email,
      type: 'REGISTER',
    })

    // Get OTP code
    const verificationCode = await prisma.verificationCode.findFirst({
      where: {
        email: userData.email,
        type: 'REGISTER',
      },
    })

    // Register user
    await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        ...userData,
        code: verificationCode?.code,
      })
  }

  async function loginUser(email: string, password: string, userAgent: string) {
    const response = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email, password })
      .set('User-Agent', userAgent)

    const user = await prisma.user.findFirst({ where: { email } })
    return {
      accessToken: response.body.accessToken,
      userId: user!.id,
    }
  }

  async function setupTestData() {
    // Create product for testing
    const category = await prisma.category.create({
      data: {
        name: 'Test Category',
        logo: 'test-logo.png',
        createdById: adminUserId,
      },
    })

    const brand = await prisma.brand.create({
      data: {
        name: 'Test Brand',
        logo: 'test-brand.png',
        createdById: adminUserId,
      },
    })

    const product = await prisma.product.create({
      data: {
        name: 'Test Product',
        brandId: brand.id,
        images: ['test-product.png'],
        basePrice: 100000,
        virtualPrice: 100000,
        variants: [],
        publishedAt: new Date(),
        createdById: adminUserId,
        categories: {
          connect: { id: category.id },
        },
      },
    })

    testProductId = product.id

    // Create test voucher by admin
    const voucher = await prisma.voucher.create({
      data: {
        code: 'TESTCODE2024',
        name: 'Test Voucher',
        description: 'Test voucher for integration tests',
        type: 'PERCENTAGE',
        value: 20,
        minOrderValue: 100000,
        maxDiscount: 50000,
        usageLimit: 100,
        usedCount: 0,
        userUsageLimit: 1,
        startDate: new Date(Date.now() - 86400000), // Yesterday
        endDate: new Date(Date.now() + 7 * 86400000), // Next week
        isActive: true,
        createdById: adminUserId,
      },
    })

    testVoucherId = voucher.id
  }

  describe('Public Voucher Endpoints', () => {
    it('should get available vouchers without authentication', async () => {
      const response = await request(app.getHttpServer()).get('/vouchers/available').expect(200)

      expect(response.body).toMatchObject({
        data: expect.arrayContaining([
          expect.objectContaining({
            id: testVoucherId,
            code: 'TESTCODE2024',
            name: 'Test Voucher',
            type: 'PERCENTAGE',
            value: 20,
            isCollected: false,
            canApply: false,
            userVoucher: null,
          }),
        ]),
        pagination: expect.objectContaining({
          page: 1,
          limit: 10,
          total: expect.any(Number),
        }),
      })
    })

    it('should get available vouchers with user authentication', async () => {
      const response = await request(app.getHttpServer())
        .get('/vouchers/available')
        .set('Authorization', `Bearer ${userAccessToken}`)
        .expect(200)

      expect(response.body.data[0]).toMatchObject({
        id: testVoucherId,
        code: 'TESTCODE2024',
        isCollected: false,
        canApply: false, // Not collected yet
      })
    })

    it('should get voucher by code without authentication', async () => {
      const response = await request(app.getHttpServer()).get('/vouchers/code/TESTCODE2024').expect(200)

      expect(response.body).toMatchObject({
        data: expect.objectContaining({
          id: testVoucherId,
          code: 'TESTCODE2024',
          name: 'Test Voucher',
          isCollected: false,
          canApply: false,
          userVoucher: null,
        }),
      })
    })

    it('should get voucher detail without authentication', async () => {
      const response = await request(app.getHttpServer()).get(`/vouchers/${testVoucherId}`).expect(200)

      expect(response.body).toMatchObject({
        data: expect.objectContaining({
          id: testVoucherId,
          code: 'TESTCODE2024',
          name: 'Test Voucher',
          type: 'PERCENTAGE',
          value: 20,
          isCollected: false,
          canApply: false,
        }),
      })
    })

    it('should handle pagination for available vouchers', async () => {
      // Create more vouchers
      for (let i = 0; i < 15; i++) {
        await prisma.voucher.create({
          data: {
            code: `CODE${i}`,
            name: `Voucher ${i}`,
            description: `Description ${i}`,
            type: 'FIXED_AMOUNT',
            value: 10000 * (i + 1),
            minOrderValue: 50000,
            usageLimit: 50,
            usedCount: 0,
            userUsageLimit: 1,
            startDate: new Date(Date.now() - 86400000),
            endDate: new Date(Date.now() + 7 * 86400000),
            isActive: true,
            createdById: adminUserId,
          },
        })
      }

      // Test page 1
      const page1Response = await request(app.getHttpServer()).get('/vouchers/available?page=1&limit=10').expect(200)

      expect(page1Response.body.pagination.page).toBe(1)
      expect(page1Response.body.pagination.limit).toBe(10)
      expect(page1Response.body.data).toHaveLength(10)

      // Test page 2
      const page2Response = await request(app.getHttpServer()).get('/vouchers/available?page=2&limit=10').expect(200)

      expect(page2Response.body.pagination.page).toBe(2)
      expect(page2Response.body.data.length).toBeGreaterThan(0)
    })
  })

  describe('User Voucher Operations', () => {
    it('should collect voucher successfully', async () => {
      const response = await request(app.getHttpServer())
        .post(`/vouchers/${testVoucherId}/collect`)
        .set('Authorization', `Bearer ${userAccessToken}`)
        .expect(201)

      expect(response.body).toMatchObject({
        data: expect.objectContaining({
          userId: testUserId,
          voucherId: testVoucherId,
          usedCount: 0,
          savedAt: expect.any(String),
        }),
      })

      // Verify voucher is in my vouchers list
      const myVouchersResponse = await request(app.getHttpServer())
        .get('/vouchers/my')
        .set('Authorization', `Bearer ${userAccessToken}`)
        .expect(200)

      const collectedVoucher = myVouchersResponse.body.data.find((uv: any) => uv.voucherId === testVoucherId)
      expect(collectedVoucher).toBeDefined()
      expect(collectedVoucher.userId).toBe(testUserId)
      expect(collectedVoucher.usedCount).toBe(0)
    })

    it('should not allow collecting same voucher twice', async () => {
      // Collect voucher first time
      await request(app.getHttpServer())
        .post(`/vouchers/${testVoucherId}/collect`)
        .set('Authorization', `Bearer ${userAccessToken}`)
        .expect(201)

      // Try to collect again
      await request(app.getHttpServer())
        .post(`/vouchers/${testVoucherId}/collect`)
        .set('Authorization', `Bearer ${userAccessToken}`)
        .expect(400)
    })

    it('should get my vouchers list', async () => {
      // Collect voucher first
      await request(app.getHttpServer())
        .post(`/vouchers/${testVoucherId}/collect`)
        .set('Authorization', `Bearer ${userAccessToken}`)
        .expect(201)

      // Get my vouchers
      const response = await request(app.getHttpServer())
        .get('/vouchers/my')
        .set('Authorization', `Bearer ${userAccessToken}`)
        .expect(200)

      expect(response.body).toMatchObject({
        data: expect.arrayContaining([
          expect.objectContaining({
            userId: testUserId,
            voucherId: testVoucherId,
            voucher: expect.objectContaining({
              code: 'TESTCODE2024',
              name: 'Test Voucher',
            }),
          }),
        ]),
        pagination: expect.any(Object),
      })
    })

    it('should apply voucher successfully', async () => {
      // Collect voucher first
      await request(app.getHttpServer())
        .post(`/vouchers/${testVoucherId}/collect`)
        .set('Authorization', `Bearer ${userAccessToken}`)
        .expect(201)

      // Apply voucher
      const response = await request(app.getHttpServer())
        .post('/vouchers/apply')
        .set('Authorization', `Bearer ${userAccessToken}`)
        .send({
          code: 'TESTCODE2024',
          orderAmount: 200000,
          productIds: [testProductId],
        })
        .expect(201)

      expect(response.body).toMatchObject({
        data: expect.objectContaining({
          canApply: true,
          discountAmount: 40000, // 20% of 200000
          voucher: expect.objectContaining({
            code: 'TESTCODE2024',
          }),
        }),
      })
    })

    it('should not apply voucher when conditions not met', async () => {
      // Collect voucher first
      await request(app.getHttpServer())
        .post(`/vouchers/${testVoucherId}/collect`)
        .set('Authorization', `Bearer ${userAccessToken}`)
        .expect(201)

      // Apply voucher with order amount below minimum
      const response = await request(app.getHttpServer())
        .post('/vouchers/apply')
        .set('Authorization', `Bearer ${userAccessToken}`)
        .send({
          code: 'TESTCODE2024',
          orderAmount: 50000, // Below minOrderValue (100000)
          productIds: [testProductId],
        })
        .expect(201)

      expect(response.body.data.canApply).toBe(false)
      expect(response.body.data.discountAmount).toBe(0)
      expect(response.body.data.reason).toBeDefined()
    })

    it('should get user voucher stats', async () => {
      // Collect a voucher
      await request(app.getHttpServer())
        .post(`/vouchers/${testVoucherId}/collect`)
        .set('Authorization', `Bearer ${userAccessToken}`)
        .expect(201)

      const response = await request(app.getHttpServer())
        .get('/vouchers/my/stats')
        .set('Authorization', `Bearer ${userAccessToken}`)
        .expect(200)

      expect(response.body).toMatchObject({
        data: expect.objectContaining({
          totalVouchers: expect.any(Number),
          collectedVouchers: expect.any(Number),
          usedVouchers: expect.any(Number),
        }),
      })
    })
  })

  describe('Admin Voucher Management', () => {
    it('should create voucher as admin', async () => {
      const voucherData = {
        code: 'ADMINCODE2024',
        name: 'Admin Created Voucher',
        description: 'Created by admin for testing',
        type: 'FIXED_AMOUNT',
        value: 50000,
        minOrderValue: 200000,
        maxDiscount: 100000,
        usageLimit: 200,
        userUsageLimit: 2,
        startDate: new Date(Date.now() + 86400000), // Tomorrow
        endDate: new Date(Date.now() + 14 * 86400000), // Two weeks
        isActive: true,
        applicableProducts: [testProductId],
        excludedProducts: [],
      }

      const response = await request(app.getHttpServer())
        .post('/vouchers/manage')
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .send(voucherData)
        .expect(201)

      expect(response.body).toMatchObject({
        data: expect.objectContaining({
          code: 'ADMINCODE2024',
          name: 'Admin Created Voucher',
          type: 'FIXED_AMOUNT',
          value: 50000,
          sellerId: null, // Admin voucher
        }),
      })
    })

    it('should get vouchers list as admin', async () => {
      const response = await request(app.getHttpServer())
        .get('/vouchers/manage')
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .expect(200)

      expect(response.body).toMatchObject({
        data: expect.arrayContaining([
          expect.objectContaining({
            id: testVoucherId,
            code: 'TESTCODE2024',
          }),
        ]),
        pagination: expect.any(Object),
      })
    })

    it('should update voucher as admin', async () => {
      const updateData = {
        name: 'Updated Test Voucher',
        description: 'Updated description',
        isActive: false,
      }

      const response = await request(app.getHttpServer())
        .put(`/vouchers/manage/${testVoucherId}`)
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .send(updateData)
        .expect(200)

      expect(response.body).toMatchObject({
        data: expect.objectContaining({
          id: testVoucherId,
          name: 'Updated Test Voucher',
          description: 'Updated description',
          isActive: false,
        }),
      })
    })

    it('should delete voucher as admin', async () => {
      // Create a new voucher to delete
      const voucher = await prisma.voucher.create({
        data: {
          code: 'DELETEME2024',
          name: 'Delete Me Voucher',
          description: 'To be deleted',
          type: 'PERCENTAGE',
          value: 10,
          usageLimit: 10,
          usedCount: 0,
          userUsageLimit: 1,
          startDate: new Date(),
          endDate: new Date(Date.now() + 86400000),
          isActive: true,
          createdById: adminUserId,
        },
      })

      const response = await request(app.getHttpServer())
        .delete(`/vouchers/manage/${voucher.id}`)
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .expect(200)

      expect(response.body.message).toContain('voucher')

      // Verify voucher is soft deleted (deletedAt is set)
      const deletedVoucher = await prisma.voucher.findUnique({
        where: { id: voucher.id },
      })
      expect(deletedVoucher).not.toBeNull()
      expect(deletedVoucher!.deletedAt).not.toBeNull()
      expect(deletedVoucher!.deletedById).toBe(adminUserId)
    })

    it('should get admin voucher stats', async () => {
      const response = await request(app.getHttpServer())
        .get('/vouchers/manage/stats')
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .expect(200)

      expect(response.body).toMatchObject({
        data: expect.objectContaining({
          totalVouchers: expect.any(Number),
          activeVouchers: expect.any(Number),
        }),
      })
    })
  })

  describe('Seller Voucher Management', () => {
    it('should create voucher as seller', async () => {
      const voucherData = {
        code: 'SELLERCODE2024',
        name: 'Seller Created Voucher',
        description: 'Created by seller for testing',
        type: 'PERCENTAGE',
        value: 15,
        minOrderValue: 100000,
        usageLimit: 50,
        userUsageLimit: 1,
        startDate: new Date(Date.now() + 86400000),
        endDate: new Date(Date.now() + 7 * 86400000),
        isActive: true,
      }

      const response = await request(app.getHttpServer())
        .post('/vouchers/manage')
        .set('Authorization', `Bearer ${sellerAccessToken}`)
        .send(voucherData)
        .expect(201)

      expect(response.body).toMatchObject({
        data: expect.objectContaining({
          code: 'SELLERCODE2024',
          name: 'Seller Created Voucher',
          sellerId: sellerUserId, // Seller voucher
        }),
      })
    })

    it('should only see own vouchers as seller', async () => {
      // Create seller voucher
      await request(app.getHttpServer())
        .post('/vouchers/manage')
        .set('Authorization', `Bearer ${sellerAccessToken}`)
        .send({
          code: 'SELLERONLY2024',
          name: 'Seller Only Voucher',
          type: 'FIXED_AMOUNT',
          value: 25000,
          usageLimit: 30,
          userUsageLimit: 1,
          startDate: new Date(),
          endDate: new Date(Date.now() + 86400000),
          isActive: true,
        })
        .expect(201)

      // Get vouchers as seller
      const response = await request(app.getHttpServer())
        .get('/vouchers/manage')
        .set('Authorization', `Bearer ${sellerAccessToken}`)
        .expect(200)

      // Should only see vouchers with sellerId = sellerUserId
      response.body.data.forEach((voucher: any) => {
        expect(voucher.sellerId).toBe(sellerUserId)
      })
    })

    it('should get seller voucher stats', async () => {
      const response = await request(app.getHttpServer())
        .get('/vouchers/manage/stats')
        .set('Authorization', `Bearer ${sellerAccessToken}`)
        .expect(200)

      expect(response.body).toMatchObject({
        data: expect.objectContaining({
          totalVouchers: expect.any(Number),
          activeVouchers: expect.any(Number),
        }),
      })
    })

    it('should not allow seller to edit other seller vouchers', async () => {
      // Admin creates a platform voucher
      const platformVoucher = await prisma.voucher.create({
        data: {
          code: 'PLATFORM2024',
          name: 'Platform Voucher',
          type: 'PERCENTAGE',
          value: 25,
          usageLimit: 100,
          usedCount: 0,
          userUsageLimit: 1,
          startDate: new Date(),
          endDate: new Date(Date.now() + 86400000),
          isActive: true,
          createdById: adminUserId,
          sellerId: null, // Platform voucher
        },
      })

      // Seller tries to update platform voucher
      await request(app.getHttpServer())
        .put(`/vouchers/manage/${platformVoucher.id}`)
        .set('Authorization', `Bearer ${sellerAccessToken}`)
        .send({
          name: 'Hacked Platform Voucher',
        })
        .expect(403) // Should be forbidden
    })
  })

  describe('Voucher Validation Tests', () => {
    it('should validate voucher creation data', async () => {
      // Missing required fields
      await request(app.getHttpServer())
        .post('/vouchers/manage')
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .send({
          name: 'Invalid Voucher',
        })
        .expect(422) // Zod validation returns 422

      // Invalid percentage value
      await request(app.getHttpServer())
        .post('/vouchers/manage')
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .send({
          code: 'INVALID2024',
          name: 'Invalid Voucher',
          type: 'PERCENTAGE',
          value: 150, // Invalid percentage > 100
          usageLimit: 10,
          userUsageLimit: 1,
          startDate: new Date(),
          endDate: new Date(Date.now() + 86400000),
        })
        .expect(422) // Zod refine validation returns 422

      // Invalid date range
      await request(app.getHttpServer())
        .post('/vouchers/manage')
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .send({
          code: 'INVALID2024',
          name: 'Invalid Voucher',
          type: 'FIXED_AMOUNT',
          value: 10000,
          usageLimit: 10,
          userUsageLimit: 1,
          startDate: new Date(Date.now() + 86400000), // Tomorrow
          endDate: new Date(), // Today (before start date)
        })
        .expect(422) // Zod refine validation returns 422
    })

    it('should not allow duplicate voucher codes', async () => {
      // Create first voucher
      await request(app.getHttpServer())
        .post('/vouchers/manage')
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .send({
          code: 'UNIQUE2024',
          name: 'First Voucher',
          type: 'FIXED_AMOUNT',
          value: 10000,
          usageLimit: 10,
          userUsageLimit: 1,
          startDate: new Date(),
          endDate: new Date(Date.now() + 86400000),
        })
        .expect(201)

      // Try to create voucher with same code
      await request(app.getHttpServer())
        .post('/vouchers/manage')
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .send({
          code: 'UNIQUE2024', // Same code
          name: 'Second Voucher',
          type: 'PERCENTAGE',
          value: 20,
          usageLimit: 20,
          userUsageLimit: 1,
          startDate: new Date(),
          endDate: new Date(Date.now() + 86400000),
        })
        .expect(400)
    })

    it('should require authentication for protected endpoints', async () => {
      // User endpoints
      await request(app.getHttpServer()).post(`/vouchers/${testVoucherId}/collect`).expect(401)

      await request(app.getHttpServer()).get('/vouchers/my').expect(401)

      await request(app.getHttpServer()).post('/vouchers/apply').send({}).expect(401)

      // Admin/Seller endpoints
      await request(app.getHttpServer()).post('/vouchers/manage').send({}).expect(401)

      await request(app.getHttpServer()).get('/vouchers/manage').expect(401)

      await request(app.getHttpServer()).put(`/vouchers/manage/${testVoucherId}`).send({}).expect(401)

      await request(app.getHttpServer()).delete(`/vouchers/manage/${testVoucherId}`).expect(401)
    })

    it('should require proper roles for management endpoints', async () => {
      // Regular user tries to access management endpoints
      await request(app.getHttpServer())
        .post('/vouchers/manage')
        .set('Authorization', `Bearer ${userAccessToken}`)
        .send({
          code: 'UNAUTHORIZED2024',
          name: 'Unauthorized Voucher',
          type: 'FIXED_AMOUNT',
          value: 10000,
          usageLimit: 10,
          userUsageLimit: 1,
          startDate: new Date(),
          endDate: new Date(Date.now() + 86400000),
        })
        .expect(403) // Forbidden

      await request(app.getHttpServer())
        .get('/vouchers/manage')
        .set('Authorization', `Bearer ${userAccessToken}`)
        .expect(403)
    })
  })

  describe('Voucher Business Logic Tests', () => {
    it('should handle voucher expiry correctly', async () => {
      // Create expired voucher
      const expiredVoucher = await prisma.voucher.create({
        data: {
          code: 'EXPIRED2024',
          name: 'Expired Voucher',
          type: 'PERCENTAGE',
          value: 30,
          usageLimit: 10,
          usedCount: 0,
          userUsageLimit: 1,
          startDate: new Date(Date.now() - 7 * 86400000), // Last week
          endDate: new Date(Date.now() - 86400000), // Yesterday (expired)
          isActive: true,
          createdById: adminUserId,
        },
      })

      // Try to collect expired voucher
      await request(app.getHttpServer())
        .post(`/vouchers/${expiredVoucher.id}/collect`)
        .set('Authorization', `Bearer ${userAccessToken}`)
        .expect(400) // Should be rejected
    })

    it('should handle usage limit correctly', async () => {
      // Create voucher with low usage limit
      const limitedVoucher = await prisma.voucher.create({
        data: {
          code: 'LIMITED2024',
          name: 'Limited Voucher',
          type: 'FIXED_AMOUNT',
          value: 15000,
          usageLimit: 1, // Only 1 use allowed
          usedCount: 0,
          userUsageLimit: 1,
          startDate: new Date(Date.now() - 86400000),
          endDate: new Date(Date.now() + 86400000),
          isActive: true,
          createdById: adminUserId,
        },
      })

      // First user collects voucher
      await request(app.getHttpServer())
        .post(`/vouchers/${limitedVoucher.id}/collect`)
        .set('Authorization', `Bearer ${userAccessToken}`)
        .expect(201)

      // Mark voucher as used
      await prisma.voucher.update({
        where: { id: limitedVoucher.id },
        data: { usedCount: 1 },
      })

      // Create second user
      const secondUser = {
        email: 'second@test.com',
        name: 'Second User',
        phoneNumber: '0999999999',
        password: 'password123',
        confirmPassword: 'password123',
      }

      await createUserAndLogin(secondUser, 'second-agent')
      const secondUserLogin = await loginUser(secondUser.email, secondUser.password, 'second-agent')

      // Second user tries to collect (should fail due to usage limit)
      await request(app.getHttpServer())
        .post(`/vouchers/${limitedVoucher.id}/collect`)
        .set('Authorization', `Bearer ${secondUserLogin.accessToken}`)
        .expect(400)
    })

    it('should calculate discount correctly for different voucher types', async () => {
      // Test PERCENTAGE voucher
      await request(app.getHttpServer())
        .post(`/vouchers/${testVoucherId}/collect`)
        .set('Authorization', `Bearer ${userAccessToken}`)
        .expect(201)

      const percentageResponse = await request(app.getHttpServer())
        .post('/vouchers/apply')
        .set('Authorization', `Bearer ${userAccessToken}`)
        .send({
          code: 'TESTCODE2024',
          orderAmount: 200000,
          productIds: [testProductId],
        })
        .expect(201)

      expect(percentageResponse.body.data.discountAmount).toBe(40000) // 20% of 200000

      // Test FIXED_AMOUNT voucher
      const fixedVoucher = await prisma.voucher.create({
        data: {
          code: 'FIXED2024',
          name: 'Fixed Amount Voucher',
          type: 'FIXED_AMOUNT',
          value: 25000, // Fixed 25000 discount
          usageLimit: 10,
          usedCount: 0,
          userUsageLimit: 1,
          startDate: new Date(Date.now() - 86400000),
          endDate: new Date(Date.now() + 86400000),
          isActive: true,
          createdById: adminUserId,
        },
      })

      await request(app.getHttpServer())
        .post(`/vouchers/${fixedVoucher.id}/collect`)
        .set('Authorization', `Bearer ${userAccessToken}`)
        .expect(201)

      const fixedResponse = await request(app.getHttpServer())
        .post('/vouchers/apply')
        .set('Authorization', `Bearer ${userAccessToken}`)
        .send({
          code: 'FIXED2024',
          orderAmount: 100000,
          productIds: [testProductId],
        })
        .expect(201)

      expect(fixedResponse.body.data.discountAmount).toBe(25000) // Fixed amount
    })
  })
})
