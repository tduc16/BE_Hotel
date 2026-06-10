import { IsNotEmpty, IsString, IsUUID, Matches } from 'class-validator';
import { Transform } from 'class-transformer';

export class CreateRoomDto {
  @IsNotEmpty({ message: 'Room number is required' })
  @IsString()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @Matches(/.*\S.*/, {
    message: 'Room number cannot be empty or just whitespace',
  })
  room_number: string;

  @IsNotEmpty({ message: 'Category ID is required' })
  @IsUUID('all', { message: 'Category ID must be a valid UUID' })
  category_id: string;
}
