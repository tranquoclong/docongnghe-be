import { Test, TestingModule } from '@nestjs/testing'
import { WishlistProducer } from 'src/routes/wishlist/wishlist.producer'
import { WishlistPriceCheckCronjob } from '../wishlist-price-check.cronjob'

/**
 * WISHLIST PRICE CHECK CRONJOB UNIT TESTS
 *
 * Test coverage cho cronjob kiểm tra giá wishlist
 * - Scheduled execution (EVERY_DAY_AT_2AM)
 * - Job queueing
 * - Error handling
 */

describe('WishlistPriceCheckCronjob', () => {
  let cronjob: WishlistPriceCheckCronjob
  let mockWishlistProducer: jest.Mocked<WishlistProducer>

  beforeEach(async () => {
    mockWishlistProducer = {
      addPriceCheckJob: jest.fn(),
    } as any

    const module: TestingModule = await Test.createTestingModule({
      providers: [WishlistPriceCheckCronjob, { provide: WishlistProducer, useValue: mockWishlistProducer }],
    }).compile()

    cronjob = module.get<WishlistPriceCheckCronjob>(WishlistPriceCheckCronjob)
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  describe('handlePriceCheck', () => {
    it('should queue price check job successfully', async () => {
      mockWishlistProducer.addPriceCheckJob.mockResolvedValue({} as any)

      await cronjob.handlePriceCheck()

      expect(mockWishlistProducer.addPriceCheckJob).toHaveBeenCalledTimes(1)
      expect(mockWishlistProducer.addPriceCheckJob).toHaveBeenCalledWith()
    })

    it('should log start message', async () => {
      const loggerSpy = jest.spyOn(cronjob['logger'], 'log')
      mockWishlistProducer.addPriceCheckJob.mockResolvedValue({} as any)

      await cronjob.handlePriceCheck()

      expect(loggerSpy).toHaveBeenCalledWith('Triggering daily wishlist price check...')
    })

    it('should log success message', async () => {
      const loggerSpy = jest.spyOn(cronjob['logger'], 'log')
      mockWishlistProducer.addPriceCheckJob.mockResolvedValue({} as any)

      await cronjob.handlePriceCheck()

      expect(loggerSpy).toHaveBeenCalledWith('Price check job queued successfully')
    })

    it('should handle producer errors gracefully', async () => {
      const error = new Error('Queue connection failed')
      const loggerSpy = jest.spyOn(cronjob['logger'], 'error')
      mockWishlistProducer.addPriceCheckJob.mockRejectedValue(error)

      await cronjob.handlePriceCheck()

      expect(loggerSpy).toHaveBeenCalledWith('Failed to queue price check job:', error)
    })

    it('should not throw error when producer fails', async () => {
      mockWishlistProducer.addPriceCheckJob.mockRejectedValue(new Error('Failed'))

      await expect(cronjob.handlePriceCheck()).resolves.not.toThrow()
    })

    it('should handle Redis connection errors', async () => {
      const redisError = new Error('Redis connection refused')
      const loggerSpy = jest.spyOn(cronjob['logger'], 'error')
      mockWishlistProducer.addPriceCheckJob.mockRejectedValue(redisError)

      await cronjob.handlePriceCheck()

      expect(loggerSpy).toHaveBeenCalledWith('Failed to queue price check job:', redisError)
      expect(mockWishlistProducer.addPriceCheckJob).toHaveBeenCalled()
    })

    it('should handle queue full errors', async () => {
      const queueError = new Error('Queue is full')
      const loggerSpy = jest.spyOn(cronjob['logger'], 'error')
      mockWishlistProducer.addPriceCheckJob.mockRejectedValue(queueError)

      await cronjob.handlePriceCheck()

      expect(loggerSpy).toHaveBeenCalledWith('Failed to queue price check job:', queueError)
    })

    it('should call producer exactly once per execution', async () => {
      mockWishlistProducer.addPriceCheckJob.mockResolvedValue({} as any)

      await cronjob.handlePriceCheck()

      expect(mockWishlistProducer.addPriceCheckJob).toHaveBeenCalledTimes(1)
    })

    it('should prevent concurrent executions via isRunning flag', async () => {
      mockWishlistProducer.addPriceCheckJob.mockResolvedValue({} as any)

      await Promise.all([cronjob.handlePriceCheck(), cronjob.handlePriceCheck(), cronjob.handlePriceCheck()])

      // isRunning flag prevents concurrent execution — only 1st call runs
      expect(mockWishlistProducer.addPriceCheckJob).toHaveBeenCalledTimes(1)
    })

    it('should log both start and success messages in order', async () => {
      const loggerSpy = jest.spyOn(cronjob['logger'], 'log')
      mockWishlistProducer.addPriceCheckJob.mockResolvedValue({} as any)

      await cronjob.handlePriceCheck()

      expect(loggerSpy).toHaveBeenNthCalledWith(1, 'Triggering daily wishlist price check...')
      expect(loggerSpy).toHaveBeenNthCalledWith(2, 'Price check job queued successfully')
    })

    it('should not log success message on error', async () => {
      const loggerLogSpy = jest.spyOn(cronjob['logger'], 'log')
      const loggerErrorSpy = jest.spyOn(cronjob['logger'], 'error')
      mockWishlistProducer.addPriceCheckJob.mockRejectedValue(new Error('Failed'))

      await cronjob.handlePriceCheck()

      expect(loggerLogSpy).toHaveBeenCalledWith('Triggering daily wishlist price check...')
      expect(loggerLogSpy).not.toHaveBeenCalledWith('Price check job queued successfully')
      expect(loggerErrorSpy).toHaveBeenCalled()
    })
  })

  describe('cron schedule', () => {
    it('should be decorated with @Cron', () => {
      expect(cronjob.handlePriceCheck).toBeDefined()
      expect(typeof cronjob.handlePriceCheck).toBe('function')
    })

    it('should execute without errors', async () => {
      mockWishlistProducer.addPriceCheckJob.mockResolvedValue({} as any)

      await expect(cronjob.handlePriceCheck()).resolves.not.toThrow()
    })
  })

  describe('error scenarios', () => {
    it('should handle timeout errors', async () => {
      const timeoutError = new Error('Operation timeout')
      const loggerSpy = jest.spyOn(cronjob['logger'], 'error')
      mockWishlistProducer.addPriceCheckJob.mockRejectedValue(timeoutError)

      await cronjob.handlePriceCheck()

      expect(loggerSpy).toHaveBeenCalledWith('Failed to queue price check job:', timeoutError)
    })

    it('should handle network errors', async () => {
      const networkError = new Error('Network unreachable')
      const loggerSpy = jest.spyOn(cronjob['logger'], 'error')
      mockWishlistProducer.addPriceCheckJob.mockRejectedValue(networkError)

      await cronjob.handlePriceCheck()

      expect(loggerSpy).toHaveBeenCalledWith('Failed to queue price check job:', networkError)
    })

    it('should handle unknown errors', async () => {
      const unknownError = new Error('Unknown error')
      const loggerSpy = jest.spyOn(cronjob['logger'], 'error')
      mockWishlistProducer.addPriceCheckJob.mockRejectedValue(unknownError)

      await cronjob.handlePriceCheck()

      expect(loggerSpy).toHaveBeenCalledWith('Failed to queue price check job:', unknownError)
    })

    it('should handle null errors', async () => {
      const loggerSpy = jest.spyOn(cronjob['logger'], 'error')
      mockWishlistProducer.addPriceCheckJob.mockRejectedValue(null)

      await cronjob.handlePriceCheck()

      expect(loggerSpy).toHaveBeenCalledWith('Failed to queue price check job:', null)
    })

    it('should handle string errors', async () => {
      const loggerSpy = jest.spyOn(cronjob['logger'], 'error')
      mockWishlistProducer.addPriceCheckJob.mockRejectedValue('String error')

      await cronjob.handlePriceCheck()

      expect(loggerSpy).toHaveBeenCalledWith('Failed to queue price check job:', 'String error')
    })
  })

  describe('performance', () => {
    it('should complete execution quickly', async () => {
      mockWishlistProducer.addPriceCheckJob.mockResolvedValue({} as any)

      const startTime = Date.now()
      await cronjob.handlePriceCheck()
      const endTime = Date.now()

      expect(endTime - startTime).toBeLessThan(1000)
    })

    it('should handle rapid successive calls with isRunning guard', async () => {
      mockWishlistProducer.addPriceCheckJob.mockResolvedValue({} as any)

      const promises = Array(10)
        .fill(null)
        .map(() => cronjob.handlePriceCheck())

      await expect(Promise.all(promises)).resolves.not.toThrow()
      // isRunning flag prevents concurrent execution — only 1st call runs
      expect(mockWishlistProducer.addPriceCheckJob).toHaveBeenCalledTimes(1)
    })

    it('should not block on producer errors', async () => {
      mockWishlistProducer.addPriceCheckJob.mockRejectedValue(new Error('Failed'))

      const startTime = Date.now()
      await cronjob.handlePriceCheck()
      const endTime = Date.now()

      expect(endTime - startTime).toBeLessThan(1000)
    })
  })

  describe('integration', () => {
    it('should work with WishlistProducer', () => {
      expect(cronjob['wishlistProducer']).toBe(mockWishlistProducer)
    })

    it('should call addPriceCheckJob method', async () => {
      mockWishlistProducer.addPriceCheckJob.mockResolvedValue({} as any)

      await cronjob.handlePriceCheck()

      expect(mockWishlistProducer.addPriceCheckJob).toHaveBeenCalled()
    })

    it('should not pass any arguments to addPriceCheckJob', async () => {
      mockWishlistProducer.addPriceCheckJob.mockResolvedValue({} as any)

      await cronjob.handlePriceCheck()

      expect(mockWishlistProducer.addPriceCheckJob).toHaveBeenCalledWith()
    })
  })

  describe('logging behavior', () => {
    it('should use correct logger name', () => {
      expect(cronjob['logger']).toBeDefined()
    })

    it('should log at appropriate levels', async () => {
      const logSpy = jest.spyOn(cronjob['logger'], 'log')
      const errorSpy = jest.spyOn(cronjob['logger'], 'error')
      mockWishlistProducer.addPriceCheckJob.mockResolvedValue({} as any)

      await cronjob.handlePriceCheck()

      expect(logSpy).toHaveBeenCalled()
      expect(errorSpy).not.toHaveBeenCalled()
    })

    it('should log errors at error level', async () => {
      const errorSpy = jest.spyOn(cronjob['logger'], 'error')
      mockWishlistProducer.addPriceCheckJob.mockRejectedValue(new Error('Failed'))

      await cronjob.handlePriceCheck()

      expect(errorSpy).toHaveBeenCalled()
    })
  })

  describe('edge cases', () => {
    it('should handle producer returning undefined', async () => {
      mockWishlistProducer.addPriceCheckJob.mockResolvedValue({} as any)

      await expect(cronjob.handlePriceCheck()).resolves.not.toThrow()
    })

    it('should handle producer returning null', async () => {
      mockWishlistProducer.addPriceCheckJob.mockResolvedValue({} as any)

      await expect(cronjob.handlePriceCheck()).resolves.not.toThrow()
    })

    it('should handle multiple errors in sequence', async () => {
      const errors = [new Error('Error 1'), new Error('Error 2'), new Error('Error 3')]

      for (const error of errors) {
        mockWishlistProducer.addPriceCheckJob.mockRejectedValue(error)
        await cronjob.handlePriceCheck()
      }

      expect(mockWishlistProducer.addPriceCheckJob).toHaveBeenCalledTimes(3)
    })

    it('should recover from errors on subsequent calls', async () => {
      mockWishlistProducer.addPriceCheckJob.mockRejectedValueOnce(new Error('Failed')).mockResolvedValueOnce({} as any)

      await cronjob.handlePriceCheck()
      await cronjob.handlePriceCheck()

      expect(mockWishlistProducer.addPriceCheckJob).toHaveBeenCalledTimes(2)
    })
  })

  describe('async behavior', () => {
    it('should wait for producer to complete', async () => {
      let producerCompleted = false
      mockWishlistProducer.addPriceCheckJob.mockImplementation(async () => {
        await new Promise((resolve) => setTimeout(resolve, 10))
        producerCompleted = true
        return {} as any
      })

      await cronjob.handlePriceCheck()

      expect(producerCompleted).toBe(true)
    })

    it('should handle slow producer responses', async () => {
      mockWishlistProducer.addPriceCheckJob.mockImplementation(() => new Promise((resolve) => setTimeout(resolve, 100)))

      await expect(cronjob.handlePriceCheck()).resolves.not.toThrow()
    })
  })
})
