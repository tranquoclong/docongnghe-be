import { Injectable } from '@nestjs/common'
import { SerializeAll } from 'src/shared/decorators/serialize.decorator'
import { Prisma } from '@prisma/client'
import {
  CreateProductBodyType,
  GetProductDetailResType,
  GetProductsResType,
  UpdateProductBodyType,
} from 'src/routes/product/product.model'
import { ALL_LANGUAGE_CODE, OrderByType, SortBy, SortByType } from 'src/shared/constants/other.constant'
import { ProductType } from 'src/shared/models/shared-product.model'
import { PrismaService } from 'src/shared/services/prisma.service'

const buildProductInclude = (languageId: string = ALL_LANGUAGE_CODE) => {
  const translationWhere =
    languageId === ALL_LANGUAGE_CODE ? { deletedAt: null } : { languageId, deletedAt: null }

  const specTranslationWhere =
    languageId === ALL_LANGUAGE_CODE ? {} : { languageId }

  return {
    productTranslations: {
      where: translationWhere,
    },
    skus: {
      where: { deletedAt: null },
    },
    brand: {
      include: {
        brandTranslations: {
          where: translationWhere,
        },
      },
    },
    categories: {
      where: { deletedAt: null },
      include: {
        childrenCategories: {
          where: { deletedAt: null },
        },
        categoryTranslations: {
          where: translationWhere,
        },
      },
    },
    specGroups: {
      where: { deletedAt: null },
      orderBy: { sortOrder: 'asc' as const },
      include: {
        translations: {
          where: specTranslationWhere,
        },
        specs: {
          where: { deletedAt: null },
          orderBy: { sortOrder: 'asc' as const },
          include: {
            translations: {
              where: specTranslationWhere,
            },
          },
        },
      },
    },
  }
}

@Injectable()
@SerializeAll()
export class ProductRepo {
  constructor(private readonly prismaService: PrismaService) { }

  private async createSpecGroupsInTx(
    tx: Prisma.TransactionClient,
    productId: number,
    specGroups: CreateProductBodyType['specGroups'],
  ) {
    if (!specGroups || specGroups.length === 0) return

    for (const group of specGroups) {
      const { specs, translations: groupTranslations, ...groupData } = group

      const createdGroup = await tx.productSpecGroup.create({
        data: {
          productId,
          key: groupData.key,
          sortOrder: groupData.sortOrder ?? 0,
          translations: {
            createMany: {
              data: groupTranslations.map((t) => ({
                languageId: t.languageId,
                label: t.label,
              })),
            },
          },
        },
      })

      if (!specs || specs.length === 0) continue

      await Promise.all(
        specs.map((spec) =>
          tx.productSpec.create({
            data: {
              groupId: createdGroup.id,
              key: spec.key,
              sortOrder: spec.sortOrder ?? 0,
              translations: {
                createMany: {
                  data: spec.translations.map((t) => ({
                    languageId: t.languageId,
                    label: t.label,
                    value: t.value,
                  }))
                  // data: spec.translations
                  //   ? spec.translations.map((t) => ({
                  //     languageId: t.languageId,
                  //     label: t.label,
                  //     value: t.value,
                  //   }))
                  //   : groupTranslations.map((t) => ({
                  //     languageId: t.languageId,
                  //     label: spec.label,
                  //     value: spec.value,
                  //   })),
                },
              },
            },
          }),
        ),
      )
    }
  }

  private async upsertHighlightsInTx(
    tx: Prisma.TransactionClient,
    productId: number,
    productName: string,
    highlights: CreateProductBodyType['highlights'],
  ) {
    if (!highlights || highlights.length === 0) return

    await Promise.all(
      highlights.map((highlight) =>
        tx.productTranslation.upsert({
          where: {
            productId_languageId: {
              productId,
              languageId: highlight.languageId,
            },
          },
          update: {
            highlights: {
              summary: highlight.summary ?? '',
              sections: highlight.sections ?? [],
            } as any,
          },
          create: {
            productId,
            languageId: highlight.languageId,
            name: productName,
            description: '',
            highlights: {
              summary: highlight.summary ?? '',
              sections: highlight.sections ?? [],
            } as any,
          },
        }),
      ),
    )
  }

