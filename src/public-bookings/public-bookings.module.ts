import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PublicBookingsController } from './public-bookings.controller';
import { PublicBookingsService } from './public-bookings.service';
import { Booking } from '../bookings/entities/booking.entity';
import { BookingHistory } from '../bookings/entities/booking-history.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Booking, BookingHistory])],
  controllers: [PublicBookingsController],
  providers: [PublicBookingsService],
})
export class PublicBookingsModule {}
