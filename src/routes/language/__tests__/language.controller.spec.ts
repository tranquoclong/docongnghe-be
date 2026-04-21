import { Test, TestingModule } from '@nestjs/testing'
import { LanguageController } from '../language.controller'
import { CreateLanguageBodyDTO, GetLanguageParamsDTO, UpdateLanguageBodyDTO } from '../language.dto'
import { LanguageService } from '../language.service'

/**
 * LANGUAGE CONTROLLER UNIT TESTS
 *
 * Test coverage cho LanguageController với 5 endpoints:
 * - GET /languages (getLanguages) - Public endpoint, list all languages
 * - GET /languages/:languageId (findById) - Public endpoint
 * - POST /languages (create) - Protected endpoint, create new language
 * - PUT /languages/:languageId (update) - Protected endpoint, update language name
 * - DELETE /languages/:languageId (delete) - Protected endpoint (HARD delete)
 *
 * Key features:
 * - Language id là string (language code: 'en', 'vi', 'zh-CN', etc.)
 * - Hard delete (không phải soft delete như các entities khác)
 * - Unique constraint trên id (language code)
 * - Không cho phép update id (immutable), chỉ update name
 * - Audit trail: createdById, updatedById
 */

describe('LanguageController', () => {
  let controller: LanguageController
  let mockLanguageService: jest.Mocked<LanguageService>

  // ===== TEST DATA FACTORIES =====

  const createMockLanguage = (overrides = {}) => ({
    id: 'en',
    name: 'English',
    createdById: 1,
    updatedById: null,
    deletedAt: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  })

  const createMockLanguagesList = () => ({
    data: [
      createMockLanguage({ id: 'en', name: 'English' }),
      createMockLanguage({ id: 'vi', name: 'Tiếng Việt' }),
      createMockLanguage({ id: 'zh-CN', name: '中文 (简体)' }),
    ],
    totalItems: 3,
  })

  // ===== SETUP & TEARDOWN =====

  beforeEach(async () => {
    // Tạo mock service với tất cả methods
    mockLanguageService = {
      findAll: jest.fn(),
      findById: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    } as any

    const module: TestingModule = await Test.createTestingModule({
      controllers: [LanguageController],
      providers: [
        {
          provide: LanguageService,
          useValue: mockLanguageService,
        },
      ],
    }).compile()

    controller = module.get<LanguageController>(LanguageController)
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  // ===== INITIALIZATION TESTS =====

  describe('Initialization', () => {
    it('should be defined', () => {
      expect(controller).toBeDefined()
    })

    it('should have languageService injected', () => {
      expect(controller['languageService']).toBeDefined()
      expect(controller['languageService']).toBe(mockLanguageService)
    })
  })

  // ===== GET /languages (getLanguages) TESTS =====

  describe('GET /languages - getLanguages()', () => {
    it('should return all languages', async () => {
      // Arrange
      const mockResponse = createMockLanguagesList()
      mockLanguageService.findAll.mockResolvedValue(mockResponse)

      // Act
      const result = await controller.getLanguages()

      // Assert
      expect(result).toEqual(mockResponse)
      expect(mockLanguageService.findAll).toHaveBeenCalledWith()
      expect(mockLanguageService.findAll).toHaveBeenCalledTimes(1)
      expect(result.data.length).toBe(3)
      expect(result.totalItems).toBe(3)
    })

    it('should return empty array when no languages exist', async () => {
      // Arrange
      const mockResponse = {
        data: [],
        totalItems: 0,
      }
      mockLanguageService.findAll.mockResolvedValue(mockResponse)

      // Act
      const result = await controller.getLanguages()

      // Assert
      expect(result.data).toEqual([])
      expect(result.totalItems).toBe(0)
    })

    it('should return languages with different language codes', async () => {
      // Arrange
      const mockResponse = {
        data: [
          createMockLanguage({ id: 'en', name: 'English' }),
          createMockLanguage({ id: 'vi', name: 'Tiếng Việt' }),
          createMockLanguage({ id: 'zh-CN', name: '中文 (简体)' }),
          createMockLanguage({ id: 'ja', name: '日本語' }),
        ],
        totalItems: 4,
      }
      mockLanguageService.findAll.mockResolvedValue(mockResponse)

      // Act
      const result = await controller.getLanguages()

      // Assert
      expect(result.data.length).toBe(4)
      expect(result.data.map((lang) => lang.id)).toEqual(['en', 'vi', 'zh-CN', 'ja'])
    })
  })

  // ===== GET /languages/:languageId (findById) TESTS =====

  describe('GET /languages/:languageId - findById()', () => {
    it('should return language by id (language code)', async () => {
      // Arrange
      const params: GetLanguageParamsDTO = { languageId: 'en' }
      const mockLanguage = createMockLanguage({ id: 'en', name: 'English' })
      mockLanguageService.findById.mockResolvedValue(mockLanguage)

      // Act
      const result = await controller.findById(params)

      // Assert
      expect(result).toEqual(mockLanguage)
      expect(mockLanguageService.findById).toHaveBeenCalledWith('en')
      expect(mockLanguageService.findById).toHaveBeenCalledTimes(1)
    })

    it('should throw error when language not found', async () => {
      // Arrange
      const params: GetLanguageParamsDTO = { languageId: 'unknown' }
      mockLanguageService.findById.mockRejectedValue(new Error('Error.NotFoundRecord'))

      // Act & Assert
      await expect(controller.findById(params)).rejects.toThrow('Error.NotFoundRecord')
      expect(mockLanguageService.findById).toHaveBeenCalledWith('unknown')
    })

    it('should return language with complex language code', async () => {
      // Arrange
      const params: GetLanguageParamsDTO = { languageId: 'zh-CN' }
      const mockLanguage = createMockLanguage({ id: 'zh-CN', name: '中文 (简体)' })
      mockLanguageService.findById.mockResolvedValue(mockLanguage)

      // Act
      const result = await controller.findById(params)

      // Assert
      expect(result.id).toBe('zh-CN')
      expect(result.name).toBe('中文 (简体)')
    })
  })

  // ===== POST /languages (create) TESTS =====

  describe('POST /languages - create()', () => {
    it('should create language successfully', async () => {
      // Arrange
      const userId = 1
      const body: CreateLanguageBodyDTO = {
        id: 'fr',
        name: 'Français',
      }
      const mockCreatedLanguage = createMockLanguage({ ...body, createdById: userId })
      mockLanguageService.create.mockResolvedValue(mockCreatedLanguage)

      // Act
      const result = await controller.create(body, userId)

      // Assert
      expect(result).toEqual(mockCreatedLanguage)
      expect(mockLanguageService.create).toHaveBeenCalledWith({
        data: body,
        createdById: userId,
      })
      expect(result.createdById).toBe(userId)
      expect(result.id).toBe('fr')
    })

    it('should create language with ISO 639-1 code', async () => {
      // Arrange
      const userId = 1
      const body: CreateLanguageBodyDTO = {
        id: 'ja',
        name: '日本語',
      }
      const mockCreatedLanguage = createMockLanguage({ ...body })
      mockLanguageService.create.mockResolvedValue(mockCreatedLanguage)

      // Act
      const result = await controller.create(body, userId)

      // Assert
      expect(result.id).toBe('ja')
      expect(result.name).toBe('日本語')
    })

    it('should throw error when creating duplicate language code', async () => {
      // Arrange
      const userId = 1
      const body: CreateLanguageBodyDTO = {
        id: 'en',
        name: 'English',
      }
      mockLanguageService.create.mockRejectedValue(new Error('Error.LanguageAlreadyExists'))

      // Act & Assert
      await expect(controller.create(body, userId)).rejects.toThrow('Error.LanguageAlreadyExists')
    })

    it('should create language with complex language code (region variant)', async () => {
      // Arrange
      const userId = 1
      const body: CreateLanguageBodyDTO = {
        id: 'pt-BR',
        name: 'Português (Brasil)',
      }
      const mockCreatedLanguage = createMockLanguage({ ...body })
      mockLanguageService.create.mockResolvedValue(mockCreatedLanguage)

      // Act
      const result = await controller.create(body, userId)

      // Assert
      expect(result.id).toBe('pt-BR')
      expect(result.name).toBe('Português (Brasil)')
    })
  })

  // ===== PUT /languages/:languageId (update) TESTS =====

  describe('PUT /languages/:languageId - update()', () => {
    it('should update language name successfully', async () => {
      // Arrange
      const userId = 1
      const params: GetLanguageParamsDTO = { languageId: 'en' }
      const body: UpdateLanguageBodyDTO = {
        name: 'English (Updated)',
      }
      const mockUpdatedLanguage = createMockLanguage({ id: 'en', name: 'English (Updated)', updatedById: userId })
      mockLanguageService.update.mockResolvedValue(mockUpdatedLanguage)

      // Act
      const result = await controller.update(body, params, userId)

      // Assert
      expect(result).toEqual(mockUpdatedLanguage)
      expect(mockLanguageService.update).toHaveBeenCalledWith({
        data: body,
        id: 'en',
        updatedById: userId,
      })
      expect(result.updatedById).toBe(userId)
      expect(result.name).toBe('English (Updated)')
    })

    it('should throw error when updating non-existent language', async () => {
      // Arrange
      const userId = 1
      const params: GetLanguageParamsDTO = { languageId: 'unknown' }
      const body: UpdateLanguageBodyDTO = {
        name: 'Updated',
      }
      mockLanguageService.update.mockRejectedValue(new Error('Error.NotFoundRecord'))

      // Act & Assert
      await expect(controller.update(body, params, userId)).rejects.toThrow('Error.NotFoundRecord')
    })

    it('should only update name, not id (id is immutable)', async () => {
      // Arrange
      const userId = 1
      const params: GetLanguageParamsDTO = { languageId: 'vi' }
      const body: UpdateLanguageBodyDTO = {
        name: 'Vietnamese',
      }
      const mockUpdatedLanguage = createMockLanguage({ id: 'vi', name: 'Vietnamese' })
      mockLanguageService.update.mockResolvedValue(mockUpdatedLanguage)

      // Act
      const result = await controller.update(body, params, userId)

      // Assert
      expect(result.id).toBe('vi') // ID không thay đổi
      expect(result.name).toBe('Vietnamese')
      expect(mockLanguageService.update).toHaveBeenCalledWith({
        data: { name: 'Vietnamese' }, // Chỉ có name trong data
        id: 'vi',
        updatedById: userId,
      })
    })
  })

  // ===== DELETE /languages/:languageId (delete) TESTS =====

  describe('DELETE /languages/:languageId - delete()', () => {
    it('should delete language successfully (HARD delete)', async () => {
      // Arrange
      const params: GetLanguageParamsDTO = { languageId: 'fr' }
      const mockResponse = { message: 'Delete successfully' } as const
      mockLanguageService.delete.mockResolvedValue(mockResponse)

      // Act
      const result = await controller.delete(params)

      // Assert
      expect(result).toEqual(mockResponse)
      expect(mockLanguageService.delete).toHaveBeenCalledWith('fr')
      expect(result.message).toBe('Delete successfully')
    })

    it('should throw error when deleting non-existent language', async () => {
      // Arrange
      const params: GetLanguageParamsDTO = { languageId: 'unknown' }
      mockLanguageService.delete.mockRejectedValue(new Error('Error.NotFoundRecord'))

      // Act & Assert
      await expect(controller.delete(params)).rejects.toThrow('Error.NotFoundRecord')
      expect(mockLanguageService.delete).toHaveBeenCalledWith('unknown')
    })

    it('should perform hard delete (not soft delete)', async () => {
      // Arrange
      const params: GetLanguageParamsDTO = { languageId: 'ja' }
      const mockResponse = { message: 'Delete successfully' } as const
      mockLanguageService.delete.mockResolvedValue(mockResponse)

      // Act
      await controller.delete(params)

      // Assert
      // Verify service.delete được gọi với languageId (hard delete logic trong service)
      expect(mockLanguageService.delete).toHaveBeenCalledWith('ja')
      expect(mockLanguageService.delete).toHaveBeenCalledTimes(1)
    })
  })

  // ===== EDGE CASES & ERROR HANDLING =====

  describe('Edge Cases & Error Handling', () => {
    it('should handle service throwing unexpected error in getLanguages', async () => {
      // Arrange
      mockLanguageService.findAll.mockRejectedValue(new Error('Database connection failed'))

      // Act & Assert
      await expect(controller.getLanguages()).rejects.toThrow('Database connection failed')
    })

    it('should handle service throwing unexpected error in create', async () => {
      // Arrange
      const userId = 1
      const body: CreateLanguageBodyDTO = {
        id: 'test',
        name: 'Test',
      }
      mockLanguageService.create.mockRejectedValue(new Error('Unexpected error'))

      // Act & Assert
      await expect(controller.create(body, userId)).rejects.toThrow('Unexpected error')
    })

    it('should handle language code with maximum length (10 characters)', async () => {
      // Arrange
      const params: GetLanguageParamsDTO = { languageId: 'abcdefghij' } // 10 chars
      const mockLanguage = createMockLanguage({ id: 'abcdefghij', name: 'Test Language' })
      mockLanguageService.findById.mockResolvedValue(mockLanguage)

      // Act
      const result = await controller.findById(params)

      // Assert
      expect(result.id).toBe('abcdefghij')
      expect(result.id.length).toBe(10)
    })

    it('should handle language name with maximum length (500 characters)', async () => {
      // Arrange
      const userId = 1
      const longName = 'A'.repeat(500) // 500 characters
      const body: CreateLanguageBodyDTO = {
        id: 'test',
        name: longName,
      }
      const mockCreatedLanguage = createMockLanguage({ id: 'test', name: longName })
      mockLanguageService.create.mockResolvedValue(mockCreatedLanguage)

      // Act
      const result = await controller.create(body, userId)

      // Assert
      expect(result.name.length).toBe(500)
    })

    it('should handle special characters in language name', async () => {
      // Arrange
      const userId = 1
      const body: CreateLanguageBodyDTO = {
        id: 'test',
        name: 'Test Language (Special: @#$%^&*)',
      }
      const mockCreatedLanguage = createMockLanguage({ ...body })
      mockLanguageService.create.mockResolvedValue(mockCreatedLanguage)

      // Act
      const result = await controller.create(body, userId)

      // Assert
      expect(result.name).toBe('Test Language (Special: @#$%^&*)')
    })
  })

  // ===== RESPONSE STRUCTURE SNAPSHOTS =====

  describe('Response Structure Snapshots', () => {
    const fixedDate = '2024-01-01T00:00:00.000Z'

    it('should match language list response structure', async () => {
      const mockResponse = {
        data: [
          createMockLanguage({ id: 'en', name: 'English', createdAt: fixedDate, updatedAt: fixedDate }),
          createMockLanguage({ id: 'vi', name: 'Tiếng Việt', createdAt: fixedDate, updatedAt: fixedDate }),
        ],
        totalItems: 2,
      }
      mockLanguageService.findAll.mockResolvedValue(mockResponse)
      const result = await controller.getLanguages()
      expect(result).toMatchSnapshot()
    })

    it('should match language detail response structure', async () => {
      const mockLanguage = createMockLanguage({ createdAt: fixedDate, updatedAt: fixedDate })
      mockLanguageService.findById.mockResolvedValue(mockLanguage)
      const result = await controller.findById({ languageId: 'en' })
      expect(result).toMatchSnapshot()
    })

    it('should match language create response structure', async () => {
      const mockLanguage = createMockLanguage({ id: 'ja', name: 'Japanese', createdAt: fixedDate, updatedAt: fixedDate })
      mockLanguageService.create.mockResolvedValue(mockLanguage)
      const result = await controller.create({ id: 'ja', name: 'Japanese' }, 1)
      expect(result).toMatchSnapshot()
    })
  })
})
