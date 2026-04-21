import { Body, Controller, Get, HttpCode, HttpStatus, Ip, Post, Query, Res } from '@nestjs/common'
import { Throttle } from '@nestjs/throttler'
import { Response } from 'express'
import { ZodResponse } from 'nestjs-zod'
import {
  DisableTwoFactorBodyDTO,
  ForgotPasswordBodyDTO,
  GetAuthorizationUrlResDTO,
  LoginBodyDTO,
  LoginResDTO,
  LogoutBodyDTO,
  RefreshTokenBodyDTO,
  RefreshTokenResDTO,
  RegisterBodyDTO,
  RegisterResDTO,
  SendOTPBodyDTO,
  TwoFactorEnableResDTO,
} from 'src/routes/auth/auth.dto'
import { AuthService } from 'src/routes/auth/auth.service'
import { GoogleService } from 'src/routes/auth/google.service'
import envConfig from 'src/shared/config'
import { ActiveUser } from 'src/shared/decorators/active-user.decorator'
import { IsPublic } from 'src/shared/decorators/auth.decorator'
import { UserAgent } from 'src/shared/decorators/user-agent.decorator'
import { EmptyBodyDTO } from 'src/shared/dtos/request.dto'
import { MessageResDTO } from 'src/shared/dtos/response.dto'

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly googleService: GoogleService,
  ) {}

  // Nếu mà sử dụng cái ZodSerializerDto(RegisterBodyDTO) như thế kia thì cần phải vào cái AppModule khai báo thêm thằng APP_PIPE vào để mà sử dụng global -> Cách mà team Zod recommend chúng ta sử dụng theo
  @Throttle({ short: { limit: 3, ttl: 60000 } }) // 3 requests per minute
  @Post('register')
  // Sử dụng ZodSerializerDto để mà validation output của APIendpoint, nó sẽ chuẩn hóa dữ liệu, ví dụ như là RegisterRes chúng ta không muốn trả về `password` mà trong res lại có password thì nó sẽ báo lỗi và xử lý chỗ này
  // Nên là khi mà thêm ZodSerializerDto này vào thì nó sẽ chuẩn hóa dữ liệu(output) trả về cho chúng ta theo đúng cái class ví dụ `RegisterResDTO` mà chúng ta cung cấp
  @ZodResponse({ type: RegisterResDTO })
  // Ở controller này thì chúng ta cần phải khai báo DTO nhưng bên service thì cần phải dùng @type để mà biểu thị cái params
  @IsPublic()
  register(@Body() body: RegisterBodyDTO) {
    return this.authService.register(body)
  }

  @Throttle({ short: { limit: 3, ttl: 300000 } }) // 3 requests per 5 minutes
  @Post('otp')
  @ZodResponse({ type: MessageResDTO })
  @IsPublic()
  sendOTP(@Body() body: SendOTPBodyDTO) {
    return this.authService.sendOTP(body)
  }

  // Dùng Decorator userAgent và IP của người dùng
  @Throttle({ short: { limit: 5, ttl: 60000 } }) // 5 requests per minute
  @Post('login')
  @ZodResponse({ type: LoginResDTO })
  @IsPublic()
  login(@Body() body: LoginBodyDTO, @UserAgent() userAgent: string, @Ip() ip: string) {
    return this.authService.login({
      ...body,
      userAgent,
      ip,
    })
  }

  // Khi mà mình không strict thì nếu dữ liệu trả về cho người dùng nó có bị dư hay cái gì đó thì nó vẫn không gây ra lỗi.
  @Post('refresh-token')
  @ZodResponse({ type: RefreshTokenResDTO })
  @HttpCode(HttpStatus.OK)
  @IsPublic()
  refreshToken(@Body() body: RefreshTokenBodyDTO, @UserAgent() userAgent: string, @Ip() ip: string) {
    return this.authService.refreshToken({
      refreshToken: body.refreshToken,
      userAgent,
      ip,
    })
  }

  @Post('logout')
  // Do thằng logout chỉ trả về message mà thôi
  @ZodResponse({ type: MessageResDTO })
  @IsPublic()
  logout(@Body() body: LogoutBodyDTO) {
    return this.authService.logout(body.refreshToken)
  }

  // Khai báo method GET để mà lấy về cái google link
  @Get('google-link')
  @IsPublic()
  // Thằng này trả về URL
  @ZodResponse({ type: GetAuthorizationUrlResDTO })
  // Lấy vào cái userAgent và ip của người dùng
  getAuthorizationUrl(@UserAgent() userAgent: string, @Ip() ip: string) {
    return this.googleService.getAuthorizationUrl({ userAgent, ip })
  }

  @Get('google/callback')
  @IsPublic()
  async googleCallback(@Query('code') code: string, @Query('state') state: string, @Res() res: Response) {
    try {
      const data = await this.googleService.googleCallback({ code, state })

      // Client đang thao tác với Oauth2 của GG. Thay vì chính GG trả response cho client thì GG nó thực hiện redirect để "chuyển trách nhiệm response" cho server nest.js chúng ta
      return res.redirect(
        `${envConfig.GOOGLE_CLIENT_REDIRECT_URI}?accessToken=${data.accessToken}&refreshToken=${data.refreshToken}`,
      )
    } catch (error) {
      // Trường hợp mà googleCallback nó thất bại
      console.error(error)
      // Nếu nó là instanceof của một cái object Error
      const errorMessage =
        error instanceof Error
          ? error.message
          : 'Đã xảy ra lỗi khi đăng nhập bằng google, vui lòng thử lại bằng cách khác'

      // Cũng redirect về client nhưng mà sẽ có thêm query params là error message
      return res.redirect(`${envConfig.GOOGLE_CLIENT_REDIRECT_URI}?errorMessage=${errorMessage}`)
    }
  }

  // @Post('change-password)
  // @ZodSerializerDto(ChangePasswordBodyDTO)
  // async changePassword(@Body() body: ChangePasswordBodyDTO) {}

  @Throttle({ short: { limit: 3, ttl: 300000 } }) // 3 requests per 5 minutes
  @Post('forgot-password')
  @IsPublic()
  @ZodResponse({ type: MessageResDTO })
  forgotPassword(@Body() body: ForgotPasswordBodyDTO) {
    return this.authService.forgotPassword(body)
  }

  // @Post('reset-password)
  // async resetPassword(@Body() body: ResetPasswordBodyDTO) {}

  // @Post('oauth/google')
  // async googleLogin(@Body() body: any) {
  //   return await this.authService.googleLogin(body.token)
  // }

  // Tại sao chúng ta không sử dụng method Get mà lại dùng method Post và truyền lên body rỗng là gì -> Vì Post mang ý nghĩa là tạo ra cái gì đó và Post cũng bảo mật hơn Get, vì Get có thể được kích hoạt thông qua URL trên trình duyệt, Post thì không, vấn đề đó thì kẻ tấn công có thể gởi cho ta một cái đường đẫn -> Sẽ kích hoạt cái API này thì điều đó nó sẽ không bảo mật
  @Post('2fa/enable')
  @ZodResponse({ type: TwoFactorEnableResDTO })
  enableTwoFactorAuth(@Body() _: EmptyBodyDTO, @ActiveUser('userId') userId: number) {
    return this.authService.enableTwoFactorAuth(userId)
  }

  @Post('2fa/disable')
  @ZodResponse({ type: MessageResDTO })
  disableTwoFactorAuth(@Body() body: DisableTwoFactorBodyDTO, @ActiveUser('userId') userId: number) {
    // Nếu mà truyền như thế này thì cái thằng userId nó nằm cùng object với body rồi
    return this.authService.disableTwoFactorAuth({
      ...body,
      userId,
    })
  }
}
