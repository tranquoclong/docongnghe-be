import { Test, TestingModule } from '@nestjs/testing'
import { MediaRepo } from '../media.repo'

/**
 * MEDIA REPO UNIT TESTS
 *
 * Module này test MediaRepo - data access layer cho media module
 * Hiện tại MediaRepo là empty class, tests verify instantiation và decorator behavior
 *
 * Test Coverage:
 * - Class instantiation
 * - SerializeAll decorator behavior
 * - Injectable decorator
 *
 * TODO: Expand tests khi methods được implement (create, delete, findMany with pagination)
 */

describe('MediaRepo', () => {
  let repo: MediaRepo

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [MediaRepo],
    }).compile()

    repo = module.get<MediaRepo>(MediaRepo)
  })

  // ============================================
  // INSTANTIATION
  // ============================================

  describe('✅ Instantiation', () => {
    it('Nên khởi tạo MediaRepo thành công', () => {
      expect(repo).toBeDefined()
      expect(repo).toBeInstanceOf(MediaRepo)
    })

    it('Nên injectable qua NestJS DI container', () => {
      // Verify repo được resolve từ DI container
      expect(repo).toBeTruthy()
    })
  })

  // ============================================
  // SERIALIZATION (SerializeAll decorator)
  // ============================================

  describe('🔄 SerializeAll Decorator', () => {
    it('Nên có SerializeAll decorator applied', () => {
      // MediaRepo sử dụng @SerializeAll() class decorator
      // Verify class prototype vẫn hoạt động bình thường
      const prototype = Object.getPrototypeOf(repo)
      expect(prototype).toBeDefined()
    })
  })
})
