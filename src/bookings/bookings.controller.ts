import { Controller, Post, Body, Get, Param, BadRequestException, NotFoundException } from '@nestjs/common';
import { BookingsService } from './bookings.service';
import { CreateBookingDto } from './dto/create-booking.dto';

@Controller('api/bookings')
export class BookingsController {
  constructor(private readonly bookingsService: BookingsService) {}

  @Post()
  async createBooking(@Body() createBookingDto: CreateBookingDto) {
    const booking = await this.bookingsService.createBooking(createBookingDto);
    return {
      success: true,
      message: 'Đặt phòng thành công',
      data: {
        booking_code: booking.booking_code,
        total_amount: booking.total_amount,
        payment_status: booking.payment_status,
        booking_status: booking.booking_status
      }
    };
  }

  @Get(':code')
  async getBooking(@Param('code') code: string) {
    const booking = await this.bookingsService.getBookingByCode(code);
    return {
      success: true,
      data: {
        booking_code: booking.booking_code,
        customer_name: booking.customer_name,
        room_type: booking.room_category?.name,
        room_number: booking.room?.room_number || null,
        check_in: booking.check_in_date,
        check_out: booking.check_out_date,
        total_amount: booking.total_amount,
        payment_status: booking.payment_status,
        booking_status: booking.booking_status
      }
    };
  }
}
