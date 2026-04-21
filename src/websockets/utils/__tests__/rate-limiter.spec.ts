import { TokenBucketRateLimiter, RateLimitConfig } from '../rate-limiter'

describe('TokenBucketRateLimiter', () => {
  let limiter: TokenBucketRateLimiter

  const defaultLimits = new Map<string, RateLimitConfig>([
    ['send_message', { tokens: 3, intervalMs: 60_000 }],
    ['typing_start', { tokens: 5, intervalMs: 60_000 }],
  ])

  beforeEach(() => {
    limiter = new TokenBucketRateLimiter(defaultLimits)
    jest.useFakeTimers()
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  describe('consume', () => {
    it('should allow events within the configured limit', () => {
      const result1 = limiter.consume('socket-1', 'send_message')
      const result2 = limiter.consume('socket-1', 'send_message')
      const result3 = limiter.consume('socket-1', 'send_message')

      expect(result1).toEqual({ allowed: true, retryAfterMs: 0 })
      expect(result2).toEqual({ allowed: true, retryAfterMs: 0 })
      expect(result3).toEqual({ allowed: true, retryAfterMs: 0 })
    })

    it('should block events exceeding the configured limit', () => {
      // Exhaust all 3 tokens
      limiter.consume('socket-1', 'send_message')
      limiter.consume('socket-1', 'send_message')
      limiter.consume('socket-1', 'send_message')

      // 4th should be blocked
      const result = limiter.consume('socket-1', 'send_message')

      expect(result.allowed).toBe(false)
      expect(result.retryAfterMs).toBeGreaterThan(0)
    })

    it('should replenish tokens after the full interval elapses', () => {
      // Exhaust all tokens
      limiter.consume('socket-1', 'send_message')
      limiter.consume('socket-1', 'send_message')
      limiter.consume('socket-1', 'send_message')

      // Blocked
      expect(limiter.consume('socket-1', 'send_message').allowed).toBe(false)

      // Advance time past the interval
      jest.advanceTimersByTime(60_001)

      // Should be allowed again after full refill
      const result = limiter.consume('socket-1', 'send_message')
      expect(result).toEqual({ allowed: true, retryAfterMs: 0 })
    })

    it('should partially refill tokens proportional to elapsed time', () => {
      // Exhaust all 3 tokens
      limiter.consume('socket-1', 'send_message')
      limiter.consume('socket-1', 'send_message')
      limiter.consume('socket-1', 'send_message')

      // Advance by 1/3 of interval (should refill ~1 token)
      jest.advanceTimersByTime(20_000)

      // Should allow 1 event after partial refill
      const result = limiter.consume('socket-1', 'send_message')
      expect(result.allowed).toBe(true)

      // But not a second one immediately
      const result2 = limiter.consume('socket-1', 'send_message')
      expect(result2.allowed).toBe(false)
    })

    it('should track per-socket state independently', () => {
      // Exhaust socket-1's tokens
      limiter.consume('socket-1', 'send_message')
      limiter.consume('socket-1', 'send_message')
      limiter.consume('socket-1', 'send_message')
      expect(limiter.consume('socket-1', 'send_message').allowed).toBe(false)

      // socket-2 should still have full tokens
      const result = limiter.consume('socket-2', 'send_message')
      expect(result).toEqual({ allowed: true, retryAfterMs: 0 })
    })

    it('should track per-event state independently', () => {
      // Exhaust send_message tokens
      limiter.consume('socket-1', 'send_message')
      limiter.consume('socket-1', 'send_message')
      limiter.consume('socket-1', 'send_message')
      expect(limiter.consume('socket-1', 'send_message').allowed).toBe(false)

      // typing_start should still have full tokens (5 configured)
      const result = limiter.consume('socket-1', 'typing_start')
      expect(result).toEqual({ allowed: true, retryAfterMs: 0 })
    })

    it('should always allow events without a configured limit', () => {
      // 'join_conversation' has no configured limit
      for (let i = 0; i < 100; i++) {
        const result = limiter.consume('socket-1', 'join_conversation')
        expect(result).toEqual({ allowed: true, retryAfterMs: 0 })
      }
    })

    it('should return retryAfterMs when rate limited', () => {
      limiter.consume('socket-1', 'send_message')
      limiter.consume('socket-1', 'send_message')
      limiter.consume('socket-1', 'send_message')

      const result = limiter.consume('socket-1', 'send_message')

      expect(result.allowed).toBe(false)
      expect(result.retryAfterMs).toBeGreaterThan(0)
      // retryAfterMs should be <= intervalMs
      expect(result.retryAfterMs).toBeLessThanOrEqual(60_000)
    })
  })

  describe('cleanup', () => {
    it('should remove all state for a disconnected socket', () => {
      // Use some tokens
      limiter.consume('socket-1', 'send_message')
      limiter.consume('socket-1', 'send_message')
      limiter.consume('socket-1', 'send_message')
      expect(limiter.consume('socket-1', 'send_message').allowed).toBe(false)

      // Cleanup
      limiter.cleanup('socket-1')

      // After cleanup, socket gets fresh tokens
      const result = limiter.consume('socket-1', 'send_message')
      expect(result).toEqual({ allowed: true, retryAfterMs: 0 })
    })

    it('should not affect other sockets when cleaning up one socket', () => {
      // Use tokens for both sockets
      limiter.consume('socket-1', 'send_message')
      limiter.consume('socket-1', 'send_message')
      limiter.consume('socket-2', 'send_message')
      limiter.consume('socket-2', 'send_message')
      limiter.consume('socket-2', 'send_message')

      // Cleanup socket-1 only
      limiter.cleanup('socket-1')

      // socket-2 should still be rate limited
      expect(limiter.consume('socket-2', 'send_message').allowed).toBe(false)

      // socket-1 should have fresh tokens
      expect(limiter.consume('socket-1', 'send_message').allowed).toBe(true)
    })

    it('should handle cleanup of non-existent socket gracefully', () => {
      // Should not throw
      expect(() => limiter.cleanup('non-existent-socket')).not.toThrow()
    })
  })
})
