import { Injectable } from '@nestjs/common'
import { Resend } from 'resend'
import envConfig from 'src/shared/config'
import * as React from 'react'
import fs from 'fs'
import path from 'path'
import { OTPEmail } from 'emails/otp'

// readFile thường thì nó sẽ trả về một promise, readFileSync thì nó mới đọc được utf-8
// const otpTemplate = fs.readFileSync(path.resolve('src/shared/email-templates/otp.html'), {
//   encoding: 'utf-8',
// })

@Injectable()
export class EmailService {
  private resend: Resend
  constructor() {
    // Khai báo apiKey cho resend
    this.resend = new Resend(envConfig.RESEND_API_KEY)
  }

  async sendOTP(payload: { email: string; code: string }) {
    // Do đang ở môi trường sandbox nên chỉ có thể đăng kí tài khoản được ở cái email đã đăng kí rồi mà thôi
    // Muốn gửi được tới các thằng khác thì cần phải verify domain của chúng ta thì mới gửi được
    // Muốn mà lấy được cái data và error khi mà gửi đi thì ở bên đây cần phải return về cái object mail như này

    // Ở đây có thể sử dụng hàm render để mà tạo ra cái html cho email
    const subject = 'Mã OTP dùng để xác thực'
    return this.resend.emails.send({
      from: 'docongnghe <no-reply@codeui.io.vn>',
      to: [payload.email],
      subject,
      react: <OTPEmail otpCode={payload.code} title={subject} />,
      // html: otpTemplate.replaceAll('{{code}}', payload.code).replaceAll('{{subject}}', subject),
    })
  }
}
