import { z } from 'zod'
import { ListRequestSchema } from '../../shared/dtos/request.dto'
import { ListResponseSchema } from '../../shared/dtos/response.dto'
import {
  VoucherResponseSchema,
  VoucherTypeSchema,
  UserVoucherResponseSchema,
  VoucherWithUserInfoSchema,
  VoucherStatsResponseSchema,
  VoucherApplicationResultSchema,
} from './voucher.model'

// ===== CREATE VOUCHER (Admin/Seller Only) =====
export const VoucherBaseSchema = z.object({
  code: z
    .string()
    .min(3, 'Mã voucher phải có ít nhất 3 ký tự')
    .max(50)
    .regex(/^[A-Z0-9_-]+$/, 'Mã voucher chỉ được chứa chữ hoa, số, _ và -'),
  name: z.string().min(1, 'Tên voucher không được để trống').max(500),
  description: z.string().optional(),
  type: VoucherTypeSchema,
  value: z.number().positive('Giá trị voucher phải lớn hơn 0'),
  minOrderValue: z.number().positive().optional(),
  maxDiscount: z.number().positive().optional(),
  usageLimit: z.number().int().positive().optional(),
  userUsageLimit: z.number().int().positive().optional().default(1),
  startDate: z.iso.datetime(),
  endDate: z.iso.datetime(),
  isActive: z.boolean().optional().default(true),
  applicableProducts: z.array(z.number().int().positive()).optional().default([]),
  excludedProducts: z.array(z.number().int().positive()).optional().default([]),
})

export const CreateVoucherBodySchema = VoucherBaseSchema.refine((data) => data.endDate > data.startDate, {
  message: 'Ngày kết thúc phải sau ngày bắt đầu',
  path: ['endDate'],
}).refine(
  (data) => {
    if (data.type === 'PERCENTAGE' && data.value > 100) {
      return false
    }
    return true
  },
  {
    message: 'Voucher giảm theo % không được vượt quá 100%',
    path: ['value'],
  },
)

export const CreateVoucherResponseSchema = z.object({
  data: VoucherResponseSchema,
})

export type CreateVoucherBody = z.infer<typeof CreateVoucherBodySchema>
export type CreateVoucherResponse = z.infer<typeof CreateVoucherResponseSchema>

// ===== UPDATE VOUCHER =====
export const UpdateVoucherParamsSchema = z.object({
  id: z.coerce.number().int().positive(),
})

// export const UpdateVoucherBodySchema = CreateVoucherBodySchema.partial().omit({ code: true })
export const UpdateVoucherBodySchema = VoucherBaseSchema.partial()
  .omit({ code: true })
  .superRefine((data, ctx) => {
    if (data.startDate && data.endDate && data.endDate <= data.startDate) {
      ctx.addIssue({
        code: 'custom',
        message: 'Ngày kết thúc phải sau ngày bắt đầu',
        path: ['endDate'],
      })
    }

    if (data.type === 'PERCENTAGE' && data.value !== undefined && data.value > 100) {
      ctx.addIssue({
        code: 'custom',
        message: 'Voucher giảm theo % không được vượt quá 100%',
        path: ['value'],
      })
    }
  })
export const UpdateVoucherResponseSchema = z.object({
  data: VoucherResponseSchema,
})

export type UpdateVoucherParams = z.infer<typeof UpdateVoucherParamsSchema>
export type UpdateVoucherBody = z.infer<typeof UpdateVoucherBodySchema>
export type UpdateVoucherResponse = z.infer<typeof UpdateVoucherResponseSchema>

// ===== LIST VOUCHERS (Public/Available) =====
export const ListAvailableVouchersQuerySchema = ListRequestSchema.extend({
  type: VoucherTypeSchema.optional(),
  minValue: z.coerce.number().optional(),
  maxValue: z.coerce.number().optional(),
  sellerId: z.coerce.number().optional(),
  search: z.string().optional(),
})

export const ListAvailableVouchersResponseSchema = ListResponseSchema.extend({
  data: z.array(VoucherWithUserInfoSchema),
})

