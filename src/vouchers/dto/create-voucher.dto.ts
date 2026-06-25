import {
  IsNotEmpty,
  IsString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsBoolean,
  IsInt,
  Min,
  Matches,
  Max,
} from 'class-validator';
import {
  ApplicableTo,
  DiscountType,
  VoucherStatus,
  RequiredMembershipLevel,
} from '../entities/voucher.entity';
import { Type } from 'class-transformer';

export class CreateVoucherDto {
  @IsNotEmpty({ message: 'Mã voucher không được để trống' })
  @IsString()
  @Matches(/^[A-Z0-9_\-]{3,50}$/, { message: 'Mã voucher chỉ chứa chữ in hoa, số, dấu gạch ngang/dưới, từ 3-50 ký tự' })
  code: string;

  @IsNotEmpty({ message: 'Tên voucher không được để trống' })
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsEnum(DiscountType, { message: 'Loại giảm giá không hợp lệ' })
  discountType: DiscountType;

  @IsNumber({}, { message: 'Giá trị giảm phải là số' })
  @Min(0, { message: 'Giá trị giảm không thể nhỏ hơn 0' })
  @Type(() => Number)
  discountValue: number;

  @IsOptional()
  @IsNumber({}, { message: 'Giảm giá tối đa phải là số' })
  @Min(0, { message: 'Giảm giá tối đa không thể nhỏ hơn 0' })
  @Type(() => Number)
  maxDiscountAmount?: number;

  @IsOptional()
  @IsNumber({}, { message: 'Giá trị đơn tối thiểu phải là số' })
  @Min(0, { message: 'Giá trị đơn tối thiểu không thể nhỏ hơn 0' })
  @Type(() => Number)
  minBookingAmount?: number;

  @IsNotEmpty({ message: 'Ngày bắt đầu không được để trống' })
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'Ngày bắt đầu phải theo định dạng YYYY-MM-DD' })
  startDate: string;

  @IsNotEmpty({ message: 'Ngày kết thúc không được để trống' })
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'Ngày kết thúc phải theo định dạng YYYY-MM-DD' })
  endDate: string;

  @IsOptional()
  @IsInt({ message: 'Giới hạn lượt dùng phải là số nguyên' })
  @Min(1, { message: 'Giới hạn lượt dùng tối thiểu là 1' })
  @Type(() => Number)
  usageLimit?: number;

  @IsOptional()
  @IsInt({ message: 'Giới hạn mỗi khách hàng phải là số nguyên' })
  @Min(1, { message: 'Giới hạn mỗi khách hàng tối thiểu là 1' })
  @Type(() => Number)
  usageLimitPerCustomer?: number;

  @IsEnum(ApplicableTo, { message: 'Đối tượng áp dụng không hợp lệ' })
  applicableTo: ApplicableTo;

  @IsOptional()
  @IsEnum(RequiredMembershipLevel, { message: 'Hạng thành viên yêu cầu không hợp lệ' })
  requiredMembershipLevel?: RequiredMembershipLevel;

  @IsOptional()
  @IsInt({ message: 'Số lượng đặt phòng yêu cầu phải là số nguyên' })
  @Min(0, { message: 'Số lượng đặt phòng yêu cầu không thể nhỏ hơn 0' })
  @Type(() => Number)
  requiredBookingCount?: number;

  @IsOptional()
  @IsNumber({}, { message: 'Tổng chi tiêu yêu cầu phải là số' })
  @Min(0, { message: 'Tổng chi tiêu yêu cầu không thể nhỏ hơn 0' })
  @Type(() => Number)
  requiredTotalSpent?: number;

  @IsEnum(VoucherStatus, { message: 'Trạng thái không hợp lệ' })
  status: VoucherStatus;

  @IsBoolean({ message: 'isPublic phải là kiểu boolean' })
  isPublic: boolean;
}
