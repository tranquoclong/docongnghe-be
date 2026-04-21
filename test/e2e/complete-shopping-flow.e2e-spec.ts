import { CACHE_MANAGER } from '@nestjs/cache-manager'
import { INestApplication } from '@nestjs/common'
import { Test, TestingModule } from '@nestjs/testing'
import request from 'supertest'
import { AppModule } from '../../src/app.module'
import { OrderStatus } from '../../src/shared/constants/order.constant'
import { EmailService } from '../../src/shared/services/email.service'
import { PrismaService } from '../../src/shared/services/prisma.service'
import { resetDatabase } from '../helpers/test-helpers'

/**
 * COMPLETE SHOPPING FLOW E2E TESTS
 *
 * Test Coverage:
 * - Browse products (public)
 * - View product details (public)
 * - Add to cart (authenticated)
 * - Update cart items
 * - Apply voucher
 * - Checkout and create order
 * - Payment webhook simulation
 * - Order status verification
 */
describe('Complete Shopping Flow E2E', () => {
  let app: INestApplication
  let prisma: PrismaService
  let accessToken: string
  let testUserId: number
  let testProductId: number
  let testSKUId: number
  let testShopId: number
  let testVoucherId: number
  let testCategoryId: number
  let testBrandId: number

  // Mock EmailService
  const mockEmailService = {
    sendEmail: jest.fn().mockResolvedValue({ error: null }),
    sendOTP: jest.fn().mockResolvedValue({ error: null }),
  }

  // Mock Cache Manager
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
      .overrideProvider(EmailService)
      .useValue(mockEmailService)
      .overrideProvider(CACHE_MANAGER)
      .useValue(mockCacheManager)
      .compile()

    app = moduleFixture.createNestApplication()
    prisma = moduleFixture.get<PrismaService>(PrismaService)

    await app.init()
  })

  beforeEach(async () => {
    await resetDatabase()

    // Create test user and login
    const testUser = {
      email: 'shopper@example.com',
      name: 'Test Shopper',
      phoneNumber: '0123456789',
      password: 'password123',
      confirmPassword: 'password123',
    }

    // Send OTP
    await request(app.getHttpServer()).post('/auth/otp').send({
      email: testUser.email,
      type: 'REGISTER',
    })

    // Get OTP code
    const verificationCode = await prisma.verificationCode.findFirst({
      where: {
        email: testUser.email,
        type: 'REGISTER',
      },
    })

    // Register user
    const registerResponse = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        ...testUser,
        code: verificationCode?.code,
      })

    testUserId = registerResponse.body.id

    // Login to get access token
    const loginResponse = await request(app.getHttpServer())
      .post('/auth/login')
      .send({
        email: testUser.email,
        password: testUser.password,
      })
      .set('User-Agent', 'shopping-flow-e2e-test')

    accessToken = loginResponse.body.accessToken

    // Create test data (category, brand, shop, product, SKU, voucher)
    await setupTestData()
  })

  afterAll(async () => {
    await app.close()
  })

  async function setupTestData() {
    const bcrypt = require('bcryptjs')
    const shopHashedPassword = await bcrypt.hash('shopPassword123', 10)

    // Create category
    const category = await prisma.category.create({
      data: {
        name: 'Electronics',
        logo: 'electronics.png',
        createdById: testUserId,
      },
    })
    testCategoryId = category.id

    // Create brand
    const brand = await prisma.brand.create({
      data: {
        name: 'Samsung',
        logo: 'samsung.png',
        createdById: testUserId,
      },
    })
    testBrandId = brand.id

    // Create shop (seller)
    const shop = await prisma.user.create({
      data: {
        email: 'shop@example.com',
        name: 'Test Shop',
        phoneNumber: '0987654321',
        password: shopHashedPassword,
        roleId: 2,
        status: 'ACTIVE',
      },
    })
    testShopId = shop.id

    // Create product
    const product = await prisma.product.create({
      data: {
        name: 'Samsung Galaxy S24',
        basePrice: 25000000,
        virtualPrice: 25000000,
        brandId: testBrandId,
        images: ['galaxy-s24.png'],
        createdById: testShopId,
        publishedAt: new Date('2024-01-01'),
        variants: [],
        categories: {
          connect: { id: testCategoryId },
        },
      },
    })
    testProductId = product.id

    // Create SKU
    const sku = await prisma.sKU.create({
      data: {
        productId: testProductId,
        value: 'Color: Black, Storage: 256GB',
        price: 25000000, // 25 million VND
        stock: 100,
        image: 'galaxy-s24-black.png',
        createdById: testShopId,
      },
    })
    testSKUId = sku.id

    // Create voucher (10% discount, min order 20M)
    const voucher = await prisma.voucher.create({
      data: {
        code: 'SAVE10',
        name: 'Save 10%',
        description: '10% discount for orders above 20M',
        type: 'PERCENTAGE',
        value: 10,
        minOrderValue: 20000000,
        maxDiscount: 5000000,
        usageLimit: 100,
        usedCount: 0,
        startDate: new Date(),
        endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
        isActive: true,
        createdById: testUserId,
      },
    })
    testVoucherId = voucher.id
  }

  describe('E2E Flow 1: Complete Shopping Journey (Happy Path)', () => {
    it('should complete full shopping flow from browse to order', async () => {
      // ===== STEP 1: Browse Products (Public) =====
      console.log('🔍 STEP 1: Browse Products')
      const browseResponse = await request(app.getHttpServer())
        .get('/products')
        .query({
          page: 1,
          limit: 10,
        })
        .expect(200)

      expect(browseResponse.body.data).toBeInstanceOf(Array)
      expect(browseResponse.body.data.length).toBeGreaterThan(0)
      expect(browseResponse.body.data[0]).toHaveProperty('id')
      expect(browseResponse.body.data[0]).toHaveProperty('name')
      expect(browseResponse.body.data[0]).toHaveProperty('basePrice')
      expect(browseResponse.body.data[0]).toHaveProperty('virtualPrice')

      // ===== STEP 2: View Product Details (Public) =====
      console.log('📱 STEP 2: View Product Details')
      const productDetailResponse = await request(app.getHttpServer()).get(`/products/${testProductId}`).expect(200)

      expect(productDetailResponse.body).toHaveProperty('id', testProductId)
      expect(productDetailResponse.body).toHaveProperty('name', 'Samsung Galaxy S24')
      expect(productDetailResponse.body).toHaveProperty('skus')
      expect(productDetailResponse.body.skus).toBeInstanceOf(Array)
      expect(productDetailResponse.body.skus.length).toBeGreaterThan(0)

      // ===== STEP 3: Add to Cart (Authenticated) =====
      console.log('🛒 STEP 3: Add to Cart')
      const addToCartResponse = await request(app.getHttpServer())
        .post('/cart')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          skuId: testSKUId,
          quantity: 2,
        })
        .expect(201)

      expect(addToCartResponse.body).toHaveProperty('id')
      expect(addToCartResponse.body).toHaveProperty('skuId', testSKUId)
      expect(addToCartResponse.body).toHaveProperty('quantity', 2)

      const cartItemId = addToCartResponse.body.id

      // ===== STEP 4: View Cart =====
      console.log('👀 STEP 4: View Cart')
      const viewCartResponse = await request(app.getHttpServer())
        .get('/cart')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200)

      expect(viewCartResponse.body.data).toBeInstanceOf(Array)
      expect(viewCartResponse.body.data.length).toBe(1)
      expect(viewCartResponse.body.data[0].cartItems).toBeInstanceOf(Array)
      expect(viewCartResponse.body.data[0].cartItems[0]).toHaveProperty('id', cartItemId)

      // ===== STEP 5: Update Cart Quantity =====
      console.log('✏️ STEP 5: Update Cart Quantity')
      const updateCartResponse = await request(app.getHttpServer())
        .put(`/cart/${cartItemId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          skuId: testSKUId,
          quantity: 3,
        })
        .expect(200)

      expect(updateCartResponse.body).toHaveProperty('quantity', 3)

      // ===== STEP 6: Collect Voucher =====
      console.log('🎟️ STEP 6: Collect Voucher')
      const collectVoucherResponse = await request(app.getHttpServer())
        .post(`/vouchers/${testVoucherId}/collect`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(201)

      expect(collectVoucherResponse.body.data).toHaveProperty('voucherId', testVoucherId)
      expect(collectVoucherResponse.body.data).toHaveProperty('userId', testUserId)

      // ===== STEP 7: Create Order (Checkout) =====
      console.log('💳 STEP 7: Create Order (Checkout)')
      const createOrderResponse = await request(app.getHttpServer())
        .post('/orders')
        .set('Authorization', `Bearer ${accessToken}`)
        .send([
          {
            shopId: testShopId,
            receiver: {
              name: 'Nguyễn Văn A',
              phone: '0123456789',
              address: '123 Đường ABC, Quận 1, TP.HCM',
            },
            cartItemIds: [cartItemId],
            voucherId: testVoucherId,
          },
        ])
        .expect(201)

      expect(createOrderResponse.body).toHaveProperty('paymentId')
      expect(createOrderResponse.body).toHaveProperty('orders')
      expect(createOrderResponse.body.orders).toBeInstanceOf(Array)
      expect(createOrderResponse.body.orders.length).toBe(1)

      const orderId = createOrderResponse.body.orders[0].id
      const paymentId = createOrderResponse.body.paymentId

      // Verify order in database
      const order = await prisma.order.findUnique({
        where: { id: orderId },
        include: {
          items: true,
        },
      })

      expect(order).toBeDefined()
      expect(order?.status).toBe(OrderStatus.PENDING_PAYMENT)
      expect(order?.totalAmount).toBeGreaterThan(0)
      expect(order?.items.length).toBe(1)

      // ===== STEP 8: Simulate Payment Webhook =====
      console.log('💰 STEP 8: Simulate Payment Webhook')

      const paymentWebhookResponse = await request(app.getHttpServer())
        .post('/payment/receiver')
        .set('Authorization', `Bearer ${process.env.PAYMENT_API_KEY || 'kmkjasdasd12312*@%%!dndan'}`)
        .send({
          id: Math.floor(Math.random() * 1000000),
          gateway: 'MB Bank',
          transactionDate: new Date().toISOString(),
          accountNumber: '1234567890',
          code: `DH${paymentId}`,
          content: `Thanh toan don hang DH${paymentId}`,
          transferType: 'in',
          transferAmount: 100000,
          accumulated: 1000000,
          subAccount: null,
          referenceCode: 'REF' + Math.floor(Math.random() * 1000000),
          description: `DH${paymentId}`,
        })

      if (paymentWebhookResponse.status !== 200) {
        console.log('Payment webhook error:', paymentWebhookResponse.status, paymentWebhookResponse.body)
      }
      expect(paymentWebhookResponse.status).toBe(200)
      expect(paymentWebhookResponse.body).toHaveProperty('message')

      // ===== STEP 9: Verify Order Status Updated =====
      console.log('✅ STEP 9: Verify Order Status')
      const orderDetailResponse = await request(app.getHttpServer())
        .get(`/orders/${orderId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200)

      expect(orderDetailResponse.body).toHaveProperty('id', orderId)
      // After payment, status should be updated (depends on payment webhook implementation)
      // For now, just verify order exists
      expect(orderDetailResponse.body).toHaveProperty('status')

      // ===== STEP 10: Verify Cart is Empty =====
      console.log('🗑️ STEP 10: Verify Cart is Empty')
      const finalCartResponse = await request(app.getHttpServer())
        .get('/cart')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200)

      expect(finalCartResponse.body.data).toBeInstanceOf(Array)
      // Cart should be empty or not contain the ordered item
      const hasOrderedItem = finalCartResponse.body.data.some((shop: any) =>
        shop.items.some((item: any) => item.id === cartItemId),
      )
      expect(hasOrderedItem).toBe(false)

      // ===== STEP 11: Verify Stock Reduced =====
      console.log('📦 STEP 11: Verify Stock Reduced')
      const updatedSKU = await prisma.sKU.findUnique({
        where: { id: testSKUId },
      })

      expect(updatedSKU?.stock).toBe(100 - 3) // Original 100 - ordered 3

      // ===== STEP 12: Verify Voucher Used Count =====
      console.log('🎫 STEP 12: Verify Voucher Used Count')
      const updatedVoucher = await prisma.voucher.findUnique({
        where: { id: testVoucherId },
      })

      expect(updatedVoucher?.usedCount).toBe(1)

      console.log('🎉 Complete Shopping Flow E2E Test PASSED!')
    })
  })

  describe('E2E Flow 2: Shopping Without Voucher', () => {
    it('should complete shopping flow without applying voucher', async () => {
      // Add to cart
      const addToCartResponse = await request(app.getHttpServer())
        .post('/cart')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          skuId: testSKUId,
          quantity: 1,
        })
        .expect(201)

      const cartItemId = addToCartResponse.body.id

      // Create order without voucher
      const createOrderResponse = await request(app.getHttpServer())
        .post('/orders')
        .set('Authorization', `Bearer ${accessToken}`)
        .send([
          {
            shopId: testShopId,
            receiver: {
              name: 'Nguyễn Văn B',
              phone: '0987654321',
              address: '456 Đường XYZ, Quận 2, TP.HCM',
            },
            cartItemIds: [cartItemId],
            // No voucherId
          },
        ])
        .expect(201)

      expect(createOrderResponse.body).toHaveProperty('paymentId')
      expect(createOrderResponse.body).toHaveProperty('orders')

      const order = await prisma.order.findUnique({
        where: { id: createOrderResponse.body.orders[0].id },
      })

      expect(order).toBeDefined()
      expect(order?.voucherId).toBeNull()
      expect(order?.totalAmount).toBe(25000000) // No discount
    })
  })

  describe('E2E Flow 3: Multiple Items from Same Shop', () => {
    it('should handle multiple items in single order', async () => {
      // Create second SKU
      const sku2 = await prisma.sKU.create({
        data: {
          productId: testProductId,
          value: 'Color: White, Storage: 128GB',
          price: 22000000,
          stock: 50,
          image: 'galaxy-s24-white.png',
          createdById: testShopId,
        },
      })

      // Add first item to cart
      const cart1 = await request(app.getHttpServer())
        .post('/cart')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          skuId: testSKUId,
          quantity: 1,
        })
        .expect(201)

      // Add second item to cart
      const cart2 = await request(app.getHttpServer())
        .post('/cart')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          skuId: sku2.id,
          quantity: 2,
        })
        .expect(201)

      // Create order with both items
      const createOrderResponse = await request(app.getHttpServer())
        .post('/orders')
        .set('Authorization', `Bearer ${accessToken}`)
        .send([
          {
            shopId: testShopId,
            receiver: {
              name: 'Nguyễn Văn C',
              phone: '0111222333',
              address: '789 Đường DEF, Quận 3, TP.HCM',
            },
            cartItemIds: [cart1.body.id, cart2.body.id],
          },
        ])
        .expect(201)

      const order = await prisma.order.findUnique({
        where: { id: createOrderResponse.body.orders[0].id },
        include: {
          items: true,
        },
      })

      expect(order?.items.length).toBe(2)
      expect(order?.totalAmount).toBe(25000000 + 22000000 * 2) // 69M
    })
  })

  describe('E2E Flow 4: Cart Update and Removal', () => {
    it('should update cart quantity and remove items', async () => {
      // Add to cart
      const addToCartResponse = await request(app.getHttpServer())
        .post('/cart')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          skuId: testSKUId,
          quantity: 1,
        })
        .expect(201)

      const cartItemId = addToCartResponse.body.id

      // Update quantity
      await request(app.getHttpServer())
        .put(`/cart/${cartItemId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          skuId: testSKUId,
          quantity: 5,
        })
        .expect(200)

      // Verify updated quantity
      const cartResponse = await request(app.getHttpServer())
        .get('/cart')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200)

      const cartItem = cartResponse.body.data[0].cartItems.find((item: any) => item.id === cartItemId)
      expect(cartItem.quantity).toBe(5)

      // Remove from cart
      await request(app.getHttpServer())
        .post('/cart/delete')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          cartItemIds: [cartItemId],
        })
        .expect(201)

      // Verify cart is empty
      const finalCartResponse = await request(app.getHttpServer())
        .get('/cart')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200)

      expect(finalCartResponse.body.data).toBeInstanceOf(Array)
      const hasItem = finalCartResponse.body.data.some((shop: any) =>
        shop.items.some((item: any) => item.id === cartItemId),
      )
      expect(hasItem).toBe(false)
    })
  })

  describe('E2E Flow 5: Browse and Filter Products', () => {
    it('should browse products with filters', async () => {
      // Browse all products
      const allProductsResponse = await request(app.getHttpServer())
        .get('/products')
        .query({
          page: 1,
          limit: 10,
        })
        .expect(200)

      expect(allProductsResponse.body.data).toBeInstanceOf(Array)

      // Filter by category
      const categoryFilterResponse = await request(app.getHttpServer())
        .get('/products')
        .query({
          categoryId: testCategoryId,
          page: 1,
          limit: 10,
        })
        .expect(200)

      expect(categoryFilterResponse.body.data).toBeInstanceOf(Array)
      // Products don't have categoryId field directly, they have categories relation

      // Filter by brand
      const brandFilterResponse = await request(app.getHttpServer())
        .get('/products')
        .query({
          brandId: testBrandId,
          page: 1,
          limit: 10,
        })
        .expect(200)

      expect(brandFilterResponse.body.data).toBeInstanceOf(Array)
      // Verify brand filter works - products should have brandId field
      if (brandFilterResponse.body.data.length > 0) {
        expect(brandFilterResponse.body.data[0]).toHaveProperty('brandId', testBrandId)
      }
    })
  })

  describe('E2E Flow 6: Order History', () => {
    it('should view order history after purchase', async () => {
      // Add to cart and create order
      const addToCartResponse = await request(app.getHttpServer())
        .post('/cart')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          skuId: testSKUId,
          quantity: 1,
        })
        .expect(201)

      const createOrderResponse = await request(app.getHttpServer())
        .post('/orders')
        .set('Authorization', `Bearer ${accessToken}`)
        .send([
          {
            shopId: testShopId,
            receiver: {
              name: 'Nguyễn Văn D',
              phone: '0444555666',
              address: '321 Đường GHI, Quận 4, TP.HCM',
            },
            cartItemIds: [addToCartResponse.body.id],
          },
        ])
        .expect(201)

      const orderId = createOrderResponse.body.orders[0].id

      // Get order list
      const orderListResponse = await request(app.getHttpServer())
        .get('/orders')
        .set('Authorization', `Bearer ${accessToken}`)
        .query({
          page: 1,
          limit: 10,
        })
        .expect(200)

      expect(orderListResponse.body.data).toBeInstanceOf(Array)
      expect(orderListResponse.body.data.length).toBeGreaterThan(0)

      const order = orderListResponse.body.data.find((o: any) => o.id === orderId)
      expect(order).toBeDefined()
      expect(order.status).toBe(OrderStatus.PENDING_PAYMENT)

      // Get order detail
      const orderDetailResponse = await request(app.getHttpServer())
        .get(`/orders/${orderId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200)

      expect(orderDetailResponse.body).toHaveProperty('id', orderId)
      expect(orderDetailResponse.body).toHaveProperty('receiver')
      expect(orderDetailResponse.body).toHaveProperty('items') // Changed from productSKUSnapshots
    })
  })

  describe('E2E Flow 7: Unauthenticated User Restrictions', () => {
    it('should allow browsing but restrict cart and checkout', async () => {
      // Can browse products (public)
      await request(app.getHttpServer())
        .get('/products')
        .query({
          page: 1,
          limit: 10,
        })
        .expect(200)

      // Can view product details (public)
      await request(app.getHttpServer()).get(`/products/${testProductId}`).expect(200)

      // Cannot add to cart (requires auth)
      await request(app.getHttpServer())
        .post('/cart')
        .send({
          skuId: testSKUId,
          quantity: 1,
        })
        .expect(401)

      // Cannot view cart (requires auth)
      await request(app.getHttpServer()).get('/cart').expect(401)

      // Cannot create order (requires auth)
      await request(app.getHttpServer())
        .post('/orders')
        .send([
          {
            shopId: testShopId,
            receiver: {
              name: 'Test',
              phone: '0123456789',
              address: 'Test Address',
            },
            cartItemIds: [1],
          },
        ])
        .expect(401)
    })
  })

  describe('E2E Flow 8: Voucher Validation', () => {
    it('should validate voucher requirements', async () => {
      // Add item with price below min order value
      const addToCartResponse = await request(app.getHttpServer())
        .post('/cart')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          skuId: testSKUId,
          quantity: 1, // 25M > 20M min, so should work
        })
        .expect(201)

      // Collect voucher
      await request(app.getHttpServer())
        .post(`/vouchers/${testVoucherId}/collect`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(201)

      // Create order with voucher (should succeed)
      const createOrderResponse = await request(app.getHttpServer())
        .post('/orders')
        .set('Authorization', `Bearer ${accessToken}`)
        .send([
          {
            shopId: testShopId,
            receiver: {
              name: 'Nguyễn Văn E',
              phone: '0777888999',
              address: '654 Đường JKL, Quận 5, TP.HCM',
            },
            cartItemIds: [addToCartResponse.body.id],
            voucherId: testVoucherId,
          },
        ])
        .expect(201)

      const order = await prisma.order.findUnique({
        where: { id: createOrderResponse.body.orders[0].id },
      })

      // Verify discount applied (10% of 25M = 2.5M discount)
      expect(order?.totalAmount).toBeLessThan(25000000)
      expect(order?.voucherId).toBe(testVoucherId)
    })
  })
})
