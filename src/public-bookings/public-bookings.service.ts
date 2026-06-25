import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Booking, BookingStatus } from '../bookings/entities/booking.entity';
import { BookingHistory } from '../bookings/entities/booking-history.entity';
import {
  SearchBookingDto,
  CancelBookingDto,
  PublicBookingResponseDto,
} from './dto/public-booking.dto';

@Injectable()
export class PublicBookingsService {
  private readonly logger = new Logger(PublicBookingsService.name);

  constructor(
    @InjectRepository(Booking)
    private readonly bookingRepo: Repository<Booking>,
    @InjectRepository(BookingHistory)
    private readonly historyRepo: Repository<BookingHistory>,
  ) {}

  // ─────────────────────────────────────────────────────────────────────────
  // Helpers
  // ─────────────────────────────────────────────────────────────────────────

  /** Map Booking entity → PublicBookingResponseDto (không expose token, không expose admin data) */
  private mapToPublicResponse(booking: Booking): PublicBookingResponseDto {
    return {
      id: booking.id,
      bookingCode: booking.booking_code,
      customerName: booking.customer_name,
      phone: booking.phone,
      email: booking.email,
      note: booking.note ?? null,
      roomName: booking.roomCategory?.name ?? '',
      roomNumber: booking.room?.room_number ?? null,
      checkInDate: booking.check_in_date,
      checkOutDate: booking.check_out_date,
      guestCount: booking.guest_count,
      nightCount: booking.night_count,
      roomPrice: Number(booking.room_price),
      subtotal: Number(booking.subtotal),
      discountAmount: Number(booking.discountAmount),
      totalAmount: Number(booking.total_amount),
      voucherCode: booking.voucherCode ?? null,
      bookingStatus: booking.booking_status,
      paymentStatus: booking.payment_status,
      paymentMethod: booking.payment_method,
      createdAt: booking.created_at,
    };
  }

  /** Validate điều kiện hủy booking */
  private validateCancellation(booking: Booking): void {
    // Kiểm tra trạng thái không cho phép hủy
    if (booking.booking_status === BookingStatus.CANCELLED) {
      throw new BadRequestException({
        errorCode: 'BOOKING_ALREADY_CANCELLED',
        message: 'Booking này đã được hủy trước đó',
      });
    }

    if (
      booking.booking_status === BookingStatus.CHECKED_IN ||
      booking.booking_status === BookingStatus.CHECKED_OUT
    ) {
      throw new BadRequestException({
        errorCode: 'CANNOT_CANCEL_AFTER_CHECKIN',
        message: 'Không thể hủy booking sau khi đã nhận phòng',
      });
    }

    if (booking.booking_status === BookingStatus.EXPIRED) {
      throw new BadRequestException({
        errorCode: 'BOOKING_ALREADY_CANCELLED',
        message: 'Booking này đã hết hạn',
      });
    }

    // Chỉ cho phép PENDING và CONFIRMED
    if (
      booking.booking_status !== BookingStatus.PENDING &&
      booking.booking_status !== BookingStatus.CONFIRMED
    ) {
      throw new BadRequestException({
        errorCode: 'CANNOT_CANCEL_AFTER_CHECKIN',
        message: `Không thể hủy booking ở trạng thái ${booking.booking_status}`,
      });
    }

    // Không cho phép hủy nếu currentDate >= checkInDate
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const checkInDate = new Date(booking.check_in_date);
    checkInDate.setHours(0, 0, 0, 0);

    if (today >= checkInDate) {
      throw new BadRequestException({
        errorCode: 'CANNOT_CANCEL_AFTER_CHECKIN',
        message: 'Không thể hủy booking khi đã đến hoặc qua ngày nhận phòng',
      });
    }
  }

