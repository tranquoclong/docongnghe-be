import { ForbiddenException } from '@nestjs/common'
import { Test, TestingModule } from '@nestjs/testing'
import { I18nContext } from 'nestjs-i18n'
import { ManageProductService } from 'src/routes/product/manage-product.service'
import { ProductRepo } from 'src/routes/product/product.repo'
import { RoleName } from 'src/shared/constants/role.constant'
import { NotFoundRecordException } from 'src/shared/error'
import { isNotFoundPrismaError } from 'src/shared/helpers'

// Mock helpers
jest.mock('src/shared/helpers', () => ({
  isNotFoundPrismaError: jest.fn(),
}))

// Mock I18nContext
jest.mock('nestjs-i18n', () => ({
  I18nContext: {
    current: jest.fn(),
  },
}))

const mockIsNotFoundPrismaError = isNotFoundPrismaError as jest.MockedFunction<typeof isNotFoundPrismaError>

describe('ManageProductService', () => {
  let service: ManageProductService
  let productRepo: jest.Mocked<ProductRepo>

  // Test data factory
  const createTestData = {
    product: (overrides = {}) => ({
      id: 1,
      name: 'Test Product',
      basePrice: 100000,
      virtualPrice: 120000,
      brandId: 1,
      images: ['image1.jpg'],
      variants: [],
      publishedAt: new Date('2024-01-01'),
      createdById: 1,
      updatedById: null,
      deletedById: null,
      deletedAt: null,
      createdAt: '2024-01-01T00:00:00.000Z',
      updatedAt: '2024-01-01T00:00:00.000Z',
      productTranslations: [],
      ...overrides,
    }),
    productDetail: (overrides = {}) => ({
      id: 1,
      name: 'Test Product',
      basePrice: 100000,
      virtualPrice: 120000,
      brandId: 1,
      images: ['image1.jpg'],
      variants: [],
      publishedAt: new Date('2024-01-01'),
      createdById: 1,
      updatedById: null,
      deletedById: null,
      deletedAt: null,
      createdAt: '2024-01-01T00:00:00.000Z',
      updatedAt: '2024-01-01T00:00:00.000Z',
      productTranslations: [],
      skus: [],
      categories: [],
      brand: {
        id: 1,
        name: 'Test Brand',
        brandTranslations: [],
      },
      ...overrides,
    }),
    listResult: (overrides = {}) => ({
      data: [
        {
          id: 1,
          name: 'Test Product',
          basePrice: 100000,
          virtualPrice: 120000,
          brandId: 1,
          images: ['image1.jpg'],
          variants: [],
          publishedAt: new Date('2024-01-01'),
          createdById: 1,
          updatedById: null,
          deletedById: null,
          deletedAt: null,
          createdAt: '2024-01-01T00:00:00.000Z',
          updatedAt: '2024-01-01T00:00:00.000Z',
          productTranslations: [],
        },
      ],
      totalItems: 1,
      page: 1,
      limit: 10,
      totalPages: 1,
      ...overrides,
    }),
    createProductData: (overrides = {}) => ({
      name: 'New Product',
      basePrice: 100000,
      virtualPrice: 120000,
      brandId: 1,
      images: ['image1.jpg'],
      variants: [],
      publishedAt: null,
      categories: [1, 2],
      skus: [
        {
          value: 'default',
          price: 100000,
          stock: 10,
          image: 'sku1.jpg',
        },
      ],
      ...overrides,
    }),
    updateProductData: (overrides = {}) => ({
      name: 'Updated Product',
      basePrice: 150000,
      virtualPrice: 180000,
      brandId: 1,
      images: ['image1.jpg'],
      variants: [],
      publishedAt: null,
      categories: [1, 2],
      skus: [
        {
          value: 'default',
          price: 150000,
          stock: 10,
          image: 'sku1.jpg',
        },
      ],
      ...overrides,
    }),
  }

  beforeEach(async () => {
    // Mock ProductRepo
    const mockProductRepo = {
      list: jest.fn(),
      getDetail: jest.fn(),
      findById: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    }

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ManageProductService,
        {
          provide: ProductRepo,
          useValue: mockProductRepo,
        },
      ],
    }).compile()

    service = module.get<ManageProductService>(ManageProductService)
    productRepo = module.get(ProductRepo)

    // Mock I18nContext.current()
    ;(I18nContext.current as jest.Mock).mockReturnValue({ lang: 'vi' })
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  describe('validatePrivilege', () => {
    it('should return true when user is the owner', () => {
      // Arrange - Chuẩn bị dữ liệu
      const params = {
        userIdRequest: 1,
        roleNameRequest: RoleName.Client,
        createdById: 1,
      }

      // Act - Thực hiện validate
      const result = service.validatePrivilege(params)

      // Assert - Kiểm tra kết quả
      expect(result).toBe(true)
    })

    it('should return true when user is admin', () => {
      // Arrange - Chuẩn bị dữ liệu
      const params = {
        userIdRequest: 2,
        roleNameRequest: RoleName.Admin,
        createdById: 1,
      }

      // Act - Thực hiện validate
      const result = service.validatePrivilege(params)

      // Assert - Kiểm tra kết quả
      expect(result).toBe(true)
    })

    it('should throw ForbiddenException when user is not owner and not admin', () => {
      // Arrange - Chuẩn bị dữ liệu
      const params = {
        userIdRequest: 2,
        roleNameRequest: RoleName.Client,
        createdById: 1,
      }

      // Act & Assert - Thực hiện validate và kiểm tra exception
      expect(() => service.validatePrivilege(params)).toThrow(ForbiddenException)
    })

    it('should throw ForbiddenException when createdById is null', () => {
      // Arrange - Chuẩn bị dữ liệu
      const params = {
        userIdRequest: 1,
        roleNameRequest: RoleName.Client,
        createdById: null,
      }

      // Act & Assert - Thực hiện validate và kiểm tra exception
      expect(() => service.validatePrivilege(params)).toThrow(ForbiddenException)
    })

    it('should throw ForbiddenException when createdById is undefined', () => {
      // Arrange - Chuẩn bị dữ liệu
      const params = {
        userIdRequest: 1,
        roleNameRequest: RoleName.Client,
        createdById: undefined,
      }

      // Act & Assert - Thực hiện validate và kiểm tra exception
      expect(() => service.validatePrivilege(params)).toThrow(ForbiddenException)
    })
  })

  describe('list', () => {
    it('should list products when user is owner', async () => {
      // Arrange - Chuẩn bị dữ liệu
      const query = {
        page: 1,
        limit: 10,
        createdById: 1,
        orderBy: 'desc' as any,
        sortBy: 'createdAt' as any,
      }
      const mockResult = createTestData.listResult()
      productRepo.list.mockResolvedValue(mockResult as any)

      // Act - Thực hiện list
      const result = await service.list({
        query,
        userIdRequest: 1,
        roleNameRequest: RoleName.Client,
      })

      // Assert - Kiểm tra kết quả
      expect(result).toMatchObject(mockResult)
      expect(productRepo.list).toHaveBeenCalledWith({
        page: 1,
        limit: 10,
        languageId: 'vi',
        createdById: 1,
        isPublic: undefined,
        brandIds: undefined,
        minPrice: undefined,
        maxPrice: undefined,
        categories: undefined,
        name: undefined,
        orderBy: 'desc',
        sortBy: 'createdAt',
      })
    })

    it('should list products when user is admin', async () => {
      // Arrange - Chuẩn bị dữ liệu
      const query = {
        page: 1,
        limit: 10,
        createdById: 1,
        orderBy: 'desc' as any,
        sortBy: 'createdAt' as any,
      }
      const mockResult = createTestData.listResult()
      productRepo.list.mockResolvedValue(mockResult as any)

      // Act - Thực hiện list
      const result = await service.list({
        query,
        userIdRequest: 2,
        roleNameRequest: RoleName.Admin,
      })

      // Assert - Kiểm tra kết quả
      expect(result).toMatchObject(mockResult)
      expect(productRepo.list).toHaveBeenCalled()
    })

    it('should throw ForbiddenException when user is not owner and not admin', async () => {
      // Arrange - Chuẩn bị dữ liệu
      const query = {
        page: 1,
        limit: 10,
        createdById: 1,
        orderBy: 'desc' as any,
        sortBy: 'createdAt' as any,
      }

      // Act & Assert - Thực hiện list và kiểm tra exception
      await expect(
        service.list({
          query,
          userIdRequest: 2,
          roleNameRequest: RoleName.Client,
        }),
      ).rejects.toThrow(ForbiddenException)
    })

    it('should list products with all filters', async () => {
      // Arrange - Chuẩn bị dữ liệu
      const query = {
        page: 2,
        limit: 20,
        createdById: 1,
        isPublic: true,
        brandIds: [1, 2],
        minPrice: 100000,
        maxPrice: 500000,
        categories: [1, 2, 3],
        name: 'test',
        orderBy: 'asc' as any,
        sortBy: 'name' as any,
      }
      const mockResult = createTestData.listResult()
      productRepo.list.mockResolvedValue(mockResult as any)

      // Act - Thực hiện list
      const result = await service.list({
        query,
        userIdRequest: 1,
        roleNameRequest: RoleName.Client,
      })

      // Assert - Kiểm tra kết quả
      expect(result).toMatchObject(mockResult)
      expect(productRepo.list).toHaveBeenCalledWith({
        page: 2,
        limit: 20,
        languageId: 'vi',
        createdById: 1,
        isPublic: true,
        brandIds: [1, 2],
        minPrice: 100000,
        maxPrice: 500000,
        categories: [1, 2, 3],
        name: 'test',
        orderBy: 'asc',
        sortBy: 'name',
      })
    })
  })

  describe('getDetail', () => {
    it('should get product detail when user is owner', async () => {
      // Arrange - Chuẩn bị dữ liệu
      const mockProduct = createTestData.productDetail({ createdById: 1 })
      productRepo.getDetail.mockResolvedValue(mockProduct as any)

      // Act - Thực hiện getDetail
      const result = await service.getDetail({
        productId: 1,
        userIdRequest: 1,
        roleNameRequest: RoleName.Client,
      })

      // Assert - Kiểm tra kết quả
      expect(result).toMatchObject(mockProduct)
      expect(productRepo.getDetail).toHaveBeenCalledWith({
        productId: 1,
        languageId: 'vi',
      })
    })

    it('should get product detail when user is admin', async () => {
      // Arrange - Chuẩn bị dữ liệu
      const mockProduct = createTestData.productDetail({ createdById: 1 })
      productRepo.getDetail.mockResolvedValue(mockProduct as any)

      // Act - Thực hiện getDetail
      const result = await service.getDetail({
        productId: 1,
        userIdRequest: 2,
        roleNameRequest: RoleName.Admin,
      })

      // Assert - Kiểm tra kết quả
      expect(result).toMatchObject(mockProduct)
    })

    it('should throw NotFoundRecordException when product not found', async () => {
      // Arrange - Chuẩn bị dữ liệu
      productRepo.getDetail.mockResolvedValue(null)

      // Act & Assert - Thực hiện getDetail và kiểm tra exception
      await expect(
        service.getDetail({
          productId: 999,
          userIdRequest: 1,
          roleNameRequest: RoleName.Client,
        }),
      ).rejects.toThrow(NotFoundRecordException)
    })

    it('should throw ForbiddenException when user is not owner and not admin', async () => {
      // Arrange - Chuẩn bị dữ liệu
      const mockProduct = createTestData.productDetail({ createdById: 1 })
      productRepo.getDetail.mockResolvedValue(mockProduct as any)

      // Act & Assert - Thực hiện getDetail và kiểm tra exception
      await expect(
        service.getDetail({
          productId: 1,
          userIdRequest: 2,
          roleNameRequest: RoleName.Client,
        }),
      ).rejects.toThrow(ForbiddenException)
    })
  })

  describe('create', () => {
    it('should create product successfully', async () => {
      // Arrange - Chuẩn bị dữ liệu
      const createData = createTestData.createProductData()
      const mockProduct = createTestData.productDetail()
      productRepo.create.mockResolvedValue(mockProduct as any)

      // Act - Thực hiện create
      const result = await service.create({
        data: createData as any,
        createdById: 1,
      })

      // Assert - Kiểm tra kết quả
      expect(result).toMatchObject(mockProduct)
      expect(productRepo.create).toHaveBeenCalledWith({
        createdById: 1,
        data: createData,
      })
    })
  })

  describe('update', () => {
    it('should update product when user is owner', async () => {
      // Arrange - Chuẩn bị dữ liệu
      const mockProduct = createTestData.product({ createdById: 1 })
      const updateData = createTestData.updateProductData()
      const mockUpdatedProduct = createTestData.product({ createdById: 1, name: 'Updated Product', basePrice: 150000 })
      productRepo.findById.mockResolvedValue(mockProduct as any)
      productRepo.update.mockResolvedValue(mockUpdatedProduct as any)

      // Act - Thực hiện update
      const result = await service.update({
        productId: 1,
        data: updateData as any,
        updatedById: 1,
        roleNameRequest: RoleName.Client,
      })

      // Assert - Kiểm tra kết quả
      expect(result).toMatchObject(mockUpdatedProduct)
      expect(productRepo.findById).toHaveBeenCalledWith(1)
      expect(productRepo.update).toHaveBeenCalledWith({
        id: 1,
        updatedById: 1,
        data: updateData,
      })
    })

    it('should update product when user is admin', async () => {
      // Arrange - Chuẩn bị dữ liệu
      const mockProduct = createTestData.product({ createdById: 1 })
      const updateData = createTestData.updateProductData()
      const mockUpdatedProduct = createTestData.product({ createdById: 1, name: 'Updated Product', basePrice: 150000 })
      productRepo.findById.mockResolvedValue(mockProduct as any)
      productRepo.update.mockResolvedValue(mockUpdatedProduct as any)

      // Act - Thực hiện update
      const result = await service.update({
        productId: 1,
        data: updateData as any,
        updatedById: 2,
        roleNameRequest: RoleName.Admin,
      })

      // Assert - Kiểm tra kết quả
      expect(result).toMatchObject(mockUpdatedProduct)
    })

    it('should throw NotFoundRecordException when product not found in findById', async () => {
      // Arrange - Chuẩn bị dữ liệu
      const updateData = createTestData.updateProductData()
      productRepo.findById.mockResolvedValue(null)

      // Act & Assert - Thực hiện update và kiểm tra exception
      await expect(
        service.update({
          productId: 999,
          data: updateData as any,
          updatedById: 1,
          roleNameRequest: RoleName.Client,
        }),
      ).rejects.toThrow(NotFoundRecordException)
    })

    it('should throw ForbiddenException when user is not owner and not admin', async () => {
      // Arrange - Chuẩn bị dữ liệu
      const mockProduct = createTestData.product({ createdById: 1 })
      const updateData = createTestData.updateProductData()
      productRepo.findById.mockResolvedValue(mockProduct as any)

      // Act & Assert - Thực hiện update và kiểm tra exception
      await expect(
        service.update({
          productId: 1,
          data: updateData as any,
          updatedById: 2,
          roleNameRequest: RoleName.Client,
        }),
      ).rejects.toThrow(ForbiddenException)
    })

    it('should throw NotFoundRecordException when Prisma throws not found error in update', async () => {
      // Arrange - Chuẩn bị dữ liệu
      const mockProduct = createTestData.product({ createdById: 1 })
      const updateData = createTestData.updateProductData()
      productRepo.findById.mockResolvedValue(mockProduct as any)
      const prismaError = new Error('Record not found')
      ;(prismaError as any).code = 'P2025'
      productRepo.update.mockRejectedValue(prismaError)
      mockIsNotFoundPrismaError.mockReturnValue(true)

      // Act & Assert - Thực hiện update và kiểm tra exception
      await expect(
        service.update({
          productId: 1,
          data: updateData as any,
          updatedById: 1,
          roleNameRequest: RoleName.Client,
        }),
      ).rejects.toThrow('Error.NotFound')
    })

    it('should rethrow error when Prisma throws other error in update', async () => {
      // Arrange - Chuẩn bị dữ liệu
      const mockProduct = createTestData.product({ createdById: 1 })
      const updateData = createTestData.updateProductData()
      productRepo.findById.mockResolvedValue(mockProduct as any)
      const otherError = new Error('Other error')
      productRepo.update.mockRejectedValue(otherError)

      // Act & Assert - Thực hiện update và kiểm tra exception
      await expect(
        service.update({
          productId: 1,
          data: updateData as any,
          updatedById: 1,
          roleNameRequest: RoleName.Client,
        }),
      ).rejects.toThrow(otherError)
    })
  })

  describe('delete', () => {
    it('should delete product when user is owner', async () => {
      // Arrange - Chuẩn bị dữ liệu
      const mockProduct = createTestData.product({ createdById: 1 })
      productRepo.findById.mockResolvedValue(mockProduct as any)
      productRepo.delete.mockResolvedValue(undefined as any)

      // Act - Thực hiện delete
      const result = await service.delete({
        productId: 1,
        deletedById: 1,
        roleNameRequest: RoleName.Client,
      })

      // Assert - Kiểm tra kết quả
      expect(result).toEqual({ message: 'Delete successfully' })
      expect(productRepo.findById).toHaveBeenCalledWith(1)
      expect(productRepo.delete).toHaveBeenCalledWith({
        id: 1,
        deletedById: 1,
      })
    })

    it('should delete product when user is admin', async () => {
      // Arrange - Chuẩn bị dữ liệu
      const mockProduct = createTestData.product({ createdById: 1 })
      productRepo.findById.mockResolvedValue(mockProduct as any)
      productRepo.delete.mockResolvedValue(undefined as any)

      // Act - Thực hiện delete
      const result = await service.delete({
        productId: 1,
        deletedById: 2,
        roleNameRequest: RoleName.Admin,
      })

      // Assert - Kiểm tra kết quả
      expect(result).toEqual({ message: 'Delete successfully' })
    })

    it('should throw NotFoundRecordException when product not found', async () => {
      // Arrange - Chuẩn bị dữ liệu
      productRepo.findById.mockResolvedValue(null)

      // Act & Assert - Thực hiện delete và kiểm tra exception
      await expect(
        service.delete({
          productId: 999,
          deletedById: 1,
          roleNameRequest: RoleName.Client,
        }),
      ).rejects.toThrow(NotFoundRecordException)
    })

    it('should throw ForbiddenException when user is not owner and not admin', async () => {
      // Arrange - Chuẩn bị dữ liệu
      const mockProduct = createTestData.product({ createdById: 1 })
      productRepo.findById.mockResolvedValue(mockProduct as any)

      // Act & Assert - Thực hiện delete và kiểm tra exception
      await expect(
        service.delete({
          productId: 1,
          deletedById: 2,
          roleNameRequest: RoleName.Client,
        }),
      ).rejects.toThrow(ForbiddenException)
    })

    it('should throw NotFoundRecordException when Prisma throws not found error in delete', async () => {
      // Arrange - Chuẩn bị dữ liệu
      const mockProduct = createTestData.product({ createdById: 1 })
      productRepo.findById.mockResolvedValue(mockProduct as any)
      const prismaError = new Error('Record not found')
      ;(prismaError as any).code = 'P2025'
      productRepo.delete.mockRejectedValue(prismaError)
      mockIsNotFoundPrismaError.mockReturnValue(true)

      // Act & Assert - Thực hiện delete và kiểm tra exception
      await expect(
        service.delete({
          productId: 1,
          deletedById: 1,
          roleNameRequest: RoleName.Client,
        }),
      ).rejects.toThrow('Error.NotFound')
    })

    it('should rethrow error when Prisma throws other error in delete', async () => {
      // Arrange - Chuẩn bị dữ liệu
      const mockProduct = createTestData.product({ createdById: 1 })
      productRepo.findById.mockResolvedValue(mockProduct as any)
      const otherError = new Error('Other error')
      productRepo.delete.mockRejectedValue(otherError)

      // Act & Assert - Thực hiện delete và kiểm tra exception
      await expect(
        service.delete({
          productId: 1,
          deletedById: 1,
          roleNameRequest: RoleName.Client,
        }),
      ).rejects.toThrow(otherError)
    })
  })
})
