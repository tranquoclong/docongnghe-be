import { Test, TestingModule } from '@nestjs/testing'
import { PrismaService } from 'src/shared/services/prisma.service'
import { LanguageRepo } from '../language.repo'

describe('LanguageRepo', () => {
  let repository: LanguageRepo

  // Mock PrismaService
  const mockPrismaService = {
    language: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
  }

  // Test data factory
  const createTestData = {
    language: (overrides = {}) => ({
      id: 'en',
      name: 'English',
      code: 'en',
      createdById: 1,
      updatedById: null,
      deletedAt: null,
      createdAt: new Date('2024-01-01'),
      updatedAt: new Date('2024-01-01'),
      ...overrides,
    }),
  }

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LanguageRepo,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile()

    repository = module.get<LanguageRepo>(LanguageRepo)

    // Reset mocks
    jest.clearAllMocks()
  })

  describe('findAll', () => {
    it('should get all languages', async () => {
      // Arrange - Chuẩn bị dữ liệu
      const mockLanguages = [
        createTestData.language({ id: 'en', name: 'English', code: 'en' }),
        createTestData.language({ id: 'vi', name: 'Vietnamese', code: 'vi' }),
        createTestData.language({ id: 'fr', name: 'French', code: 'fr' }),
      ]

      mockPrismaService.language.findMany.mockResolvedValue(mockLanguages)

      // Act - Thực hiện lấy danh sách languages
      const result = await repository.findAll()

      // Assert - Kiểm tra kết quả
      expect(result).toHaveLength(3)
      expect(result[0]).toMatchObject({ id: 'en', name: 'English' })
      expect(result[1]).toMatchObject({ id: 'vi', name: 'Vietnamese' })
      expect(result[2]).toMatchObject({ id: 'fr', name: 'French' })
      expect(mockPrismaService.language.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { deletedAt: null },
        }),
      )
    })

    it('should only return languages that are not deleted', async () => {
      // Arrange - Chuẩn bị dữ liệu
      const mockLanguages = [createTestData.language({ deletedAt: null })]

      mockPrismaService.language.findMany.mockResolvedValue(mockLanguages)

      // Act - Thực hiện lấy danh sách languages
      await repository.findAll()

      // Assert - Kiểm tra kết quả
      expect(mockPrismaService.language.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { deletedAt: null },
        }),
      )
    })

    it('should return empty array when no languages found', async () => {
      // Arrange - Chuẩn bị dữ liệu
      mockPrismaService.language.findMany.mockResolvedValue([])

      // Act - Thực hiện lấy danh sách languages
      const result = await repository.findAll()

      // Assert - Kiểm tra kết quả
      expect(result).toEqual([])
      expect(result).toHaveLength(0)
    })
  })

  describe('findById', () => {
    it('should find language by id', async () => {
      // Arrange - Chuẩn bị dữ liệu
      const id = 'en'
      const mockLanguage = createTestData.language({ id })

      mockPrismaService.language.findUnique.mockResolvedValue(mockLanguage)

      // Act - Thực hiện tìm language
      const result = await repository.findById(id)

      // Assert - Kiểm tra kết quả
      expect(result).toMatchObject({
        id: 'en',
        name: 'English',
        code: 'en',
      })
      expect(mockPrismaService.language.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id, deletedAt: null },
        }),
      )
    })

    it('should return null when language not found', async () => {
      // Arrange - Chuẩn bị dữ liệu
      const id = 'unknown'

      mockPrismaService.language.findUnique.mockResolvedValue(null)

      // Act - Thực hiện tìm language
      const result = await repository.findById(id)

      // Assert - Kiểm tra kết quả
      expect(result).toBeNull()
    })

    it('should not return deleted language', async () => {
      // Arrange - Chuẩn bị dữ liệu
      const id = 'en'

      mockPrismaService.language.findUnique.mockResolvedValue(null)

      // Act - Thực hiện tìm language đã bị xóa
      const result = await repository.findById(id)

      // Assert - Kiểm tra kết quả
      expect(result).toBeNull()
      expect(mockPrismaService.language.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id, deletedAt: null },
        }),
      )
    })
  })

  describe('create', () => {
    it('should create language successfully', async () => {
      // Arrange - Chuẩn bị dữ liệu
      const createdById = 1
      const data = {
        id: 'es',
        name: 'Spanish',
        code: 'es',
      }
      const mockLanguage = createTestData.language({ ...data, createdById })

      mockPrismaService.language.create.mockResolvedValue(mockLanguage)

      // Act - Thực hiện tạo language
      const result = await repository.create({ createdById, data })

      // Assert - Kiểm tra kết quả
      expect(result).toMatchObject({
        id: 'es',
        name: 'Spanish',
        code: 'es',
        createdById: 1,
      })
      expect(mockPrismaService.language.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: {
            ...data,
            createdById,
          },
        }),
      )
    })

    it('should create language with different createdById', async () => {
      // Arrange - Chuẩn bị dữ liệu
      const createdById = 5
      const data = {
        id: 'de',
        name: 'German',
        code: 'de',
      }
      const mockLanguage = createTestData.language({ ...data, createdById })

      mockPrismaService.language.create.mockResolvedValue(mockLanguage)

      // Act - Thực hiện tạo language với createdById khác
      const result = await repository.create({ createdById, data })

      // Assert - Kiểm tra kết quả
      expect(result).toMatchObject({
        createdById: 5,
      })
    })
  })

  describe('update', () => {
    it('should update language successfully', async () => {
      // Arrange - Chuẩn bị dữ liệu
      const id = 'en'
      const updatedById = 2
      const data = {
        name: 'English (US)',
        code: 'en-US',
      }
      const mockLanguage = createTestData.language({ id, ...data, updatedById })

      mockPrismaService.language.update.mockResolvedValue(mockLanguage)

      // Act - Thực hiện cập nhật language
      const result = await repository.update({ id, updatedById, data })

      // Assert - Kiểm tra kết quả
      expect(result).toMatchObject({
        id: 'en',
        name: 'English (US)',
        code: 'en-US',
        updatedById: 2,
      })
      expect(mockPrismaService.language.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id, deletedAt: null },
          data: {
            ...data,
            updatedById,
          },
        }),
      )
    })

    it('should not update deleted language', async () => {
      // Arrange - Chuẩn bị dữ liệu
      const id = 'en'
      const updatedById = 2
      const data = {
        name: 'English Updated',
        code: 'en',
      }

      mockPrismaService.language.update.mockResolvedValue(null)

      // Act - Thực hiện cập nhật language đã bị xóa
      const result = await repository.update({ id, updatedById, data })

      // Assert - Kiểm tra kết quả
      expect(mockPrismaService.language.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id, deletedAt: null },
        }),
      )
    })
  })

  describe('delete', () => {
    it('should soft delete language by default', async () => {
      // Arrange - Chuẩn bị dữ liệu
      const id = 'en'
      const mockLanguage = createTestData.language({ id, deletedAt: new Date() })

      mockPrismaService.language.update.mockResolvedValue(mockLanguage)

      // Act - Thực hiện soft delete language
      const result = await repository.delete(id)

      // Assert - Kiểm tra kết quả
      expect(result).toMatchObject({ id: 'en' })
      expect(mockPrismaService.language.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id, deletedAt: null },
          data: expect.objectContaining({
            deletedAt: expect.any(Date),
          }),
        }),
      )
      expect(mockPrismaService.language.delete).not.toHaveBeenCalled()
    })

    it('should hard delete language when isHard is true', async () => {
      // Arrange - Chuẩn bị dữ liệu
      const id = 'en'
      const mockLanguage = createTestData.language({ id })

      mockPrismaService.language.delete.mockResolvedValue(mockLanguage)

      // Act - Thực hiện hard delete language
      const result = await repository.delete(id, true)

      // Assert - Kiểm tra kết quả
      expect(result).toMatchObject({ id: 'en' })
      expect(mockPrismaService.language.delete).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id },
        }),
      )
      expect(mockPrismaService.language.update).not.toHaveBeenCalled()
    })

    it('should soft delete language when isHard is false', async () => {
      // Arrange - Chuẩn bị dữ liệu
      const id = 'vi'
      const mockLanguage = createTestData.language({ id, deletedAt: new Date() })

      mockPrismaService.language.update.mockResolvedValue(mockLanguage)

      // Act - Thực hiện soft delete language với isHard = false
      const result = await repository.delete(id, false)

      // Assert - Kiểm tra kết quả
      expect(result).toMatchObject({ id: 'vi' })
      expect(mockPrismaService.language.update).toHaveBeenCalled()
      expect(mockPrismaService.language.delete).not.toHaveBeenCalled()
    })
  })
})
