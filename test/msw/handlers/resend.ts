import { http, HttpResponse } from 'msw'

export const resendHandlers = [
  // POST /emails — send email via Resend API
  http.post('https://api.resend.com/emails', () => {
    return HttpResponse.json({
      id: 'mock-email-id-001',
    })
  }),
]
