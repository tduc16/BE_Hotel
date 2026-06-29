import {
  Controller,
  Get,
  Param,
  Patch,
  Query,
  UseGuards,
  Body,
  Request,
  Logger,
  BadRequestException,
  NotFoundException,
  InternalServerErrorException,
} from '@nestjs/common';
import { AdminBookingsService } from './admin-bookings.service';
import { QueryBookingDto } from '../../bookings/dto/query-booking.dto';
import { JwtAdminGuard } from '../auth/guards/jwt-admin.guard';
import {
  UpdateBookingStatusDto,
  CancelBookingDto,
  ActionBookingDto,
} from './dto/update-booking.dto';
import { GetBookingCalendarDto } from './dto/booking-calendar-query.dto';
import { BookingStatus, PaymentStatus } from '../../bookings/entities/booking.entity';
import { PaymentStatus as PaymentStatusEnum } from '../../bookings/entities/booking.enums';

const mapBookingResponse = (booking: any) => {
  const room_name = booking.room?.room_number
    ? `${booking.roomCategory?.name || ''} - ${booking.room.room_number}`.trim()
    : booking.roomCategory?.name || '—';

  return {
    id: booking.id,
    bookingCode: booking.booking_code,
    customerName: booking.customer_name || '—',
    phone: booking.phone || '—',
    email: booking.email || '—',
    checkInDate: booking.check_in_date
      ? new Date(booking.check_in_date).toISOString()
      : null,
    checkOutDate: booking.check_out_date
      ? new Date(booking.check_out_date).toISOString()
      : null,
    totalPrice: Number(booking.total_amount) || 0,
    paymentStatus: booking.payment_status,
    bookingStatus: booking.booking_status,
    createdAt: booking.created_at
      ? new Date(booking.created_at).toISOString()
      : null,
    room: {
      id: booking.room?.id || booking.roomCategory?.id || '—',
      name: room_name,
      thumbnailUrl: booking.roomCategory?.thumbnail_url || '',
    },
    // Snake_case fields requested by user
    booking_code: booking.booking_code,
    customer_name: booking.customer_name || '—',
    room_name: room_name,
    check_in_date: booking.check_in_date
      ? new Date(booking.check_in_date).toISOString()
      : null,
    check_out_date: booking.check_out_date
      ? new Date(booking.check_out_date).toISOString()
      : null,
    total_amount: Number(booking.total_amount) || 0,
    payment_status: booking.payment_status,
    status: booking.booking_status,
  };
};

const mapBookingDetailResponse = (booking: any) => {
  return {
    id: booking.id ?? null,
    bookingCode: booking.booking_code ?? null,
    customerName: booking.customer_name ?? null,
    email: booking.email ?? null,
    phone: booking.phone ?? null,
    note: booking.note ?? null,
    guestCount: booking.guest_count !== undefined && booking.guest_count !== null ? Number(booking.guest_count) : null,
    nightCount: booking.night_count !== undefined && booking.night_count !== null ? Number(booking.night_count) : null,
    roomPrice: booking.room_price !== undefined && booking.room_price !== null ? Number(booking.room_price) : null,
    subtotal: booking.subtotal !== undefined && booking.subtotal !== null ? Number(booking.subtotal) : null,
    discountAmount: booking.discountAmount !== undefined && booking.discountAmount !== null ? Number(booking.discountAmount) : null,
    voucherCode: booking.voucherCode ?? null,
    totalAmount: booking.total_amount !== undefined && booking.total_amount !== null ? Number(booking.total_amount) : null,
    paymentMethod: booking.payment_method ?? null,
    paymentStatus: booking.payment_status ?? null,
    bookingStatus: booking.booking_status ?? null,
    checkInDate: booking.check_in_date ? new Date(booking.check_in_date).toISOString() : null,
    checkOutDate: booking.check_out_date ? new Date(booking.check_out_date).toISOString() : null,
    createdAt: booking.created_at ? new Date(booking.created_at).toISOString() : null,
    updatedAt: booking.updated_at ? new Date(booking.updated_at).toISOString() : null,
    // Bank transfer info
    bankQrUrl: booking.bankQrUrl ?? null,
    bankTransferContent: booking.bankTransferContent ?? null,
    paidAt: booking.paidAt ? new Date(booking.paidAt).toISOString() : null,

    room: booking.room ? {
      id: booking.room.id ?? null,
      roomNumber: booking.room.room_number ?? null,
    } : null,

    roomCategory: booking.roomCategory ? {
      id: booking.roomCategory.id ?? null,
      name: booking.roomCategory.name ?? null,
      basePrice: booking.roomCategory.base_price !== undefined && booking.roomCategory.base_price !== null
        ? Number(booking.roomCategory.base_price)
        : null,
    } : null,

    histories: booking.histories ? booking.histories.map((h: any) => ({
      id: h.id ?? null,
      bookingId: h.booking_id ?? null,
      adminId: h.admin_id ?? null,
      admin: h.admin ? {
        id: h.admin.id ?? null,
        username: h.admin.username ?? null,
        email: h.admin.email ?? null,
        role: h.admin.role ?? null,
        createdAt: h.admin.createdAt ? new Date(h.admin.createdAt).toISOString() : null,
      } : null,
      action: h.action ?? null,
      previousStatus: h.previous_status ?? null,
      newStatus: h.new_status ?? null,
      note: h.note ?? null,
      createdAt: h.created_at ? new Date(h.created_at).toISOString() : null,
      timestamp: h.created_at ? new Date(h.created_at).toISOString() : null,
    })) : [],

    // Backward compatibility fields
    booking_code: booking.booking_code ?? null,
    customer_name: booking.customer_name ?? null,
    room_name: booking.room?.room_number
      ? `${booking.roomCategory?.name || ''} - ${booking.room.room_number}`.trim()
      : booking.roomCategory?.name || null,
    check_in_date: booking.check_in_date ? new Date(booking.check_in_date).toISOString() : null,
    check_out_date: booking.check_out_date ? new Date(booking.check_out_date).toISOString() : null,
    total_amount: booking.total_amount !== undefined && booking.total_amount !== null ? Number(booking.total_amount) : null,
    payment_status: booking.payment_status ?? null,
    status: booking.booking_status ?? null,
  };
};

