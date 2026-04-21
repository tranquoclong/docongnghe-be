import { Logger } from '@nestjs/common'
import { NestFactory } from '@nestjs/core'
import { NestExpressApplication } from '@nestjs/platform-express'
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger'
import helmet from 'helmet'
import { Logger as PinoLogger } from 'nestjs-pino'
import { cleanupOpenApiDoc } from 'nestjs-zod'
import { WebsocketAdapter } from 'src/websockets/websocket.adapter'
import { AppModule } from './app.module'

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bufferLogs: true,
  })
  app.useLogger(app.get(PinoLogger))

  // Configure CORS with proper restrictions
  const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',').filter(Boolean) || []

  // Add development origins if in development mode
  if (process.env.NODE_ENV === 'development') {
    allowedOrigins.push('http://localhost:3000', 'https://docongnghe.vercel.app', 'http://localhost:4000', 'http://localhost:5173')
  }

  // Validate CORS in production - ALLOWED_ORIGINS must be set
  if (process.env.NODE_ENV === 'production' && allowedOrigins.length === 0) {
    throw new Error('ALLOWED_ORIGINS environment variable must be set in production')
  }

  app.enableCors({
    origin: allowedOrigins.length > 0 ? allowedOrigins : false,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept', 'Accept-Language', 'refresh-access-token', 'expire-access-token'],
    maxAge: 86400, // 24 hours preflight cache
  })

  app.use(
    helmet({
      contentSecurityPolicy:
        process.env.NODE_ENV === 'production'
          ? {
            directives: {
              defaultSrc: ["'self'"],
              scriptSrc: ["'self'", "'unsafe-inline'"],
              styleSrc: ["'self'", "'unsafe-inline'"],
              imgSrc: ["'self'", 'data:', 'https:'],
              connectSrc: ["'self'"],
            },
          }
          : false,
      crossOriginEmbedderPolicy: false,
    }),
  )
  // app.useGlobalInterceptors(new LoggingInterceptor())
  // Cái này nó giới hạn dựa trên cái địa chỉ IP của client
  // Trust proxy: 1 hop in production (behind reverse proxy), loopback in development
  app.set('trust proxy', process.env.NODE_ENV === 'production' ? 1 : 'loopback')

  // Swagger/OpenAPI - nestjs-zod v5 hỗ trợ Zod V4 đầy đủ qua cleanupOpenApiDoc()
  const documentBuilder = new DocumentBuilder()
    .setTitle('docongnghe API')
    .setDescription('The API for the docongnghe application')
    .setVersion('1.0')
    .addServer(`http://localhost:${process.env.PORT ?? 3000}`, 'Local Development')

  if (process.env.NODE_ENV === 'production' && process.env.API_URL) {
    documentBuilder.addServer(process.env.API_URL, 'Production')
  }

  const config = documentBuilder
    .addBearerAuth()
    .addApiKey(
      {
        name: 'authorization',
        type: 'apiKey',
      },
      'payment-api-key',
    )
    .build()

  const document = SwaggerModule.createDocument(app, config, {
    operationIdFactory: (controllerKey: string, methodKey: string) => methodKey,
  })

  // cleanupOpenApiDoc() xử lý OpenAPI schemas được tạo từ nestjs-zod DTOs (Zod V4 compatible)
  const cleanedDocument = cleanupOpenApiDoc(document)

  SwaggerModule.setup('api', app, cleanedDocument, {
    swaggerOptions: {
      persistAuthorization: true,
    },
  })
  // app.useWebSocketAdapter(new WebsocketAdapter(app))
  try {
    const websocketAdapter = new WebsocketAdapter(app)
    await websocketAdapter.connectToRedis()
    app.useWebSocketAdapter(websocketAdapter)
  } catch (error) {
    const logger = new Logger('Bootstrap')
    logger.error('Failed to initialize WebSocket adapter with Redis', error instanceof Error ? error.stack : error)
    if (process.env.NODE_ENV === 'production') {
      throw error // Fail fast in production
    }
    logger.warn('WebSocket disabled in development due to Redis connection failure')
  }
  // app.useStaticAssets(UPLOAD_DIR, {
  //   prefix: '/media/static',
  // })
  await app.listen(process.env.PORT ?? 3000)

  // Enable graceful shutdown hooks
  app.enableShutdownHooks()

  // Graceful shutdown
  const signals: NodeJS.Signals[] = ['SIGTERM', 'SIGINT']
  for (const signal of signals) {
    process.on(signal, async () => {
      const logger = new Logger('Bootstrap')
      logger.log(`Received ${signal}, starting graceful shutdown...`)
      await app.close()
      logger.log('Application shut down gracefully')
      process.exit(0)
    })
  }
}

bootstrap()
