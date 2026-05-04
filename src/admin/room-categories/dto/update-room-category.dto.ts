import { IsNotEmpty, IsString, IsNumber, Min, IsUrl, IsOptional, IsArray, IsBoolean } from 'class-validator';
import { Transform } from 'class-transformer';

export class UpdateRoomCategoryDto {
  @IsOptional()
  @IsNotEmpty({ message: 'Tên hạng phòng không được để trống' })
  @IsString()
  @Transform(({ value }) => typeof value === 'string' ? value.trim() : value)
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsNumber()
  @Min(1, { message: 'Giá cơ bản phải lớn hơn 0' })
  base_price?: number;

  @IsOptional()
  @IsNumber()
  @Min(1, { message: 'Sức chứa tối thiểu phải là 1' })
  capacity?: number;

  @IsOptional()
  @IsUrl({}, { message: 'Thumbnail URL phải là một URL hợp lệ' })
  thumbnail_url?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  amenities?: string[];

  @IsOptional()
  @IsBoolean()
  is_active?: boolean;
}
