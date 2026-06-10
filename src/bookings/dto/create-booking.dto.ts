import {
  IsNotEmpty,
  IsString,
  IsEmail,
  IsOptional,
  IsUUID,
  IsInt,
  Min,
  IsEnum,
  Matches,
} from 'class-validator';
import { PaymentMethod } from '../entities/booking.entity';

export class CreateBookingDto {
  @IsNotEmpty({ message: 'Tên khách hàng không được để trống' })
  @IsString()
  customer_name: string;

  @IsNotEmpty({ message: 'Số điện thoại không được để trống' })
  @IsString()
  @Matches(/^(0[3|5|7|8|9])+([0-9]{8})\b/, {
    message: 'Số điện thoại không hợp lệ',
  })
  phone: string;

  @IsNotEmpty({ message: 'Email không được để trống' })
  @IsEmail({}, { message: 'Email không đúng định dạng' })
  email: string;

  @IsOptional()
  @IsString()
  note?: string;

  @IsNotEmpty({ message: 'Loại phòng không được để trống' })
  @IsUUID('4', { message: 'Loại phòng ID không hợp lệ' })
  room_category_id: string;

  @IsNotEmpty({ message: 'Ngày nhận phòng không được để trống' })
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'Ngày nhận phòng phải theo định dạng YYYY-MM-DD',
  })
  check_in_date: string;

  @IsNotEmpty({ message: 'Ngày trả phòng không được để trống' })
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'Ngày trả phòng phải theo định dạng YYYY-MM-DD',
  })
  check_out_date: string;

  @IsNotEmpty({ message: 'Số khách không được để trống' })
  @IsInt({ message: 'Số khách phải là số nguyên' })
  @Min(1, { message: 'Số khách tối thiểu là 1' })
  guest_count: number;

  @IsNotEmpty({ message: 'Phương thức thanh toán không được để trống' })
  @IsEnum(PaymentMethod, { message: 'Phương thức thanh toán không hợp lệ' })
  payment_method: PaymentMethod;
}
