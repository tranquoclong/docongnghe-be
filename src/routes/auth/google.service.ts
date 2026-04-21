import { Injectable } from '@nestjs/common'
import { google, Auth } from 'googleapis'
import { GoogleAuthStateType } from 'src/routes/auth/auth.model'
import envConfig from 'src/shared/config'
import { AuthRepository } from './auth.repo'
import { HashingService } from '../../shared/services/hashing.service'
// import { RolesService } from 'src/routes/auth/roles.service'
import { v4 as uuidv4 } from 'uuid'
import { AuthService } from 'src/routes/auth/auth.service'
import { GoogleUserInfoError } from 'src/routes/auth/auth.error'
import { SharedRoleRepository } from 'src/shared/repositories/shared-role.repo'

@Injectable()
export class GoogleService {
  private oauth2Client: Auth.OAuth2Client
  constructor(
    private readonly authRepository: AuthRepository,
    private readonly hashingService: HashingService,
    private readonly sharedRoleRepository: SharedRoleRepository,
    private readonly authService: AuthService,
  ) {
    // Thì nó sẽ nhận vào clientId clientSecret và RedirectUri, truyền vào đúng thứ tự cho nó là được
    this.oauth2Client = new google.auth.OAuth2(
      envConfig.GOOGLE_CLIENT_ID,
      envConfig.GOOGLE_CLIENT_SECRET,
      envConfig.GOOGLE_REDIRECT_URI,
    )
  }

  getAuthorizationUrl({ userAgent, ip }: GoogleAuthStateType) {
    // Khai báo phạm vi truy cập vào thông tin tài khoản của người dùng
    const scope = ['https://www.googleapis.com/auth/userinfo.profile', 'https://www.googleapis.com/auth/userinfo.email']
    // Sẽ tạo cái string từ userAgent và ip để đưa vào URL -> chuyển nó thành base64 để bảo mật, an toàn có thể bỏ lên URL
    const stateString = Buffer.from(JSON.stringify({ userAgent, ip })).toString('base64')
    const url = this.oauth2Client.generateAuthUrl({
      access_type: 'offline', // để là offline
      scope,
      include_granted_scopes: true, // để mà trả về refreshToken
      // Cái state trên URL chính là cái state string của chúng ta, chúng ta đã chuyển từ object sang base64 -> Thì như thế này nó mới không bị lỗi URL được
      state: stateString, // để đảm bảo user chỉ truy cập vào đây khi chúng ta đã xác nhận từ google
    })

    return {
      url,
    }
  }

  async googleCallback({ code, state }: { code: string; state: string }) {
    try {
      // Phòng cái trường hợp mà chúng ta không lấy ra được cái userAgent và Ip ra từ trong cái state này
      let userAgent = 'unknown'
      let ip = 'unknown'
      // 1. Lấy từ state từ URL
      try {
        //  Tại sao chúng ta cần phải try-catch cái đoạn này bởi vì chúng ta chưa chắc cái base64 này nó chính xác lỡ như mà nó thiếu xót một vài kí tự nào đó đi(không có gì đảm bảo được là cái URL nó sẽ chính xác)
        if (state) {
          // chuyển từ dạng base64 về dạng JSON rồi parse ra lại thành object
          const clientInfo = JSON.parse(Buffer.from(state, 'base64').toString()) as GoogleAuthStateType
          userAgent = clientInfo.userAgent
          ip = clientInfo.ip
        }
      } catch (error) {
        console.error('Error parsing state:', error)
      }
      // 2. Dùng code để mà lấy token
      const { tokens } = await this.oauth2Client.getToken(code)
      // sau khi mà lấy ra được cái tokens rồi chúng ta authenticate cho cái oauth2Client
      this.oauth2Client.setCredentials(tokens)

      // 3. Lấy thông tin google của người dùng -> Sau khi authenticate rồi có thể lấy ra được thông tin user(dùng google oauth2 dể lấy ra được oauth2)
      const oauth2 = google.oauth2({
        auth: this.oauth2Client,
        version: 'v2',
      })
      const { data } = await oauth2.userinfo.get() // Lấy ra userinfo
      if (!data.email) {
        throw GoogleUserInfoError
      }

      let user = await this.authRepository.findUniqueUserIncludeRole({
        email: data.email,
      })
      // Nếu không có User tức là người mới, vậy nên sẽ tiến hành đăng ký
      if (!user) {
        const clientRoleId = await this.sharedRoleRepository.getClientRoleId()
        const randomPassword = uuidv4()
        const hashedPassword = await this.hashingService.hash(randomPassword) // Tạo mật khẩu mặc định cho người đùng

        // Gán lại user cho người dùng(Và chúng ta cũng đã tạo lại kiểu UserIncludeRole nên là nó không còn bị lỗi type nữa).
        user = await this.authRepository.createUserIncludeRole({
          email: data.email,
          name: data.name ?? '',
          phoneNumber: '0988888888',
          password: hashedPassword,
          roleId: clientRoleId,
          avatar: data.picture ?? null,
        })
      }
      // tiến hành tạo device
      const device = await this.authRepository.createDevice({
        userId: user.id,
        userAgent,
        ip,
      })

      // Tiền hành tạo tokens
      // Nếu ban đầu không lấy ra user bao gồm cả role thì không lấy ra được cái roleName
      const authTokens = await this.authService.generateTokens({
        userId: user.id,
        roleId: user.roleId,
        deviceId: device.id,
        roleName: user.role.name,
      })

      return authTokens
    } catch (error) {
      console.error('Error in google callback:', error)
      throw error
    }
  }
}
