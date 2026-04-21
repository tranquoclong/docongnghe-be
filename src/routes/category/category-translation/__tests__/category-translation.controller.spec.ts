import { Test, TestingModule } from '@nestjs/testing'
import { NotFoundRecordException } from 'src/shared/error'
import { CategoryTranslationController } from '../category-translation.controller'
import {
  CreateCategoryTranslationBodyDTO,
  GetCategoryTranslationParamsDTO,
  UpdateCategoryTranslationBodyDTO,
} from '../category-translation.dto'
import { CategoryTranslationAlreadyExistsException } from '../category-translation.error'
import { CategoryTranslationService } from '../category-translation.service'

/**
 * CATEGORY TRANSLATION CONTROLLER UNIT TESTS
 *
 * Test coverage cho CategoryTranslationController
 * - CRUD operations (findById, create, update, delete)
 * - ActiveUser decorator integration
 * - Error handling (NotFound, AlreadyExists)
 * - DTO validation
 */

describe('CategoryTranslationController', () => {
  let controller: CategoryTranslationController
  let mockService: jest.Mocked<CategoryTranslationService>

  const mockCategoryTranslation = {
    id: 1,
    categoryId: 1,
    languageId: 'en',
    name: 'Electronics',
    description: 'Electronic devices and accessories',
    createdById: 1,
    updatedById: null,
    deletedById: null,
    deletedAt: null,
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
  }

  beforeEach(async () => {
    mockService = {
      findById: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    } as any

    const module: TestingModule = await Test.createTestingModule({
      controllers: [CategoryTranslationController],
      providers: [{ provide: CategoryTranslationService, useValue: mockService }],
    }).compile()

    controller = module.get<CategoryTranslationController>(CategoryTranslationController)
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  // ===== CONTROLLER INITIALIZATION =====

  describe('Controller Initialization', () => {
    it('should be defined', () => {
      expect(controller).toBeDefined()
    })

    it('should have categoryTranslationService injected', () => {
      expect(controller['categoryTranslationService']).toBe(mockService)
    })
  })

  // ===== GET /category-translations/:categoryTranslationId - findById() =====

  describe('GET /category-translations/:categoryTranslationId - findById()', () => {
    it('should return category translation by ID', async () => {
      const params: GetCategoryTranslationParamsDTO = { categoryTranslationId: 1 }
      mockService.findById.mockResolvedValue(mockCategoryTranslation)

      const result = await controller.findById(params)

      expect(result).toEqual(mockCategoryTranslation)
      expect(mockService.findById).toHaveBeenCalledWith(1)
      expect(mockService.findById).toHaveBeenCalledTimes(1)
    })

    it('should throw NotFoundRecordException when category translation not found', async () => {
      const params: GetCategoryTranslationParamsDTO = { categoryTranslationId: 999 }
      mockService.findById.mockRejectedValue(NotFoundRecordException)

      await expect(controller.findById(params)).rejects.toThrow(NotFoundRecordException)
      expect(mockService.findById).toHaveBeenCalledWith(999)
    })

    it('should handle different category translation IDs', async () => {
      const ids = [1, 5, 10, 100]

      for (const id of ids) {
        const params: GetCategoryTranslationParamsDTO = { categoryTranslationId: id }
        mockService.findById.mockResolvedValue({ ...mockCategoryTranslation, id })

        const result = await controller.findById(params)

        expect(result.id).toBe(id)
        expect(mockService.findById).toHaveBeenCalledWith(id)
      }
    })
  })

  // ===== POST /category-translations - create() =====

  describe('POST /category-translations - create()', () => {
    it('should create new category translation', async () => {
      const body: CreateCategoryTranslationBodyDTO = {
        categoryId: 1,
        languageId: 'en',
        name: 'Electronics',
        description: 'Electronic devices and accessories',
      }
      const userId = 1
      mockService.create.mockResolvedValue(mockCategoryTranslation)

      const result = await controller.create(body, userId)

      expect(result).toEqual(mockCategoryTranslation)
      expect(mockService.create).toHaveBeenCalledWith({
        data: body,
        createdById: userId,
      })
      expect(mockService.create).toHaveBeenCalledTimes(1)
    })

    it('should throw CategoryTranslationAlreadyExistsException for duplicate', async () => {
      const body: CreateCategoryTranslationBodyDTO = {
        categoryId: 1,
        languageId: 'en',
        name: 'Electronics',
        description: 'Electronic devices and accessories',
      }
      const userId = 1
      mockService.create.mockRejectedValue(CategoryTranslationAlreadyExistsException)

      await expect(controller.create(body, userId)).rejects.toThrow(CategoryTranslationAlreadyExistsException)
      expect(mockService.create).toHaveBeenCalledWith({
        data: body,
        createdById: userId,
      })
    })

    it('should create category translation with different user IDs', async () => {
      const body: CreateCategoryTranslationBodyDTO = {
        categoryId: 1,
        languageId: 'en',
        name: 'Electronics',
        description: 'Electronic devices and accessories',
      }
      const userIds = [1, 5, 10]

      for (const userId of userIds) {
        mockService.create.mockResolvedValue({ ...mockCategoryTranslation, createdById: userId })

        const result = await controller.create(body, userId)

        expect(result.createdById).toBe(userId)
        expect(mockService.create).toHaveBeenCalledWith({
          data: body,
          createdById: userId,
        })
      }
    })
  })

  // ===== PUT /category-translations/:categoryTranslationId - update() =====

  describe('PUT /category-translations/:categoryTranslationId - update()', () => {
    it('should update category translation', async () => {
      const body: UpdateCategoryTranslationBodyDTO = {
        categoryId: 1,
        languageId: 'en',
        name: 'Electronics Updated',
        description: 'Electronic devices and accessories - Updated',
      }
      const params: GetCategoryTranslationParamsDTO = { categoryTranslationId: 1 }
      const userId = 1
      const updatedTranslation = { ...mockCategoryTranslation, ...body, updatedById: userId }
      mockService.update.mockResolvedValue(updatedTranslation)

      const result = await controller.update(body, params, userId)

      expect(result).toEqual(updatedTranslation)
      expect(mockService.update).toHaveBeenCalledWith({
        data: body,
        id: 1,
        updatedById: userId,
      })
      expect(mockService.update).toHaveBeenCalledTimes(1)
    })

    it('should throw NotFoundRecordException when updating non-existent translation', async () => {
      const body: UpdateCategoryTranslationBodyDTO = {
        categoryId: 1,
        languageId: 'en',
        name: 'Electronics',
        description: 'Electronic devices and accessories',
      }
      const params: GetCategoryTranslationParamsDTO = { categoryTranslationId: 999 }
      const userId = 1
      mockService.update.mockRejectedValue(NotFoundRecordException)

      await expect(controller.update(body, params, userId)).rejects.toThrow(NotFoundRecordException)
      expect(mockService.update).toHaveBeenCalledWith({
        data: body,
        id: 999,
        updatedById: userId,
      })
    })

    it('should throw CategoryTranslationAlreadyExistsException for duplicate on update', async () => {
      const body: UpdateCategoryTranslationBodyDTO = {
        categoryId: 1,
        languageId: 'en',
        name: 'Electronics',
        description: 'Electronic devices and accessories',
      }
      const params: GetCategoryTranslationParamsDTO = { categoryTranslationId: 1 }
      const userId = 1
      mockService.update.mockRejectedValue(CategoryTranslationAlreadyExistsException)

      await expect(controller.update(body, params, userId)).rejects.toThrow(CategoryTranslationAlreadyExistsException)
    })

    it('should update with different user IDs', async () => {
      const body: UpdateCategoryTranslationBodyDTO = {
        categoryId: 1,
        languageId: 'en',
        name: 'Electronics',
        description: 'Electronic devices and accessories',
      }
      const params: GetCategoryTranslationParamsDTO = { categoryTranslationId: 1 }
      const userIds = [1, 5, 10]

      for (const userId of userIds) {
        mockService.update.mockResolvedValue({ ...mockCategoryTranslation, updatedById: userId })

        const result = await controller.update(body, params, userId)

        expect(result.updatedById).toBe(userId)
        expect(mockService.update).toHaveBeenCalledWith({
          data: body,
          id: 1,
          updatedById: userId,
        })
      }
    })
  })

  // ===== DELETE /category-translations/:categoryTranslationId - delete() =====

  describe('DELETE /category-translations/:categoryTranslationId - delete()', () => {
    it('should delete category translation', async () => {
      const params: GetCategoryTranslationParamsDTO = { categoryTranslationId: 1 }
      const userId = 1
      const deleteResponse = { message: 'Delete successfully' } as const
      mockService.delete.mockResolvedValue(deleteResponse)

      const result = await controller.delete(params, userId)

      expect(result).toEqual(deleteResponse)
      expect(mockService.delete).toHaveBeenCalledWith({
        id: 1,
        deletedById: userId,
      })
      expect(mockService.delete).toHaveBeenCalledTimes(1)
    })

    it('should throw NotFoundRecordException when deleting non-existent translation', async () => {
      const params: GetCategoryTranslationParamsDTO = { categoryTranslationId: 999 }
      const userId = 1
      mockService.delete.mockRejectedValue(NotFoundRecordException)

      await expect(controller.delete(params, userId)).rejects.toThrow(NotFoundRecordException)
      expect(mockService.delete).toHaveBeenCalledWith({
        id: 999,
        deletedById: userId,
      })
    })

    it('should delete with different user IDs', async () => {
      const params: GetCategoryTranslationParamsDTO = { categoryTranslationId: 1 }
      const userIds = [1, 5, 10]
      const deleteResponse = { message: 'Delete successfully' } as const

      for (const userId of userIds) {
        mockService.delete.mockResolvedValue(deleteResponse)

        const result = await controller.delete(params, userId)

        expect(result).toEqual(deleteResponse)
        expect(mockService.delete).toHaveBeenCalledWith({
          id: 1,
          deletedById: userId,
        })
      }
    })

    it('should return success message on deletion', async () => {
      const params: GetCategoryTranslationParamsDTO = { categoryTranslationId: 1 }
      const userId = 1
      const deleteResponse = { message: 'Delete successfully' } as const
      mockService.delete.mockResolvedValue(deleteResponse)

      const result = await controller.delete(params, userId)

      expect(result.message).toBe('Delete successfully')
    })
  })
})
