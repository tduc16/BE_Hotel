import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Voucher } from './entities/voucher.entity';
import { VoucherUsage } from './entities/voucher-usage.entity';
import { Customer } from '../customer/entities/customer.entity';
import { Booking } from '../bookings/entities/booking.entity';
import { VouchersService } from './vouchers.service';
import { VouchersController } from './vouchers.controller';
import { AdminModule } from '../admin/admin.module';
import { CustomerAuthModule } from '../customer-auth/customer-auth.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Voucher, VoucherUsage, Customer, Booking]),
    AdminModule,
    CustomerAuthModule,
  ],
  controllers: [VouchersController],
  providers: [VouchersService],
  exports: [VouchersService],
})
export class VouchersModule {}
