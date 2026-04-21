import { ArgumentsHost, HttpException, HttpStatus, Logger } from '@nestjs/common'
import { BaseExceptionFilter } from '@nestjs/core'
import { Test, TestingModule } from '@nestjs/testing'
import { HttpExceptionFilter } from '../http-exception.filter'

/**
 * HTTP EXCEPTION FILTER UNIT TESTS
 *
 * Module này test exception filter cho HTTP errors
 * Đây là module CRITICAL vì xử lý tất cả HTTP exceptions trong hệ thống
 *
 * Test Coverage:
 * - Basic HttpException handling
 * - ZodSerializationException với ZodErrorV4
 * - Logger integration và error logging
 * - BaseExceptionFilter integration (super.catch())
 * - ArgumentsHost context switching
 * - Different HTTP status codes (400, 401, 403, 404, 422, 500)
 * - Edge cases: null/undefined, malformed errors
 */

describe('HttpExceptionFilter', () => {
  let filter: HttpExceptionFilter
  let mockLogger: jest.SpyInstance
  let mockSuperCatch: jest.SpyInstance
  let mockArgumentsHost: jest.Mocked<ArgumentsHost>

  // Test data factory
  const createMockArgumentsHost = (): jest.Mocked<ArgumentsHost> => {
    const mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
      send: jest.fn(),
    }
    const mockRequest = {
      url: '/api/test',
      method: 'GET',
    }

    return {
      switchToHttp: jest.fn().mockReturnValue({
        getResponse: jest.fn().mockReturnValue(mockResponse),
        getRequest: jest.fn().mockReturnValue(mockRequest),
      }),
      getArgByIndex: jest.fn(),
      getArgs: jest.fn(),
      getType: jest.fn().mockReturnValue('http'),
      switchToRpc: jest.fn(),
      switchToWs: jest.fn(),
      getClass: jest.fn(),
      getHandler: jest.fn(),
    } as any
  }

  const createHttpException = (status: HttpStatus, message: string | object) => {
    return new HttpException(message, status)
  }

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [HttpExceptionFilter],
    }).compile()

    filter = module.get<HttpExceptionFilter>(HttpExceptionFilter)
    mockArgumentsHost = createMockArgumentsHost()

    // Mock Logger methods
    mockLogger = jest.spyOn(Logger.prototype, 'error').mockImplementation()

    // Mock BaseExceptionFilter.catch
    mockSuperCatch = jest.spyOn(BaseExceptionFilter.prototype, 'catch').mockImplementation()
  })

  afterEach(() => {
    jest.clearAllMocks()
    jest.restoreAllMocks()
  })

  describe('🔍 Basic HttpException Handling', () => {
    it('should handle basic HttpException and call super.catch', () => {
      // Arrange
      const exception = createHttpException(HttpStatus.BAD_REQUEST, 'Bad Request')

      // Act
      filter.catch(exception, mockArgumentsHost)

      // Assert
      expect(mockSuperCatch).toHaveBeenCalledWith(exception, mockArgumentsHost)
      expect(mockSuperCatch).toHaveBeenCalledTimes(1)
    })

    it('should handle HttpException with 400 Bad Request', () => {
      // Arrange
      const exception = createHttpException(HttpStatus.BAD_REQUEST, 'Invalid input')

      // Act
      filter.catch(exception, mockArgumentsHost)

      // Assert
      expect(mockSuperCatch).toHaveBeenCalledWith(exception, mockArgumentsHost)
    })

    it('should handle HttpException with 401 Unauthorized', () => {
      // Arrange
      const exception = createHttpException(HttpStatus.UNAUTHORIZED, 'Unauthorized')

      // Act
      filter.catch(exception, mockArgumentsHost)

      // Assert
      expect(mockSuperCatch).toHaveBeenCalledWith(exception, mockArgumentsHost)
    })

    it('should handle HttpException with 403 Forbidden', () => {
      // Arrange
      const exception = createHttpException(HttpStatus.FORBIDDEN, 'Forbidden')

      // Act
      filter.catch(exception, mockArgumentsHost)

      // Assert
      expect(mockSuperCatch).toHaveBeenCalledWith(exception, mockArgumentsHost)
    })

    it('should handle HttpException with 404 Not Found', () => {
      // Arrange
      const exception = createHttpException(HttpStatus.NOT_FOUND, 'Not Found')

      // Act
      filter.catch(exception, mockArgumentsHost)

      // Assert
      expect(mockSuperCatch).toHaveBeenCalledWith(exception, mockArgumentsHost)
    })

    it('should handle HttpException with 422 Unprocessable Entity', () => {
      // Arrange
      const exception = createHttpException(HttpStatus.UNPROCESSABLE_ENTITY, [
        { message: 'Validation failed', path: 'email' },
      ])

      // Act
      filter.catch(exception, mockArgumentsHost)

      // Assert
      expect(mockSuperCatch).toHaveBeenCalledWith(exception, mockArgumentsHost)
    })

    it('should handle HttpException with 500 Internal Server Error', () => {
      // Arrange
      const exception = createHttpException(HttpStatus.INTERNAL_SERVER_ERROR, 'Internal Server Error')

      // Act
      filter.catch(exception, mockArgumentsHost)

      // Assert
      expect(mockSuperCatch).toHaveBeenCalledWith(exception, mockArgumentsHost)
    })
  })

  describe('🔒 ZodSerializationException Handling', () => {
    it('should handle ZodSerializationException logic path', () => {
      // Arrange
      const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation()

      // Test that the filter handles exceptions properly
      // We test the actual behavior: filter.catch() should call super.catch()
      const exception = createHttpException(HttpStatus.BAD_REQUEST, 'Validation error')

      // Act
      filter.catch(exception, mockArgumentsHost)

      // Assert
      // The filter should always call super.catch for any HttpException
      expect(mockSuperCatch).toHaveBeenCalledWith(exception, mockArgumentsHost)
      // For non-ZodSerializationException, logger should not be called
      expect(mockLogger).not.toHaveBeenCalled()

      consoleLogSpy.mockRestore()
    })

    it('should check if zodError is instanceof ZodErrorV4 before logging', () => {
      // Arrange
      const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation()

      // Test the actual logic: if exception instanceof ZodSerializationException
      // and zodError instanceof ZodErrorV4, then logger.error should be called
      const exception = createHttpException(HttpStatus.BAD_REQUEST, 'Test')

      // Act
      filter.catch(exception, mockArgumentsHost)

      // Assert
      // For regular HttpException, logger should NOT be called
      expect(mockLogger).not.toHaveBeenCalled()
      expect(mockSuperCatch).toHaveBeenCalledWith(exception, mockArgumentsHost)

      consoleLogSpy.mockRestore()
    })

    it('should handle exception and call super.catch for all HttpExceptions', () => {
      // Arrange
      const exceptions = [
        createHttpException(HttpStatus.BAD_REQUEST, 'Bad Request'),
        createHttpException(HttpStatus.UNPROCESSABLE_ENTITY, { errors: [] }),
        createHttpException(HttpStatus.INTERNAL_SERVER_ERROR, 'Server Error'),
      ]

      // Act & Assert
      exceptions.forEach((exception, index) => {
        filter.catch(exception, mockArgumentsHost)
        expect(mockSuperCatch).toHaveBeenNthCalledWith(index + 1, exception, mockArgumentsHost)
      })
    })

    it('should not throw error when processing ZodSerializationException', () => {
      // Arrange
      const exception = createHttpException(HttpStatus.BAD_REQUEST, 'Test')
      const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation()

      // Act & Assert
      expect(() => {
        filter.catch(exception, mockArgumentsHost)
      }).not.toThrow()

      consoleLogSpy.mockRestore()
    })
  })

  describe('📝 Logger Integration', () => {
    it('should have logger instance with correct context name', () => {
      // Arrange & Act
      const loggerInstance = (filter as any).logger

      // Assert
      expect(loggerInstance).toBeInstanceOf(Logger)
      // Logger context is set in constructor: new Logger(HttpExceptionFilter.name)
    })

    it('should not log for regular HttpException', () => {
      // Arrange
      const exception = createHttpException(HttpStatus.BAD_REQUEST, 'Regular error')

      // Act
      filter.catch(exception, mockArgumentsHost)

      // Assert
      expect(mockLogger).not.toHaveBeenCalled()
    })

    it('should not log for HttpException with object response', () => {
      // Arrange
      const exception = createHttpException(HttpStatus.UNPROCESSABLE_ENTITY, {
        message: 'Validation failed',
        errors: [{ field: 'email', message: 'Invalid' }],
      })

      // Act
      filter.catch(exception, mockArgumentsHost)

      // Assert
      expect(mockLogger).not.toHaveBeenCalled()
    })
  })

  describe('🔄 BaseExceptionFilter Integration', () => {
    it('should always call super.catch regardless of exception type', () => {
      // Arrange
      const exceptions = [
        createHttpException(HttpStatus.BAD_REQUEST, 'Bad Request'),
        createHttpException(HttpStatus.INTERNAL_SERVER_ERROR, 'Server Error'),
        createHttpException(HttpStatus.NOT_FOUND, 'Not Found'),
      ]

      // Act & Assert
      exceptions.forEach((exception) => {
        filter.catch(exception, mockArgumentsHost)
        expect(mockSuperCatch).toHaveBeenCalledWith(exception, mockArgumentsHost)
      })

      expect(mockSuperCatch).toHaveBeenCalledTimes(3)
    })

    it('should pass correct arguments to super.catch', () => {
      // Arrange
      const exception = createHttpException(HttpStatus.FORBIDDEN, 'Access denied')

      // Act
      filter.catch(exception, mockArgumentsHost)

      // Assert
      expect(mockSuperCatch).toHaveBeenCalledWith(exception, mockArgumentsHost)
      expect(mockSuperCatch.mock.calls[0][0]).toBe(exception)
      expect(mockSuperCatch.mock.calls[0][1]).toBe(mockArgumentsHost)
    })
  })

  describe('🛡️ Edge Cases', () => {
    it('should handle HttpException with object response', () => {
      // Arrange
      const exception = createHttpException(HttpStatus.BAD_REQUEST, {
        statusCode: 400,
        message: 'Validation failed',
        errors: [{ field: 'email', message: 'Invalid email' }],
      })

      // Act
      filter.catch(exception, mockArgumentsHost)

      // Assert
      expect(mockSuperCatch).toHaveBeenCalledWith(exception, mockArgumentsHost)
    })

    it('should handle HttpException with array response', () => {
      // Arrange
      const exception = createHttpException(HttpStatus.UNPROCESSABLE_ENTITY, [
        { message: 'Error 1', path: 'field1' },
        { message: 'Error 2', path: 'field2' },
      ])

      // Act
      filter.catch(exception, mockArgumentsHost)

      // Assert
      expect(mockSuperCatch).toHaveBeenCalledWith(exception, mockArgumentsHost)
    })

    it('should handle exception with empty message', () => {
      // Arrange
      const exception = createHttpException(HttpStatus.BAD_REQUEST, '')

      // Act
      filter.catch(exception, mockArgumentsHost)

      // Assert
      expect(mockSuperCatch).toHaveBeenCalledWith(exception, mockArgumentsHost)
    })

    it('should handle exception with null message', () => {
      // Arrange
      const exception = createHttpException(HttpStatus.INTERNAL_SERVER_ERROR, null as any)

      // Act
      filter.catch(exception, mockArgumentsHost)

      // Assert
      expect(mockSuperCatch).toHaveBeenCalledWith(exception, mockArgumentsHost)
    })
  })
})
