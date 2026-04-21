import { Body, Controller, Delete, Get, Param, Post, Put, Query } from '@nestjs/common'
import { SkipThrottle } from '@nestjs/throttler'
import { ZodResponseOnly } from 'src/shared/decorators/zod-response-only.decorator'
import {
  CreateProductBodyDTO,
  GetProductDetailResDTO,
  GetProductParamsDTO,
  GetProductsQueryDTO,
  GetProductsResDTO,
  ProductDTO,
  UpdateProductBodyDTO,
} from 'src/routes/product/product.dto'
import { ProductService } from 'src/routes/product/product.service'
import { IsPublic } from 'src/shared/decorators/auth.decorator'

@SkipThrottle({ short: true, long: true })
@Controller('products')
@IsPublic()
export class ProductController {
  constructor(private readonly productService: ProductService) {}

  @Get()
  @ZodResponseOnly({ type: GetProductsResDTO })
  list(@Query() query: GetProductsQueryDTO) {
    return this.productService.list({
      query,
    })
  }

  @SkipThrottle({ short: false, long: false })
  @Get(':productId')
  @ZodResponseOnly({ type: GetProductDetailResDTO })
  findById(@Param() params: GetProductParamsDTO) {
    return this.productService.getDetail({
      productId: params.productId,
    })
  }
}
