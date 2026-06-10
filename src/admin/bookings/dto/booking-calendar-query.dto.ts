import { IsNotEmpty, IsString, Matches } from 'class-validator';

export class GetBookingCalendarDto {
  @IsNotEmpty({ message: 'startDate không được để trống' })
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'startDate phải có định dạng YYYY-MM-DD',
  })
  startDate: string;

  @IsNotEmpty({ message: 'endDate không được để trống' })
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'endDate phải có định dạng YYYY-MM-DD',
  })
  endDate: string;
}
