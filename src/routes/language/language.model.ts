import { z } from 'zod'

export const LanguageSchema = z.object({
  id: z.string().max(10),
  name: z.string().max(500),
  createdById: z.number().nullable(),
  updatedById: z.number().nullable(),
  deletedAt: z.iso.datetime().nullable(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
})

// Thì phải chuyển thằng này thằng một cái object thì `ZodSerializerDto` nó mới biết được, với lại trong tương lai mình có làm thêm phân trang cho thằng này thì mình đâu có cần thay đổi cấu trúc array đi.
export const GetLanguagesResSchema = z.object({
  data: z.array(LanguageSchema),
  totalItems: z.number(),
})

export const GetLanguageParamsSchema = z
  .object({
    languageId: z.string().max(10), // chính là code của language đó và tối đa là 10 ký tự
  })
  .strict()

export const GetLanguageDetailResSchema = LanguageSchema

// Id Bây giờ thì chúng ta cần phải truyền lên cho nó
export const CreateLanguageBodySchema = LanguageSchema.pick({
  id: true,
  name: true,
}).strict()

// Chỉ cho update name thôi muốn mà update id thì phải xóa cái language đó luôn
export const UpdateLanguageBodySchema = LanguageSchema.pick({
  name: true,
}).strict()

export type LanguageType = z.infer<typeof LanguageSchema>
export type GetLanguagesResType = z.infer<typeof GetLanguagesResSchema>
export type GetLanguageDetailResType = z.infer<typeof GetLanguageDetailResSchema>
export type CreateLanguageBodyType = z.infer<typeof CreateLanguageBodySchema>
export type GetLanguageParamsType = z.infer<typeof GetLanguageParamsSchema>
export type UpdateLanguageBodyType = z.infer<typeof UpdateLanguageBodySchema>
