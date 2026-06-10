import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { join } from 'path';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        host: configService.get<string>('DB_HOST', 'localhost'),
        port: configService.get<number>('DB_PORT', 5432),
        username: configService.get<string>('DB_USERNAME', 'postgres'),
        password: configService.get<string>('DB_PASSWORD', '123456'),
        database: configService.get<string>('DB_DATABASE', 'hotel'),
        autoLoadEntities: true,
        synchronize: false,
        migrationsRun: true,
        // Chỉ định đường dẫn tìm file migration (.ts khi dev, .js khi prod)
        migrations: [
          join(__dirname, '..', 'database', 'migrations', '*{.ts,.js}'),
        ],
        logging: ['error', 'migration'],
      }),
      inject: [ConfigService],
    }),
  ],
})
export class DbModule {}
