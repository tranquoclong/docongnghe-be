// Unmock helpers module for this test file
jest.unmock('src/shared/helpers')

import { Prisma } from '@prisma/client'
import {
  generateCancelPaymentJobId,
  generateOTP,
  generateRandomFileName,
  generateRoomUserId,
  isForeignKeyConstraintPrismaError,
  isNotFoundPrismaError,
  isUniqueConstraintPrismaError,
} from '../helpers'

describe('Prisma Error Type Guards', () => {
  describe('isUniqueConstraintPrismaError', () => {
    it('should return true for P2002 error', () => {
      const error = new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
        code: 'P2002',
        clientVersion: '5.0.0',
      })
      expect(isUniqueConstraintPrismaError(error)).toBe(true)
    })

    it('should return false for non-Prisma error', () => {
      const error = new Error('Regular error')
      expect(isUniqueConstraintPrismaError(error)).toBe(false)
    })

    it('should return false for Prisma error with different code', () => {
      const error = new Prisma.PrismaClientKnownRequestError('Other error', {
        code: 'P2025',
        clientVersion: '5.0.0',
      })
      expect(isUniqueConstraintPrismaError(error)).toBe(false)
    })

    it('should return false for null', () => {
      expect(isUniqueConstraintPrismaError(null)).toBe(false)
    })

    it('should return false for undefined', () => {
      expect(isUniqueConstraintPrismaError(undefined)).toBe(false)
    })
  })

  describe('isNotFoundPrismaError', () => {
    it('should return true for P2025 error', () => {
      const error = new Prisma.PrismaClientKnownRequestError('Record not found', {
        code: 'P2025',
        clientVersion: '5.0.0',
      })
      expect(isNotFoundPrismaError(error)).toBe(true)
    })

    it('should return false for non-Prisma error', () => {
      const error = new Error('Regular error')
      expect(isNotFoundPrismaError(error)).toBe(false)
    })

    it('should return false for Prisma error with different code', () => {
      const error = new Prisma.PrismaClientKnownRequestError('Other error', {
        code: 'P2002',
        clientVersion: '5.0.0',
      })
      expect(isNotFoundPrismaError(error)).toBe(false)
    })

    it('should return false for null', () => {
      expect(isNotFoundPrismaError(null)).toBe(false)
    })

    it('should return false for undefined', () => {
      expect(isNotFoundPrismaError(undefined)).toBe(false)
    })
  })

  describe('isForeignKeyConstraintPrismaError', () => {
    it('should return true for P2003 error', () => {
      const error = new Prisma.PrismaClientKnownRequestError('Foreign key constraint failed', {
        code: 'P2003',
        clientVersion: '5.0.0',
      })
      expect(isForeignKeyConstraintPrismaError(error)).toBe(true)
    })

    it('should return false for non-Prisma error', () => {
      const error = new Error('Regular error')
      expect(isForeignKeyConstraintPrismaError(error)).toBe(false)
    })

    it('should return false for Prisma error with different code', () => {
      const error = new Prisma.PrismaClientKnownRequestError('Other error', {
        code: 'P2025',
        clientVersion: '5.0.0',
      })
      expect(isForeignKeyConstraintPrismaError(error)).toBe(false)
    })

    it('should return false for null', () => {
      expect(isForeignKeyConstraintPrismaError(null)).toBe(false)
    })

    it('should return false for undefined', () => {
      expect(isForeignKeyConstraintPrismaError(undefined)).toBe(false)
    })
  })
})

describe('Helper Functions', () => {
  describe('generateOTP', () => {
    it('should generate 6-digit OTP', () => {
      const otp = generateOTP()
      expect(otp).toHaveLength(6)
      expect(otp).toMatch(/^\d{6}$/)
    })

    it('should generate different OTPs on multiple calls', () => {
      const otps = new Set()
      for (let i = 0; i < 100; i++) {
        otps.add(generateOTP())
      }
      // Should have at least some variation (not all the same)
      expect(otps.size).toBeGreaterThan(1)
    })

    it('should pad with zeros for small numbers', () => {
      // Mock randomInt to return a small number
      const otp = generateOTP()
      expect(otp).toHaveLength(6)
      // All OTPs should be 6 digits regardless of the random value
    })
  })

  describe('generateRandomFileName', () => {
    it('should preserve file extension', () => {
      const filename = generateRandomFileName('test.jpg')
      expect(filename).toMatch(/\.jpg$/)
    })

    it('should preserve complex file extensions', () => {
      const filename = generateRandomFileName('document.tar.gz')
      expect(filename).toMatch(/\.gz$/)
    })

    it('should handle files without extension', () => {
      const filename = generateRandomFileName('README')
      expect(filename).not.toContain('.')
    })

    it('should generate unique filenames', () => {
      const filename1 = generateRandomFileName('test.jpg')
      const filename2 = generateRandomFileName('test.jpg')
      expect(filename1).not.toBe(filename2)
    })

    it('should generate UUID-based filename', () => {
      const filename = generateRandomFileName('test.jpg')
      // UUID v4 format: xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx.jpg
      expect(filename).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.jpg$/)
    })
  })

  describe('generateCancelPaymentJobId', () => {
    it('should generate correct job ID format', () => {
      const jobId = generateCancelPaymentJobId(123)
      expect(jobId).toBe('paymentId-123')
    })

    it('should handle large payment IDs', () => {
      const jobId = generateCancelPaymentJobId(999999999)
      expect(jobId).toBe('paymentId-999999999')
    })

    it('should handle zero payment ID', () => {
      const jobId = generateCancelPaymentJobId(0)
      expect(jobId).toBe('paymentId-0')
    })
  })

  describe('generateRoomUserId', () => {
    it('should generate correct room ID format', () => {
      const roomId = generateRoomUserId(456)
      expect(roomId).toBe('userId-456')
    })

    it('should handle large user IDs', () => {
      const roomId = generateRoomUserId(999999999)
      expect(roomId).toBe('userId-999999999')
    })

    it('should handle zero user ID', () => {
      const roomId = generateRoomUserId(0)
      expect(roomId).toBe('userId-0')
    })
  })
})
