import { HttpStatus } from '@nestjs/common'
import { createErrorObject } from '../../shared/error'

export const VOUCHER_ERRORS = {
  // Not Found Errors
  VOUCHER_NOT_FOUND: createErrorObject({
    message: 'Voucher không tồn tại',
    statusCode: HttpStatus.NOT_FOUND,
    errorCode: 'VOUCHER_NOT_FOUND',
  }),

  VOUCHER_CODE_NOT_FOUND: createErrorObject({
    message: 'Mã voucher không tồn tại',
    statusCode: HttpStatus.NOT_FOUND,
    errorCode: 'VOUCHER_CODE_NOT_FOUND',
  }),

  // Permission Errors
  VOUCHER_ACCESS_DENIED: createErrorObject({
    message: 'Bạn không có quyền truy cập voucher này',
    statusCode: HttpStatus.FORBIDDEN,
    errorCode: 'VOUCHER_ACCESS_DENIED',
  }),

  // Business Logic Errors - Voucher Creation/Management
  VOUCHER_CODE_EXISTS: createErrorObject({
    message: 'Mã voucher đã tồn tại',
    statusCode: HttpStatus.BAD_REQUEST,
    errorCode: 'VOUCHER_CODE_EXISTS',
  }),

  INVALID_VOUCHER_DATES: createErrorObject({
    message: 'Ngày bắt đầu phải trước ngày kết thúc',
    statusCode: HttpStatus.BAD_REQUEST,
    errorCode: 'INVALID_VOUCHER_DATES',
  }),

  INVALID_PERCENTAGE_VALUE: createErrorObject({
    message: 'Giá trị giảm giá theo % phải từ 1-100',
    statusCode: HttpStatus.BAD_REQUEST,
    errorCode: 'INVALID_PERCENTAGE_VALUE',
  }),

  // Voucher Collection Errors
  VOUCHER_ALREADY_COLLECTED: createErrorObject({
    message: 'Bạn đã lưu voucher này rồi',
    statusCode: HttpStatus.BAD_REQUEST,
    errorCode: 'VOUCHER_ALREADY_COLLECTED',
  }),

  VOUCHER_USAGE_LIMIT_EXCEEDED: createErrorObject({
    message: 'Voucher đã hết lượt sử dụng',
    statusCode: HttpStatus.BAD_REQUEST,
    errorCode: 'VOUCHER_USAGE_LIMIT_EXCEEDED',
  }),

  VOUCHER_EXPIRED: createErrorObject({
    message: 'Voucher đã hết hạn',
    statusCode: HttpStatus.BAD_REQUEST,
    errorCode: 'VOUCHER_EXPIRED',
  }),

  VOUCHER_NOT_STARTED: createErrorObject({
    message: 'Voucher chưa có hiệu lực',
    statusCode: HttpStatus.BAD_REQUEST,
    errorCode: 'VOUCHER_NOT_STARTED',
  }),

  VOUCHER_INACTIVE: createErrorObject({
    message: 'Voucher đã bị vô hiệu hóa',
    statusCode: HttpStatus.BAD_REQUEST,
    errorCode: 'VOUCHER_INACTIVE',
  }),

  // Voucher Application Errors
  VOUCHER_NOT_COLLECTED: createErrorObject({
    message: 'Bạn chưa lưu voucher này',
    statusCode: HttpStatus.BAD_REQUEST,
    errorCode: 'VOUCHER_NOT_COLLECTED',
  }),

  USER_VOUCHER_LIMIT_EXCEEDED: createErrorObject({
    message: 'Bạn đã sử dụng hết lượt voucher này',
    statusCode: HttpStatus.BAD_REQUEST,
    errorCode: 'USER_VOUCHER_LIMIT_EXCEEDED',
  }),

  ORDER_VALUE_TOO_LOW: createErrorObject({
    message: 'Giá trị đơn hàng chưa đủ điều kiện sử dụng voucher',
    statusCode: HttpStatus.BAD_REQUEST,
    errorCode: 'ORDER_VALUE_TOO_LOW',
  }),

  PRODUCTS_NOT_APPLICABLE: createErrorObject({
    message: 'Sản phẩm trong đơn hàng không áp dụng được voucher này',
    statusCode: HttpStatus.BAD_REQUEST,
    errorCode: 'PRODUCTS_NOT_APPLICABLE',
  }),

  PRODUCTS_EXCLUDED: createErrorObject({
    message: 'Đơn hàng chứa sản phẩm không được áp dụng voucher',
    statusCode: HttpStatus.BAD_REQUEST,
    errorCode: 'PRODUCTS_EXCLUDED',
  }),

  // Validation Errors
  INVALID_VOUCHER_TYPE: createErrorObject({
    message: 'Loại voucher không hợp lệ',
    statusCode: HttpStatus.BAD_REQUEST,
    errorCode: 'INVALID_VOUCHER_TYPE',
  }),

  INVALID_VOUCHER_VALUE: createErrorObject({
    message: 'Giá trị voucher không hợp lệ',
    statusCode: HttpStatus.BAD_REQUEST,
    errorCode: 'INVALID_VOUCHER_VALUE',
  }),

  INVALID_USAGE_LIMIT: createErrorObject({
    message: 'Giới hạn sử dụng không hợp lệ',
    statusCode: HttpStatus.BAD_REQUEST,
    errorCode: 'INVALID_USAGE_LIMIT',
  }),

  // Seller Specific Errors
  SELLER_CANNOT_USE_PLATFORM_VOUCHER: createErrorObject({
    message: 'Seller không thể sử dụng voucher hệ thống',
    statusCode: HttpStatus.BAD_REQUEST,
    errorCode: 'SELLER_CANNOT_USE_PLATFORM_VOUCHER',
  }),

  CANNOT_EDIT_USED_VOUCHER: createErrorObject({
    message: 'Không thể chỉnh sửa voucher đã được sử dụng',
    statusCode: HttpStatus.BAD_REQUEST,
    errorCode: 'CANNOT_EDIT_USED_VOUCHER',
  }),

  CANNOT_DELETE_USED_VOUCHER: createErrorObject({
    message: 'Không thể xóa voucher đã được sử dụng',
    statusCode: HttpStatus.BAD_REQUEST,
    errorCode: 'CANNOT_DELETE_USED_VOUCHER',
  }),
}
