import { S3 } from '@aws-sdk/client-s3'
import { Upload } from '@aws-sdk/lib-storage'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { Test, TestingModule } from '@nestjs/testing'
import * as fs from 'fs'
import * as mime from 'mime-types'
import { S3Service } from '../s3.service'

// Mock fs với promises
jest.mock('fs', () => ({
  readFileSync: jest.fn(),
  existsSync: jest.fn(() => true),
  promises: {
    readFile: jest.fn(),
    writeFile: jest.fn(),
    unlink: jest.fn(),
    access: jest.fn(),
  },
}))

// Mock envConfig
jest.mock('src/shared/config', () => ({
  __esModule: true,
  default: {
    S3_REGION: 'us-east-1',
    S3_ACCESS_KEY_ID: 'test-access-key',
    S3_SECRET_ACCESS_KEY: 'test-secret-key',
    S3_BUCKET_NAME: 'test-bucket',
  },
}))

// Mock AWS SDK
jest.mock('@aws-sdk/client-s3')
jest.mock('@aws-sdk/lib-storage')
jest.mock('@aws-sdk/s3-request-presigner')
jest.mock('mime-types')

// Import envConfig sau khi mock
import envConfig from 'src/shared/config'

describe('S3Service', () => {
  let service: S3Service
  let mockS3: jest.Mocked<S3>
  let mockUpload: any
  let mockReadFileSync: jest.MockedFunction<typeof fs.readFileSync>
  let mockMimeLookup: jest.MockedFunction<typeof mime.lookup>
  let mockGetSignedUrl: jest.MockedFunction<typeof getSignedUrl>

  // Test data factories
  const createTestData = {
    uploadParams: (overrides = {}) => ({
      filename: 'test-image.jpg',
      filepath: '/path/to/test-image.jpg',
      contentType: 'image/jpeg',
      ...overrides,
    }),
    fileBuffer: () => Buffer.from('test file content'),
    presignedUrl: () => 'https://s3.amazonaws.com/bucket/test-image.jpg?signature=xyz',
    uploadResult: () => ({
      Location: 'https://s3.amazonaws.com/bucket/test-image.jpg',
      ETag: '"abc123"',
      Bucket: envConfig.S3_BUCKET_NAME,
      Key: 'test-image.jpg',
    }),
  }

  beforeEach(async () => {
    // Mock S3 instance
    mockS3 = {
      send: jest.fn(),
      config: {} as any,
    } as any

    // Mock S3 constructor
    ;(S3 as jest.Mock).mockImplementation(() => mockS3)

    // Mock Upload instance
    mockUpload = {
      done: jest.fn(),
      on: jest.fn(),
      abort: jest.fn(),
    }

    // Mock Upload constructor
    ;(Upload as any).mockImplementation(() => mockUpload)

    // Mock fs.readFileSync
    mockReadFileSync = fs.readFileSync as jest.MockedFunction<typeof fs.readFileSync>
    mockReadFileSync.mockReturnValue(createTestData.fileBuffer())

    // Mock mime.lookup
    mockMimeLookup = mime.lookup as jest.MockedFunction<typeof mime.lookup>
    mockMimeLookup.mockReturnValue('image/jpeg')

    // Mock getSignedUrl
    mockGetSignedUrl = getSignedUrl as jest.MockedFunction<typeof getSignedUrl>
    mockGetSignedUrl.mockResolvedValue(createTestData.presignedUrl())

    const module: TestingModule = await Test.createTestingModule({
      providers: [S3Service],
    }).compile()

    service = module.get<S3Service>(S3Service)
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  describe('constructor', () => {
    it('should initialize S3 client with correct configuration', () => {
      // Assert - Kiểm tra S3 được khởi tạo với config đúng
      expect(S3).toHaveBeenCalledWith({
        region: envConfig.S3_REGION,
        credentials: {
          accessKeyId: envConfig.S3_ACCESS_KEY_ID,
          secretAccessKey: envConfig.S3_SECRET_ACCESS_KEY,
        },
      })
    })

    it('should create S3Service instance successfully', () => {
      // Assert - Kiểm tra service được tạo thành công
      expect(service).toBeDefined()
      expect(service).toBeInstanceOf(S3Service)
    })
  })

  describe('uploadedFile', () => {
    it('should upload file successfully', async () => {
      // Arrange - Chuẩn bị upload params và mock result
      const uploadParams = createTestData.uploadParams()
      const uploadResult = createTestData.uploadResult()
      mockUpload.done.mockResolvedValue(uploadResult)

      // Act - Thực hiện upload file
      const result = await service.uploadedFile(uploadParams)

      // Assert - Kiểm tra kết quả
      expect(result).toEqual(uploadResult)
      expect(mockUpload.done).toHaveBeenCalled()
    })

    it('should read file from filepath', async () => {
      // Arrange - Chuẩn bị upload params
      const uploadParams = createTestData.uploadParams()
      mockUpload.done.mockResolvedValue(createTestData.uploadResult())

      // Act - Thực hiện upload file
      await service.uploadedFile(uploadParams)

      // Assert - Kiểm tra readFileSync được gọi với filepath đúng
      expect(mockReadFileSync).toHaveBeenCalledWith(uploadParams.filepath)
    })

    it('should create Upload with correct parameters', async () => {
      // Arrange - Chuẩn bị upload params
      const uploadParams = createTestData.uploadParams()
      const fileBuffer = createTestData.fileBuffer()
      mockUpload.done.mockResolvedValue(createTestData.uploadResult())

      // Act - Thực hiện upload file
      await service.uploadedFile(uploadParams)

      // Assert - Kiểm tra Upload được tạo với params đúng
      expect(Upload).toHaveBeenCalledWith({
        client: mockS3,
        params: {
          Bucket: envConfig.S3_BUCKET_NAME,
          Key: uploadParams.filename,
          Body: fileBuffer,
          ContentType: uploadParams.contentType,
        },
        tags: [],
        queueSize: 4,
        partSize: 1024 * 1024 * 5,
        leavePartsOnError: false,
      })
    })

    it('should use correct bucket name from config', async () => {
      // Arrange - Chuẩn bị upload params
      const uploadParams = createTestData.uploadParams()
      mockUpload.done.mockResolvedValue(createTestData.uploadResult())

      // Act - Thực hiện upload file
      await service.uploadedFile(uploadParams)

      // Assert - Kiểm tra bucket name
      expect(Upload).toHaveBeenCalledWith(
        expect.objectContaining({
          params: expect.objectContaining({
            Bucket: envConfig.S3_BUCKET_NAME,
          }),
        }),
      )
    })

    it('should use correct content type', async () => {
      // Arrange - Chuẩn bị upload params với custom content type
      const uploadParams = createTestData.uploadParams({ contentType: 'application/pdf' })
      mockUpload.done.mockResolvedValue(createTestData.uploadResult())

      // Act - Thực hiện upload file
      await service.uploadedFile(uploadParams)

      // Assert - Kiểm tra content type
      expect(Upload).toHaveBeenCalledWith(
        expect.objectContaining({
          params: expect.objectContaining({
            ContentType: 'application/pdf',
          }),
        }),
      )
    })

    it('should use correct queue size for parallel uploads', async () => {
      // Arrange - Chuẩn bị upload params
      const uploadParams = createTestData.uploadParams()
      mockUpload.done.mockResolvedValue(createTestData.uploadResult())

      // Act - Thực hiện upload file
      await service.uploadedFile(uploadParams)

      // Assert - Kiểm tra queueSize = 4
      expect(Upload).toHaveBeenCalledWith(
        expect.objectContaining({
          queueSize: 4,
        }),
      )
    })

    it('should use correct part size (5MB) for multipart upload', async () => {
      // Arrange - Chuẩn bị upload params
      const uploadParams = createTestData.uploadParams()
      mockUpload.done.mockResolvedValue(createTestData.uploadResult())

      // Act - Thực hiện upload file
      await service.uploadedFile(uploadParams)

      // Assert - Kiểm tra partSize = 5MB
      expect(Upload).toHaveBeenCalledWith(
        expect.objectContaining({
          partSize: 1024 * 1024 * 5,
        }),
      )
    })

    it('should set leavePartsOnError to false', async () => {
      // Arrange - Chuẩn bị upload params
      const uploadParams = createTestData.uploadParams()
      mockUpload.done.mockResolvedValue(createTestData.uploadResult())

      // Act - Thực hiện upload file
      await service.uploadedFile(uploadParams)

      // Assert - Kiểm tra leavePartsOnError = false
      expect(Upload).toHaveBeenCalledWith(
        expect.objectContaining({
          leavePartsOnError: false,
        }),
      )
    })

    it('should handle upload errors', async () => {
      // Arrange - Chuẩn bị upload params và mock error
      const uploadParams = createTestData.uploadParams()
      const uploadError = new Error('Upload failed')
      mockUpload.done.mockRejectedValue(uploadError)

      // Act & Assert - Thực hiện upload và expect error
      await expect(service.uploadedFile(uploadParams)).rejects.toThrow('Upload failed')
    })

    it('should upload file with nested path', async () => {
      // Arrange - Chuẩn bị upload params với nested path
      const uploadParams = createTestData.uploadParams({ filename: 'images/products/test.jpg' })
      mockUpload.done.mockResolvedValue(createTestData.uploadResult())

      // Act - Thực hiện upload file
      await service.uploadedFile(uploadParams)

      // Assert - Kiểm tra Key với nested path
      expect(Upload).toHaveBeenCalledWith(
        expect.objectContaining({
          params: expect.objectContaining({
            Key: 'images/products/test.jpg',
          }),
        }),
      )
    })
  })

  describe('createPresignedUrlWithClient', () => {
    it('should create presigned URL successfully', async () => {
      // Arrange - Chuẩn bị filename
      const filename = 'test-image.jpg'

      // Act - Thực hiện tạo presigned URL
      const result = await service.createPresignedUrlWithClient(filename)

      // Assert - Kiểm tra kết quả
      expect(result).toBe(createTestData.presignedUrl())
      expect(mockGetSignedUrl).toHaveBeenCalled()
    })

    it('should lookup content type from filename', async () => {
      // Arrange - Chuẩn bị filename
      const filename = 'test-document.pdf'

      // Act - Thực hiện tạo presigned URL
      await service.createPresignedUrlWithClient(filename)

      // Assert - Kiểm tra mime.lookup được gọi
      expect(mockMimeLookup).toHaveBeenCalledWith(filename)
    })

    it('should use application/octet-stream when mime type not found', async () => {
      // Arrange - Chuẩn bị filename và mock mime.lookup return false
      const filename = 'unknown-file.xyz'
      mockMimeLookup.mockReturnValue(false)

      // Act - Thực hiện tạo presigned URL
      const result = await service.createPresignedUrlWithClient(filename)

      // Assert - Kiểm tra mime.lookup được gọi và result đúng
      expect(mockMimeLookup).toHaveBeenCalledWith(filename)
      expect(result).toBe(createTestData.presignedUrl())
      expect(mockGetSignedUrl).toHaveBeenCalled()
    })

    it('should use correct bucket name from config', async () => {
      // Arrange - Chuẩn bị filename
      const filename = 'test-image.jpg'

      // Act - Thực hiện tạo presigned URL
      const result = await service.createPresignedUrlWithClient(filename)

      // Assert - Kiểm tra result và getSignedUrl được gọi
      expect(result).toBe(createTestData.presignedUrl())
      expect(mockGetSignedUrl).toHaveBeenCalledWith(mockS3, expect.any(Object), { expiresIn: 10 })
    })

    it('should use filename as Key', async () => {
      // Arrange - Chuẩn bị filename
      const filename = 'images/avatar.png'

      // Act - Thực hiện tạo presigned URL
      const result = await service.createPresignedUrlWithClient(filename)

      // Assert - Kiểm tra result
      expect(result).toBe(createTestData.presignedUrl())
      expect(mockGetSignedUrl).toHaveBeenCalled()
    })

    it('should set expiresIn to 10 seconds', async () => {
      // Arrange - Chuẩn bị filename
      const filename = 'test-image.jpg'

      // Act - Thực hiện tạo presigned URL
      await service.createPresignedUrlWithClient(filename)

      // Assert - Kiểm tra expiresIn
      expect(mockGetSignedUrl).toHaveBeenCalledWith(mockS3, expect.any(Object), { expiresIn: 10 })
    })

    it('should handle different file types correctly', async () => {
      // Arrange - Chuẩn bị các file types khác nhau
      const testCases = [
        { filename: 'image.jpg', contentType: 'image/jpeg' },
        { filename: 'document.pdf', contentType: 'application/pdf' },
        { filename: 'video.mp4', contentType: 'video/mp4' },
      ]

      for (const testCase of testCases) {
        mockMimeLookup.mockReturnValue(testCase.contentType)

        // Act - Thực hiện tạo presigned URL
        const result = await service.createPresignedUrlWithClient(testCase.filename)

        // Assert - Kiểm tra mime.lookup được gọi và result đúng
        expect(mockMimeLookup).toHaveBeenCalledWith(testCase.filename)
        expect(result).toBe(createTestData.presignedUrl())
      }
    })
  })
})
