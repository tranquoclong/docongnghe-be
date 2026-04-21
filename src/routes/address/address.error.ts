import { HttpStatus } from '@nestjs/common'
import { createErrorObject } from '../../shared/error'

export const ADDRESS_ERRORS = {
  // Not Found Errors
  ADDRESS_NOT_FOUND: createErrorObject({
    message: 'Địa chỉ không tồn tại',
    statusCode: HttpStatus.NOT_FOUND,
    errorCode: 'ADDRESS_NOT_FOUND',
  }),

  // Permission Errors
  ADDRESS_ACCESS_DENIED: createErrorObject({
    message: 'Bạn không có quyền truy cập địa chỉ này',
    statusCode: HttpStatus.FORBIDDEN,
    errorCode: 'ADDRESS_ACCESS_DENIED',
  }),

  // Business Logic Errors
  CANNOT_DELETE_DEFAULT_ADDRESS: createErrorObject({
    message: 'Không thể xóa địa chỉ mặc định. Vui lòng đặt địa chỉ khác làm mặc định trước',
    statusCode: HttpStatus.BAD_REQUEST,
    errorCode: 'CANNOT_DELETE_DEFAULT_ADDRESS',
  }),

  MAX_ADDRESSES_EXCEEDED: createErrorObject({
    message: 'Bạn đã đạt giới hạn tối đa số lượng địa chỉ (10 địa chỉ)',
    statusCode: HttpStatus.BAD_REQUEST,
    errorCode: 'MAX_ADDRESSES_EXCEEDED',
  }),

  INVALID_ADDRESS_DATA: createErrorObject({
    message: 'Dữ liệu địa chỉ không hợp lệ',
    statusCode: HttpStatus.BAD_REQUEST,
    errorCode: 'INVALID_ADDRESS_DATA',
  }),

  CANNOT_SET_INACTIVE_AS_DEFAULT: createErrorObject({
    message: 'Không thể đặt địa chỉ không hoạt động làm mặc định',
    statusCode: HttpStatus.BAD_REQUEST,
    errorCode: 'CANNOT_SET_INACTIVE_AS_DEFAULT',
  }),

  // Validation Errors
  PROVINCE_DISTRICT_MISMATCH: createErrorObject({
    message: 'Quận/huyện không thuộc tỉnh/thành đã chọn',
    statusCode: HttpStatus.BAD_REQUEST,
    errorCode: 'PROVINCE_DISTRICT_MISMATCH',
  }),

  DISTRICT_WARD_MISMATCH: createErrorObject({
    message: 'Phường/xã không thuộc quận/huyện đã chọn',
    statusCode: HttpStatus.BAD_REQUEST,
    errorCode: 'DISTRICT_WARD_MISMATCH',
  }),
}
