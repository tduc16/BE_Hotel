import {
  Controller,
  Post,
  Get,
  Patch,
  Body,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { CustomerAuthService } from './customer-auth.service';
import { RegisterCustomerDto } from './dto/register-customer.dto';
import { LoginCustomerDto } from './dto/login-customer.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { JwtCustomerGuard } from './guards/jwt-customer.guard';

@Controller('customer-auth')
export class CustomerAuthController {
  constructor(private readonly authService: CustomerAuthService) {}

  @Post('register')
  async register(@Body() dto: RegisterCustomerDto) {
    const data = await this.authService.register(dto);
    return {
      success: true,
      message: 'Đăng ký tài khoản thành công',
      data,
    };
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() dto: LoginCustomerDto) {
    const data = await this.authService.login(dto);
    return {
      success: true,
      message: 'Đăng nhập thành công',
      data,
    };
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logout() {
    return {
      success: true,
      message: 'Đăng xuất thành công',
    };
  }

  @UseGuards(JwtCustomerGuard)
  @Get('me')
  async getMe(@Request() req) {
    const data = await this.authService.getMe(req.user.id);
    return {
      success: true,
      data,
    };
  }

  @UseGuards(JwtCustomerGuard)
  @Patch('change-password')
  async changePassword(@Request() req, @Body() dto: ChangePasswordDto) {
    const data = await this.authService.changePassword(req.user.id, dto);
    return data;
  }

  @UseGuards(JwtCustomerGuard)
  @Patch('profile')
  async updateProfile(@Request() req, @Body() dto: UpdateProfileDto) {
    const data = await this.authService.updateProfile(req.user.id, dto);
    return {
      success: true,
      message: 'Cập nhật thông tin thành công',
      data,
    };
  }
}
