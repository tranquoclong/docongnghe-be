import { CACHE_MANAGER } from '@nestjs/cache-manager'
import { INestApplication } from '@nestjs/common'
import { Test, TestingModule } from '@nestjs/testing'
import request from 'supertest'
import { AppModule } from '../../src/app.module'
import { OrderStatus } from '../../src/shared/constants/order.constant'
import { EmailService } from '../../src/shared/services/email.service'
import { PrismaService } from '../../src/shared/services/prisma.service'
import { resetDatabase } from '../helpers/test-helpers'

// Mock EmailService to avoid React Email rendering errors
const mockEmailService = {
  sendEmail: jest.fn().mockResolvedValue(undefined),
  sendOTP: jest.fn().mockResolvedValue(undefined),
}

// Mock CACHE_MANAGER to return null (forces database permission lookup)
const mockCacheManager = {
  get: jest.fn().mockResolvedValue(null),
  set: jest.fn().mockResolvedValue(undefined),
  del: jest.fn().mockResolvedValue(undefined),
  reset: jest.fn().mockResolvedValue(undefined),
}

describe('Order Integration Tests', () => {
  let app: INestApplication
  let prisma: PrismaService
  let accessToken: string
  let testUserId: number
  let testSKUId: number
  let testShopId: number

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

    // Tạo test user và login để lấy access token
    const testUser = {
      email: 'order-test@example.com',
      name: 'Order Test User',
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
      .set('User-Agent', 'order-test-agent')

    accessToken = loginResponse.body.accessToken

    // Tạo test data
    await setupTestData()
  })

  afterAll(async () => {
    await app.close()
  })

  async function setupTestData() {
    // Tạo category
    const category = await prisma.category.create({
      data: {
        name: 'Test Category',
        logo: 'test-logo.png',
        createdById: testUserId,
      },
    })

    // Tạo brand
    const brand = await prisma.brand.create({
      data: {
        name: 'Test Brand',
        logo: 'test-brand.png',
        createdById: testUserId,
      },
    })

    // Tạo shop (seller user)
    const seller = await prisma.user.create({
      data: {
        email: 'seller@test.com',
        name: 'Test Seller',
        phoneNumber: '0987654321',
        password: '$2b$10$hashedPasswordExample',
        roleId: 2, // CLIENT role (same as buyer)
        status: 'ACTIVE',
      },
    })

    testShopId = seller.id

    // Tạo product (created by seller, not testUserId)
    const product = await prisma.product.create({
      data: {
        name: 'Test Product',
        brandId: brand.id,
        images: ['test-product.png'],
        basePrice: 100000,
        virtualPrice: 100000,
        variants: [],
        publishedAt: new Date(),
        createdById: seller.id, // Product created by seller
        categories: {
          connect: { id: category.id },
        },
      },
    })

    // Tạo SKU (created by seller, not testUserId)
    const sku = await prisma.sKU.create({
      data: {
        productId: product.id,
        value: 'Size: M, Color: Blue',
        price: 100000,
        stock: 50,
        image: 'test-sku.png',
        createdById: seller.id, // SKU created by seller
      },
    })

    testSKUId = sku.id
  }

  async function createCartItem(skuId: number = testSKUId, quantity: number = 2) {
    const response = await request(app.getHttpServer())
      .post('/cart')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        skuId,
        quantity,
      })
      .expect(201)

    return response.body.id
  }

  describe('Order Creation Flow', () => {
    it('should create order from cart items successfully', async () => {
      // STEP 1: Create another SKU for the same shop to avoid unique constraint
      const product2 = await prisma.product.create({
        data: {
          name: 'Test Product 2',
          brandId: (await prisma.brand.findFirst())!.id,
          images: ['test-product-2.png'],
          basePrice: 100000,
          virtualPrice: 100000,
          variants: [],
          publishedAt: new Date(),
          createdById: testShopId, // Use testShopId instead of seller.id
          categories: {
            connect: { id: (await prisma.category.findFirst())!.id },
          },
        },
      })

      const sku2 = await prisma.sKU.create({
        data: {
          productId: product2.id,
          value: 'Size: L, Color: Red',
          price: 100000,
          stock: 50,
          image: 'test-sku-2.png',
          createdById: testShopId, // Use testShopId instead of seller.id
        },
      })

      // STEP 2: Add items to cart (different SKUs to avoid unique constraint)
      const cartItemId1 = await createCartItem(testSKUId, 2)
      const cartItemId2 = await createCartItem(sku2.id, 3)

      // STEP 3: Create order from cart items
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
            cartItemIds: [cartItemId1, cartItemId2],
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
            receiver: {
              name: 'Nguyễn Văn A',
              phone: '0123456789',
              address: '123 Đường ABC, Quận 1, TP.HCM',
            },
          }),
        ]),
      })

      const orderId = createOrderResponse.body.orders[0].id

      // STEP 4: Verify order was created and cart items were removed
      const cartResponse = await request(app.getHttpServer())
        .get('/cart')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200)

      expect(cartResponse.body.totalItems).toBe(0)

      // STEP 4: Get order details
      const orderDetailResponse = await request(app.getHttpServer())
        .get(`/orders/${orderId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200)

      expect(orderDetailResponse.body).toMatchObject({
        id: orderId,
        userId: testUserId,
        shopId: testShopId,
        status: OrderStatus.PENDING_PAYMENT,
        items: expect.arrayContaining([
          expect.objectContaining({
            skuId: testSKUId,
            quantity: expect.any(Number),
            skuPrice: 100000,
          }),
        ]),
      })

      // Verify total quantity is correct (2 + 3 = 5)
      const totalQuantity = orderDetailResponse.body.items.reduce((sum: number, item: any) => sum + item.quantity, 0)
      expect(totalQuantity).toBe(5)
    })

    it('should create multiple orders for different shops', async () => {
      // Tạo shop thứ 2
      const seller2 = await prisma.user.create({
        data: {
          email: 'seller2@test.com',
          name: 'Test Seller 2',
          phoneNumber: '0888888888',
          password: '$2b$10$hashedPasswordExample',
          roleId: 2,
          status: 'ACTIVE',
        },
      })

      const product2 = await prisma.product.create({
        data: {
          name: 'Test Product 2',
          brandId: (await prisma.brand.findFirst())!.id,
          images: ['test-product-2.png'],
          basePrice: 150000,
          virtualPrice: 150000,
          variants: [],
          publishedAt: new Date(),
          createdById: seller2.id, // Product created by seller2
          categories: {
            connect: { id: (await prisma.category.findFirst())!.id },
          },
        },
      })

      const sku2 = await prisma.sKU.create({
        data: {
          productId: product2.id,
          value: 'Size: L, Color: Red',
          price: 150000,
          stock: 30,
          image: 'test-sku-2.png',
          createdById: seller2.id, // SKU created by seller2
        },
      })

      // Add items to cart from both shops
      const cartItem1 = await createCartItem(testSKUId, 2) // Shop 1
      const cartItem2 = await createCartItem(sku2.id, 1) // Shop 2

      // Create orders for both shops
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
            cartItemIds: [cartItem1],
          },
          {
            shopId: seller2.id,
            receiver: {
              name: 'Nguyễn Văn A',
              phone: '0123456789',
              address: '123 Đường ABC, Quận 1, TP.HCM',
            },
            cartItemIds: [cartItem2],
          },
        ])
        .expect(201)

      expect(createOrderResponse.body.orders).toHaveLength(2)
      expect(createOrderResponse.body.orders[0].shopId).toBe(testShopId)
      expect(createOrderResponse.body.orders[1].shopId).toBe(seller2.id)
      expect(createOrderResponse.body.paymentId).toBeDefined()
    })

    it('should validate receiver information', async () => {
      const cartItemId = await createCartItem()

      // Test missing receiver name
      await request(app.getHttpServer())
        .post('/orders')
        .set('Authorization', `Bearer ${accessToken}`)
        .send([
          {
            shopId: testShopId,
            receiver: {
              phone: '0123456789',
              address: '123 Đường ABC, Quận 1, TP.HCM',
            },
            cartItemIds: [cartItemId],
          },
        ])
        .expect(422)

      // Test invalid phone number
      await request(app.getHttpServer())
        .post('/orders')
        .set('Authorization', `Bearer ${accessToken}`)
        .send([
          {
            shopId: testShopId,
            receiver: {
              name: 'Nguyễn Văn A',
              phone: '123', // Invalid phone
              address: '123 Đường ABC, Quận 1, TP.HCM',
            },
            cartItemIds: [cartItemId],
          },
        ])
        .expect(422)

      // Test missing address
      await request(app.getHttpServer())
        .post('/orders')
        .set('Authorization', `Bearer ${accessToken}`)
        .send([
          {
            shopId: testShopId,
            receiver: {
              name: 'Nguyễn Văn A',
              phone: '0123456789',
            },
            cartItemIds: [cartItemId],
          },
        ])
        .expect(422)
    })
  })

  describe('Order Management Flow', () => {
    let testOrderId: number

    beforeEach(async () => {
      // Tạo order cho các test
      const cartItemId = await createCartItem()

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
          },
        ])
        .expect(201)

      testOrderId = createOrderResponse.body.orders[0].id
    })

    it('should get order list successfully', async () => {
      const response = await request(app.getHttpServer())
        .get('/orders')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200)

      expect(response.body).toMatchObject({
        data: expect.arrayContaining([
          expect.objectContaining({
            id: testOrderId,
            userId: testUserId,
            shopId: testShopId,
            status: OrderStatus.PENDING_PAYMENT,
          }),
        ]),
        page: 1,
        limit: 10,
        totalItems: 1,
        totalPages: 1,
      })
    })

    it('should filter orders by status', async () => {
      // Get pending orders
      const pendingResponse = await request(app.getHttpServer())
        .get(`/orders?status=${OrderStatus.PENDING_PAYMENT}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200)

      expect(pendingResponse.body.data).toHaveLength(1)
      expect(pendingResponse.body.data[0].status).toBe(OrderStatus.PENDING_PAYMENT)

      // Get cancelled orders (should be empty)
      const cancelledResponse = await request(app.getHttpServer())
        .get(`/orders?status=${OrderStatus.CANCELLED}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200)

      expect(cancelledResponse.body.data).toHaveLength(0)
    })

    it('should handle order pagination', async () => {
      // Tạo thêm nhiều orders
      for (let i = 0; i < 15; i++) {
        const cartItemId = await createCartItem()
        await request(app.getHttpServer())
          .post('/orders')
          .set('Authorization', `Bearer ${accessToken}`)
          .send([
            {
              shopId: testShopId,
              receiver: {
                name: `User ${i}`,
                phone: '0123456789',
                address: `Address ${i}`,
              },
              cartItemIds: [cartItemId],
            },
          ])
          .expect(201)
      }

      // Test page 1
      const page1Response = await request(app.getHttpServer())
        .get('/orders?page=1&limit=10')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200)

      expect(page1Response.body.page).toBe(1)
      expect(page1Response.body.limit).toBe(10)
      expect(page1Response.body.data).toHaveLength(10)
      expect(page1Response.body.totalItems).toBe(16) // 1 from beforeEach + 15 from loop

      // Test page 2
      const page2Response = await request(app.getHttpServer())
        .get('/orders?page=2&limit=10')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200)

      expect(page2Response.body.page).toBe(2)
      expect(page2Response.body.data).toHaveLength(6) // Remaining items
    })

    it('should cancel order successfully', async () => {
      // Cancel order
      const cancelResponse = await request(app.getHttpServer())
        .put(`/orders/${testOrderId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({}) // Empty body for cancel
        .expect(200)

      expect(cancelResponse.body).toMatchObject({
        id: testOrderId,
        status: OrderStatus.CANCELLED,
      })

      // Verify order status in list
      const listResponse = await request(app.getHttpServer())
        .get('/orders')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200)

      const cancelledOrder = listResponse.body.data.find((order: any) => order.id === testOrderId)
      expect(cancelledOrder.status).toBe(OrderStatus.CANCELLED)

      // Verify order detail shows cancelled status
      const detailResponse = await request(app.getHttpServer())
        .get(`/orders/${testOrderId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200)

      expect(detailResponse.body.status).toBe(OrderStatus.CANCELLED)
    })

    it('should not allow cancelling already cancelled order', async () => {
      // Cancel order first time
      await request(app.getHttpServer())
        .put(`/orders/${testOrderId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({})
        .expect(200)

      // Try to cancel again
      await request(app.getHttpServer())
        .put(`/orders/${testOrderId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({})
        .expect(400) // Should reject
    })
  })

  describe('Order Detail Tests', () => {
    it('should get order detail with items', async () => {
      // Create another SKU for the same shop to avoid unique constraint
      const product2 = await prisma.product.create({
        data: {
          name: 'Test Product 2',
          brandId: (await prisma.brand.findFirst())!.id,
          images: ['test-product-2.png'],
          basePrice: 100000,
          virtualPrice: 100000,
          variants: [],
          publishedAt: new Date(),
          createdById: testShopId, // Use testShopId instead of seller.id
          categories: {
            connect: { id: (await prisma.category.findFirst())!.id },
          },
        },
      })

      const sku2 = await prisma.sKU.create({
        data: {
          productId: product2.id,
          value: 'Size: L, Color: Red',
          price: 100000,
          stock: 50,
          image: 'test-sku-2.png',
          createdById: testShopId, // Use testShopId instead of seller.id
        },
      })

      // Tạo order với multiple items (different SKUs to avoid unique constraint)
      const cartItem1 = await createCartItem(testSKUId, 2)
      const cartItem2 = await createCartItem(sku2.id, 3)

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
            cartItemIds: [cartItem1, cartItem2],
          },
        ])
        .expect(201)

      const orderId = createOrderResponse.body.orders[0].id

      // Get order detail
      const detailResponse = await request(app.getHttpServer())
        .get(`/orders/${orderId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200)

      expect(detailResponse.body).toMatchObject({
        id: orderId,
        userId: testUserId,
        shopId: testShopId,
        status: OrderStatus.PENDING_PAYMENT,
        receiver: {
          name: 'Nguyễn Văn A',
          phone: '0123456789',
          address: '123 Đường ABC, Quận 1, TP.HCM',
        },
        items: expect.any(Array),
      })

      expect(detailResponse.body.items.length).toBeGreaterThan(0)

      // Verify item details
      const firstItem = detailResponse.body.items[0]
      expect(firstItem).toMatchObject({
        skuId: testSKUId,
        quantity: expect.any(Number),
        skuPrice: 100000,
        productName: 'Test Product',
        skuValue: 'Size: M, Color: Blue',
      })
    })

    it('should return 404 for non-existent order', async () => {
      await request(app.getHttpServer()).get('/orders/99999').set('Authorization', `Bearer ${accessToken}`).expect(404)
    })

    it("should not allow access to other users' orders", async () => {
      // Tạo user thứ 2
      const testUser2 = {
        email: 'order-test-2@example.com',
        name: 'Order Test User 2',
        phoneNumber: '0987654321',
        password: 'password123',
        confirmPassword: 'password123',
      }

      await request(app.getHttpServer()).post('/auth/otp').send({
        email: testUser2.email,
        type: 'REGISTER',
      })

      const verificationCode2 = await prisma.verificationCode.findFirst({
        where: {
          email: testUser2.email,
          type: 'REGISTER',
        },
      })

      await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          ...testUser2,
          code: verificationCode2?.code,
        })

      const loginResponse2 = await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          email: testUser2.email,
          password: testUser2.password,
        })
        .set('User-Agent', 'order-test-agent-2')

      const accessToken2 = loginResponse2.body.accessToken

      // User 1 creates order
      const cartItemId = await createCartItem()
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
          },
        ])
        .expect(201)

      const orderId = createOrderResponse.body.orders[0].id

      // User 2 should not see User 1's order in list
      const user2OrdersResponse = await request(app.getHttpServer())
        .get('/orders')
        .set('Authorization', `Bearer ${accessToken2}`)
        .expect(200)

      expect(user2OrdersResponse.body.data).toHaveLength(0)

      // User 2 should not access User 1's order detail
      await request(app.getHttpServer())
        .get(`/orders/${orderId}`)
        .set('Authorization', `Bearer ${accessToken2}`)
        .expect(404) // Or 403, depending on implementation
    })
  })

  describe('Order Validation Tests', () => {
    it('should require authentication for all order endpoints', async () => {
      // Test without authorization
      await request(app.getHttpServer()).get('/orders').expect(401)

      await request(app.getHttpServer()).post('/orders').send([]).expect(401)

      await request(app.getHttpServer()).get('/orders/1').expect(401)

      await request(app.getHttpServer()).put('/orders/1').send({}).expect(401)

      // Test with invalid token
      await request(app.getHttpServer()).get('/orders').set('Authorization', 'Bearer invalid-token').expect(401)
    })

    it('should validate create order request', async () => {
      // Empty array
      await request(app.getHttpServer())
        .post('/orders')
        .set('Authorization', `Bearer ${accessToken}`)
        .send([])
        .expect(422)

      // Missing shopId
      await request(app.getHttpServer())
        .post('/orders')
        .set('Authorization', `Bearer ${accessToken}`)
        .send([
          {
            receiver: {
              name: 'Test',
              phone: '0123456789',
              address: 'Test Address',
            },
            cartItemIds: [1],
          },
        ])
        .expect(422)

      // Empty cartItemIds
      await request(app.getHttpServer())
        .post('/orders')
        .set('Authorization', `Bearer ${accessToken}`)
        .send([
          {
            shopId: testShopId,
            receiver: {
              name: 'Test',
              phone: '0123456789',
              address: 'Test Address',
            },
            cartItemIds: [],
          },
        ])
        .expect(422)

      // Non-existent cart items
      await request(app.getHttpServer())
        .post('/orders')
        .set('Authorization', `Bearer ${accessToken}`)
        .send([
          {
            shopId: testShopId,
            receiver: {
              name: 'Test',
              phone: '0123456789',
              address: 'Test Address',
            },
            cartItemIds: [99999],
          },
        ])
        .expect(404)
    })
  })

  describe('Order Business Logic Tests', () => {
    it('should handle stock reduction when creating orders', async () => {
      // Check initial stock
      const initialSKU = await prisma.sKU.findUnique({
        where: { id: testSKUId },
      })
      const initialStock = initialSKU!.stock

      // Create order
      const cartItemId = await createCartItem(testSKUId, 5) // Order 5 items

      await request(app.getHttpServer())
        .post('/orders')
        .set('Authorization', `Bearer ${accessToken}`)
        .send([
          {
            shopId: testShopId,
            receiver: {
              name: 'Test',
              phone: '0123456789',
              address: 'Test Address',
            },
            cartItemIds: [cartItemId],
          },
        ])
        .expect(201)

      // Verify stock is reduced
      const updatedSKU = await prisma.sKU.findUnique({
        where: { id: testSKUId },
      })
      expect(updatedSKU!.stock).toBe(initialStock - 5)
    })

    it('should handle payment creation with orders', async () => {
      const cartItemId = await createCartItem(testSKUId, 2)

      const createOrderResponse = await request(app.getHttpServer())
        .post('/orders')
        .set('Authorization', `Bearer ${accessToken}`)
        .send([
          {
            shopId: testShopId,
            receiver: {
              name: 'Test',
              phone: '0123456789',
              address: 'Test Address',
            },
            cartItemIds: [cartItemId],
          },
        ])
        .expect(201)

      // Verify payment was created
      expect(createOrderResponse.body.paymentId).toBeDefined()

      // Verify payment exists in database
      const payment = await prisma.payment.findUnique({
        where: { id: createOrderResponse.body.paymentId },
      })
      expect(payment).toBeTruthy()
      expect(payment!.status).toBe('PENDING')
    })

    it('should handle order total calculation correctly', async () => {
      // Create cart items with different quantities and prices
      const cartItem1 = await createCartItem(testSKUId, 2) // 2 * 100000 = 200000

      // Create another SKU with different price (same shop to test total calculation)
      const product2 = await prisma.product.create({
        data: {
          name: 'Expensive Product',
          brandId: (await prisma.brand.findFirst())!.id,
          images: ['expensive.png'],
          basePrice: 500000,
          virtualPrice: 500000,
          variants: [],
          publishedAt: new Date(),
          createdById: testShopId, // Same shop as testSKUId - use testShopId instead of seller.id
          categories: {
            connect: { id: (await prisma.category.findFirst())!.id },
          },
        },
      })

      const expensiveSKU = await prisma.sKU.create({
        data: {
          productId: product2.id,
          value: 'Premium',
          price: 500000,
          stock: 10,
          image: 'premium.png',
          createdById: testShopId, // Same shop as testSKUId - use testShopId instead of seller.id
        },
      })

      const cartItem2 = await createCartItem(expensiveSKU.id, 1) // 1 * 500000 = 500000

      // Create order
      const createOrderResponse = await request(app.getHttpServer())
        .post('/orders')
        .set('Authorization', `Bearer ${accessToken}`)
        .send([
          {
            shopId: testShopId,
            receiver: {
              name: 'Test',
              phone: '0123456789',
              address: 'Test Address',
            },
            cartItemIds: [cartItem1, cartItem2],
          },
        ])
        .expect(201)

      const order = createOrderResponse.body.orders[0]

      // Verify order was created successfully
      expect(order).toMatchObject({
        id: expect.any(Number),
        userId: testUserId,
        shopId: testShopId,
        status: OrderStatus.PENDING_PAYMENT,
      })

      // Verify payment was created
      expect(typeof createOrderResponse.body.paymentId).toBe('number')

      // Get order details to verify items and calculate total
      const orderDetailResponse = await request(app.getHttpServer())
        .get(`/orders/${order.id}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200)

      // Calculate total from items
      const calculatedTotal = orderDetailResponse.body.items.reduce(
        (sum: number, item: any) => sum + item.skuPrice * item.quantity,
        0,
      )

      // Verify total calculation: 2 * 100000 + 1 * 500000 = 700000
      expect(calculatedTotal).toBe(700000)
    })
  })
})
