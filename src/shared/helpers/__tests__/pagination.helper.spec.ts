import {
  calculateSkip,
  calculateTotalPages,
  createPaginatedResult,
  DEFAULT_LIMIT,
  DEFAULT_PAGE,
  MAX_LIMIT,
  normalizePaginationParams,
} from '../pagination.helper'

/**
 * PAGINATION HELPER UNIT TESTS
 *
 * Module này test pagination utility functions
 * Đây là module shared được sử dụng across repositories để giảm code duplication
 *
 * Test Coverage:
 * - calculateSkip: offset calculation
 * - calculateTotalPages: total pages calculation
 * - createPaginatedResult: paginated result object creation
 * - normalizePaginationParams: validation và normalization
 * - Constants: DEFAULT_PAGE, DEFAULT_LIMIT, MAX_LIMIT
 * - Edge cases: zero items, single page, large datasets
 */

describe('Pagination Helper', () => {
  // ============================================
  // CONSTANTS
  // ============================================

  describe('📌 Constants', () => {
    it('DEFAULT_PAGE nên là 1', () => {
      expect(DEFAULT_PAGE).toBe(1)
    })

    it('DEFAULT_LIMIT nên là 10', () => {
      expect(DEFAULT_LIMIT).toBe(10)
    })

    it('MAX_LIMIT nên là 100', () => {
      expect(MAX_LIMIT).toBe(100)
    })
  })

  // ============================================
  // calculateSkip
  // ============================================

  describe('📐 calculateSkip', () => {
    it('Nên return 0 cho page 1', () => {
      expect(calculateSkip(1, 10)).toBe(0)
    })

    it('Nên return correct skip cho page 2 với limit 10', () => {
      expect(calculateSkip(2, 10)).toBe(10)
    })

    it('Nên return correct skip cho page 3 với limit 20', () => {
      expect(calculateSkip(3, 20)).toBe(40)
    })

    it('Nên return correct skip cho page 5 với limit 5', () => {
      expect(calculateSkip(5, 5)).toBe(20)
    })

    it('Nên handle limit 1', () => {
      expect(calculateSkip(10, 1)).toBe(9)
    })
  })

  // ============================================
  // calculateTotalPages
  // ============================================

  describe('📊 calculateTotalPages', () => {
    it('Nên return 1 khi totalItems <= limit', () => {
      expect(calculateTotalPages(5, 10)).toBe(1)
    })

    it('Nên return 1 khi totalItems bằng limit', () => {
      expect(calculateTotalPages(10, 10)).toBe(1)
    })

    it('Nên ceil up khi có remainder', () => {
      expect(calculateTotalPages(11, 10)).toBe(2)
    })

    it('Nên return correct pages cho large dataset', () => {
      expect(calculateTotalPages(100, 10)).toBe(10)
    })

    it('Nên return 0 khi totalItems là 0', () => {
      expect(calculateTotalPages(0, 10)).toBe(0)
    })

    it('Nên handle limit 1', () => {
      expect(calculateTotalPages(5, 1)).toBe(5)
    })

    it('Nên ceil up correctly cho 101 items với limit 10', () => {
      expect(calculateTotalPages(101, 10)).toBe(11)
    })
  })

  // ============================================
  // createPaginatedResult
  // ============================================

  describe('📦 createPaginatedResult', () => {
    it('Nên tạo paginated result object đúng format', () => {
      const data = [{ id: 1 }, { id: 2 }]
      const result = createPaginatedResult(data, 20, { page: 1, limit: 10 })

      expect(result).toEqual({
        data,
        totalItems: 20,
        page: 1,
        limit: 10,
        totalPages: 2,
      })
    })

    it('Nên handle empty data array', () => {
      const result = createPaginatedResult([], 0, { page: 1, limit: 10 })

      expect(result).toEqual({
        data: [],
        totalItems: 0,
        page: 1,
        limit: 10,
        totalPages: 0,
      })
    })

    it('Nên calculate totalPages correctly', () => {
      const data = [{ id: 1 }]
      const result = createPaginatedResult(data, 25, { page: 3, limit: 10 })

      expect(result.totalPages).toBe(3)
      expect(result.page).toBe(3)
    })

    it('Nên preserve original data reference', () => {
      const data = [{ id: 1, name: 'Test' }]
      const result = createPaginatedResult(data, 1, { page: 1, limit: 10 })

      expect(result.data).toBe(data)
    })
  })

  // ============================================
  // normalizePaginationParams
  // ============================================

  describe('🔧 normalizePaginationParams', () => {
    it('Nên return defaults khi params empty', () => {
      const result = normalizePaginationParams({})

      expect(result).toEqual({ page: DEFAULT_PAGE, limit: DEFAULT_LIMIT })
    })

    it('Nên giữ nguyên valid params', () => {
      const result = normalizePaginationParams({ page: 3, limit: 20 })

      expect(result).toEqual({ page: 3, limit: 20 })
    })

    it('Nên clamp page to minimum 1', () => {
      const result = normalizePaginationParams({ page: 0, limit: 10 })

      expect(result.page).toBe(DEFAULT_PAGE)
    })

    it('Nên clamp limit to maximum MAX_LIMIT', () => {
      const result = normalizePaginationParams({ page: 1, limit: 200 })

      expect(result.limit).toBe(MAX_LIMIT)
    })

    it('Nên clamp limit to minimum 1', () => {
      const result = normalizePaginationParams({ page: 1, limit: 0 })

      expect(result.limit).toBeGreaterThanOrEqual(1)
    })

    it('Nên handle negative page', () => {
      const result = normalizePaginationParams({ page: -5, limit: 10 })

      expect(result.page).toBe(DEFAULT_PAGE)
    })

    it('Nên handle undefined page', () => {
      const result = normalizePaginationParams({ limit: 15 })

      expect(result.page).toBe(DEFAULT_PAGE)
      expect(result.limit).toBe(15)
    })

    it('Nên handle undefined limit', () => {
      const result = normalizePaginationParams({ page: 2 })

      expect(result.page).toBe(2)
      expect(result.limit).toBe(DEFAULT_LIMIT)
    })

    it('Nên handle MAX_LIMIT exactly', () => {
      const result = normalizePaginationParams({ page: 1, limit: MAX_LIMIT })

      expect(result.limit).toBe(MAX_LIMIT)
    })
  })
})
