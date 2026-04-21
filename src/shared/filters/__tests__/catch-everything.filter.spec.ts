import { ArgumentsHost, HttpException, HttpStatus } from '@nestjs/common'
import { HttpAdapterHost } from '@nestjs/core'
import { Test, TestingModule } from '@nestjs/testing'
import { Prisma } from '@prisma/client'
import * as helpers from 'src/shared/helpers'
import { CatchEverythingFilter } from '../catch-everything.filter'

// Mock helpers
jest.mock('src/shared/helpers', () => ({
  isUniqueConstraintPrismaError: jest.fn(),
  isNotFoundPrismaError: jest.fn(),
  isForeignKeyConstraintPrismaError: jest.fn(),
}))

const mockIsUniqueConstraintPrismaError = helpers.isUniqueConstraintPrismaError as jest.MockedFunction<
  typeof helpers.isUniqueConstraintPrismaError
>
const mockIsNotFoundPrismaError = helpers.isNotFoundPrismaError as jest.MockedFunction<
  typeof helpers.isNotFoundPrismaError
>
const mockIsForeignKeyConstraintPrismaError = helpers.isForeignKeyConstraintPrismaError as jest.MockedFunction<
  typeof helpers.isForeignKeyConstraintPrismaError
>

/**
 * CATCH EVERYTHING FILTER UNIT TESTS
 *
 * Module này test global exception filter
 * Đây là module HIGH PRIORITY vì xử lý tất cả exceptions trong hệ thống
 *
 * Test Coverage:
 * - Generic exception handling (unknown type)
 * - HttpException handling với correct status code
 * - Prisma unique constraint error (P2002) → HTTP 409 CONFLICT
 * - HttpAdapterHost integration
 * - Response body structure validation
 * - Edge cases: null/undefined exceptions, non-HTTP exceptions
 */

