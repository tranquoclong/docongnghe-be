import { BadRequestException, NotFoundException } from '@nestjs/common'

export const NotFoundSKUException = new NotFoundException('Error.SKU.NotFound')

export const OutOfStockSKUException = new BadRequestException('Error.SKU.OutOfStock')

export const ProductNotFoundException = new NotFoundException('Error.Product.NotFound')

export const NotFoundDashboardItemException = new NotFoundException('Error.DashboardItem.NotFound')

export const InvalidQuantityException = new BadRequestException('Error.DashboardItem.InvalidQuantity')
