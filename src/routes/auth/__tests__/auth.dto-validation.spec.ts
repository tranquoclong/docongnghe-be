import { RegisterBodySchema, LoginBodySchema, SendOTPBodySchema } from 'src/routes/auth/auth.model'

describe('Auth DTO Validation Snapshots', () => {
  describe('RegisterBodySchema', () => {
    it('should produce validation errors for empty object', () => {
      const result = RegisterBodySchema.safeParse({})
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.issues).toMatchSnapshot()
      }
    })

    it('should produce validation errors for invalid email and short password', () => {
      const result = RegisterBodySchema.safeParse({
        email: 'not-an-email',
        password: '12',
        confirmPassword: '34',
        name: '',
        phoneNumber: '1',
        code: '1',
      })
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.issues).toMatchSnapshot()
      }
    })

    it('should produce validation error for mismatched passwords', () => {
      const result = RegisterBodySchema.safeParse({
        email: 'test@example.com',
        password: 'password123',
        confirmPassword: 'different123',
        name: 'Test User',
        phoneNumber: '0123456789',
        code: '123456',
      })
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.issues).toMatchSnapshot()
      }
    })
  })

  describe('LoginBodySchema', () => {
    it('should produce validation errors for empty object', () => {
      const result = LoginBodySchema.safeParse({})
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.issues).toMatchSnapshot()
      }
    })

    it('should produce validation error when both totpCode and code provided', () => {
      const result = LoginBodySchema.safeParse({
        email: 'test@example.com',
        password: 'password123',
        totpCode: '123456',
        code: '654321',
      })
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.issues).toMatchSnapshot()
      }
    })
  })

  describe('SendOTPBodySchema', () => {
    it('should produce validation errors for empty object', () => {
      const result = SendOTPBodySchema.safeParse({})
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.issues).toMatchSnapshot()
      }
    })

    it('should produce validation error for invalid email', () => {
      const result = SendOTPBodySchema.safeParse({
        email: 'not-an-email',
        type: 'REGISTER',
      })
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.issues).toMatchSnapshot()
      }
    })

    it('should produce validation error for invalid type', () => {
      const result = SendOTPBodySchema.safeParse({
        email: 'test@example.com',
        type: 'INVALID_TYPE',
      })
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.issues).toMatchSnapshot()
      }
    })
  })
})
