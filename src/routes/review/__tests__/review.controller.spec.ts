import { Test, TestingModule } from '@nestjs/testing'
import { ReviewController } from '../review.controller'
import { ReviewService } from '../review.service'
import { GetReviewsParamsDTO, CreateReviewBodyDTO, UpdateReviewBodyDTO, GetReviewDetailParamsDTO } from '../review.dto'
import { PaginationQueryDTO } from 'src/shared/dtos/request.dto'
import { MediaType } from 'src/shared/constants/media.constant'

// Test data factory để tạo dữ liệu test
const createTestData = {
  getReviewsParams: (overrides = {}): GetReviewsParamsDTO => ({
    productId: 1,
    ...overrides,
  }),

  paginationQuery: (overrides = {}): PaginationQueryDTO => ({
    page: 1,
    limit: 10,
    ...overrides,
  }),

  createReviewBody: (overrides = {}): CreateReviewBodyDTO => ({
    content: 'This is a great product!',
    rating: 5,
    productId: 1,
    orderId: 1,
    medias: [
      {
        url: 'https://example.com/image1.jpg',
        type: MediaType.IMAGE,
      },
    ],
    ...overrides,
  }),

  updateReviewBody: (overrides = {}): UpdateReviewBodyDTO => ({
    content: 'Updated review content',
    rating: 4,
    productId: 1,
    orderId: 1,
    medias: [
      {
        url: 'https://example.com/updated-image.jpg',
        type: MediaType.IMAGE,
      },
    ],
    ...overrides,
  }),

  getReviewDetailParams: (overrides = {}): GetReviewDetailParamsDTO => ({
    reviewId: 1,
    ...overrides,
  }),

  reviewListResponse: (overrides = {}) => ({
    data: [
      {
        id: 1,
        content: 'This is a great product!',
        rating: 5,
        orderId: 1,
        productId: 1,
        userId: 1,
        updateCount: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        medias: [
          {
            id: 1,
            url: 'https://example.com/image1.jpg',
            type: MediaType.IMAGE,
            reviewId: 1,
            createdAt: new Date().toISOString(),
          },
        ],
        user: {
          id: 1,
          name: 'Test User',
          avatar: 'https://example.com/avatar.jpg',
        },
      },
    ],
    totalItems: 1,
    page: 1,
    limit: 10,
    totalPages: 1,
    ...overrides,
  }),

  reviewResponse: (overrides = {}) => ({
    id: 1,
    content: 'This is a great product!',
    rating: 5,
    orderId: 1,
    productId: 1,
    userId: 1,
    updateCount: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    medias: [
      {
        id: 1,
        url: 'https://example.com/image1.jpg',
        type: MediaType.IMAGE,
        reviewId: 1,
        createdAt: new Date().toISOString(),
      },
    ],
    user: {
      id: 1,
      name: 'Test User',
      avatar: 'https://example.com/avatar.jpg',
    },
    ...overrides,
  }),
}

