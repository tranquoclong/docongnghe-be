import { Test, TestingModule } from '@nestjs/testing'
import { LanguageAlreadyExistsException } from 'src/routes/language/language.error'
import { CreateLanguageBodyType, UpdateLanguageBodyType } from 'src/routes/language/language.model'
import { LanguageRepo } from 'src/routes/language/language.repo'
import { LanguageService } from 'src/routes/language/language.service'
import { NotFoundRecordException } from 'src/shared/error'
import { isNotFoundPrismaError, isUniqueConstraintPrismaError } from 'src/shared/helpers'
import { MESSAGES } from 'src/shared/constants/app.constant'

// Mock helpers
jest.mock('src/shared/helpers', () => ({
  isNotFoundPrismaError: jest.fn(),
  isUniqueConstraintPrismaError: jest.fn(),
}))

const mockIsNotFoundPrismaError = isNotFoundPrismaError as jest.MockedFunction<typeof isNotFoundPrismaError>
const mockIsUniqueConstraintPrismaError = isUniqueConstraintPrismaError as jest.MockedFunction<
  typeof isUniqueConstraintPrismaError
>

/**
 * LANGUAGE SERVICE UNIT TESTS
 *
 * Test coverage cho LanguageService - HIGH PRIORITY module cho I18n foundation
 * Service quản lý CRUD operations cho languages
 *
 * Test Coverage:
 * - findAll: List tất cả languages
 * - findById: Tìm language theo ID
 * - create: Tạo language mới
 * - update: Cập nhật language
 * - delete: Xóa language (hard delete)
 */
