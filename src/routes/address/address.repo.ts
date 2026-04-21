import { Injectable } from '@nestjs/common'
import { PrismaService } from '../../shared/services/prisma.service'
import { Prisma } from '@prisma/client'
import { ListAddressesQuery, CreateAddressBody, UpdateAddressBody } from './address.dto'
import { SerializeAll } from 'src/shared/decorators/serialize.decorator'

@Injectable()
@SerializeAll()
export class AddressRepository {
  constructor(private readonly prismaService: PrismaService) {}

  // Tạo địa chỉ mới
  async create(userId: number, data: CreateAddressBody) {
    // Tạo fullAddress từ các components
    const fullAddress = `${data.detail}, ${data.wardName}, ${data.districtName}, ${data.provinceName}`

    // Nếu isDefault = true, cần unset default cho các địa chỉ khác
    if (data.isDefault) {
      await this.prismaService.address.updateMany({
        where: { userId, isDefault: true },
        data: { isDefault: false },
      })
    }

    return this.prismaService.address.create({
      data: {
        userId,
        name: data.name,
        phone: data.phone,
        provinceId: data.provinceId,
        provinceName: data.provinceName,
        districtId: data.districtId,
        districtName: data.districtName,
        wardId: data.wardId,
        wardName: data.wardName,
        detail: data.detail,
        fullAddress,
        isDefault: data.isDefault,
      },
    })
  }

  // Cập nhật địa chỉ
  async update(id: number, userId: number, data: UpdateAddressBody) {
    const updateData: Prisma.AddressUpdateInput = {}

    if (data.name !== undefined) updateData.name = data.name
    if (data.phone !== undefined) updateData.phone = data.phone
    if (data.provinceId !== undefined) updateData.provinceId = data.provinceId
    if (data.provinceName !== undefined) updateData.provinceName = data.provinceName
    if (data.districtId !== undefined) updateData.districtId = data.districtId
    if (data.districtName !== undefined) updateData.districtName = data.districtName
    if (data.wardId !== undefined) updateData.wardId = data.wardId
    if (data.wardName !== undefined) updateData.wardName = data.wardName
    if (data.detail !== undefined) updateData.detail = data.detail

    // Cập nhật fullAddress nếu có thay đổi địa chỉ
    if (data.detail || data.wardName || data.districtName || data.provinceName) {
      const current = await this.findById(id, userId)
      if (current) {
        const detail = data.detail ?? current.detail
        const wardName = data.wardName ?? current.wardName
        const districtName = data.districtName ?? current.districtName
        const provinceName = data.provinceName ?? current.provinceName
        updateData.fullAddress = `${detail}, ${wardName}, ${districtName}, ${provinceName}`
      }
    }

    // Xử lý isDefault
    if (data.isDefault === true) {
      await this.prismaService.address.updateMany({
        where: { userId, isDefault: true, id: { not: id } },
        data: { isDefault: false },
      })
      updateData.isDefault = true
    } else if (data.isDefault === false) {
      updateData.isDefault = false
    }

    return this.prismaService.address.update({
      where: { id, userId },
      data: updateData,
    })
  }

  // Tìm địa chỉ theo ID và userId
  findById(id: number, userId: number) {
    return this.prismaService.address.findFirst({
      where: { id, userId, isActive: true },
    })
  }

  // Lấy danh sách địa chỉ
  async findMany(userId: number, query: ListAddressesQuery) {
    const { page = 1, limit = 10, isActive, search } = query
    const offset = (page - 1) * limit

    const where: Prisma.AddressWhereInput = {
      userId,
      ...(isActive !== undefined && { isActive }),
      ...(search && {
        OR: [
          { name: { contains: search, mode: 'insensitive' } },
          { phone: { contains: search, mode: 'insensitive' } },
          { fullAddress: { contains: search, mode: 'insensitive' } },
        ],
      }),
    }

    const [data, total] = await Promise.all([
      this.prismaService.address.findMany({
        where,
        orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
        skip: offset,
        take: limit,
      }),
      this.prismaService.address.count({ where }),
    ])

    return { data, total, page, limit }
  }

  // Xóa địa chỉ (soft delete bằng cách set isActive = false)
  delete(id: number, userId: number) {
    return this.prismaService.address.update({
      where: { id, userId },
      data: { isActive: false },
    })
  }

  // Hard delete địa chỉ
  hardDelete(id: number, userId: number) {
    return this.prismaService.address.delete({
      where: { id, userId },
    })
  }

  // Đặt địa chỉ mặc định
  async setDefault(id: number, userId: number) {
    await this.prismaService.$transaction([
      // Unset tất cả default addresses
      this.prismaService.address.updateMany({
        where: { userId, isDefault: true },
        data: { isDefault: false },
      }),
      // Set address này làm default
      this.prismaService.address.update({
        where: { id, userId },
        data: { isDefault: true },
      }),
    ])

    return this.findById(id, userId)
  }

  // Lấy địa chỉ mặc định
  findDefault(userId: number) {
    return this.prismaService.address.findFirst({
      where: { userId, isDefault: true, isActive: true },
    })
  }

  // Đếm số lượng địa chỉ của user
  countByUser(userId: number) {
    return this.prismaService.address.count({
      where: { userId, isActive: true },
    })
  }

  // Kiểm tra xem có phải địa chỉ mặc định không
  async isDefaultAddress(id: number, userId: number): Promise<boolean> {
    const address = await this.prismaService.address.findFirst({
      where: { id, userId, isDefault: true, isActive: true },
    })
    return !!address
  }
}
