import {
  Controller,
  Post,
  Body,
  Get,
  Param,
  BadRequestException,
  NotFoundException,
  Req,
  Patch,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { BookingsService } from './bookings.service';
import { CreateBookingDto } from './dto/create-booking.dto';
import { GuestBookingLookupDto } from './dto/guest-booking-lookup.dto';
import { validate } from 'class-validator';
import { PaymentMethod } from './entities/booking.entity';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';

@Controller('bookings')
export class BookingsController {
  constructor(
    private readonly bookingsService: BookingsService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * POST /api/bookings
   * Tạo booking mới. Chấp nhận cả khách vãng lai lẫn customer đã đăng nhập.
   */
  @Post()
  async createBooking(@Body() body: Record<string, any>, @Req() req: any) {
    const dto = new CreateBookingDto();

    // Map camelCase → snake_case (hỗ trợ cả 2 dạng input)
    dto.room_category_id = body.roomCategoryId || body.roomId || body.room_category_id;
    dto.check_in_date = body.checkInDate || body.check_in_date;
    dto.check_out_date = body.checkOutDate || body.check_out_date;

    const guestCount = body.guestCount ?? body.guest_count;
    dto.guest_count = typeof guestCount === 'string' ? parseInt(guestCount, 10) : guestCount;

    const customerInfo = body.customerInfo || {};
    dto.customer_name = customerInfo.name || body.customer_name || body.customerName;
    dto.phone = customerInfo.phone || body.phone;
    dto.email = customerInfo.email || body.email;
    dto.note = customerInfo.note || body.note;
    dto.payment_method = body.paymentMethod || body.payment_method || PaymentMethod.CASH;
    dto.voucherCode = body.voucherCode || body.voucher_code;

    // Validate DTO
    const errors = await validate(dto);
    if (errors.length > 0) {
      const messages = errors.map((err) => Object.values(err.constraints || {}).join(', '));
      throw new BadRequestException({ message: 'Dữ liệu không hợp lệ', errors: messages });
    }

    // Tự động lấy customerId từ JWT nếu có
    let customerId: string | null = null;
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      try {
        const payload = await this.jwtService.verifyAsync(token, {
          secret: this.configService.get<string>('JWT_SECRET'),
        });
        if (payload && payload.role === 'CUSTOMER') {
          customerId = payload.id;
        }
      } catch {
        // Token không hợp lệ → coi như khách vãng lai
      }
    }

    const booking = await this.bookingsService.createBooking(dto, customerId);

    return {
      success: true,
      message: 'Đặt phòng thành công',
      data: {
        id: booking.id,
        bookingCode: booking.booking_code,
        customerName: booking.customer_name,
        phone: booking.phone,
        email: booking.email,
        roomName: (booking as any).roomName || null,
        roomNumber: (booking as any).roomNumber || null,
        checkInDate: booking.check_in_date,
        checkOutDate: booking.check_out_date,
        guestCount: booking.guest_count,
        nightCount: booking.night_count,
        roomPrice: Number(booking.room_price),
        subtotal: Number(booking.subtotal),
        discountAmount: Number(booking.discountAmount),
        totalAmount: Number(booking.total_amount),
        voucherCode: booking.voucherCode || null,
        paymentMethod: booking.payment_method,
        paymentStatus: booking.payment_status,
        bookingStatus: booking.booking_status,
        createdAt: booking.created_at,
        // QR chuyển khoản
        bankQrUrl: (booking as any).bankQrUrl || null,
        bankTransferContent: (booking as any).bankTransferContent || null,
        bankInfo: (booking as any).bankInfo || null,
        // Backward compat fields
        booking_code: booking.booking_code,
        total_amount: Number(booking.total_amount),
        original_amount: Number(booking.subtotal),
        discount_amount: Number(booking.discountAmount),
        voucher_code: booking.voucherCode,
        payment_status: booking.payment_status,
        booking_status: booking.booking_status,
      },
    };
  }

  /**
   * GET /api/bookings/:code
   * Lấy thông tin booking theo booking code.
   */
  @Get(':code')
  async getBooking(@Param('code') code: string) {
    const booking = await this.bookingsService.getBookingByCode(code);
    return {
      success: true,
      data: {
        id: booking.id,
        bookingCode: booking.booking_code,
        customerName: booking.customer_name,
        phone: booking.phone,
        email: booking.email,
        note: booking.note,
        roomName: booking.roomCategory?.name || null,
        roomNumber: booking.room?.room_number || null,
        checkInDate: booking.check_in_date,
        checkOutDate: booking.check_out_date,
        guestCount: booking.guest_count,
        nightCount: booking.night_count,
        roomPrice: Number(booking.room_price),
        subtotal: Number(booking.subtotal),
        discountAmount: Number(booking.discountAmount),
        totalAmount: Number(booking.total_amount),
        voucherCode: booking.voucherCode || null,
        paymentMethod: booking.payment_method,
        paymentStatus: booking.payment_status,
        bookingStatus: booking.booking_status,
        bankQrUrl: booking.bankQrUrl || null,
        bankTransferContent: booking.bankTransferContent || null,
        paidAt: booking.paidAt || null,
        createdAt: booking.created_at,
        // Backward compat
        booking_code: booking.booking_code,
        room_type: booking.roomCategory?.name,
        room_number: booking.room?.room_number || null,
        check_in: booking.check_in_date,
        check_out: booking.check_out_date,
        total_amount: Number(booking.total_amount),
        original_amount: Number(booking.subtotal),
        discount_amount: Number(booking.discountAmount),
        voucher_code: booking.voucherCode,
        payment_status: booking.payment_status,
        booking_status: booking.booking_status,
      },
    };
  }

  /**
   * POST /api/bookings/lookup
   * Tra cứu booking theo bookingCode + phone (khách vãng lai không cần đăng nhập).
   */
  @Post('lookup')
  @HttpCode(HttpStatus.OK)
  async lookupBooking(@Body() dto: GuestBookingLookupDto) {
    const booking = await this.bookingsService.guestLookup(dto.bookingCode, dto.phone);
    if (!booking) {
      throw new NotFoundException(
        'Không tìm thấy đơn đặt phòng phù hợp với mã đặt phòng và số điện thoại.',
      );
    }
    return {
      success: true,
      data: booking,
    };
  }

  /**
   * PATCH /api/bookings/guest-cancel
   * Hủy booking theo bookingCode + phone.
   */
  @Patch('guest-cancel')
  @HttpCode(HttpStatus.OK)
  async guestCancelBooking(@Body() dto: GuestBookingLookupDto) {
    const booking = await this.bookingsService.guestCancel(dto.bookingCode, dto.phone);
    return {
      success: true,
      message: 'Hủy đặt phòng thành công.',
      data: booking,
    };
  }
}
