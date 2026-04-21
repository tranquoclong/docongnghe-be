import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common'
import { Test, TestingModule } from '@nestjs/testing'
import { ReviewRepository } from 'src/routes/review/review.repo'
import { MediaType } from 'src/shared/constants/media.constant'
import { OrderStatus } from 'src/shared/constants/order.constant'
import { isUniqueConstraintPrismaError } from 'src/shared/helpers'
import { PrismaService } from 'src/shared/services/prisma.service'

const mockIsUniqueConstraintPrismaError = isUniqueConstraintPrismaError as jest.MockedFunction<
  typeof isUniqueConstraintPrismaError
>

describe('ReviewRepo', () => {
  let repository: ReviewRepository
  let mockPrismaService: any

  // Test data factories
  const createTestData = {
    review: (overrides = {}) => ({
      id: 1,
      content: 'Great product!',
      rating: 5,
      orderId: 1,
      productId: 1,
      userId: 1,
      updateCount: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
      ...overrides,
    }),
    reviewWithUser: (overrides = {}) => ({
      ...createTestData.review(overrides),
      user: {
        id: 1,
        name: 'Test User',
        avatar: 'avatar.jpg',
      },
      medias: [],
    }),
    reviewMedia: (overrides = {}) => ({
      id: 1,
      url: 'https://example.com/image.jpg',
      type: MediaType.IMAGE,
      reviewId: 1,
      createdAt: new Date(),
      ...overrides,
    }),
    order: (overrides = {}) => ({
      id: 1,
      userId: 1,
      status: OrderStatus.DELIVERED,
      ...overrides,
    }),
    createReviewBody: () => ({
      content: 'Great product!',
      rating: 5,
      productId: 1,
      orderId: 1,
      medias: [
        { url: 'https://example.com/image1.jpg', type: MediaType.IMAGE },
        { url: 'https://example.com/image2.jpg', type: MediaType.IMAGE },
      ],
    }),
    updateReviewBody: () => ({
      content: 'Updated review',
      rating: 4,
      productId: 1,
      orderId: 1,
      medias: [{ url: 'https://example.com/image3.jpg', type: MediaType.IMAGE }],
    }),
  }

  beforeEach(async () => {
    // Mock PrismaService
    mockPrismaService = {
      review: {
        count: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      order: {
        findUnique: jest.fn(),
      },
      reviewMedia: {
        createManyAndReturn: jest.fn(),
        deleteMany: jest.fn(),
      },
      $transaction: jest.fn(),
    }

    const module: TestingModule = await Test.createTestingModule({
      providers: [ReviewRepository, { provide: PrismaService, useValue: mockPrismaService }],
    }).compile()

    repository = module.get<ReviewRepository>(ReviewRepository)
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  describe('list', () => {
    it('should list reviews with pagination', async () => {
      // Arrange - Chuẩn bị dữ liệu
      const productId = 1
      const pagination = { page: 1, limit: 10 }
      const mockReviews = [createTestData.reviewWithUser(), createTestData.reviewWithUser({ id: 2 })]
      const totalItems = 2

      mockPrismaService.review.count.mockResolvedValue(totalItems)
      mockPrismaService.review.findMany.mockResolvedValue(mockReviews)

      // Act - Thực hiện list
      const result = await repository.list(productId, pagination)

      // Assert - Kiểm tra kết quả
      expect(result.data).toHaveLength(2)
      expect(result.totalItems).toBe(totalItems)
      expect(result.page).toBe(1)
      expect(result.limit).toBe(10)
      expect(mockPrismaService.review.count).toHaveBeenCalledWith({
        where: { productId },
      })
      expect(mockPrismaService.review.findMany).toHaveBeenCalled()
    })

    it('should return empty list when no reviews', async () => {
      // Arrange - Chuẩn bị dữ liệu rỗng
      const productId = 999
      const pagination = { page: 1, limit: 10 }

      mockPrismaService.review.count.mockResolvedValue(0)
      mockPrismaService.review.findMany.mockResolvedValue([])

      // Act - Thực hiện list
      const result = await repository.list(productId, pagination)

      // Assert - Kiểm tra kết quả
      expect(result.data).toHaveLength(0)
      expect(result.totalItems).toBe(0)
    })
  })

  describe('create', () => {
    it('should create review successfully', async () => {
      // Arrange - Chuẩn bị dữ liệu
      const userId = 1
      const body = createTestData.createReviewBody()
      const mockOrder = createTestData.order()
      const mockReview = createTestData.reviewWithUser()
      const mockMedias = [createTestData.reviewMedia(), createTestData.reviewMedia({ id: 2 })]

      mockPrismaService.order.findUnique.mockResolvedValue(mockOrder)
      mockPrismaService.$transaction.mockImplementation((callback) => {
        const tx = {
          review: {
            create: jest.fn().mockReturnValue({
              catch: jest.fn().mockResolvedValue(mockReview),
            }),
          },
          reviewMedia: {
            createManyAndReturn: jest.fn().mockResolvedValue(mockMedias),
          },
        }
        return callback(tx)
      })

      // Act - Thực hiện tạo review
      const result = await repository.create(userId, body)

      // Assert - Kiểm tra kết quả
      expect(result).toBeDefined()
      expect(mockPrismaService.order.findUnique).toHaveBeenCalledWith({
        where: { id: body.orderId, userId },
      })
    })

    it('should throw error when order not found', async () => {
      // Arrange - Chuẩn bị dữ liệu không tồn tại
      const userId = 1
      const body = createTestData.createReviewBody()

      mockPrismaService.order.findUnique.mockResolvedValue(null)

      // Act & Assert - Kiểm tra lỗi
      await expect(repository.create(userId, body)).rejects.toThrow(BadRequestException)
      await expect(repository.create(userId, body)).rejects.toThrow('Đơn hàng không tồn tại hoặc không thuộc về bạn')
    })

    it('should throw error when order not delivered', async () => {
      // Arrange - Chuẩn bị dữ liệu order chưa giao
      const userId = 1
      const body = createTestData.createReviewBody()
      const mockOrder = createTestData.order({ status: OrderStatus.PENDING_PAYMENT })

      mockPrismaService.order.findUnique.mockResolvedValue(mockOrder)

      // Act & Assert - Kiểm tra lỗi
      await expect(repository.create(userId, body)).rejects.toThrow(BadRequestException)
      await expect(repository.create(userId, body)).rejects.toThrow('Đơn hàng chưa được giao')
    })

    it('should throw ConflictException when review already exists (unique constraint)', async () => {
      // Arrange - Chuẩn bị dữ liệu duplicate review
      const userId = 1
      const body = createTestData.createReviewBody()
      const mockOrder = createTestData.order()

      // Tạo Prisma P2002 error (unique constraint violation)
      const prismaError = new Error('Unique constraint failed') as any
      prismaError.code = 'P2002'
      prismaError.meta = { target: ['userId', 'productId', 'orderId'] }

      mockPrismaService.order.findUnique.mockResolvedValue(mockOrder)

      // Mock transaction để tx.review.create throw error
      mockPrismaService.$transaction.mockImplementation((callback) => {
        const tx = {
          review: {
            create: jest.fn().mockRejectedValue(prismaError),
          },
          reviewMedia: {
            createManyAndReturn: jest.fn(),
          },
        }
        return callback(tx)
      })

      mockIsUniqueConstraintPrismaError.mockReturnValue(true)

      // Act & Assert - Kiểm tra lỗi ConflictException
      await expect(repository.create(userId, body)).rejects.toThrow(ConflictException)
    })

    it('should throw generic error when create fails with non-unique error', async () => {
      // Arrange - Chuẩn bị dữ liệu với lỗi database khác
      const userId = 1
      const body = createTestData.createReviewBody()
      const mockOrder = createTestData.order()
      const genericError = new Error('Database connection failed')

      mockPrismaService.order.findUnique.mockResolvedValue(mockOrder)

      // Mock transaction để tx.review.create throw generic error
      mockPrismaService.$transaction.mockImplementation((callback) => {
        const tx = {
          review: {
            create: jest.fn().mockRejectedValue(genericError),
          },
          reviewMedia: {
            createManyAndReturn: jest.fn(),
          },
        }
        return callback(tx)
      })

      mockIsUniqueConstraintPrismaError.mockReturnValue(false)

      // Act & Assert - Kiểm tra lỗi generic được throw lại
      await expect(repository.create(userId, body)).rejects.toThrow('Database connection failed')
    })

    it('should handle pagination correctly for page 2', async () => {
      // Arrange - Chuẩn bị dữ liệu cho trang 2
      const productId = 1
      const pagination = { page: 2, limit: 5 }
      const mockReviews = [createTestData.reviewWithUser({ id: 6 })]
      const totalItems = 11

      mockPrismaService.review.count.mockResolvedValue(totalItems)
      mockPrismaService.review.findMany.mockResolvedValue(mockReviews)

      // Act - Thực hiện list trang 2
      const result = await repository.list(productId, pagination)

      // Assert - Kiểm tra kết quả
      expect(result.page).toBe(2)
      expect(result.totalPages).toBe(3)
      expect(mockPrismaService.review.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 5,
          take: 5,
        }),
      )
    })
  })

  describe('update', () => {
    it('should update review successfully', async () => {
      // Arrange - Chuẩn bị dữ liệu
      const userId = 1
      const reviewId = 1
      const body = createTestData.updateReviewBody()
      const mockOrder = createTestData.order()
      const mockReview = createTestData.review({ updateCount: 0 })
      const mockUpdatedReview = createTestData.reviewWithUser({ content: body.content })
      const mockMedias = [createTestData.reviewMedia()]

      mockPrismaService.order.findUnique.mockResolvedValue(mockOrder)
      mockPrismaService.review.findUnique.mockResolvedValue(mockReview)
      mockPrismaService.$transaction.mockImplementation((callback) => {
        const tx = {
          review: {
            update: jest.fn().mockResolvedValue(mockUpdatedReview),
          },
          reviewMedia: {
            deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
            createManyAndReturn: jest.fn().mockResolvedValue(mockMedias),
          },
        }
        return callback(tx)
      })

      // Act - Thực hiện update
      const result = await repository.update({ userId, reviewId, body })

      // Assert - Kiểm tra kết quả
      expect(result).toBeDefined()
      expect(mockPrismaService.order.findUnique).toHaveBeenCalled()
      expect(mockPrismaService.review.findUnique).toHaveBeenCalledWith({
        where: { id: reviewId, userId },
      })
    })

    it('should throw error when review not found', async () => {
      // Arrange - Chuẩn bị dữ liệu không tồn tại
      const userId = 1
      const reviewId = 999
      const body = createTestData.updateReviewBody()
      const mockOrder = createTestData.order()

      mockPrismaService.order.findUnique.mockResolvedValue(mockOrder)
      mockPrismaService.review.findUnique.mockResolvedValue(null)

      // Act & Assert - Kiểm tra lỗi
      await expect(repository.update({ userId, reviewId, body })).rejects.toThrow(NotFoundException)
      await expect(repository.update({ userId, reviewId, body })).rejects.toThrow(
        'Đánh giá không tồn tại hoặc không thuộc về bạn',
      )
    })

    it('should throw error when update count exceeded', async () => {
      // Arrange - Chuẩn bị dữ liệu đã update 1 lần
      const userId = 1
      const reviewId = 1
      const body = createTestData.updateReviewBody()
      const mockOrder = createTestData.order()
      const mockReview = createTestData.review({ updateCount: 1 })

      mockPrismaService.order.findUnique.mockResolvedValue(mockOrder)
      mockPrismaService.review.findUnique.mockResolvedValue(mockReview)

      // Act & Assert - Kiểm tra lỗi
      await expect(repository.update({ userId, reviewId, body })).rejects.toThrow(BadRequestException)
      await expect(repository.update({ userId, reviewId, body })).rejects.toThrow(
        'Bạn chỉ được phép sửa đánh giá 1 lần',
      )
    })
  })
})
