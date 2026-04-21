import { TypeOfVerificationCode } from 'src/shared/constants/auth.constant'
import { RoleSchema } from 'src/shared/models/shared-role.model'
import { UserSchema } from 'src/shared/models/shared-user.model'
import { z } from 'zod'

// Tạo ra RegisterBodySchema -> Đây là cách mà tạo ra một RegisterBodySchema
export const RegisterBodySchema = UserSchema.pick({
  email: true,
  password: true,
  name: true,
  phoneNumber: true,
})
  .extend({
    confirmPassword: z.string().min(6).max(100),
    code: z.string().length(6),
  })
  .strict()
  .superRefine(({ confirmPassword, password }, ctx) => {
    if (confirmPassword !== password) {
      ctx.addIssue({
        code: 'custom',
        message: 'Password and confirm password must match.',
        path: ['confirmPassword'], // path chỉ ra là thằng nào là thằng bị lỗi ở đây, là một cái array
      })
    }
  })

// Đưa cái schema vào để mà tạo ra cái type tương ứng của nó

// Khai báo thêm thằng này để mà chuẩn hóa dữ liệu trả về cho RegisterRes
export const RegisterResSchema = UserSchema.omit({
  password: true,
  totpSecret: true,
})

// Khai báo Schema cho VerificationCode
export const VerificationCodeSchema = z.object({
  id: z.number(),
  email: z.email(),
  code: z.string().length(6),
  type: z.enum([
    TypeOfVerificationCode.REGISTER,
    TypeOfVerificationCode.FORGOT_PASSWORD,
    TypeOfVerificationCode.LOGIN,
    TypeOfVerificationCode.DISABLE_2FA,
  ]),
  expiresAt: z.iso.datetime(),
  createdAt: z.iso.datetime(),
})

// Khai báo type cho VerificationCode

export const SendOTPBodySchema = VerificationCodeSchema.pick({
  email: true,
  type: true,
})

export const LoginBodySchema = UserSchema.pick({
  email: true,
  password: true,
})
  .extend({
    totpCode: z.string().length(6).optional(), // 2FA code
    code: z.string().length(6).optional(), // Email OTP code
  })
  .strict()
  .superRefine(({ totpCode, code }, ctx) => {
    // Nếu mà thằng người dùng truyền lên một lúc cả 2 trường thì chúng ta sẽ addIssue cho phía client, chỉ check trường hợp là true và true của cả 2 trường mà thôi
    const message = 'Bạn phải cung cấp mã xác thực 2FA hoặc mã OTP. Không được cung cấp cả 2'
    if (totpCode !== undefined && code !== undefined) {
      ctx.addIssue({
        code: 'custom',
        message,
        path: ['totpCode'],
      })
      ctx.addIssue({
        code: 'custom',
        message,
        path: ['code'],
      })
    }
  })

// Thì thường cái res sẽ không thêm cờ `strict()` vào cho nó để mà làm gì cả
// Đó là lí do đừng nên thêm cờ strict() vào cái `ResSchema` -> Vì có thể nếu có lỗi xảy ra thì nó sẽ quăng ra lỗi đó
// Khi mà mình không strict thì nếu dữ liệu trả về cho người dùng nó có bị dư hay cái gì đó thì nó vẫn không gây ra lỗi.
export const LoginResSchema = z.object({
  accessToken: z.string(),
  refreshToken: z.string(),
})

export const RefreshTokenSchema = z.object({
  token: z.string(),
  userId: z.number(),
  deviceId: z.number(),
  expiresAt: z.iso.datetime(),
  createdAt: z.iso.datetime(),
})

export const RefreshTokenBodySchema = z
  .object({
    refreshToken: z.string(),
  })
  .strict()

export const RefreshTokenResSchema = LoginResSchema

export const DeviceSchema = z.object({
  id: z.number(),
  userId: z.number(),
  userAgent: z.string(),
  ip: z.string(),
  lastActive: z.iso.datetime(),
  createdAt: z.iso.datetime(),
  isActive: z.boolean(),
})

// export const RoleSchema = z.object({
//   id: z.number(),
//   name: z.string(),
//   description: z.string(),
//   isActive: z.boolean(),
//   createdById: z.number().nullable(),
//   updatedById: z.number().nullable(),
//   createdAt: z.date(),
//   updatedAt: z.date(),
//   deletedAt: z.date().nullable(),
// })

// Logout body Schema nó sẽ giống với RefreshTokenBodySchema
export const LogoutBodySchema = RefreshTokenBodySchema

