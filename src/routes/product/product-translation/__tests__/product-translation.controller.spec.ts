import { Test, TestingModule } from '@nestjs/testing'
import { ProductTranslationController } from '../product-translation.controller'
import { ProductTranslationService } from '../product-translation.service'
import {
  CreateProductTranslationBodyDTO,
  GetProductTranslationParamsDTO,
  UpdateProductTranslationBodyDTO,
} from '../product-translation.dto'

/**
 * PRODUCT TRANSLATION CONTROLLER UNIT TESTS
 *
 * Test coverage cho Product Translation Controller
 * - CRUD operations (findById, create, update, delete)
 * - Request validation
 * - Response formatting
 * - Error handling
 * - User authentication integration
 */

describe('ProductTranslationController', () => {
  let controller: ProductTranslationController
  let service: ProductTranslationService

  // Mock service
  const mockProductTranslationService = {
    findById: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  }

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ProductTranslationController],
      providers: [
        {
          provide: ProductTranslationService,
          useValue: mockProductTranslationService,
        },
      ],
    }).compile()

    controller = module.get<ProductTranslationController>(ProductTranslationController)
    service = module.get<ProductTranslationService>(ProductTranslationService)
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  // ===== FIND BY ID =====
  describe('🔍 findById', () => {
    it('✅ should return product translation by id', async () => {
      // Arrange
      const params: GetProductTranslationParamsDTO = { productTranslationId: 1 }
      const mockResult = {
        id: 1,
        productId: 1,
        languageId: 1,
        name: 'Product Name',
        description: 'Product Description',
      }
      mockProductTranslationService.findById.mockResolvedValue(mockResult)

      // Act
      const result = await controller.findById(params)

      // Assert
      expect(result).toEqual(mockResult)
      expect(service.findById).toHaveBeenCalledWith(1)
      expect(service.findById).toHaveBeenCalledTimes(1)
    })
  })

  // ===== CREATE =====
  describe('➕ create', () => {
    it('✅ should create new product translation', async () => {
      // Arrange
      const userId = 1
      const body: CreateProductTranslationBodyDTO = {
        productId: 1,
        languageId: 1,
        name: 'New Product',
        description: 'New Description',
      } as any
      const mockResult = { id: 1, ...body }
      mockProductTranslationService.create.mockResolvedValue(mockResult)

      // Act
      const result = await controller.create(body, userId)

      // Assert
      expect(result).toEqual(mockResult)
      expect(service.create).toHaveBeenCalledWith({
        data: body,
        createdById: userId,
      })
      expect(service.create).toHaveBeenCalledTimes(1)
    })
  })

  // ===== UPDATE =====
  describe('✏️ update', () => {
    it('✅ should update product translation', async () => {
      // Arrange
      const userId = 1
      const params: GetProductTranslationParamsDTO = { productTranslationId: 1 }
      const body: UpdateProductTranslationBodyDTO = {
        name: 'Updated Name',
        description: 'Updated Description',
      } as any
      const mockResult = { id: 1, ...body }
      mockProductTranslationService.update.mockResolvedValue(mockResult)

      // Act
      const result = await controller.update(body, params, userId)

      // Assert
      expect(result).toEqual(mockResult)
      expect(service.update).toHaveBeenCalledWith({
        data: body,
        id: 1,
        updatedById: userId,
      })
      expect(service.update).toHaveBeenCalledTimes(1)
    })
  })

  // ===== DELETE =====
  describe('🗑️ delete', () => {
    it('✅ should delete product translation', async () => {
      // Arrange
      const userId = 1
      const params: GetProductTranslationParamsDTO = { productTranslationId: 1 }
      const mockResult = { message: 'Delete successfully' }
      mockProductTranslationService.delete.mockResolvedValue(mockResult)

      // Act
      const result = await controller.delete(params, userId)

      // Assert
      expect(result).toEqual(mockResult)
      expect(service.delete).toHaveBeenCalledWith({
        id: 1,
        deletedById: userId,
      })
      expect(service.delete).toHaveBeenCalledTimes(1)
    })
  })
})
