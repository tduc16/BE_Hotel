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

export class UpdateRoomCategoryDto {
  @IsOptional()
  @IsNotEmpty({ message: 'Tên hạng phòng không được để trống' })
  @IsString()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1, { message: 'Giá cơ bản phải lớn hơn 0' })
  base_price?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1, { message: 'Sức chứa tối thiểu phải là 1' })
  capacity?: number;

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
  @Transform(({ value }) => {
    if (value === 'true') return true;
    if (value === 'false') return false;
    return value;
  })
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
  remove_gallery_images?: string[];

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
  append_gallery_images?: string[];

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
  serviceIds?: string[];
}
