import { IsEnum, IsOptional, IsString } from 'class-validator';
import { BookingStatus } from '../../../bookings/entities/booking.entity';

export class UpdateBookingStatusDto {
  @IsEnum(BookingStatus)
  status: BookingStatus;

  @IsOptional()
  @IsString()
  note?: string;
}

export class CancelBookingDto {
  @IsOptional()
  @IsString()
  reason?: string;
}

export class ActionBookingDto {
  @IsOptional()
  @IsString()
  note?: string;
}
