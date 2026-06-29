import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { BookingsController } from './bookings.controller';
import { BookingsService } from './bookings.service';
import { BookingCronService } from './cron.service';
import { BookingAvailabilityService } from './booking-availability.service';
import { BankQrService } from './bank-qr.service';
import { Booking } from './entities/booking.entity';
import { BookingHistory } from './entities/booking-history.entity';
import { RoomCategory } from '../rooms/entities/room-category.entity';
import { Room } from '../rooms/entities/room.entity';
import { EmailModule } from '../email/email.module';
import { VouchersModule } from '../vouchers/vouchers.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Booking, BookingHistory, RoomCategory, Room]),
    EmailModule,
    ConfigModule,
    VouchersModule,
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
  ],
  controllers: [BookingsController],
  providers: [BookingsService, BookingCronService, BookingAvailabilityService, BankQrService],
  exports: [BookingsService, BookingAvailabilityService, BankQrService],
})
export class BookingsModule {}