@UseGuards(JwtAdminGuard)
@Controller('admin/bookings')
export class AdminBookingsController {
  private readonly logger = new Logger(AdminBookingsController.name);

  constructor(private readonly adminBookingsService: AdminBookingsService) {}

  @Get()
  async getBookings(@Query() query: QueryBookingDto) {
    const { data, meta } = await this.adminBookingsService.getBookings(query);
    const bookings = data.map(mapBookingResponse);

    console.log(
      bookings.map((b) => ({
        id: b.id,
        bookingCode: b.booking_code,
      })),
    );

    const response = {
      success: true,
      data: bookings,
      meta,
    };

    this.logger.debug(
      `getBookings response: ${JSON.stringify(response, null, 2)}`,
    );
    return response;
  }

  @Get('calendar')
  async getBookingCalendar(@Query() query: GetBookingCalendarDto) {
    return this.adminBookingsService.getBookingCalendar(query);
  }

  @Get(':id')
  async getBookingDetail(@Param('id') id: string) {
    const data = await this.adminBookingsService.getBookingDetail(id);
    const mappedData = mapBookingDetailResponse(data);

    const response = {
      success: true,
      data: mappedData,
    };

    console.log('--- GET BOOKING DETAIL RESPONSE OBJECT ---');
    console.log(JSON.stringify(response, null, 2));
    console.log('-----------------------------------------');

    this.logger.debug(
      `getBookingDetail response: ${JSON.stringify(response, null, 2)}`,
    );
    return response;
  }

