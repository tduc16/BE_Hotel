import { IsOptional, IsString, IsEnum } from 'class-validator';
import { BookingStatus, PaymentStatus } from '../entities/booking.entity';

export class QueryBookingDto {
  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsEnum(BookingStatus)
  booking_status?: BookingStatus;

  @IsOptional()
  @IsEnum(PaymentStatus)
  payment_status?: PaymentStatus;

  @IsOptional()
  @IsString()
  room_category_id?: string;
  
  @IsOptional()
  @IsString()
  date?: string; // Query with check_in_date or overlap
}
