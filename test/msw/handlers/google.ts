import { http, HttpResponse } from 'msw'

export const googleHandlers = [
  // POST /token — exchange authorization code for tokens
  http.post('https://oauth2.googleapis.com/token', () => {
    return HttpResponse.json({
      access_token: 'mock-google-access-token',
      expires_in: 3599,
      refresh_token: 'mock-google-refresh-token',
      scope: 'openid https://www.googleapis.com/auth/userinfo.profile https://www.googleapis.com/auth/userinfo.email',
      token_type: 'Bearer',
      id_token: 'mock-id-token',
    })
  }),

  // GET /userinfo — retrieve authenticated user info
  http.get('https://www.googleapis.com/oauth2/v2/userinfo', () => {
    return HttpResponse.json({
      id: '123456789',
      email: 'mockuser@gmail.com',
      verified_email: true,
      name: 'Mock User',
      given_name: 'Mock',
      family_name: 'User',
      picture: 'https://lh3.googleusercontent.com/mock-avatar',
    })
  }),
]
