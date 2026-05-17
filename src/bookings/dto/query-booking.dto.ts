import { IsOptional, IsString, IsEnum, IsInt, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { BookingStatus, PaymentStatus } from '../entities/booking.entity';

export class QueryBookingDto {
  @IsOptional()
  @IsString()
  search?: string;

  /** Frontend gửi ?status=... */
  @IsOptional()
  @IsEnum(BookingStatus)
  status?: BookingStatus;

  /** Alias cũ – vẫn giữ để backward compatible */
  @IsOptional()
  @IsEnum(BookingStatus)
  booking_status?: BookingStatus;

  @IsOptional()
  @IsEnum(PaymentStatus)
  payment_status?: PaymentStatus;

  @IsOptional()
  @IsString()
  room_category_id?: string;

  /** Filter theo ngày check-in từ */
  @IsOptional()
  @IsString()
  check_in_from?: string;

  /** Filter theo ngày check-in đến */
  @IsOptional()
  @IsString()
  check_in_to?: string;

  @IsOptional()
  @IsString()
  date?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number = 10;
}
