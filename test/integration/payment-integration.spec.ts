import { CACHE_MANAGER } from '@nestjs/cache-manager'
import { INestApplication } from '@nestjs/common'
import { Test, TestingModule } from '@nestjs/testing'
import request from 'supertest'
import { AppModule } from '../../src/app.module'
import { PaymentProducer } from '../../src/routes/payment/payment.producer'
import envConfig from '../../src/shared/config'
import { OrderStatus } from '../../src/shared/constants/order.constant'
import { PaymentStatus } from '../../src/shared/constants/payment.constant'
import { HashingService } from '../../src/shared/services/hashing.service'
import { PrismaService } from '../../src/shared/services/prisma.service'
import { TokenService } from '../../src/shared/services/token.service'
import { PaymentGateway } from '../../src/websockets/payment.gateway'
import { createTestUser, resetDatabase } from '../helpers/test-helpers'

describe('Payment Integration Tests', () => {
  let app: INestApplication
  let prisma: PrismaService
  let hashingService: HashingService
  let tokenService: TokenService
  let clientUserId: number

  const mockCacheManager = {
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue(undefined),
    del: jest.fn().mockResolvedValue(undefined),
  }

  const mockPaymentGateway = {
    emitPaymentSuccess: jest.fn(),
    server: { to: jest.fn().mockReturnThis(), emit: jest.fn() },
  }

  const mockPaymentProducer = {
    removeJob: jest.fn().mockResolvedValue(true),
    getJobStatus: jest.fn().mockResolvedValue(null),
  }

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue(global.__GLOBAL_PRISMA__)
      .overrideProvider(CACHE_MANAGER)
      .useValue(mockCacheManager)
      .overrideProvider(PaymentGateway)
      .useValue(mockPaymentGateway)
      .overrideProvider(PaymentProducer)
      .useValue(mockPaymentProducer)
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

    const clientResult = await createTestUser('client@test.com', 'Client@123', 2, prisma, hashingService, tokenService)
    clientUserId = clientResult.userId
  })

  afterAll(async () => {
    await app.close()
  })

  const createValidWebhookBody = (paymentId: number, amount: number, transactionId: number = 1) => ({
    id: transactionId,
    gateway: 'VIETCOMBANK',
    transactionDate: new Date().toISOString(),
    accountNumber: '1234567890',
    code: `DH${paymentId}`,
    content: `Thanh toan don hang DH${paymentId}`,
    transferType: 'in' as const,
    transferAmount: amount,
    accumulated: 1000000,
    subAccount: null,
    referenceCode: 'REF123',
    description: `VIETCOMBANK 1234567890 DH${paymentId} ${amount}`,
  })

  describe('POST /payment/receiver - Authentication', () => {
    it('should return 401 without API key', async () => {
      const webhookBody = createValidWebhookBody(1, 100000)
      await request(app.getHttpServer()).post('/payment/receiver').send(webhookBody).expect(401)
    })

    it('should return 401 with invalid API key', async () => {
      const webhookBody = createValidWebhookBody(1, 100000)
      await request(app.getHttpServer())
        .post('/payment/receiver')
        .set('Authorization', 'Bearer invalid-api-key')
        .send(webhookBody)
        .expect(401)
    })
  })

  describe('POST /payment/receiver - Error cases', () => {
    it('should return 400 for duplicate transaction', async () => {
      const payment = await prisma.payment.create({
        data: { status: PaymentStatus.PENDING },
      })

      await prisma.order.create({
        data: {
          userId: clientUserId,
          paymentId: payment.id,
          status: OrderStatus.PENDING_PAYMENT,
          totalAmount: 100000,
          receiver: { name: 'Test User', phone: '0123456789', address: '123 Test Street' },
          createdById: clientUserId,
        },
      })

      await prisma.paymentTransaction.create({
        data: {
          id: 999,
          gateway: 'VIETCOMBANK',
          transactionDate: new Date(),
          accountNumber: '1234567890',
          amountIn: 100000,
          amountOut: 0,
          accumulated: 1000000,
          code: `DH${payment.id}`,
          body: 'Test transaction',
        },
      })

      const webhookBody = createValidWebhookBody(payment.id, 100000, 999)

      await request(app.getHttpServer())
        .post('/payment/receiver')
        .set('Authorization', `Bearer ${envConfig.PAYMENT_API_KEY}`)
        .send(webhookBody)
        .expect(400)
    })

    it('should return 400 when payment id cannot be extracted from content', async () => {
      const webhookBody = {
        id: 2,
        gateway: 'VIETCOMBANK',
        transactionDate: new Date().toISOString(),
        accountNumber: '1234567890',
        code: null,
        content: 'Invalid content without payment id',
        transferType: 'in' as const,
        transferAmount: 100000,
        accumulated: 1000000,
        subAccount: null,
        referenceCode: 'REF123',
        description: 'Invalid transaction',
      }

      await request(app.getHttpServer())
        .post('/payment/receiver')
        .set('Authorization', `Bearer ${envConfig.PAYMENT_API_KEY}`)
        .send(webhookBody)
        .expect(400)
    })

    it('should return 400 when payment not found', async () => {
      const webhookBody = createValidWebhookBody(99999, 100000, 3)

      await request(app.getHttpServer())
        .post('/payment/receiver')
        .set('Authorization', `Bearer ${envConfig.PAYMENT_API_KEY}`)
        .send(webhookBody)
        .expect(400)
    })

    it('should return 400 when price does not match', async () => {
      const payment = await prisma.payment.create({
        data: { status: PaymentStatus.PENDING },
      })

      await prisma.order.create({
        data: {
          userId: clientUserId,
          paymentId: payment.id,
          status: OrderStatus.PENDING_PAYMENT,
          totalAmount: 100000,
          receiver: { name: 'Test User', phone: '0123456789', address: '123 Test Street' },
          createdById: clientUserId,
        },
      })

      const webhookBody = createValidWebhookBody(payment.id, 50000, 4)

      await request(app.getHttpServer())
        .post('/payment/receiver')
        .set('Authorization', `Bearer ${envConfig.PAYMENT_API_KEY}`)
        .send(webhookBody)
        .expect(400)
    })
  })

  describe('POST /payment/receiver - Success case', () => {
    it('should process valid payment webhook successfully', async () => {
      const payment = await prisma.payment.create({
        data: { status: PaymentStatus.PENDING },
      })

      const order = await prisma.order.create({
        data: {
          userId: clientUserId,
          paymentId: payment.id,
          status: OrderStatus.PENDING_PAYMENT,
          totalAmount: 150000,
          receiver: { name: 'Test User', phone: '0123456789', address: '123 Test Street' },
          createdById: clientUserId,
        },
      })

      const webhookBody = createValidWebhookBody(payment.id, 150000, 5)

      const response = await request(app.getHttpServer())
        .post('/payment/receiver')
        .set('Authorization', `Bearer ${envConfig.PAYMENT_API_KEY}`)
        .send(webhookBody)
        .expect(201)

      expect(response.body).toMatchObject({
        message: 'Payment received successfully',
      })

      const updatedPayment = await prisma.payment.findUnique({ where: { id: payment.id } })
      expect(updatedPayment?.status).toBe(PaymentStatus.SUCCESS)

      const updatedOrder = await prisma.order.findUnique({ where: { id: order.id } })
      expect(updatedOrder?.status).toBe(OrderStatus.PENDING_PICKUP)

      const transaction = await prisma.paymentTransaction.findUnique({ where: { id: 5 } })
      expect(transaction).toBeDefined()
      expect(transaction?.amountIn).toBe(150000)

      expect(mockPaymentGateway.emitPaymentSuccess).toHaveBeenCalledWith(clientUserId)
      expect(mockPaymentProducer.removeJob).toHaveBeenCalledWith(payment.id)
    })
  })
})
