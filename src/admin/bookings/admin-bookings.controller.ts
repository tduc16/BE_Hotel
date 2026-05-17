import { Controller, Get, Param, Patch, Query, UseGuards, Body, Request } from '@nestjs/common';
import { AdminBookingsService } from './admin-bookings.service';
import { QueryBookingDto } from '../../bookings/dto/query-booking.dto';
import { JwtAdminGuard } from '../auth/guards/jwt-admin.guard';
import { UpdateBookingStatusDto, CancelBookingDto, ActionBookingDto } from './dto/update-booking.dto';

@UseGuards(JwtAdminGuard)
@Controller('admin/bookings')
export class AdminBookingsController {
  constructor(private readonly adminBookingsService: AdminBookingsService) {}

  @Get()
  async getBookings(@Query() query: QueryBookingDto) {
    const { data, meta } = await this.adminBookingsService.getBookings(query);
    return {
      success: true,
      data,
      meta,
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

  @Patch(':id/status')
  async updateStatus(
    @Param('id') id: string,
    @Body() body: UpdateBookingStatusDto,
    @Request() req
  ) {
    const adminId = req.user?.id;
    const data = await this.adminBookingsService.updateBookingStatus(id, body.status, adminId, body.note);
    return {
      success: true,
      data,
      message: 'Booking status updated successfully'
    };
  }

  @Patch(':id/confirm')
  async confirmBooking(@Param('id') id: string, @Body() body: ActionBookingDto, @Request() req) {
    const adminId = req.user?.id;
    const data = await this.adminBookingsService.confirmBooking(id, adminId, body?.note);
    return {
      success: true,
      data,
      message: 'Booking confirmed successfully'
    };
  }

  @Patch(':id/checkin')
  async checkInBooking(@Param('id') id: string, @Body() body: ActionBookingDto, @Request() req) {
    const adminId = req.user?.id;
    const data = await this.adminBookingsService.checkInBooking(id, adminId, body?.note);
    return {
      success: true,
      data,
      message: 'Booking checked in successfully'
    };
  }

  @Patch(':id/checkout')
  async checkOutBooking(@Param('id') id: string, @Body() body: ActionBookingDto, @Request() req) {
    const adminId = req.user?.id;
    const data = await this.adminBookingsService.checkOutBooking(id, adminId, body?.note);
    return {
      success: true,
      data,
      message: 'Booking checked out successfully'
    };
  }

  @Patch(':id/cancel')
  async cancelBooking(@Param('id') id: string, @Body() body: CancelBookingDto, @Request() req) {
    const adminId = req.user?.id;
    const data = await this.adminBookingsService.cancelBooking(id, adminId, body?.reason);
    return {
      success: true,
      data,
      message: 'Booking cancelled successfully'
    };
  }
}
