import { Injectable, NestInterceptor, ExecutionContext, CallHandler, Logger } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { Observable } from 'rxjs'
import { map } from 'rxjs/operators'
import { ZOD_RESPONSE_ONLY_KEY } from '../decorators/zod-response-only.decorator'

@Injectable()
export class ZodOutputInterceptor implements NestInterceptor {
  private readonly logger = new Logger(ZodOutputInterceptor.name)

  constructor(private reflector: Reflector) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const handler = context.getHandler()
    const controller = context.getClass()

    return next.handle().pipe(
      map((data) => {
        // Get metadata from ZodResponseOnly decorator
        const zodResponseOptions = this.reflector.get<{ type: any }>(ZOD_RESPONSE_ONLY_KEY, handler)

        if (zodResponseOptions?.type) {
          try {
            // Perform output validation with Zod schema
            const schema = zodResponseOptions.type
            if (schema && typeof schema.parse === 'function') {
              return schema.parse(data)
            }
          } catch (error) {
            // Log validation error with context but don't throw to avoid crashing the app
            this.logger.warn(
              `Zod output validation failed for ${controller.name}.${handler.name}: ${error instanceof Error ? error.message : 'Unknown error'}`,
            )

            // In development, log more details
            if (process.env.NODE_ENV === 'development') {
              this.logger.debug(`Validation error details:`, error)
            }
          }
        }

        return data
      }),
    )
  }
}
