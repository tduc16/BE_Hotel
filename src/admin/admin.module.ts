import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';

import { Admin } from './entities/admin.entity';
import { AdminAuthService } from './auth/admin-auth.service';
import { AdminAuthController } from './auth/admin-auth.controller';
import { AdminSeedService } from './seed/admin-seed.service';
import { Room } from '../rooms/entities/room.entity';
import { RoomCategory } from '../rooms/entities/room-category.entity';
import { RoomCategoryImage } from '../rooms/entities/room-category-image.entity';
import { AdminRoomsController } from './rooms/admin-rooms.controller';
import { AdminRoomsService } from './rooms/admin-rooms.service';
import { AdminRoomCategoriesController } from './room-categories/admin-room-categories.controller';
import { AdminRoomCategoriesService } from './room-categories/admin-room-categories.service';
import { AdminBookingsController } from './bookings/admin-bookings.controller';
import { AdminBookingsService } from './bookings/admin-bookings.service';
import { Booking } from '../bookings/entities/booking.entity';
import { BookingHistory } from '../bookings/entities/booking-history.entity';
import { UploadModule } from '../upload/upload.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Admin, Room, RoomCategory, RoomCategoryImage, Booking, BookingHistory]),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET'),
        signOptions: {
          expiresIn: configService.get<string>('JWT_EXPIRES_IN', '1h') as any,
        },
      }),
      inject: [ConfigService],
    }),
    UploadModule,
  ],
  controllers: [AdminAuthController, AdminRoomsController, AdminRoomCategoriesController, AdminBookingsController],
  providers: [AdminAuthService, AdminSeedService, AdminRoomsService, AdminRoomCategoriesService, AdminBookingsService],
  exports: [JwtModule],
})
export class AdminModule { }
