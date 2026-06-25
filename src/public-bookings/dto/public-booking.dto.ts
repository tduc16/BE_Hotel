import { ApiProperty } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsString,
  Matches,
  IsOptional,
  ValidateIf,
  IsUUID,
} from 'class-validator';

export class SearchBookingDto {
  @ApiProperty({
    description: 'Mã đặt phòng (booking code)',
    example: 'BK20260001',
  })
  @IsNotEmpty({ message: 'Mã đặt phòng không được để trống' })
  @IsString()
  bookingCode: string;

  @ApiProperty({
    description: 'Số điện thoại đăng ký đặt phòng',
    example: '0901234567',
  })
  @IsNotEmpty({ message: 'Số điện thoại không được để trống' })
  @IsString()
  @Matches(/^(0[3|5|7|8|9])+([0-9]{8})\b/, {
    message: 'Số điện thoại không hợp lệ',
  })
  phone: string;
}

export class CancelBookingDto {
  @ApiProperty({
    description: 'Mã đặt phòng (dùng kèm với phone)',
    example: 'BK20260001',
    required: false,
  })
  @ValidateIf((o) => !o.token)
  @IsNotEmpty({ message: 'Mã đặt phòng không được để trống khi không có token' })
  @IsString()
  bookingCode?: string;

  @ApiProperty({
    description: 'Số điện thoại (dùng kèm với bookingCode)',
    example: '0901234567',
    required: false,
  })
  @ValidateIf((o) => !o.token)
  @IsNotEmpty({ message: 'Số điện thoại không được để trống khi không có token' })
  @IsString()
  @Matches(/^(0[3|5|7|8|9])+([0-9]{8})\b/, {
    message: 'Số điện thoại không hợp lệ',
  })
  phone?: string;

  @ApiProperty({
    description: 'Token quản lý booking (thay thế cho bookingCode + phone)',
    example: 'a3b4c5d6-e7f8-...',
    required: false,
  })
  @ValidateIf((o) => !o.bookingCode)
  @IsNotEmpty({ message: 'Token không được để trống khi không có bookingCode' })
  @IsUUID('4', { message: 'Token không hợp lệ' })
  token?: string;
}

export class PublicBookingResponseDto {
  @ApiProperty({ example: 'uuid-v4' })
  id: string;

  @ApiProperty({ example: 'BK20260001' })
  bookingCode: string;

  @ApiProperty({ example: 'Nguyễn Văn A' })
  customerName: string;

  @ApiProperty({ example: '0901234567' })
  phone: string;

  @ApiProperty({ example: 'guest@email.com' })
  email: string;

  @ApiProperty({ example: 'Yêu cầu thêm: giường phụ', nullable: true })
  note: string | null;

  @ApiProperty({ example: 'Deluxe Ocean View' })
  roomName: string;

  @ApiProperty({ example: '101', nullable: true })
  roomNumber: string | null;

  @ApiProperty({ example: '2026-06-15' })
  checkInDate: string;

  @ApiProperty({ example: '2026-06-18' })
  checkOutDate: string;

  @ApiProperty({ example: 2 })
  guestCount: number;

  @ApiProperty({ example: 3 })
  nightCount: number;

  @ApiProperty({ example: 500000 })
  roomPrice: number;

  @ApiProperty({ example: 1500000, description: 'Tổng tiền trước giảm giá (nightCount * roomPrice)' })
  subtotal: number;

  @ApiProperty({ example: 100000, description: 'Số tiền giảm từ voucher' })
  discountAmount: number;

  @ApiProperty({ example: 1400000 })
  totalAmount: number;

  @ApiProperty({ example: 'SUMMER2026', nullable: true })
  voucherCode: string | null;

  @ApiProperty({ example: 'PENDING' })
  bookingStatus: string;

  @ApiProperty({ example: 'UNPAID' })
  paymentStatus: string;

  @ApiProperty({ example: 'CASH' })
  paymentMethod: string;

  @ApiProperty({ example: '2026-06-10T10:00:00.000Z' })
  createdAt: Date;
}

