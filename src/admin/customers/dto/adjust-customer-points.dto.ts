import { IsInt, IsNotEmpty, IsString } from 'class-validator';

export class AdjustCustomerPointsDto {
  /**
   * Số điểm điều chỉnh.
   * Dương (+): cộng điểm
   * Âm (-): trừ điểm
   */
  @IsInt()
  @IsNotEmpty()
  points: number;

  @IsString()
  @IsNotEmpty()
  reason: string;
}