export type ListAvailableVouchersQuery = z.infer<typeof ListAvailableVouchersQuerySchema>
export type ListAvailableVouchersResponse = z.infer<typeof ListAvailableVouchersResponseSchema>

// ===== LIST VOUCHERS (Admin/Seller Management) =====
export const ListVouchersQuerySchema = ListRequestSchema.extend({
  type: VoucherTypeSchema.optional(),
  isActive: z.coerce.boolean().optional(),
  sellerId: z.coerce.number().optional(),
  search: z.string().optional(),
  startDate: z.iso.datetime().optional(),
  endDate: z.iso.datetime().optional(),
})

export const ListVouchersResponseSchema = ListResponseSchema.extend({
  data: z.array(VoucherResponseSchema),
})

export type ListVouchersQuery = z.infer<typeof ListVouchersQuerySchema>
export type ListVouchersResponse = z.infer<typeof ListVouchersResponseSchema>

// ===== GET VOUCHER DETAIL =====
export const GetVoucherDetailParamsSchema = z.object({
  id: z.coerce.number().int().positive(),
})

export const GetVoucherDetailResponseSchema = z.object({
  data: VoucherWithUserInfoSchema,
})

export type GetVoucherDetailParams = z.infer<typeof GetVoucherDetailParamsSchema>
export type GetVoucherDetailResponse = z.infer<typeof GetVoucherDetailResponseSchema>

// ===== COLLECT VOUCHER =====
export const CollectVoucherParamsSchema = z.object({
  id: z.coerce.number().int().positive(),
})

export const CollectVoucherResponseSchema = z.object({
  data: UserVoucherResponseSchema,
})

export type CollectVoucherParams = z.infer<typeof CollectVoucherParamsSchema>
export type CollectVoucherResponse = z.infer<typeof CollectVoucherResponseSchema>

// ===== MY VOUCHERS =====
export const ListMyVouchersQuerySchema = ListRequestSchema.extend({
  type: VoucherTypeSchema.optional(),
  status: z.enum(['available', 'used', 'expired']).optional(),
  search: z.string().optional(),
})

export const ListMyVouchersResponseSchema = ListResponseSchema.extend({
  data: z.array(UserVoucherResponseSchema),
})

export type ListMyVouchersQuery = z.infer<typeof ListMyVouchersQuerySchema>
export type ListMyVouchersResponse = z.infer<typeof ListMyVouchersResponseSchema>

// ===== APPLY VOUCHER =====
export const ApplyVoucherBodySchema = z.object({
  code: z.string().min(1, 'Mã voucher không được để trống'),
  orderAmount: z.number().positive('Giá trị đơn hàng phải lớn hơn 0'),
  productIds: z.array(z.number().int().positive()).optional().default([]),
})

export const ApplyVoucherResponseSchema = z.object({
  data: VoucherApplicationResultSchema,
})

export type ApplyVoucherBody = z.infer<typeof ApplyVoucherBodySchema>
export type ApplyVoucherResponse = z.infer<typeof ApplyVoucherResponseSchema>

// ===== GET VOUCHER BY CODE =====
export const GetVoucherByCodeParamsSchema = z.object({
  code: z.string().min(1),
})

export const GetVoucherByCodeResponseSchema = z.object({
  data: VoucherWithUserInfoSchema,
})

export type GetVoucherByCodeParams = z.infer<typeof GetVoucherByCodeParamsSchema>
export type GetVoucherByCodeResponse = z.infer<typeof GetVoucherByCodeResponseSchema>

// ===== DELETE VOUCHER =====
export const DeleteVoucherParamsSchema = z.object({
  id: z.coerce.number().int().positive(),
})

export const DeleteVoucherResponseSchema = z.object({
  message: z.string(),
})

export type DeleteVoucherParams = z.infer<typeof DeleteVoucherParamsSchema>
export type DeleteVoucherResponse = z.infer<typeof DeleteVoucherResponseSchema>

// ===== VOUCHER STATS =====
export const GetVoucherStatsResponseSchema = z.object({
  data: VoucherStatsResponseSchema,
})

export type GetVoucherStatsResponse = z.infer<typeof GetVoucherStatsResponseSchema>
