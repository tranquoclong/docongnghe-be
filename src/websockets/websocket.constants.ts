/**
 * Injection token for the shared chat Redis instance.
 * Used by ChatRedisService and WebsocketAdapter to share a single connection.
 */
export const CHAT_REDIS = Symbol('CHAT_REDIS')
