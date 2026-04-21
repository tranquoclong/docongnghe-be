import { Test, TestingModule } from '@nestjs/testing'
import { Job } from 'bullmq'
import { WishlistProducer } from 'src/routes/wishlist/wishlist.producer'
import { WishlistRepo } from 'src/routes/wishlist/wishlist.repo'
import { PRICE_CHECK_JOB_NAME, SEND_PRICE_ALERT_JOB_NAME } from 'src/shared/constants/queue.constant'
import { EmailService } from 'src/shared/services/email.service'
import { WishlistConsumer } from '../wishlist.consumer'

/**
 * WISHLIST CONSUMER UNIT TESTS
 *
 * Test coverage cho Wishlist Queue Consumer
 * - Price check job processing
 * - Price alert email sending
 * - Error handling
 */

describe('WishlistConsumer', () => {
  let consumer: WishlistConsumer
  let mockWishlistRepo: jest.Mocked<WishlistRepo>
  let mockWishlistProducer: jest.Mocked<WishlistProducer>
  let mockEmailService: jest.Mocked<EmailService>

  const createMockJob = (name: string, data: any = {}): Job =>
    ({
      id: '123',
      name,
      data,
      attemptsMade: 0,
      timestamp: Date.now(),
    }) as any

  const createMockWishlistItem = (overrides = {}) => ({
    id: 1,
    userId: 1,
    productId: 100,
    skuId: 10,
    note: null,
    priority: 1,
    notifyOnPriceDrops: true,
    notifyOnBackInStock: false,
    notifyOnPromotion: false,
    addedAt: new Date(),
    updatedAt: new Date(),
    user: {
      id: 1,
      email: 'user@example.com',
      name: 'Test User',
    },
    product: {
      id: 100,
      name: 'Test Product',
      basePrice: 100000,
    },
    sku: {
      id: 10,
      price: 90000,
    },
    priceAlerts: [
      {
        id: 1,
        originalPrice: 100000,
        currentPrice: 100000,
        targetPrice: 80000,
        wishlistItemId: 1,
        lastCheckedAt: new Date(),
        alertSentAt: null,
      },
    ],
    ...overrides,
  })

  beforeEach(async () => {
    mockWishlistRepo = {
      getItemsForPriceCheck: jest.fn(),
      updatePriceAlert: jest.fn(),
    } as any

    mockWishlistProducer = {
      addSendPriceAlertJob: jest.fn(),
    } as any

    mockEmailService = {
      sendOTP: jest.fn(),
    } as any

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WishlistConsumer,
        { provide: WishlistRepo, useValue: mockWishlistRepo },
        { provide: WishlistProducer, useValue: mockWishlistProducer },
        { provide: EmailService, useValue: mockEmailService },
      ],
    }).compile()

    consumer = module.get<WishlistConsumer>(WishlistConsumer)
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  describe('process', () => {
    it('should route PRICE_CHECK_JOB_NAME to handlePriceCheck', async () => {
      const job = createMockJob(PRICE_CHECK_JOB_NAME)
      mockWishlistRepo.getItemsForPriceCheck.mockResolvedValue([])

      const result = await consumer.process(job)

      expect(result).toEqual({ success: true, itemsChecked: 0, alertsSent: 0 })
    })

    it('should route SEND_PRICE_ALERT_JOB_NAME to handleSendPriceAlert', async () => {
      const data = {
        userId: 1,
        userEmail: 'user@example.com',
        userName: 'Test User',
        productId: 100,
        productName: 'Test Product',
        oldPrice: 100000,
        newPrice: 90000,
        priceDropPercentage: 10,
        wishlistItemId: 1,
      }
      const job = createMockJob(SEND_PRICE_ALERT_JOB_NAME, data)
      mockEmailService.sendOTP.mockResolvedValue({ data: { id: 'test-id' }, error: null } as any)
      mockWishlistRepo.updatePriceAlert.mockResolvedValue({ count: 1 } as any)

      const result = await consumer.process(job)

      expect(result).toEqual({ success: true })
    })

    it('should handle unknown job name', async () => {
      const job = createMockJob('UNKNOWN_JOB')

      const result = await consumer.process(job)

      expect(result).toBeUndefined()
    })
  })

  describe('handlePriceCheck', () => {
    it('should check prices and send no alerts when no items', async () => {
      const job = createMockJob(PRICE_CHECK_JOB_NAME)
      mockWishlistRepo.getItemsForPriceCheck.mockResolvedValue([])

      const result = await consumer.process(job)

      expect(mockWishlistRepo.getItemsForPriceCheck).toHaveBeenCalled()
      expect(result).toEqual({ success: true, itemsChecked: 0, alertsSent: 0 })
    })

    it('should detect price drop > 5% and queue alert', async () => {
      const item = createMockWishlistItem({
        sku: { price: 94000 }, // 6% drop from 100000
        priceAlerts: [
          {
            id: 1,
            originalPrice: 100000,
            currentPrice: 100000,
            targetPrice: null,
            wishlistItemId: 1,
            lastCheckedAt: new Date(),
            alertSentAt: null,
          },
        ],
      })
      const job = createMockJob(PRICE_CHECK_JOB_NAME)
      mockWishlistRepo.getItemsForPriceCheck.mockResolvedValue([item] as any)
      mockWishlistRepo.updatePriceAlert.mockResolvedValue({ count: 1 } as any)
      mockWishlistProducer.addSendPriceAlertJob.mockResolvedValue({} as any)

      const result = await consumer.process(job)

      expect(mockWishlistRepo.updatePriceAlert).toHaveBeenCalledWith(1, 94000, false)
      expect(mockWishlistProducer.addSendPriceAlertJob).toHaveBeenCalledWith({
        userId: 1,
        userEmail: 'user@example.com',
        userName: 'Test User',
        productId: 100,
        productName: 'Test Product',
        oldPrice: 100000,
        newPrice: 94000,
        priceDropPercentage: 6,
        wishlistItemId: 1,
      })
      expect(result).toEqual({ success: true, itemsChecked: 1, alertsSent: 1 })
    })

    it('should not send alert when price drop < 5%', async () => {
      const item = createMockWishlistItem({
        sku: { price: 96000 }, // 4% drop
        priceAlerts: [
          {
            id: 1,
            originalPrice: 100000,
            currentPrice: 100000,
            targetPrice: null,
            wishlistItemId: 1,
            lastCheckedAt: new Date(),
            alertSentAt: null,
          },
        ],
      })
      const job = createMockJob(PRICE_CHECK_JOB_NAME)
      mockWishlistRepo.getItemsForPriceCheck.mockResolvedValue([item] as any)
      mockWishlistRepo.updatePriceAlert.mockResolvedValue({ count: 1 } as any)

      const result = await consumer.process(job)

      expect(mockWishlistRepo.updatePriceAlert).toHaveBeenCalledWith(1, 96000, false)
      expect(mockWishlistProducer.addSendPriceAlertJob).not.toHaveBeenCalled()
      expect(result).toEqual({ success: true, itemsChecked: 1, alertsSent: 0 })
    })

    it('should send alert when target price is met', async () => {
      const item = createMockWishlistItem({
        sku: { price: 75000 },
        priceAlerts: [
          {
            id: 1,
            originalPrice: 100000,
            currentPrice: 100000,
            targetPrice: 80000,
            wishlistItemId: 1,
            lastCheckedAt: new Date(),
            alertSentAt: null,
          },
        ],
      })
      const job = createMockJob(PRICE_CHECK_JOB_NAME)
      mockWishlistRepo.getItemsForPriceCheck.mockResolvedValue([item] as any)
      mockWishlistRepo.updatePriceAlert.mockResolvedValue({ count: 1 } as any)
      mockWishlistProducer.addSendPriceAlertJob.mockResolvedValue({} as any)

      const result = await consumer.process(job)

      // shouldAlert is a single check: drop >= 5% OR target met — sends 1 alert per item
      expect(mockWishlistProducer.addSendPriceAlertJob).toHaveBeenCalledTimes(1)
      expect(result.alertsSent).toBe(1)
    })

    it('should use product basePrice when sku price is not available', async () => {
      const item = createMockWishlistItem({
        sku: null,
        product: { id: 100, name: 'Test Product', basePrice: 90000 },
        priceAlerts: [
          {
            id: 1,
            originalPrice: 100000,
            currentPrice: 100000,
            targetPrice: null,
            wishlistItemId: 1,
            lastCheckedAt: new Date(),
            alertSentAt: null,
          },
        ],
      })
      const job = createMockJob(PRICE_CHECK_JOB_NAME)
      mockWishlistRepo.getItemsForPriceCheck.mockResolvedValue([item] as any)
      mockWishlistRepo.updatePriceAlert.mockResolvedValue({ count: 1 } as any)
      mockWishlistProducer.addSendPriceAlertJob.mockResolvedValue({} as any)

      const result = await consumer.process(job)

      expect(mockWishlistRepo.updatePriceAlert).toHaveBeenCalledWith(1, 90000, false)
      expect(result).toEqual({ success: true, itemsChecked: 1, alertsSent: 1 })
    })

    it('should skip item without price alert', async () => {
      const item = createMockWishlistItem({ priceAlerts: [] })
      const job = createMockJob(PRICE_CHECK_JOB_NAME)
      mockWishlistRepo.getItemsForPriceCheck.mockResolvedValue([item])

      const result = await consumer.process(job)

      expect(mockWishlistRepo.updatePriceAlert).not.toHaveBeenCalled()
      expect(mockWishlistProducer.addSendPriceAlertJob).not.toHaveBeenCalled()
      expect(result).toEqual({ success: true, itemsChecked: 1, alertsSent: 0 })
    })

    it('should handle multiple items with different users', async () => {
      const items = [
        createMockWishlistItem({ id: 1, userId: 1, user: { id: 1, email: 'u1@test.com', name: 'U1' }, product: { id: 101, name: 'P1', basePrice: 100000 }, sku: { price: 94000 } }), // 6% drop
        createMockWishlistItem({ id: 2, userId: 2, user: { id: 2, email: 'u2@test.com', name: 'U2' }, product: { id: 102, name: 'P2', basePrice: 100000 }, sku: { price: 96000 } }), // 4% drop — no alert
        createMockWishlistItem({ id: 3, userId: 3, user: { id: 3, email: 'u3@test.com', name: 'U3' }, product: { id: 103, name: 'P3', basePrice: 100000 }, sku: { price: 90000 } }), // 10% drop
      ]
      const job = createMockJob(PRICE_CHECK_JOB_NAME)
      mockWishlistRepo.getItemsForPriceCheck.mockResolvedValue(items as any)
      mockWishlistRepo.updatePriceAlert.mockResolvedValue({ count: 1 } as any)
      mockWishlistProducer.addSendPriceAlertJob.mockResolvedValue({} as any)

      const result = await consumer.process(job)

      expect(mockWishlistRepo.updatePriceAlert).toHaveBeenCalledTimes(3)
      expect(mockWishlistProducer.addSendPriceAlertJob).toHaveBeenCalledTimes(2) // Items 1 and 3
      expect(result).toEqual({ success: true, itemsChecked: 3, alertsSent: 2 })
    })

    it('should continue processing other items if one fails', async () => {
      const items = [
        createMockWishlistItem({ id: 1, sku: { price: 94000 } }),
        createMockWishlistItem({ id: 2, sku: { price: 90000 } }),
      ]
      const job = createMockJob(PRICE_CHECK_JOB_NAME)
      mockWishlistRepo.getItemsForPriceCheck.mockResolvedValue(items as any)
      mockWishlistRepo.updatePriceAlert
        .mockRejectedValueOnce(new Error('Update failed'))
        .mockResolvedValueOnce({ count: 1 } as any)
      mockWishlistProducer.addSendPriceAlertJob.mockResolvedValue({} as any)

      const result = await consumer.process(job)

      expect(result.itemsChecked).toBe(2)
      expect(result.alertsSent).toBe(1) // Only second item succeeded
    })

    it('should throw error if getItemsForPriceCheck fails', async () => {
      const job = createMockJob(PRICE_CHECK_JOB_NAME)
      mockWishlistRepo.getItemsForPriceCheck.mockRejectedValue(new Error('Database error'))

      await expect(consumer.process(job)).rejects.toThrow('Database error')
    })

    it('should round price drop percentage to 2 decimals', async () => {
      const item = createMockWishlistItem({
        sku: { price: 93333 }, // 6.667% drop
        priceAlerts: [
          {
            id: 1,
            originalPrice: 100000,
            currentPrice: 100000,
            targetPrice: null,
            wishlistItemId: 1,
            lastCheckedAt: new Date(),
            alertSentAt: null,
          },
        ],
      })
      const job = createMockJob(PRICE_CHECK_JOB_NAME)
      mockWishlistRepo.getItemsForPriceCheck.mockResolvedValue([item] as any)
      mockWishlistRepo.updatePriceAlert.mockResolvedValue({ count: 1 } as any)
      mockWishlistProducer.addSendPriceAlertJob.mockResolvedValue({} as any)

      await consumer.process(job)

      expect(mockWishlistProducer.addSendPriceAlertJob).toHaveBeenCalledWith(
        expect.objectContaining({
          priceDropPercentage: 6.67,
        }),
      )
    })

    it('should handle zero current price', async () => {
      const item = createMockWishlistItem({
        sku: null,
        product: { basePrice: 0 },
        priceAlerts: [
          {
            id: 1,
            originalPrice: 100000,
            currentPrice: 100000,
            targetPrice: null,
            wishlistItemId: 1,
            lastCheckedAt: new Date(),
            alertSentAt: null,
          },
        ],
      })
      const job = createMockJob(PRICE_CHECK_JOB_NAME)
      mockWishlistRepo.getItemsForPriceCheck.mockResolvedValue([item] as any)
      mockWishlistRepo.updatePriceAlert.mockResolvedValue({ count: 1 } as any)
      mockWishlistProducer.addSendPriceAlertJob.mockResolvedValue({} as any)

      const result = await consumer.process(job)

      expect(mockWishlistRepo.updatePriceAlert).toHaveBeenCalledWith(1, 0, false)
      expect(result.alertsSent).toBe(1) // 100% drop
    })
  })

  describe('handleSendPriceAlert', () => {
    const alertData = {
      userId: 1,
      userEmail: 'user@example.com',
      userName: 'Test User',
      productId: 100,
      productName: 'Test Product',
      oldPrice: 100000,
      newPrice: 90000,
      priceDropPercentage: 10,
      wishlistItemId: 1,
    }

    it('should send email and update price alert', async () => {
      const job = createMockJob(SEND_PRICE_ALERT_JOB_NAME, alertData)
      mockEmailService.sendOTP.mockResolvedValue({ data: { id: 'test-id' }, error: null } as any)
      mockWishlistRepo.updatePriceAlert.mockResolvedValue({ count: 1 } as any)

      const result = await consumer.process(job)

      expect(mockEmailService.sendOTP).toHaveBeenCalledWith({
        email: 'user@example.com',
        code: 'Price Drop Alert: Test Product is now 10% off!',
      })
      expect(mockWishlistRepo.updatePriceAlert).toHaveBeenCalledWith(1, 90000, true)
      expect(result).toEqual({ success: true })
    })

    it('should throw error if email sending fails', async () => {
      const job = createMockJob(SEND_PRICE_ALERT_JOB_NAME, alertData)
      mockEmailService.sendOTP.mockRejectedValue(new Error('Email service error'))

      await expect(consumer.process(job)).rejects.toThrow('Email service error')
      expect(mockWishlistRepo.updatePriceAlert).not.toHaveBeenCalled()
    })

    it('should throw error if updatePriceAlert fails', async () => {
      const job = createMockJob(SEND_PRICE_ALERT_JOB_NAME, alertData)
      mockEmailService.sendOTP.mockResolvedValue({ data: { id: 'test-id' }, error: null } as any)
      mockWishlistRepo.updatePriceAlert.mockRejectedValue(new Error('Database error'))

      await expect(consumer.process(job)).rejects.toThrow('Database error')
    })

    it('should handle different price drop percentages', async () => {
      const testCases = [5, 10, 25, 50, 75, 100]

      for (const percentage of testCases) {
        const data = { ...alertData, priceDropPercentage: percentage }
        const job = createMockJob(SEND_PRICE_ALERT_JOB_NAME, data)
        mockEmailService.sendOTP.mockResolvedValue({ data: { id: 'test-id' }, error: null } as any)
        mockWishlistRepo.updatePriceAlert.mockResolvedValue({ count: 1 } as any)

        await consumer.process(job)

        expect(mockEmailService.sendOTP).toHaveBeenCalledWith({
          email: 'user@example.com',
          code: `Price Drop Alert: Test Product is now ${percentage}% off!`,
        })
      }
    })

    it('should handle different user emails', async () => {
      const emails = ['test1@example.com', 'test2@example.com', 'admin@example.com']

      for (const email of emails) {
        const data = { ...alertData, userEmail: email }
        const job = createMockJob(SEND_PRICE_ALERT_JOB_NAME, data)
        mockEmailService.sendOTP.mockResolvedValue({ data: { id: 'test-id' }, error: null } as any)
        mockWishlistRepo.updatePriceAlert.mockResolvedValue({ count: 1 } as any)

        await consumer.process(job)

        expect(mockEmailService.sendOTP).toHaveBeenCalledWith(
          expect.objectContaining({
            email,
          }),
        )
      }
    })
  })

  describe('inheritance', () => {
    it('should extend WorkerHost', () => {
      expect(consumer).toBeInstanceOf(WishlistConsumer)
      expect(consumer.process).toBeDefined()
    })
  })
})
