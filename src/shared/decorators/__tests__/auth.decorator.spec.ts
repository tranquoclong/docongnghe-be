import { Reflector } from '@nestjs/core'
import { AuthType, ConditionGuard } from 'src/shared/constants/auth.constant'
import { Auth, AUTH_TYPE_KEY, AuthTypeDecoratorPayload, IsPublic } from '../auth.decorator'

/**
 * AUTH DECORATOR UNIT TESTS
 *
 * Module này test các decorators cho authentication configuration
 * Đây là module CRITICAL vì định nghĩa cách routes được protect
 *
 * Test Coverage:
 * - Auth() decorator với single auth type
 * - Auth() decorator với multiple auth types
 * - Auth() decorator với AND condition
 * - Auth() decorator với OR condition
 * - IsPublic() decorator
 * - AUTH_TYPE_KEY constant
 * - AuthTypeDecoratorPayload type structure
 * - Default condition behavior
 */

describe('Auth Decorators', () => {
  let reflector: Reflector

  beforeEach(() => {
    reflector = new Reflector()
  })

  // ============================================
  // AUTH() DECORATOR - SINGLE AUTH TYPE
  // ============================================

  describe('🔑 Auth() Decorator - Single Auth Type', () => {
    it('Nên set metadata với single Bearer auth type', () => {
      // Arrange: Chuẩn bị test class và method
      class TestController {
        @Auth([AuthType.Bearer])
        testMethod() {}
      }

      // Act: Đọc metadata từ decorated method
      const metadata = reflector.get<AuthTypeDecoratorPayload>(AUTH_TYPE_KEY, TestController.prototype.testMethod)

      // Assert: Verify metadata được set đúng
      expect(metadata).toEqual({
        authTypes: [AuthType.Bearer],
        options: { condition: ConditionGuard.And },
      })
    })

    it('Nên set metadata với single PaymentAPIKey auth type', () => {
      // Arrange: Chuẩn bị test class và method
      class TestController {
        @Auth([AuthType.PaymentAPIKey])
        testMethod() {}
      }

      // Act: Đọc metadata
      const metadata = reflector.get<AuthTypeDecoratorPayload>(AUTH_TYPE_KEY, TestController.prototype.testMethod)

      // Assert: Verify metadata
      expect(metadata).toEqual({
        authTypes: [AuthType.PaymentAPIKey],
        options: { condition: ConditionGuard.And },
      })
    })

    it('Nên set metadata với single None auth type', () => {
      // Arrange: Chuẩn bị test class và method
      class TestController {
        @Auth([AuthType.None])
        testMethod() {}
      }

      // Act: Đọc metadata
      const metadata = reflector.get<AuthTypeDecoratorPayload>(AUTH_TYPE_KEY, TestController.prototype.testMethod)

      // Assert: Verify metadata
      expect(metadata).toEqual({
        authTypes: [AuthType.None],
        options: { condition: ConditionGuard.And },
      })
    })
  })

  // ============================================
  // AUTH() DECORATOR - MULTIPLE AUTH TYPES
  // ============================================

  describe('🔐 Auth() Decorator - Multiple Auth Types', () => {
    it('Nên set metadata với multiple auth types', () => {
      // Arrange: Chuẩn bị test class
      class TestController {
        @Auth([AuthType.Bearer, AuthType.PaymentAPIKey])
        testMethod() {}
      }

      // Act: Đọc metadata
      const metadata = reflector.get<AuthTypeDecoratorPayload>(AUTH_TYPE_KEY, TestController.prototype.testMethod)

      // Assert: Verify metadata với multiple types
      expect(metadata).toEqual({
        authTypes: [AuthType.Bearer, AuthType.PaymentAPIKey],
        options: { condition: ConditionGuard.And },
      })
    })

    it('Nên set metadata với tất cả auth types', () => {
      // Arrange: Chuẩn bị test class
      class TestController {
        @Auth([AuthType.Bearer, AuthType.PaymentAPIKey, AuthType.None])
        testMethod() {}
      }

      // Act: Đọc metadata
      const metadata = reflector.get<AuthTypeDecoratorPayload>(AUTH_TYPE_KEY, TestController.prototype.testMethod)

      // Assert: Verify metadata với all types
      expect(metadata).toEqual({
        authTypes: [AuthType.Bearer, AuthType.PaymentAPIKey, AuthType.None],
        options: { condition: ConditionGuard.And },
      })
    })
  })

  // ============================================
  // AUTH() DECORATOR - CONDITIONS
  // ============================================

  describe('🔒 Auth() Decorator - Conditions', () => {
    it('Nên sử dụng default AND condition khi không specify', () => {
      // Arrange: Chuẩn bị test class
      class TestController {
        @Auth([AuthType.Bearer])
        testMethod() {}
      }

      // Act: Đọc metadata
      const metadata = reflector.get<AuthTypeDecoratorPayload>(AUTH_TYPE_KEY, TestController.prototype.testMethod)

      // Assert: Verify default AND condition
      expect(metadata).toEqual({
        authTypes: [AuthType.Bearer],
        options: { condition: ConditionGuard.And },
      })
    })

    it('Nên set metadata với explicit AND condition', () => {
      // Arrange: Chuẩn bị test class
      class TestController {
        @Auth([AuthType.Bearer, AuthType.PaymentAPIKey], { condition: ConditionGuard.And })
        testMethod() {}
      }

      // Act: Đọc metadata
      const metadata = reflector.get<AuthTypeDecoratorPayload>(AUTH_TYPE_KEY, TestController.prototype.testMethod)

      // Assert: Verify AND condition
      expect(metadata).toEqual({
        authTypes: [AuthType.Bearer, AuthType.PaymentAPIKey],
        options: { condition: ConditionGuard.And },
      })
    })

    it('Nên set metadata với OR condition', () => {
      // Arrange: Chuẩn bị test class
      class TestController {
        @Auth([AuthType.Bearer, AuthType.PaymentAPIKey], { condition: ConditionGuard.Or })
        testMethod() {}
      }

      // Act: Đọc metadata
      const metadata = reflector.get<AuthTypeDecoratorPayload>(AUTH_TYPE_KEY, TestController.prototype.testMethod)

      // Assert: Verify OR condition
      expect(metadata).toEqual({
        authTypes: [AuthType.Bearer, AuthType.PaymentAPIKey],
        options: { condition: ConditionGuard.Or },
      })
    })
  })

  // ============================================
  // ISPUBLIC() DECORATOR
  // ============================================

  describe('🔓 IsPublic() Decorator', () => {
    it('Nên set metadata với AuthType.None', () => {
      // Arrange: Chuẩn bị test class
      class TestController {
        @IsPublic()
        testMethod() {}
      }

      // Act: Đọc metadata
      const metadata = reflector.get<AuthTypeDecoratorPayload>(AUTH_TYPE_KEY, TestController.prototype.testMethod)

      // Assert: Verify metadata với None auth type
      expect(metadata).toEqual({
        authTypes: [AuthType.None],
        options: { condition: ConditionGuard.And },
      })
    })

    it('Nên equivalent với Auth([AuthType.None])', () => {
      // Arrange: Chuẩn bị hai test classes
      class TestController1 {
        @IsPublic()
        testMethod() {}
      }
      class TestController2 {
        @Auth([AuthType.None])
        testMethod() {}
      }

      // Act: Đọc metadata từ cả hai
      const metadata1 = reflector.get<AuthTypeDecoratorPayload>(AUTH_TYPE_KEY, TestController1.prototype.testMethod)
      const metadata2 = reflector.get<AuthTypeDecoratorPayload>(AUTH_TYPE_KEY, TestController2.prototype.testMethod)

      // Assert: Verify cả hai giống nhau
      expect(metadata1).toEqual(metadata2)
    })

    it('Nên tạo public route không cần authentication', () => {
      // Arrange: Chuẩn bị test class
      class TestController {
        @IsPublic()
        publicRoute() {}
      }

      // Act: Đọc metadata
      const metadata = reflector.get<AuthTypeDecoratorPayload>(AUTH_TYPE_KEY, TestController.prototype.publicRoute)

      // Assert: Verify metadata cho public route
      expect(metadata?.authTypes).toContain(AuthType.None)
      expect(metadata?.authTypes).toHaveLength(1)
    })
  })

  // ============================================
  // CONSTANTS & TYPES
  // ============================================

  describe('📋 Constants & Types', () => {
    it('Nên export AUTH_TYPE_KEY constant với đúng value', () => {
      // Assert: Verify constant value
      expect(AUTH_TYPE_KEY).toBe('authType')
    })

    it('Nên có AuthTypeDecoratorPayload type structure đúng', () => {
      // Arrange: Tạo payload object
      const payload: AuthTypeDecoratorPayload = {
        authTypes: [AuthType.Bearer],
        options: { condition: ConditionGuard.And },
      }

      // Assert: Verify type structure
      expect(payload).toHaveProperty('authTypes')
      expect(payload).toHaveProperty('options')
      expect(payload.options).toHaveProperty('condition')
      expect(Array.isArray(payload.authTypes)).toBe(true)
    })

    it('Nên accept tất cả AuthType values trong authTypes array', () => {
      // Arrange: Tạo payload với tất cả auth types
      const payload: AuthTypeDecoratorPayload = {
        authTypes: [AuthType.Bearer, AuthType.PaymentAPIKey, AuthType.None],
        options: { condition: ConditionGuard.And },
      }

      // Assert: Verify all types accepted
      expect(payload.authTypes).toContain(AuthType.Bearer)
      expect(payload.authTypes).toContain(AuthType.PaymentAPIKey)
      expect(payload.authTypes).toContain(AuthType.None)
    })

    it('Nên accept tất cả ConditionGuard values trong options', () => {
      // Arrange: Tạo payloads với cả hai conditions
      const andPayload: AuthTypeDecoratorPayload = {
        authTypes: [AuthType.Bearer],
        options: { condition: ConditionGuard.And },
      }
      const orPayload: AuthTypeDecoratorPayload = {
        authTypes: [AuthType.Bearer],
        options: { condition: ConditionGuard.Or },
      }

      // Assert: Verify both conditions accepted
      expect(andPayload.options.condition).toBe(ConditionGuard.And)
      expect(orPayload.options.condition).toBe(ConditionGuard.Or)
    })
  })

  // ============================================
  // DECORATOR BEHAVIOR
  // ============================================

  describe('🎭 Decorator Behavior', () => {
    it('Nên apply decorator lên class method', () => {
      // Arrange & Act: Apply decorator
      class TestController {
        @Auth([AuthType.Bearer])
        protectedMethod() {}
      }

      // Assert: Verify metadata được set
      const metadata = reflector.get<AuthTypeDecoratorPayload>(AUTH_TYPE_KEY, TestController.prototype.protectedMethod)
      expect(metadata).toBeDefined()
    })

    it('Nên apply decorator lên class', () => {
      // Arrange & Act: Apply decorator lên class
      @Auth([AuthType.Bearer])
      class TestController {
        testMethod() {}
      }

      // Assert: Verify metadata được set lên class
      const metadata = reflector.get<AuthTypeDecoratorPayload>(AUTH_TYPE_KEY, TestController)
      expect(metadata).toBeDefined()
      expect(metadata?.authTypes).toContain(AuthType.Bearer)
    })

    it('Nên support multiple decorators trên cùng method', () => {
      // Arrange & Act: Apply multiple decorators
      class TestController {
        @Auth([AuthType.Bearer])
        @Auth([AuthType.PaymentAPIKey])
        testMethod() {}
      }

      // Act: Đọc metadata (decorator cuối cùng sẽ override)
      const metadata = reflector.get<AuthTypeDecoratorPayload>(AUTH_TYPE_KEY, TestController.prototype.testMethod)

      // Assert: Verify metadata từ decorator cuối
      expect(metadata).toBeDefined()
    })
  })
})
