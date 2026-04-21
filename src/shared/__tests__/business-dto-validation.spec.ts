import { CreateProductBodySchema } from 'src/routes/product/product.model'
import { CreateOrderBodySchema } from 'src/routes/order/order.model'
import { CreateVoucherBodySchema } from 'src/routes/voucher/voucher.dto'
import { AddToCartBodySchema } from 'src/routes/cart/cart.model'

describe('Business DTO Validation Snapshots', () => {
  describe('CreateProductBodySchema', () => {
    it('should produce validation errors for empty object', () => {
      const result = CreateProductBodySchema.safeParse({})
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.issues).toMatchSnapshot()
      }
    })

    it('should produce validation errors for invalid field types', () => {
      const result = CreateProductBodySchema.safeParse({
        publishedAt: 'not-a-date',
        name: '',
        basePrice: -1,
        virtualPrice: -1,
        brandId: 0,
        images: 'not-array',
        variants: 'not-array',
        categories: 'not-array',
        skus: 'not-array',
      })
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.issues).toMatchSnapshot()
      }
    })
  })

  describe('CreateOrderBodySchema', () => {
    it('should produce validation errors for empty array', () => {
      const result = CreateOrderBodySchema.safeParse([])
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.issues).toMatchSnapshot()
      }
    })

    it('should produce validation errors for invalid order item', () => {
      const result = CreateOrderBodySchema.safeParse([{}])
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.issues).toMatchSnapshot()
      }
    })
  })

  describe('CreateVoucherBodySchema', () => {
    it('should produce validation errors for empty object', () => {
      const result = CreateVoucherBodySchema.safeParse({})
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.issues).toMatchSnapshot()
      }
    })

    it('should produce validation error for invalid voucher code format', () => {
      const result = CreateVoucherBodySchema.safeParse({
        code: 'abc',
        name: 'Test',
        type: 'PERCENTAGE',
        value: 150,
        startDate: '2025-01-01T00:00:00.000Z',
        endDate: '2024-01-01T00:00:00.000Z',
      })
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.issues).toMatchSnapshot()
      }
    })
  })

  describe('AddToCartBodySchema', () => {
    it('should produce validation errors for empty object', () => {
      const result = AddToCartBodySchema.safeParse({})
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.issues).toMatchSnapshot()
      }
    })

    it('should produce validation errors for invalid values', () => {
      const result = AddToCartBodySchema.safeParse({
        skuId: -1,
        quantity: 0,
      })
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.issues).toMatchSnapshot()
      }
    })

    it('should produce validation error for extra fields', () => {
      const result = AddToCartBodySchema.safeParse({
        skuId: 1,
        quantity: 1,
        extraField: 'not-allowed',
      })
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.issues).toMatchSnapshot()
      }
    })
  })
})
