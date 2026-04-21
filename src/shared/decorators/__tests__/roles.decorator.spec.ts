import { Reflector } from '@nestjs/core'
import { ROLES_KEY, Roles } from '../roles.decorator'

/**
 * ROLES DECORATOR UNIT TESTS
 *
 * Module này test Roles decorator - metadata decorator cho role-based access control
 * Đây là module CRITICAL vì được sử dụng để define required roles cho routes
 *
 * Test Coverage:
 * - ROLES_KEY constant value
 * - Single role metadata
 * - Multiple roles metadata
 * - Applying to methods
 * - Applying to classes
 * - Reflector integration
 * - Empty roles array
 */

describe('Roles Decorator', () => {
  let reflector: Reflector

  beforeEach(() => {
    reflector = new Reflector()
  })

  // ============================================
  // CONSTANT TESTS
  // ============================================

  describe('📌 Constants', () => {
    it('Nên có ROLES_KEY constant với giá trị "roles"', () => {
      // Assert: Verify constant value
      expect(ROLES_KEY).toBe('roles')
      expect(typeof ROLES_KEY).toBe('string')
    })
  })

  // ============================================
  // SINGLE ROLE
  // ============================================

  describe('✅ Single Role', () => {
    it('Nên set metadata với single role', () => {
      // Arrange: Test class với decorator
      class TestController {
        @Roles('ADMIN')
        testMethod() {
          return 'test'
        }
      }

      // Act: Get metadata
      const roles = reflector.get(ROLES_KEY, TestController.prototype.testMethod)

      // Assert: Verify single role
      expect(roles).toEqual(['ADMIN'])
      expect(roles).toHaveLength(1)
    })

    it('Nên work với different role names', () => {
      // Arrange: Test với SELLER role
      class TestController {
        @Roles('SELLER')
        testMethod() {
          return 'test'
        }
      }

      // Act: Get metadata
      const roles = reflector.get(ROLES_KEY, TestController.prototype.testMethod)

      // Assert: Verify SELLER role
      expect(roles).toEqual(['SELLER'])
    })

    it('Nên work với CLIENT role', () => {
      // Arrange: Test với CLIENT role
      class TestController {
        @Roles('CLIENT')
        testMethod() {
          return 'test'
        }
      }

      // Act: Get metadata
      const roles = reflector.get(ROLES_KEY, TestController.prototype.testMethod)

      // Assert: Verify CLIENT role
      expect(roles).toEqual(['CLIENT'])
    })
  })

  // ============================================
  // MULTIPLE ROLES
  // ============================================

  describe('🔢 Multiple Roles', () => {
    it('Nên set metadata với multiple roles', () => {
      // Arrange: Test class với multiple roles
      class TestController {
        @Roles('ADMIN', 'SELLER')
        testMethod() {
          return 'test'
        }
      }

      // Act: Get metadata
      const roles = reflector.get(ROLES_KEY, TestController.prototype.testMethod)

      // Assert: Verify multiple roles
      expect(roles).toEqual(['ADMIN', 'SELLER'])
      expect(roles).toHaveLength(2)
    })

    it('Nên preserve roles order', () => {
      // Arrange: Test với specific order
      class TestController {
        @Roles('CLIENT', 'SELLER', 'ADMIN')
        testMethod() {
          return 'test'
        }
      }

      // Act: Get metadata
      const roles = reflector.get(ROLES_KEY, TestController.prototype.testMethod)

      // Assert: Verify order preserved
      expect(roles).toEqual(['CLIENT', 'SELLER', 'ADMIN'])
      expect(roles[0]).toBe('CLIENT')
      expect(roles[1]).toBe('SELLER')
      expect(roles[2]).toBe('ADMIN')
    })

    it('Nên work với all three roles', () => {
      // Arrange: Test với all roles
      class TestController {
        @Roles('ADMIN', 'SELLER', 'CLIENT')
        testMethod() {
          return 'test'
        }
      }

      // Act: Get metadata
      const roles = reflector.get(ROLES_KEY, TestController.prototype.testMethod)

      // Assert: Verify all roles
      expect(roles).toHaveLength(3)
      expect(roles).toContain('ADMIN')
      expect(roles).toContain('SELLER')
      expect(roles).toContain('CLIENT')
    })
  })

  // ============================================
  // APPLYING TO CLASSES
  // ============================================

  describe('🏛️ Class-level Decorator', () => {
    it('Nên apply decorator to class', () => {
      // Arrange: Test class decorator
      @Roles('ADMIN')
      class TestController {
        testMethod() {
          return 'test'
        }
      }

      // Act: Get metadata from class
      const roles = reflector.get(ROLES_KEY, TestController)

      // Assert: Verify class-level metadata
      expect(roles).toEqual(['ADMIN'])
    })

    it('Nên work với multiple roles on class', () => {
      // Arrange: Class với multiple roles
      @Roles('ADMIN', 'SELLER')
      class TestController {
        testMethod() {
          return 'test'
        }
      }

      // Act: Get metadata
      const roles = reflector.get(ROLES_KEY, TestController)

      // Assert: Verify multiple roles
      expect(roles).toEqual(['ADMIN', 'SELLER'])
    })
  })

  // ============================================
  // EDGE CASES
  // ============================================

  describe('⚠️ Edge Cases', () => {
    it('Nên handle empty roles array', () => {
      // Arrange: Test với empty array
      class TestController {
        @Roles()
        testMethod() {
          return 'test'
        }
      }

      // Act: Get metadata
      const roles = reflector.get(ROLES_KEY, TestController.prototype.testMethod)

      // Assert: Verify empty array
      expect(roles).toEqual([])
      expect(roles).toHaveLength(0)
    })

    it('Nên return undefined khi không có decorator', () => {
      // Arrange: Method without decorator
      class TestController {
        testMethod() {
          return 'test'
        }
      }

      // Act: Get metadata
      const roles = reflector.get(ROLES_KEY, TestController.prototype.testMethod)

      // Assert: Verify undefined
      expect(roles).toBeUndefined()
    })

    it('Nên work với duplicate roles', () => {
      // Arrange: Test với duplicate roles
      class TestController {
        @Roles('ADMIN', 'ADMIN', 'SELLER')
        testMethod() {
          return 'test'
        }
      }

      // Act: Get metadata
      const roles = reflector.get(ROLES_KEY, TestController.prototype.testMethod)

      // Assert: Verify duplicates preserved (decorator doesn't dedupe)
      expect(roles).toEqual(['ADMIN', 'ADMIN', 'SELLER'])
      expect(roles).toHaveLength(3)
    })
  })

  // ============================================
  // REFLECTOR INTEGRATION
  // ============================================

  describe('🔍 Reflector Integration', () => {
    it('Nên work với Reflector.get()', () => {
      // Arrange: Test method
      class TestController {
        @Roles('ADMIN')
        testMethod() {
          return 'test'
        }
      }

      // Act: Use Reflector.get
      const roles = reflector.get(ROLES_KEY, TestController.prototype.testMethod)

      // Assert: Verify retrieval
      expect(roles).toBeDefined()
      expect(roles).toEqual(['ADMIN'])
    })

    it('Nên work với Reflector.getAllAndOverride()', () => {
      // Arrange: Class và method decorators
      @Roles('SELLER')
      class TestController {
        @Roles('ADMIN')
        testMethod() {
          return 'test'
        }
      }

      // Act: Get with override (method takes precedence)
      const roles = reflector.getAllAndOverride(ROLES_KEY, [TestController.prototype.testMethod, TestController])

      // Assert: Verify method decorator takes precedence
      expect(roles).toEqual(['ADMIN'])
    })

    it('Nên fallback to class decorator khi method không có', () => {
      // Arrange: Only class decorator
      @Roles('SELLER')
      class TestController {
        testMethod() {
          return 'test'
        }
      }

      // Act: Get with override
      const roles = reflector.getAllAndOverride(ROLES_KEY, [TestController.prototype.testMethod, TestController])

      // Assert: Verify fallback to class
      expect(roles).toEqual(['SELLER'])
    })
  })
})
