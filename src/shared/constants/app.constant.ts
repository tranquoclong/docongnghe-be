/**
 * Application-wide constants
 * Centralizes magic numbers and strings to improve maintainability
 */

// Cache TTL values (in milliseconds)
export const CACHE_TTL = {
  SHORT: 60 * 1000, // 1 minute
  MEDIUM: 5 * 60 * 1000, // 5 minutes
  LONG: 60 * 60 * 1000, // 1 hour
  VERY_LONG: 24 * 60 * 60 * 1000, // 24 hours
} as const

// Cache TTL values (in seconds) for cache-manager
export const CACHE_TTL_SECONDS = {
  SHORT: 60, // 1 minute
  MEDIUM: 300, // 5 minutes
  LONG: 3600, // 1 hour
  VERY_LONG: 86400, // 24 hours
} as const

// Job delays (in milliseconds)
export const JOB_DELAYS = {
  PAYMENT_CANCEL: 24 * 60 * 60 * 1000, // 24 hours
  RETRY_SHORT: 2000, // 2 seconds
  RETRY_MEDIUM: 5000, // 5 seconds
  RETRY_LONG: 30000, // 30 seconds
} as const

// Job retention settings
export const JOB_RETENTION = {
  COMPLETED_AGE: 3600, // 1 hour in seconds
  COMPLETED_COUNT: 1000,
  FAILED_AGE: 86400, // 24 hours in seconds
  FAILED_COUNT: 5000,
} as const

// Pagination defaults
export const PAGINATION = {
  DEFAULT_PAGE: 1,
  DEFAULT_LIMIT: 10,
  MAX_LIMIT: 100,
} as const

// Rate limiting
export const RATE_LIMIT = {
  AUTH_LOGIN: { limit: 5, ttl: 60000 }, // 5 requests per minute
  AUTH_REGISTER: { limit: 3, ttl: 60000 }, // 3 requests per minute
  AUTH_OTP: { limit: 3, ttl: 300000 }, // 3 requests per 5 minutes
  AUTH_FORGOT_PASSWORD: { limit: 3, ttl: 300000 }, // 3 requests per 5 minutes
} as const

// Price alert thresholds
export const PRICE_ALERT = {
  MIN_DROP_PERCENTAGE: 5, // Minimum 5% price drop to trigger alert
} as const

// File upload limits
export const FILE_UPLOAD = {
  MAX_FILE_SIZE: 5 * 1024 * 1024, // 5MB
  MAX_FILES_PER_REQUEST: 10,
} as const

// Transaction timeouts (in milliseconds)
export const TRANSACTION = {
  DEFAULT_TIMEOUT: 30000, // 30 seconds
  MAX_WAIT: 10000, // 10 seconds
} as const

// Success messages
export const MESSAGES = {
  OTP_SENT: 'Gửi mã OTP thành công',
  LOGOUT_SUCCESS: 'Đăng xuất thành công',
  CHANGE_PASSWORD_SUCCESS: 'Đổi mật khẩu thành công.',
  DISABLE_2FA_SUCCESS: 'Tắt 2FA thành công',
  DELETE_SUCCESS: 'Delete successfully',
  PAYMENT_RECEIVED: 'Payment received successfully',
} as const

// Message/Chat limits
export const MESSAGE_LIMITS = {
  MAX_CONTENT_LENGTH: 10000, // 10,000 characters
  MAX_FILE_SIZE: 100 * 1024 * 1024, // 100MB
  MAX_ATTACHMENTS: 10,
  EDIT_WINDOW_MS: 24 * 60 * 60 * 1000, // 24 hours
} as const

// Typing indicator
export const TYPING_INDICATOR = {
  TIMEOUT_MS: 10000, // 10 seconds
} as const
