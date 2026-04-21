import { Injectable, HttpException } from '@nestjs/common'
import { VoucherRepository } from './voucher.repo'
import {
  CreateVoucherBody,
  UpdateVoucherBody,
  ListVouchersQuery,
  ListAvailableVouchersQuery,
  ListMyVouchersQuery,
  ApplyVoucherBody,
} from './voucher.dto'
import {
  VoucherResponse,
  VoucherWithUserInfo,
  UserVoucherResponse,
  VoucherStatsResponse,
  VoucherApplicationResult,
} from './voucher.model'
import { VOUCHER_ERRORS } from './voucher.error'

@Injectable()
export class VoucherService {
  constructor(private readonly voucherRepository: VoucherRepository) {}

  // ===== VOUCHER MANAGEMENT (Admin/Seller) =====

  // Tạo voucher mới
  async createVoucher(data: CreateVoucherBody, createdById: number, sellerId?: number): Promise<VoucherResponse> {
    // Kiểm tra code đã tồn tại chưa
    const codeExists = await this.voucherRepository.isCodeExists(data.code)
    if (codeExists) {
      throw new HttpException(VOUCHER_ERRORS.VOUCHER_CODE_EXISTS, 400)
    }

    // Validate business rules
    this.validateVoucherData(data)

    const voucher = await this.voucherRepository.create(data, createdById, sellerId)
    return this.formatVoucherResponse(voucher)
  }

  // Cập nhật voucher
  async updateVoucher(
    id: number,
    data: UpdateVoucherBody,
    updatedById: number,
    sellerId?: number,
  ): Promise<VoucherResponse> {
    // Kiểm tra voucher tồn tại
    const existingVoucher = await this.voucherRepository.findById(id)
    if (!existingVoucher) {
      throw new HttpException(VOUCHER_ERRORS.VOUCHER_NOT_FOUND, 404)
    }

    // Kiểm tra quyền (nếu là seller thì chỉ được edit voucher của mình)
    if (sellerId !== undefined && existingVoucher.sellerId !== sellerId) {
      throw new HttpException(VOUCHER_ERRORS.VOUCHER_ACCESS_DENIED, 403)
    }

    // Không cho phép edit voucher đã được sử dụng một số trường quan trọng
    if (existingVoucher.usedCount > 0) {
      const restrictedFields = ['type', 'value', 'minOrderValue', 'applicableProducts', 'excludedProducts']
      const hasRestrictedChanges = restrictedFields.some((field) => data[field] !== undefined)

      if (hasRestrictedChanges) {
        throw new HttpException(VOUCHER_ERRORS.CANNOT_EDIT_USED_VOUCHER, 400)
      }
    }

    // Validate dữ liệu mới
    if (Object.keys(data).length > 0) {
      const mergedData = { ...existingVoucher, ...data }
      this.validateVoucherData(mergedData as CreateVoucherBody)
    }

    const updatedVoucher = await this.voucherRepository.update(id, data, updatedById)
    return this.formatVoucherResponse(updatedVoucher)
  }

  // Lấy danh sách voucher (management)
  async getVouchers(query: ListVouchersQuery, sellerId?: number) {
    const result = await this.voucherRepository.findMany(query, sellerId)

    return {
      data: result.data.map((voucher) => this.formatVoucherResponse(voucher)),
      pagination: {
        page: result.page,
        limit: result.limit,
        total: result.total,
        totalPages: Math.ceil(result.total / result.limit),
      },
    }
  }

  // Xóa voucher
  async deleteVoucher(id: number, deletedById: number, sellerId?: number): Promise<{ message: string }> {
    const voucher = await this.voucherRepository.findById(id)
    if (!voucher) {
      throw new HttpException(VOUCHER_ERRORS.VOUCHER_NOT_FOUND, 404)
    }

    // Kiểm tra quyền
    if (sellerId !== undefined && voucher.sellerId !== sellerId) {
      throw new HttpException(VOUCHER_ERRORS.VOUCHER_ACCESS_DENIED, 403)
    }

    // Không cho xóa voucher đã được sử dụng
    if (voucher.usedCount > 0) {
      throw new HttpException(VOUCHER_ERRORS.CANNOT_DELETE_USED_VOUCHER, 400)
    }

    await this.voucherRepository.delete(id, deletedById)
    return { message: 'Xóa voucher thành công' }
  }

