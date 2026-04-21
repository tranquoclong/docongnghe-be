import { NotFoundException } from '@nestjs/common'
import { Test, TestingModule } from '@nestjs/testing'
import { Response } from 'express'
import { MediaController } from '../media.controller'
import { MediaService } from '../media.service'

/**
 * MEDIA CONTROLLER UNIT TESTS
 *
 * Test coverage cho Media Controller
 * - File upload (single, multiple files)
 * - File serving (static files)
 * - Presigned URL generation
 * - File validation
 * - Error handling
 */

describe('MediaController', () => {
  let controller: MediaController
  let mockMediaService: jest.Mocked<MediaService>

  // ===== TEST DATA FACTORIES =====

  const createMockFile = (overrides = {}): Express.Multer.File => ({
    fieldname: 'files',
    originalname: 'test.jpg',
    encoding: '7bit',
    mimetype: 'image/jpeg',
    size: 1024 * 1024, // 1MB
    destination: 'upload',
    filename: 'test-123.jpg',
    path: 'upload/test-123.jpg',
    buffer: Buffer.from(''),
    stream: null as any,
    ...overrides,
  })

  const createMockResponse = (): Partial<Response> => ({
    sendFile: jest.fn((path, callback) => {
      if (callback) callback(null as any)
    }) as any,
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  })

  beforeEach(async () => {
    // Mock MediaService
    mockMediaService = {
      uploadFile: jest.fn(),
      getPresignedUrl: jest.fn(),
    } as any

    const module: TestingModule = await Test.createTestingModule({
      controllers: [MediaController],
      providers: [{ provide: MediaService, useValue: mockMediaService }],
    }).compile()

    controller = module.get<MediaController>(MediaController)
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  // ===== INITIALIZATION =====

  describe('Controller Initialization', () => {
    it('should be defined', () => {
      expect(controller).toBeDefined()
    })

    it('should have mediaService injected', () => {
      expect(controller['mediaService']).toBeDefined()
      expect(controller['mediaService']).toBe(mockMediaService)
    })
  })

  // ===== UPLOAD FILE =====

  describe('uploadFile (POST /media/images/upload)', () => {
    describe('✅ Success Cases', () => {
      it('should upload single file successfully', async () => {
        const mockFile = createMockFile()
        const files = [mockFile]
        const expectedResult = {
          data: [{ url: 'https://s3.amazonaws.com/bucket/images/test-123.jpg' }],
        }

        mockMediaService.uploadFile.mockResolvedValue(expectedResult)

        const result = await controller.uploadFile(files)

        expect(result).toEqual(expectedResult)
        expect(mockMediaService.uploadFile).toHaveBeenCalledWith(files)
        expect(mockMediaService.uploadFile).toHaveBeenCalledTimes(1)
      })

      it('should upload multiple files successfully', async () => {
        const mockFile1 = createMockFile({ filename: 'test-1.jpg', path: 'upload/test-1.jpg' })
        const mockFile2 = createMockFile({ filename: 'test-2.jpg', path: 'upload/test-2.jpg' })
        const mockFile3 = createMockFile({ filename: 'test-3.jpg', path: 'upload/test-3.jpg' })
        const files = [mockFile1, mockFile2, mockFile3]
        const expectedResult = {
          data: [
            { url: 'https://s3.amazonaws.com/bucket/images/test-1.jpg' },
            { url: 'https://s3.amazonaws.com/bucket/images/test-2.jpg' },
            { url: 'https://s3.amazonaws.com/bucket/images/test-3.jpg' },
          ],
        }

        mockMediaService.uploadFile.mockResolvedValue(expectedResult)

        const result = await controller.uploadFile(files)

        expect(result).toEqual(expectedResult)
        expect(result.data).toHaveLength(3)
        expect(mockMediaService.uploadFile).toHaveBeenCalledWith(files)
      })

      it('should upload PNG file successfully', async () => {
        const mockFile = createMockFile({
          originalname: 'image.png',
          filename: 'test-456.png',
          mimetype: 'image/png',
        })
        const files = [mockFile]
        const expectedResult = {
          data: [{ url: 'https://s3.amazonaws.com/bucket/images/test-456.png' }],
        }

        mockMediaService.uploadFile.mockResolvedValue(expectedResult)

        const result = await controller.uploadFile(files)

        expect(result).toEqual(expectedResult)
        expect(mockMediaService.uploadFile).toHaveBeenCalledWith(files)
      })

      it('should upload WEBP file successfully', async () => {
        const mockFile = createMockFile({
          originalname: 'image.webp',
          filename: 'test-789.webp',
          mimetype: 'image/webp',
        })
        const files = [mockFile]
        const expectedResult = {
          data: [{ url: 'https://s3.amazonaws.com/bucket/images/test-789.webp' }],
        }

        mockMediaService.uploadFile.mockResolvedValue(expectedResult)

        const result = await controller.uploadFile(files)

        expect(result).toEqual(expectedResult)
        expect(mockMediaService.uploadFile).toHaveBeenCalledWith(files)
      })

      it('should upload maximum allowed files (100 files)', async () => {
        const files = Array.from({ length: 100 }, (_, i) =>
          createMockFile({
            filename: `test-${i}.jpg`,
            path: `upload/test-${i}.jpg`,
          }),
        )
        const expectedResult = {
          data: files.map((_, i) => ({ url: `https://s3.amazonaws.com/bucket/images/test-${i}.jpg` })),
        }

        mockMediaService.uploadFile.mockResolvedValue(expectedResult)

        const result = await controller.uploadFile(files)

        expect(result).toEqual(expectedResult)
        expect(result.data).toHaveLength(100)
        expect(mockMediaService.uploadFile).toHaveBeenCalledWith(files)
      })
    })

    describe('❌ Error Cases', () => {
      it('should handle S3 upload error', async () => {
        const mockFile = createMockFile()
        const files = [mockFile]
        const s3Error = new Error('S3 upload failed')

        mockMediaService.uploadFile.mockRejectedValue(s3Error)

        await expect(controller.uploadFile(files)).rejects.toThrow('S3 upload failed')
        expect(mockMediaService.uploadFile).toHaveBeenCalledWith(files)
      })

      it('should handle network error during upload', async () => {
        const mockFile = createMockFile()
        const files = [mockFile]
        const networkError = new Error('Network timeout')

        mockMediaService.uploadFile.mockRejectedValue(networkError)

        await expect(controller.uploadFile(files)).rejects.toThrow('Network timeout')
      })

      it('should handle service error', async () => {
        const mockFile = createMockFile()
        const files = [mockFile]
        const serviceError = new Error('Service unavailable')

        mockMediaService.uploadFile.mockRejectedValue(serviceError)

        await expect(controller.uploadFile(files)).rejects.toThrow('Service unavailable')
      })
    })
  })

  // ===== SERVE FILE =====

  describe('serveFile (GET /media/static/:filename)', () => {
    describe('✅ Success Cases', () => {
      it('should serve file successfully', () => {
        const filename = 'test-123.jpg'
        const mockRes = createMockResponse()

        controller.serveFile(filename, mockRes as Response)

        expect(mockRes.sendFile).toHaveBeenCalled()
        const sendFileCall = (mockRes.sendFile as jest.Mock).mock.calls[0]
        expect(sendFileCall[0]).toContain(filename)
      })

      it('should serve PNG file successfully', () => {
        const filename = 'image-456.png'
        const mockRes = createMockResponse()

        controller.serveFile(filename, mockRes as Response)

        expect(mockRes.sendFile).toHaveBeenCalled()
        const sendFileCall = (mockRes.sendFile as jest.Mock).mock.calls[0]
        expect(sendFileCall[0]).toContain(filename)
      })

      it('should serve WEBP file successfully', () => {
        const filename = 'photo-789.webp'
        const mockRes = createMockResponse()

        controller.serveFile(filename, mockRes as Response)

        expect(mockRes.sendFile).toHaveBeenCalled()
        const sendFileCall = (mockRes.sendFile as jest.Mock).mock.calls[0]
        expect(sendFileCall[0]).toContain(filename)
      })
    })

    describe('❌ Error Cases', () => {
      it('should handle file not found error', () => {
        const filename = 'nonexistent.jpg'
        const mockRes = {
          sendFile: jest.fn((path, callback) => {
            const error = new Error('File not found')
            callback(error)
          }),
          status: jest.fn().mockReturnThis(),
          json: jest.fn().mockReturnThis(),
        } as any

        controller.serveFile(filename, mockRes)

        expect(mockRes.sendFile).toHaveBeenCalled()
        expect(mockRes.status).toHaveBeenCalledWith(404)
        expect(mockRes.json).toHaveBeenCalled()
      })

      it('should return NotFoundException response when file not found', () => {
        const filename = 'missing.jpg'
        const mockRes = {
          sendFile: jest.fn((path, callback) => {
            callback(new Error('ENOENT'))
          }),
          status: jest.fn().mockReturnThis(),
          json: jest.fn().mockReturnThis(),
        } as any

        controller.serveFile(filename, mockRes)

        const notFoundException = new NotFoundException('File not found')
        expect(mockRes.status).toHaveBeenCalledWith(notFoundException.getStatus())
        expect(mockRes.json).toHaveBeenCalledWith(notFoundException.getResponse())
      })

      it('should handle permission error', () => {
        const filename = 'restricted.jpg'
        const mockRes = {
          sendFile: jest.fn((path, callback) => {
            callback(new Error('Permission denied'))
          }),
          status: jest.fn().mockReturnThis(),
          json: jest.fn().mockReturnThis(),
        } as any

        controller.serveFile(filename, mockRes)

        expect(mockRes.sendFile).toHaveBeenCalled()
        expect(mockRes.status).toHaveBeenCalled()
        expect(mockRes.json).toHaveBeenCalled()
      })
    })
  })

  // ===== CREATE PRESIGNED URL =====

  describe('createPresignedUrl (POST /media/images/upload/presigned-url)', () => {
    describe('✅ Success Cases', () => {
      it('should generate presigned URL successfully', async () => {
        const body = {
          filename: 'test.jpg',
          filesize: 500000, // 500KB
        }
        const expectedResult = {
          presignedUrl: 'https://s3.amazonaws.com/bucket/random-123.jpg?signature=xyz',
          url: 'https://s3.amazonaws.com/bucket/random-123.jpg',
        }

        mockMediaService.getPresignedUrl.mockResolvedValue(expectedResult)

        const result = await controller.createPresignedUrl(body)

        expect(result).toEqual(expectedResult)
        expect(mockMediaService.getPresignedUrl).toHaveBeenCalledWith(body)
        expect(mockMediaService.getPresignedUrl).toHaveBeenCalledTimes(1)
      })

      it('should generate presigned URL for PNG file', async () => {
        const body = {
          filename: 'image.png',
          filesize: 800000, // 800KB
        }
        const expectedResult = {
          presignedUrl: 'https://s3.amazonaws.com/bucket/random-456.png?signature=abc',
          url: 'https://s3.amazonaws.com/bucket/random-456.png',
        }

        mockMediaService.getPresignedUrl.mockResolvedValue(expectedResult)

        const result = await controller.createPresignedUrl(body)

        expect(result).toEqual(expectedResult)
        expect(mockMediaService.getPresignedUrl).toHaveBeenCalledWith(body)
      })

      it('should generate presigned URL for WEBP file', async () => {
        const body = {
          filename: 'photo.webp',
          filesize: 1024 * 1024, // 1MB (max allowed)
        }
        const expectedResult = {
          presignedUrl: 'https://s3.amazonaws.com/bucket/random-789.webp?signature=def',
          url: 'https://s3.amazonaws.com/bucket/random-789.webp',
        }

        mockMediaService.getPresignedUrl.mockResolvedValue(expectedResult)

        const result = await controller.createPresignedUrl(body)

        expect(result).toEqual(expectedResult)
        expect(mockMediaService.getPresignedUrl).toHaveBeenCalledWith(body)
      })

      it('should generate presigned URL for small file', async () => {
        const body = {
          filename: 'tiny.jpg',
          filesize: 1024, // 1KB
        }
        const expectedResult = {
          presignedUrl: 'https://s3.amazonaws.com/bucket/random-small.jpg?signature=ghi',
          url: 'https://s3.amazonaws.com/bucket/random-small.jpg',
        }

        mockMediaService.getPresignedUrl.mockResolvedValue(expectedResult)

        const result = await controller.createPresignedUrl(body)

        expect(result).toEqual(expectedResult)
        expect(mockMediaService.getPresignedUrl).toHaveBeenCalledWith(body)
      })

      it('should return both presignedUrl and url', async () => {
        const body = {
          filename: 'test.jpg',
          filesize: 500000,
        }
        const expectedResult = {
          presignedUrl: 'https://s3.amazonaws.com/bucket/file.jpg?AWSAccessKeyId=xxx&Expires=123&Signature=yyy',
          url: 'https://s3.amazonaws.com/bucket/file.jpg',
        }

        mockMediaService.getPresignedUrl.mockResolvedValue(expectedResult)

        const result = await controller.createPresignedUrl(body)

        expect(result).toHaveProperty('presignedUrl')
        expect(result).toHaveProperty('url')
        expect(result.presignedUrl).toContain('?')
        expect(result.url).not.toContain('?')
      })
    })

    describe('❌ Error Cases', () => {
      it('should handle S3 service error', async () => {
        const body = {
          filename: 'test.jpg',
          filesize: 500000,
        }
        const s3Error = new Error('Failed to generate presigned URL')

        mockMediaService.getPresignedUrl.mockRejectedValue(s3Error)

        await expect(controller.createPresignedUrl(body)).rejects.toThrow('Failed to generate presigned URL')
        expect(mockMediaService.getPresignedUrl).toHaveBeenCalledWith(body)
      })

      it('should handle AWS credentials error', async () => {
        const body = {
          filename: 'test.jpg',
          filesize: 500000,
        }
        const credentialsError = new Error('Invalid AWS credentials')

        mockMediaService.getPresignedUrl.mockRejectedValue(credentialsError)

        await expect(controller.createPresignedUrl(body)).rejects.toThrow('Invalid AWS credentials')
      })

      it('should handle network timeout', async () => {
        const body = {
          filename: 'test.jpg',
          filesize: 500000,
        }
        const timeoutError = new Error('Request timeout')

        mockMediaService.getPresignedUrl.mockRejectedValue(timeoutError)

        await expect(controller.createPresignedUrl(body)).rejects.toThrow('Request timeout')
      })
    })
  })

  // ===== INTEGRATION SCENARIOS =====

  describe('Integration Scenarios', () => {
    it('should handle complete upload workflow', async () => {
      const mockFile = createMockFile()
      const files = [mockFile]
      const uploadResult = {
        data: [{ url: 'https://s3.amazonaws.com/bucket/images/test-123.jpg' }],
      }

      mockMediaService.uploadFile.mockResolvedValue(uploadResult)

      const result = await controller.uploadFile(files)

      expect(result).toEqual(uploadResult)
      expect(result.data[0].url).toContain('https://s3.amazonaws.com')
    })

    it('should handle presigned URL workflow', async () => {
      const body = {
        filename: 'test.jpg',
        filesize: 500000,
      }
      const presignedResult = {
        presignedUrl: 'https://s3.amazonaws.com/bucket/random.jpg?signature=xyz',
        url: 'https://s3.amazonaws.com/bucket/random.jpg',
      }

      mockMediaService.getPresignedUrl.mockResolvedValue(presignedResult)

      const result = await controller.createPresignedUrl(body)

      expect(result.presignedUrl).toBeDefined()
      expect(result.url).toBeDefined()
      expect(result.url).toBe(result.presignedUrl.split('?')[0])
    })

    it('should handle multiple file types in single upload', async () => {
      const files = [
        createMockFile({ filename: 'image1.jpg', mimetype: 'image/jpeg' }),
        createMockFile({ filename: 'image2.png', mimetype: 'image/png' }),
        createMockFile({ filename: 'image3.webp', mimetype: 'image/webp' }),
      ]
      const uploadResult = {
        data: [
          { url: 'https://s3.amazonaws.com/bucket/images/image1.jpg' },
          { url: 'https://s3.amazonaws.com/bucket/images/image2.png' },
          { url: 'https://s3.amazonaws.com/bucket/images/image3.webp' },
        ],
      }

      mockMediaService.uploadFile.mockResolvedValue(uploadResult)

      const result = await controller.uploadFile(files)

      expect(result.data).toHaveLength(3)
      expect(result.data[0].url).toContain('.jpg')
      expect(result.data[1].url).toContain('.png')
      expect(result.data[2].url).toContain('.webp')
    })
  })

  // ===== RESPONSE STRUCTURE SNAPSHOTS =====

  describe('Response Structure Snapshots', () => {
    it('should match upload file response structure', async () => {
      const mockFile = createMockFile()
      const uploadResult = {
        data: [{ url: 'https://s3.amazonaws.com/bucket/images/test-123.jpg' }],
      }
      mockMediaService.uploadFile.mockResolvedValue(uploadResult)
      const result = await controller.uploadFile([mockFile])
      expect(result).toMatchSnapshot()
    })

    it('should match presigned URL response structure', async () => {
      const presignedResult = {
        presignedUrl: 'https://s3.amazonaws.com/bucket/images/test.jpg?X-Amz-Signature=abc123',
        url: 'https://s3.amazonaws.com/bucket/images/test.jpg',
      }
      mockMediaService.getPresignedUrl.mockResolvedValue(presignedResult)
      const result = await controller.createPresignedUrl({ filename: 'test.jpg', mimetype: 'image/jpeg' } as any)
      expect(result).toMatchSnapshot()
    })
  })
})
