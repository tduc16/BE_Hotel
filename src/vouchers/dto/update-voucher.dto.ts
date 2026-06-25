import { PartialType } from '@nestjs/mapped-types';
import { CreateVoucherDto } from './create-voucher.dto';
import { IsOptional, IsString, Matches } from 'class-validator';

export class UpdateVoucherDto extends PartialType(CreateVoucherDto) {
  @IsOptional()
  @IsString()
  @Matches(/^[A-Z0-9_\-]{3,50}$/, { message: 'Mã voucher chỉ chứa chữ in hoa, số, dấu gạch ngang/dưới, từ 3-50 ký tự' })
  code?: string;
}
