import { IsEmail, IsNotEmpty, MinLength } from 'class-validator';

export class ResetPasswordDto {
  @IsEmail({}, { message: 'Email không đúng định dạng' })
  @IsNotEmpty({ message: 'Email không được để trống' })
  email: string;

  @IsNotEmpty({ message: 'Token không được để trống' })
  token: string;

  @IsNotEmpty({ message: 'Mật khẩu mới không được để trống' })
  @MinLength(8, { message: 'Mật khẩu phải có tối thiểu 8 ký tự' })
  newPassword: string;

  @IsNotEmpty({ message: 'Mật khẩu xác nhận không được để trống' })
  @MinLength(8, { message: 'Mật khẩu xác nhận phải có tối thiểu 8 ký tự' })
  confirmPassword: string;
}
