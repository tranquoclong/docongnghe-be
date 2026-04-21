import { Injectable } from '@nestjs/common'
import { S3Service } from 'src/shared/services/s3.service'
import { unlink } from 'fs/promises'
import { generateRandomFileName } from 'src/shared/helpers'
import { PresignedUploadFileBodyType } from 'src/routes/media/media.model'

@Injectable()
export class MediaService {
  constructor(private readonly s3Service: S3Service) {}

  async uploadFile(files: Array<Express.Multer.File>) {
    // Thằng này nó trả về một cái Promise array thì chúng ta nên dùng Promise.all để tối ưu cái tốc độ
    const result = await Promise.all(
      files.map((file) => {
        return this.s3Service
          .uploadedFile({
            filename: 'images/' + file.filename, // lưu nó vào trong folder images
            filepath: file.path,
            contentType: file.mimetype,
          })
          .then((res) => {
            // Chúng ta mong muốn nó là một cái object
            return { url: String(res.Location) }
          })
      }),
    )
    // Tiến hành xóa cái file sau khi upload lên S3, dùng fs/promises để mà tối ưu cái việc xóa bất đồng bộ
    await Promise.all(files.map((file) => unlink(file.path)))
    return {
      data: result,
    }

    // return files.map((file) => ({
    //   url: `${envConfig.PREFIX_STATIC_ENDPOINT}/${file.filename}`,
    // }))
  }

  async getPresignedUrl(body: PresignedUploadFileBodyType) {
    const randomFilname = generateRandomFileName(body.filename)
    const presignedUrl = await this.s3Service.createPresignedUrlWithClient(randomFilname)
    const url = presignedUrl.split('?')[0]

    return { presignedUrl, url }
  }
}
