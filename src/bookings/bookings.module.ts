import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BookingsController } from './bookings.controller';
import { BookingsService } from './bookings.service';
import { BookingCronService } from './cron.service';
import { Booking } from './entities/booking.entity';
import { BookingHistory } from './entities/booking-history.entity';
import { RoomCategory } from '../rooms/entities/room-category.entity';
import { Room } from '../rooms/entities/room.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Booking, BookingHistory, RoomCategory, Room])],
  controllers: [BookingsController],
  providers: [BookingsService, BookingCronService],
  exports: [BookingsService],
})
export class BookingsModule {}
