import { Module } from '@nestjs/common'
import { ChatGateway } from 'src/websockets/chat.gateway'
import { PaymentGateway } from 'src/websockets/payment.gateway'
import { EnhancedChatGateway } from 'src/websockets/enhanced-chat.gateway'

// Import chat module
import { ChatModule } from './chat.module'

@Module({
  imports: [ChatModule],
  providers: [ChatGateway, PaymentGateway, EnhancedChatGateway],
})
export class WebsocketModule {}