  private async deleteAllSpecGroupsInTx(
    tx: Prisma.TransactionClient,
    productId: number,
  ) {
    const existingGroups = await tx.productSpecGroup.findMany({
      where: { productId },
      select: { id: true },
    })

    if (existingGroups.length === 0) return

    const existingGroupIds = existingGroups.map((g) => g.id)

    const existingSpecIds = await tx.productSpec
      .findMany({
        where: { groupId: { in: existingGroupIds } },
        select: { id: true },
      })
      .then((specs) => specs.map((s) => s.id))

    await Promise.all([
      existingSpecIds.length > 0
        ? tx.productSpecTranslation.deleteMany({
          where: { specId: { in: existingSpecIds } },
        })
        : Promise.resolve(),
      tx.productSpecGroupTranslation.deleteMany({
        where: { groupId: { in: existingGroupIds } },
      }),
    ])

    await tx.productSpec.deleteMany({
      where: { groupId: { in: existingGroupIds } },
    })
    await tx.productSpecGroup.deleteMany({
      where: { id: { in: existingGroupIds } },
    })
  }

  async list({
    limit, page, name, brandIds, categories, minPrice, maxPrice,
    createdById, isPublic, languageId, orderBy, sortBy,
  }: {
    limit: number; page: number; name?: string; brandIds?: number[]
    categories?: number[]; minPrice?: number; maxPrice?: number
    createdById?: number; isPublic?: boolean; languageId: string
    orderBy: OrderByType; sortBy: SortByType
  }): Promise<GetProductsResType> {
    const skip = (page - 1) * limit
    const take = limit

    let where: Prisma.ProductWhereInput = {
      deletedAt: null,
      createdById: createdById ?? undefined,
    }

    if (isPublic === true) {
      where.publishedAt = { lte: new Date(), not: null }
    } else if (isPublic === false) {
      where = { ...where, OR: [{ publishedAt: null }, { publishedAt: { gt: new Date() } }] }
    }

    if (name) where.name = { contains: name, mode: 'insensitive' }
    if (brandIds?.length) where.brandId = { in: brandIds }
    if (categories?.length) where.categories = { some: { id: { in: categories } } }
    if (minPrice !== undefined || maxPrice !== undefined) {
      where.basePrice = { gte: minPrice, lte: maxPrice }
    }

    let calculatedOrderBy: Prisma.ProductOrderByWithRelationInput | Prisma.ProductOrderByWithRelationInput[] =
      { createdAt: orderBy }
    if (sortBy === SortBy.Price) calculatedOrderBy = { basePrice: orderBy }
    else if (sortBy === SortBy.Sale) calculatedOrderBy = { orders: { _count: orderBy } }

    const [totalItems, data] = await Promise.all([
      this.prismaService.product.count({ where }),
      this.prismaService.product.findMany({
        where,
        include: {
          categories: {
            where: { deletedAt: null },
            select: {
              id: true, name: true, logo: true,
              childrenCategories: {
                where: { deletedAt: null },
                select: { id: true, name: true, logo: true },
              },
            },
          },
          brand: { select: { id: true, name: true, logo: true } },
          productTranslations: {
            where: languageId === ALL_LANGUAGE_CODE ? { deletedAt: null } : { languageId, deletedAt: null },
            select: { id: true, name: true, languageId: true, description: true },
          },
          _count: {
            select: { orders: { where: { deletedAt: null, status: 'DELIVERED' } } },
          },
        },
        orderBy: calculatedOrderBy,
        skip,
        take,
      }),
    ])

    return { data, totalItems, page, limit, totalPages: Math.ceil(totalItems / limit) } as any
  }

  findById(productId: number): Promise<ProductType | null> {
    return this.prismaService.product.findUnique({
      where: { id: productId, deletedAt: null },
    }) as any
  }

  getDetail({
    productId, languageId, isPublic,
  }: {
    productId: number; languageId: string; isPublic?: boolean
  }): Promise<GetProductDetailResType | null> {
    let where: Prisma.ProductWhereUniqueInput = { id: productId, deletedAt: null }

    if (isPublic === true) {
      where.publishedAt = { lte: new Date(), not: null }
    } else if (isPublic === false) {
      where = { ...where, OR: [{ publishedAt: null }, { publishedAt: { gt: new Date() } }] }
    }

    return this.prismaService.product.findUnique({
      where,
      include: buildProductInclude(ALL_LANGUAGE_CODE),
    }) as any
  }

