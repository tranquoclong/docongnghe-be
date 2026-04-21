import { SetMetadata } from '@nestjs/common'

export const ZOD_RESPONSE_ONLY_KEY = 'zod-response-only'

export interface ZodResponseOnlyOptions {
  type: any
}

export const ZodResponseOnly = (options: ZodResponseOnlyOptions) => SetMetadata(ZOD_RESPONSE_ONLY_KEY, options)
