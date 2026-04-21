import { BullModule } from '@nestjs/bullmq'
import { Module } from '@nestjs/common'
import { WishlistController } from 'src/routes/wishlist/wishlist.controller'
import { WishlistProducer } from 'src/routes/wishlist/wishlist.producer'
import { WishlistRepo } from 'src/routes/wishlist/wishlist.repo'
import { WishlistService } from 'src/routes/wishlist/wishlist.service'
import { WISHLIST_QUEUE_NAME } from 'src/shared/constants/queue.constant'

@Module({
  imports: [
    BullModule.registerQueue({
      name: WISHLIST_QUEUE_NAME,
    }),
  ],
  providers: [WishlistService, WishlistRepo, WishlistProducer],
  controllers: [WishlistController],
  exports: [
    WishlistService,
    WishlistRepo,
    WishlistProducer,
    BullModule, // Export BullModule để các module khác có thể inject queue
  ],
})
export class WishlistModule {}
