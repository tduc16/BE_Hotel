import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
  BadRequestException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiOkResponse,
  ApiNotFoundResponse,
  ApiBadRequestResponse,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { PublicBookingsService } from './public-bookings.service';
import {
  SearchBookingDto,
  CancelBookingDto,
  PublicBookingResponseDto,
} from './dto/public-booking.dto';
import { BookingAvailabilityService } from '../bookings/booking-availability.service';

@ApiTags('Public Bookings - Tra cứu & Hủy (Không cần đăng nhập)')
@Controller('public/bookings')
export class PublicBookingsController {
  constructor(
    private readonly publicBookingsService: PublicBookingsService,
    private readonly bookingAvailabilityService: BookingAvailabilityService,
  ) {}

  /**
   * GET /api/public/bookings/availability
   * Kiểm tra phòng trống theo hạng phòng và ngày.
   * Frontend dùng để hiển thị "Còn phòng" / "Đã hết phòng" trước khi submit booking.
   */
  @Get('availability')
  @ApiOperation({
    summary: 'Kiểm tra phòng trống',
    description: 'Kiểm tra hạng phòng có còn phòng trống trong khoảng thời gian đã chọn.',
  })
  @ApiQuery({ name: 'categoryId', description: 'ID hạng phòng (UUID)', example: 'uuid-v4' })
  @ApiQuery({ name: 'checkIn', description: 'Ngày nhận phòng (YYYY-MM-DD)', example: '2026-07-01' })
  @ApiQuery({ name: 'checkOut', description: 'Ngày trả phòng (YYYY-MM-DD)', example: '2026-07-03' })
  @ApiQuery({ name: 'guestCount', description: 'Số khách (tùy chọn)', required: false, example: 2 })
  @ApiOkResponse({ description: 'Kết quả kiểm tra phòng trống' })
  async checkAvailability(
    @Query('categoryId') categoryId: string,
    @Query('checkIn') checkIn: string,
    @Query('checkOut') checkOut: string,
    @Query('guestCount') guestCountStr?: string,
  ) {
    if (!categoryId || !checkIn || !checkOut) {
      throw new BadRequestException('Vui lòng cung cấp categoryId, checkIn và checkOut');
    }

    // Validate date format
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(checkIn) || !dateRegex.test(checkOut)) {
      throw new BadRequestException('Định dạng ngày phải là YYYY-MM-DD');
    }

    const checkInDate = new Date(checkIn);
    const checkOutDate = new Date(checkOut);

    if (isNaN(checkInDate.getTime()) || isNaN(checkOutDate.getTime())) {
      throw new BadRequestException('Ngày không hợp lệ');
    }

    if (checkOutDate <= checkInDate) {
      throw new BadRequestException('Ngày trả phòng phải sau ngày nhận phòng');
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (checkInDate < today) {
      throw new BadRequestException('Ngày nhận phòng không thể nằm trong quá khứ');
    }

    const guestCount = guestCountStr ? parseInt(guestCountStr, 10) : undefined;

    const result = await this.bookingAvailabilityService.checkCategoryAvailability(
      categoryId,
      checkIn,
      checkOut,
      guestCount,
    );

    return {
      success: true,
      data: result,
    };
  }

  /**
   * GET /api/public/bookings/search?bookingCode=BK20260001&phone=0901234567
   * Tra cứu thông tin booking bằng mã đặt phòng và số điện thoại.
   */
  @Get('search')
  @ApiOperation({
    summary: 'Tra cứu booking',
    description: 'Tra cứu thông tin đặt phòng bằng mã booking và số điện thoại. Không cần đăng nhập.',
  })
  @ApiQuery({ name: 'bookingCode', description: 'Mã đặt phòng', example: 'BK20260001' })
  @ApiQuery({ name: 'phone', description: 'Số điện thoại đã đăng ký', example: '0901234567' })
  @ApiOkResponse({ description: 'Thông tin booking', type: PublicBookingResponseDto })
  @ApiNotFoundResponse({ description: 'BOOKING_NOT_FOUND — Không tìm thấy booking' })
  async searchBooking(@Query() query: SearchBookingDto) {
    const booking = await this.publicBookingsService.searchBooking(query);
    return {
      success: true,
      data: booking,
    };
  }

  /**
   * GET /api/public/bookings/manage/:token
   * Lấy chi tiết booking qua booking_token (dùng cho trang quản lý).
   */
  @Get('manage/:token')
  @ApiOperation({
    summary: 'Chi tiết booking qua token',
    description: 'Lấy thông tin chi tiết booking qua booking_token (link trong email xác nhận). Không cần đăng nhập.',
  })
  @ApiParam({ name: 'token', description: 'Booking token (UUID) từ link trong email' })
  @ApiOkResponse({ description: 'Thông tin booking', type: PublicBookingResponseDto })
  @ApiNotFoundResponse({ description: 'BOOKING_NOT_FOUND — Token không hợp lệ hoặc không tồn tại' })
  async getBookingByToken(@Param('token') token: string) {
    const booking = await this.publicBookingsService.getBookingByToken(token);
    return {
      success: true,
      data: booking,
    };
  }

  /**
   * POST /api/public/bookings/cancel
   * Hủy booking bằng (bookingCode + phone) hoặc token.
   */
  @Post('cancel')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Hủy booking',
    description: `
      Hủy đặt phòng. Cho phép 2 cách xác thực:
      - Cách 1: Cung cấp bookingCode + phone
      - Cách 2: Cung cấp token (từ link trong email)

      **Điều kiện hủy:**
      - Trạng thái phải là PENDING hoặc CONFIRMED
      - Ngày hiện tại phải trước ngày nhận phòng
    `,
  })
  @ApiOkResponse({ description: 'Hủy thành công — trả về thông tin booking đã hủy', type: PublicBookingResponseDto })
  @ApiNotFoundResponse({ description: 'BOOKING_NOT_FOUND — Không tìm thấy booking' })
  @ApiBadRequestResponse({ description: 'Booking không đủ điều kiện hủy' })
  async cancelBooking(@Body() body: CancelBookingDto) {
    const booking = await this.publicBookingsService.cancelBooking(body);
    return {
      success: true,
      message: 'Hủy đặt phòng thành công',
      data: booking,
    };
  }
}