describe('LanguageService', () => {
  let service: LanguageService
  let languageRepo: jest.Mocked<LanguageRepo>

  // Test data factory
  const createTestData = {
    language: (overrides = {}) => ({
      id: 'vi',
      name: 'Tiếng Việt',
      createdById: 1,
      updatedById: null,
      deletedById: null,
      deletedAt: null,
      createdAt: '2024-01-01T00:00:00.000Z',
      updatedAt: '2024-01-01T00:00:00.000Z',
      ...overrides,
    }),
    createLanguageData: (overrides = {}): CreateLanguageBodyType => ({
      id: 'en',
      name: 'English',
      ...overrides,
    }),
    updateLanguageData: (overrides = {}): UpdateLanguageBodyType => ({
      name: 'Updated Language',
      ...overrides,
    }),
  }

  beforeEach(async () => {
    // Reset mocks
    jest.clearAllMocks()
    mockIsNotFoundPrismaError.mockReturnValue(false)
    mockIsUniqueConstraintPrismaError.mockReturnValue(false)

    // Create mock repository
    const mockLanguageRepo = {
      findAll: jest.fn(),
      findById: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    }

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LanguageService,
        {
          provide: LanguageRepo,
          useValue: mockLanguageRepo,
        },
      ],
    }).compile()

    service = module.get<LanguageService>(LanguageService)
    languageRepo = module.get(LanguageRepo)
  })

  describe('findAll', () => {
    it('should return all languages with totalItems', async () => {
      // Arrange - Chuẩn bị dữ liệu
      const mockLanguages = [createTestData.language(), createTestData.language({ id: 'en', name: 'English' })]
      languageRepo.findAll.mockResolvedValue(mockLanguages as any)

      // Act - Thực hiện findAll
      const result = await service.findAll()

      // Assert - Kiểm tra kết quả
      expect(result).toEqual({
        data: mockLanguages,
        totalItems: 2,
      })
      expect(languageRepo.findAll).toHaveBeenCalledTimes(1)
    })

    it('should return empty array when no languages exist', async () => {
      // Arrange - Chuẩn bị dữ liệu
      languageRepo.findAll.mockResolvedValue([])

      // Act - Thực hiện findAll
      const result = await service.findAll()

      // Assert - Kiểm tra kết quả
      expect(result).toEqual({
        data: [],
        totalItems: 0,
      })
    })
  })

  describe('findById', () => {
    it('should return language when found', async () => {
      // Arrange - Chuẩn bị dữ liệu
      const mockLanguage = createTestData.language()
      languageRepo.findById.mockResolvedValue(mockLanguage as any)

      // Act - Thực hiện findById
      const result = await service.findById('vi')

      // Assert - Kiểm tra kết quả
      expect(result).toEqual(mockLanguage)
      expect(languageRepo.findById).toHaveBeenCalledWith('vi')
    })

    it('should throw NotFoundRecordException when language not found', async () => {
      // Arrange - Chuẩn bị dữ liệu
      languageRepo.findById.mockResolvedValue(null)

      // Act & Assert - Thực hiện findById và kiểm tra exception
      await expect(service.findById('unknown')).rejects.toThrow('Error.NotFound')
    })
  })

  describe('create', () => {
    it('should create language successfully', async () => {
      // Arrange - Chuẩn bị dữ liệu
      const createData = createTestData.createLanguageData()
      const mockLanguage = createTestData.language({ id: 'en', name: 'English' })
      languageRepo.create.mockResolvedValue(mockLanguage as any)

      // Act - Thực hiện create
      const result = await service.create({
        data: createData,
        createdById: 1,
      })

      // Assert - Kiểm tra kết quả
      expect(result).toEqual(mockLanguage)
      expect(languageRepo.create).toHaveBeenCalledWith({
        createdById: 1,
        data: createData,
      })
    })

    it('should throw LanguageAlreadyExistsException when language ID already exists', async () => {
      // Arrange - Chuẩn bị dữ liệu
      const createData = createTestData.createLanguageData()
      const prismaError = new Error('Unique constraint failed')
      ;(prismaError as any).code = 'P2002'
      languageRepo.create.mockRejectedValue(prismaError)
      mockIsUniqueConstraintPrismaError.mockReturnValue(true)

      // Act & Assert - Thực hiện create và kiểm tra exception
      await expect(
        service.create({
          data: createData,
          createdById: 1,
        }),
      ).rejects.toThrow(LanguageAlreadyExistsException)
    })

    it('should rethrow error when Prisma throws other error', async () => {
      // Arrange - Chuẩn bị dữ liệu
      const createData = createTestData.createLanguageData()
      const otherError = new Error('Other error')
      languageRepo.create.mockRejectedValue(otherError)

      // Act & Assert - Thực hiện create và kiểm tra exception
      await expect(
        service.create({
          data: createData,
          createdById: 1,
        }),
      ).rejects.toThrow(otherError)
    })
  })

  describe('update', () => {
    it('should update language successfully', async () => {
      // Arrange - Chuẩn bị dữ liệu
      const updateData = createTestData.updateLanguageData()
      const mockLanguage = createTestData.language({ name: 'Updated Language' })
      languageRepo.update.mockResolvedValue(mockLanguage as any)

      // Act - Thực hiện update
      const result = await service.update({
        id: 'vi',
        data: updateData,
        updatedById: 1,
      })

      // Assert - Kiểm tra kết quả
      expect(result).toEqual(mockLanguage)
      expect(languageRepo.update).toHaveBeenCalledWith({
        id: 'vi',
        updatedById: 1,
        data: updateData,
      })
    })

    it('should throw NotFoundRecordException when language not found', async () => {
      // Arrange - Chuẩn bị dữ liệu
      const updateData = createTestData.updateLanguageData()
      const prismaError = new Error('Record not found')
      ;(prismaError as any).code = 'P2025'
      languageRepo.update.mockRejectedValue(prismaError)
      mockIsNotFoundPrismaError.mockReturnValue(true)

      // Act & Assert - Thực hiện update và kiểm tra exception
      await expect(
        service.update({
          id: 'unknown',
          data: updateData,
          updatedById: 1,
        }),
      ).rejects.toThrow('Error.NotFound')
    })

    it('should rethrow error when Prisma throws other error', async () => {
      // Arrange - Chuẩn bị dữ liệu
      const updateData = createTestData.updateLanguageData()
      const otherError = new Error('Other error')
      languageRepo.update.mockRejectedValue(otherError)

      // Act & Assert - Thực hiện update và kiểm tra exception
      await expect(
        service.update({
          id: 'vi',
          data: updateData,
          updatedById: 1,
        }),
      ).rejects.toThrow(otherError)
    })
  })

  describe('delete', () => {
    it('should delete language successfully (hard delete)', async () => {
      // Arrange - Chuẩn bị dữ liệu
      languageRepo.delete.mockResolvedValue(undefined as any)

      // Act - Thực hiện delete
      const result = await service.delete('vi')

      // Assert - Kiểm tra kết quả
      expect(result).toEqual({ message: MESSAGES.DELETE_SUCCESS })
      expect(languageRepo.delete).toHaveBeenCalledWith('vi', true)
    })

    it('should throw NotFoundRecordException when language not found', async () => {
      // Arrange - Chuẩn bị dữ liệu
      const prismaError = new Error('Record not found')
      ;(prismaError as any).code = 'P2025'
      languageRepo.delete.mockRejectedValue(prismaError)
      mockIsNotFoundPrismaError.mockReturnValue(true)

      // Act & Assert - Thực hiện delete và kiểm tra exception
      await expect(service.delete('unknown')).rejects.toThrow('Error.NotFound')
    })

    it('should rethrow error when Prisma throws other error', async () => {
      // Arrange - Chuẩn bị dữ liệu
      const otherError = new Error('Other error')
      languageRepo.delete.mockRejectedValue(otherError)

      // Act & Assert - Thực hiện delete và kiểm tra exception
      await expect(service.delete('vi')).rejects.toThrow(otherError)
    })
  })
})
