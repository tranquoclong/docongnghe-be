import { Serialize, SerializeAll } from '../serialize.decorator'

/**
 * SERIALIZE DECORATOR UNIT TESTS
 *
 * Module này test Serialize và SerializeAll decorators - method/class decorators cho JSON serialization
 * Đây là module được sử dụng để automatically serialize response data (remove non-JSON properties)
 *
 * Test Coverage:
 * - Serialize() method decorator với valid data
 * - Serialize() với null/undefined
 * - Serialize() với complex objects
 * - Serialize() với Date objects (convert to string)
 * - SerializeAll() class decorator
 * - SerializeAll() với excludeMethods
 * - SerializeAll() preserves null/undefined
 * - Async method handling
 * - Error propagation
 */

describe('Serialize Decorators', () => {
  // ============================================
  // SERIALIZE() METHOD DECORATOR
  // ============================================

  describe('✅ Serialize() Method Decorator', () => {
    it('Nên serialize simple object', async () => {
      // Arrange: Test class với Serialize decorator
      class TestService {
        @Serialize()
        async getData() {
          return { id: 1, name: 'Test' }
        }
      }

      const service = new TestService()

      // Act: Call method
      const result = await service.getData()

      // Assert: Verify serialization
      expect(result).toEqual({ id: 1, name: 'Test' })
      expect(typeof result).toBe('object')
    })

    it('Nên remove functions từ object', async () => {
      // Arrange: Object với function property
      class TestService {
        @Serialize()
        async getData() {
          return {
            id: 1,
            name: 'Test',
            method: function () {
              return 'test'
            },
          }
        }
      }

      const service = new TestService()

      // Act: Call method
      const result = await service.getData()

      // Assert: Verify function removed
      expect(result).toEqual({ id: 1, name: 'Test' })
      expect(result).not.toHaveProperty('method')
    })

    it('Nên convert Date objects to strings', async () => {
      // Arrange: Object với Date
      class TestService {
        @Serialize()
        async getData() {
          return {
            id: 1,
            createdAt: new Date('2024-01-01T00:00:00.000Z'),
          }
        }
      }

      const service = new TestService()

      // Act: Call method
      const result = await service.getData()

      // Assert: Verify Date converted to string
      expect(result.id).toBe(1)
      expect(typeof result.createdAt).toBe('string')
      expect(result.createdAt).toBe('2024-01-01T00:00:00.000Z')
    })

    it('Nên handle nested objects', async () => {
      // Arrange: Nested object
      class TestService {
        @Serialize()
        async getData() {
          return {
            id: 1,
            user: {
              name: 'Test',
              profile: {
                age: 25,
              },
            },
          }
        }
      }

      const service = new TestService()

      // Act: Call method
      const result = await service.getData()

      // Assert: Verify nested serialization
      expect(result).toEqual({
        id: 1,
        user: {
          name: 'Test',
          profile: {
            age: 25,
          },
        },
      })
    })

    it('Nên handle arrays', async () => {
      // Arrange: Array data
      class TestService {
        @Serialize()
        async getData() {
          return [
            { id: 1, name: 'Test 1' },
            { id: 2, name: 'Test 2' },
          ]
        }
      }

      const service = new TestService()

      // Act: Call method
      const result = await service.getData()

      // Assert: Verify array serialization
      expect(Array.isArray(result)).toBe(true)
      expect(result).toHaveLength(2)
      expect(result[0]).toEqual({ id: 1, name: 'Test 1' })
    })

    it('Nên preserve null values', async () => {
      // Arrange: Object với null
      class TestService {
        @Serialize()
        async getData() {
          return { id: 1, deletedAt: null }
        }
      }

      const service = new TestService()

      // Act: Call method
      const result = await service.getData()

      // Assert: Verify null preserved
      expect(result).toEqual({ id: 1, deletedAt: null })
      expect(result.deletedAt).toBeNull()
    })
  })

  // ============================================
  // NULL/UNDEFINED HANDLING
  // ============================================

  describe('⚠️ Null/Undefined Handling', () => {
    it('Nên return null khi result là null', async () => {
      // Arrange: Method returns null
      class TestService {
        @Serialize()
        async getData() {
          return null
        }
      }

      const service = new TestService()

      // Act: Call method
      const result = await service.getData()

      // Assert: Verify null returned
      expect(result).toBeNull()
    })

    it('Nên return undefined khi result là undefined', async () => {
      // Arrange: Method returns undefined
      class TestService {
        @Serialize()
        async getData() {
          return undefined
        }
      }

      const service = new TestService()

      // Act: Call method
      const result = await service.getData()

      // Assert: Verify undefined returned
      expect(result).toBeUndefined()
    })
  })

  // ============================================
  // SERIALIZEALL() CLASS DECORATOR
  // ============================================

  describe('🏛️ SerializeAll() Class Decorator', () => {
    it('Nên serialize all methods trong class', async () => {
      // Arrange: Class với multiple methods
      @SerializeAll()
      class TestService {
        async getUser() {
          return { id: 1, name: 'User' }
        }

        async getProduct() {
          return { id: 2, title: 'Product' }
        }
      }

      const service = new TestService()

      // Act: Call both methods
      const user = await service.getUser()
      const product = await service.getProduct()

      // Assert: Verify both serialized
      expect(user).toEqual({ id: 1, name: 'User' })
      expect(product).toEqual({ id: 2, title: 'Product' })
    })

    it('Nên exclude specified methods', async () => {
      // Arrange: Class với excludeMethods
      @SerializeAll(['getInternal'])
      class TestService {
        async getPublic() {
          return {
            id: 1,
            method: function () {
              return 'test'
            },
          }
        }

        async getInternal() {
          return {
            id: 2,
            method: function () {
              return 'internal'
            },
          }
        }
      }

      const service = new TestService()

      // Act: Call both methods
      const publicResult = await service.getPublic()
      const internalResult = await service.getInternal()

      // Assert: Verify public serialized, internal not
      expect(publicResult).toEqual({ id: 1 })
      expect(publicResult).not.toHaveProperty('method')
      expect(internalResult).toHaveProperty('method')
      expect(typeof internalResult.method).toBe('function')
    })

    it('Nên not affect constructor', async () => {
      // Arrange: Class với constructor
      @SerializeAll()
      class TestService {
        private value: number

        constructor() {
          this.value = 42
        }

        async getValue() {
          return { value: this.value }
        }
      }

      // Act: Create instance
      const service = new TestService()
      const result = await service.getValue()

      // Assert: Verify constructor worked
      expect(result).toEqual({ value: 42 })
    })

    it('Nên work với Date objects trong all methods', async () => {
      // Arrange: Class với Date objects
      @SerializeAll()
      class TestService {
        async getCreated() {
          return { createdAt: new Date('2024-01-01') }
        }

        async getUpdated() {
          return { updatedAt: new Date('2024-01-02') }
        }
      }

      const service = new TestService()

      // Act: Call methods
      const created = await service.getCreated()
      const updated = await service.getUpdated()

      // Assert: Verify Dates converted
      expect(typeof created.createdAt).toBe('string')
      expect(typeof updated.updatedAt).toBe('string')
    })

    it('Nên preserve null/undefined trong all methods', async () => {
      // Arrange: Class với null/undefined
      @SerializeAll()
      class TestService {
        async getNull() {
          return null
        }

        async getUndefined() {
          return undefined
        }

        async getWithNull() {
          return { id: 1, deletedAt: null }
        }
      }

      const service = new TestService()

      // Act: Call methods
      const nullResult = await service.getNull()
      const undefinedResult = await service.getUndefined()
      const withNull = await service.getWithNull()

      // Assert: Verify null/undefined preserved
      expect(nullResult).toBeNull()
      expect(undefinedResult).toBeUndefined()
      expect(withNull.deletedAt).toBeNull()
    })
  })
})
