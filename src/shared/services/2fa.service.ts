import { Injectable } from '@nestjs/common'
import * as OTPAuth from 'otpauth'
import envConfig from 'src/shared/config'

@Injectable()
export class TwoFactorService {
  constructor() {}

  // Tạo ra TOTP object
  private createTOTP(email: string, secret?: string) {
    return new OTPAuth.TOTP({
      issuer: envConfig.APP_NAME,
      label: email,
      algorithm: 'SHA1', // Nên chọn thuật toán mà google Authenticator nó hỗ trợ
      digits: 6,
      period: 30,
      // không thể để một cái string bất kì được, truyền bên ngoài vào thì phải để cho nó định dạng(nó phải có dạng là base32) hoặc là chúng ta có thể omit nó luôn -> Và nó sẽ tự random ra
      secret: secret || new OTPAuth.Secret(),
    })
  }

  // Hàm xử lý tạo secret và uri cho TOTP
  generateTOTPSecret(email: string) {
    const totpSecret = this.createTOTP(email)
    return {
      secret: totpSecret.secret.base32, // secret
      uri: totpSecret.toString(), // uri
    }
  }

  verifyTOTP({ email, secret, token }: { email: string; secret: string; token: string }): boolean {
    // tạo ra được cái totp object
    const totp = this.createTOTP(email, secret)
    // window: 1 có nghĩa là cái mã OTP trước và sau 30s đều hợp lệ cả(khi mà thời gian cũ đã hết mà người dùng vẫn chưa nhập kịp mã OTP cũ thì chúng ta vẫn cho phép cái mã TOTP đó là hợp lệ - thì chúng ta cần phải trừ thao cái trường hợp đó) đó là ý nghĩa của window: 1 - hầu như server xác thực hiện nay đều sử dụng cái window: 1
    const delta = totp.validate({ token, window: 1 })

    // nghĩa là cái token nếu mà nó đúng thì thằng delta nó sẽ khác null thì sẽ return về là true, ngược lại là false
    return delta !== null
  }

  // Hàm để mà xủ lý
}

// const twoFactorService = new TwoFactorService()
// console.log(
//   twoFactorService.verifyTOTP({
//     email: 'langtupro0456@gmail.com',
//     secret: 'PO5AB6LP5XJI3GLJ6IE5O3ATGBOK6KQH',
//     token: '361148',
//   }),
// )