export const GoogleAuthStateSchema = DeviceSchema.pick({
  userAgent: true,
  ip: true,
})

export const GetAuthorizationUrlResSchema = z.object({
  url: z.url(),
})

export const ForgotPasswordBodySchema = z
  .object({
    email: z.email(),
    code: z.string().length(6),
    newPassword: z.string().min(6).max(100),
    confirmNewPassword: z.string().min(6).max(100),
  })
  .strict()
  .superRefine(({ confirmNewPassword, newPassword }, ctx) => {
    if (confirmNewPassword !== newPassword) {
      ctx.addIssue({
        code: 'custom',
        message: 'Mật khẩu và mật khẩu xác nhận phải giống nhau',
        path: ['confirmNewPassword'],
      })
    }
  })

export const ResetPasswordBodySchema = z.object({
  email: z.email(),
})

// Về cái setup thì cái body chúng ta sẽ không gửi lên cái gì hết
export const EnableTwoFactorBodySchema = z.object({})

// Còn về phía disable thì cái body cần gửi lên totpCode hoặc là code OTP
export const DisableTwoFactorBodySchema = z
  .object({
    totpCode: z.string().length(6).optional(),
    code: z.string().length(6).optional(),
  })
  .superRefine(({ totpCode, code }, ctx) => {
    const message = 'Bạn phải cung cấp mã xác thực 2FA hoặc mã OTP. Không được cung cấp cả 2'
    // Nếu như cả 2 thằng này điều khác undefined, cả 2 đều có hoặc không có thì nó sẽ nhảy vào câu if
    if ((totpCode !== undefined) === (code !== undefined)) {
      ctx.addIssue({
        path: ['totpCode'],
        message,
        code: 'custom',
      })
      ctx.addIssue({
        path: ['code'],
        message,
        code: 'custom',
      })
    }
  })

export const TwoFactorEnableResSchema = z.object({
  secret: z.string(),
  uri: z.string(),
})

export type RegisterBodyType = z.infer<typeof RegisterBodySchema>
export type RegisterResType = z.infer<typeof RegisterResSchema>
export type VerificationCodeType = z.infer<typeof VerificationCodeSchema>
export type SendOTPBodyType = z.infer<typeof SendOTPBodySchema>
export type LoginBodyType = z.infer<typeof LoginBodySchema>
export type LoginResType = z.infer<typeof LoginResSchema>

export type RefreshTokenType = z.infer<typeof RefreshTokenSchema>
export type RefreshTokenBodyType = z.infer<typeof RefreshTokenBodySchema>
export type RefreshTokenResType = LoginResType // chỗ này cũng có thể ghi là z.infer đều được hết.
export type LogoutBodyType = RefreshTokenBodyType

export type DeviceType = z.infer<typeof DeviceSchema>
// export type RoleType = z.infer<typeof RoleSchema>
export type GoogleAuthStateType = z.infer<typeof GoogleAuthStateSchema>
export type GetAuthorizationUrlResType = z.infer<typeof GetAuthorizationUrlResSchema>

export type ForgotPasswordBodyType = z.infer<typeof ForgotPasswordBodySchema>
export type EnableTwoFactorBodyType = z.infer<typeof EnableTwoFactorBodySchema>
export type DisableTwoFactorBodyType = z.infer<typeof DisableTwoFactorBodySchema>
export type TwoFactorEnableResType = z.infer<typeof TwoFactorEnableResSchema>

// export const ForgotPasswordBodySchema = z.object({
//   email: z.string().email(),
// })
// export type ForgotPasswordBodyType = z.infer<typeof ForgotPasswordBodySchema>

// export const ResetPasswordBodySchema = z.object({
//   email: z.string().email(),
//   code: z.string().length(6),
//   newPassword: z.string().min(6).max(100),
// }).strict()
// export type ResetPasswordBodyType = z.infer<typeof ResetPasswordBodySchema>

// export const TwoFactorSetupBodySchema  = z.object({})
// export type TwoFactorSetupBodyType = z.infer<typeof TwoFactorSetupBodySchema>

// export const TwoFactorSetupResSChema  = z.object({})
// export type TwoFactorSetupResType = z.infer<typeof TwoFactorSetupResSchema>

// export const TwoFactorVerifyBodySchema  = z.object({})
//  export type TwoFactorVerifyBodyType = z.infer<typeof TwoFactorVerifyBodySchema>

// export const DisableTwoFactorBodySchema = z.object({})
// export type DisableTwoFactorBodyType = z.infer<typeof DisableTwoFactorBodySchema>
