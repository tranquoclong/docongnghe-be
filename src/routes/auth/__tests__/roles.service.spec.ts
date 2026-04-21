import { Test, TestingModule } from '@nestjs/testing'
import { RoleName } from 'src/shared/constants/role.constant'
import { RoleType } from 'src/shared/models/shared-role.model'
import { PrismaService } from 'src/shared/services/prisma.service'
import { RolesService } from '../roles.service'

/**
 * ROLES SERVICE UNIT TESTS
 *
 * Module này test role helper service cho Auth module
 * Đây là module MEDIUM PRIORITY vì hỗ trợ role management với caching
 *
 * Test Coverage:
 * - getClientRoleId: Get CLIENT role ID với caching
 * - Cache hit scenario (role đã được cache)
 * - Cache miss scenario (query database)
 * - Error handling (role not found)
 * - Multiple calls (verify caching works)
 */

describe('RolesService', () => {
  let service: RolesService
  let mockPrismaService: jest.Mocked<PrismaService>

  // ===== TEST DATA FACTORIES =====

  const createMockRole = (overrides = {}): RoleType => ({
    id: 2,
    name: RoleName.Client,
    description: 'Client role',
    isActive: true,
    createdById: null,
    updatedById: null,
    deletedById: null,
    deletedAt: null,
    createdAt: new Date('2024-01-01').toISOString(),
    updatedAt: new Date('2024-01-01').toISOString(),
    ...overrides,
  })

  beforeEach(async () => {
    // Mock PrismaService
    mockPrismaService = {
      $queryRaw: jest.fn(),
    } as any

    const module: TestingModule = await Test.createTestingModule({
      providers: [RolesService, { provide: PrismaService, useValue: mockPrismaService }],
    }).compile()

    service = module.get<RolesService>(RolesService)
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  // ============================================
  // SERVICE INITIALIZATION
  // ============================================

  describe('🔧 Service Initialization', () => {
    it('Nên khởi tạo service thành công', () => {
      // Assert: Verify service được khởi tạo
      expect(service).toBeDefined()
    })

    it('Nên có clientRoleId property khởi tạo là null', () => {
      // Assert: Verify initial state
      expect(service['clientRoleId']).toBeNull()
    })
  })

  // ============================================
  // GET CLIENT ROLE ID - SUCCESS CASES
  // ============================================

  describe('✅ getClientRoleId - Success Cases', () => {
    it('Nên lấy CLIENT role ID thành công lần đầu tiên (cache miss)', async () => {
      // Arrange: Chuẩn bị mock role từ database
      const mockRole = createMockRole({ id: 2, name: RoleName.Client })
      mockPrismaService.$queryRaw.mockResolvedValue([mockRole])

      // Act: Gọi getClientRoleId lần đầu
      const result = await service.getClientRoleId()

      // Assert: Verify kết quả và database được query
      expect(result).toBe(2)
      expect(mockPrismaService.$queryRaw).toHaveBeenCalledTimes(1)
      expect(service['clientRoleId']).toBe(2) // Verify cached
    })

    it('Nên return cached role ID khi gọi lần thứ 2 (cache hit)', async () => {
      // Arrange: Setup cache với role ID
      const mockRole = createMockRole({ id: 2 })
      mockPrismaService.$queryRaw.mockResolvedValue([mockRole])

      // Act: Gọi getClientRoleId 2 lần
      const firstCall = await service.getClientRoleId()
      const secondCall = await service.getClientRoleId()

      // Assert: Verify cache hit, database chỉ query 1 lần
      expect(firstCall).toBe(2)
      expect(secondCall).toBe(2)
      expect(mockPrismaService.$queryRaw).toHaveBeenCalledTimes(1) // Chỉ query 1 lần
    })

    it('Nên cache role ID sau lần query đầu tiên', async () => {
      // Arrange: Chuẩn bị mock role
      const mockRole = createMockRole({ id: 3, name: RoleName.Client })
      mockPrismaService.$queryRaw.mockResolvedValue([mockRole])

      // Act: Gọi getClientRoleId
      await service.getClientRoleId()

      // Assert: Verify clientRoleId được cache
      expect(service['clientRoleId']).toBe(3)
    })

    it('Nên handle multiple concurrent calls correctly', async () => {
      // Arrange: Chuẩn bị mock role
      const mockRole = createMockRole({ id: 2 })
      mockPrismaService.$queryRaw.mockResolvedValue([mockRole])

      // Act: Gọi getClientRoleId đồng thời nhiều lần
      const results = await Promise.all([
        service.getClientRoleId(),
        service.getClientRoleId(),
        service.getClientRoleId(),
      ])

      // Assert: Verify tất cả calls return cùng kết quả
      expect(results).toEqual([2, 2, 2])
      // Note: Có thể query nhiều lần do race condition, nhưng kết quả phải đúng
      expect(mockPrismaService.$queryRaw).toHaveBeenCalled()
    })

    it('Nên query với correct SQL và parameters', async () => {
      // Arrange: Chuẩn bị mock role
      const mockRole = createMockRole()
      mockPrismaService.$queryRaw.mockResolvedValue([mockRole])

      // Act: Gọi getClientRoleId
      await service.getClientRoleId()

      // Assert: Verify SQL query được gọi
      expect(mockPrismaService.$queryRaw).toHaveBeenCalled()
      const callArgs = mockPrismaService.$queryRaw.mock.calls[0]
      // Verify SQL template string contains correct parts
      expect(callArgs[0]).toEqual(expect.arrayContaining([expect.stringContaining('SELECT * FROM "Role"')]))
      // Verify RoleName.Client parameter
      expect(callArgs[1]).toBe(RoleName.Client)
    })
  })

  // ============================================
  // GET CLIENT ROLE ID - ERROR CASES
  // ============================================

  describe('❌ getClientRoleId - Error Cases', () => {
    it('Nên throw error khi CLIENT role không tồn tại', async () => {
      // Arrange: Mock database return empty array
      mockPrismaService.$queryRaw.mockResolvedValue([])

      // Act & Assert: Verify throw error
      await expect(service.getClientRoleId()).rejects.toThrow('Client role not found')
      expect(mockPrismaService.$queryRaw).toHaveBeenCalledTimes(1)
    })

    it('Nên throw error khi database query fails', async () => {
      // Arrange: Mock database error
      const dbError = new Error('Database connection failed')
      mockPrismaService.$queryRaw.mockRejectedValue(dbError)

      // Act & Assert: Verify error propagation
      await expect(service.getClientRoleId()).rejects.toThrow('Database connection failed')
    })

    it('Nên throw error khi role bị deleted (deletedAt not null)', async () => {
      // Arrange: SQL query có WHERE deletedAt IS NULL nên sẽ return empty array
      // khi role bị deleted
      mockPrismaService.$queryRaw.mockResolvedValue([])

      // Act & Assert: Verify throw error
      await expect(service.getClientRoleId()).rejects.toThrow('Client role not found')
    })

    it('Nên handle null response từ database', async () => {
      // Arrange: Mock database return null
      mockPrismaService.$queryRaw.mockResolvedValue(null as any)

      // Act & Assert: Verify error handling
      await expect(service.getClientRoleId()).rejects.toThrow()
    })
  })

  // ============================================
  // CACHING BEHAVIOR
  // ============================================

  describe('💾 Caching Behavior', () => {
    it('Nên không query database nếu đã có cache', async () => {
      // Arrange: Setup cache manually
      service['clientRoleId'] = 5

      // Act: Gọi getClientRoleId
      const result = await service.getClientRoleId()

      // Assert: Verify return cached value, không query database
      expect(result).toBe(5)
      expect(mockPrismaService.$queryRaw).not.toHaveBeenCalled()
    })

    it('Nên persist cache across multiple calls', async () => {
      // Arrange: Chuẩn bị mock role
      const mockRole = createMockRole({ id: 7 })
      mockPrismaService.$queryRaw.mockResolvedValue([mockRole])

      // Act: Gọi getClientRoleId nhiều lần
      await service.getClientRoleId()
      await service.getClientRoleId()
      await service.getClientRoleId()

      // Assert: Verify cache persists, chỉ query 1 lần
      expect(mockPrismaService.$queryRaw).toHaveBeenCalledTimes(1)
      expect(service['clientRoleId']).toBe(7)
    })

    it('Nên cache role ID ngay sau khi query thành công', async () => {
      // Arrange: Chuẩn bị mock role
      const mockRole = createMockRole({ id: 10 })
      mockPrismaService.$queryRaw.mockResolvedValue([mockRole])

      // Act: Gọi getClientRoleId
      const result = await service.getClientRoleId()

      // Assert: Verify cache được set ngay lập tức
      expect(result).toBe(10)
      expect(service['clientRoleId']).toBe(10)
    })
  })

  // ============================================
  // EDGE CASES
  // ============================================

  describe('⚠️ Edge Cases', () => {
    it('Nên handle role ID = 0', async () => {
      // Arrange: Mock role với ID = 0 (edge case)
      const mockRole = createMockRole({ id: 0 })
      mockPrismaService.$queryRaw.mockResolvedValue([mockRole])

      // Act: Gọi getClientRoleId
      const result = await service.getClientRoleId()

      // Assert: Verify handle ID = 0 correctly
      expect(result).toBe(0)
      expect(service['clientRoleId']).toBe(0)
    })

    it('Nên return cached ID = 0 (0 là valid role ID)', async () => {
      // Arrange: Setup cache với ID = 0 (0 là valid role ID trong database)
      service['clientRoleId'] = 0
      const mockRole = createMockRole({ id: 2 })
      mockPrismaService.$queryRaw.mockResolvedValue([mockRole])

      // Act: Gọi getClientRoleId
      const result = await service.getClientRoleId()

      // Assert: Verify return cached value 0 (không query lại vì 0 !== null)
      expect(result).toBe(0)
      expect(mockPrismaService.$queryRaw).not.toHaveBeenCalled()
    })

    it('Nên handle very large role ID', async () => {
      // Arrange: Mock role với very large ID
      const mockRole = createMockRole({ id: 2147483647 }) // Max int32
      mockPrismaService.$queryRaw.mockResolvedValue([mockRole])

      // Act: Gọi getClientRoleId
      const result = await service.getClientRoleId()

      // Assert: Verify handle large ID
      expect(result).toBe(2147483647)
    })
  })
})
