import { FileTypeValidator, MaxFileSizeValidator } from '@nestjs/common'
import * as fsPromises from 'fs/promises'
import { ParseFilePipeWithUnlink } from '../parse-file-pipe-with-unlink.pipe'

// Mock fs/promises
jest.mock('fs/promises')

describe('ParseFilePipeWithUnlink', () => {
  let pipe: ParseFilePipeWithUnlink
  let mockUnlink: jest.MockedFunction<typeof fsPromises.unlink>

  beforeEach(() => {
    jest.clearAllMocks()
    mockUnlink = fsPromises.unlink as jest.MockedFunction<typeof fsPromises.unlink>
    mockUnlink.mockResolvedValue(undefined)
  })

  // ===== PIPE INITIALIZATION =====

  describe('Pipe Initialization', () => {
    it('should create pipe without options', () => {
      // Act
      pipe = new ParseFilePipeWithUnlink()

      // Assert
      expect(pipe).toBeDefined()
      expect(pipe).toBeInstanceOf(ParseFilePipeWithUnlink)
    })

    it('should create pipe with validators', () => {
      // Arrange
      const validators = [
        new MaxFileSizeValidator({ maxSize: 5 * 1024 * 1024 }), // 5MB
        new FileTypeValidator({ fileType: /(jpg|jpeg|png|webp)$/ }),
      ]

      // Act
      pipe = new ParseFilePipeWithUnlink({ validators })

      // Assert
      expect(pipe).toBeDefined()
      expect(pipe).toBeInstanceOf(ParseFilePipeWithUnlink)
    })
  })

  // ===== SUCCESSFUL VALIDATION =====

  describe('Successful Validation', () => {
    it('should pass validation for valid single file', async () => {
      // Arrange
      const validators = [new MaxFileSizeValidator({ maxSize: 5 * 1024 * 1024 })] // 5MB
      pipe = new ParseFilePipeWithUnlink({ validators })

      const mockFile: Express.Multer.File = {
        fieldname: 'file',
        originalname: 'test.jpg',
        encoding: '7bit',
        mimetype: 'image/jpeg',
        size: 1024 * 1024, // 1MB
        destination: 'uploads/',
        filename: 'test-123.jpg',
        path: 'uploads/test-123.jpg',
        buffer: Buffer.from(''),
        stream: null as any,
      }

      // Act
      const result = await pipe.transform([mockFile])

      // Assert
      expect(result).toEqual([mockFile])
      expect(mockUnlink).not.toHaveBeenCalled() // No cleanup on success
    })

    it('should pass validation for multiple valid files', async () => {
      // Arrange
      const validators = [new MaxFileSizeValidator({ maxSize: 5 * 1024 * 1024 })]
      pipe = new ParseFilePipeWithUnlink({ validators })

      const mockFiles: Express.Multer.File[] = [
        {
          fieldname: 'files',
          originalname: 'test1.jpg',
          encoding: '7bit',
          mimetype: 'image/jpeg',
          size: 1024 * 1024,
          destination: 'uploads/',
          filename: 'test1-123.jpg',
          path: 'uploads/test1-123.jpg',
          buffer: Buffer.from(''),
          stream: null as any,
        },
        {
          fieldname: 'files',
          originalname: 'test2.png',
          encoding: '7bit',
          mimetype: 'image/png',
          size: 2 * 1024 * 1024,
          destination: 'uploads/',
          filename: 'test2-456.png',
          path: 'uploads/test2-456.png',
          buffer: Buffer.from(''),
          stream: null as any,
        },
      ]

      // Act
      const result = await pipe.transform(mockFiles)

      // Assert
      expect(result).toEqual(mockFiles)
      expect(mockUnlink).not.toHaveBeenCalled()
    })
  })

  // ===== VALIDATION FAILURES WITH CLEANUP =====

  describe('Validation Failures with Cleanup', () => {
    it('should cleanup file when size validation fails', async () => {
      // Arrange
      const validators = [
        new MaxFileSizeValidator({ maxSize: 1 * 1024 * 1024 }), // 1MB max
      ]
      pipe = new ParseFilePipeWithUnlink({ validators })

      const mockFile: Express.Multer.File = {
        fieldname: 'file',
        originalname: 'large-file.jpg',
        encoding: '7bit',
        mimetype: 'image/jpeg',
        size: 10 * 1024 * 1024, // 10MB - exceeds limit
        destination: 'uploads/',
        filename: 'large-file-123.jpg',
        path: 'uploads/large-file-123.jpg',
        buffer: Buffer.from(''),
        stream: null as any,
      }

      // Act & Assert
      await expect(pipe.transform([mockFile])).rejects.toThrow()
      expect(mockUnlink).toHaveBeenCalledTimes(1)
      expect(mockUnlink).toHaveBeenCalledWith('uploads/large-file-123.jpg')
    })

    it('should cleanup file when file type validation fails', async () => {
      // Arrange
      const validators = [new FileTypeValidator({ fileType: /(jpg|jpeg|png|webp)$/ })]
      pipe = new ParseFilePipeWithUnlink({ validators })

      const mockFile: Express.Multer.File = {
        fieldname: 'file',
        originalname: 'document.pdf',
        encoding: '7bit',
        mimetype: 'application/pdf', // Invalid type
        size: 1024 * 1024,
        destination: 'uploads/',
        filename: 'document-123.pdf',
        path: 'uploads/document-123.pdf',
        buffer: Buffer.from(''),
        stream: null as any,
      }

      // Act & Assert
      await expect(pipe.transform([mockFile])).rejects.toThrow()
      expect(mockUnlink).toHaveBeenCalledTimes(1)
      expect(mockUnlink).toHaveBeenCalledWith('uploads/document-123.pdf')
    })

    it('should cleanup all files when validation fails for multiple files', async () => {
      // Arrange
      const validators = [new MaxFileSizeValidator({ maxSize: 1 * 1024 * 1024 })] // 1MB max
      pipe = new ParseFilePipeWithUnlink({ validators })

      const mockFiles: Express.Multer.File[] = [
        {
          fieldname: 'files',
          originalname: 'file1.jpg',
          encoding: '7bit',
          mimetype: 'image/jpeg',
          size: 500 * 1024, // 500KB - valid
          destination: 'uploads/',
          filename: 'file1-123.jpg',
          path: 'uploads/file1-123.jpg',
          buffer: Buffer.from(''),
          stream: null as any,
        },
        {
          fieldname: 'files',
          originalname: 'file2.jpg',
          encoding: '7bit',
          mimetype: 'image/jpeg',
          size: 10 * 1024 * 1024, // 10MB - exceeds limit
          destination: 'uploads/',
          filename: 'file2-456.jpg',
          path: 'uploads/file2-456.jpg',
          buffer: Buffer.from(''),
          stream: null as any,
        },
      ]

      // Act & Assert
      await expect(pipe.transform(mockFiles)).rejects.toThrow()
      expect(mockUnlink).toHaveBeenCalledTimes(2)
      expect(mockUnlink).toHaveBeenCalledWith('uploads/file1-123.jpg')
      expect(mockUnlink).toHaveBeenCalledWith('uploads/file2-456.jpg')
    })

    it('should cleanup files when both size and type validation fail', async () => {
      // Arrange
      const validators = [
        new MaxFileSizeValidator({ maxSize: 1 * 1024 * 1024 }), // 1MB max
        new FileTypeValidator({ fileType: /(jpg|jpeg|png|webp)$/ }),
      ]
      pipe = new ParseFilePipeWithUnlink({ validators })

      const mockFile: Express.Multer.File = {
        fieldname: 'file',
        originalname: 'large-document.pdf',
        encoding: '7bit',
        mimetype: 'application/pdf', // Invalid type
        size: 10 * 1024 * 1024, // 10MB - exceeds limit
        destination: 'uploads/',
        filename: 'large-document-123.pdf',
        path: 'uploads/large-document-123.pdf',
        buffer: Buffer.from(''),
        stream: null as any,
      }

      // Act & Assert
      await expect(pipe.transform([mockFile])).rejects.toThrow()
      expect(mockUnlink).toHaveBeenCalledTimes(1)
      expect(mockUnlink).toHaveBeenCalledWith('uploads/large-document-123.pdf')
    })
  })

  // ===== ERROR HANDLING =====

  describe('Error Handling', () => {
    it('should throw validation error even if unlink fails', async () => {
      // Arrange
      const validators = [new MaxFileSizeValidator({ maxSize: 1 * 1024 * 1024 })]
      pipe = new ParseFilePipeWithUnlink({ validators })

      const mockFile: Express.Multer.File = {
        fieldname: 'file',
        originalname: 'large-file.jpg',
        encoding: '7bit',
        mimetype: 'image/jpeg',
        size: 10 * 1024 * 1024, // Exceeds limit
        destination: 'uploads/',
        filename: 'large-file-123.jpg',
        path: 'uploads/large-file-123.jpg',
        buffer: Buffer.from(''),
        stream: null as any,
      }

      // Mock unlink to fail
      mockUnlink.mockRejectedValue(new Error('File system error'))

      // Act & Assert - Should still throw validation error
      await expect(pipe.transform([mockFile])).rejects.toThrow()
      expect(mockUnlink).toHaveBeenCalledTimes(1)
    })

    it('should throw error for empty file array', async () => {
      // Arrange
      pipe = new ParseFilePipeWithUnlink()

      // Act & Assert - ParseFilePipe requires files
      await expect(pipe.transform([])).rejects.toThrow()
      expect(mockUnlink).not.toHaveBeenCalled()
    })

    it('should cleanup files with special characters in path', async () => {
      // Arrange
      const validators = [new MaxFileSizeValidator({ maxSize: 1 * 1024 * 1024 })]
      pipe = new ParseFilePipeWithUnlink({ validators })

      const mockFile: Express.Multer.File = {
        fieldname: 'file',
        originalname: 'file with spaces & special.jpg',
        encoding: '7bit',
        mimetype: 'image/jpeg',
        size: 10 * 1024 * 1024, // Exceeds limit
        destination: 'uploads/',
        filename: 'file-with-spaces-special-123.jpg',
        path: 'uploads/file-with-spaces-special-123.jpg',
        buffer: Buffer.from(''),
        stream: null as any,
      }

      // Act & Assert
      await expect(pipe.transform([mockFile])).rejects.toThrow()
      expect(mockUnlink).toHaveBeenCalledTimes(1)
      expect(mockUnlink).toHaveBeenCalledWith('uploads/file-with-spaces-special-123.jpg')
    })
  })
})
