import { Inject, Injectable } from '@nestjs/common'
import { CACHE_MANAGER } from '@nestjs/cache-manager'
import { Cache } from 'cache-manager'
import { ProductRepo } from 'src/routes/product/product.repo'
import {
  CreateProductBodyType,
  GetProductsQueryType,
  GetProductsResType,
  UpdateProductBodyType,
} from 'src/routes/product/product.model'
import { NotFoundRecordException } from 'src/shared/error'
import { isNotFoundPrismaError } from 'src/shared/helpers'
import { I18nContext } from 'nestjs-i18n'
import { CACHE_TTL } from 'src/shared/constants/app.constant'

@Injectable()
export class ProductService {
  constructor(
    private productRepo: ProductRepo,
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
  ) {}

  private generateListCacheKey(params: GetProductsQueryType): string {
    return `products:list:${JSON.stringify(params)}`
  }

  async list(props: { query: GetProductsQueryType }): Promise<GetProductsResType> {
    const cacheKey = this.generateListCacheKey(props.query)

    const cached = await this.cacheManager.get<GetProductsResType>(cacheKey)
    if (cached) {
      return cached
    }

    const data = await this.productRepo.list({
      page: props.query.page,
      limit: props.query.limit,
      languageId: I18nContext.current()?.lang as string,
      isPublic: true,
      brandIds: props.query.brandIds,
      minPrice: props.query.minPrice,
      maxPrice: props.query.maxPrice,
      categories: props.query.categories,
      name: props.query.name,
      createdById: props.query.createdById,
      orderBy: props.query.orderBy,
      sortBy: props.query.sortBy,
    })

    await this.cacheManager.set(cacheKey, data, CACHE_TTL.MEDIUM)

    return data
  }

  async getDetail(props: { productId: number }) {
    const product = await this.productRepo.getDetail({
      productId: props.productId,
      languageId: I18nContext.current()?.lang as string,
      isPublic: true,
    })
    if (!product) {
      throw NotFoundRecordException
    }
    return product
  }
}
