import { Test, TestingModule } from '@nestjs/testing'
import { HashingService } from '../hashing.service'

describe('HashingService', () => {
  let service: HashingService

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [HashingService],
    }).compile()

    service = module.get<HashingService>(HashingService)
  })

  describe('hash', () => {
    it('should hash a password successfully', async () => {
      // Arrange - Chuẩn bị dữ liệu test
      const plainPassword = 'password123'

      // Act - Thực hiện hash
      const result = await service.hash(plainPassword)

      // Assert - Kiểm tra kết quả
      expect(result).toBeDefined()
      expect(typeof result).toBe('string')
      expect(result).not.toBe(plainPassword)
      expect(result.length).toBeGreaterThan(50) // bcrypt hash length
    })

    it('should generate different hashes for same password', async () => {
      // Arrange - Chuẩn bị mật khẩu giống nhau
      const plainPassword = 'password123'

      // Act - Thực hiện hash 2 lần
      const hash1 = await service.hash(plainPassword)
      const hash2 = await service.hash(plainPassword)

      // Assert - Kiểm tra hash khác nhau (do salt)
      expect(hash1).not.toBe(hash2)
      expect(hash1).toBeDefined()
      expect(hash2).toBeDefined()
    })

    it('should handle empty string', async () => {
      // Arrange - Chuẩn bị chuỗi rỗng
      const emptyPassword = ''

      // Act - Thực hiện hash chuỗi rỗng
      const result = await service.hash(emptyPassword)

      // Assert - Kiểm tra kết quả
      expect(result).toBeDefined()
      expect(typeof result).toBe('string')
      expect(result).not.toBe('')
    })
  })

  describe('compare', () => {
    it('should return true for correct password', async () => {
      // Arrange - Chuẩn bị dữ liệu so sánh đúng
      const plainPassword = 'password123'
      const hashedPassword = await service.hash(plainPassword)

      // Act - Thực hiện so sánh
      const result = await service.compare(plainPassword, hashedPassword)

      // Assert - Kiểm tra kết quả đúng
      expect(result).toBe(true)
    })

    it('should return false for incorrect password', async () => {
      // Arrange - Chuẩn bị dữ liệu so sánh sai
      const plainPassword = 'password123'
      const wrongPassword = 'wrongpassword'
      const hashedPassword = await service.hash(plainPassword)

      // Act - Thực hiện so sánh với mật khẩu sai
      const result = await service.compare(wrongPassword, hashedPassword)

      // Assert - Kiểm tra kết quả sai
      expect(result).toBe(false)
    })

    it('should return false for empty password', async () => {
      // Arrange - Chuẩn bị mật khẩu rỗng
      const plainPassword = 'password123'
      const hashedPassword = await service.hash(plainPassword)

      // Act - Thực hiện so sánh với mật khẩu rỗng
      const result = await service.compare('', hashedPassword)

      // Assert - Kiểm tra kết quả sai
      expect(result).toBe(false)
    })

    it('should handle invalid hash gracefully', async () => {
      // Arrange - Chuẩn bị hash không hợp lệ
      const plainPassword = 'password123'
      const invalidHash = 'invalid-hash'

      // Act - Thực hiện so sánh với hash không hợp lệ
      const result = await service.compare(plainPassword, invalidHash)

      // Assert - Kiểm tra kết quả trả về false cho hash không hợp lệ
      expect(result).toBe(false)
    })
  })

  describe('edge cases', () => {
    it('should handle special characters in password', async () => {
      // Arrange - Chuẩn bị mật khẩu có ký tự đặc biệt
      const specialPassword = '!@#$%^&*()_+-=[]{}|;":,./<>?'

      // Act - Thực hiện hash và so sánh
      const hashedPassword = await service.hash(specialPassword)
      const isMatch = await service.compare(specialPassword, hashedPassword)

      // Assert - Kiểm tra kết quả
      expect(hashedPassword).toBeDefined()
      expect(isMatch).toBe(true)
    })

    it('should handle unicode characters', async () => {
      // Arrange - Chuẩn bị mật khẩu có ký tự unicode
      const unicodePassword = 'password123🔒'

      // Act - Thực hiện hash và so sánh
      const hashedPassword = await service.hash(unicodePassword)
      const isMatch = await service.compare(unicodePassword, hashedPassword)

      // Assert - Kiểm tra kết quả
      expect(hashedPassword).toBeDefined()
      expect(isMatch).toBe(true)
    })

    it('should handle very long passwords', async () => {
      // Arrange - Chuẩn bị mật khẩu rất dài
      const longPassword = 'a'.repeat(1000)

      // Act - Thực hiện hash và so sánh
      const hashedPassword = await service.hash(longPassword)
      const isMatch = await service.compare(longPassword, hashedPassword)

      // Assert - Kiểm tra kết quả
      expect(hashedPassword).toBeDefined()
      expect(isMatch).toBe(true)
    })
  })
})
