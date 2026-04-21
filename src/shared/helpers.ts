import { Prisma } from '@prisma/client'
import { randomInt } from 'crypto'
import path from 'path'
import { v4 as uuidv4 } from 'uuid'

// Type Predicate
export function isUniqueConstraintPrismaError(error: any): error is Prisma.PrismaClientKnownRequestError {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002'
}

export function isNotFoundPrismaError(error: any): error is Prisma.PrismaClientKnownRequestError {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025'
}

export function isForeignKeyConstraintPrismaError(error: any): error is Prisma.PrismaClientKnownRequestError {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2003'
}

// Khai báo một function để mà tạo mã OTP
export const generateOTP = () => {
  // Sau khi mà random một số bất kì nếu độ dài chưa đủ 6 thì nó sẽ thêm số 0 vào đầu cho đủ 6 chữ số
  return String(randomInt(0, 1000000)).padStart(6, '0')
}

export const generateRandomFileName = (filename: string) => {
  const ext = path.extname(filename)
  return `${uuidv4()}${ext}` // Như thế này là được
}

export const generateCancelPaymentJobId = (paymentId: number) => {
  return `paymentId-${paymentId}`
}

export const generateRoomUserId = (userId: number) => {
  return `userId-${userId}`
}
