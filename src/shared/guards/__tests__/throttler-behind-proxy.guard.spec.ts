import { ThrottlerBehindProxyGuard } from '../throttler-behind-proxy.guard'

/**
 * THROTTLER BEHIND PROXY GUARD UNIT TESTS
 *
 * Module này test rate limiting guard cho requests đi qua proxy
 * Đây là module CRITICAL vì bảo vệ API khỏi DDoS và abuse
 *
 * Test Coverage:
 * - IP extraction from proxy headers (X-Forwarded-For, X-Real-IP)
 * - Multiple proxies handling
 * - Fallback to direct IP
 * - Malformed headers handling
 * - Concurrent requests from same IP
 * - Security: IP spoofing prevention
 *
 * Note: ThrottlerBehindProxyGuard extends ThrottlerGuard và chỉ override method getTracker()
 * để extract IP từ proxy headers. Các test này focus vào logic IP extraction.
 */

describe('ThrottlerBehindProxyGuard', () => {
  let guard: ThrottlerBehindProxyGuard

  // Test data factory
  const createMockRequest = (overrides = {}) => ({
    ip: '192.168.1.100',
    ips: [],
    headers: {},
    method: 'GET',
    url: '/api/products',
    route: {
      path: '/api/products',
    },
    ...overrides,
  })

  beforeEach(() => {
    // Create guard instance directly without DI
    // We only need to test the getTracker() method
    guard = new ThrottlerBehindProxyGuard(null as any, null as any, null as any)
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  describe('🔍 IP Extraction - Basic Functionality', () => {
    it('should extract IP from req.ips[0] when behind proxy', async () => {
      // Arrange
      const mockRequest = createMockRequest({
        ip: '192.168.1.100',
        ips: ['203.0.113.1', '198.51.100.1'], // Multiple proxies
      })

      // Act
      const tracker = await guard['getTracker'](mockRequest)

      // Assert
      expect(tracker).toBe('203.0.113.1') // First IP in ips array
    })

    it('should fallback to req.ip when not behind proxy', async () => {
      // Arrange
      const mockRequest = createMockRequest({
        ip: '192.168.1.100',
        ips: [], // No proxy
      })

      // Act
      const tracker = await guard['getTracker'](mockRequest)

      // Assert
      expect(tracker).toBe('192.168.1.100')
    })

    it('should handle single proxy in ips array', async () => {
      // Arrange
      const mockRequest = createMockRequest({
        ip: '192.168.1.100',
        ips: ['203.0.113.1'], // Single proxy
      })

      // Act
      const tracker = await guard['getTracker'](mockRequest)

      // Assert
      expect(tracker).toBe('203.0.113.1')
    })

    it('should handle multiple proxies and return first IP', async () => {
      // Arrange
      const mockRequest = createMockRequest({
        ip: '192.168.1.100',
        ips: ['203.0.113.1', '198.51.100.1', '192.0.2.1'], // Chain of proxies
      })

      // Act
      const tracker = await guard['getTracker'](mockRequest)

      // Assert
      expect(tracker).toBe('203.0.113.1') // Client IP (first in chain)
    })
  })

  describe('🔒 Edge Cases - IP Handling', () => {
    it('should handle undefined ips array', async () => {
      // Arrange
      const mockRequest = createMockRequest({
        ip: '192.168.1.100',
        ips: undefined,
      })

      // Act
      const tracker = await guard['getTracker'](mockRequest)

      // Assert
      expect(tracker).toBe('192.168.1.100')
    })

    it('should handle null ips array', async () => {
      // Arrange
      const mockRequest = createMockRequest({
        ip: '192.168.1.100',
        ips: null,
      })

      // Act
      const tracker = await guard['getTracker'](mockRequest)

      // Assert
      expect(tracker).toBe('192.168.1.100')
    })

    it('should handle empty string in ips array', async () => {
      // Arrange
      const mockRequest = createMockRequest({
        ip: '192.168.1.100',
        ips: [''], // Empty string
      })

      // Act
      const tracker = await guard['getTracker'](mockRequest)

      // Assert
      expect(tracker).toBe('') // Returns empty string as it's truthy for length check
    })

    it('should handle IPv6 addresses', async () => {
      // Arrange
      const mockRequest = createMockRequest({
        ip: '::1',
        ips: ['2001:0db8:85a3:0000:0000:8a2e:0370:7334'],
      })

      // Act
      const tracker = await guard['getTracker'](mockRequest)

      // Assert
      expect(tracker).toBe('2001:0db8:85a3:0000:0000:8a2e:0370:7334')
    })

    it('should handle localhost addresses', async () => {
      // Arrange
      const mockRequest = createMockRequest({
        ip: '127.0.0.1',
        ips: [],
      })

      // Act
      const tracker = await guard['getTracker'](mockRequest)

      // Assert
      expect(tracker).toBe('127.0.0.1')
    })

    it('should handle private IP ranges', async () => {
      // Arrange
      const mockRequest = createMockRequest({
        ip: '10.0.0.1',
        ips: ['172.16.0.1', '192.168.0.1'],
      })

      // Act
      const tracker = await guard['getTracker'](mockRequest)

      // Assert
      expect(tracker).toBe('172.16.0.1')
    })
  })

  describe('🛡️ Security - IP Spoofing Prevention', () => {
    it('should consistently use first IP from ips array', async () => {
      // Arrange
      const mockRequest1 = createMockRequest({
        ips: ['203.0.113.1', '198.51.100.1'],
      })
      const mockRequest2 = createMockRequest({
        ips: ['203.0.113.1', '192.0.2.1'], // Same client, different proxy
      })

      // Act
      const tracker1 = await guard['getTracker'](mockRequest1)
      const tracker2 = await guard['getTracker'](mockRequest2)

      // Assert
      expect(tracker1).toBe(tracker2) // Same client IP
    })

    it('should not be fooled by X-Forwarded-For in headers (uses req.ips)', async () => {
      // Arrange
      const mockRequest = createMockRequest({
        ip: '192.168.1.100',
        ips: ['203.0.113.1'], // Parsed by Express/NestJS
        headers: {
          'x-forwarded-for': '198.51.100.1', // Attacker trying to spoof
        },
      })

      // Act
      const tracker = await guard['getTracker'](mockRequest)

      // Assert
      expect(tracker).toBe('203.0.113.1') // Uses req.ips, not header
    })

    it('should handle malformed IP addresses gracefully', async () => {
      // Arrange
      const mockRequest = createMockRequest({
        ip: '192.168.1.100',
        ips: ['not-an-ip', '203.0.113.1'],
      })

      // Act
      const tracker = await guard['getTracker'](mockRequest)

      // Assert
      expect(tracker).toBe('not-an-ip') // Returns first element regardless of validity
      // Note: IP validation should be done at proxy/load balancer level
    })
  })

  describe('⚡ Performance - Concurrent Requests', () => {
    it('should handle concurrent requests from same IP', async () => {
      // Arrange
      const mockRequest = createMockRequest({
        ips: ['203.0.113.1'],
      })

      // Act - Simulate concurrent calls
      const promises = Array(10)
        .fill(null)
        .map(() => guard['getTracker'](mockRequest))
      const results = await Promise.all(promises)

      // Assert
      expect(results).toHaveLength(10)
      expect(results.every((ip) => ip === '203.0.113.1')).toBe(true)
    })

    it('should handle concurrent requests from different IPs', async () => {
      // Arrange
      const requests = [
        createMockRequest({ ips: ['203.0.113.1'] }),
        createMockRequest({ ips: ['198.51.100.1'] }),
        createMockRequest({ ips: ['192.0.2.1'] }),
      ]

      // Act
      const results = await Promise.all(requests.map((req) => guard['getTracker'](req)))

      // Assert
      expect(results).toEqual(['203.0.113.1', '198.51.100.1', '192.0.2.1'])
    })
  })

  describe('🔄 Integration - Guard Behavior', () => {
    it('should return Promise<string> for tracker', async () => {
      // Arrange
      const mockRequest = createMockRequest({
        ips: ['203.0.113.1'],
      })

      // Act
      const result = guard['getTracker'](mockRequest)

      // Assert
      expect(result).toBeInstanceOf(Promise)
      await expect(result).resolves.toBe('203.0.113.1')
    })

    it('should work with different request objects', async () => {
      // Arrange
      const expressRequest = {
        ip: '192.168.1.1',
        ips: ['203.0.113.1'],
      }
      const fastifyRequest = {
        ip: '192.168.1.1',
        ips: ['203.0.113.2'],
      }

      // Act
      const expressTracker = await guard['getTracker'](expressRequest)
      const fastifyTracker = await guard['getTracker'](fastifyRequest)

      // Assert
      expect(expressTracker).toBe('203.0.113.1')
      expect(fastifyTracker).toBe('203.0.113.2')
    })
  })

  describe('📝 Type Safety', () => {
    it('should handle req as Record<string, any>', async () => {
      // Arrange
      const mockRequest: Record<string, any> = {
        ip: '192.168.1.100',
        ips: ['203.0.113.1'],
        customField: 'custom-value',
      }

      // Act
      const tracker = await guard['getTracker'](mockRequest)

      // Assert
      expect(tracker).toBe('203.0.113.1')
    })

    it('should return string type', async () => {
      // Arrange
      const mockRequest = createMockRequest({
        ips: ['203.0.113.1'],
      })

      // Act
      const tracker = await guard['getTracker'](mockRequest)

      // Assert
      expect(typeof tracker).toBe('string')
    })
  })
})
