import { CACHE_MANAGER } from '@nestjs/cache-manager'
import { INestApplication } from '@nestjs/common'
import { Test, TestingModule } from '@nestjs/testing'
import request from 'supertest'
import { AppModule } from '../../src/app.module'
import { OrderStatus } from '../../src/shared/constants/order.constant'
import { PrismaService } from '../../src/shared/services/prisma.service'
import { resetDatabase } from '../helpers/test-helpers'

describe('Cart-Order-Voucher Integration Flow Tests', () => {
  let app: INestApplication
  let prisma: PrismaService
  let userAccessToken: string
  let adminAccessToken: string
  let testUserId: number
  let adminUserId: number
  let testSKUId: number
  let testShopId: number
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
    // Create category, brand, product, SKU
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

    // Create seller (shop)
    const seller = await prisma.user.create({
      data: {
        email: 'seller@test.com',
        name: 'Test Seller',
        phoneNumber: '0987654321',
        password: '$2b$10$hashedPasswordExample',
        roleId: 3, // SELLER role (FIXED: was 2, should be 3)
        status: 'ACTIVE',
      },
    })
    testShopId = seller.id

    const product = await prisma.product.create({
      data: {
        name: 'Test Product',
        brandId: brand.id,
        images: ['test-product.png'],
        basePrice: 200000, // Base price 200k
        virtualPrice: 200000,
        variants: [],
        publishedAt: new Date('2024-01-01'), // FIXED: use fixed date in the past
        createdById: seller.id, // FIXED: Product must be created by seller, not admin
        categories: {
          connect: { id: category.id },
        },
      },
    })
    testProductId = product.id

    const sku = await prisma.sKU.create({
      data: {
        productId: product.id,
        value: 'Size: M, Color: Blue',
        price: 200000, // SKU price 200k
        stock: 100,
        image: 'test-sku.png',
        createdById: seller.id, // FIXED: SKU must be created by seller, not admin
      },
    })
    testSKUId = sku.id

    // Create test voucher (20% discount, min order 300k)
    const voucher = await prisma.voucher.create({
      data: {
        code: 'SAVE20',
        name: 'Save 20% Voucher',
        description: 'Get 20% off your order',
        type: 'PERCENTAGE',
        value: 20,
        minOrderValue: 300000, // Min 300k to apply
        maxDiscount: 100000, // Max discount 100k
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

  async function addToCart(skuId: number = testSKUId, quantity: number = 2) {
    const response = await request(app.getHttpServer())
      .post('/cart')
      .set('Authorization', `Bearer ${userAccessToken}`)
      .send({ skuId, quantity })
      .expect(201)
    return response.body.id
  }

  describe('Complete E-commerce Flow: Cart → Voucher → Order', () => {
    it('should complete full e-commerce workflow with voucher application', async () => {
      // ===== PHASE 1: SHOPPING CART =====
      console.log('🛒 PHASE 1: Building Shopping Cart')

      // Step 1: Add items to cart (2 items × 200k = 400k total)
      const cartItem1 = await addToCart(testSKUId, 2)
      expect(cartItem1).toBeDefined()

      // Step 2: Verify cart contents
      const cartResponse = await request(app.getHttpServer())
        .get('/cart')
        .set('Authorization', `Bearer ${userAccessToken}`)
        .expect(200)

      expect(cartResponse.body.data).toHaveLength(1) // 1 shop
      expect(cartResponse.body.data[0].cartItems).toHaveLength(1) // 1 SKU
      expect(cartResponse.body.data[0].cartItems[0].quantity).toBe(2)

      const totalCartValue =
        cartResponse.body.data[0].cartItems[0].quantity * cartResponse.body.data[0].cartItems[0].sku.price
      expect(totalCartValue).toBe(400000) // 2 × 200k = 400k

      // ===== PHASE 2: VOUCHER DISCOVERY & COLLECTION =====
      console.log('🎟️ PHASE 2: Voucher Discovery & Collection')

      // Step 3: Browse available vouchers
      const availableVouchersResponse = await request(app.getHttpServer())
        .get('/vouchers/available')
        .set('Authorization', `Bearer ${userAccessToken}`)
        .expect(200)

      expect(availableVouchersResponse.body.data).toHaveLength(1)
      const voucher = availableVouchersResponse.body.data[0]
      expect(voucher.code).toBe('SAVE20')
      expect(voucher.isCollected).toBe(false)
      expect(voucher.canApply).toBe(false) // Not collected yet

      // Step 4: Collect the voucher
      const collectResponse = await request(app.getHttpServer())
        .post(`/vouchers/${testVoucherId}/collect`)
        .set('Authorization', `Bearer ${userAccessToken}`)
        .expect(201)

      expect(collectResponse.body.data).toMatchObject({
        userId: testUserId,
        voucherId: testVoucherId,
        usedCount: 0,
      })

      // Step 5: Verify voucher is collected
      const myVouchersResponse = await request(app.getHttpServer())
        .get('/vouchers/my')
        .set('Authorization', `Bearer ${userAccessToken}`)
        .expect(200)

      expect(myVouchersResponse.body.data).toHaveLength(1)
      expect(myVouchersResponse.body.data[0].voucher.code).toBe('SAVE20')

      // ===== PHASE 3: VOUCHER APPLICATION =====
      console.log('💰 PHASE 3: Voucher Application')

      // Step 6: Apply voucher to calculate discount
      const applyVoucherResponse = await request(app.getHttpServer())
        .post('/vouchers/apply')
        .set('Authorization', `Bearer ${userAccessToken}`)
        .send({
          code: 'SAVE20',
          orderAmount: 400000, // Total cart value
          productIds: [testProductId],
        })
        .expect(201)

      expect(applyVoucherResponse.body.data).toMatchObject({
        canApply: true,
        discountAmount: 80000, // 20% of 400k = 80k
        voucher: expect.objectContaining({
          code: 'SAVE20',
        }),
      })

      const discountAmount = applyVoucherResponse.body.data.discountAmount
      const finalAmount = 400000 - discountAmount // 400k - 80k = 320k

      // ===== PHASE 4: ORDER CREATION =====
      console.log('📦 PHASE 4: Order Creation')

      // Step 7: Create order from cart
      const createOrderResponse = await request(app.getHttpServer())
        .post('/orders')
        .set('Authorization', `Bearer ${userAccessToken}`)
        .send([
          {
            shopId: testShopId,
            receiver: {
              name: 'John Doe',
              phone: '0123456789',
              address: '123 Test Street, Test City',
            },
            cartItemIds: [cartItem1],
          },
        ])
        .expect(201)

      expect(createOrderResponse.body).toMatchObject({
        paymentId: expect.any(Number),
        orders: expect.arrayContaining([
          expect.objectContaining({
            id: expect.any(Number),
            userId: testUserId,
            shopId: testShopId,
            status: OrderStatus.PENDING_PAYMENT,
            // NOTE: totalAmount is not in OrderSchema response, it's only in database
          }),
        ]),
      })

      const orderId = createOrderResponse.body.orders[0].id

      // ===== PHASE 5: ORDER VERIFICATION =====
      console.log('✅ PHASE 5: Order Verification')

      // Step 8: Verify cart is cleaned up
      const emptyCartResponse = await request(app.getHttpServer())
        .get('/cart')
        .set('Authorization', `Bearer ${userAccessToken}`)
        .expect(200)

      expect(emptyCartResponse.body.totalItems).toBe(0)

      // Step 9: Verify order details
      const orderDetailResponse = await request(app.getHttpServer())
        .get(`/orders/${orderId}`)
        .set('Authorization', `Bearer ${userAccessToken}`)
        .expect(200)

      expect(orderDetailResponse.body).toMatchObject({
        id: orderId,
        userId: testUserId,
        shopId: testShopId,
        status: OrderStatus.PENDING_PAYMENT,
        items: expect.arrayContaining([
          expect.objectContaining({
            skuId: testSKUId,
            quantity: 2,
            skuPrice: 200000,
            productName: 'Test Product',
          }),
        ]),
      })

      // Step 10: Verify order appears in order list
      const orderListResponse = await request(app.getHttpServer())
        .get('/orders')
        .set('Authorization', `Bearer ${userAccessToken}`)
        .expect(200)

      expect(orderListResponse.body.data).toHaveLength(1)
      expect(orderListResponse.body.data[0].id).toBe(orderId)

      // ===== PHASE 6: PAYMENT INTEGRATION =====
      console.log('💳 PHASE 6: Payment Integration')

      // Step 11: Verify payment was created
      const payment = await prisma.payment.findUnique({
        where: { id: createOrderResponse.body.paymentId },
      })
      expect(payment).toBeTruthy()
      expect(payment!.status).toBe('PENDING')

      // ===== PHASE 7: INVENTORY MANAGEMENT =====
      console.log('📊 PHASE 7: Inventory Management')

      // Step 12: Verify stock was reduced
      const updatedSKU = await prisma.sKU.findUnique({
        where: { id: testSKUId },
      })
      expect(updatedSKU!.stock).toBe(98) // 100 - 2 = 98

      console.log('🎉 Complete E-commerce Flow Test Passed!')
      console.log(`💡 Order Total: ${400000} VND`)
      console.log(`🎟️ Voucher Discount: ${discountAmount} VND`)
      console.log(`💰 Final Amount: ${finalAmount} VND`)
    })

    it('should handle voucher that cannot be applied due to minimum order value', async () => {
      console.log('🚫 Testing Voucher Minimum Order Value Validation')

      // Step 1: Add only 1 item to cart (1 × 200k = 200k, below 300k minimum)
      const cartItem = await addToCart(testSKUId, 1)

      // Step 2: Collect voucher
      await request(app.getHttpServer())
        .post(`/vouchers/${testVoucherId}/collect`)
        .set('Authorization', `Bearer ${userAccessToken}`)
        .expect(201)

      // Step 3: Try to apply voucher (should fail due to minimum order value)
      const applyVoucherResponse = await request(app.getHttpServer())
        .post('/vouchers/apply')
        .set('Authorization', `Bearer ${userAccessToken}`)
        .send({
          code: 'SAVE20',
          orderAmount: 200000, // Below 300k minimum
          productIds: [testProductId],
        })
        .expect(201)

      expect(applyVoucherResponse.body.data).toMatchObject({
        canApply: false,
        discountAmount: 0,
        reason: expect.any(String),
      })

      // Step 4: Create order anyway (without voucher)
      const createOrderResponse = await request(app.getHttpServer())
        .post('/orders')
        .set('Authorization', `Bearer ${userAccessToken}`)
        .send([
          {
            shopId: testShopId,
            receiver: {
              name: 'John Doe',
              phone: '0123456789',
              address: '123 Test Street, Test City',
            },
            cartItemIds: [cartItem],
          },
        ])
        .expect(201)

      // NOTE: totalAmount is not in OrderSchema response, removed assertion
      expect(createOrderResponse.body.orders[0].id).toBeDefined()
    })

    it('should handle multiple items from different price ranges with voucher', async () => {
      console.log('🛍️ Testing Multiple Items with Different Prices')

      // Step 1: Create expensive product
      const expensiveProduct = await prisma.product.create({
        data: {
          name: 'Expensive Product',
          brandId: (await prisma.brand.findFirst())!.id,
          images: ['expensive.png'],
          basePrice: 500000,
          virtualPrice: 500000,
          variants: [],
          publishedAt: new Date('2024-01-01'), // FIXED: use fixed date in the past
          createdById: testShopId, // FIXED: Product must be created by seller (testShopId)
          categories: {
            connect: { id: (await prisma.category.findFirst())!.id },
          },
        },
      })

      const expensiveSKU = await prisma.sKU.create({
        data: {
          productId: expensiveProduct.id,
          value: 'Premium Quality',
          price: 500000,
          stock: 50,
          image: 'expensive-sku.png',
          createdById: testShopId, // FIXED: SKU must be created by seller (testShopId)
        },
      })

      // Step 2: Add both products to cart
      const cartItem1 = await addToCart(testSKUId, 2) // 2 × 200k = 400k
      const cartItem2 = await addToCart(expensiveSKU.id, 1) // 1 × 500k = 500k
      // Total: 900k

      // Step 3: Collect and apply voucher
      await request(app.getHttpServer())
        .post(`/vouchers/${testVoucherId}/collect`)
        .set('Authorization', `Bearer ${userAccessToken}`)
        .expect(201)

      const applyVoucherResponse = await request(app.getHttpServer())
        .post('/vouchers/apply')
        .set('Authorization', `Bearer ${userAccessToken}`)
        .send({
          code: 'SAVE20',
          orderAmount: 900000,
          productIds: [testProductId, expensiveProduct.id],
        })
        .expect(201)

      // 20% of 900k = 180k, but max discount is 100k
      expect(applyVoucherResponse.body.data).toMatchObject({
        canApply: true,
        discountAmount: 100000, // Capped at maxDiscount
      })

      // Step 4: Create order
      const createOrderResponse = await request(app.getHttpServer())
        .post('/orders')
        .set('Authorization', `Bearer ${userAccessToken}`)
        .send([
          {
            shopId: testShopId,
            receiver: {
              name: 'John Doe',
              phone: '0123456789',
              address: '123 Test Street, Test City',
            },
            cartItemIds: [cartItem1, cartItem2],
          },
        ])
        .expect(201)

      // NOTE: totalAmount is not in OrderSchema response, removed assertion
      expect(createOrderResponse.body.orders[0].id).toBeDefined()

      console.log('💡 Order with mixed products:')
      console.log(`📦 Regular item: 2 × 200k = 400k`)
      console.log(`💎 Premium item: 1 × 500k = 500k`)
      console.log(`💰 Total: 900k, Discount: 100k (capped), Final: 800k`)
    })
  })

  describe('Error Scenarios and Edge Cases', () => {
    it('should handle workflow when voucher is already used up', async () => {
      // Step 1: Set voucher as fully used
      await prisma.voucher.update({
        where: { id: testVoucherId },
        data: {
          usedCount: 100, // Equal to usageLimit
        },
      })

      // Step 2: Add items to cart
      await addToCart(testSKUId, 2)

      // Step 3: Try to collect voucher (should fail)
      await request(app.getHttpServer())
        .post(`/vouchers/${testVoucherId}/collect`)
        .set('Authorization', `Bearer ${userAccessToken}`)
        .expect(400)

      // Step 4: Can still create order without voucher
      const cartItem = await addToCart(testSKUId, 1)
      const createOrderResponse = await request(app.getHttpServer())
        .post('/orders')
        .set('Authorization', `Bearer ${userAccessToken}`)
        .send([
          {
            shopId: testShopId,
            receiver: {
              name: 'John Doe',
              phone: '0123456789',
              address: '123 Test Street, Test City',
            },
            cartItemIds: [cartItem],
          },
        ])
        .expect(201)

      // NOTE: totalAmount is not in OrderSchema response, removed assertion
      expect(createOrderResponse.body.orders[0].id).toBeDefined()
    })

    it('should handle workflow when user tries to use voucher twice', async () => {
      // Step 1: Complete first order with voucher
      const cartItem1 = await addToCart(testSKUId, 2)

      await request(app.getHttpServer())
        .post(`/vouchers/${testVoucherId}/collect`)
        .set('Authorization', `Bearer ${userAccessToken}`)
        .expect(201)

      await request(app.getHttpServer())
        .post('/orders')
        .set('Authorization', `Bearer ${userAccessToken}`)
        .send([
          {
            shopId: testShopId,
            receiver: {
              name: 'John Doe',
              phone: '0123456789',
              address: '123 Test Street, Test City',
            },
            cartItemIds: [cartItem1],
          },
        ])
        .expect(201)

      // Step 2: Try to collect same voucher again (should fail)
      await request(app.getHttpServer())
        .post(`/vouchers/${testVoucherId}/collect`)
        .set('Authorization', `Bearer ${userAccessToken}`)
        .expect(400)

      // Step 3: Can still create second order without voucher
      const cartItem2 = await addToCart(testSKUId, 1)
      const secondOrderResponse = await request(app.getHttpServer())
        .post('/orders')
        .set('Authorization', `Bearer ${userAccessToken}`)
        .send([
          {
            shopId: testShopId,
            receiver: {
              name: 'John Doe',
              phone: '0123456789',
              address: '123 Test Street, Test City',
            },
            cartItemIds: [cartItem2],
          },
        ])
        .expect(201)

      // NOTE: totalAmount is not in OrderSchema response, removed assertion
      expect(secondOrderResponse.body.orders[0].id).toBeDefined()
    })

    it('should handle cart abandonment and voucher expiry scenarios', async () => {
      // Step 1: Add items to cart and collect voucher
      await addToCart(testSKUId, 2)

      await request(app.getHttpServer())
        .post(`/vouchers/${testVoucherId}/collect`)
        .set('Authorization', `Bearer ${userAccessToken}`)
        .expect(201)

      // Step 2: Clear cart (simulate abandonment)
      const cartResponse = await request(app.getHttpServer())
        .get('/cart')
        .set('Authorization', `Bearer ${userAccessToken}`)
        .expect(200)

      const cartItemIds = cartResponse.body.data.flatMap((shop: any) => shop.cartItems.map((item: any) => item.id))

      await request(app.getHttpServer())
        .post('/cart/delete')
        .set('Authorization', `Bearer ${userAccessToken}`)
        .send({ cartItemIds })
        .expect(201) // POST endpoint returns 201 Created, not 200

      // Step 3: Verify voucher is still collected but unused
      const myVouchersResponse = await request(app.getHttpServer())
        .get('/vouchers/my')
        .set('Authorization', `Bearer ${userAccessToken}`)
        .expect(200)

      expect(myVouchersResponse.body.data).toHaveLength(1)
      expect(myVouchersResponse.body.data[0].usedCount).toBe(0)

      // Step 4: Add new items and use voucher later
      const newCartItem = await addToCart(testSKUId, 2)

      const applyVoucherResponse = await request(app.getHttpServer())
        .post('/vouchers/apply')
        .set('Authorization', `Bearer ${userAccessToken}`)
        .send({
          code: 'SAVE20',
          orderAmount: 400000,
          productIds: [testProductId],
        })
        .expect(201)

      expect(applyVoucherResponse.body.data.canApply).toBe(true)
    })
  })

  describe('Cross-Module Data Consistency', () => {
    it('should maintain data consistency across Cart, Order, and Voucher modules', async () => {
      // Step 1: Initial state verification
      const initialSKU = await prisma.sKU.findUnique({ where: { id: testSKUId } })
      const initialStock = initialSKU!.stock

      const initialVoucher = await prisma.voucher.findUnique({ where: { id: testVoucherId } })
      const initialUsedCount = initialVoucher!.usedCount

      // Step 2: Complete workflow
      const cartItem = await addToCart(testSKUId, 3)

      await request(app.getHttpServer())
        .post(`/vouchers/${testVoucherId}/collect`)
        .set('Authorization', `Bearer ${userAccessToken}`)
        .expect(201)

      const createOrderResponse = await request(app.getHttpServer())
        .post('/orders')
        .set('Authorization', `Bearer ${userAccessToken}`)
        .send([
          {
            shopId: testShopId,
            receiver: {
              name: 'John Doe',
              phone: '0123456789',
              address: '123 Test Street, Test City',
            },
            cartItemIds: [cartItem],
          },
        ])
        .expect(201)

      // Step 3: Verify data consistency
      // Cart should be empty
      const cartResponse = await request(app.getHttpServer())
        .get('/cart')
        .set('Authorization', `Bearer ${userAccessToken}`)
        .expect(200)
      expect(cartResponse.body.totalItems).toBe(0)

      // Stock should be reduced
      const updatedSKU = await prisma.sKU.findUnique({ where: { id: testSKUId } })
      expect(updatedSKU!.stock).toBe(initialStock - 3)

      // Order should exist with correct details
      const orderId = createOrderResponse.body.orders[0].id
      const orderInDB = await prisma.order.findUnique({
        where: { id: orderId },
        include: { items: true },
      })
      expect(orderInDB).toBeTruthy()
      expect(orderInDB!.items).toHaveLength(1)
      expect(orderInDB!.items[0].quantity).toBe(3)

      // Payment should exist
      const payment = await prisma.payment.findUnique({
        where: { id: createOrderResponse.body.paymentId },
      })
      expect(payment).toBeTruthy()

      // User should have collected voucher
      const userVoucher = await prisma.userVoucher.findFirst({
        where: { userId: testUserId, voucherId: testVoucherId },
      })
      expect(userVoucher).toBeTruthy()
    })
  })
})
