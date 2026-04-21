import { createZodDto } from 'nestjs-zod'
import {
  GetDashboardResSchema,
  GetDashboardQuerySchema,
} from 'src/routes/dashboard/dashboard.model'

export class GetDashboardResDTO extends createZodDto(GetDashboardResSchema) { }
export class GetDashboardQueryDTO extends createZodDto(GetDashboardQuerySchema) { }
