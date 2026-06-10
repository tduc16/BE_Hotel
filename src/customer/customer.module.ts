import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Customer } from './entities/customer.entity';
import { Voucher } from './entities/voucher.entity';
import { Booking } from '../bookings/entities/booking.entity';
import { BookingHistory } from '../bookings/entities/booking-history.entity';
import { CustomerService } from './customer.service';
import { CustomerController } from './customer.controller';
import { CustomerAuthModule } from '../customer-auth/customer-auth.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Customer, Voucher, Booking, BookingHistory]),
    CustomerAuthModule, // để dùng JwtModule & Guard
  ],
  controllers: [CustomerController],
  providers: [CustomerService],
  exports: [CustomerService],
})
export class CustomerModule {}
