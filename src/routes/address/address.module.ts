import { Module } from '@nestjs/common'
import { AddressController } from './address.controller'
import { AddressService } from './address.service'
import { AddressRepository } from './address.repo'

@Module({
  controllers: [AddressController],
  providers: [AddressService, AddressRepository],
  exports: [AddressService, AddressRepository],
})
export class AddressModule {}