  @Patch(':id')
  async updateStatus(
    @Param('id') id: string,
    @Body() body: UpdateBookingStatusDto,
    @Request() req,
  ) {
    const adminId = req.user?.id;
    let currentStatus: BookingStatus | string = 'UNKNOWN';
    const targetStatus = body?.status;
    const repository = this.adminBookingsService.bookingRepo;

    try {
      // 1. Kiểm tra status gửi lên null/undefined
      if (!body || body.status === undefined || body.status === null) {
        throw new BadRequestException(
          'Trạng thái cập nhật (status) không được để trống.',
        );
      }

      // 2. Kiểm tra enum status không khớp DB
      if (!Object.values(BookingStatus).includes(body.status)) {
        throw new BadRequestException(
          `Trạng thái không hợp lệ: ${body.status}`,
        );
      }

      console.log('PARAM ID', id);

      const booking = await repository.findOne({
        where: { id },
      });

      console.log('FOUND', booking);

      if (!booking) {
        return {
          id,
        };
      }

      // Lấy thông tin booking chi tiết
      // 3. Kiểm tra booking không tồn tại
      const detailedBooking = await this.adminBookingsService.getBookingDetail(id);

      if (!detailedBooking) {
        throw new NotFoundException(`Không tìm thấy booking với ID: ${id}`);
      }

      currentStatus = detailedBooking.booking_status;

      // 4. Kiểm tra relation room hoặc roomCategory chưa load
      if (detailedBooking.roomCategory === undefined) {
        throw new BadRequestException(
          'Dữ liệu loại phòng (roomCategory) chưa được tải.',
        );
      }

      // 5. Kiểm tra room_id null khi CHECKED_IN/CHECKED_OUT
      if (
        [BookingStatus.CHECKED_IN, BookingStatus.CHECKED_OUT].includes(
          targetStatus,
        )
      ) {
        if (!detailedBooking.room_id) {
          throw new BadRequestException(
            `Yêu cầu gán phòng cho booking trước khi chuyển sang trạng thái ${targetStatus}.`,
          );
        }
        if (!detailedBooking.room) {
          throw new BadRequestException(
            `Dữ liệu phòng tương ứng chưa được tải.`,
          );
        }
      }

      // Thực hiện cập nhật trạng thái
      const updatedBooking =
        await this.adminBookingsService.updateBookingStatus(
          id,
          targetStatus,
          adminId,
          body.note,
        );

      // 6. Sau khi cập nhật thành công trả về đúng spec
      return {
        success: true,
        bookingId: updatedBooking.id,
        previousStatus: currentStatus as BookingStatus,
        currentStatus: updatedBooking.booking_status,
      };
    } catch (error) {
      // Ghi log chi tiết lỗi bao gồm stack trace
      this.logger.error(
        `[Error] Booking ID: ${id}, Current Status: ${currentStatus}, Target Status: ${targetStatus}, Request Body: ${JSON.stringify(body)}`,
      );
      this.logger.error(`Stack trace: ${error.stack || error}`);

      // Bọc toàn bộ logic bằng try/catch
      console.error(error);

      // Trả về BadRequestException hoặc NotFoundException phù hợp
      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException
      ) {
        throw error;
      }

      // Đối với lỗi database hoặc lỗi hệ thống khác, trả về InternalServerErrorException (500)
      throw new InternalServerErrorException(
        `Cập nhật trạng thái thất bại: ${error.message || 'Lỗi cơ sở dữ liệu'}`,
      );
    }
  }

  @Patch(':id/confirm')
  async confirmBooking(
    @Param('id') id: string,
    @Body() body: ActionBookingDto,
    @Request() req,
  ) {
    const adminId = req.user?.id;
    const data = await this.adminBookingsService.confirmBooking(
      id,
      adminId,
      body?.note,
    );
    return {
      success: true,
      data: mapBookingResponse(data),
      message: 'Booking confirmed successfully',
    };
  }

  @Patch(':id/checkin')
  async checkInBooking(
    @Param('id') id: string,
    @Body() body: ActionBookingDto,
    @Request() req,
  ) {
    const adminId = req.user?.id;
    const data = await this.adminBookingsService.checkInBooking(
      id,
      adminId,
      body?.note,
    );
    return {
      success: true,
      data: mapBookingResponse(data),
      message: 'Booking checked in successfully',
    };
  }

  @Patch(':id/checkout')
  async checkOutBooking(
    @Param('id') id: string,
    @Body() body: ActionBookingDto,
    @Request() req,
  ) {
    const adminId = req.user?.id;
    const data = await this.adminBookingsService.checkOutBooking(
      id,
      adminId,
      body?.note,
    );
    return {
      success: true,
      data: mapBookingResponse(data),
      message: 'Booking checked out successfully',
    };
  }

  @Patch(':id/cancel')
  async cancelBooking(
    @Param('id') id: string,
    @Body() body: CancelBookingDto,
    @Request() req,
  ) {
    const adminId = req.user?.id;
    const data = await this.adminBookingsService.cancelBooking(
      id,
      adminId,
      body?.reason,
    );
    return {
      success: true,
      data: mapBookingResponse(data),
      message: 'Booking cancelled successfully',
    };
  }

  /**
   * PATCH /admin/bookings/:id/payment
   * Cập nhật trạng thái thanh toán của booking.
   * Body: { paymentStatus: 'UNPAID' | 'PAID' | 'REFUNDED' | 'FAILED', note?: string }
   */
  @Patch(':id/payment')
  async updatePaymentStatus(
    @Param('id') id: string,
    @Body() body: { paymentStatus: PaymentStatusEnum; note?: string },
    @Request() req,
  ) {
    const adminId = req.user?.id;

    if (!body.paymentStatus) {
      throw new BadRequestException('paymentStatus là bắt buộc');
    }

    const validStatuses = ['UNPAID', 'PAID', 'REFUNDED', 'FAILED'];
    if (!validStatuses.includes(body.paymentStatus)) {
      throw new BadRequestException(
        `paymentStatus không hợp lệ. Hợp lệ: ${validStatuses.join(', ')}`,
      );
    }

    const data = await this.adminBookingsService.updatePaymentStatus(
      id,
      body.paymentStatus,
      adminId,
      body.note,
    );

    return {
      success: true,
      data: mapBookingDetailResponse(data),
      message: `Cập nhật thanh toán thành công: ${body.paymentStatus}`,
    };
  }

  /**
   * PATCH /admin/bookings/:id/confirm-payment
   * Admin xác nhận đã nhận tiền chuyển khoản ngân hàng.
   * - Chuyển paymentStatus: UNPAID → PAID
   * - Chuyển bookingStatus: PENDING → CONFIRMED (nếu đang PENDING)
   * - Ghi paidAt = now
   * Body: { note?: string }
   */
  @Patch(':id/confirm-payment')
  async confirmBankTransferPayment(
    @Param('id') id: string,
    @Body() body: { note?: string },
    @Request() req,
  ) {
    const adminId = req.user?.id;

    const data = await this.adminBookingsService.confirmBankTransferPayment(
      id,
      adminId,
      body?.note,
    );

    return {
      success: true,
      data: mapBookingDetailResponse(data),
      message: 'Xác nhận thanh toán chuyển khoản thành công.',
    };
  }
}
