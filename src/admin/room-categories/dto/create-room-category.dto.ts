import {
  IsNotEmpty,
  IsString,
  IsNumber,
  Min,
  IsUrl,
  IsOptional,
  IsArray,
  IsBoolean,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';

export class CreateRoomCategoryDto {
  @IsNotEmpty({ message: 'Tên hạng phòng không được để trống' })
  @IsString()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsNotEmpty({ message: 'Giá cơ bản là bắt buộc' })
  @Type(() => Number)
  @IsNumber()
  @Min(1, { message: 'Giá cơ bản phải lớn hơn 0' })
  base_price: number;

  @IsNotEmpty({ message: 'Sức chứa là bắt buộc' })
  @Type(() => Number)
  @IsNumber()
  @Min(1, { message: 'Sức chứa tối thiểu phải là 1' })
  capacity: number;

  @IsOptional()
  @IsString({ message: 'Thumbnail URL phải là chuỗi hợp lệ' })
  thumbnail_url?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @Transform(({ value }) => {
    if (typeof value === 'string') {
      try {
        const parsed = JSON.parse(value);
        if (Array.isArray(parsed)) return parsed;
      } catch (e) {}
      return [value];
    }
    return Array.isArray(value) ? value : [];
  })
  amenities?: string[];

  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => value === 'true' || value === true)
  is_active?: boolean;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @Transform(({ value }) => {
    if (typeof value === 'string') {
      try {
        const parsed = JSON.parse(value);
        if (Array.isArray(parsed)) return parsed;
      } catch (e) {}
      return [value];
    }
    return Array.isArray(value) ? value : [];
  })
  gallery_images?: string[];
}
