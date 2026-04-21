/**
 * Pagination helper utilities
 * Reduces code duplication across repositories
 */

export interface PaginationParams {
  page: number
  limit: number
}

export interface PaginatedResult<T> {
  data: T[]
  totalItems: number
  page: number
  limit: number
  totalPages: number
}

/**
 * Calculate pagination offset (skip value)
 */
export function calculateSkip(page: number, limit: number): number {
  return (page - 1) * limit
}

/**
 * Calculate total pages
 */
export function calculateTotalPages(totalItems: number, limit: number): number {
  return Math.ceil(totalItems / limit)
}

/**
 * Create a paginated result object
 */
export function createPaginatedResult<T>(data: T[], totalItems: number, params: PaginationParams): PaginatedResult<T> {
  return {
    data,
    totalItems,
    page: params.page,
    limit: params.limit,
    totalPages: calculateTotalPages(totalItems, params.limit),
  }
}

/**
 * Default pagination values
 */
export const DEFAULT_PAGE = 1
export const DEFAULT_LIMIT = 10
export const MAX_LIMIT = 100

/**
 * Validate and normalize pagination params
 */
export function normalizePaginationParams(params: Partial<PaginationParams>): PaginationParams {
  const page = Math.max(DEFAULT_PAGE, params.page || DEFAULT_PAGE)
  const limit = Math.min(MAX_LIMIT, Math.max(1, params.limit || DEFAULT_LIMIT))

  return { page, limit }
}
