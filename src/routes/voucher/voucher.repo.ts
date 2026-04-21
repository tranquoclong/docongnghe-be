import { Injectable } from '@nestjs/common'
import { PrismaService } from '../../shared/services/prisma.service'
import { Prisma } from '@prisma/client'
import {
  CreateVoucherBody,
  UpdateVoucherBody,
  ListVouchersQuery,
  ListAvailableVouchersQuery,
  ListMyVouchersQuery,
  ApplyVoucherBody,
} from './voucher.dto'
import { SerializeAll } from 'src/shared/decorators/serialize.decorator'

@Injectable()
@SerializeAll()
export class VoucherRepository {
  constructor(private readonly prismaService: PrismaService) {}

  // ===== VOUCHER CRUD =====

  // Tạo voucher mới
  create(data: CreateVoucherBody, createdById?: number, sellerId?: number) {
    return this.prismaService.voucher.create({
      data: {
        ...data,
        createdById,
        sellerId,
      },
    })
  }

  // Cập nhật voucher
  update(id: number, data: UpdateVoucherBody, updatedById?: number) {
    return this.prismaService.voucher.update({
      where: { id, deletedAt: null },
      data: {
        ...data,
        updatedById,
      },
    })
  }

  // Tìm voucher theo ID
  findById(id: number) {
    return this.prismaService.voucher.findFirst({
      where: { id, deletedAt: null },
    })
  }

  // Tìm voucher theo code
  findByCode(code: string) {
    return this.prismaService.voucher.findFirst({
      where: { code, deletedAt: null },
    })
  }

  // Kiểm tra code đã tồn tại chưa
  async isCodeExists(code: string, excludeId?: number) {
    const where: Prisma.VoucherWhereInput = {
      code,
      deletedAt: null,
    }

    if (excludeId) {
      where.id = { not: excludeId }
    }

    const voucher = await this.prismaService.voucher.findFirst({ where })
    return !!voucher
  }

