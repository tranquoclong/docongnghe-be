// Sẽ khai báo hết column của User và sẽ quy định cái type cho nó luôn

import { UserStatus } from 'src/shared/constants/auth.constant'
import { PermissionSchema } from 'src/shared/models/shared-permission.model'
import { RoleSchema } from 'src/shared/models/shared-role.model'
import { z } from 'zod'

// Chứ schema nó chỉ là một cái object mà thôi
export const UserSchema = z.object({
  id: z.number(),
  email: z.email(),
  name: z.string().min(1).max(100),
  password: z.string().min(6).max(100),
  phoneNumber: z.string().min(9).max(15),
  avatar: z.string().nullable(), // vẫn để là nullable
  totpSecret: z.string().nullable(),
  status: z.enum([UserStatus.ACTIVE, UserStatus.INACTIVE, UserStatus.BLOCKED]), // tương đương với cách ở dưới
  // status: z.nativeEnum(UserStatus),
  roleId: z.number().positive(),
  createdById: z.number().nullable(),
  updatedById: z.number().nullable(),
  deletedById: z.number().nullable(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
  deletedAt: z.iso.datetime().nullable(),
})

/**
 * Áp dụng cho Response của api GET('profile') và GET('users/:userId')
 */
export const GetUserProfileResSchema = UserSchema.omit({
  password: true,
  totpSecret: true,
}).extend({
  role: RoleSchema.pick({
    id: true,
    name: true,
  }).extend({
    permissions: z.array(
      PermissionSchema.pick({
        id: true,
        name: true,
        module: true,
        path: true,
        method: true,
      }),
    ),
  }),
})

/**
 * Áp dụng cho Response của api PUT('profile') và PUT('users/:userId')
 */
export const UpdateProfileResSchema = UserSchema.omit({
  password: true,
  totpSecret: true,
})

/**
 * Áp dụng cho Response của api PUT('profile') và PUT('users/:userId') - cho phép null
 */
export const UpdateProfileResNullableSchema = z
  .object({
    id: z.number(),
    email: z.string(),
    name: z.string(),
    phoneNumber: z.string(),
    avatar: z.string().nullable(),
    status: z.enum([UserStatus.ACTIVE, UserStatus.INACTIVE, UserStatus.BLOCKED]),
    roleId: z.number(),
    createdById: z.number().nullable(),
    updatedById: z.number().nullable(),
    deletedById: z.number().nullable(),
    createdAt: z.iso.datetime(),
    updatedAt: z.iso.datetime(),
    deletedAt: z.iso.datetime().nullable(),
  })
  .nullable()

export type UserType = z.infer<typeof UserSchema>
export type GetUserProfileResType = z.infer<typeof GetUserProfileResSchema>
export type UpdateProfileResType = z.infer<typeof UpdateProfileResSchema>
export type UpdateProfileResNullableType = z.infer<typeof UpdateProfileResNullableSchema>