  async create({
    createdById, data,
  }: {
    createdById: number; data: CreateProductBodyType
  }): Promise<GetProductDetailResType> {
    const { skus, categories, specGroups, highlights, ...productData } = data

    return this.prismaService.$transaction(async (tx) => {
      const product = await tx.product.create({
        data: {
          createdById,
          ...productData,
          categories: { connect: categories.map((id) => ({ id })) },
          skus: { createMany: { data: skus.map((sku) => ({ ...sku, createdById })) } },
        },
      })

      await Promise.all([
        this.createSpecGroupsInTx(tx, product.id, specGroups),
        this.upsertHighlightsInTx(tx, product.id, productData.name, highlights),
      ])

      return tx.product.findUnique({
        where: { id: product.id },
        include: buildProductInclude(ALL_LANGUAGE_CODE),
      }) as any
    })
  }

  async update({
    id, updatedById, data,
  }: {
    id: number; updatedById: number; data: UpdateProductBodyType
  }): Promise<GetProductDetailResType> {
    const { skus: dataSkus, categories, specGroups, highlights, ...productData } = data

    return this.prismaService.$transaction(async (tx) => {
      const product = await tx.product.update({
        where: { id, deletedAt: null },
        data: {
          ...productData,
          updatedById,
          categories: { set: categories.map((categoryId) => ({ id: categoryId })) },
        },
      })

      const existingSKUs = await tx.sKU.findMany({
        where: { productId: id, deletedAt: null },
        select: { id: true, value: true },
      })

      const existingValueMap = new Map(existingSKUs.map((s) => [s.value, s.id]))
      const incomingValueSet = new Set(dataSkus.map((s) => s.value))
      const idsToDelete = existingSKUs.filter((s) => !incomingValueSet.has(s.value)).map((s) => s.id)

      const skusToCreate: typeof dataSkus = []
      const skusToUpdate: (typeof dataSkus[0] & { existingId: number })[] = []

      for (const sku of dataSkus) {
        const existingId = existingValueMap.get(sku.value)
        if (existingId) skusToUpdate.push({ ...sku, existingId })
        else skusToCreate.push(sku)
      }

      await Promise.all([
        idsToDelete.length > 0
          ? tx.sKU.updateMany({
            where: { id: { in: idsToDelete } },
            data: { deletedAt: new Date(), deletedById: updatedById },
          })
          : Promise.resolve(),
        skusToCreate.length > 0
          ? tx.sKU.createMany({
            data: skusToCreate.map((sku) => ({ ...sku, productId: id, createdById: updatedById })),
          })
          : Promise.resolve(),
        ...skusToUpdate.map((sku) =>
          tx.sKU.update({
            where: { id: sku.existingId },
            data: { price: sku.price, stock: sku.stock, image: sku.image, updatedById },
          }),
        ),
      ])

      if (specGroups !== undefined) {
        await this.deleteAllSpecGroupsInTx(tx, id)
        await this.createSpecGroupsInTx(tx, id, specGroups)
      }

      if (highlights !== undefined) {
        await this.upsertHighlightsInTx(tx, id, productData.name, highlights)
      }

      return tx.product.findUnique({
        where: { id: product.id },
        include: buildProductInclude(ALL_LANGUAGE_CODE),
      }) as any
    })
  }

  async delete(
    { id, deletedById }: { id: number; deletedById: number },
    isHard?: boolean,
  ): Promise<ProductType> {
    if (isHard) {
      return this.prismaService.product.delete({ where: { id } }) as any
    }

    const now = new Date()

    const groupIds = await this.prismaService.productSpecGroup
      .findMany({ where: { productId: id, deletedAt: null }, select: { id: true } })
      .then((groups) => groups.map((g) => g.id))

    const [product] = await Promise.all([
      this.prismaService.product.update({
        where: { id, deletedAt: null },
        data: { deletedAt: now, deletedById },
      }),
      this.prismaService.productTranslation.updateMany({
        where: { productId: id, deletedAt: null },
        data: { deletedAt: now, deletedById },
      }),
      this.prismaService.sKU.updateMany({
        where: { productId: id, deletedAt: null },
        data: { deletedAt: now, deletedById },
      }),
      this.prismaService.productSpecGroup.updateMany({
        where: { productId: id, deletedAt: null },
        data: { deletedAt: now },
      }),
      groupIds.length > 0
        ? this.prismaService.productSpec.updateMany({
          where: { groupId: { in: groupIds }, deletedAt: null },
          data: { deletedAt: now },
        })
        : Promise.resolve(),
    ])

    return product as any
  }
}