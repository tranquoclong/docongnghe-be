import { createParamDecorator, ExecutionContext } from '@nestjs/common'

// Tạo decorator lấy ra user agent của client
export const UserAgent = createParamDecorator((data: unknown, ctx: ExecutionContext): string => {
  const request = ctx.switchToHttp().getRequest()
  return request.headers['user-agent'] as string
})
