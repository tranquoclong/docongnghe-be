import { z } from 'zod'

// Address Response Model
export const AddressResponseSchema = z.object({
  id: z.number(),
  userId: z.number(),
  name: z.string(),
  phone: z.string(),
  provinceId: z.string(),
  provinceName: z.string(),
  districtId: z.string(),
  districtName: z.string(),
  wardId: z.string(),
  wardName: z.string(),
  detail: z.string(),
  fullAddress: z.string(),
  isDefault: z.boolean(),
  isActive: z.boolean(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
})

export type AddressResponse = z.infer<typeof AddressResponseSchema>

// Simplified Address for Order
export const AddressSimpleResponseSchema = z.object({
  id: z.number(),
  name: z.string(),
  phone: z.string(),
  fullAddress: z.string(),
  isDefault: z.boolean(),
})

export type AddressSimpleResponse = z.infer<typeof AddressSimpleResponseSchema>

// Address Stats
export const AddressStatsResponseSchema = z.object({
  total: z.number(),
  defaultAddress: AddressSimpleResponseSchema.optional(),
})

export type AddressStatsResponse = z.infer<typeof AddressStatsResponseSchema>
