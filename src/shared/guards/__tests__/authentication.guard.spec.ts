import { ExecutionContext, ForbiddenException, UnauthorizedException } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { Test, TestingModule } from '@nestjs/testing'
import { AuthType, ConditionGuard } from 'src/shared/constants/auth.constant'
import { AUTH_TYPE_KEY } from 'src/shared/decorators/auth.decorator'
import { AccessTokenGuard } from '../access-token.guard'
import { AuthenticationGuard } from '../authentication.guard'
import { PaymentAPIKeyGuard } from '../payment-api-key.guard'

/**
 * AUTHENTICATION GUARD UNIT TESTS
 *
 * Module này test orchestration guard cho multiple authentication strategies
 * Đây là module CRITICAL vì điều phối các loại authentication khác nhau
 *
 * Test Coverage:
 * - Auth type resolution from @Auth decorator
 * - AND condition (all guards must pass)
 * - OR condition (at least one guard must pass)
 * - Default auth type (Bearer)
 * - Multiple auth types combination
 * - Error handling and propagation
 */

describe('AuthenticationGuard', () => {
  let guard: AuthenticationGuard
  let mockReflector: any
  let mockAccessTokenGuard: any
  let mockPaymentAPIKeyGuard: any
  let mockExecutionContext: jest.Mocked<ExecutionContext>

  // Test data factory
  const createMockExecutionContext = (): jest.Mocked<ExecutionContext> => {
    return {
      switchToHttp: jest.fn().mockReturnValue({
        getRequest: jest.fn().mockReturnValue({}),
      }),
      getHandler: jest.fn(),
      getClass: jest.fn(),
    } as any
  }

  beforeEach(async () => {
    // Mock Reflector
    mockReflector = {
      getAllAndOverride: jest.fn(),
    }

    // Mock AccessTokenGuard
    mockAccessTokenGuard = {
      canActivate: jest.fn(),
    }

    // Mock PaymentAPIKeyGuard
    mockPaymentAPIKeyGuard = {
      canActivate: jest.fn(),
    }

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthenticationGuard,
        { provide: Reflector, useValue: mockReflector },
        { provide: AccessTokenGuard, useValue: mockAccessTokenGuard },
        { provide: PaymentAPIKeyGuard, useValue: mockPaymentAPIKeyGuard },
      ],
    }).compile()

    guard = module.get<AuthenticationGuard>(AuthenticationGuard)
    mockExecutionContext = createMockExecutionContext()
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  // ============================================
  // DEFAULT AUTH TYPE
  // ============================================

  describe('🔐 Default Auth Type', () => {
    it('should use Bearer auth type by default when no @Auth decorator', async () => {
      // Arrange
      mockReflector.getAllAndOverride.mockReturnValue(undefined)
      mockAccessTokenGuard.canActivate.mockResolvedValue(true)

      // Act
      const result = await guard.canActivate(mockExecutionContext)

      // Assert
      expect(result).toBe(true)
      expect(mockReflector.getAllAndOverride).toHaveBeenCalledWith(AUTH_TYPE_KEY, [
        mockExecutionContext.getHandler(),
        mockExecutionContext.getClass(),
      ])
      expect(mockAccessTokenGuard.canActivate).toHaveBeenCalledWith(mockExecutionContext)
    })

    it('should throw UnauthorizedException when default Bearer auth fails', async () => {
      // Arrange
      mockReflector.getAllAndOverride.mockReturnValue(undefined)
      mockAccessTokenGuard.canActivate.mockRejectedValue(new UnauthorizedException('Invalid token'))

      // Act & Assert
      await expect(guard.canActivate(mockExecutionContext)).rejects.toThrow(UnauthorizedException)
    })
  })

  // ============================================
  // SINGLE AUTH TYPE
  // ============================================

  describe('🔑 Single Auth Type', () => {
    it('should allow request with valid Bearer token', async () => {
      // Arrange
      mockReflector.getAllAndOverride.mockReturnValue({
        authTypes: [AuthType.Bearer],
        options: { condition: ConditionGuard.And },
      })
      mockAccessTokenGuard.canActivate.mockResolvedValue(true)

      // Act
      const result = await guard.canActivate(mockExecutionContext)

      // Assert
      expect(result).toBe(true)
      expect(mockAccessTokenGuard.canActivate).toHaveBeenCalledWith(mockExecutionContext)
    })

    it('should allow request with valid PaymentAPIKey', async () => {
      // Arrange
      mockReflector.getAllAndOverride.mockReturnValue({
        authTypes: [AuthType.PaymentAPIKey],
        options: { condition: ConditionGuard.And },
      })
      mockPaymentAPIKeyGuard.canActivate.mockResolvedValue(true)

      // Act
      const result = await guard.canActivate(mockExecutionContext)

      // Assert
      expect(result).toBe(true)
      expect(mockPaymentAPIKeyGuard.canActivate).toHaveBeenCalledWith(mockExecutionContext)
    })

    it('should allow request with None auth type', async () => {
      // Arrange
      mockReflector.getAllAndOverride.mockReturnValue({
        authTypes: [AuthType.None],
        options: { condition: ConditionGuard.And },
      })

      // Act
      const result = await guard.canActivate(mockExecutionContext)

      // Assert
      expect(result).toBe(true)
      expect(mockAccessTokenGuard.canActivate).not.toHaveBeenCalled()
      expect(mockPaymentAPIKeyGuard.canActivate).not.toHaveBeenCalled()
    })
  })

  // ============================================
  // AND CONDITION
  // ============================================

  describe('🔒 AND Condition (All guards must pass)', () => {
    it('should pass when all guards pass', async () => {
      // Arrange
      mockReflector.getAllAndOverride.mockReturnValue({
        authTypes: [AuthType.Bearer, AuthType.PaymentAPIKey],
        options: { condition: ConditionGuard.And },
      })
      mockAccessTokenGuard.canActivate.mockResolvedValue(true)
      mockPaymentAPIKeyGuard.canActivate.mockResolvedValue(true)

      // Act
      const result = await guard.canActivate(mockExecutionContext)

      // Assert
      expect(result).toBe(true)
      expect(mockAccessTokenGuard.canActivate).toHaveBeenCalledWith(mockExecutionContext)
      expect(mockPaymentAPIKeyGuard.canActivate).toHaveBeenCalledWith(mockExecutionContext)
    })

    it('should fail when first guard fails', async () => {
      // Arrange
      mockReflector.getAllAndOverride.mockReturnValue({
        authTypes: [AuthType.Bearer, AuthType.PaymentAPIKey],
        options: { condition: ConditionGuard.And },
      })
      mockAccessTokenGuard.canActivate.mockRejectedValue(new UnauthorizedException('Invalid token'))
      mockPaymentAPIKeyGuard.canActivate.mockResolvedValue(true)

      // Act & Assert
      await expect(guard.canActivate(mockExecutionContext)).rejects.toThrow(UnauthorizedException)
      expect(mockAccessTokenGuard.canActivate).toHaveBeenCalled()
    })

    it('should fail when second guard fails', async () => {
      // Arrange
      mockReflector.getAllAndOverride.mockReturnValue({
        authTypes: [AuthType.Bearer, AuthType.PaymentAPIKey],
        options: { condition: ConditionGuard.And },
      })
      mockAccessTokenGuard.canActivate.mockResolvedValue(true)
      mockPaymentAPIKeyGuard.canActivate.mockRejectedValue(new UnauthorizedException('Invalid API key'))

      // Act & Assert
      await expect(guard.canActivate(mockExecutionContext)).rejects.toThrow(UnauthorizedException)
      expect(mockAccessTokenGuard.canActivate).toHaveBeenCalled()
      expect(mockPaymentAPIKeyGuard.canActivate).toHaveBeenCalled()
    })

    it('should fail when guard returns false', async () => {
      // Arrange
      mockReflector.getAllAndOverride.mockReturnValue({
        authTypes: [AuthType.Bearer],
        options: { condition: ConditionGuard.And },
      })
      mockAccessTokenGuard.canActivate.mockResolvedValue(false)

      // Act & Assert
      await expect(guard.canActivate(mockExecutionContext)).rejects.toThrow(UnauthorizedException)
    })

    it('should propagate ForbiddenException from guard', async () => {
      // Arrange
      mockReflector.getAllAndOverride.mockReturnValue({
        authTypes: [AuthType.Bearer],
        options: { condition: ConditionGuard.And },
      })
      mockAccessTokenGuard.canActivate.mockRejectedValue(new ForbiddenException('Permission denied'))

      // Act & Assert
      await expect(guard.canActivate(mockExecutionContext)).rejects.toThrow(ForbiddenException)
    })
  })

  // ============================================
  // OR CONDITION
  // ============================================

  describe('🔓 OR Condition (At least one guard must pass)', () => {
    it('should pass when first guard passes', async () => {
      // Arrange
      mockReflector.getAllAndOverride.mockReturnValue({
        authTypes: [AuthType.Bearer, AuthType.PaymentAPIKey],
        options: { condition: ConditionGuard.Or },
      })
      mockAccessTokenGuard.canActivate.mockResolvedValue(true)
      mockPaymentAPIKeyGuard.canActivate.mockResolvedValue(false)

      // Act
      const result = await guard.canActivate(mockExecutionContext)

      // Assert
      expect(result).toBe(true)
      expect(mockAccessTokenGuard.canActivate).toHaveBeenCalledWith(mockExecutionContext)
      // Should not call second guard if first passes
    })

    it('should pass when second guard passes after first fails', async () => {
      // Arrange
      mockReflector.getAllAndOverride.mockReturnValue({
        authTypes: [AuthType.Bearer, AuthType.PaymentAPIKey],
        options: { condition: ConditionGuard.Or },
      })
      mockAccessTokenGuard.canActivate.mockRejectedValue(new UnauthorizedException('Invalid token'))
      mockPaymentAPIKeyGuard.canActivate.mockResolvedValue(true)

      // Act
      const result = await guard.canActivate(mockExecutionContext)

      // Assert
      expect(result).toBe(true)
      expect(mockAccessTokenGuard.canActivate).toHaveBeenCalled()
      expect(mockPaymentAPIKeyGuard.canActivate).toHaveBeenCalled()
    })

    it('should fail when all guards fail', async () => {
      // Arrange
      mockReflector.getAllAndOverride.mockReturnValue({
        authTypes: [AuthType.Bearer, AuthType.PaymentAPIKey],
        options: { condition: ConditionGuard.Or },
      })
      mockAccessTokenGuard.canActivate.mockRejectedValue(new UnauthorizedException('Invalid token'))
      mockPaymentAPIKeyGuard.canActivate.mockRejectedValue(new UnauthorizedException('Invalid API key'))

      // Act & Assert
      await expect(guard.canActivate(mockExecutionContext)).rejects.toThrow(UnauthorizedException)
      expect(mockAccessTokenGuard.canActivate).toHaveBeenCalled()
      expect(mockPaymentAPIKeyGuard.canActivate).toHaveBeenCalled()
    })

    it('should propagate last HttpException when all guards fail', async () => {
      // Arrange
      mockReflector.getAllAndOverride.mockReturnValue({
        authTypes: [AuthType.Bearer, AuthType.PaymentAPIKey],
        options: { condition: ConditionGuard.Or },
      })
      mockAccessTokenGuard.canActivate.mockRejectedValue(new UnauthorizedException('Invalid token'))
      mockPaymentAPIKeyGuard.canActivate.mockRejectedValue(new ForbiddenException('Permission denied'))

      // Act & Assert
      await expect(guard.canActivate(mockExecutionContext)).rejects.toThrow(ForbiddenException)
    })

    it('Nên pass khi guard thứ nhất return false nhưng guard thứ hai pass', async () => {
      // Arrange: Chuẩn bị OR condition với guard đầu return false
      mockReflector.getAllAndOverride.mockReturnValue({
        authTypes: [AuthType.Bearer, AuthType.PaymentAPIKey],
        options: { condition: ConditionGuard.Or },
      })
      mockAccessTokenGuard.canActivate.mockResolvedValue(false)
      mockPaymentAPIKeyGuard.canActivate.mockResolvedValue(true)

      // Act: Thực hiện canActivate
      const result = await guard.canActivate(mockExecutionContext)

      // Assert: Verify pass vì guard thứ hai pass
      expect(result).toBe(true)
      expect(mockAccessTokenGuard.canActivate).toHaveBeenCalled()
      expect(mockPaymentAPIKeyGuard.canActivate).toHaveBeenCalled()
    })
  })

  // ============================================
  // EDGE CASES & ERROR HANDLING
  // ============================================

  describe('⚠️ Edge Cases & Error Handling', () => {
    it('Nên throw UnauthorizedException khi AND condition và guard return false', async () => {
      // Arrange: Chuẩn bị AND condition với guard return false
      mockReflector.getAllAndOverride.mockReturnValue({
        authTypes: [AuthType.Bearer, AuthType.PaymentAPIKey],
        options: { condition: ConditionGuard.And },
      })
      mockAccessTokenGuard.canActivate.mockResolvedValue(false)

      // Act & Assert: Verify throw UnauthorizedException
      await expect(guard.canActivate(mockExecutionContext)).rejects.toThrow(UnauthorizedException)
      expect(mockAccessTokenGuard.canActivate).toHaveBeenCalled()
    })

    it('Nên convert non-HttpException thành UnauthorizedException trong AND condition', async () => {
      // Arrange: Chuẩn bị guard throw generic error
      mockReflector.getAllAndOverride.mockReturnValue({
        authTypes: [AuthType.Bearer],
        options: { condition: ConditionGuard.And },
      })
      mockAccessTokenGuard.canActivate.mockRejectedValue(new Error('Generic error'))

      // Act & Assert: Verify convert thành UnauthorizedException
      await expect(guard.canActivate(mockExecutionContext)).rejects.toThrow(UnauthorizedException)
    })

    it('Nên throw UnauthorizedException khi OR condition và tất cả guards return false', async () => {
      // Arrange: Chuẩn bị OR condition với tất cả guards return false
      mockReflector.getAllAndOverride.mockReturnValue({
        authTypes: [AuthType.Bearer, AuthType.PaymentAPIKey],
        options: { condition: ConditionGuard.Or },
      })
      mockAccessTokenGuard.canActivate.mockResolvedValue(false)
      mockPaymentAPIKeyGuard.canActivate.mockResolvedValue(false)

      // Act & Assert: Verify throw UnauthorizedException
      await expect(guard.canActivate(mockExecutionContext)).rejects.toThrow(UnauthorizedException)
    })

    it('Nên handle multiple guards với None auth type', async () => {
      // Arrange: Chuẩn bị multiple auth types bao gồm None
      mockReflector.getAllAndOverride.mockReturnValue({
        authTypes: [AuthType.None, AuthType.Bearer],
        options: { condition: ConditionGuard.Or },
      })

      // Act: Thực hiện canActivate
      const result = await guard.canActivate(mockExecutionContext)

      // Assert: Verify pass vì None luôn return true
      expect(result).toBe(true)
    })
  })

  // ============================================
  // REFLECTOR METADATA RESOLUTION
  // ============================================

  describe('🔍 Reflector Metadata Resolution', () => {
    it('Nên đọc metadata từ handler trước, sau đó từ class', async () => {
      // Arrange: Chuẩn bị reflector
      mockReflector.getAllAndOverride.mockReturnValue({
        authTypes: [AuthType.Bearer],
        options: { condition: ConditionGuard.And },
      })
      mockAccessTokenGuard.canActivate.mockResolvedValue(true)

      // Act: Thực hiện canActivate
      await guard.canActivate(mockExecutionContext)

      // Assert: Verify reflector được gọi với đúng targets
      expect(mockReflector.getAllAndOverride).toHaveBeenCalledWith(AUTH_TYPE_KEY, [
        mockExecutionContext.getHandler(),
        mockExecutionContext.getClass(),
      ])
    })

    it('Nên sử dụng default Bearer auth khi metadata undefined', async () => {
      // Arrange: Chuẩn bị reflector return undefined
      mockReflector.getAllAndOverride.mockReturnValue(undefined)
      mockAccessTokenGuard.canActivate.mockResolvedValue(true)

      // Act: Thực hiện canActivate
      const result = await guard.canActivate(mockExecutionContext)

      // Assert: Verify sử dụng Bearer auth mặc định
      expect(result).toBe(true)
      expect(mockAccessTokenGuard.canActivate).toHaveBeenCalledWith(mockExecutionContext)
      expect(mockPaymentAPIKeyGuard.canActivate).not.toHaveBeenCalled()
    })

    it('Nên sử dụng default AND condition khi không specify', async () => {
      // Arrange: Chuẩn bị metadata không có condition
      mockReflector.getAllAndOverride.mockReturnValue(undefined)
      mockAccessTokenGuard.canActivate.mockResolvedValue(true)

      // Act: Thực hiện canActivate
      const result = await guard.canActivate(mockExecutionContext)

      // Assert: Verify sử dụng AND condition mặc định
      expect(result).toBe(true)
    })
  })

  // ============================================
  // GUARD ORCHESTRATION
  // ============================================

  describe('🎭 Guard Orchestration', () => {
    it('Nên map AuthType.Bearer đến AccessTokenGuard', async () => {
      // Arrange: Chuẩn bị Bearer auth type
      mockReflector.getAllAndOverride.mockReturnValue({
        authTypes: [AuthType.Bearer],
        options: { condition: ConditionGuard.And },
      })
      mockAccessTokenGuard.canActivate.mockResolvedValue(true)

      // Act: Thực hiện canActivate
      await guard.canActivate(mockExecutionContext)

      // Assert: Verify AccessTokenGuard được gọi
      expect(mockAccessTokenGuard.canActivate).toHaveBeenCalledWith(mockExecutionContext)
      expect(mockPaymentAPIKeyGuard.canActivate).not.toHaveBeenCalled()
    })

    it('Nên map AuthType.PaymentAPIKey đến PaymentAPIKeyGuard', async () => {
      // Arrange: Chuẩn bị PaymentAPIKey auth type
      mockReflector.getAllAndOverride.mockReturnValue({
        authTypes: [AuthType.PaymentAPIKey],
        options: { condition: ConditionGuard.And },
      })
      mockPaymentAPIKeyGuard.canActivate.mockResolvedValue(true)

      // Act: Thực hiện canActivate
      await guard.canActivate(mockExecutionContext)

      // Assert: Verify PaymentAPIKeyGuard được gọi
      expect(mockPaymentAPIKeyGuard.canActivate).toHaveBeenCalledWith(mockExecutionContext)
      expect(mockAccessTokenGuard.canActivate).not.toHaveBeenCalled()
    })

    it('Nên execute guards theo thứ tự trong AND condition', async () => {
      // Arrange: Chuẩn bị multiple guards với AND condition
      const executionOrder: string[] = []
      mockReflector.getAllAndOverride.mockReturnValue({
        authTypes: [AuthType.Bearer, AuthType.PaymentAPIKey],
        options: { condition: ConditionGuard.And },
      })
      mockAccessTokenGuard.canActivate.mockImplementation(async () => {
        executionOrder.push('Bearer')
        return true
      })
      mockPaymentAPIKeyGuard.canActivate.mockImplementation(async () => {
        executionOrder.push('PaymentAPIKey')
        return true
      })

      // Act: Thực hiện canActivate
      await guard.canActivate(mockExecutionContext)

      // Assert: Verify thứ tự execution
      expect(executionOrder).toEqual(['Bearer', 'PaymentAPIKey'])
    })

    it('Nên stop execution khi guard đầu tiên fail trong AND condition', async () => {
      // Arrange: Chuẩn bị guard đầu fail
      mockReflector.getAllAndOverride.mockReturnValue({
        authTypes: [AuthType.Bearer, AuthType.PaymentAPIKey],
        options: { condition: ConditionGuard.And },
      })
      mockAccessTokenGuard.canActivate.mockRejectedValue(new UnauthorizedException('Invalid token'))

      // Act & Assert: Verify throw error và không gọi guard thứ hai
      await expect(guard.canActivate(mockExecutionContext)).rejects.toThrow(UnauthorizedException)
      expect(mockAccessTokenGuard.canActivate).toHaveBeenCalled()
      expect(mockPaymentAPIKeyGuard.canActivate).not.toHaveBeenCalled()
    })
  })
})
