import { Test, TestingModule } from '@nestjs/testing'
import * as fsPromises from 'fs/promises'
import { generateRandomFileName } from '../../../shared/helpers'
import { S3Service } from '../../../shared/services/s3.service'
import { MediaService } from '../media.service'

// Mock fs/promises
jest.mock('fs/promises', () => ({
  unlink: jest.fn(),
}))

// Mock helpers
jest.mock('src/shared/helpers', () => ({
  generateRandomFileName: jest.fn(),
}))

const mockGenerateRandomFileName = generateRandomFileName as jest.MockedFunction<typeof generateRandomFileName>
const mockUnlink = fsPromises.unlink as jest.MockedFunction<typeof fsPromises.unlink>

/**
 * MEDIA SERVICE UNIT TESTS
 *
 * Test Coverage:
 * - uploadFile: Upload files to S3 and cleanup local files
 * - getPresignedUrl: Generate presigned URL for client-side upload
 */

describe('MediaService', () => {
  let service: MediaService
  let mockS3Service: jest.Mocked<S3Service>

  // Test data factories
  const createMockFile = (overrides = {}): Express.Multer.File => ({
    fieldname: 'files',
    originalname: 'test.jpg',
    encoding: '7bit',
    mimetype: 'image/jpeg',
    destination: 'upload/',
    filename: 'test-123.jpg',
    path: 'upload/test-123.jpg',
    size: 1024,
    stream: null as any,
    buffer: null as any,
    ...overrides,
  })

  const createS3UploadResult = (location: string) => ({
    Location: location,
    ETag: '"abc123"',
    Bucket: 'test-bucket',
    Key: 'images/test-123.jpg',
  })

  beforeEach(async () => {
    // Mock S3Service
    mockS3Service = {
      uploadedFile: jest.fn(),
      createPresignedUrlWithClient: jest.fn(),
    } as any

    const module: TestingModule = await Test.createTestingModule({
      providers: [MediaService, { provide: S3Service, useValue: mockS3Service }],
    }).compile()

    service = module.get<MediaService>(MediaService)
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  // ============================================
  // UPLOAD FILE
  // ============================================

  describe('uploadFile', () => {
    it('should upload single file to S3 and cleanup local file', async () => {
      // Arrange
      const mockFile = createMockFile()
      const files = [mockFile]
      const s3Location = 'https://s3.amazonaws.com/bucket/images/test-123.jpg'
      const s3Result = createS3UploadResult(s3Location)

      mockS3Service.uploadedFile.mockResolvedValue(s3Result as any)
      mockUnlink.mockResolvedValue(undefined)

      // Act
      const result = await service.uploadFile(files)

      // Assert
      expect(result).toEqual({
        data: [{ url: s3Location }],
      })
      expect(mockS3Service.uploadedFile).toHaveBeenCalledTimes(1)
      expect(mockS3Service.uploadedFile).toHaveBeenCalledWith({
        filename: 'images/test-123.jpg',
        filepath: mockFile.path,
        contentType: mockFile.mimetype,
      })
      expect(mockUnlink).toHaveBeenCalledTimes(1)
      expect(mockUnlink).toHaveBeenCalledWith(mockFile.path)
    })

    it('should upload multiple files to S3 and cleanup all local files', async () => {
      // Arrange
      const mockFile1 = createMockFile({ filename: 'test-1.jpg', path: 'upload/test-1.jpg' })
      const mockFile2 = createMockFile({ filename: 'test-2.jpg', path: 'upload/test-2.jpg' })
      const mockFile3 = createMockFile({ filename: 'test-3.jpg', path: 'upload/test-3.jpg' })
      const files = [mockFile1, mockFile2, mockFile3]

      const s3Result1 = createS3UploadResult('https://s3.amazonaws.com/bucket/images/test-1.jpg')
      const s3Result2 = createS3UploadResult('https://s3.amazonaws.com/bucket/images/test-2.jpg')
      const s3Result3 = createS3UploadResult('https://s3.amazonaws.com/bucket/images/test-3.jpg')

      mockS3Service.uploadedFile
        .mockResolvedValueOnce(s3Result1 as any)
        .mockResolvedValueOnce(s3Result2 as any)
        .mockResolvedValueOnce(s3Result3 as any)
      mockUnlink.mockResolvedValue(undefined)

      // Act
      const result = await service.uploadFile(files)

      // Assert
      expect(result).toEqual({
        data: [
          { url: 'https://s3.amazonaws.com/bucket/images/test-1.jpg' },
          { url: 'https://s3.amazonaws.com/bucket/images/test-2.jpg' },
          { url: 'https://s3.amazonaws.com/bucket/images/test-3.jpg' },
        ],
      })
      expect(mockS3Service.uploadedFile).toHaveBeenCalledTimes(3)
      expect(mockUnlink).toHaveBeenCalledTimes(3)
      expect(mockUnlink).toHaveBeenCalledWith('upload/test-1.jpg')
      expect(mockUnlink).toHaveBeenCalledWith('upload/test-2.jpg')
      expect(mockUnlink).toHaveBeenCalledWith('upload/test-3.jpg')
    })

    it('should handle S3 upload error and not cleanup files', async () => {
      // Arrange
      const mockFile = createMockFile()
      const files = [mockFile]
      const s3Error = new Error('S3 upload failed')

      mockS3Service.uploadedFile.mockRejectedValue(s3Error)

      // Act & Assert
      await expect(service.uploadFile(files)).rejects.toThrow('S3 upload failed')
      expect(mockS3Service.uploadedFile).toHaveBeenCalledTimes(1)
      expect(mockUnlink).not.toHaveBeenCalled() // Should not cleanup if upload fails
    })

    it('should upload files with different content types', async () => {
      // Arrange
      const pdfFile = createMockFile({
        filename: 'document.pdf',
        path: 'upload/document.pdf',
        mimetype: 'application/pdf',
        originalname: 'document.pdf',
      })
      const pngFile = createMockFile({
        filename: 'image.png',
        path: 'upload/image.png',
        mimetype: 'image/png',
        originalname: 'image.png',
      })
      const files = [pdfFile, pngFile]

      const s3Result1 = createS3UploadResult('https://s3.amazonaws.com/bucket/images/document.pdf')
      const s3Result2 = createS3UploadResult('https://s3.amazonaws.com/bucket/images/image.png')

      mockS3Service.uploadedFile.mockResolvedValueOnce(s3Result1 as any).mockResolvedValueOnce(s3Result2 as any)
      mockUnlink.mockResolvedValue(undefined)

      // Act
      const result = await service.uploadFile(files)

      // Assert
      expect(result.data).toHaveLength(2)
      expect(mockS3Service.uploadedFile).toHaveBeenNthCalledWith(1, {
        filename: 'images/document.pdf',
        filepath: 'upload/document.pdf',
        contentType: 'application/pdf',
      })
      expect(mockS3Service.uploadedFile).toHaveBeenNthCalledWith(2, {
        filename: 'images/image.png',
        filepath: 'upload/image.png',
        contentType: 'image/png',
      })
    })

    it('should convert S3 Location to string in result', async () => {
      // Arrange
      const mockFile = createMockFile()
      const files = [mockFile]
      const s3Result = createS3UploadResult('https://s3.amazonaws.com/bucket/images/test-123.jpg')

      mockS3Service.uploadedFile.mockResolvedValue(s3Result as any)
      mockUnlink.mockResolvedValue(undefined)

      // Act
      const result = await service.uploadFile(files)

      // Assert
      expect(result.data[0].url).toBe('https://s3.amazonaws.com/bucket/images/test-123.jpg')
      expect(typeof result.data[0].url).toBe('string')
    })

    it('should cleanup files even if one file upload succeeds and another fails', async () => {
      // Arrange
      const mockFile1 = createMockFile({ filename: 'test-1.jpg', path: 'upload/test-1.jpg' })
      const mockFile2 = createMockFile({ filename: 'test-2.jpg', path: 'upload/test-2.jpg' })
      const files = [mockFile1, mockFile2]

      const s3Result1 = createS3UploadResult('https://s3.amazonaws.com/bucket/images/test-1.jpg')
      const s3Error = new Error('S3 upload failed for file 2')

      mockS3Service.uploadedFile.mockResolvedValueOnce(s3Result1 as any).mockRejectedValueOnce(s3Error)

      // Act & Assert
      await expect(service.uploadFile(files)).rejects.toThrow('S3 upload failed for file 2')
      expect(mockUnlink).not.toHaveBeenCalled() // Promise.all fails fast, cleanup not reached
    })
  })

  // ============================================
  // GET PRESIGNED URL
  // ============================================

  describe('getPresignedUrl', () => {
    it('should generate presigned URL with random filename', async () => {
      // Arrange
      const body = { filename: 'avatar.jpg', filesize: 500000 }
      const randomFilename = 'abc-123-def-456.jpg'
      const presignedUrl =
        'https://s3.amazonaws.com/bucket/abc-123-def-456.jpg?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Credential=...'
      const expectedUrl = 'https://s3.amazonaws.com/bucket/abc-123-def-456.jpg'

      mockGenerateRandomFileName.mockReturnValue(randomFilename)
      mockS3Service.createPresignedUrlWithClient.mockResolvedValue(presignedUrl)

      // Act
      const result = await service.getPresignedUrl(body)

      // Assert
      expect(result).toEqual({
        presignedUrl,
        url: expectedUrl,
      })
      expect(mockGenerateRandomFileName).toHaveBeenCalledWith('avatar.jpg')
      expect(mockS3Service.createPresignedUrlWithClient).toHaveBeenCalledWith(randomFilename)
    })

    it('should split presigned URL to extract base URL', async () => {
      // Arrange
      const body = { filename: 'document.pdf', filesize: 800000 }
      const randomFilename = 'xyz-789.pdf'
      const presignedUrl = 'https://s3.amazonaws.com/bucket/xyz-789.pdf?signature=abc&expires=123'

      mockGenerateRandomFileName.mockReturnValue(randomFilename)
      mockS3Service.createPresignedUrlWithClient.mockResolvedValue(presignedUrl)

      // Act
      const result = await service.getPresignedUrl(body)

      // Assert
      expect(result.url).toBe('https://s3.amazonaws.com/bucket/xyz-789.pdf')
      expect(result.url).not.toContain('?')
      expect(result.presignedUrl).toContain('?')
    })

    it('should handle different file extensions', async () => {
      // Arrange
      const testCases = [
        { filename: 'image.png', randomName: 'uuid-1.png', filesize: 300000 },
        { filename: 'video.mp4', randomName: 'uuid-2.mp4', filesize: 900000 },
        { filename: 'archive.zip', randomName: 'uuid-3.zip', filesize: 600000 },
      ]

      for (const testCase of testCases) {
        mockGenerateRandomFileName.mockReturnValue(testCase.randomName)
        mockS3Service.createPresignedUrlWithClient.mockResolvedValue(
          `https://s3.amazonaws.com/bucket/${testCase.randomName}?signature=abc`,
        )

        // Act
        const result = await service.getPresignedUrl({ filename: testCase.filename, filesize: testCase.filesize })

        // Assert
        expect(mockGenerateRandomFileName).toHaveBeenCalledWith(testCase.filename)
        expect(mockS3Service.createPresignedUrlWithClient).toHaveBeenCalledWith(testCase.randomName)
        expect(result.url).toBe(`https://s3.amazonaws.com/bucket/${testCase.randomName}`)
      }
    })

    it('should handle S3 service error', async () => {
      // Arrange
      const body = { filename: 'test.jpg', filesize: 400000 }
      const randomFilename = 'random-123.jpg'
      const s3Error = new Error('Failed to generate presigned URL')

      mockGenerateRandomFileName.mockReturnValue(randomFilename)
      mockS3Service.createPresignedUrlWithClient.mockRejectedValue(s3Error)

      // Act & Assert
      await expect(service.getPresignedUrl(body)).rejects.toThrow('Failed to generate presigned URL')
      expect(mockGenerateRandomFileName).toHaveBeenCalledWith('test.jpg')
      expect(mockS3Service.createPresignedUrlWithClient).toHaveBeenCalledWith(randomFilename)
    })

    it('should handle presigned URL without query parameters', async () => {
      // Arrange
      const body = { filename: 'simple.jpg', filesize: 200000 }
      const randomFilename = 'simple-uuid.jpg'
      const presignedUrl = 'https://s3.amazonaws.com/bucket/simple-uuid.jpg' // No query params

      mockGenerateRandomFileName.mockReturnValue(randomFilename)
      mockS3Service.createPresignedUrlWithClient.mockResolvedValue(presignedUrl)

      // Act
      const result = await service.getPresignedUrl(body)

      // Assert
      expect(result.url).toBe('https://s3.amazonaws.com/bucket/simple-uuid.jpg')
      expect(result.presignedUrl).toBe(presignedUrl)
    })
  })
})