describe('ReviewController', () => {
  let controller: ReviewController
  let module: TestingModule
  let mockReviewService: jest.Mocked<ReviewService>

  beforeEach(async () => {
    // Tạo mock cho ReviewService với tất cả methods cần thiết
    mockReviewService = {
      list: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    } as any

    module = await Test.createTestingModule({
      controllers: [ReviewController],
      providers: [{ provide: ReviewService, useValue: mockReviewService }],
    }).compile()

    controller = module.get<ReviewController>(ReviewController)
  })

  afterEach(() => {
    jest.clearAllMocks()
    jest.resetAllMocks()
  })

  afterAll(async () => {
    jest.restoreAllMocks()
    if (module) {
      await module.close()
    }
  })

  describe('getReviews', () => {
    it('should return review list successfully with default parameters', async () => {
      // Arrange - Chuẩn bị dữ liệu test
      const params = createTestData.getReviewsParams({
        productId: 1,
      })
      const pagination = createTestData.paginationQuery()
      const mockReviewListResponse = createTestData.reviewListResponse()

      mockReviewService.list.mockResolvedValue(mockReviewListResponse)

      // Act - Thực hiện gọi controller
      const result = await controller.getReviews(params, pagination)

      // Assert - Kiểm tra kết quả
      expect(result).toEqual(mockReviewListResponse)
      expect(mockReviewService.list).toHaveBeenCalledWith(params.productId, pagination)
      expect(mockReviewService.list).toHaveBeenCalledTimes(1)
    })

    it('should handle different product IDs', async () => {
      // Arrange - Chuẩn bị dữ liệu test với product ID khác
      const params = createTestData.getReviewsParams({
        productId: 5,
      })
      const pagination = createTestData.paginationQuery()
      const mockReviewListResponse = createTestData.reviewListResponse({
        data: [
          {
            ...createTestData.reviewListResponse().data[0],
            productId: 5,
          },
        ],
      })

      mockReviewService.list.mockResolvedValue(mockReviewListResponse)

      // Act - Thực hiện gọi controller
      const result = await controller.getReviews(params, pagination)

      // Assert - Kiểm tra kết quả
      expect(result).toEqual(mockReviewListResponse)
      expect(result.data[0].productId).toBe(5)
      expect(mockReviewService.list).toHaveBeenCalledWith(5, pagination)
    })

    it('should handle different pagination parameters', async () => {
      // Arrange - Chuẩn bị dữ liệu test với pagination khác
      const params = createTestData.getReviewsParams()
      const pagination = createTestData.paginationQuery({
        page: 2,
        limit: 5,
      })
      const mockReviewListResponse = createTestData.reviewListResponse({
        page: 2,
        limit: 5,
        totalPages: 3,
      })

      mockReviewService.list.mockResolvedValue(mockReviewListResponse)

      // Act - Thực hiện gọi controller
      const result = await controller.getReviews(params, pagination)

      // Assert - Kiểm tra kết quả
      expect(result).toEqual(mockReviewListResponse)
      expect(result.page).toBe(2)
      expect(result.limit).toBe(5)
      expect(mockReviewService.list).toHaveBeenCalledWith(params.productId, pagination)
    })

    it('should handle empty review list', async () => {
      // Arrange - Chuẩn bị dữ liệu review list trống
      const params = createTestData.getReviewsParams()
      const pagination = createTestData.paginationQuery()
      const emptyReviewListResponse = createTestData.reviewListResponse({
        data: [],
        totalItems: 0,
        totalPages: 0,
      })

      mockReviewService.list.mockResolvedValue(emptyReviewListResponse)

      // Act - Thực hiện gọi controller
      const result = await controller.getReviews(params, pagination)

      // Assert - Kiểm tra kết quả
      expect(result).toEqual(emptyReviewListResponse)
      expect(result.data).toHaveLength(0)
      expect(result.totalItems).toBe(0)
    })

    it('should handle reviews with different media types', async () => {
      // Arrange - Chuẩn bị dữ liệu test với reviews có nhiều loại media
      const params = createTestData.getReviewsParams()
      const pagination = createTestData.paginationQuery()
      const mockReviewListResponse = createTestData.reviewListResponse({
        data: [
          {
            ...createTestData.reviewListResponse().data[0],
            medias: [
              {
                id: 1,
                url: 'https://example.com/image1.jpg',
                type: MediaType.IMAGE,
                reviewId: 1,
                createdAt: new Date().toISOString(),
              },
              {
                id: 2,
                url: 'https://example.com/video1.mp4',
                type: MediaType.VIDEO,
                reviewId: 1,
                createdAt: new Date().toISOString(),
              },
            ],
          },
        ],
      })

      mockReviewService.list.mockResolvedValue(mockReviewListResponse)

      // Act - Thực hiện gọi controller
      const result = await controller.getReviews(params, pagination)

      // Assert - Kiểm tra kết quả
      expect(result).toEqual(mockReviewListResponse)
      expect(result.data[0].medias).toHaveLength(2)
      expect(result.data[0].medias[0].type).toBe(MediaType.IMAGE)
      expect(result.data[0].medias[1].type).toBe(MediaType.VIDEO)
    })

    it('should handle reviews with different ratings', async () => {
      // Arrange - Chuẩn bị dữ liệu test với reviews có ratings khác nhau
      const params = createTestData.getReviewsParams()
      const pagination = createTestData.paginationQuery()
      const mockReviewListResponse = createTestData.reviewListResponse({
        data: [
          {
            ...createTestData.reviewListResponse().data[0],
            rating: 5,
            content: 'Excellent!',
          },
          {
            ...createTestData.reviewListResponse().data[0],
            id: 2,
            rating: 3,
            content: 'Average',
          },
          {
            ...createTestData.reviewListResponse().data[0],
            id: 3,
            rating: 1,
            content: 'Poor quality',
          },
        ],
        totalItems: 3,
      })

      mockReviewService.list.mockResolvedValue(mockReviewListResponse)

      // Act - Thực hiện gọi controller
      const result = await controller.getReviews(params, pagination)

      // Assert - Kiểm tra kết quả
      expect(result).toEqual(mockReviewListResponse)
      expect(result.data).toHaveLength(3)
      expect(result.data[0].rating).toBe(5)
      expect(result.data[1].rating).toBe(3)
      expect(result.data[2].rating).toBe(1)
    })
  })

  describe('updateReview (actually create)', () => {
    it('should create review successfully', async () => {
      // Arrange - Chuẩn bị dữ liệu test
      const body = createTestData.createReviewBody()
      const userId = 1
      const mockReviewResponse = createTestData.reviewResponse()

      mockReviewService.create.mockResolvedValue(mockReviewResponse)

      // Act - Thực hiện gọi controller
      const result = await controller.updateReview(body, userId)

      // Assert - Kiểm tra kết quả
      expect(result).toEqual(mockReviewResponse)
      expect(mockReviewService.create).toHaveBeenCalledWith(userId, body)
      expect(mockReviewService.create).toHaveBeenCalledTimes(1)
    })

    it('should create review with different ratings', async () => {
      // Arrange - Chuẩn bị dữ liệu test với ratings khác nhau
      const userId = 1
      const ratings = [1, 2, 3, 4, 5]

      for (const rating of ratings) {
        const body = createTestData.createReviewBody({ rating })
        const mockReviewResponse = createTestData.reviewResponse({ rating })

        mockReviewService.create.mockResolvedValue(mockReviewResponse)

        // Act - Thực hiện gọi controller
        const result = await controller.updateReview(body, userId)

        // Assert - Kiểm tra kết quả
        expect(result).toEqual(mockReviewResponse)
        expect(result.rating).toBe(rating)
        expect(mockReviewService.create).toHaveBeenCalledWith(userId, body)

        // Reset mock for next iteration
        mockReviewService.create.mockReset()
      }
    })

    it('should create review with multiple media files', async () => {
      // Arrange - Chuẩn bị dữ liệu test với nhiều media files
      const userId = 1
      const body = createTestData.createReviewBody({
        medias: [
          {
            url: 'https://example.com/image1.jpg',
            type: MediaType.IMAGE,
          },
          {
            url: 'https://example.com/image2.jpg',
            type: MediaType.IMAGE,
          },
          {
            url: 'https://example.com/video1.mp4',
            type: MediaType.VIDEO,
          },
        ],
      })
      const mockReviewResponse = createTestData.reviewResponse({
        medias: [
          {
            id: 1,
            url: 'https://example.com/image1.jpg',
            type: MediaType.IMAGE,
            reviewId: 1,
            createdAt: new Date().toISOString(),
          },
          {
            id: 2,
            url: 'https://example.com/image2.jpg',
            type: MediaType.IMAGE,
            reviewId: 1,
            createdAt: new Date().toISOString(),
          },
          {
            id: 3,
            url: 'https://example.com/video1.mp4',
            type: MediaType.VIDEO,
            reviewId: 1,
            createdAt: new Date().toISOString(),
          },
        ],
      })

      mockReviewService.create.mockResolvedValue(mockReviewResponse)

      // Act - Thực hiện gọi controller
      const result = await controller.updateReview(body, userId)

      // Assert - Kiểm tra kết quả
      expect(result).toEqual(mockReviewResponse)
      expect(result.medias).toHaveLength(3)
      expect(body.medias).toHaveLength(3)
    })

    it('should create review without media files', async () => {
      // Arrange - Chuẩn bị dữ liệu test không có media files
      const userId = 1
      const body = createTestData.createReviewBody({
        medias: [],
      })
      const mockReviewResponse = createTestData.reviewResponse({
        medias: [],
      })

      mockReviewService.create.mockResolvedValue(mockReviewResponse)

      // Act - Thực hiện gọi controller
      const result = await controller.updateReview(body, userId)

      // Assert - Kiểm tra kết quả
      expect(result).toEqual(mockReviewResponse)
      expect(result.medias).toHaveLength(0)
    })

    it('should create review for different users, products and orders', async () => {
      // Arrange - Chuẩn bị dữ liệu test với user, product, order khác
      const userId = 3
      const body = createTestData.createReviewBody({
        productId: 5,
        orderId: 10,
        content: 'Review from different user',
      })
      const mockReviewResponse = createTestData.reviewResponse({
        userId: 3,
        productId: 5,
        orderId: 10,
        content: 'Review from different user',
      })

      mockReviewService.create.mockResolvedValue(mockReviewResponse)

      // Act - Thực hiện gọi controller
      const result = await controller.updateReview(body, userId)

      // Assert - Kiểm tra kết quả
      expect(result).toEqual(mockReviewResponse)
      expect(result.userId).toBe(3)
      expect(result.productId).toBe(5)
      expect(result.orderId).toBe(10)
    })
  })

  describe('changePassword (actually update review)', () => {
    it('should update review successfully', async () => {
      // Arrange - Chuẩn bị dữ liệu test
      const body = createTestData.updateReviewBody()
      const userId = 1
      const params = createTestData.getReviewDetailParams({
        reviewId: 1,
      })
      const mockUpdatedReviewResponse = createTestData.reviewResponse({
        id: params.reviewId,
        content: body.content,
        rating: body.rating,
        updateCount: 1,
        updatedAt: new Date().toISOString(),
      })

      mockReviewService.update.mockResolvedValue(mockUpdatedReviewResponse)

      // Act - Thực hiện gọi controller
      const result = await controller.changePassword(body, userId, params)

      // Assert - Kiểm tra kết quả
      expect(result).toEqual(mockUpdatedReviewResponse)
      expect(mockReviewService.update).toHaveBeenCalledWith({
        userId,
        body,
        reviewId: params.reviewId,
      })
      expect(mockReviewService.update).toHaveBeenCalledTimes(1)
    })

    it('should update review with different user and review ID', async () => {
      // Arrange - Chuẩn bị dữ liệu test với user và review ID khác
      const userId = 3
      const params = createTestData.getReviewDetailParams({
        reviewId: 5,
      })
      const body = createTestData.updateReviewBody({
        content: 'Updated by different user',
        rating: 3,
      })
      const mockUpdatedReviewResponse = createTestData.reviewResponse({
        id: params.reviewId,
        userId: userId,
        content: body.content,
        rating: body.rating,
        updateCount: 2,
      })

      mockReviewService.update.mockResolvedValue(mockUpdatedReviewResponse)

      // Act - Thực hiện gọi controller
      const result = await controller.changePassword(body, userId, params)

      // Assert - Kiểm tra kết quả
      expect(result).toEqual(mockUpdatedReviewResponse)
      expect(result.id).toBe(5)
      expect(result.userId).toBe(3)
      expect(result.rating).toBe(3)
      expect(mockReviewService.update).toHaveBeenCalledWith({
        userId,
        body,
        reviewId: 5,
      })
    })

    it('should update review with new media files', async () => {
      // Arrange - Chuẩn bị dữ liệu test với media files mới
      const userId = 1
      const params = createTestData.getReviewDetailParams()
      const body = createTestData.updateReviewBody({
        medias: [
          {
            url: 'https://example.com/new-image1.jpg',
            type: MediaType.IMAGE,
          },
          {
            url: 'https://example.com/new-video1.mp4',
            type: MediaType.VIDEO,
          },
        ],
      })
      const mockUpdatedReviewResponse = createTestData.reviewResponse({
        medias: [
          {
            id: 4,
            url: 'https://example.com/new-image1.jpg',
            type: MediaType.IMAGE,
            reviewId: 1,
            createdAt: new Date().toISOString(),
          },
          {
            id: 5,
            url: 'https://example.com/new-video1.mp4',
            type: MediaType.VIDEO,
            reviewId: 1,
            createdAt: new Date().toISOString(),
          },
        ],
        updateCount: 1,
      })

      mockReviewService.update.mockResolvedValue(mockUpdatedReviewResponse)

      // Act - Thực hiện gọi controller
      const result = await controller.changePassword(body, userId, params)

      // Assert - Kiểm tra kết quả
      expect(result).toEqual(mockUpdatedReviewResponse)
      expect(result.medias).toHaveLength(2)
      expect(result.medias[0].url).toBe('https://example.com/new-image1.jpg')
      expect(result.medias[1].url).toBe('https://example.com/new-video1.mp4')
    })

    it('should update review removing all media files', async () => {
      // Arrange - Chuẩn bị dữ liệu test xóa tất cả media files
      const userId = 1
      const params = createTestData.getReviewDetailParams()
      const body = createTestData.updateReviewBody({
        medias: [],
      })
      const mockUpdatedReviewResponse = createTestData.reviewResponse({
        medias: [],
        updateCount: 1,
      })

      mockReviewService.update.mockResolvedValue(mockUpdatedReviewResponse)

      // Act - Thực hiện gọi controller
      const result = await controller.changePassword(body, userId, params)

      // Assert - Kiểm tra kết quả
      expect(result).toEqual(mockUpdatedReviewResponse)
      expect(result.medias).toHaveLength(0)
    })

    it('should update review with different rating', async () => {
      // Arrange - Chuẩn bị dữ liệu test với rating khác
      const userId = 1
      const params = createTestData.getReviewDetailParams()
      const newRatings = [1, 2, 3, 4, 5]

      for (const newRating of newRatings) {
        const body = createTestData.updateReviewBody({ rating: newRating })
        const mockUpdatedReviewResponse = createTestData.reviewResponse({
          rating: newRating,
          updateCount: 1,
        })

        mockReviewService.update.mockResolvedValue(mockUpdatedReviewResponse)

        // Act - Thực hiện gọi controller
        const result = await controller.changePassword(body, userId, params)

        // Assert - Kiểm tra kết quả
        expect(result).toEqual(mockUpdatedReviewResponse)
        expect(result.rating).toBe(newRating)

        // Reset mock for next iteration
        mockReviewService.update.mockReset()
      }
    })
  })

  describe('error handling', () => {
    it('should handle service errors in getReviews', async () => {
      // Arrange - Chuẩn bị lỗi từ service
      const params = createTestData.getReviewsParams()
      const pagination = createTestData.paginationQuery()
      const serviceError = new Error('Service error occurred')

      mockReviewService.list.mockRejectedValue(serviceError)

      // Act & Assert - Thực hiện test và kiểm tra lỗi
      await expect(controller.getReviews(params, pagination)).rejects.toThrow('Service error occurred')
      expect(mockReviewService.list).toHaveBeenCalledWith(params.productId, pagination)
    })

    it('should handle service errors in create (updateReview)', async () => {
      // Arrange - Chuẩn bị lỗi từ service
      const body = createTestData.createReviewBody()
      const userId = 1
      const serviceError = new Error('Review creation failed')

      mockReviewService.create.mockRejectedValue(serviceError)

      // Act & Assert - Thực hiện test và kiểm tra lỗi
      await expect(controller.updateReview(body, userId)).rejects.toThrow('Review creation failed')
      expect(mockReviewService.create).toHaveBeenCalledWith(userId, body)
    })

    it('should handle service errors in update (changePassword)', async () => {
      // Arrange - Chuẩn bị lỗi từ service
      const body = createTestData.updateReviewBody()
      const userId = 1
      const params = createTestData.getReviewDetailParams()
      const serviceError = new Error('Review update failed')

      mockReviewService.update.mockRejectedValue(serviceError)

      // Act & Assert - Thực hiện test và kiểm tra lỗi
      await expect(controller.changePassword(body, userId, params)).rejects.toThrow('Review update failed')
      expect(mockReviewService.update).toHaveBeenCalledWith({
        userId,
        body,
        reviewId: params.reviewId,
      })
    })

    it('should pass through service responses without modification in getReviews', async () => {
      // Arrange - Chuẩn bị test để đảm bảo controller không modify data
      const params = createTestData.getReviewsParams()
      const pagination = createTestData.paginationQuery()
      const originalResponse = createTestData.reviewListResponse()

      mockReviewService.list.mockResolvedValue(originalResponse)

      // Act - Thực hiện gọi controller
      const result = await controller.getReviews(params, pagination)

      // Assert - Kiểm tra kết quả không bị thay đổi
      expect(result).toBe(originalResponse) // Same reference
      expect(result).toEqual(originalResponse) // Same content
    })

    it('should pass through service responses without modification in create', async () => {
      // Arrange - Chuẩn bị test để đảm bảo controller không modify data
      const body = createTestData.createReviewBody()
      const userId = 1
      const originalResponse = createTestData.reviewResponse()

      mockReviewService.create.mockResolvedValue(originalResponse)

      // Act - Thực hiện gọi controller
      const result = await controller.updateReview(body, userId)

      // Assert - Kiểm tra kết quả không bị thay đổi
      expect(result).toBe(originalResponse) // Same reference
      expect(result).toEqual(originalResponse) // Same content
    })

    it('should pass through service responses without modification in update', async () => {
      // Arrange - Chuẩn bị test để đảm bảo controller không modify data
      const body = createTestData.updateReviewBody()
      const userId = 1
      const params = createTestData.getReviewDetailParams()
      const originalResponse = createTestData.reviewResponse()

      mockReviewService.update.mockResolvedValue(originalResponse)

      // Act - Thực hiện gọi controller
      const result = await controller.changePassword(body, userId, params)

      // Assert - Kiểm tra kết quả không bị thay đổi
      expect(result).toBe(originalResponse) // Same reference
      expect(result).toEqual(originalResponse) // Same content
    })
  })

  describe('validation edge cases', () => {
    it('should handle edge case product IDs in getReviews', async () => {
      // Arrange - Chuẩn bị test với edge case product IDs
      const edgeCaseIds = [1, 999999, Number.MAX_SAFE_INTEGER]
      const pagination = createTestData.paginationQuery()

      for (const productId of edgeCaseIds) {
        const params = createTestData.getReviewsParams({ productId })
        const mockResponse = createTestData.reviewListResponse({
          data: [
            {
              ...createTestData.reviewListResponse().data[0],
              productId,
            },
          ],
        })
        mockReviewService.list.mockResolvedValue(mockResponse)

        // Act - Thực hiện gọi controller
        const result = await controller.getReviews(params, pagination)

        // Assert - Kiểm tra kết quả
        expect(result.data[0].productId).toBe(productId)
        expect(mockReviewService.list).toHaveBeenCalledWith(productId, pagination)

        // Reset mock for next iteration
        mockReviewService.list.mockReset()
      }
    })

    it('should handle edge case review IDs in update', async () => {
      // Arrange - Chuẩn bị test với edge case review IDs
      const edgeCaseIds = [1, 999999, Number.MAX_SAFE_INTEGER]
      const body = createTestData.updateReviewBody()
      const userId = 1

      for (const reviewId of edgeCaseIds) {
        const params = createTestData.getReviewDetailParams({ reviewId })
        const mockResponse = createTestData.reviewResponse({ id: reviewId })
        mockReviewService.update.mockResolvedValue(mockResponse)

        // Act - Thực hiện gọi controller
        const result = await controller.changePassword(body, userId, params)

        // Assert - Kiểm tra kết quả
        expect(result.id).toBe(reviewId)
        expect(mockReviewService.update).toHaveBeenCalledWith({
          userId,
          body,
          reviewId,
        })

        // Reset mock for next iteration
        mockReviewService.update.mockReset()
      }
    })

    it('should handle edge case pagination values in getReviews', async () => {
      // Arrange - Chuẩn bị test với edge case pagination
      const params = createTestData.getReviewsParams()
      const edgeCases = [
        { page: 1, limit: 1 },
        { page: 1, limit: 100 },
        { page: 999, limit: 50 },
      ]

      for (const paginationCase of edgeCases) {
        const pagination = createTestData.paginationQuery(paginationCase)
        const mockResponse = createTestData.reviewListResponse(paginationCase)
        mockReviewService.list.mockResolvedValue(mockResponse)

        // Act - Thực hiện gọi controller
        const result = await controller.getReviews(params, pagination)

        // Assert - Kiểm tra kết quả
        expect(result.page).toBe(paginationCase.page)
        expect(result.limit).toBe(paginationCase.limit)
        expect(mockReviewService.list).toHaveBeenCalledWith(params.productId, pagination)

        // Reset mock for next iteration
        mockReviewService.list.mockReset()
      }
    })
  })

  // ===== RESPONSE STRUCTURE SNAPSHOTS =====

  describe('Response Structure Snapshots', () => {
    const fixedDate = '2024-01-01T00:00:00.000Z'

    it('should match review list response structure', async () => {
      const mockResponse = createTestData.reviewListResponse({
        data: [
          {
            id: 1,
            content: 'This is a great product!',
            rating: 5,
            orderId: 1,
            productId: 1,
            userId: 1,
            updateCount: 0,
            createdAt: fixedDate,
            updatedAt: fixedDate,
            medias: [{ id: 1, url: 'https://example.com/image1.jpg', type: MediaType.IMAGE, reviewId: 1, createdAt: fixedDate }],
            user: { id: 1, name: 'Test User', avatar: 'https://example.com/avatar.jpg' },
          },
        ],
      })
      mockReviewService.list.mockResolvedValue(mockResponse)
      const result = await controller.getReviews(createTestData.getReviewsParams(), createTestData.paginationQuery())
      expect(result).toMatchSnapshot()
    })

    it('should match review create response structure', async () => {
      const mockResponse = {
        id: 1,
        content: 'This is a great product!',
        rating: 5,
        orderId: 1,
        productId: 1,
        userId: 1,
        updateCount: 0,
        createdAt: fixedDate,
        updatedAt: fixedDate,
        medias: [{ id: 1, url: 'https://example.com/image1.jpg', type: MediaType.IMAGE, reviewId: 1, createdAt: fixedDate }],
        user: { id: 1, name: 'Test User', avatar: 'https://example.com/avatar.jpg' },
      }
      mockReviewService.create.mockResolvedValue(mockResponse)
      const result = await controller.updateReview(createTestData.createReviewBody(), 1)
      expect(result).toMatchSnapshot()
    })
  })
})
