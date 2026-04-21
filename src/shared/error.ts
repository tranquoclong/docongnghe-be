import { NotFoundException, UnprocessableEntityException } from '@nestjs/common'

export const NotFoundRecordException = new NotFoundException('Error.NotFound')

export const InvalidPasswordException = new UnprocessableEntityException([
  {
    message: 'Error.InvalidPassword',
    path: 'password',
  },
])

// Helper function to create error objects
export function createErrorObject(error: { message: string; statusCode: number; errorCode: string }) {
  return {
    message: error.message,
    statusCode: error.statusCode,
    errorCode: error.errorCode,
  }
}
