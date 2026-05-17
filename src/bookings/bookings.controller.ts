import { Controller, Post, Body, Get, Param, BadRequestException, NotFoundException } from '@nestjs/common';
import { BookingsService } from './bookings.service';
import { CreateBookingDto } from './dto/create-booking.dto';
import { validate } from 'class-validator';
import { PaymentMethod } from './entities/booking.entity';

@Controller('bookings')
export class BookingsController {
  constructor(private readonly bookingsService: BookingsService) {}

  @Post()
  async createBooking(@Body() body: Record<string, any>) {
    console.log(`[BookingsController.createBooking] Raw body:`, body);

    const dto = new CreateBookingDto();
    
    // Map camelCase to snake_case
    dto.room_category_id = body.roomCategoryId || body.roomId || body.room_category_id;
    dto.check_in_date = body.checkInDate || body.check_in_date;
    dto.check_out_date = body.checkOutDate || body.check_out_date;
    
    // Parse guest count strictly
    const guestCount = body.guestCount || body.guest_count;
    dto.guest_count = typeof guestCount === 'string' ? parseInt(guestCount, 10) : guestCount;

    // Log sơ bộ tại controller (capacity sẽ được validate trong service sau khi query DB)
    console.log('[BookingsController] guest_count nhận được:', {
      rawGuestCount: guestCount,
      parsedGuestCount: dto.guest_count,
      roomId: dto.room_category_id,
    });
    
    const customerInfo = body.customerInfo || {};
    dto.customer_name = customerInfo.name || body.customer_name || body.customerName;
    dto.phone = customerInfo.phone || body.phone;
    dto.email = customerInfo.email || body.email;
    dto.note = customerInfo.note || body.note;
    dto.payment_method = body.paymentMethod || body.payment_method || PaymentMethod.CASH;

    console.log(`[BookingsController.createBooking] Mapped DTO:`, dto);

    // Validate manually
    const errors = await validate(dto);
    if (errors.length > 0) {
      console.log(`[BookingsController.createBooking] Validation failed:`, errors);
      const messages = errors.map(err => Object.values(err.constraints || {}).join(', '));
      throw new BadRequestException({ message: 'Validation failed', errors: messages });
    }

    const booking = await this.bookingsService.createBooking(dto);
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
