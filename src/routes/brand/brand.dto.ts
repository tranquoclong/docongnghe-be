export class BrandDTO {}

import { createZodDto } from 'nestjs-zod'
import {
  CreateBrandBodySchema,
  GetBrandDetailResSchema,
  GetBrandParamsSchema,
  GetBrandsResSchema,
  UpdateBrandBodySchema,
  GetBrandsQuerySchema
} from 'src/routes/brand/brand.model'

export class GetBrandsResDTO extends createZodDto(GetBrandsResSchema) {}

export class GetBrandsQueryDTO extends createZodDto(GetBrandsQuerySchema) {}

export class GetBrandParamsDTO extends createZodDto(GetBrandParamsSchema) {}

export class GetBrandDetailResDTO extends createZodDto(GetBrandDetailResSchema) {}

export class CreateBrandBodyDTO extends createZodDto(CreateBrandBodySchema) {}

export class UpdateBrandBodyDTO extends createZodDto(UpdateBrandBodySchema) {}