describe('CatchEverythingFilter', () => {
  let filter: CatchEverythingFilter
  let mockHttpAdapterHost: jest.Mocked<HttpAdapterHost>
  let mockHttpAdapter: any
  let mockArgumentsHost: jest.Mocked<ArgumentsHost>
  let mockResponse: any
  let mockRequest: any

  // Test data factory
  const createMockHttpAdapter = () => ({
    reply: jest.fn(),
    getRequestUrl: jest.fn(),
    getRequestMethod: jest.fn(),
  })

  const createMockArgumentsHost = (): jest.Mocked<ArgumentsHost> => {
    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
      send: jest.fn(),
    }
    mockRequest = {
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

  const createPrismaUniqueConstraintError = (): Prisma.PrismaClientKnownRequestError => {
    const error = new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
      code: 'P2002',
      clientVersion: '5.0.0',
    })
    return error
  }

  beforeEach(async () => {
    mockHttpAdapter = createMockHttpAdapter()
    mockHttpAdapterHost = {
      httpAdapter: mockHttpAdapter,
    } as any

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CatchEverythingFilter,
        {
          provide: HttpAdapterHost,
          useValue: mockHttpAdapterHost,
        },
      ],
    }).compile()

    filter = module.get<CatchEverythingFilter>(CatchEverythingFilter)
    mockArgumentsHost = createMockArgumentsHost()

    // Reset mocks
    jest.clearAllMocks()
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  describe('🔍 HttpException Handling', () => {
    it('should handle HttpException with correct status code', () => {
      // Arrange
      const exception = createHttpException(HttpStatus.BAD_REQUEST, 'Bad Request')
      mockIsUniqueConstraintPrismaError.mockReturnValue(false)

      // Act
      filter.catch(exception, mockArgumentsHost)

      // Assert
      expect(mockHttpAdapter.reply).toHaveBeenCalledWith(
        mockResponse,
        {
          statusCode: HttpStatus.BAD_REQUEST,
          message: 'Bad Request',
        },
        HttpStatus.BAD_REQUEST,
      )
    })

    it('should extract message from HttpException', () => {
      // Arrange
      const exception = createHttpException(HttpStatus.NOT_FOUND, 'Resource not found')
      mockIsUniqueConstraintPrismaError.mockReturnValue(false)

      // Act
      filter.catch(exception, mockArgumentsHost)

      // Assert
      expect(mockHttpAdapter.reply).toHaveBeenCalledWith(
        mockResponse,
        {
          statusCode: HttpStatus.NOT_FOUND,
          message: 'Resource not found',
        },
        HttpStatus.NOT_FOUND,
      )
    })

    it('should handle HttpException with 401 Unauthorized', () => {
      // Arrange
      const exception = createHttpException(HttpStatus.UNAUTHORIZED, 'Unauthorized')
      mockIsUniqueConstraintPrismaError.mockReturnValue(false)

      // Act
      filter.catch(exception, mockArgumentsHost)

      // Assert
      expect(mockHttpAdapter.reply).toHaveBeenCalledWith(
        mockResponse,
        {
          statusCode: HttpStatus.UNAUTHORIZED,
          message: 'Unauthorized',
        },
        HttpStatus.UNAUTHORIZED,
      )
    })

    it('should handle HttpException with 403 Forbidden', () => {
      // Arrange
      const exception = createHttpException(HttpStatus.FORBIDDEN, 'Forbidden')
      mockIsUniqueConstraintPrismaError.mockReturnValue(false)

      // Act
      filter.catch(exception, mockArgumentsHost)

      // Assert
      expect(mockHttpAdapter.reply).toHaveBeenCalledWith(
        mockResponse,
        {
          statusCode: HttpStatus.FORBIDDEN,
          message: 'Forbidden',
        },
        HttpStatus.FORBIDDEN,
      )
    })

    it('should handle HttpException with object response', () => {
      // Arrange
      const responseObject = {
        statusCode: 422,
        message: 'Validation failed',
        errors: [{ field: 'email', message: 'Invalid email' }],
      }
      const exception = createHttpException(HttpStatus.UNPROCESSABLE_ENTITY, responseObject)
      mockIsUniqueConstraintPrismaError.mockReturnValue(false)

      // Act
      filter.catch(exception, mockArgumentsHost)

      // Assert
      expect(mockHttpAdapter.reply).toHaveBeenCalledWith(
        mockResponse,
        {
          statusCode: HttpStatus.UNPROCESSABLE_ENTITY,
          message: responseObject,
        },
        HttpStatus.UNPROCESSABLE_ENTITY,
      )
    })
  })

  describe('🔒 Prisma Error Handling', () => {
    it('should detect unique constraint error (P2002)', () => {
      // Arrange
      const exception = createPrismaUniqueConstraintError()
      mockIsUniqueConstraintPrismaError.mockReturnValue(true)
      mockIsForeignKeyConstraintPrismaError.mockReturnValue(false)
      mockIsNotFoundPrismaError.mockReturnValue(false)

      // Act
      filter.catch(exception, mockArgumentsHost)

      // Assert
      expect(mockIsUniqueConstraintPrismaError).toHaveBeenCalledWith(exception)
      expect(mockHttpAdapter.reply).toHaveBeenCalledWith(
        mockResponse,
        {
          statusCode: HttpStatus.CONFLICT,
          message: 'Record already exists',
        },
        HttpStatus.CONFLICT,
      )
    })

    it('should return 409 CONFLICT for unique constraint', () => {
      // Arrange
      const exception = createPrismaUniqueConstraintError()
      mockIsUniqueConstraintPrismaError.mockReturnValue(true)
      mockIsForeignKeyConstraintPrismaError.mockReturnValue(false)
      mockIsNotFoundPrismaError.mockReturnValue(false)

      // Act
      filter.catch(exception, mockArgumentsHost)

      // Assert
      const callArgs = mockHttpAdapter.reply.mock.calls[0]
      expect(callArgs[1].statusCode).toBe(HttpStatus.CONFLICT)
      expect(callArgs[2]).toBe(HttpStatus.CONFLICT)
    })

    it('should return English message for duplicate record', () => {
      // Arrange
      const exception = createPrismaUniqueConstraintError()
      mockIsUniqueConstraintPrismaError.mockReturnValue(true)
      mockIsForeignKeyConstraintPrismaError.mockReturnValue(false)
      mockIsNotFoundPrismaError.mockReturnValue(false)

      // Act
      filter.catch(exception, mockArgumentsHost)

      // Assert
      const callArgs = mockHttpAdapter.reply.mock.calls[0]
      expect(callArgs[1].message).toBe('Record already exists')
    })

    it('should detect foreign key constraint error (P2003)', () => {
      // Arrange
      const exception = new Prisma.PrismaClientKnownRequestError('Foreign key constraint failed', {
        code: 'P2003',
        clientVersion: '5.0.0',
      })
      mockIsUniqueConstraintPrismaError.mockReturnValue(false)
      mockIsForeignKeyConstraintPrismaError.mockReturnValue(true)
      mockIsNotFoundPrismaError.mockReturnValue(false)

      // Act
      filter.catch(exception, mockArgumentsHost)

      // Assert
      expect(mockIsForeignKeyConstraintPrismaError).toHaveBeenCalledWith(exception)
      expect(mockHttpAdapter.reply).toHaveBeenCalledWith(
        mockResponse,
        {
          statusCode: HttpStatus.BAD_REQUEST,
          message: 'Referenced record does not exist',
        },
        HttpStatus.BAD_REQUEST,
      )
    })

    it('should detect not found error (P2025)', () => {
      // Arrange
      const exception = new Prisma.PrismaClientKnownRequestError('Record not found', {
        code: 'P2025',
        clientVersion: '5.0.0',
      })
      mockIsUniqueConstraintPrismaError.mockReturnValue(false)
      mockIsForeignKeyConstraintPrismaError.mockReturnValue(false)
      mockIsNotFoundPrismaError.mockReturnValue(true)

      // Act
      filter.catch(exception, mockArgumentsHost)

      // Assert
      expect(mockIsNotFoundPrismaError).toHaveBeenCalledWith(exception)
      expect(mockHttpAdapter.reply).toHaveBeenCalledWith(
        mockResponse,
        {
          statusCode: HttpStatus.NOT_FOUND,
          message: 'Record not found',
        },
        HttpStatus.NOT_FOUND,
      )
    })
  })

  describe('⚠️ Unknown Exception Handling', () => {
    it('should return 500 for unknown exceptions', () => {
      // Arrange
      const exception = new Error('Unknown error')
      mockIsUniqueConstraintPrismaError.mockReturnValue(false)
      mockIsForeignKeyConstraintPrismaError.mockReturnValue(false)
      mockIsNotFoundPrismaError.mockReturnValue(false)

      // Act
      filter.catch(exception, mockArgumentsHost)

      // Assert
      expect(mockHttpAdapter.reply).toHaveBeenCalledWith(
        mockResponse,
        {
          statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
          message: 'Internal Server Error',
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      )
    })

    it('should return generic message for unknown errors', () => {
      // Arrange
      const exception = new TypeError('Type error')
      mockIsUniqueConstraintPrismaError.mockReturnValue(false)
      mockIsForeignKeyConstraintPrismaError.mockReturnValue(false)
      mockIsNotFoundPrismaError.mockReturnValue(false)

      // Act
      filter.catch(exception, mockArgumentsHost)

      // Assert
      const callArgs = mockHttpAdapter.reply.mock.calls[0]
      expect(callArgs[1].message).toBe('Internal Server Error')
    })

    it('should handle string exceptions', () => {
      // Arrange
      const exception = 'String error'
      mockIsUniqueConstraintPrismaError.mockReturnValue(false)
      mockIsForeignKeyConstraintPrismaError.mockReturnValue(false)
      mockIsNotFoundPrismaError.mockReturnValue(false)

      // Act
      filter.catch(exception, mockArgumentsHost)

      // Assert
      expect(mockHttpAdapter.reply).toHaveBeenCalledWith(
        mockResponse,
        {
          statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
          message: 'Internal Server Error',
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      )
    })

    it('should handle null exception', () => {
      // Arrange
      const exception = null
      mockIsUniqueConstraintPrismaError.mockReturnValue(false)
      mockIsForeignKeyConstraintPrismaError.mockReturnValue(false)
      mockIsNotFoundPrismaError.mockReturnValue(false)

      // Act
      filter.catch(exception, mockArgumentsHost)

      // Assert
      expect(mockHttpAdapter.reply).toHaveBeenCalledWith(
        mockResponse,
        {
          statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
          message: 'Internal Server Error',
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      )
    })

    it('should handle undefined exception', () => {
      // Arrange
      const exception = undefined
      mockIsUniqueConstraintPrismaError.mockReturnValue(false)
      mockIsForeignKeyConstraintPrismaError.mockReturnValue(false)
      mockIsNotFoundPrismaError.mockReturnValue(false)

      // Act
      filter.catch(exception, mockArgumentsHost)

      // Assert
      expect(mockHttpAdapter.reply).toHaveBeenCalledWith(
        mockResponse,
        {
          statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
          message: 'Internal Server Error',
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      )
    })
  })

  describe('📝 Response Format', () => {
    it('should format response with statusCode and message', () => {
      // Arrange
      const exception = createHttpException(HttpStatus.BAD_REQUEST, 'Test error')
      mockIsUniqueConstraintPrismaError.mockReturnValue(false)

      // Act
      filter.catch(exception, mockArgumentsHost)

      // Assert
      const callArgs = mockHttpAdapter.reply.mock.calls[0]
      const responseBody = callArgs[1]
      expect(responseBody).toHaveProperty('statusCode')
      expect(responseBody).toHaveProperty('message')
      expect(Object.keys(responseBody)).toEqual(['statusCode', 'message'])
    })

    it('should use httpAdapter.reply correctly', () => {
      // Arrange
      const exception = createHttpException(HttpStatus.NOT_FOUND, 'Not found')
      mockIsUniqueConstraintPrismaError.mockReturnValue(false)

      // Act
      filter.catch(exception, mockArgumentsHost)

      // Assert
      expect(mockHttpAdapter.reply).toHaveBeenCalledTimes(1)
      expect(mockHttpAdapter.reply).toHaveBeenCalledWith(
        mockResponse,
        expect.objectContaining({
          statusCode: expect.any(Number),
          message: expect.anything(),
        }),
        expect.any(Number),
      )
    })

    it('should pass response object from ArgumentsHost', () => {
      // Arrange
      const exception = createHttpException(HttpStatus.BAD_REQUEST, 'Test')
      mockIsUniqueConstraintPrismaError.mockReturnValue(false)

      // Act
      filter.catch(exception, mockArgumentsHost)

      // Assert
      expect(mockArgumentsHost.switchToHttp).toHaveBeenCalled()
      const callArgs = mockHttpAdapter.reply.mock.calls[0]
      expect(callArgs[0]).toBe(mockResponse)
    })
  })

  describe('🔄 HttpAdapterHost Integration', () => {
    it('should resolve httpAdapter from HttpAdapterHost', () => {
      // Arrange
      const exception = createHttpException(HttpStatus.BAD_REQUEST, 'Test')
      mockIsUniqueConstraintPrismaError.mockReturnValue(false)
      mockIsForeignKeyConstraintPrismaError.mockReturnValue(false)
      mockIsNotFoundPrismaError.mockReturnValue(false)

      // Act
      filter.catch(exception, mockArgumentsHost)

      // Assert
      expect(mockHttpAdapter.reply).toHaveBeenCalled()
    })

    it('should use httpAdapter from httpAdapterHost property', () => {
      // Arrange
      const exception = new Error('Test error')
      mockIsUniqueConstraintPrismaError.mockReturnValue(false)
      mockIsForeignKeyConstraintPrismaError.mockReturnValue(false)
      mockIsNotFoundPrismaError.mockReturnValue(false)

      // Act
      filter.catch(exception, mockArgumentsHost)

      // Assert
      // Verify that the httpAdapter from httpAdapterHost is used
      expect(mockHttpAdapterHost.httpAdapter).toBe(mockHttpAdapter)
      expect(mockHttpAdapter.reply).toHaveBeenCalled()
    })
  })
})
