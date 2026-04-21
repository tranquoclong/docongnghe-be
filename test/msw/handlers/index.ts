import { anthropicHandlers } from './anthropic'
import { googleHandlers } from './google'
import { resendHandlers } from './resend'
import { s3Handlers } from './s3'

export const handlers = [...anthropicHandlers, ...googleHandlers, ...resendHandlers, ...s3Handlers]
