import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards, HttpStatus } from '@nestjs/common'
import { AddressService } from './address.service'
import { ActiveUser } from '../../shared/decorators/active-user.decorator'
import { Auth } from '../../shared/decorators/auth.decorator'
import { AuthType } from '../../shared/constants/auth.constant'
import ZodValidationPipe from '../../shared/pipes/custom-zod-validation.pipe'
import {
  CreateAddressBodySchema,
  CreateAddressBody,
  CreateAddressResponse,
  UpdateAddressParamsSchema,
  UpdateAddressParams,
  UpdateAddressBodySchema,
  UpdateAddressBody,
  UpdateAddressResponse,
  GetAddressDetailParamsSchema,
  GetAddressDetailParams,
  GetAddressDetailResponse,
  ListAddressesQuerySchema,
  ListAddressesQuery,
  ListAddressesResponse,
  DeleteAddressParamsSchema,
  DeleteAddressParams,
  DeleteAddressResponse,
  SetDefaultAddressParamsSchema,
  SetDefaultAddressParams,
  SetDefaultAddressResponse,
  GetAddressStatsResponse,
} from './address.dto'

@Controller('addresses')
@Auth([AuthType.Bearer])
export class AddressController {
  constructor(private readonly addressService: AddressService) {}

  // Tạo địa chỉ mới
  @Post()
  async createAddress(
    @ActiveUser('userId') userId: number,
    @Body(new ZodValidationPipe(CreateAddressBodySchema)) body: CreateAddressBody,
  ): Promise<CreateAddressResponse> {
    const data = await this.addressService.createAddress(userId, body)
    return { data }
  }

  // Lấy danh sách địa chỉ
  @Get()
  async getAddresses(
    @ActiveUser('userId') userId: number,
    @Query(new ZodValidationPipe(ListAddressesQuerySchema)) query: ListAddressesQuery,
  ): Promise<ListAddressesResponse> {
    const result = await this.addressService.getAddresses(userId, query)
    return {
      data: result.data,
      pagination: result.pagination,
    }
  }

  // Lấy thống kê địa chỉ
  @Get('stats')
  async getAddressStats(@ActiveUser('userId') userId: number): Promise<GetAddressStatsResponse> {
    const data = await this.addressService.getAddressStats(userId)
    return { data }
  }

  // Lấy địa chỉ mặc định
  @Get('default')
  async getDefaultAddress(@ActiveUser('userId') userId: number): Promise<GetAddressDetailResponse | { data: null }> {
    const data = await this.addressService.getDefaultAddress(userId)
    return { data }
  }

  // Lấy chi tiết địa chỉ
  @Get(':id')
  async getAddressDetail(
    @ActiveUser('userId') userId: number,
    @Param(new ZodValidationPipe(GetAddressDetailParamsSchema)) params: GetAddressDetailParams,
  ): Promise<GetAddressDetailResponse> {
    const data = await this.addressService.getAddressDetail(params.id, userId)
    return { data }
  }

  // Cập nhật địa chỉ
  @Put(':id')
  async updateAddress(
    @ActiveUser('userId') userId: number,
    @Param(new ZodValidationPipe(UpdateAddressParamsSchema)) params: UpdateAddressParams,
    @Body(new ZodValidationPipe(UpdateAddressBodySchema)) body: UpdateAddressBody,
  ): Promise<UpdateAddressResponse> {
    const data = await this.addressService.updateAddress(params.id, userId, body)
    return { data }
  }

  // Đặt địa chỉ mặc định
  @Put(':id/default')
  async setDefaultAddress(
    @ActiveUser('userId') userId: number,
    @Param(new ZodValidationPipe(SetDefaultAddressParamsSchema)) params: SetDefaultAddressParams,
  ): Promise<SetDefaultAddressResponse> {
    const data = await this.addressService.setDefaultAddress(params.id, userId)
    return { data }
  }

  // Xóa địa chỉ
  @Delete(':id')
  async deleteAddress(
    @ActiveUser('userId') userId: number,
    @Param(new ZodValidationPipe(DeleteAddressParamsSchema)) params: DeleteAddressParams,
  ): Promise<DeleteAddressResponse> {
    return this.addressService.deleteAddress(params.id, userId)
  }
}
