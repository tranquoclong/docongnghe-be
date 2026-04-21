import { z } from 'zod'

export const PaginationQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1), // Phải thêm coerce để chuyển từ string sang number
  limit: z.coerce.number().int().positive().default(10), // Phải thêm coerce để chuyển từ string sang number
})

// List Request Schema cho pagination
export const ListRequestSchema = PaginationQuerySchema

// Nếu sau này có method chuyền lên empty body rỗng thì có thể sử dụng lại cái schema này
export const EmptyBodySchema = z.object({}).strict()

export type EmptyBodyType = z.infer<typeof EmptyBodySchema>
export type PaginationQueryType = z.infer<typeof PaginationQuerySchema>
