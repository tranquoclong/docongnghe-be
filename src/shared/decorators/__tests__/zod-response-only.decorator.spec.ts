import { Reflector } from '@nestjs/core'
import { z } from 'zod'
import { ZOD_RESPONSE_ONLY_KEY, ZodResponseOnly, ZodResponseOnlyOptions } from '../zod-response-only.decorator'

/**
 * ZOD RESPONSE ONLY DECORATOR UNIT TESTS
 *
 * Module này test ZodResponseOnly decorator - metadata decorator cho ZodOutputInterceptor
 * Đây là module được sử dụng để validate response data với Zod schemas
 *
 * Test Coverage:
 * - ZOD_RESPONSE_ONLY_KEY constant value
 * - Metadata setting với schema
 * - ZodResponseOnlyOptions interface
 * - Applying to methods
 * - Reflector integration
 * - Integration với ZodOutputInterceptor
 */

describe('ZodResponseOnly Decorator', () => {
  let reflector: Reflector

  beforeEach(() => {
    reflector = new Reflector()
  })

  // ============================================
  // CONSTANT TESTS
  // ============================================

  describe('📌 Constants', () => {
    it('Nên có ZOD_RESPONSE_ONLY_KEY constant với giá trị "zod-response-only"', () => {
      // Assert: Verify constant value
      expect(ZOD_RESPONSE_ONLY_KEY).toBe('zod-response-only')
      expect(typeof ZOD_RESPONSE_ONLY_KEY).toBe('string')
    })
  })

  // ============================================
  // METADATA SETTING
  // ============================================

  describe('✅ Metadata Setting', () => {
    it('Nên set metadata với Zod schema', () => {
      // Arrange: Test schema
      const TestSchema = z.object({
        id: z.number(),
        name: z.string(),
      })

      class TestController {
        @ZodResponseOnly({ type: TestSchema })
        testMethod() {
          return { id: 1, name: 'Test' }
        }
      }

      // Act: Get metadata
      const metadata = reflector.get<ZodResponseOnlyOptions>(ZOD_RESPONSE_ONLY_KEY, TestController.prototype.testMethod)

      // Assert: Verify metadata
      expect(metadata).toBeDefined()
      expect(metadata).toHaveProperty('type')
      expect(metadata.type).toBe(TestSchema)
    })

    it('Nên work với complex Zod schema', () => {
      // Arrange: Complex schema
      const UserSchema = z.object({
        id: z.number(),
        email: z.string().email(),
        profile: z.object({
          name: z.string(),
          age: z.number().optional(),
        }),
        roles: z.array(z.string()),
      })

      class TestController {
        @ZodResponseOnly({ type: UserSchema })
        getUser() {
          return {}
        }
      }

      // Act: Get metadata
      const metadata = reflector.get<ZodResponseOnlyOptions>(ZOD_RESPONSE_ONLY_KEY, TestController.prototype.getUser)

      // Assert: Verify complex schema
      expect(metadata).toBeDefined()
      expect(metadata.type).toBe(UserSchema)
    })

    it('Nên work với array schema', () => {
      // Arrange: Array schema
      const ProductListSchema = z.array(
        z.object({
          id: z.number(),
          name: z.string(),
          price: z.number(),
        }),
      )

      class TestController {
        @ZodResponseOnly({ type: ProductListSchema })
        getProducts() {
          return []
        }
      }

      // Act: Get metadata
      const metadata = reflector.get<ZodResponseOnlyOptions>(
        ZOD_RESPONSE_ONLY_KEY,
        TestController.prototype.getProducts,
      )

      // Assert: Verify array schema
      expect(metadata).toBeDefined()
      expect(metadata.type).toBe(ProductListSchema)
    })
  })

  // ============================================
  // MULTIPLE METHODS
  // ============================================

  describe('🔢 Multiple Methods', () => {
    it('Nên work với multiple methods trong same class', () => {
      // Arrange: Multiple methods
      const UserSchema = z.object({ id: z.number(), name: z.string() })
      const ProductSchema = z.object({ id: z.number(), title: z.string() })

      class TestController {
        @ZodResponseOnly({ type: UserSchema })
        getUser() {
          return {}
        }

        @ZodResponseOnly({ type: ProductSchema })
        getProduct() {
          return {}
        }
      }

      // Act: Get metadata for both methods
      const userMetadata = reflector.get<ZodResponseOnlyOptions>(
        ZOD_RESPONSE_ONLY_KEY,
        TestController.prototype.getUser,
      )
      const productMetadata = reflector.get<ZodResponseOnlyOptions>(
        ZOD_RESPONSE_ONLY_KEY,
        TestController.prototype.getProduct,
      )

      // Assert: Verify both have correct schemas
      expect(userMetadata.type).toBe(UserSchema)
      expect(productMetadata.type).toBe(ProductSchema)
    })
  })

  // ============================================
  // EDGE CASES
  // ============================================

  describe('⚠️ Edge Cases', () => {
    it('Nên return undefined khi method không có decorator', () => {
      // Arrange: Method without decorator
      class TestController {
        testMethod() {
          return {}
        }
      }

      // Act: Get metadata
      const metadata = reflector.get<ZodResponseOnlyOptions>(ZOD_RESPONSE_ONLY_KEY, TestController.prototype.testMethod)

      // Assert: Verify undefined
      expect(metadata).toBeUndefined()
    })

    it('Nên work với primitive schema', () => {
      // Arrange: String schema
      const StringSchema = z.string()

      class TestController {
        @ZodResponseOnly({ type: StringSchema })
        getMessage() {
          return 'test'
        }
      }

      // Act: Get metadata
      const metadata = reflector.get<ZodResponseOnlyOptions>(ZOD_RESPONSE_ONLY_KEY, TestController.prototype.getMessage)

      // Assert: Verify primitive schema
      expect(metadata).toBeDefined()
      expect(metadata.type).toBe(StringSchema)
    })

    it('Nên work với union schema', () => {
      // Arrange: Union schema
      const UnionSchema = z.union([z.string(), z.number()])

      class TestController {
        @ZodResponseOnly({ type: UnionSchema })
        getValue() {
          return 'test'
        }
      }

      // Act: Get metadata
      const metadata = reflector.get<ZodResponseOnlyOptions>(ZOD_RESPONSE_ONLY_KEY, TestController.prototype.getValue)

      // Assert: Verify union schema
      expect(metadata).toBeDefined()
      expect(metadata.type).toBe(UnionSchema)
    })
  })

  // ============================================
  // REFLECTOR INTEGRATION
  // ============================================

  describe('🔍 Reflector Integration', () => {
    it('Nên work với Reflector.get()', () => {
      // Arrange: Test method
      const TestSchema = z.object({ id: z.number() })

      class TestController {
        @ZodResponseOnly({ type: TestSchema })
        testMethod() {
          return {}
        }
      }

      // Act: Use Reflector.get
      const metadata = reflector.get<ZodResponseOnlyOptions>(ZOD_RESPONSE_ONLY_KEY, TestController.prototype.testMethod)

      // Assert: Verify retrieval
      expect(metadata).toBeDefined()
      expect(metadata.type).toBe(TestSchema)
    })

    it('Nên work với Reflector.getAllAndOverride()', () => {
      // Arrange: Method decorator
      const TestSchema = z.object({ id: z.number() })

      class TestController {
        @ZodResponseOnly({ type: TestSchema })
        testMethod() {
          return {}
        }
      }

      // Act: Get with override
      const metadata = reflector.getAllAndOverride<ZodResponseOnlyOptions>(ZOD_RESPONSE_ONLY_KEY, [
        TestController.prototype.testMethod,
        TestController,
      ])

      // Assert: Verify retrieval
      expect(metadata).toBeDefined()
      expect(metadata.type).toBe(TestSchema)
    })
  })

  // ============================================
  // REAL-WORLD SCENARIOS
  // ============================================

  describe('🌍 Real-world Scenarios', () => {
    it('Nên work với API response schema', () => {
      // Arrange: API response schema
      const ApiResponseSchema = z.object({
        success: z.boolean(),
        data: z.object({
          id: z.number(),
          name: z.string(),
        }),
        message: z.string().optional(),
      })

      class TestController {
        @ZodResponseOnly({ type: ApiResponseSchema })
        getData() {
          return {
            success: true,
            data: { id: 1, name: 'Test' },
          }
        }
      }

      // Act: Get metadata
      const metadata = reflector.get<ZodResponseOnlyOptions>(ZOD_RESPONSE_ONLY_KEY, TestController.prototype.getData)

      // Assert: Verify API response schema
      expect(metadata).toBeDefined()
      expect(metadata.type).toBe(ApiResponseSchema)
    })

    it('Nên work với paginated response schema', () => {
      // Arrange: Paginated response
      const PaginatedSchema = z.object({
        items: z.array(z.object({ id: z.number(), name: z.string() })),
        total: z.number(),
        page: z.number(),
        pageSize: z.number(),
      })

      class TestController {
        @ZodResponseOnly({ type: PaginatedSchema })
        getList() {
          return {
            items: [],
            total: 0,
            page: 1,
            pageSize: 10,
          }
        }
      }

      // Act: Get metadata
      const metadata = reflector.get<ZodResponseOnlyOptions>(ZOD_RESPONSE_ONLY_KEY, TestController.prototype.getList)

      // Assert: Verify paginated schema
      expect(metadata).toBeDefined()
      expect(metadata.type).toBe(PaginatedSchema)
    })
  })
})
