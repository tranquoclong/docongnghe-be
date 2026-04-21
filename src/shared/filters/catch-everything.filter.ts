import { ExceptionFilter, Catch, ArgumentsHost, HttpException, HttpStatus, Logger } from '@nestjs/common'
import { HttpAdapterHost } from '@nestjs/core'
import {
  isUniqueConstraintPrismaError,
  isNotFoundPrismaError,
  isForeignKeyConstraintPrismaError,
} from 'src/shared/helpers'

@Catch()
export class CatchEverythingFilter implements ExceptionFilter {
  private readonly logger = new Logger(CatchEverythingFilter.name)

  constructor(private readonly httpAdapterHost: HttpAdapterHost) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const { httpAdapter } = this.httpAdapterHost
    const ctx = host.switchToHttp()

    let httpStatus = HttpStatus.INTERNAL_SERVER_ERROR
    let message: string | object = 'Internal Server Error'

    // Handle HttpException
    if (exception instanceof HttpException) {
      httpStatus = exception.getStatus()
      message = exception.getResponse()
    }
    // Handle Prisma unique constraint error (P2002)
    else if (isUniqueConstraintPrismaError(exception)) {
      httpStatus = HttpStatus.CONFLICT
      message = 'Record already exists'
      this.logger.warn(`Unique constraint violation: ${JSON.stringify(exception.meta)}`)
    }
    // Handle Prisma foreign key constraint error (P2003)
    else if (isForeignKeyConstraintPrismaError(exception)) {
      httpStatus = HttpStatus.BAD_REQUEST
      message = 'Referenced record does not exist'
      this.logger.warn(`Foreign key constraint violation: ${JSON.stringify(exception.meta)}`)
    }
    // Handle Prisma not found error (P2025)
    else if (isNotFoundPrismaError(exception)) {
      httpStatus = HttpStatus.NOT_FOUND
      message = 'Record not found'
      this.logger.warn(`Record not found: ${JSON.stringify(exception.meta)}`)
    }
    // Handle unknown errors
    else {
      this.logger.error(`Unhandled exception: ${exception}`, exception instanceof Error ? exception.stack : undefined)
    }

    const responseBody = {
      statusCode: httpStatus,
      message,
    }

    httpAdapter.reply(ctx.getResponse(), responseBody, httpStatus)
  }
}
