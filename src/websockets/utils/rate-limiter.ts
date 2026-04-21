/**
 * Configuration for a rate limit rule.
 */
export interface RateLimitConfig {
  /** Maximum number of tokens (events) allowed per interval */
  tokens: number
  /** Interval duration in milliseconds */
  intervalMs: number
}

interface TokenBucket {
  tokens: number
  lastRefill: number
}

/**
 * In-memory token bucket rate limiter for per-socket, per-event rate limiting.
 * No Redis dependency - state is local to this process instance.
 */
export class TokenBucketRateLimiter {
  /** Map of socketId -> Map of eventName -> TokenBucket */
  private readonly buckets = new Map<string, Map<string, TokenBucket>>()

  constructor(private readonly limits: Map<string, RateLimitConfig>) {}

  /**
   * Attempt to consume a token for the given socket and event.
   *
   * @returns `{ allowed: true, retryAfterMs: 0 }` if within limit,
   *          `{ allowed: false, retryAfterMs: N }` if rate limited.
   *          Events without a configured limit are always allowed.
   */
  consume(socketId: string, eventName: string): { allowed: boolean; retryAfterMs: number } {
    const config = this.limits.get(eventName)
    if (!config) {
      // No limit configured for this event — always allow
      return { allowed: true, retryAfterMs: 0 }
    }

    const now = Date.now()

    // Get or create socket's bucket map
    let socketBuckets = this.buckets.get(socketId)
    if (!socketBuckets) {
      socketBuckets = new Map<string, TokenBucket>()
      this.buckets.set(socketId, socketBuckets)
    }

    // Get or create the token bucket for this event
    let bucket = socketBuckets.get(eventName)
    if (!bucket) {
      bucket = { tokens: config.tokens, lastRefill: now }
      socketBuckets.set(eventName, bucket)
    }

    // Refill tokens based on elapsed time
    const elapsed = now - bucket.lastRefill
    if (elapsed >= config.intervalMs) {
      // Full refill — one or more intervals have passed
      bucket.tokens = config.tokens
      bucket.lastRefill = now
    } else {
      // Partial refill proportional to elapsed time
      const tokensToAdd = (elapsed / config.intervalMs) * config.tokens
      bucket.tokens = Math.min(config.tokens, bucket.tokens + tokensToAdd)
      bucket.lastRefill = now
    }

    // Try to consume a token
    if (bucket.tokens >= 1) {
      bucket.tokens -= 1
      return { allowed: true, retryAfterMs: 0 }
    }

    // Rate limited — calculate retry delay
    const retryAfterMs = Math.ceil(((1 - bucket.tokens) / config.tokens) * config.intervalMs)
    return { allowed: false, retryAfterMs }
  }

  /**
   * Remove all rate limiter state for a disconnected socket.
   */
  cleanup(socketId: string): void {
    this.buckets.delete(socketId)
  }
}
