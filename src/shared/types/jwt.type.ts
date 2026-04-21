// export interface TokenPayload {
//   userId: number
//   exp: number
//   iat: number
//   [key: string]: any
// }

// Tạo ra một cái interface cho AccessTokenPayload khi mà người dùng tạo
export interface AccessTokenPayloadCreate {
  userId: number
  roleId: number
  deviceId: number
  roleName: string
}

export interface AccessTokenPayload extends AccessTokenPayloadCreate {
  exp: number
  iat: number
}

export interface RefreshTokenPayloadCreate {
  userId: number
}

export interface RefreshTokenPayload extends RefreshTokenPayloadCreate {
  exp: number
  iat: number
}
