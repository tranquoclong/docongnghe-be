import { Test, TestingModule } from '@nestjs/testing'
import { CategoryTranslationAlreadyExistsException } from 'src/routes/category/category-translation/category-translation.error'
import {
  CreateCategoryTranslationBodyType,
  UpdateCategoryTranslationBodyType,
} from 'src/routes/category/category-translation/category-translation.model'
import { CategoryTranslationRepo } from 'src/routes/category/category-translation/category-translation.repo'
import { CategoryTranslationService } from 'src/routes/category/category-translation/category-translation.service'
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

describe('CategoryTranslationService', () => {
  let service: CategoryTranslationService
  let categoryTranslationRepo: jest.Mocked<CategoryTranslationRepo>

  const createTestData = {
    categoryTranslation: (overrides = {}) => ({
      id: 1,
      categoryId: 1,
      languageId: 'vi',
      name: 'Danh mục Test',
      description: 'Mô tả danh mục',
      createdById: 1,
      updatedById: null,
      deletedById: null,
      deletedAt: null,
      createdAt: '2024-01-01T00:00:00.000Z',
      updatedAt: '2024-01-01T00:00:00.000Z',
      ...overrides,
    }),
    createCategoryTranslationData: (overrides = {}): CreateCategoryTranslationBodyType => ({
      categoryId: 1,
      languageId: 'en',
      name: 'Test Category',
      description: 'Category description',
      ...overrides,
    }),
    updateCategoryTranslationData: (overrides = {}): UpdateCategoryTranslationBodyType => ({
      categoryId: 1,
      languageId: 'en',
      name: 'Updated Category',
      description: 'Updated description',
      ...overrides,
    }),
  }

  beforeEach(async () => {
    jest.clearAllMocks()
    mockIsNotFoundPrismaError.mockReturnValue(false)
    mockIsUniqueConstraintPrismaError.mockReturnValue(false)

    const mockCategoryTranslationRepo = {
      findById: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    }

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CategoryTranslationService,
        {
          provide: CategoryTranslationRepo,
          useValue: mockCategoryTranslationRepo,
        },
      ],
    }).compile()

    service = module.get<CategoryTranslationService>(CategoryTranslationService)
    categoryTranslationRepo = module.get(CategoryTranslationRepo)
  })

  describe('findById', () => {
    it('should return category translation when found', async () => {
      const mockCategoryTranslation = createTestData.categoryTranslation()
      categoryTranslationRepo.findById.mockResolvedValue(mockCategoryTranslation as any)

      const result = await service.findById(1)

      expect(result).toEqual(mockCategoryTranslation)
      expect(categoryTranslationRepo.findById).toHaveBeenCalledWith(1)
    })

    it('should throw NotFoundRecordException when category translation not found', async () => {
      categoryTranslationRepo.findById.mockResolvedValue(null)

      await expect(service.findById(999)).rejects.toThrow('Error.NotFound')
    })
  })

  describe('create', () => {
    it('should create category translation successfully', async () => {
      const createData = createTestData.createCategoryTranslationData()
      const mockCategoryTranslation = createTestData.categoryTranslation({ languageId: 'en', name: 'Test Category' })
      categoryTranslationRepo.create.mockResolvedValue(mockCategoryTranslation as any)

      const result = await service.create({
        data: createData,
        createdById: 1,
      })

      expect(result).toEqual(mockCategoryTranslation)
      expect(categoryTranslationRepo.create).toHaveBeenCalledWith({
        createdById: 1,
        data: createData,
      })
    })

    it('should throw CategoryTranslationAlreadyExistsException when translation already exists', async () => {
      const createData = createTestData.createCategoryTranslationData()
      const prismaError = new Error('Unique constraint failed')
      ;(prismaError as any).code = 'P2002'
      categoryTranslationRepo.create.mockRejectedValue(prismaError)
      mockIsUniqueConstraintPrismaError.mockReturnValue(true)

      await expect(
        service.create({
          data: createData,
          createdById: 1,
        }),
      ).rejects.toThrow(CategoryTranslationAlreadyExistsException)
    })

    it('should rethrow error when Prisma throws other error', async () => {
      const createData = createTestData.createCategoryTranslationData()
      const otherError = new Error('Other error')
      categoryTranslationRepo.create.mockRejectedValue(otherError)

      await expect(
        service.create({
          data: createData,
          createdById: 1,
        }),
      ).rejects.toThrow(otherError)
    })
  })

  describe('update', () => {
    it('should update category translation successfully', async () => {
      const updateData = createTestData.updateCategoryTranslationData()
      const mockCategoryTranslation = createTestData.categoryTranslation({ name: 'Updated Category' })
      categoryTranslationRepo.update.mockResolvedValue(mockCategoryTranslation as any)

      const result = await service.update({
        id: 1,
        data: updateData,
        updatedById: 1,
      })

      expect(result).toEqual(mockCategoryTranslation)
      expect(categoryTranslationRepo.update).toHaveBeenCalledWith({
        id: 1,
        updatedById: 1,
        data: updateData,
      })
    })

    it('should throw CategoryTranslationAlreadyExistsException when unique constraint violated', async () => {
      const updateData = createTestData.updateCategoryTranslationData()
      const prismaError = new Error('Unique constraint failed')
      ;(prismaError as any).code = 'P2002'
      categoryTranslationRepo.update.mockRejectedValue(prismaError)
      mockIsUniqueConstraintPrismaError.mockReturnValue(true)

      await expect(
        service.update({
          id: 1,
          data: updateData,
          updatedById: 1,
        }),
      ).rejects.toThrow(CategoryTranslationAlreadyExistsException)
    })

    it('should throw NotFoundRecordException when category translation not found', async () => {
      const updateData = createTestData.updateCategoryTranslationData()
      const prismaError = new Error('Record not found')
      ;(prismaError as any).code = 'P2025'
      categoryTranslationRepo.update.mockRejectedValue(prismaError)
      mockIsNotFoundPrismaError.mockReturnValue(true)

      await expect(
        service.update({
          id: 999,
          data: updateData,
          updatedById: 1,
        }),
      ).rejects.toThrow('Error.NotFound')
    })

    it('should rethrow error when Prisma throws other error', async () => {
      const updateData = createTestData.updateCategoryTranslationData()
      const otherError = new Error('Other error')
      categoryTranslationRepo.update.mockRejectedValue(otherError)

      await expect(
        service.update({
          id: 1,
          data: updateData,
          updatedById: 1,
        }),
      ).rejects.toThrow(otherError)
    })
  })

  describe('delete', () => {
    it('should delete category translation successfully', async () => {
      categoryTranslationRepo.delete.mockResolvedValue(undefined as any)

      const result = await service.delete({
        id: 1,
        deletedById: 1,
      })

      expect(result).toEqual({ message: MESSAGES.DELETE_SUCCESS })
      expect(categoryTranslationRepo.delete).toHaveBeenCalledWith({
        id: 1,
        deletedById: 1,
      })
    })

    it('should throw NotFoundRecordException when category translation not found', async () => {
      const prismaError = new Error('Record not found')
      ;(prismaError as any).code = 'P2025'
      categoryTranslationRepo.delete.mockRejectedValue(prismaError)
      mockIsNotFoundPrismaError.mockReturnValue(true)

      await expect(
        service.delete({
          id: 999,
          deletedById: 1,
        }),
      ).rejects.toThrow('Error.NotFound')
    })

    it('should rethrow error when Prisma throws other error', async () => {
      const otherError = new Error('Other error')
      categoryTranslationRepo.delete.mockRejectedValue(otherError)

      await expect(
        service.delete({
          id: 1,
          deletedById: 1,
        }),
      ).rejects.toThrow(otherError)
    })
  })
})
