import {
  Injectable,
  BadRequestException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import {
  Booking,
  BookingStatus,
  PaymentMethod,
  PaymentStatus,
} from './entities/booking.entity';
import { BookingHistory } from './entities/booking-history.entity';
import { CreateBookingDto } from './dto/create-booking.dto';
import { RoomCategory } from '../rooms/entities/room-category.entity';
import { Room } from '../rooms/entities/room.entity';
import { BookingAvailabilityService } from './booking-availability.service';
import { VouchersService } from '../vouchers/vouchers.service';
import { EmailService } from '../email/email.service';
import { BankQrService } from './bank-qr.service';
import { randomUUID } from 'crypto';

@Injectable()
export class BookingsService {
  private readonly logger = new Logger(BookingsService.name);

  constructor(
    @InjectRepository(Booking)
    private bookingRepo: Repository<Booking>,
    @InjectRepository(RoomCategory)
    private roomCategoryRepo: Repository<RoomCategory>,
    private dataSource: DataSource,
    private emailService: EmailService,
    private readonly bookingAvailabilityService: BookingAvailabilityService,
    private readonly vouchersService: VouchersService,
    private readonly bankQrService: BankQrService,
  ) {}

  /**
   * Chuẩn hoá date string thành 'YYYY-MM-DD' để tránh lệch timezone.
   * Database lưu kiểu DATE (không có giờ), so sánh bằng string là an toàn.
   */
  private normalizeDateString(date: string | Date): string {
    if (date instanceof Date) {
      return date.toISOString().substring(0, 10);
    }
    return String(date).substring(0, 10);
  }

  /**
   * Sinh booking code theo format BK{YEAR}{SEQ:5}
   * Ví dụ: BK202600001, BK202600002, ...
   * Sử dụng MAX để tránh race condition khi nhiều request cùng lúc.
   * Chạy trong transaction để đảm bảo tính duy nhất.
   */
  private async generateBookingCode(manager: any): Promise<string> {
    const currentYear = new Date().getFullYear();
    const pattern = `BK${currentYear}%`;

    // Lấy MAX booking_code sequence dạng INTEGER trong năm hiện tại
    const result = await manager
      .createQueryBuilder(Booking, 'booking')
      .select('MAX(CAST(SUBSTRING(booking.booking_code, 7) AS INTEGER))', 'maxSeq')
      .where('booking.booking_code LIKE :pattern', { pattern })
      .getRawOne();

    let newSequence = 1;
    if (result && result.maxSeq !== null && result.maxSeq !== undefined) {
      const lastSeq = Number(result.maxSeq);
      if (!isNaN(lastSeq)) {
        newSequence = lastSeq + 1;
      }
    }

    return `BK${currentYear}${newSequence.toString().padStart(5, '0')}`;
  }

  async createBooking(
    createBookingDto: CreateBookingDto,
    customerId: string | null = null,
    preferredRoomId?: string,
  ) {
    const {
      customer_name,
      phone,
      email,
      note,
      room_category_id,
      check_in_date,
      check_out_date,
      guest_count,
      payment_method,
      voucherCode,
    } = createBookingDto;

    // ── Validate DTO fields ──────────────────────────────────────────────────
    if (!room_category_id) {
      throw new BadRequestException('Vui lòng chọn hạng phòng');
    }

    const checkIn = new Date(check_in_date);
    const checkOut = new Date(check_out_date);

    if (isNaN(checkIn.getTime())) {
      throw new BadRequestException('Ngày nhận phòng không hợp lệ');
    }
    if (isNaN(checkOut.getTime())) {
      throw new BadRequestException('Ngày trả phòng không hợp lệ');
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (checkIn < today) {
      throw new BadRequestException('Ngày nhận phòng không thể nằm trong quá khứ');
    }

    if (checkOut <= checkIn) {
      throw new BadRequestException('Ngày trả phòng phải sau ngày nhận phòng');
    }

    const nightCount = Math.round(
      (checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24),
    );

    if (nightCount < 1) {
      throw new BadRequestException('Số đêm phải lớn hơn hoặc bằng 1');
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // ── 1. Lấy thông tin category ────────────────────────────────────────
      const category = await queryRunner.manager.findOne(RoomCategory, {
        where: { id: room_category_id },
      });

      if (!category) {
        throw new NotFoundException('Hạng phòng không tồn tại');
      }

      if (!category.is_active) {
        throw new BadRequestException('Hạng phòng này hiện không hoạt động');
      }

      // ── Validate guest_count vs capacity ─────────────────────────────────
      if (guest_count < 1) {
        throw new BadRequestException('Số lượng khách phải lớn hơn hoặc bằng 1');
      }

      if (guest_count > category.capacity) {
        throw new BadRequestException('Số khách vượt quá sức chứa hạng phòng');
      }

      // ── 2. Tính tiền ─────────────────────────────────────────────────────
      const roomPrice = Number(category.base_price);
      const subtotal = roomPrice * nightCount;

      if (subtotal < 0) {
        throw new BadRequestException('Tổng tiền không thể là số âm');
      }

      let finalAmount = subtotal;
      let discountAmount = 0;
      let appliedVoucherId: string | null = null;
      let appliedVoucherCode: string | null = null;

      if (voucherCode && voucherCode.trim() !== '') {
        const voucherResult = await this.vouchersService.validateVoucher(
          voucherCode,
          subtotal,
          customerId,
          email,
          queryRunner.manager,
        );

        if (!voucherResult.valid) {
          throw new BadRequestException(voucherResult.message);
        }

        discountAmount = Number(voucherResult.discountAmount);
        finalAmount = Number(voucherResult.finalAmount);
        if (voucherResult.voucher) {
          appliedVoucherId = voucherResult.voucher.id;
          appliedVoucherCode = voucherResult.voucher.code;
        }
      }

      // ── 3. Kiểm tra phòng trống ──────────────────────────────────────────
      const availCategories = await this.bookingAvailabilityService.findAvailableRoomCategories(
        {
          checkInDate: check_in_date,
          checkOutDate: check_out_date,
          guestCount: guest_count,
        },
        queryRunner.manager,
      );

      const targetCategory = availCategories.find((c) => c.categoryId === room_category_id);

      if (!targetCategory || targetCategory.availableRoomCount <= 0) {
        throw new BadRequestException('Hạng phòng đã hết phòng trong khoảng thời gian này');
      }

      // ── 4. Gán room_id vật lý ────────────────────────────────────────────
      let assignedRoomId: string;

      if (preferredRoomId && targetCategory.availableRooms.some((r) => r.id === preferredRoomId)) {
        assignedRoomId = preferredRoomId;
      } else {
        assignedRoomId = targetCategory.availableRooms[0].id;
      }

      const availableRoom = await queryRunner.manager.findOne(Room, {
        where: { id: assignedRoomId },
      });
      if (!availableRoom) {
        throw new BadRequestException('Hết phòng trong khoảng thời gian này');
      }

      this.logger.log(
        `[BookingCreate] Assigned room_id=${assignedRoomId} (${availableRoom.room_number}) cho booking mới`,
      );

      // ── 5. Sinh booking code ──────────────────────────────────────────────
      const bookingCode = await this.generateBookingCode(queryRunner.manager);

      // ── 6. Xác định trạng thái ────────────────────────────────────────────
      let finalBookingStatus = BookingStatus.PENDING;
      const finalPaymentStatus = PaymentStatus.UNPAID;
      let expiredAt: Date | null = null;

      if (payment_method === PaymentMethod.CASH) {
        // Thanh toán khi nhận phòng → Xác nhận ngay
        finalBookingStatus = BookingStatus.CONFIRMED;
      } else if (payment_method === PaymentMethod.BANK_TRANSFER) {
        // Chuyển khoản → chờ admin xác nhận
        finalBookingStatus = BookingStatus.PENDING;
        expiredAt = new Date();
        expiredAt.setHours(expiredAt.getHours() + 24); // Hết hạn sau 24h
      } else {
        finalBookingStatus = BookingStatus.PENDING;
        expiredAt = new Date();
        expiredAt.setMinutes(expiredAt.getMinutes() + 15);
      }

      // ── 7. Tạo booking token ──────────────────────────────────────────────
      const bookingToken = randomUUID();

      // ── 8. Sinh thông tin QR chuyển khoản (nếu BANK_TRANSFER) ─────────────
      let bankTransferContent: string | null = null;
      let bankQrUrl: string | null = null;

      if (payment_method === PaymentMethod.BANK_TRANSFER) {
        bankTransferContent = this.bankQrService.generateTransferContent(bookingCode);
        bankQrUrl = this.bankQrService.generateQrUrl(finalAmount, bookingCode);
        this.logger.log(
          `[BankQR] Generated QR for booking=${bookingCode}, amount=${finalAmount}, content="${bankTransferContent}"`,
        );
      }

      const newBooking = queryRunner.manager.create(Booking, {
        booking_code: bookingCode,
        booking_token: bookingToken,
        customer_name,
        phone,
        email,
        note: note ?? undefined,
        room_category_id,
        roomCategory: { id: room_category_id } as any,
        room_id: assignedRoomId,
        room: { id: assignedRoomId } as any,
        check_in_date: check_in_date,
        check_out_date: check_out_date,
        guest_count,
        night_count: nightCount,
        room_price: roomPrice,
        subtotal: subtotal,
        discountAmount: discountAmount,
        total_amount: finalAmount,
        voucherId: appliedVoucherId ?? undefined,
        voucherCode: appliedVoucherCode ?? undefined,
        payment_method,
        payment_status: finalPaymentStatus,
        booking_status: finalBookingStatus,
        expired_at: expiredAt ?? undefined,
        customerId: customerId,
        bankTransferContent,
        bankQrUrl,
        paidAt: null,
        ...(customerId ? { customer: { id: customerId } as any } : {}),
      });

      let savedBooking: Booking;
      try {
        savedBooking = await queryRunner.manager.save(newBooking);

        // Tạo bản ghi voucher usage
        if (appliedVoucherId) {
          const usage = queryRunner.manager.create('VoucherUsage', {
            voucherId: appliedVoucherId,
            customerId: customerId || null,
            bookingId: savedBooking.id,
            guestEmail: customerId ? null : email,
            discountAmount: discountAmount,
          });
          await queryRunner.manager.save('VoucherUsage', usage);
          await queryRunner.manager.increment('Voucher', { id: appliedVoucherId }, 'usedCount', 1);
        }
      } catch (saveError: any) {
        this.logger.error('[BookingCreate] Lỗi khi lưu booking:', {
          payload: {
            customer_name,
            phone,
            email,
            note,
            room_category_id,
            check_in_date,
            check_out_date,
            guest_count,
            payment_method,
            voucherCode,
            customerId,
          },
          errorName: saveError.name,
          errorMessage: saveError.message,
          errorDetail: saveError.detail,
          errorCode: saveError.code,
          errorStack: saveError.stack,
          query: saveError.query,
          parameters: saveError.parameters,
        });

        throw new BadRequestException({
          message: 'Lỗi khi lưu booking',
          detail: saveError.message,
          dbDetail: saveError.detail,
          code: saveError.code,
        });
      }

      await queryRunner.commitTransaction();

      this.logger.log(`[BookingCreate] bookingCode=${bookingCode} created successfully`);

      // Reload booking với relations đầy đủ để gửi email
      let bookingForEmail = savedBooking;
      try {
        const reloaded = await this.bookingRepo.findOne({
          where: { id: savedBooking.id },
          relations: ['roomCategory', 'room', 'voucher'],
        });
        if (reloaded) {
          bookingForEmail = reloaded;
        }
      } catch (reloadErr) {
        this.logger.error('[BookingEmail] Lỗi khi reload booking:', reloadErr);
      }

      // Gửi email xác nhận (không làm hỏng luồng phản hồi đặt phòng)
      try {
        await this.emailService.sendBookingConfirmationEmail(bookingForEmail.email, bookingForEmail);
        this.logger.log(`[BookingEmail] Sent booking confirmation to ${bookingForEmail.email}`);
      } catch (error: any) {
        this.logger.error(`[BookingEmail] Failed to send email to ${bookingForEmail.email}`, error.stack);
      }

      // Lấy bankInfo để trả về cùng response
      const bankInfo = payment_method === PaymentMethod.BANK_TRANSFER
        ? this.bankQrService.getBankInfo()
        : null;

      return {
        ...savedBooking,
        roomName: category.name,
        roomNumber: availableRoom.room_number,
        bankInfo,
        bankTransferContent,
        bankQrUrl,
      };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error('[BookingCreate] Transaction rollback:', error.message);
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async getBookingByCode(booking_code: string) {
    const booking = await this.bookingRepo
      .createQueryBuilder('booking')
      .leftJoinAndSelect('booking.roomCategory', 'category')
      .leftJoinAndSelect('booking.room', 'room')
      .where('booking.booking_code = :booking_code', { booking_code })
      .getOne();

    if (!booking) {
      throw new NotFoundException('Không tìm thấy thông tin đặt phòng');
    }

    return booking;
  }

  // ─── GUEST LOOKUP & CANCEL METHODS ─────────────────────────────────────────

  /**
   * Tra cứu booking theo bookingCode + phone.
   * Trả về đầy đủ thông tin để hiển thị trên trang tra cứu.
   */
  async guestLookup(bookingCode: string, phone: string) {
    const normalizedCode = bookingCode.trim().toUpperCase();
    const normalizedPhone = phone.trim().replace(/\s/g, '');

    const booking = await this.bookingRepo.findOne({
      where: [
        { booking_code: normalizedCode, phone: normalizedPhone },
        { booking_code: normalizedCode, phone: phone.trim() },
      ],
      relations: ['roomCategory', 'room'],
    });

    if (!booking) {
      return null;
    }

    return this.mapBookingToPublicResponse(booking);
  }

  /**
   * Hủy booking theo bookingCode + phone.
   * Rules:
   * - Booking chưa CHECKED_IN
   * - Booking chưa CANCELLED
   * - Ngày nhận phòng còn lớn hơn hôm nay
   */
  async guestCancel(bookingCode: string, phone: string) {
    const normalizedCode = bookingCode.trim().toUpperCase();
    const normalizedPhone = phone.trim().replace(/\s/g, '');

    const booking = await this.bookingRepo.findOne({
      where: [
        { booking_code: normalizedCode, phone: normalizedPhone },
        { booking_code: normalizedCode, phone: phone.trim() },
      ],
      relations: ['roomCategory', 'room'],
    });

    if (!booking) {
      throw new NotFoundException('Không tìm thấy đơn đặt phòng phù hợp với mã đặt phòng và số điện thoại.');
    }

    const status = booking.booking_status;

    if (status === BookingStatus.CANCELLED) {
      throw new BadRequestException('Đơn đặt phòng này đã được hủy trước đó.');
    }

    if (status === BookingStatus.CHECKED_IN || status === BookingStatus.CHECKED_OUT) {
      throw new BadRequestException('Không thể hủy đơn đặt phòng sau khi đã nhận phòng.');
    }

    if (status !== BookingStatus.PENDING && status !== BookingStatus.CONFIRMED) {
      throw new BadRequestException(`Không thể hủy đơn đặt phòng ở trạng thái ${status}.`);
    }

    // Kiểm tra ngày nhận phòng > hôm nay
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const checkInDate = new Date(booking.check_in_date);
    checkInDate.setHours(0, 0, 0, 0);

    if (today >= checkInDate) {
      throw new BadRequestException('Không thể hủy đơn đặt phòng khi đã đến hoặc qua ngày nhận phòng.');
    }

    const prevStatus = booking.booking_status;
    const prevPaymentStatus = booking.payment_status;

    // Xác định trạng thái payment sau khi hủy
    let newPaymentStatus = prevPaymentStatus;
    if (prevPaymentStatus === PaymentStatus.PAID) {
      newPaymentStatus = PaymentStatus.REFUNDED;
    }

    await this.bookingRepo.manager.transaction(async (manager) => {
      await manager.update(Booking, booking.id, {
        booking_status: BookingStatus.CANCELLED,
        payment_status: newPaymentStatus,
        updated_at: new Date(),
      });

      const history = manager.create(BookingHistory, {
        booking_id: booking.id,
        action: 'CUSTOMER_CANCEL',
        previous_status: prevStatus,
        new_status: BookingStatus.CANCELLED,
        note: prevPaymentStatus === PaymentStatus.PAID
          ? 'Khách tự hủy qua trang tra cứu — yêu cầu hoàn tiền'
          : 'Khách tự hủy qua trang tra cứu',
      });
      await manager.save(BookingHistory, history);
    });

    this.logger.log(
      `[GUEST_CANCEL] bookingCode=${booking.booking_code} prevStatus=${prevStatus} → CANCELLED | paymentStatus: ${prevPaymentStatus} → ${newPaymentStatus}`,
    );

    const updatedBooking = await this.bookingRepo.findOne({
      where: { id: booking.id },
      relations: ['roomCategory', 'room'],
    });

    if (!updatedBooking) {
      throw new NotFoundException('Lỗi tải lại thông tin đặt phòng.');
    }

    return this.mapBookingToPublicResponse(updatedBooking);
  }

  /**
   * Map Booking entity sang response object đầy đủ cho guest.
   */
  private mapBookingToPublicResponse(booking: Booking) {
    return {
      id: booking.id,
      bookingCode: booking.booking_code,
      customerName: booking.customer_name,
      phone: booking.phone,
      email: booking.email,
      note: booking.note,
      roomName: booking.roomCategory?.name || '',
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
      bookingStatus: booking.booking_status,
      paymentStatus: booking.payment_status,
      createdAt: booking.created_at,
    };
  }
}
