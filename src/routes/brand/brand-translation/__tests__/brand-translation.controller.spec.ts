import { Test, TestingModule } from '@nestjs/testing'
import { NotFoundRecordException } from 'src/shared/error'
import { BrandTranslationController } from '../brand-translation.controller'
import {
  CreateBrandTranslationBodyDTO,
  GetBrandTranslationParamsDTO,
  UpdateBrandTranslationBodyDTO,
} from '../brand-translation.dto'
import { BrandTranslationAlreadyExistsException } from '../brand-translation.error'
import { BrandTranslationService } from '../brand-translation.service'

/**
 * BRAND TRANSLATION CONTROLLER UNIT TESTS
 *
 * Test coverage cho BrandTranslationController
 * - CRUD operations (findById, create, update, delete)
 * - ActiveUser decorator integration
 * - Error handling (NotFound, AlreadyExists)
 * - DTO validation
 */

describe('BrandTranslationController', () => {
  let controller: BrandTranslationController
  let mockService: jest.Mocked<BrandTranslationService>

  const mockBrandTranslation = {
    id: 1,
    brandId: 1,
    languageId: 'en',
    name: 'Nike',
    description: 'Just Do It',
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
      controllers: [BrandTranslationController],
      providers: [{ provide: BrandTranslationService, useValue: mockService }],
    }).compile()

    controller = module.get<BrandTranslationController>(BrandTranslationController)
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  // ===== CONTROLLER INITIALIZATION =====

  describe('Controller Initialization', () => {
    it('should be defined', () => {
      expect(controller).toBeDefined()
    })

    it('should have brandTranslationService injected', () => {
      expect(controller['brandTranslationService']).toBe(mockService)
    })
  })

  // ===== GET /brand-translations/:brandTranslationId - findById() =====

  describe('GET /brand-translations/:brandTranslationId - findById()', () => {
    it('should return brand translation by ID', async () => {
      const params: GetBrandTranslationParamsDTO = { brandTranslationId: 1 }
      mockService.findById.mockResolvedValue(mockBrandTranslation)

      const result = await controller.findById(params)

      expect(result).toEqual(mockBrandTranslation)
      expect(mockService.findById).toHaveBeenCalledWith(1)
      expect(mockService.findById).toHaveBeenCalledTimes(1)
    })

    it('should throw NotFoundRecordException when brand translation not found', async () => {
      const params: GetBrandTranslationParamsDTO = { brandTranslationId: 999 }
      mockService.findById.mockRejectedValue(NotFoundRecordException)

      await expect(controller.findById(params)).rejects.toThrow(NotFoundRecordException)
      expect(mockService.findById).toHaveBeenCalledWith(999)
    })

    it('should handle different brand translation IDs', async () => {
      const ids = [1, 5, 10, 100]

      for (const id of ids) {
        const params: GetBrandTranslationParamsDTO = { brandTranslationId: id }
        mockService.findById.mockResolvedValue({ ...mockBrandTranslation, id })

        const result = await controller.findById(params)

        expect(result.id).toBe(id)
        expect(mockService.findById).toHaveBeenCalledWith(id)
      }
    })
  })

  // ===== POST /brand-translations - create() =====

  describe('POST /brand-translations - create()', () => {
    it('should create new brand translation', async () => {
      const body: CreateBrandTranslationBodyDTO = {
        brandId: 1,
        languageId: 'en',
        name: 'Nike',
        description: 'Just Do It',
      }
      const userId = 1
      mockService.create.mockResolvedValue(mockBrandTranslation)

      const result = await controller.create(body, userId)

      expect(result).toEqual(mockBrandTranslation)
      expect(mockService.create).toHaveBeenCalledWith({
        data: body,
        createdById: userId,
      })
      expect(mockService.create).toHaveBeenCalledTimes(1)
    })

    it('should throw BrandTranslationAlreadyExistsException for duplicate', async () => {
      const body: CreateBrandTranslationBodyDTO = {
        brandId: 1,
        languageId: 'en',
        name: 'Nike',
        description: 'Just Do It',
      }
      const userId = 1
      mockService.create.mockRejectedValue(BrandTranslationAlreadyExistsException)

      await expect(controller.create(body, userId)).rejects.toThrow(BrandTranslationAlreadyExistsException)
      expect(mockService.create).toHaveBeenCalledWith({
        data: body,
        createdById: userId,
      })
    })

    it('should create brand translation with different user IDs', async () => {
      const body: CreateBrandTranslationBodyDTO = {
        brandId: 1,
        languageId: 'en',
        name: 'Nike',
        description: 'Just Do It',
      }
      const userIds = [1, 5, 10]

      for (const userId of userIds) {
        mockService.create.mockResolvedValue({ ...mockBrandTranslation, createdById: userId })

        const result = await controller.create(body, userId)

        expect(result.createdById).toBe(userId)
        expect(mockService.create).toHaveBeenCalledWith({
          data: body,
          createdById: userId,
        })
      }
    })
  })

  // ===== PUT /brand-translations/:brandTranslationId - update() =====

  describe('PUT /brand-translations/:brandTranslationId - update()', () => {
    it('should update brand translation', async () => {
      const body: UpdateBrandTranslationBodyDTO = {
        brandId: 1,
        languageId: 'en',
        name: 'Nike Updated',
        description: 'Just Do It - Updated',
      }
      const params: GetBrandTranslationParamsDTO = { brandTranslationId: 1 }
      const userId = 1
      const updatedTranslation = { ...mockBrandTranslation, ...body, updatedById: userId }
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
      const body: UpdateBrandTranslationBodyDTO = {
        brandId: 1,
        languageId: 'en',
        name: 'Nike',
        description: 'Just Do It',
      }
      const params: GetBrandTranslationParamsDTO = { brandTranslationId: 999 }
      const userId = 1
      mockService.update.mockRejectedValue(NotFoundRecordException)

      await expect(controller.update(body, params, userId)).rejects.toThrow(NotFoundRecordException)
      expect(mockService.update).toHaveBeenCalledWith({
        data: body,
        id: 999,
        updatedById: userId,
      })
    })

    it('should throw BrandTranslationAlreadyExistsException for duplicate on update', async () => {
      const body: UpdateBrandTranslationBodyDTO = {
        brandId: 1,
        languageId: 'en',
        name: 'Nike',
        description: 'Just Do It',
      }
      const params: GetBrandTranslationParamsDTO = { brandTranslationId: 1 }
      const userId = 1
      mockService.update.mockRejectedValue(BrandTranslationAlreadyExistsException)

      await expect(controller.update(body, params, userId)).rejects.toThrow(BrandTranslationAlreadyExistsException)
    })

    it('should update with different user IDs', async () => {
      const body: UpdateBrandTranslationBodyDTO = {
        brandId: 1,
        languageId: 'en',
        name: 'Nike',
        description: 'Just Do It',
      }
      const params: GetBrandTranslationParamsDTO = { brandTranslationId: 1 }
      const userIds = [1, 5, 10]

      for (const userId of userIds) {
        mockService.update.mockResolvedValue({ ...mockBrandTranslation, updatedById: userId })

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

  // ===== DELETE /brand-translations/:brandTranslationId - delete() =====

  describe('DELETE /brand-translations/:brandTranslationId - delete()', () => {
    it('should delete brand translation', async () => {
      const params: GetBrandTranslationParamsDTO = { brandTranslationId: 1 }
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
      const params: GetBrandTranslationParamsDTO = { brandTranslationId: 999 }
      const userId = 1
      mockService.delete.mockRejectedValue(NotFoundRecordException)

      await expect(controller.delete(params, userId)).rejects.toThrow(NotFoundRecordException)
      expect(mockService.delete).toHaveBeenCalledWith({
        id: 999,
        deletedById: userId,
      })
    })

    it('should delete with different user IDs', async () => {
      const params: GetBrandTranslationParamsDTO = { brandTranslationId: 1 }
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
      const params: GetBrandTranslationParamsDTO = { brandTranslationId: 1 }
      const userId = 1
      const deleteResponse = { message: 'Delete successfully' } as const
      mockService.delete.mockResolvedValue(deleteResponse)

      const result = await controller.delete(params, userId)

      expect(result.message).toBe('Delete successfully')
    })
  })
})
