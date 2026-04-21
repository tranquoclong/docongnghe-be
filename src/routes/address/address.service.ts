import { Injectable, HttpException } from '@nestjs/common'
import { Address } from '@prisma/client'
import { AddressRepository } from './address.repo'
import { CreateAddressBody, UpdateAddressBody, ListAddressesQuery } from './address.dto'
import { AddressResponse, AddressStatsResponse } from './address.model'
import { ADDRESS_ERRORS } from './address.error'

@Injectable()
export class AddressService {
  constructor(private readonly addressRepository: AddressRepository) {}

  // Tạo địa chỉ mới
  async createAddress(userId: number, data: CreateAddressBody): Promise<AddressResponse> {
    // Kiểm tra giới hạn số lượng địa chỉ (tối đa 10)
    const count = await this.addressRepository.countByUser(userId)
    if (count >= 10) {
      throw new HttpException(ADDRESS_ERRORS.MAX_ADDRESSES_EXCEEDED, 400)
    }

    // Nếu là địa chỉ đầu tiên, tự động set làm default
    if (count === 0) {
      data.isDefault = true
    }

    // Validate address data (có thể tích hợp API kiểm tra địa chỉ thật ở đây)
    this.validateAddressData(data)

    const address = await this.addressRepository.create(userId, data)
    return this.formatAddressResponse(address)
  }

  // Cập nhật địa chỉ
  async updateAddress(id: number, userId: number, data: UpdateAddressBody): Promise<AddressResponse> {
    // Kiểm tra địa chỉ có tồn tại và thuộc về user không
    const existingAddress = await this.addressRepository.findById(id, userId)
    if (!existingAddress) {
      throw new HttpException(ADDRESS_ERRORS.ADDRESS_NOT_FOUND, 404)
    }

    // Validate dữ liệu nếu có update
    if (
      Object.keys(data).some((key) =>
        ['provinceId', 'provinceName', 'districtId', 'districtName', 'wardId', 'wardName'].includes(key),
      )
    ) {
      const mergedData = { ...existingAddress, ...data }
      this.validateAddressData(mergedData as CreateAddressBody)
    }

    const updatedAddress = await this.addressRepository.update(id, userId, data)
    return this.formatAddressResponse(updatedAddress)
  }

  // Lấy chi tiết địa chỉ
  async getAddressDetail(id: number, userId: number): Promise<AddressResponse> {
    const address = await this.addressRepository.findById(id, userId)
    if (!address) {
      throw new HttpException(ADDRESS_ERRORS.ADDRESS_NOT_FOUND, 404)
    }

    return this.formatAddressResponse(address)
  }

  // Lấy danh sách địa chỉ
  async getAddresses(userId: number, query: ListAddressesQuery) {
    const result = await this.addressRepository.findMany(userId, query)

    return {
      data: result.data.map((address) => this.formatAddressResponse(address)),
      pagination: {
        page: result.page,
        limit: result.limit,
        total: result.total,
        totalPages: Math.ceil(result.total / result.limit),
      },
    }
  }

  // Xóa địa chỉ
  async deleteAddress(id: number, userId: number): Promise<{ message: string }> {
    // Kiểm tra địa chỉ có tồn tại
    const address = await this.addressRepository.findById(id, userId)
    if (!address) {
      throw new HttpException(ADDRESS_ERRORS.ADDRESS_NOT_FOUND, 404)
    }

    // Không cho phép xóa địa chỉ mặc định
    if (address.isDefault) {
      throw new HttpException(ADDRESS_ERRORS.CANNOT_DELETE_DEFAULT_ADDRESS, 400)
    }

    await this.addressRepository.delete(id, userId)
    return { message: 'Xóa địa chỉ thành công' }
  }

  // Đặt địa chỉ mặc định
  async setDefaultAddress(id: number, userId: number): Promise<AddressResponse> {
    // Kiểm tra địa chỉ có tồn tại và hoạt động
    const address = await this.addressRepository.findById(id, userId)
    if (!address) {
      throw new HttpException(ADDRESS_ERRORS.ADDRESS_NOT_FOUND, 404)
    }

    if (!address.isActive) {
      throw new HttpException(ADDRESS_ERRORS.CANNOT_SET_INACTIVE_AS_DEFAULT, 400)
    }

    const updatedAddress = await this.addressRepository.setDefault(id, userId)
    return this.formatAddressResponse(updatedAddress!)
  }

  // Lấy thống kê địa chỉ
  async getAddressStats(userId: number): Promise<AddressStatsResponse> {
    const [total, defaultAddress] = await Promise.all([
      this.addressRepository.countByUser(userId),
      this.addressRepository.findDefault(userId),
    ])

    return {
      total,
      defaultAddress: defaultAddress
        ? {
            id: defaultAddress.id,
            name: defaultAddress.name,
            phone: defaultAddress.phone,
            fullAddress: defaultAddress.fullAddress,
            isDefault: defaultAddress.isDefault,
          }
        : undefined,
    }
  }

  // Lấy địa chỉ mặc định
  async getDefaultAddress(userId: number): Promise<AddressResponse | null> {
    const address = await this.addressRepository.findDefault(userId)
    return address ? this.formatAddressResponse(address) : null
  }

  // Private helper methods
  private validateAddressData(data: CreateAddressBody): void {
    // Ở đây có thể thêm logic validate với API bên thứ 3
    // VD: Kiểm tra provinceId có hợp lệ không, districtId có thuộc province không, etc.

    // Hiện tại chỉ validate cơ bản
    if (!data.provinceId || !data.districtId || !data.wardId) {
      throw new HttpException(ADDRESS_ERRORS.INVALID_ADDRESS_DATA, 400)
    }

    // Validate phone number format (simple Vietnamese phone validation)
    const phoneRegex = /^(0|\+84)(3|5|7|8|9)[0-9]{8}$/
    if (!phoneRegex.test(data.phone.replace(/\s/g, ''))) {
      throw new HttpException(
        {
          message: 'Số điện thoại không đúng định dạng',
          statusCode: 400,
          errorCode: 'INVALID_PHONE_FORMAT',
        },
        400,
      )
    }
  }

  private formatAddressResponse(address: Address): AddressResponse {
    return {
      id: address.id,
      userId: address.userId,
      name: address.name,
      phone: address.phone,
      provinceId: address.provinceId,
      provinceName: address.provinceName,
      districtId: address.districtId,
      districtName: address.districtName,
      wardId: address.wardId,
      wardName: address.wardName,
      detail: address.detail,
      fullAddress: address.fullAddress,
      isDefault: address.isDefault,
      isActive: address.isActive,
      createdAt: address.createdAt instanceof Date ? address.createdAt.toISOString() : String(address.createdAt),
      updatedAt: address.updatedAt instanceof Date ? address.updatedAt.toISOString() : String(address.updatedAt),
    }
  }
}
