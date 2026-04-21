import { z } from 'zod'

export const MessageResSchema = z.object({
  message: z.string(),
})

// Pagination schema for list responses
export const PaginationSchema = z.object({
  page: z.number(),
  limit: z.number(),
  total: z.number(),
  totalPages: z.number(),
})

// Base list response schema
export const ListResponseSchema = z.object({
  data: z.array(z.any()),
  pagination: PaginationSchema,
})

export type MessageResType = z.infer<typeof MessageResSchema>
export type PaginationType = z.infer<typeof PaginationSchema>
export type ListResponseType = z.infer<typeof ListResponseSchema>
