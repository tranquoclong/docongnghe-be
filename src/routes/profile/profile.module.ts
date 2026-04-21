import { Module } from '@nestjs/common'
import { ProfileController } from 'src/routes/profile/profile.controller'
import { ProfileService } from 'src/routes/profile/profile.service'

@Module({
  imports: [],
  providers: [ProfileService],
  controllers: [ProfileController],
  exports: [ProfileService],
})
export class ProfileModule {}
