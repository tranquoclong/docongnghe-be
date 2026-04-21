import { Injectable } from '@nestjs/common'
import { SerializeAll } from 'src/shared/decorators/serialize.decorator'
import {
  CreateBrandBodyType,
  GetBrandsResType,
  UpdateBrandBodyType,
  BrandType,
  BrandIncludeTranslationType,
} from 'src/routes/brand/brand.model'
import { ALL_LANGUAGE_CODE } from 'src/shared/constants/other.constant'
import { Prisma } from '@prisma/client'
import { PrismaService } from 'src/shared/services/prisma.service'

@Injectable()
@SerializeAll()
export class BrandRepo {
  constructor(private prismaService: PrismaService) {}

  async list({
    limit,
    page,
    name,
    categories,
    languageId,
  }: {
    limit: number
    page: number
    name?: string
    categories?: number[]
    languageId: string
  }): Promise<GetBrandsResType> {
    const skip = (page - 1) * limit
    const take = limit
    const where: Prisma.BrandWhereInput = {
      deletedAt: null,
    }
    if (name) {
      where.name = {
        contains: name,
        mode: 'insensitive',
      }
    }
    if (categories && categories.length > 0) {
      where.products = {
        some: {
          deletedAt: null,
          categories: {
            some: {
              id: { in: categories },
            },
          },
        },
      }
    }
    const [totalItems, data] = await Promise.all([
      this.prismaService.brand.count({
        where,
      }),
      this.prismaService.brand.findMany({
        where,
        select: {
          id: true,
          name: true,
          logo: true,
          brandTranslations: {
            where: languageId === ALL_LANGUAGE_CODE ? { deletedAt: null } : { deletedAt: null, languageId },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
        skip,
        take,
      }),
    ])
    return {
      data,
      totalItems,
      page: page,
      limit: limit,
      totalPages: Math.ceil(totalItems / limit),
    } as any
  }

  findById(id: number, languageId: string): Promise<BrandIncludeTranslationType | null> {
    return this.prismaService.brand.findUnique({
      where: {
        id,
        deletedAt: null,
      },
      include: {
        brandTranslations: {
          where: languageId === ALL_LANGUAGE_CODE ? { deletedAt: null } : { deletedAt: null, languageId },
        },
      },
    }) as any
  }

  create({
    createdById,
    data,
  }: {
    createdById: number | null
    data: CreateBrandBodyType
  }): Promise<BrandIncludeTranslationType> {
    return this.prismaService.brand.create({
      data: {
        ...data,
        createdById,
      },
      include: {
        brandTranslations: {
          where: { deletedAt: null },
        },
      },
    }) as any
  }

  update({
    id,
    updatedById,
    data,
  }: {
    id: number
    updatedById: number
    data: UpdateBrandBodyType
  }): Promise<BrandIncludeTranslationType> {
    return this.prismaService.brand.update({
      where: {
        id,
        deletedAt: null,
      },
      data: {
        ...data,
        updatedById,
      },
      include: {
        brandTranslations: {
          where: { deletedAt: null },
        },
      },
    }) as any
  }

  delete(
    {
      id,
      deletedById,
    }: {
      id: number
      deletedById: number
    },
    isHard?: boolean,
  ): Promise<BrandType> {
    return (
      isHard
        ? this.prismaService.brand.delete({
            where: {
              id,
            },
          })
        : this.prismaService.brand.update({
            where: {
              id,
              deletedAt: null,
            },
            data: {
              deletedAt: new Date(),
              deletedById,
            },
          })
    ) as any
  }
}