  // ===== PUBLIC VOUCHER OPERATIONS =====

  // Lấy danh sách voucher available (public)
  async getAvailableVouchers(query: ListAvailableVouchersQuery, userId?: number) {
    const result = await this.voucherRepository.findAvailable(query, userId)

    const data = result.data.map((voucher) => {
      const userVoucher = voucher.userVouchers?.[0]
      const isCollected = !!userVoucher
      const canUse = isCollected && (voucher.userUsageLimit === null || userVoucher.usedCount < voucher.userUsageLimit)

      return {
        ...this.formatVoucherResponse(voucher),
        userVoucher: userVoucher
          ? {
              usedCount: userVoucher.usedCount,
              savedAt: userVoucher.savedAt.toISOString(),
              canUse,
            }
          : null,
        isCollected,
        canApply: canUse,
      }
    })

    return {
      data,
      pagination: {
        page: result.page,
        limit: result.limit,
        total: result.total,
        totalPages: Math.ceil(result.total / result.limit),
      },
    }
  }

  // Lấy chi tiết voucher
  async getVoucherDetail(id: number, userId?: number): Promise<VoucherWithUserInfo> {
    const voucher = await this.voucherRepository.findById(id)
    if (!voucher) {
      throw new HttpException(VOUCHER_ERRORS.VOUCHER_NOT_FOUND, 404)
    }

    let userVoucherInfo: { usedCount: number; savedAt: string; canUse: boolean } | null = null
    let isCollected = false
    let canApply = false

    if (userId) {
      const userVoucher = await this.voucherRepository.findUserVoucher(userId, id)
      if (userVoucher) {
        isCollected = true
        canApply = voucher.userUsageLimit === null || userVoucher.usedCount < voucher.userUsageLimit

        userVoucherInfo = {
          usedCount: userVoucher.usedCount,
          savedAt: userVoucher.savedAt.toISOString(),
          canUse: canApply,
        }
      }
    }

    return {
      ...this.formatVoucherResponse(voucher),
      userVoucher: userVoucherInfo,
      isCollected,
      canApply,
    }
  }

  // Lấy voucher theo code
  async getVoucherByCode(code: string, userId?: number): Promise<VoucherWithUserInfo> {
    const voucher = await this.voucherRepository.findByCode(code)
    if (!voucher) {
      throw new HttpException(VOUCHER_ERRORS.VOUCHER_CODE_NOT_FOUND, 404)
    }

    return this.getVoucherDetail(voucher.id, userId)
  }

  // ===== USER VOUCHER OPERATIONS =====

  // Lưu voucher
  async collectVoucher(userId: number, voucherId: number): Promise<UserVoucherResponse> {
    // Kiểm tra voucher tồn tại và còn hiệu lực
    const voucher = await this.voucherRepository.findById(voucherId)
    if (!voucher) {
      throw new HttpException(VOUCHER_ERRORS.VOUCHER_NOT_FOUND, 404)
    }

    const now = new Date()

    if (!voucher.isActive) {
      throw new HttpException(VOUCHER_ERRORS.VOUCHER_INACTIVE, 400)
    }

    if (voucher.startDate > now) {
      throw new HttpException(VOUCHER_ERRORS.VOUCHER_NOT_STARTED, 400)
    }

    if (voucher.endDate < now) {
      throw new HttpException(VOUCHER_ERRORS.VOUCHER_EXPIRED, 400)
    }

    // Kiểm tra đã lưu chưa
    const isCollected = await this.voucherRepository.isVoucherCollected(userId, voucherId)
    if (isCollected) {
      throw new HttpException(VOUCHER_ERRORS.VOUCHER_ALREADY_COLLECTED, 400)
    }

    // Kiểm tra usage limit
    if (voucher.usageLimit && voucher.usedCount >= voucher.usageLimit) {
      throw new HttpException(VOUCHER_ERRORS.VOUCHER_USAGE_LIMIT_EXCEEDED, 400)
    }

    const userVoucher = await this.voucherRepository.collectVoucher(userId, voucherId)
    return this.formatUserVoucherResponse(userVoucher)
  }

