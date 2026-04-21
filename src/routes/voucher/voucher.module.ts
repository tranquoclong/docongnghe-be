import { Module } from '@nestjs/common'
import { VoucherController } from './voucher.controller'
import { VoucherService } from './voucher.service'
import { VoucherRepository } from './voucher.repo'

@Module({
  controllers: [VoucherController],
  providers: [VoucherService, VoucherRepository],
  exports: [VoucherService, VoucherRepository],
})
export class VoucherModule {}
