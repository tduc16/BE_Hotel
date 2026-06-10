import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
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

@ApiTags('Public Bookings - Tra cứu & Hủy (Không cần đăng nhập)')
@Controller('public/bookings')
export class PublicBookingsController {
  constructor(private readonly publicBookingsService: PublicBookingsService) {}

  /**
   * GET /api/public/bookings/search?bookingCode=BK20260001&phone=0901234567
   * Tra cứu thông tin booking bằng mã đặt phòng và số điện thoại.
   */
  @Get('search')
  @ApiOperation({
    summary: 'Tra cứu booking',
    description:
      'Tra cứu thông tin đặt phòng bằng mã booking và số điện thoại. Không cần đăng nhập.',
  })
  @ApiQuery({
    name: 'bookingCode',
    description: 'Mã đặt phòng',
    example: 'BK20260001',
  })
  @ApiQuery({
    name: 'phone',
    description: 'Số điện thoại đã đăng ký',
    example: '0901234567',
  })
  @ApiOkResponse({
    description: 'Thông tin booking',
    type: PublicBookingResponseDto,
  })
  @ApiNotFoundResponse({
    description: 'BOOKING_NOT_FOUND — Không tìm thấy booking',
  })
  @ApiBadRequestResponse({
    description: 'INVALID_PHONE — Số điện thoại không hợp lệ',
  })
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
    description:
      'Lấy thông tin chi tiết booking qua booking_token (link trong email xác nhận). Không cần đăng nhập.',
  })
  @ApiParam({
    name: 'token',
    description: 'Booking token (UUID) từ link trong email',
    example: 'a3b4c5d6-e7f8-9012-abcd-ef0123456789',
  })
  @ApiOkResponse({
    description: 'Thông tin booking',
    type: PublicBookingResponseDto,
  })
  @ApiNotFoundResponse({
    description: 'BOOKING_NOT_FOUND — Token không hợp lệ hoặc không tồn tại',
  })
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
  @ApiOkResponse({
    description: 'Hủy thành công — trả về thông tin booking đã hủy',
    type: PublicBookingResponseDto,
  })
  @ApiNotFoundResponse({
    description: 'BOOKING_NOT_FOUND — Không tìm thấy booking',
  })
  @ApiBadRequestResponse({
    description: `
      Có thể trả về các lỗi sau:
      - BOOKING_ALREADY_CANCELLED: Booking đã được hủy trước đó
      - CANNOT_CANCEL_AFTER_CHECKIN: Không thể hủy sau khi đã nhận phòng hoặc qua ngày check-in
      - INVALID_PHONE: Thiếu thông tin xác thực
    `,
  })
  async cancelBooking(@Body() body: CancelBookingDto) {
    const booking = await this.publicBookingsService.cancelBooking(body);
    return {
      success: true,
      message: 'Hủy đặt phòng thành công',
      data: booking,
    };
  }
}
