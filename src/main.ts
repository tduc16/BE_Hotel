import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ConfigService } from '@nestjs/config';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Global prefix – tất cả API đều bắt đầu bằng /api
  app.setGlobalPrefix('api');

  // Thêm log tạm thời cho route register trước validation
  app.use((req, res, next) => {
    if (req.originalUrl === '/api/customer-auth/register' && req.method === 'POST') {
      console.log('Register Body:', req.body);
    }
    next();
  });

  // Global validation pipe: tự động validate DTO và transform type
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: false,
    }),
  );

  app.enableCors({
    origin: true,
    credentials: true,
  });

  // Swagger Documentation
  const swaggerConfig = new DocumentBuilder()
    .setTitle('Hotel Booking API')
    .setDescription(
      `
## API Documentation

### Public APIs (Không cần đăng nhập)
- **Tra cứu booking**: \`GET /api/public/bookings/search\`
- **Quản lý booking qua token**: \`GET /api/public/bookings/manage/:token\`
- **Hủy booking**: \`POST /api/public/bookings/cancel\`

### Admin APIs (Cần JWT)
- Quản lý booking, phòng, danh mục phòng
      `.trim(),
    )
    .setVersion('1.0')
    .addBearerAuth(
      { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
      'JWT',
    )
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, document, {
    swaggerOptions: {
      persistAuthorization: true,
      tagsSorter: 'alpha',
      operationsSorter: 'alpha',
    },
  });

  const configService = app.get(ConfigService);
  const port = Number(configService.get('PORT')) || 3000;

  await app.listen(port);
  console.log(`🚀 Backend running on: http://localhost:${port}/api`);
  console.log(`📚 Swagger docs: http://localhost:${port}/api/docs`);
}
bootstrap();