  // Lấy danh sách voucher của user
  async getMyVouchers(userId: number, query: ListMyVouchersQuery) {
    const result = await this.voucherRepository.findMyVouchers(userId, query)

    return {
      data: result.data.map((userVoucher) => this.formatUserVoucherResponse(userVoucher)),
      pagination: {
        page: result.page,
        limit: result.limit,
        total: result.total,
        totalPages: Math.ceil(result.total / result.limit),
      },
    }
  }

  // Áp dụng voucher
  async applyVoucher(userId: number, data: ApplyVoucherBody): Promise<VoucherApplicationResult> {
    const result = await this.voucherRepository.canApplyVoucher(userId, data.code, data.orderAmount, data.productIds)

    return {
      canApply: result.canApply,
      discountAmount: result.discountAmount || 0,
      reason: result.reason,
      voucher: result.voucher as unknown as VoucherResponse | undefined,
    }
  }

  // Sử dụng voucher (gọi khi order thành công)
  async useVoucher(userId: number, voucherId: number): Promise<void> {
    await this.voucherRepository.useVoucher(userId, voucherId)
  }

  // ===== STATS =====

  // Thống kê voucher của user
  async getUserVoucherStats(userId: number): Promise<VoucherStatsResponse> {
    return this.voucherRepository.getUserVoucherStats(userId)
  }

  // Thống kê voucher của seller/admin
  async getVoucherStats(sellerId?: number): Promise<VoucherStatsResponse> {
    return this.voucherRepository.getVoucherStats(sellerId)
  }

  // ===== PRIVATE HELPER METHODS =====

  private validateVoucherData(data: CreateVoucherBody): void {
    const now = new Date()

    // Validate dates
    if (data.startDate >= data.endDate) {
      throw new HttpException(VOUCHER_ERRORS.INVALID_VOUCHER_DATES, 400)
    }

    // Validate percentage
    if (data.type === 'PERCENTAGE' && (data.value < 1 || data.value > 100)) {
      throw new HttpException(VOUCHER_ERRORS.INVALID_PERCENTAGE_VALUE, 400)
    }

    // Validate value
    if (data.value <= 0) {
      throw new HttpException(VOUCHER_ERRORS.INVALID_VOUCHER_VALUE, 400)
    }

    // Validate usage limits
    if (data.usageLimit && data.usageLimit <= 0) {
      throw new HttpException(VOUCHER_ERRORS.INVALID_USAGE_LIMIT, 400)
    }

    if (data.userUsageLimit && data.userUsageLimit <= 0) {
      throw new HttpException(VOUCHER_ERRORS.INVALID_USAGE_LIMIT, 400)
    }

    // Validate min order value với max discount cho percentage
    if (data.type === 'PERCENTAGE' && data.minOrderValue && data.maxDiscount) {
      const maxPossibleDiscount = (data.minOrderValue * data.value) / 100
      if (data.maxDiscount > maxPossibleDiscount) {
        // Cảnh báo nhưng không throw error
        console.warn(
          `MaxDiscount ${data.maxDiscount} is higher than possible discount ${maxPossibleDiscount} for minOrderValue ${data.minOrderValue}`,
        )
      }
    }
  }

  private formatVoucherResponse(voucher: any): VoucherResponse {
    return {
      id: voucher.id,
      code: voucher.code,
      name: voucher.name,
      description: voucher.description,
      type: voucher.type,
      value: voucher.value,
      minOrderValue: voucher.minOrderValue,
      maxDiscount: voucher.maxDiscount,
      usageLimit: voucher.usageLimit,
      usedCount: voucher.usedCount,
      userUsageLimit: voucher.userUsageLimit,
      startDate: voucher.startDate,
      endDate: voucher.endDate,
      isActive: voucher.isActive,
      sellerId: voucher.sellerId,
      applicableProducts: voucher.applicableProducts || [],
      excludedProducts: voucher.excludedProducts || [],
      createdAt: voucher.createdAt,
      updatedAt: voucher.updatedAt,
    }
  }

  private formatUserVoucherResponse(userVoucher: any): UserVoucherResponse {
    return {
      id: userVoucher.id,
      userId: userVoucher.userId,
      voucherId: userVoucher.voucherId,
      usedCount: userVoucher.usedCount,
      usedAt: userVoucher.usedAt,
      savedAt: userVoucher.savedAt,
      voucher: this.formatVoucherResponse(userVoucher.voucher),
    }
  }
}
