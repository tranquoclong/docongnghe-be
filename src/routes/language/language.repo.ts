import { Injectable } from '@nestjs/common'
import { SerializeAll } from 'src/shared/decorators/serialize.decorator'
import { CreateLanguageBodyType, LanguageType, UpdateLanguageBodyType } from 'src/routes/language/language.model'
import { PrismaService } from 'src/shared/services/prisma.service'

@Injectable()
@SerializeAll()
export class LanguageRepo {
  constructor(private prismaService: PrismaService) {}

  findAll(): Promise<LanguageType[]> {
    return this.prismaService.language.findMany({
      where: {
        // Sẽ lọc theo cái deletedAt là null
        deletedAt: null,
      },
    }) as any
  }

  findById(id: string): Promise<LanguageType | null> {
    return this.prismaService.language.findUnique({
      // Khi mà chúng ta làm như thế này thì nó vẫn tận dụng được cái PK của cái Language
      //  Đầu tiên là nó sẽ findUniqueById
      where: {
        id, // Cái Id nó đã index được rồi,
        deletedAt: null, // find ra được rồi thì nó sẽ filter(thằng này nó có deletedAt là null hay không rồi thì nó mới trả về).
      },
    }) as any
  }

  // Truyền thêm cái trường là createdById vào
  create({ createdById, data }: { createdById: number; data: CreateLanguageBodyType }): Promise<LanguageType> {
    return this.prismaService.language.create({
      data: {
        ...data,
        createdById,
      },
    }) as any
  }

  // Cũng thêm vào trường updatedById
  update({
    id,
    updatedById,
    data,
  }: {
    id: string
    updatedById: number
    data: UpdateLanguageBodyType
  }): Promise<LanguageType> {
    return this.prismaService.language.update({
      where: {
        id,
        // Nếu một cái bảng ghi đã được xóa cứng hoặc xóa mềm cũng không được cập nhât.
        deletedAt: null,
      },
      data: {
        ...data,
        updatedById,
      },
    }) as any
  }

  delete(id: string, isHard?: boolean): Promise<LanguageType> {
    return (
      isHard
        ? this.prismaService.language.delete({
            where: {
              id,
            },
          })
        : this.prismaService.language.update({
            where: {
              id,
              deletedAt: null,
            },
            // Cập nhật cái Date vào thực hiện xóa mềm cho nó là được
            data: {
              deletedAt: new Date(),
            },
          })
    ) as any
  }
}
