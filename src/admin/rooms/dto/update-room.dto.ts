import { IsOptional, IsString, IsEnum, IsUUID } from 'class-validator';

export class UpdateRoomDto {
  @IsOptional()
  @IsString()
  room_number?: string;

  @IsOptional()
  @IsEnum(['AVAILABLE', 'OCCUPIED', 'MAINTENANCE'], {
    message: 'Status must be AVAILABLE, OCCUPIED, or MAINTENANCE',
  })
  status?: string;

  @IsOptional()
  @IsUUID()
  category_id?: string;
}
