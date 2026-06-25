import { IsNotEmpty, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class GuestBookingLookupDto {
  @ApiProperty({
    description: 'Mã đặt phòng (booking code)',
    example: 'BK20260025',
  })
  @IsNotEmpty({ message: 'Mã đặt phòng không được để trống' })
  @IsString({ message: 'Mã đặt phòng phải là chuỗi' })
  bookingCode: string;

  @ApiProperty({
    description: 'Số điện thoại đăng ký đặt phòng',
    example: '0918154874',
  })
  @IsNotEmpty({ message: 'Số điện thoại không được để trống' })
  @IsString({ message: 'Số điện thoại phải là chuỗi' })
  phone: string;
}
