import { Test, TestingModule } from '@nestjs/testing'
import { ProductTranslationAlreadyExistsException } from 'src/routes/product/product-translation/product-translation.error'
import {
  CreateProductTranslationBodyType,
  UpdateProductTranslationBodyType,
} from 'src/routes/product/product-translation/product-translation.model'
import { ProductTranslationRepo } from 'src/routes/product/product-translation/product-translation.repo'
import { ProductTranslationService } from 'src/routes/product/product-translation/product-translation.service'
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

describe('ProductTranslationService', () => {
  let service: ProductTranslationService
  let productTranslationRepo: jest.Mocked<ProductTranslationRepo>

  const createTestData = {
    productTranslation: (overrides = {}) => ({
      id: 1,
      productId: 1,
      languageId: 'vi',
      name: 'Sản phẩm Test',
      description: 'Mô tả sản phẩm',
      createdById: 1,
      updatedById: null,
      deletedById: null,
      deletedAt: null,
      createdAt: '2024-01-01T00:00:00.000Z',
      updatedAt: '2024-01-01T00:00:00.000Z',
      ...overrides,
    }),
    createProductTranslationData: (overrides = {}): CreateProductTranslationBodyType => ({
      productId: 1,
      languageId: 'en',
      name: 'Test Product',
      description: 'Product description',
      ...overrides,
    }),
    updateProductTranslationData: (overrides = {}): UpdateProductTranslationBodyType => ({
      productId: 1,
      languageId: 'en',
      name: 'Updated Product',
      description: 'Updated description',
      ...overrides,
    }),
  }

  beforeEach(async () => {
    jest.clearAllMocks()
    mockIsNotFoundPrismaError.mockReturnValue(false)
    mockIsUniqueConstraintPrismaError.mockReturnValue(false)

    const mockProductTranslationRepo = {
      findById: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    }

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProductTranslationService,
        {
          provide: ProductTranslationRepo,
          useValue: mockProductTranslationRepo,
        },
      ],
    }).compile()

    service = module.get<ProductTranslationService>(ProductTranslationService)
    productTranslationRepo = module.get(ProductTranslationRepo)
  })

  describe('findById', () => {
    it('should return product translation when found', async () => {
      const mockProductTranslation = createTestData.productTranslation()
      productTranslationRepo.findById.mockResolvedValue(mockProductTranslation as any)

      const result = await service.findById(1)

      expect(result).toEqual(mockProductTranslation)
      expect(productTranslationRepo.findById).toHaveBeenCalledWith(1)
    })

    it('should throw NotFoundRecordException when product translation not found', async () => {
      productTranslationRepo.findById.mockResolvedValue(null)

      await expect(service.findById(999)).rejects.toThrow('Error.NotFound')
    })
  })

  describe('create', () => {
    it('should create product translation successfully', async () => {
      const createData = createTestData.createProductTranslationData()
      const mockProductTranslation = createTestData.productTranslation({ languageId: 'en', name: 'Test Product' })
      productTranslationRepo.create.mockResolvedValue(mockProductTranslation as any)

      const result = await service.create({
        data: createData,
        createdById: 1,
      })

      expect(result).toEqual(mockProductTranslation)
      expect(productTranslationRepo.create).toHaveBeenCalledWith({
        createdById: 1,
        data: createData,
      })
    })

    it('should throw ProductTranslationAlreadyExistsException when translation already exists', async () => {
      const createData = createTestData.createProductTranslationData()
      const prismaError = new Error('Unique constraint failed')
      ;(prismaError as any).code = 'P2002'
      productTranslationRepo.create.mockRejectedValue(prismaError)
      mockIsUniqueConstraintPrismaError.mockReturnValue(true)

      await expect(
        service.create({
          data: createData,
          createdById: 1,
        }),
      ).rejects.toThrow(ProductTranslationAlreadyExistsException)
    })

    it('should rethrow error when Prisma throws other error', async () => {
      const createData = createTestData.createProductTranslationData()
      const otherError = new Error('Other error')
      productTranslationRepo.create.mockRejectedValue(otherError)

      await expect(
        service.create({
          data: createData,
          createdById: 1,
        }),
      ).rejects.toThrow(otherError)
    })
  })

  describe('update', () => {
    it('should update product translation successfully', async () => {
      const updateData = createTestData.updateProductTranslationData()
      const mockProductTranslation = createTestData.productTranslation({ name: 'Updated Product' })
      productTranslationRepo.update.mockResolvedValue(mockProductTranslation as any)

      const result = await service.update({
        id: 1,
        data: updateData,
        updatedById: 1,
      })

      expect(result).toEqual(mockProductTranslation)
      expect(productTranslationRepo.update).toHaveBeenCalledWith({
        id: 1,
        updatedById: 1,
        data: updateData,
      })
    })

    it('should throw ProductTranslationAlreadyExistsException when unique constraint violated', async () => {
      const updateData = createTestData.updateProductTranslationData()
      const prismaError = new Error('Unique constraint failed')
      ;(prismaError as any).code = 'P2002'
      productTranslationRepo.update.mockRejectedValue(prismaError)
      mockIsUniqueConstraintPrismaError.mockReturnValue(true)

      await expect(
        service.update({
          id: 1,
          data: updateData,
          updatedById: 1,
        }),
      ).rejects.toThrow(ProductTranslationAlreadyExistsException)
    })

    it('should throw NotFoundRecordException when product translation not found', async () => {
      const updateData = createTestData.updateProductTranslationData()
      const prismaError = new Error('Record not found')
      ;(prismaError as any).code = 'P2025'
      productTranslationRepo.update.mockRejectedValue(prismaError)
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
      const updateData = createTestData.updateProductTranslationData()
      const otherError = new Error('Other error')
      productTranslationRepo.update.mockRejectedValue(otherError)

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
    it('should delete product translation successfully', async () => {
      productTranslationRepo.delete.mockResolvedValue(undefined as any)

      const result = await service.delete({
        id: 1,
        deletedById: 1,
      })

      expect(result).toEqual({ message: MESSAGES.DELETE_SUCCESS })
      expect(productTranslationRepo.delete).toHaveBeenCalledWith({
        id: 1,
        deletedById: 1,
      })
    })

    it('should throw NotFoundRecordException when product translation not found', async () => {
      const prismaError = new Error('Record not found')
      ;(prismaError as any).code = 'P2025'
      productTranslationRepo.delete.mockRejectedValue(prismaError)
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
      productTranslationRepo.delete.mockRejectedValue(otherError)

      await expect(
        service.delete({
          id: 1,
          deletedById: 1,
        }),
      ).rejects.toThrow(otherError)
    })
  })
})
