import { Injectable } from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import envConfig from 'src/shared/config'
import {
  AccessTokenPayload,
  AccessTokenPayloadCreate,
  RefreshTokenPayload,
  RefreshTokenPayloadCreate,
} from 'src/shared/types/jwt.type'
import { v4 as uuidv4 } from 'uuid'
import { StringValue } from 'ms'

@Injectable()
export class TokenService {
  constructor(private readonly jwtService: JwtService) {}

  signAccessToken(payload: AccessTokenPayloadCreate) {
    return this.jwtService.sign(
      { ...payload, uuid: uuidv4() },
      {
        secret: envConfig.ACCESS_TOKEN_SECRET,
        expiresIn: envConfig.ACCESS_TOKEN_EXPIRES_IN as StringValue,
        algorithm: 'HS256',
      },
    )
  }

  signRefreshToken(payload: RefreshTokenPayloadCreate, expiresIn?: number) {
    // func RefreshToken sẽ tính toán lại thời gian hết hạn của RefreshToken
    return this.jwtService.sign(
      { ...payload, uuid: uuidv4() },
      {
        secret: envConfig.REFRESH_TOKEN_SECRET,
        // Lý do phải trừ đi Math.floor(Date.now() / 1000) đó chính là
        // Nếu mà không truyền vào expiresIn thì mỗi lần `refreshToken` thì nó sẽ lấy thời gian hiện tại + envConfig.REFRESH_TOKEN_EXPIRES_IN
        expiresIn: expiresIn ?? (envConfig.REFRESH_TOKEN_EXPIRES_IN as StringValue),
        algorithm: 'HS256',
      },
    )
  }

  // Phải truyền vào secret của AT
  verifyAccessToken(token: string): Promise<AccessTokenPayload> {
    return this.jwtService.verifyAsync(token, {
      secret: envConfig.ACCESS_TOKEN_SECRET,
    })
  }

  // Phải truyền vào secret của RT
  verifyRefreshToken(token: string): Promise<RefreshTokenPayload> {
    return this.jwtService.verifyAsync(token, {
      secret: envConfig.REFRESH_TOKEN_SECRET,
    })
  }
}
