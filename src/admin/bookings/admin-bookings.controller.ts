import { Controller, Get, Param, Patch, Query, UseGuards } from '@nestjs/common';
import { AdminBookingsService } from './admin-bookings.service';
import { QueryBookingDto } from '../../bookings/dto/query-booking.dto';
import { JwtAdminGuard } from '../auth/guards/jwt-admin.guard';

@UseGuards(JwtAdminGuard)
@Controller('api/admin/bookings')
export class AdminBookingsController {
  constructor(private readonly adminBookingsService: AdminBookingsService) {}

  @Get()
  async getBookings(@Query() query: QueryBookingDto) {
    const data = await this.adminBookingsService.getBookings(query);
    return {
      success: true,
      data
    };
  }

  @Get(':id')
  async getBookingDetail(@Param('id') id: string) {
    const data = await this.adminBookingsService.getBookingDetail(id);
    return {
      success: true,
      data
    };
  }

  @Patch(':id/confirm')
  async confirmBooking(@Param('id') id: string) {
    const data = await this.adminBookingsService.confirmBooking(id);
    return {
      success: true,
      data,
      message: 'Booking confirmed successfully'
    };
  }

  @Patch(':id/checkin')
  async checkInBooking(@Param('id') id: string) {
    const data = await this.adminBookingsService.checkInBooking(id);
    return {
      success: true,
      data,
      message: 'Booking checked in successfully'
    };
  }

  @Patch(':id/checkout')
  async checkOutBooking(@Param('id') id: string) {
    const data = await this.adminBookingsService.checkOutBooking(id);
    return {
      success: true,
      data,
      message: 'Booking checked out successfully'
    };
  }

  @Patch(':id/cancel')
  async cancelBooking(@Param('id') id: string) {
    const data = await this.adminBookingsService.cancelBooking(id);
    return {
      success: true,
      data,
      message: 'Booking cancelled successfully'
    };
  }
}
