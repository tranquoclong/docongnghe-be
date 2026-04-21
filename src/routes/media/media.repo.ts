import { Injectable } from '@nestjs/common'
import { SerializeAll } from 'src/shared/decorators/serialize.decorator'

@Injectable()
@SerializeAll()
export class MediaRepo {
  constructor() {}
}
