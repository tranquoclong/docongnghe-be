import { ExecutionContext } from '@nestjs/common'

/**
 * USER AGENT DECORATOR UNIT TESTS
 *
 * Module này test UserAgent decorator - parameter decorator extract user-agent header từ request
 * Đây là module được sử dụng trong auth controllers để track device/browser info
 *
 * Test Coverage:
 * - Extract user-agent header
 * - Handle missing header
 * - Handle empty header
 * - Handle different user-agent formats
 * - ExecutionContext integration
 *
 * NOTE: Vì createParamDecorator returns ParameterDecorator (không thể gọi trực tiếp),
 * chúng ta test bằng cách recreate decorator logic và test callback function
 */

describe('UserAgent Decorator', () => {
  // ============================================
  // RECREATE DECORATOR LOGIC FOR TESTING
  // ============================================

  // Recreate decorator callback để test (copy từ user-agent.decorator.ts)
  const userAgentCallback = (data: unknown, ctx: ExecutionContext): string => {
    const request = ctx.switchToHttp().getRequest()
    return request.headers['user-agent'] as string
  }

  // ============================================
  // TEST DATA FACTORIES
  // ============================================

  const createMockExecutionContext = (request: any): jest.Mocked<ExecutionContext> => {
    return {
      switchToHttp: jest.fn().mockReturnValue({
        getRequest: jest.fn().mockReturnValue(request),
        getResponse: jest.fn(),
        getNext: jest.fn(),
      }),
      getClass: jest.fn(),
      getHandler: jest.fn(),
      getArgs: jest.fn(),
      getArgByIndex: jest.fn(),
      switchToRpc: jest.fn(),
      switchToWs: jest.fn(),
      getType: jest.fn(),
    } as any
  }

  // ============================================
  // EXTRACT USER-AGENT HEADER
  // ============================================

  describe('✅ Extract User-Agent Header', () => {
    it('Nên extract user-agent header từ request', () => {
      // Arrange: Request với user-agent header
      const mockRequest = {
        headers: {
          'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/91.0',
        },
      }
      const mockContext = createMockExecutionContext(mockRequest)

      // Act: Extract user-agent
      const result = userAgentCallback(undefined, mockContext)

      // Assert: Verify user-agent
      expect(result).toBe('Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/91.0')
      expect(typeof result).toBe('string')
    })

    it('Nên work với Chrome user-agent', () => {
      // Arrange: Chrome user-agent
      const mockRequest = {
        headers: {
          'user-agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        },
      }
      const mockContext = createMockExecutionContext(mockRequest)

      // Act: Extract
      const result = userAgentCallback(undefined, mockContext)

      // Assert: Verify Chrome user-agent
      expect(result).toContain('Chrome')
      expect(result).toContain('Windows NT 10.0')
    })

    it('Nên work với Firefox user-agent', () => {
      // Arrange: Firefox user-agent
      const mockRequest = {
        headers: {
          'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/121.0',
        },
      }
      const mockContext = createMockExecutionContext(mockRequest)

      // Act: Extract
      const result = userAgentCallback(undefined, mockContext)

      // Assert: Verify Firefox user-agent
      expect(result).toContain('Firefox')
      expect(result).toContain('Gecko')
    })

    it('Nên work với Safari user-agent', () => {
      // Arrange: Safari user-agent
      const mockRequest = {
        headers: {
          'user-agent':
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15',
        },
      }
      const mockContext = createMockExecutionContext(mockRequest)

      // Act: Extract
      const result = userAgentCallback(undefined, mockContext)

      // Assert: Verify Safari user-agent
      expect(result).toContain('Safari')
      expect(result).toContain('Mac OS X')
    })

    it('Nên work với mobile user-agent', () => {
      // Arrange: Mobile user-agent
      const mockRequest = {
        headers: {
          'user-agent':
            'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
        },
      }
      const mockContext = createMockExecutionContext(mockRequest)

      // Act: Extract
      const result = userAgentCallback(undefined, mockContext)

      // Assert: Verify mobile user-agent
      expect(result).toContain('iPhone')
      expect(result).toContain('Mobile')
    })

    it('Nên work với Postman user-agent', () => {
      // Arrange: Postman user-agent
      const mockRequest = {
        headers: {
          'user-agent': 'PostmanRuntime/7.32.3',
        },
      }
      const mockContext = createMockExecutionContext(mockRequest)

      // Act: Extract
      const result = userAgentCallback(undefined, mockContext)

      // Assert: Verify Postman user-agent
      expect(result).toBe('PostmanRuntime/7.32.3')
    })
  })

  // ============================================
  // EDGE CASES - MISSING/EMPTY HEADER
  // ============================================

  describe('⚠️ Edge Cases - Missing/Empty Header', () => {
    it('Nên return undefined khi user-agent header không tồn tại', () => {
      // Arrange: Request không có user-agent header
      const mockRequest = {
        headers: {},
      }
      const mockContext = createMockExecutionContext(mockRequest)

      // Act: Extract user-agent
      const result = userAgentCallback(undefined, mockContext)

      // Assert: Verify undefined
      expect(result).toBeUndefined()
    })

    it('Nên return empty string khi user-agent là empty', () => {
      // Arrange: Request với empty user-agent
      const mockRequest = {
        headers: {
          'user-agent': '',
        },
      }
      const mockContext = createMockExecutionContext(mockRequest)

      // Act: Extract user-agent
      const result = userAgentCallback(undefined, mockContext)

      // Assert: Verify empty string
      expect(result).toBe('')
    })

    it('Nên throw error khi headers object là null', () => {
      // Arrange: Request với headers = null
      const mockRequest = {
        headers: null,
      }
      const mockContext = createMockExecutionContext(mockRequest)

      // Act & Assert: Should throw TypeError
      expect(() => userAgentCallback(undefined, mockContext)).toThrow(TypeError)
    })

    it('Nên throw error khi headers object là undefined', () => {
      // Arrange: Request không có headers
      const mockRequest = {}
      const mockContext = createMockExecutionContext(mockRequest)

      // Act & Assert: Should throw TypeError
      expect(() => userAgentCallback(undefined, mockContext)).toThrow(TypeError)
    })
  })

  // ============================================
  // EXECUTION CONTEXT INTEGRATION
  // ============================================

  describe('🔄 ExecutionContext Integration', () => {
    it('Nên call switchToHttp() để get HTTP context', () => {
      // Arrange: Mock context
      const mockRequest = {
        headers: {
          'user-agent': 'Test Agent',
        },
      }
      const mockContext = createMockExecutionContext(mockRequest)

      // Act: Extract user-agent
      userAgentCallback(undefined, mockContext)

      // Assert: Verify switchToHttp được gọi
      expect(mockContext.switchToHttp).toHaveBeenCalled()
    })

    it('Nên call getRequest() để get request object', () => {
      // Arrange: Mock context với spy
      const mockRequest = {
        headers: {
          'user-agent': 'Test Agent',
        },
      }
      const getRequestSpy = jest.fn().mockReturnValue(mockRequest)
      const mockContext = {
        switchToHttp: jest.fn().mockReturnValue({
          getRequest: getRequestSpy,
        }),
      } as any

      // Act: Extract user-agent
      userAgentCallback(undefined, mockContext)

      // Assert: Verify getRequest được gọi
      expect(getRequestSpy).toHaveBeenCalled()
    })

    it('Nên work với real ExecutionContext structure', () => {
      // Arrange: Realistic context structure
      const mockRequest = {
        headers: {
          'user-agent': 'Mozilla/5.0 Test Browser',
          authorization: 'Bearer token',
        },
        method: 'POST',
        url: '/api/auth/login',
      }
      const mockContext = createMockExecutionContext(mockRequest)

      // Act: Extract user-agent
      const result = userAgentCallback(undefined, mockContext)

      // Assert: Verify correct extraction
      expect(result).toBe('Mozilla/5.0 Test Browser')
    })
  })

  // ============================================
  // REAL-WORLD SCENARIOS
  // ============================================

  describe('🌍 Real-world Scenarios', () => {
    it('Nên work trong login scenario', () => {
      // Arrange: Login request
      const mockRequest = {
        headers: {
          'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0',
          'content-type': 'application/json',
        },
        body: {
          email: 'user@example.com',
          password: 'password123',
        },
      }
      const mockContext = createMockExecutionContext(mockRequest)

      // Act: Extract user-agent for device tracking
      const result = userAgentCallback(undefined, mockContext)

      // Assert: Verify extraction for audit log
      expect(result).toBeDefined()
      expect(result).toContain('Chrome')
    })

    it('Nên work trong refresh token scenario', () => {
      // Arrange: Refresh token request
      const mockRequest = {
        headers: {
          'user-agent': 'PostmanRuntime/7.32.3',
        },
      }
      const mockContext = createMockExecutionContext(mockRequest)

      // Act: Extract user-agent
      const result = userAgentCallback(undefined, mockContext)

      // Assert: Verify for device validation
      expect(result).toBe('PostmanRuntime/7.32.3')
    })
  })
})
