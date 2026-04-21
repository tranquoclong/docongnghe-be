import { Test, TestingModule } from '@nestjs/testing'
import { ReviewService } from '../review.service'
import { ReviewRepository } from '../review.repo'
import { CreateReviewBodyType, UpdateReviewBodyType } from '../review.model'
import { PaginationQueryType } from 'src/shared/models/request.model'
import { MediaType } from 'src/shared/constants/media.constant'

// Test data factory để tạo dữ liệu test
const createTestData = {
  paginationQuery: (overrides = {}): PaginationQueryType => ({
    page: 1,
    limit: 10,
    ...overrides,
  }),

  createReviewBody: (overrides = {}): CreateReviewBodyType => ({
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

  updateReviewBody: (overrides = {}): UpdateReviewBodyType => ({
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
}

describe('ReviewService', () => {
  let service: ReviewService
  let module: TestingModule
  let mockReviewRepository: jest.Mocked<ReviewRepository>

  beforeEach(async () => {
    // Tạo mock cho ReviewRepository với tất cả methods cần thiết
    mockReviewRepository = {
      list: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    } as any

    module = await Test.createTestingModule({
      providers: [ReviewService, { provide: ReviewRepository, useValue: mockReviewRepository }],
    }).compile()

    service = module.get<ReviewService>(ReviewService)
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

  describe('list', () => {
    it('should get review list successfully with pagination', async () => {
      // Arrange - Chuẩn bị dữ liệu test
      const productId = 1
      const pagination = createTestData.paginationQuery({
        page: 1,
        limit: 10,
      })
      const mockReviewListResponse = createTestData.reviewListResponse()

      mockReviewRepository.list.mockResolvedValue(mockReviewListResponse)

      // Act - Thực hiện lấy danh sách reviews
      const result = await service.list(productId, pagination)

      // Assert - Kiểm tra kết quả
      expect(result).toEqual(mockReviewListResponse)
      expect(mockReviewRepository.list).toHaveBeenCalledWith(productId, pagination)
      expect(mockReviewRepository.list).toHaveBeenCalledTimes(1)
    })

    it('should handle different product IDs', async () => {
      // Arrange - Chuẩn bị dữ liệu test với product ID khác
      const productId = 5
      const pagination = createTestData.paginationQuery()
      const mockReviewListResponse = createTestData.reviewListResponse({
        data: [
          {
            ...createTestData.reviewListResponse().data[0],
            productId: 5,
          },
        ],
      })

      mockReviewRepository.list.mockResolvedValue(mockReviewListResponse)

      // Act - Thực hiện lấy danh sách reviews
      const result = await service.list(productId, pagination)

      // Assert - Kiểm tra kết quả
      expect(result).toEqual(mockReviewListResponse)
      expect(result.data[0].productId).toBe(5)
      expect(mockReviewRepository.list).toHaveBeenCalledWith(productId, pagination)
    })

    it('should handle different pagination parameters', async () => {
      // Arrange - Chuẩn bị dữ liệu test với pagination khác
      const productId = 1
      const pagination = createTestData.paginationQuery({
        page: 2,
        limit: 5,
      })
      const mockReviewListResponse = createTestData.reviewListResponse({
        page: 2,
        limit: 5,
        totalPages: 3,
      })

      mockReviewRepository.list.mockResolvedValue(mockReviewListResponse)

      // Act - Thực hiện lấy danh sách reviews
      const result = await service.list(productId, pagination)

      // Assert - Kiểm tra kết quả
      expect(result).toEqual(mockReviewListResponse)
      expect(result.page).toBe(2)
      expect(result.limit).toBe(5)
      expect(mockReviewRepository.list).toHaveBeenCalledWith(productId, pagination)
    })

    it('should handle empty review list', async () => {
      // Arrange - Chuẩn bị dữ liệu review list trống
      const productId = 1
      const pagination = createTestData.paginationQuery()
      const emptyReviewListResponse = createTestData.reviewListResponse({
        data: [],
        totalItems: 0,
        totalPages: 0,
      })

      mockReviewRepository.list.mockResolvedValue(emptyReviewListResponse)

      // Act - Thực hiện lấy danh sách reviews
      const result = await service.list(productId, pagination)

      // Assert - Kiểm tra kết quả
      expect(result).toEqual(emptyReviewListResponse)
      expect(result.data).toHaveLength(0)
      expect(result.totalItems).toBe(0)
    })

    it('should handle reviews with multiple media types', async () => {
      // Arrange - Chuẩn bị dữ liệu test với nhiều loại media
      const productId = 1
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

      mockReviewRepository.list.mockResolvedValue(mockReviewListResponse)

      // Act - Thực hiện lấy danh sách reviews
      const result = await service.list(productId, pagination)

      // Assert - Kiểm tra kết quả
      expect(result).toEqual(mockReviewListResponse)
      expect(result.data[0].medias).toHaveLength(2)
      expect(result.data[0].medias[0].type).toBe(MediaType.IMAGE)
      expect(result.data[0].medias[1].type).toBe(MediaType.VIDEO)
    })

    it('should handle reviews with different ratings', async () => {
      // Arrange - Chuẩn bị dữ liệu test với ratings khác nhau
      const productId = 1
      const pagination = createTestData.paginationQuery()
      const mockReviewListResponse = createTestData.reviewListResponse({
        data: [
          {
            ...createTestData.reviewListResponse().data[0],
            rating: 5,
            content: 'Excellent product!',
          },
          {
            ...createTestData.reviewListResponse().data[0],
            id: 2,
            rating: 3,
            content: 'Average product',
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

      mockReviewRepository.list.mockResolvedValue(mockReviewListResponse)

      // Act - Thực hiện lấy danh sách reviews
      const result = await service.list(productId, pagination)

      // Assert - Kiểm tra kết quả
      expect(result).toEqual(mockReviewListResponse)
      expect(result.data).toHaveLength(3)
      expect(result.data[0].rating).toBe(5)
      expect(result.data[1].rating).toBe(3)
      expect(result.data[2].rating).toBe(1)
    })
  })

  describe('create', () => {
    it('should create review successfully', async () => {
      // Arrange - Chuẩn bị dữ liệu tạo review
      const userId = 1
      const body = createTestData.createReviewBody()
      const mockReviewResponse = createTestData.reviewResponse()

      mockReviewRepository.create.mockResolvedValue(mockReviewResponse)

      // Act - Thực hiện tạo review
      const result = await service.create(userId, body)

      // Assert - Kiểm tra kết quả
      expect(result).toEqual(mockReviewResponse)
      expect(mockReviewRepository.create).toHaveBeenCalledWith(userId, body)
      expect(mockReviewRepository.create).toHaveBeenCalledTimes(1)
    })

    it('should create review with different ratings', async () => {
      // Arrange - Chuẩn bị dữ liệu tạo review với rating khác
      const userId = 1
      const ratings = [1, 2, 3, 4, 5]

      for (const rating of ratings) {
        const body = createTestData.createReviewBody({ rating })
        const mockReviewResponse = createTestData.reviewResponse({ rating })

        mockReviewRepository.create.mockResolvedValue(mockReviewResponse)

        // Act - Thực hiện tạo review
        const result = await service.create(userId, body)

        // Assert - Kiểm tra kết quả
        expect(result).toEqual(mockReviewResponse)
        expect(result.rating).toBe(rating)
        expect(mockReviewRepository.create).toHaveBeenCalledWith(userId, body)

        // Reset mock for next iteration
        mockReviewRepository.create.mockReset()
      }
    })

    it('should create review with multiple media files', async () => {
      // Arrange - Chuẩn bị dữ liệu tạo review với nhiều media
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

      mockReviewRepository.create.mockResolvedValue(mockReviewResponse)

      // Act - Thực hiện tạo review
      const result = await service.create(userId, body)

      // Assert - Kiểm tra kết quả
      expect(result).toEqual(mockReviewResponse)
      expect(result.medias).toHaveLength(3)
      expect(body.medias).toHaveLength(3)
    })

    it('should create review without media files', async () => {
      // Arrange - Chuẩn bị dữ liệu tạo review không có media
      const userId = 1
      const body = createTestData.createReviewBody({
        medias: [],
      })
      const mockReviewResponse = createTestData.reviewResponse({
        medias: [],
      })

      mockReviewRepository.create.mockResolvedValue(mockReviewResponse)

      // Act - Thực hiện tạo review
      const result = await service.create(userId, body)

      // Assert - Kiểm tra kết quả
      expect(result).toEqual(mockReviewResponse)
      expect(result.medias).toHaveLength(0)
      expect(mockReviewRepository.create).toHaveBeenCalledWith(userId, body)
    })

    it('should create review for different products and orders', async () => {
      // Arrange - Chuẩn bị dữ liệu tạo review cho products và orders khác
      const userId = 2
      const body = createTestData.createReviewBody({
        productId: 5,
        orderId: 10,
        content: 'Review for different product',
      })
      const mockReviewResponse = createTestData.reviewResponse({
        productId: 5,
        orderId: 10,
        userId: 2,
        content: 'Review for different product',
      })

      mockReviewRepository.create.mockResolvedValue(mockReviewResponse)

      // Act - Thực hiện tạo review
      const result = await service.create(userId, body)

      // Assert - Kiểm tra kết quả
      expect(result).toEqual(mockReviewResponse)
      expect(result.productId).toBe(5)
      expect(result.orderId).toBe(10)
      expect(result.userId).toBe(2)
    })
  })

  describe('update', () => {
    it('should update review successfully', async () => {
      // Arrange - Chuẩn bị dữ liệu cập nhật review
      const userId = 1
      const reviewId = 1
      const body = createTestData.updateReviewBody()
      const mockUpdatedReviewResponse = createTestData.reviewResponse({
        id: reviewId,
        content: body.content,
        rating: body.rating,
        updateCount: 1,
        updatedAt: new Date().toISOString(),
      })

      mockReviewRepository.update.mockResolvedValue(mockUpdatedReviewResponse)

      // Act - Thực hiện cập nhật review
      const result = await service.update({ userId, reviewId, body })

      // Assert - Kiểm tra kết quả
      expect(result).toEqual(mockUpdatedReviewResponse)
      expect(mockReviewRepository.update).toHaveBeenCalledWith({
        userId,
        reviewId,
        body,
      })
      expect(mockReviewRepository.update).toHaveBeenCalledTimes(1)
    })

    it('should update review with different user and review ID', async () => {
      // Arrange - Chuẩn bị dữ liệu cập nhật review với user và review ID khác
      const userId = 3
      const reviewId = 5
      const body = createTestData.updateReviewBody({
        content: 'Updated content by different user',
        rating: 3,
      })
      const mockUpdatedReviewResponse = createTestData.reviewResponse({
        id: reviewId,
        userId: userId,
        content: body.content,
        rating: body.rating,
        updateCount: 2,
      })

      mockReviewRepository.update.mockResolvedValue(mockUpdatedReviewResponse)

      // Act - Thực hiện cập nhật review
      const result = await service.update({ userId, reviewId, body })

      // Assert - Kiểm tra kết quả
      expect(result).toEqual(mockUpdatedReviewResponse)
      expect(result.id).toBe(reviewId)
      expect(result.userId).toBe(userId)
      expect(result.rating).toBe(3)
      expect(mockReviewRepository.update).toHaveBeenCalledWith({
        userId,
        reviewId,
        body,
      })
    })

    it('should update review with new media files', async () => {
      // Arrange - Chuẩn bị dữ liệu cập nhật review với media mới
      const userId = 1
      const reviewId = 1
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

      mockReviewRepository.update.mockResolvedValue(mockUpdatedReviewResponse)

      // Act - Thực hiện cập nhật review
      const result = await service.update({ userId, reviewId, body })

      // Assert - Kiểm tra kết quả
      expect(result).toEqual(mockUpdatedReviewResponse)
      expect(result.medias).toHaveLength(2)
      expect(result.medias[0].url).toBe('https://example.com/new-image1.jpg')
      expect(result.medias[1].url).toBe('https://example.com/new-video1.mp4')
    })

    it('should update review removing all media files', async () => {
      // Arrange - Chuẩn bị dữ liệu cập nhật review xóa tất cả media
      const userId = 1
      const reviewId = 1
      const body = createTestData.updateReviewBody({
        medias: [],
      })
      const mockUpdatedReviewResponse = createTestData.reviewResponse({
        medias: [],
        updateCount: 1,
      })

      mockReviewRepository.update.mockResolvedValue(mockUpdatedReviewResponse)

      // Act - Thực hiện cập nhật review
      const result = await service.update({ userId, reviewId, body })

      // Assert - Kiểm tra kết quả
      expect(result).toEqual(mockUpdatedReviewResponse)
      expect(result.medias).toHaveLength(0)
    })

    it('should update review with different rating', async () => {
      // Arrange - Chuẩn bị dữ liệu cập nhật review với rating khác
      const userId = 1
      const reviewId = 1
      const newRatings = [1, 2, 3, 4, 5]

      for (const newRating of newRatings) {
        const body = createTestData.updateReviewBody({ rating: newRating })
        const mockUpdatedReviewResponse = createTestData.reviewResponse({
          rating: newRating,
          updateCount: 1,
        })

        mockReviewRepository.update.mockResolvedValue(mockUpdatedReviewResponse)

        // Act - Thực hiện cập nhật review
        const result = await service.update({ userId, reviewId, body })

        // Assert - Kiểm tra kết quả
        expect(result).toEqual(mockUpdatedReviewResponse)
        expect(result.rating).toBe(newRating)

        // Reset mock for next iteration
        mockReviewRepository.update.mockReset()
      }
    })
  })

  describe('error handling', () => {
    it('should handle repository errors in list', async () => {
      // Arrange - Chuẩn bị lỗi từ repository
      const productId = 1
      const pagination = createTestData.paginationQuery()
      const repositoryError = new Error('Database connection failed')

      mockReviewRepository.list.mockRejectedValue(repositoryError)

      // Act & Assert - Thực hiện test và kiểm tra lỗi
      await expect(service.list(productId, pagination)).rejects.toThrow('Database connection failed')
      expect(mockReviewRepository.list).toHaveBeenCalledWith(productId, pagination)
    })

    it('should handle repository errors in create', async () => {
      // Arrange - Chuẩn bị lỗi từ repository
      const userId = 1
      const body = createTestData.createReviewBody()
      const repositoryError = new Error('Review creation failed')

      mockReviewRepository.create.mockRejectedValue(repositoryError)

      // Act & Assert - Thực hiện test và kiểm tra lỗi
      await expect(service.create(userId, body)).rejects.toThrow('Review creation failed')
      expect(mockReviewRepository.create).toHaveBeenCalledWith(userId, body)
    })

    it('should handle repository errors in update', async () => {
      // Arrange - Chuẩn bị lỗi từ repository
      const userId = 1
      const reviewId = 1
      const body = createTestData.updateReviewBody()
      const repositoryError = new Error('Review update failed')

      mockReviewRepository.update.mockRejectedValue(repositoryError)

      // Act & Assert - Thực hiện test và kiểm tra lỗi
      await expect(service.update({ userId, reviewId, body })).rejects.toThrow('Review update failed')
      expect(mockReviewRepository.update).toHaveBeenCalledWith({
        userId,
        reviewId,
        body,
      })
    })

    it('should pass through repository responses without modification in list', async () => {
      // Arrange - Chuẩn bị test để đảm bảo service không modify data
      const productId = 1
      const pagination = createTestData.paginationQuery()
      const originalResponse = createTestData.reviewListResponse()

      mockReviewRepository.list.mockResolvedValue(originalResponse)

      // Act - Thực hiện lấy danh sách reviews
      const result = await service.list(productId, pagination)

      // Assert - Kiểm tra kết quả không bị thay đổi
      expect(result).toBe(originalResponse) // Same reference
      expect(result).toEqual(originalResponse) // Same content
    })

    it('should pass through repository responses without modification in create', async () => {
      // Arrange - Chuẩn bị test để đảm bảo service không modify data
      const userId = 1
      const body = createTestData.createReviewBody()
      const originalResponse = createTestData.reviewResponse()

      mockReviewRepository.create.mockResolvedValue(originalResponse)

      // Act - Thực hiện tạo review
      const result = await service.create(userId, body)

      // Assert - Kiểm tra kết quả không bị thay đổi
      expect(result).toBe(originalResponse) // Same reference
      expect(result).toEqual(originalResponse) // Same content
    })

    it('should pass through repository responses without modification in update', async () => {
      // Arrange - Chuẩn bị test để đảm bảo service không modify data
      const userId = 1
      const reviewId = 1
      const body = createTestData.updateReviewBody()
      const originalResponse = createTestData.reviewResponse()

      mockReviewRepository.update.mockResolvedValue(originalResponse)

      // Act - Thực hiện cập nhật review
      const result = await service.update({ userId, reviewId, body })

      // Assert - Kiểm tra kết quả không bị thay đổi
      expect(result).toBe(originalResponse) // Same reference
      expect(result).toEqual(originalResponse) // Same content
    })
  })
})
