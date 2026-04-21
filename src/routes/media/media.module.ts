import { Module } from '@nestjs/common'
import { MulterModule } from '@nestjs/platform-express'
import { existsSync, mkdirSync } from 'fs'
import * as multer from 'multer'
import { MediaController } from 'src/routes/media/media.controller'
import { MediaRepo } from 'src/routes/media/media.repo'
import { MediaService } from 'src/routes/media/media.service'
import { UPLOAD_DIR } from 'src/shared/constants/other.constant'
import { generateRandomFileName } from 'src/shared/helpers'

// Nó sẽ ra cái đường dẫn ngang hàng với thằng folder NestJS_Super_Ecommerce_API của chúng ta -> Nên là chỉ cần đưa cái folder upload vào là được

// console.log(UPLOAD_DIR)
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, UPLOAD_DIR)
  },
  filename: function (req, file, cb) {
    console.log(file)
    // Ở trong thằng file thì nó sẽ có originalname
    // const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9)
    const newFilename = generateRandomFileName(file.originalname)
    cb(null, newFilename) //sau khi tạo xong thì đưa cái newFilename vào đây
  },
})

@Module({
  imports: [MulterModule.register({ storage })],
  providers: [MediaService, MediaRepo],
  controllers: [MediaController],
})
export class MediaModule {
  // Và cũng yên tâm là khi mà request thì cái constructor này nó cũng chỉ chạy một lần mà thôi
  constructor() {
    // Kiểm tra cái đường đẫn UPLOADDIR này đã có hay chưa, ở đây sẽ sử dụng hàm đồng bộ luôn không cần dùng Promise vì ở đây nó chỉ chạy một lần mà thôi
    if (!existsSync(UPLOAD_DIR)) {
      mkdirSync(UPLOAD_DIR, { recursive: true })
    }
  }
}
