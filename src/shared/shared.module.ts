import { Global, Module } from '@nestjs/common'
import { PrismaService } from 'src/shared/services/prisma.service'
import { HashingService } from './services/hashing.service'
import { TokenService } from './services/token.service'
import { JwtModule } from '@nestjs/jwt'
import { AccessTokenGuard } from 'src/shared/guards/access-token.guard'
import { AuthenticationGuard } from 'src/shared/guards/authentication.guard'
import { SharedUserRepository } from 'src/shared/repositories/shared-user.repo'
import { EmailService } from 'src/shared/services/email.service'
import { TwoFactorService } from 'src/shared/services/2fa.service'
import { SharedRoleRepository } from 'src/shared/repositories/shared-role.repo'
import { S3Service } from 'src/shared/services/s3.service'
import { SharedWebsocketRepository } from 'src/shared/repositories/shared-websocket.repo'
import { PaymentAPIKeyGuard } from 'src/shared/guards/payment-api-key.guard'
import { SharedPaymentRepository } from 'src/shared/repositories/shared-payment.repo'

const sharedServices = [
  PrismaService,
  HashingService,
  TokenService,
  SharedUserRepository,
  EmailService,
  TwoFactorService,
  S3Service,
  SharedRoleRepository,
  SharedWebsocketRepository,
  SharedPaymentRepository,
]

// Module này được coi là import toàn cục rồi, nên là những cái  Service shared chung thì chỉ cần import vào trong đây là được
@Global()
@Module({
  providers: [
    ...sharedServices,
    // 2 thằng Guard này cần phải được khai báo để mà sử dụng được ở bên trong AuthenticationGuard
    AccessTokenGuard,
    PaymentAPIKeyGuard,
    // AuthenticationGuard được export để AppModule có thể đăng ký làm APP_GUARD
    AuthenticationGuard,
  ],
  exports: [...sharedServices, AccessTokenGuard, PaymentAPIKeyGuard, AuthenticationGuard],
  imports: [JwtModule],
})
export class SharedModule {}