  // Xóa voucher (soft delete)
  delete(id: number, deletedById?: number) {
    return this.prismaService.voucher.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        deletedById,
      },
    })
  }

  // ===== VOUCHER LISTING =====

  // Lấy danh sách voucher (admin/seller management)
  async findMany(query: ListVouchersQuery, sellerId?: number) {
    const { page = 1, limit = 10, type, isActive, search, startDate, endDate } = query
    const offset = (page - 1) * limit

    const where: Prisma.VoucherWhereInput = {
      deletedAt: null,
      ...(type && { type }),
      ...(isActive !== undefined && { isActive }),
      ...(sellerId !== undefined && { sellerId }),
      ...(search && {
        OR: [
          { code: { contains: search, mode: 'insensitive' } },
          { name: { contains: search, mode: 'insensitive' } },
          { description: { contains: search, mode: 'insensitive' } },
        ],
      }),
      ...(startDate && { startDate: { gte: startDate } }),
      ...(endDate && { endDate: { lte: endDate } }),
    }

    const [data, total] = await Promise.all([
      this.prismaService.voucher.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: offset,
        take: limit,
      }),
      this.prismaService.voucher.count({ where }),
    ])

    return { data, total, page, limit }
  }

  // Lấy danh sách voucher available (public)
  async findAvailable(query: ListAvailableVouchersQuery, userId?: number) {
    const { page = 1, limit = 10, type, minValue, maxValue, sellerId, search } = query
    const offset = (page - 1) * limit
    const now = new Date()

    const where: Prisma.VoucherWhereInput = {
      deletedAt: null,
      isActive: true,
      startDate: { lte: now },
      endDate: { gte: now },
      ...(type && { type }),
      ...(minValue && { value: { gte: minValue } }),
      ...(maxValue && { value: { lte: maxValue } }),
      ...(sellerId !== undefined && { sellerId }),
      ...(search && {
        OR: [
          { code: { contains: search, mode: 'insensitive' } },
          { name: { contains: search, mode: 'insensitive' } },
          { description: { contains: search, mode: 'insensitive' } },
        ],
      }),
      // Chỉ lấy voucher còn lượt sử dụng
      OR: [{ usageLimit: null }, { usageLimit: { gt: this.prismaService.voucher.fields.usedCount } }],
    }

    const [vouchers, total] = await Promise.all([
      this.prismaService.voucher.findMany({
        where,
        include: {
          userVouchers: userId
            ? {
                where: { userId },
              }
            : false,
        },
        orderBy: [
          { endDate: 'asc' }, // Sắp xếp theo voucher sắp hết hạn trước
          { createdAt: 'desc' },
        ],
        skip: offset,
        take: limit,
      }),
      this.prismaService.voucher.count({ where }),
    ])

    return { data: vouchers, total, page, limit }
  }

  // ===== USER VOUCHER OPERATIONS =====

  // Lưu voucher cho user
  collectVoucher(userId: number, voucherId: number) {
    return this.prismaService.userVoucher.create({
      data: {
        userId,
        voucherId,
      },
      include: {
        voucher: true,
      },
    })
  }

  // Kiểm tra user đã lưu voucher chưa
  async isVoucherCollected(userId: number, voucherId: number) {
    const userVoucher = await this.prismaService.userVoucher.findUnique({
      where: {
        userId_voucherId: { userId, voucherId },
      },
    })
    return !!userVoucher
  }

  // Lấy user voucher
  findUserVoucher(userId: number, voucherId: number) {
    return this.prismaService.userVoucher.findUnique({
      where: {
        userId_voucherId: { userId, voucherId },
      },
      include: {
        voucher: true,
      },
    })
  }

  // Lấy danh sách voucher của user
  async findMyVouchers(userId: number, query: ListMyVouchersQuery) {
    const { page = 1, limit = 10, type, status, search } = query
    const offset = (page - 1) * limit
    const now = new Date()

    const voucherWhere: Prisma.VoucherWhereInput = {
      deletedAt: null,
      ...(type && { type }),
      ...(search && {
        OR: [{ code: { contains: search, mode: 'insensitive' } }, { name: { contains: search, mode: 'insensitive' } }],
      }),
    }

    // Filter theo status
    if (status === 'expired') {
      voucherWhere.endDate = { lt: now }
    } else if (status === 'available') {
      voucherWhere.isActive = true
      voucherWhere.startDate = { lte: now }
      voucherWhere.endDate = { gte: now }
    } else if (status === 'used') {
      // Sẽ filter sau khi lấy data vì cần check usedCount
    }

    const where: Prisma.UserVoucherWhereInput = {
      userId,
      voucher: voucherWhere,
    }

    const [userVouchers, total] = await Promise.all([
      this.prismaService.userVoucher.findMany({
        where,
        include: {
          voucher: true,
        },
        orderBy: { savedAt: 'desc' },
        skip: offset,
        take: limit,
      }),
      this.prismaService.userVoucher.count({ where }),
    ])

    // Filter theo used status nếu cần
    let filteredData = userVouchers
    if (status === 'used') {
      filteredData = userVouchers.filter(
        (uv) => uv.voucher.userUsageLimit !== null && uv.usedCount >= uv.voucher.userUsageLimit,
      )
    } else if (status === 'available') {
      filteredData = userVouchers.filter(
        (uv) => uv.voucher.userUsageLimit === null || uv.usedCount < uv.voucher.userUsageLimit,
      )
    }

    return { data: filteredData, total, page, limit }
  }

  // ===== VOUCHER APPLICATION =====

  // Kiểm tra voucher có thể áp dụng không
  async canApplyVoucher(userId: number, code: string, orderAmount: number, productIds: number[] = []) {
    const voucher = await this.findByCode(code)
    if (!voucher) return { canApply: false, reason: 'Voucher không tồn tại' }

    const now = new Date()

    // Kiểm tra voucher active
    if (!voucher.isActive) {
      return { canApply: false, reason: 'Voucher đã bị vô hiệu hóa' }
    }

    // Kiểm tra thời gian
    if (voucher.startDate > now) {
      return { canApply: false, reason: 'Voucher chưa có hiệu lực' }
    }
    if (voucher.endDate < now) {
      return { canApply: false, reason: 'Voucher đã hết hạn' }
    }

    // Kiểm tra usage limit
    if (voucher.usageLimit && voucher.usedCount >= voucher.usageLimit) {
      return { canApply: false, reason: 'Voucher đã hết lượt sử dụng' }
    }

    // Kiểm tra user đã lưu voucher chưa
    const userVoucher = await this.findUserVoucher(userId, voucher.id)
    if (!userVoucher) {
      return { canApply: false, reason: 'Bạn chưa lưu voucher này' }
    }

    // Kiểm tra user usage limit
    if (voucher.userUsageLimit && userVoucher.usedCount >= voucher.userUsageLimit) {
      return { canApply: false, reason: 'Bạn đã sử dụng hết lượt voucher này' }
    }

    // Kiểm tra giá trị đơn hàng tối thiểu
    if (voucher.minOrderValue && orderAmount < voucher.minOrderValue) {
      return {
        canApply: false,
        reason: `Đơn hàng tối thiểu ${voucher.minOrderValue.toLocaleString('vi-VN')}đ`,
      }
    }

    // Kiểm tra sản phẩm áp dụng
    if (voucher.applicableProducts.length > 0) {
      const hasApplicableProduct = productIds.some((id) => voucher.applicableProducts.includes(id))
      if (!hasApplicableProduct) {
        return { canApply: false, reason: 'Sản phẩm không áp dụng voucher này' }
      }
    }

    // Kiểm tra sản phẩm loại trừ
    if (voucher.excludedProducts.length > 0) {
      const hasExcludedProduct = productIds.some((id) => voucher.excludedProducts.includes(id))
      if (hasExcludedProduct) {
        return { canApply: false, reason: 'Đơn hàng chứa sản phẩm không được áp dụng voucher' }
      }
    }

    // Tính toán số tiền giảm
    let discountAmount = 0
    if (voucher.type === 'PERCENTAGE') {
      discountAmount = (orderAmount * voucher.value) / 100
      if (voucher.maxDiscount && discountAmount > voucher.maxDiscount) {
        discountAmount = voucher.maxDiscount
      }
    } else if (voucher.type === 'FIXED_AMOUNT') {
      discountAmount = Math.min(voucher.value, orderAmount)
    } else if (voucher.type === 'FREE_SHIPPING') {
      discountAmount = voucher.value // Giá trị = phí ship
    }

    return {
      canApply: true,
      discountAmount: Math.round(discountAmount),
      voucher,
    }
  }

  // Sử dụng voucher (increment usage count)
  async useVoucher(userId: number, voucherId: number) {
    await this.prismaService.$transaction([
      // Tăng usedCount của voucher
      this.prismaService.voucher.update({
        where: { id: voucherId },
        data: { usedCount: { increment: 1 } },
      }),
      // Tăng usedCount của user voucher
      this.prismaService.userVoucher.update({
        where: {
          userId_voucherId: { userId, voucherId },
        },
        data: {
          usedCount: { increment: 1 },
          usedAt: new Date(),
        },
      }),
    ])
  }

  // ===== STATS =====

  // Thống kê voucher của user
  async getUserVoucherStats(userId: number) {
    const now = new Date()

    const [collected, used, expired] = await Promise.all([
      // Tổng số voucher đã lưu
      this.prismaService.userVoucher.count({
        where: { userId },
      }),
      // Số voucher đã sử dụng
      this.prismaService.userVoucher.count({
        where: {
          userId,
          usedCount: { gt: 0 },
        },
      }),
      // Số voucher đã hết hạn
      this.prismaService.userVoucher.count({
        where: {
          userId,
          voucher: {
            endDate: { lt: now },
          },
        },
      }),
    ])

    // Số voucher khả dụng - cần query riêng vì Prisma không support field comparison
    const availableUserVouchers = await this.prismaService.userVoucher.findMany({
      where: {
        userId,
        voucher: {
          isActive: true,
          startDate: { lte: now },
          endDate: { gte: now },
        },
      },
      include: {
        voucher: true,
      },
    })

    const available = availableUserVouchers.filter(
      (uv) => uv.voucher.userUsageLimit === null || uv.usedCount < uv.voucher.userUsageLimit,
    ).length

    return {
      totalVouchers: await this.prismaService.voucher.count({
        where: { deletedAt: null, isActive: true },
      }),
      collectedVouchers: collected,
      usedVouchers: used,
      activeVouchers: available,
    }
  }

  // Thống kê voucher của seller/admin
  async getVoucherStats(sellerId?: number) {
    const where: Prisma.VoucherWhereInput = {
      deletedAt: null,
      ...(sellerId !== undefined && { sellerId }),
    }

    const [total, active, used] = await Promise.all([
      this.prismaService.voucher.count({ where }),
      this.prismaService.voucher.count({
        where: { ...where, isActive: true },
      }),
      this.prismaService.voucher.count({
        where: { ...where, usedCount: { gt: 0 } },
      }),
    ])

    return {
      totalVouchers: total,
      activeVouchers: active,
      usedVouchers: used,
      collectedVouchers: 0, // Có thể tính sau nếu cần
    }
  }
}
