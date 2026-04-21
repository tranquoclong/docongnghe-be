import { http, HttpResponse } from 'msw'

/**
 * Create an error handler override for Anthropic API
 */
export function createAnthropicErrorHandler(status: number, body: Record<string, unknown> = {}) {
  return http.post('https://api.anthropic.com/v1/messages', () => {
    return HttpResponse.json(
      { type: 'error', error: { type: 'api_error', message: 'Mock error' }, ...body },
      { status },
    )
  })
}

/**
 * Create an error handler override for Resend API
 */
export function createResendErrorHandler(status: number, body: Record<string, unknown> = {}) {
  return http.post('https://api.resend.com/emails', () => {
    return HttpResponse.json({ statusCode: status, message: 'Mock error', name: 'Error', ...body }, { status })
  })
}

/**
 * Create an error handler override for Google OAuth token endpoint
 */
export function createGoogleTokenErrorHandler(error: string = 'invalid_grant') {
  return http.post('https://oauth2.googleapis.com/token', () => {
    return HttpResponse.json({ error, error_description: 'Mock Google error' }, { status: 400 })
  })
}

/**
 * Create an error handler override for Google userinfo endpoint
 */
export function createGoogleUserInfoErrorHandler(overrides: Record<string, unknown> = {}) {
  return http.get('https://www.googleapis.com/oauth2/v2/userinfo', () => {
    return HttpResponse.json({ id: '123', ...overrides })
  })
}

/**
 * Create an error handler override for S3 uploads
 */
export function createS3ErrorHandler(status: number = 403) {
  return http.put(/https:\/\/.*\.s3\..*\.amazonaws\.com\/.*/, () => {
    return new HttpResponse('<Error><Code>AccessDenied</Code></Error>', {
      status,
      headers: { 'Content-Type': 'application/xml' },
    })
  })
}

/**
 * Create a delayed handler for timeout testing
 */
export function createAnthropicTimeoutHandler(delayMs: number = 30000) {
  return http.post('https://api.anthropic.com/v1/messages', async () => {
    await new Promise((resolve) => setTimeout(resolve, delayMs))
    return HttpResponse.json({ id: 'msg_timeout' })
  })
}
