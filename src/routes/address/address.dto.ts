import { z } from 'zod'
import { ListRequestSchema } from '../../shared/dtos/request.dto'
import { ListResponseSchema } from '../../shared/dtos/response.dto'
import { AddressResponseSchema, AddressStatsResponseSchema } from './address.model'

// ===== CREATE ADDRESS =====
export const CreateAddressBodySchema = z.object({
  name: z.string().min(1, 'Tên người nhận không được để trống').max(500),
  phone: z.string().min(10, 'Số điện thoại không hợp lệ').max(50),
  provinceId: z.string().min(1, 'Mã tỉnh/thành không được để trống'),
  provinceName: z.string().min(1, 'Tên tỉnh/thành không được để trống'),
  districtId: z.string().min(1, 'Mã quận/huyện không được để trống'),
  districtName: z.string().min(1, 'Tên quận/huyện không được để trống'),
  wardId: z.string().min(1, 'Mã phường/xã không được để trống'),
  wardName: z.string().min(1, 'Tên phường/xã không được để trống'),
  detail: z.string().min(1, 'Địa chỉ chi tiết không được để trống').max(500),
  isDefault: z.boolean().optional().default(false),
})

export const CreateAddressResponseSchema = z.object({
  data: AddressResponseSchema,
})

export type CreateAddressBody = z.infer<typeof CreateAddressBodySchema>
export type CreateAddressResponse = z.infer<typeof CreateAddressResponseSchema>

// ===== UPDATE ADDRESS =====
export const UpdateAddressParamsSchema = z.object({
  id: z.coerce.number().int().positive(),
})

export const UpdateAddressBodySchema = CreateAddressBodySchema.partial()

export const UpdateAddressResponseSchema = z.object({
  data: AddressResponseSchema,
})

export type UpdateAddressParams = z.infer<typeof UpdateAddressParamsSchema>
export type UpdateAddressBody = z.infer<typeof UpdateAddressBodySchema>
export type UpdateAddressResponse = z.infer<typeof UpdateAddressResponseSchema>

// ===== GET ADDRESS DETAIL =====
export const GetAddressDetailParamsSchema = z.object({
  id: z.coerce.number().int().positive(),
})

export const GetAddressDetailResponseSchema = z.object({
  data: AddressResponseSchema,
})

export type GetAddressDetailParams = z.infer<typeof GetAddressDetailParamsSchema>
export type GetAddressDetailResponse = z.infer<typeof GetAddressDetailResponseSchema>

// ===== LIST ADDRESSES =====
export const ListAddressesQuerySchema = ListRequestSchema.extend({
  isActive: z.coerce.boolean().optional(),
  search: z.string().optional(),
})

export const ListAddressesResponseSchema = ListResponseSchema.extend({
  data: z.array(AddressResponseSchema),
})

export type ListAddressesQuery = z.infer<typeof ListAddressesQuerySchema>
export type ListAddressesResponse = z.infer<typeof ListAddressesResponseSchema>

// ===== DELETE ADDRESS =====
export const DeleteAddressParamsSchema = z.object({
  id: z.coerce.number().int().positive(),
})

export const DeleteAddressResponseSchema = z.object({
  message: z.string(),
})

export type DeleteAddressParams = z.infer<typeof DeleteAddressParamsSchema>
export type DeleteAddressResponse = z.infer<typeof DeleteAddressResponseSchema>

// ===== SET DEFAULT ADDRESS =====
export const SetDefaultAddressParamsSchema = z.object({
  id: z.coerce.number().int().positive(),
})

export const SetDefaultAddressResponseSchema = z.object({
  data: AddressResponseSchema,
})

export type SetDefaultAddressParams = z.infer<typeof SetDefaultAddressParamsSchema>
export type SetDefaultAddressResponse = z.infer<typeof SetDefaultAddressResponseSchema>

// ===== GET ADDRESS STATS =====
export const GetAddressStatsResponseSchema = z.object({
  data: AddressStatsResponseSchema,
})

export type GetAddressStatsResponse = z.infer<typeof GetAddressStatsResponseSchema>
