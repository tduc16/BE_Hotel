import {
  Controller,
  Get,
  Patch,
  Param,
  UseGuards,
  Request,
} from '@nestjs/common';
import { CustomerService } from './customer.service';
import { JwtCustomerGuard } from '../customer-auth/guards/jwt-customer.guard';

@Controller('customer')
@UseGuards(JwtCustomerGuard)
export class CustomerController {
  constructor(private readonly customerService: CustomerService) {}

  @Get('profile')
  async getProfile(@Request() req) {
    const data = await this.customerService.getProfile(req.user.id);
    return {
      success: true,
      data,
    };
  }

  @Get('bookings')
  async getBookings(@Request() req) {
    const data = await this.customerService.getBookings(req.user.id);
    return {
      success: true,
      data,
    };
  }

  @Get('bookings/:id')
  async getBookingById(@Request() req, @Param('id') id: string) {
    const data = await this.customerService.getBookingById(req.user.id, id);
    return {
      success: true,
      data,
    };
  }

  @Patch('bookings/:id/cancel')
  async cancelBooking(@Request() req, @Param('id') id: string) {
    const data = await this.customerService.cancelBooking(req.user.id, id);
    return data;
  }

  @Get('dashboard')
  async getDashboard(@Request() req) {
    const data = await this.customerService.getDashboard(req.user.id);
    return {
      success: true,
      data,
    };
  }

  @Get('vouchers')
  async getVouchers(@Request() req) {
    const data = await this.customerService.getVouchers(req.user.id);
    return {
      success: true,
      data,
    };
  }
}
