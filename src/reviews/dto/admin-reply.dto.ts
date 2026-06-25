import { IsNotEmpty, IsString } from 'class-validator';

export class AdminReplyDto {
  @IsString()
  @IsNotEmpty()
  reply: string;
}
