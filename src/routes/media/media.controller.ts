import {
  Body,
  Controller,
  FileTypeValidator,
  Get,
  MaxFileSizeValidator,
  NotFoundException,
  Param,
  Post,
  Res,
  UploadedFiles,
  UseInterceptors,
} from '@nestjs/common'
import { FilesInterceptor } from '@nestjs/platform-express'
import { Response } from 'express'
import { ZodResponse } from 'nestjs-zod'
import path from 'path'
import { PresignedUploadFileBodyDTO, PresignedUploadFileResDTO, UploadFilesResDTO } from 'src/routes/media/media.dto'
import { MediaService } from 'src/routes/media/media.service'
import { ParseFilePipeWithUnlink } from 'src/routes/media/parse-file-pipe-with-unlink.pipe'
import { UPLOAD_DIR } from 'src/shared/constants/other.constant'
import { IsPublic } from 'src/shared/decorators/auth.decorator'
import { ApiBearerAuth } from '@nestjs/swagger'

@Controller('media')
@ApiBearerAuth()
export class MediaController {
  constructor(private readonly mediaService: MediaService) { }

  @Post('images/upload')
  @ZodResponse({ type: UploadFilesResDTO })
  @UseInterceptors(
    FilesInterceptor('files', 100, {
      limits: {
        fileSize: 5 * 1024 * 1024, // 5MB;
      },
    }),
  )
  uploadFile(
    @UploadedFiles(
      new ParseFilePipeWithUnlink({
        validators: [
          new MaxFileSizeValidator({ maxSize: 5 * 1024 * 1024 }), // 5MB;
          new FileTypeValidator({ fileType: /(jpg|jpeg|png|webp)$/ }), // jpg/ jpeg/png/webp
        ],
      }),
    )
    files: Array<Express.Multer.File>,
  ) {
    return this.mediaService.uploadFile(files)
  }

  // Cái route này dùng để test thử cái trường hợp nếu mà cái đường dẫn file được bảo vệ trong dự án thực tế thì sẽ như thế nào -> Custom Guard(accessTokenGuard) để mà chặn những cái request chưa được xác thực
  @Get('static/:filename')
  @IsPublic()
  serveFile(@Param('filename') filename: string, @Res() res: Response) {
    // console.log(filename)
    // Truyền vào cái đường dẫn mà dẫn đến cái  file đó là được -> Thì là sự kết hợp của UPLOAD_DIR và filename
    const notfound = new NotFoundException('File not found')
    return res.sendFile(path.resolve(UPLOAD_DIR, filename), (error) => {
      if (error) {
        // Trả về như này cho nó quy chuẩn lại lỗi trả về
        res.status(notfound.getStatus()).json(notfound.getResponse())
      }
    })
  }

  // getPresignedUrl
  @Post('images/upload/presigned-url')
  @ZodResponse({ type: PresignedUploadFileResDTO })
  @IsPublic()
  async createPresignedUrl(@Body() body: PresignedUploadFileBodyDTO) {
    return this.mediaService.getPresignedUrl(body)
  }
}
