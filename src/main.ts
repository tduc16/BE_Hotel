import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ConfigService } from '@nestjs/config';
import { ValidationPipe } from '@nestjs/common';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Global prefix – tất cả API đều bắt đầu bằng /api
  app.setGlobalPrefix('api');

  // Global validation pipe: tự động validate DTO và transform type
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: false,
    }),
  );

  app.enableCors({
    origin: '*',
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });

  const configService = app.get(ConfigService);
  let port = configService.get<number>('PORT') || 3001;

  try {
    await app.listen(port);
    console.log(`🚀 Backend running on: http://localhost:${port}/api`);
  } catch (error: any) {
    if (error.code === 'EADDRINUSE') {
      console.warn(`⚠️  Port ${port} is currently in use.`);
      port = port + 1;
      console.log(`🔄 Trying fallback port ${port}...`);
      await app.listen(port);
      console.log(`🚀 Backend running on: http://localhost:${port}/api`);
    } else {
      console.error('Failed to start backend:', error);
      throw error;
    }
  }
}
bootstrap();