  /** Thực hiện hủy booking và tạo booking history */
  private async performCancellation(booking: Booking): Promise<Booking> {
    const prevStatus = booking.booking_status;

    await this.bookingRepo.manager.transaction(async (manager) => {
      // Cập nhật trạng thái booking
      await manager.update(Booking, booking.id, {
        booking_status: BookingStatus.CANCELLED,
        updated_at: new Date(),
      });

      // Tạo booking history với action = CUSTOMER_CANCEL
      const history = manager.create(BookingHistory, {
        booking_id: booking.id,
        admin_id: undefined, // Khách hàng tự hủy, không có admin
        action: 'CUSTOMER_CANCEL',
        previous_status: prevStatus,
        new_status: BookingStatus.CANCELLED,
        note: 'Khách hàng tự hủy qua trang tra cứu',
      });
      await manager.save(BookingHistory, history);
    });

    this.logger.log(
      `[PUBLIC_CANCEL] bookingCode=${booking.booking_code} prevStatus=${prevStatus} → CANCELLED`,
    );

    // Trả về booking đã cập nhật (reload)
    return this.bookingRepo.findOne({
      where: { id: booking.id },
      relations: ['roomCategory', 'room'],
    }) as Promise<Booking>;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Public API Methods
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Tra cứu booking bằng booking code + phone.
   * Không trả về token, không trả về admin data.
   */
  async searchBooking(dto: SearchBookingDto): Promise<PublicBookingResponseDto> {
    const normalizedCode = dto.bookingCode.trim().toUpperCase();
    const normalizedPhone = dto.phone.trim().replace(/\s/g, '');

    // Thử tìm theo phone gốc hoặc phone đã chuẩn hóa
    const booking = await this.bookingRepo.findOne({
      where: [
        { booking_code: normalizedCode, phone: normalizedPhone },
        { booking_code: normalizedCode, phone: dto.phone.trim() },
      ],
      relations: ['roomCategory', 'room'],
    });

    if (!booking) {
      throw new NotFoundException({
        errorCode: 'BOOKING_NOT_FOUND',
        message:
          'Không tìm thấy booking với mã và số điện thoại đã nhập. Vui lòng kiểm tra lại.',
      });
    }

    return this.mapToPublicResponse(booking);
  }

  /**
   * Lấy thông tin booking qua booking_token (dùng cho trang quản lý booking).
   * Trả về thông tin đầy đủ nhưng không có token.
   */
  async getBookingByToken(token: string): Promise<PublicBookingResponseDto> {
    const booking = await this.bookingRepo.findOne({
      where: { booking_token: token },
      relations: ['roomCategory', 'room'],
    });

    if (!booking) {
      throw new NotFoundException({
        errorCode: 'BOOKING_NOT_FOUND',
        message: 'Link quản lý booking không hợp lệ hoặc đã hết hạn.',
      });
    }

    return this.mapToPublicResponse(booking);
  }

  /**
   * Hủy booking bằng (bookingCode + phone) hoặc token.
   */
  async cancelBooking(dto: CancelBookingDto): Promise<PublicBookingResponseDto> {
    // Validate: phải có ít nhất 1 trong 2 cặp
    if (!dto.token && (!dto.bookingCode || !dto.phone)) {
      throw new BadRequestException({
        errorCode: 'INVALID_PHONE',
        message:
          'Cần cung cấp (bookingCode + phone) hoặc token để hủy booking',
      });
    }

    let booking: Booking | null = null;

    if (dto.token) {
      // Tìm qua token
      booking = await this.bookingRepo.findOne({
        where: { booking_token: dto.token },
        relations: ['roomCategory', 'room'],
      });
    } else {
      // Tìm qua bookingCode + phone
      booking = await this.bookingRepo.findOne({
        where: {
          booking_code: dto.bookingCode,
          phone: dto.phone,
        },
        relations: ['roomCategory', 'room'],
      });
    }

    if (!booking) {
      throw new NotFoundException({
        errorCode: 'BOOKING_NOT_FOUND',
        message:
          'Không tìm thấy booking với thông tin đã cung cấp. Vui lòng kiểm tra lại.',
      });
    }

    // Validate điều kiện hủy (sẽ throw exception có errorCode rõ ràng)
    this.validateCancellation(booking);

    // Thực hiện hủy
    const updatedBooking = await this.performCancellation(booking);

    return this.mapToPublicResponse(updatedBooking);
  }
}
