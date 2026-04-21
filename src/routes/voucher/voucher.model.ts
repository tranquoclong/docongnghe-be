import { z } from 'zod'

// Voucher Type Enum
export const VoucherTypeSchema = z.enum(['PERCENTAGE', 'FIXED_AMOUNT', 'FREE_SHIPPING', 'BUY_X_GET_Y'])
export type VoucherType = z.infer<typeof VoucherTypeSchema>

// Voucher Response Model
export const VoucherResponseSchema = z.object({
  id: z.number(),
  code: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  type: VoucherTypeSchema,
  value: z.number(),
  minOrderValue: z.number().nullable(),
  maxDiscount: z.number().nullable(),
  usageLimit: z.number().nullable(),
  usedCount: z.number(),
  userUsageLimit: z.number().nullable(),
  startDate: z.iso.datetime(),
  endDate: z.iso.datetime(),
  isActive: z.boolean(),
  sellerId: z.number().nullable(),
  applicableProducts: z.array(z.number()),
  excludedProducts: z.array(z.number()),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
})

export type VoucherResponse = z.infer<typeof VoucherResponseSchema>

// User Voucher Response
export const UserVoucherResponseSchema = z.object({
  id: z.number(),
  userId: z.number(),
  voucherId: z.number(),
  usedCount: z.number(),
  usedAt: z.iso.datetime().nullable(),
  savedAt: z.iso.datetime(),
  voucher: VoucherResponseSchema,
})

export type UserVoucherResponse = z.infer<typeof UserVoucherResponseSchema>

// Voucher with User Info
export const VoucherWithUserInfoSchema = VoucherResponseSchema.extend({
  userVoucher: z
    .object({
      usedCount: z.number(),
      savedAt: z.iso.datetime(),
      canUse: z.boolean(),
    })
    .nullable(),
  isCollected: z.boolean(),
  canApply: z.boolean(),
})

export type VoucherWithUserInfo = z.infer<typeof VoucherWithUserInfoSchema>

// Voucher Stats
export const VoucherStatsResponseSchema = z.object({
  totalVouchers: z.number(),
  activeVouchers: z.number(),
  collectedVouchers: z.number(),
  usedVouchers: z.number(),
})

export type VoucherStatsResponse = z.infer<typeof VoucherStatsResponseSchema>

// Voucher Application Result
export const VoucherApplicationResultSchema = z.object({
  canApply: z.boolean(),
  discountAmount: z.number(),
  reason: z.string().optional(),
  voucher: VoucherResponseSchema.optional(),
})

export type VoucherApplicationResult = z.infer<typeof VoucherApplicationResultSchema>
