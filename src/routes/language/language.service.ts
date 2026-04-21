import { Injectable } from '@nestjs/common'
import { LanguageAlreadyExistsException } from 'src/routes/language/language.error'
import { CreateLanguageBodyType, UpdateLanguageBodyType } from 'src/routes/language/language.model'
import { LanguageRepo } from 'src/routes/language/language.repo'

import { NotFoundRecordException } from 'src/shared/error'
import { isNotFoundPrismaError, isUniqueConstraintPrismaError } from 'src/shared/helpers'
import { MESSAGES } from 'src/shared/constants/app.constant'

@Injectable()
export class LanguageService {
  constructor(private readonly languageRepo: LanguageRepo) {}

  async findAll() {
    const data = await this.languageRepo.findAll()

    return {
      data,
      totalItems: data.length,
    }
  }

  async findById(id: string) {
    const language = await this.languageRepo.findById(id)
    if (!language) {
      throw NotFoundRecordException
    }
    return language
  }

  async create({ data, createdById }: { data: CreateLanguageBodyType; createdById: number }) {
    try {
      return await this.languageRepo.create({
        createdById,
        data,
      })
    } catch (error) {
      // Liên quan tới unique của cái record thì thông báo lỗi như trên
      if (isUniqueConstraintPrismaError(error)) {
        throw LanguageAlreadyExistsException
      }
      throw error
    }
  }

  async update({ id, data, updatedById }: { id: string; data: UpdateLanguageBodyType; updatedById: number }) {
    try {
      const language = await this.languageRepo.update({
        id,
        updatedById,
        data,
      })
      return language
    } catch (error) {
      if (isNotFoundPrismaError(error)) {
        throw NotFoundRecordException
      }
      throw error
    }
  }

  async delete(id: string) {
    try {
      // hard delete
      // Đây là cái id mà chúng ta truyền vào chứ không phải là do postgres nó generate ra nên là chỗ này mình cần phải xóa cứng nó
      await this.languageRepo.delete(id, true)
      return {
        message: MESSAGES.DELETE_SUCCESS,
      }
    } catch (error) {
      if (isNotFoundPrismaError(error)) {
        throw NotFoundRecordException
      }
      throw error
    }
  }
}
