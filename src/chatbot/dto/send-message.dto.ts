import { IsString, IsNotEmpty, IsOptional, MaxLength } from 'class-validator';

export class SendMessageDto {
  @IsString()
  @IsNotEmpty({ message: 'Tin nhắn không được để trống' })
  @MaxLength(2000, { message: 'Tin nhắn không được vượt quá 2000 ký tự' })
  message: string;

  @IsOptional()
  @IsString()
  sessionId?: string;
}
