import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Booking, BookingStatus } from '../../bookings/entities/booking.entity';
import { BookingHistory } from '../../bookings/entities/booking-history.entity';
import { QueryBookingDto } from '../../bookings/dto/query-booking.dto';
import { Room } from '../../rooms/entities/room.entity';
import { GetBookingCalendarDto } from './dto/booking-calendar-query.dto';
import { CustomerService } from '../../customer/customer.service';

@Injectable()
export class AdminBookingsService {
  private readonly logger = new Logger(AdminBookingsService.name);

  constructor(
    @InjectRepository(Booking)
    public bookingRepo: Repository<Booking>,
    @InjectRepository(BookingHistory)
    private historyRepo: Repository<BookingHistory>,
    @InjectRepository(Room)
    private roomRepo: Repository<Room>,
    private readonly customerService: CustomerService,
  ) {}

  // ─────────────────────────────────────────────────────────────────────────
  // State Machine
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Kiểm tra xem transition từ currentStatus → targetStatus có nằm trong
   * workflow được phép không.
   *
   * Workflow duy nhất được phép:
   *   PENDING    → CONFIRMED  ✅
   *   PENDING    → CANCELLED  ✅
   *   CONFIRMED  → CHECKED_IN ✅
   *   CONFIRMED  → CANCELLED  ✅
   *   CHECKED_IN → CHECKED_OUT ✅
   *
   * Tất cả transition khác đều bị từ chối.
   */
  static isValidTransition(
    current: BookingStatus,
    target: BookingStatus,
  ): boolean {
    const allowed: Partial<Record<BookingStatus, BookingStatus[]>> = {
      [BookingStatus.PENDING]: [
        BookingStatus.CONFIRMED,
        BookingStatus.CANCELLED,
      ],
      [BookingStatus.CONFIRMED]: [
        BookingStatus.CHECKED_IN,
        BookingStatus.CANCELLED,
      ],
      [BookingStatus.CHECKED_IN]: [BookingStatus.CHECKED_OUT],
      [BookingStatus.CHECKED_OUT]: [],
      [BookingStatus.CANCELLED]: [],
      [BookingStatus.EXPIRED]: [],
    };
    return (allowed[current] ?? []).includes(target);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Helpers
  // ─────────────────────────────────────────────────────────────────────────

  private async logHistory(
    booking_id: string,
    action: string,
    admin_id?: string,
    previous_status?: BookingStatus,
    new_status?: BookingStatus,
    note?: string,
  ) {
    const history = this.historyRepo.create({
      booking_id,
      admin_id,
      action,
      previous_status,
      new_status,
      note,
    });
    await this.historyRepo.save(history);
  }

  private async checkOverlap(
    room_id: string,
    check_in: string,
    check_out: string,
    exclude_booking_id?: string,
  ): Promise<boolean> {
    const qb = this.bookingRepo
      .createQueryBuilder('booking')
      .where('booking.room_id = :room_id', { room_id })
      .andWhere('booking.booking_status IN (:...statuses)', {
        statuses: [BookingStatus.CONFIRMED, BookingStatus.CHECKED_IN],
      })
      .andWhere('booking.check_in_date < :check_out', { check_out })
      .andWhere('booking.check_out_date > :check_in', { check_in });

    if (exclude_booking_id) {
      qb.andWhere('booking.id != :exclude_booking_id', { exclude_booking_id });
    }

    const count = await qb.getCount();
    return count > 0;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Query
  // ─────────────────────────────────────────────────────────────────────────

  async getBookings(query: QueryBookingDto) {
    const page = query.page || 1;
    const limit = query.limit || 10;

    const qb = this.bookingRepo
      .createQueryBuilder('booking')
      .leftJoinAndSelect('booking.roomCategory', 'category')
      .leftJoinAndSelect('booking.room', 'room')
      .orderBy('booking.created_at', 'DESC');

    if (query.search) {
      qb.andWhere(
        '(booking.booking_code ILIKE :search OR booking.customer_name ILIKE :search OR booking.phone ILIKE :search)',
        { search: `%${query.search}%` },
      );
    }

    // Hỗ trợ cả ?status= (frontend mới) lẫn ?booking_status= (backward compat)
    const bookingStatus = query.status || query.booking_status;
    if (bookingStatus) {
      qb.andWhere('booking.booking_status = :status', {
        status: bookingStatus,
      });
    }

    if (query.payment_status) {
      qb.andWhere('booking.payment_status = :payment', {
        payment: query.payment_status,
      });
    }

    if (query.room_category_id) {
      qb.andWhere('booking.room_category_id = :categoryId', {
        categoryId: query.room_category_id,
      });
    }

    if (query.check_in_from) {
      qb.andWhere('booking.check_in_date >= :from', {
        from: query.check_in_from,
      });
    }

    if (query.check_in_to) {
      qb.andWhere('booking.check_in_date <= :to', { to: query.check_in_to });
    }

    if (query.date) {
      qb.andWhere(
        '(:date >= booking.check_in_date AND :date <= booking.check_out_date)',
        { date: query.date },
      );
    }

    qb.skip((page - 1) * limit).take(limit);

    const [data, total] = await qb.getManyAndCount();

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getBookingDetail(id: string) {
    const booking = await this.bookingRepo.findOne({
      where: { id },
      relations: ['roomCategory', 'room', 'histories', 'histories.admin'],
      order: {
        histories: { created_at: 'DESC' },
      },
    });

    if (!booking) {
      throw new NotFoundException('Không tìm thấy booking');
    }

    // Lọc bớt dữ liệu admin (tránh leak password_hash)
    if (booking.histories) {
      booking.histories.forEach((h) => {
        if (h.admin) {
          delete (h.admin as any).passwordHash;
        }
      });
    }

    return booking;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Status Mutations
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Generic status update dùng cho PATCH /admin/bookings/:id.
   * - Validate transition qua isValidTransition()
   * - Update booking_status + updated_at trong transaction
   * - Lưu BookingHistory trong cùng transaction
   * - Log [BOOKING_STATUS_CHANGE]
   */
  async updateBookingStatus(
    id: string,
    newStatus: BookingStatus,
    adminId?: string,
    note?: string,
  ): Promise<Booking> {
    // 1. Kiểm tra booking tồn tại
    const booking = await this.getBookingDetail(id);
    const prevStatus = booking.booking_status;

    // 2. Validate transition theo state machine
    if (!AdminBookingsService.isValidTransition(prevStatus, newStatus)) {
      throw new BadRequestException(
        `Không thể chuyển trạng thái từ ${prevStatus} sang ${newStatus}.`,
      );
    }

    // 3. Kiểm tra room_id khi chuyển sang CHECKED_IN hoặc CHECKED_OUT
    if (
      [BookingStatus.CHECKED_IN, BookingStatus.CHECKED_OUT].includes(newStatus)
    ) {
      if (!booking.room_id) {
        throw new BadRequestException(
          `Không thể chuyển sang ${newStatus}: booking chưa được gán phòng.`,
        );
      }
      if (!booking.room) {
        const room = await this.roomRepo.findOne({
          where: { id: booking.room_id },
        });
        if (!room) {
          throw new BadRequestException(
            'Không tìm thấy thông tin phòng tương ứng.',
          );
        }
        booking.room = room;
      }
    }

    // 4. Kiểm tra overlap khi CONFIRMED hoặc CHECKED_IN
    if (
      [BookingStatus.CONFIRMED, BookingStatus.CHECKED_IN].includes(newStatus) &&
      booking.room_id
    ) {
      const isOverlap = await this.checkOverlap(
        booking.room_id,
        booking.check_in_date,
        booking.check_out_date,
        booking.id,
      );
      if (isOverlap) {
        throw new BadRequestException(
          'Hết phòng trong khoảng thời gian này (phòng đã bị chiếm).',
        );
      }
    }

    // 5. Update trong transaction — chỉ cập nhật booking_status và updated_at
    await this.bookingRepo.manager.transaction(async (manager) => {
      await manager.update(Booking, id, {
        booking_status: newStatus,
        updated_at: new Date(),
      });

      // Cập nhật trạng thái phòng tương ứng
      if (newStatus === BookingStatus.CHECKED_IN && booking.room_id) {
        await manager.update(Room, booking.room_id, { status: 'OCCUPIED' });
      } else if (newStatus === BookingStatus.CHECKED_OUT && booking.room_id) {
        await manager.update(Room, booking.room_id, { status: 'AVAILABLE' });
      } else if (
        newStatus === BookingStatus.CANCELLED &&
        prevStatus === BookingStatus.CHECKED_IN &&
        booking.room_id
      ) {
        await manager.update(Room, booking.room_id, { status: 'AVAILABLE' });
      }

      // Lưu lịch sử trong cùng transaction
      const history = manager.create(BookingHistory, {
        booking_id: booking.id,
        admin_id: adminId,
        action: 'STATUS_UPDATE',
        previous_status: prevStatus,
        new_status: newStatus,
        note,
      });
      await manager.save(history);

      if (newStatus === BookingStatus.CHECKED_OUT) {
        await this.customerService.handleBookingCompleted(booking.id, manager);
      }
    });

    // 6. Log chuẩn [BOOKING_STATUS_CHANGE]
    this.logger.log(
      `[BOOKING_STATUS_CHANGE] bookingId=${id} oldStatus=${prevStatus} newStatus=${newStatus}`,
    );

    // 7. Trả về booking đã cập nhật
    return this.bookingRepo.findOne({ where: { id } }) as Promise<Booking>;
  }

  async confirmBooking(id: string, adminId?: string, note?: string) {
    const booking = await this.getBookingDetail(id);
    const prevStatus = booking.booking_status;

    // Validate transition
    if (
      !AdminBookingsService.isValidTransition(
        prevStatus,
        BookingStatus.CONFIRMED,
      )
    ) {
      throw new BadRequestException(
        `Chỉ có thể xác nhận booking đang ở trạng thái PENDING. Trạng thái hiện tại: ${prevStatus}`,
      );
    }

    if (booking.expired_at && new Date() > new Date(booking.expired_at)) {
      throw new BadRequestException('Booking này đã quá hạn xác nhận');
    }

    if (booking.room_id) {
      const isOverlap = await this.checkOverlap(
        booking.room_id,
        booking.check_in_date,
        booking.check_out_date,
        booking.id,
      );
      if (isOverlap) {
        throw new BadRequestException(
          'Phòng này đã bị chiếm trong khoảng thời gian này. Vui lòng đổi phòng trước khi xác nhận.',
        );
      }
    }

    booking.booking_status = BookingStatus.CONFIRMED;
    const updated = await this.bookingRepo.save(booking);

    await this.logHistory(
      booking.id,
      'CONFIRM_BOOKING',
      adminId,
      prevStatus,
      BookingStatus.CONFIRMED,
      note,
    );

    this.logger.log(
      `[BOOKING_STATUS_CHANGE] bookingId=${id} oldStatus=${prevStatus} newStatus=${BookingStatus.CONFIRMED}`,
    );

    return updated;
  }

  async checkInBooking(id: string, adminId?: string, note?: string) {
    const booking = await this.getBookingDetail(id);
    const prevStatus = booking.booking_status;

    // Validate transition
    if (
      !AdminBookingsService.isValidTransition(
        prevStatus,
        BookingStatus.CHECKED_IN,
      )
    ) {
      throw new BadRequestException(
        `Chỉ booking đã CONFIRMED mới được Check-in. Trạng thái hiện tại: ${prevStatus}`,
      );
    }

    if (!booking.room_id) {
      throw new BadRequestException(
        'Vui lòng gán phòng cho booking trước khi Check-in',
      );
    }

    const isOverlap = await this.checkOverlap(
      booking.room_id,
      booking.check_in_date,
      booking.check_out_date,
      booking.id,
    );
    if (isOverlap) {
      throw new BadRequestException(
        'Phòng này đang bị trùng lịch với một booking khác.',
      );
    }

    booking.booking_status = BookingStatus.CHECKED_IN;

    // Đổi trạng thái phòng thành OCCUPIED
    await this.roomRepo.update(booking.room_id, { status: 'OCCUPIED' });

    const updated = await this.bookingRepo.save(booking);
    await this.logHistory(
      booking.id,
      'CHECK_IN_BOOKING',
      adminId,
      prevStatus,
      BookingStatus.CHECKED_IN,
      note,
    );

    this.logger.log(
      `[BOOKING_STATUS_CHANGE] bookingId=${id} oldStatus=${prevStatus} newStatus=${BookingStatus.CHECKED_IN}`,
    );

    return updated;
  }

  async checkOutBooking(id: string, adminId?: string, note?: string) {
    const booking = await this.getBookingDetail(id);
    const prevStatus = booking.booking_status;

    // Validate transition
    if (
      !AdminBookingsService.isValidTransition(
        prevStatus,
        BookingStatus.CHECKED_OUT,
      )
    ) {
      throw new BadRequestException(
        `Chỉ booking đã CHECKED_IN mới được Check-out. Trạng thái hiện tại: ${prevStatus}`,
      );
    }

    const updated = await this.bookingRepo.manager.transaction(async (manager) => {
      booking.booking_status = BookingStatus.CHECKED_OUT;
      booking.updated_at = new Date();
      const saved = await manager.save(Booking, booking);

      // Trả lại trạng thái phòng thành AVAILABLE
      if (booking.room_id) {
        await manager.update(Room, booking.room_id, { status: 'AVAILABLE' });
      }

      // Lưu lịch sử
      const history = manager.create(BookingHistory, {
        booking_id: booking.id,
        admin_id: adminId,
        action: 'CHECK_OUT_BOOKING',
        previous_status: prevStatus,
        new_status: BookingStatus.CHECKED_OUT,
        note,
      });
      await manager.save(history);

      // Cập nhật Loyalty & Voucher
      await this.customerService.handleBookingCompleted(booking.id, manager);

      return saved;
    });

    this.logger.log(
      `[BOOKING_STATUS_CHANGE] bookingId=${id} oldStatus=${prevStatus} newStatus=${BookingStatus.CHECKED_OUT}`,
    );

    return updated;
  }

  async cancelBooking(id: string, adminId?: string, reason?: string) {
    const booking = await this.getBookingDetail(id);
    const prevStatus = booking.booking_status;

    // Validate transition — chỉ PENDING và CONFIRMED mới được hủy
    if (
      !AdminBookingsService.isValidTransition(
        prevStatus,
        BookingStatus.CANCELLED,
      )
    ) {
      throw new BadRequestException(
        `Không thể hủy booking ở trạng thái ${prevStatus}. Chỉ PENDING hoặc CONFIRMED mới được hủy.`,
      );
    }

    booking.booking_status = BookingStatus.CANCELLED;

    const updated = await this.bookingRepo.save(booking);
    await this.logHistory(
      booking.id,
      'CANCEL_BOOKING',
      adminId,
      prevStatus,
      BookingStatus.CANCELLED,
      reason,
    );

    this.logger.log(
      `[BOOKING_STATUS_CHANGE] bookingId=${id} oldStatus=${prevStatus} newStatus=${BookingStatus.CANCELLED}`,
    );

    return updated;
  }

  async getBookingCalendar(query: GetBookingCalendarDto) {
    const start = new Date(query.startDate);
    const end = new Date(query.endDate);

    if (start >= end) {
      throw new BadRequestException('startDate phải nhỏ hơn endDate');
    }

    const bookings = await this.bookingRepo
      .createQueryBuilder('booking')
      .leftJoinAndSelect('booking.room', 'room')
      .leftJoinAndSelect('booking.roomCategory', 'roomCategory')
      .where('booking.booking_status IN (:...statuses)', {
        statuses: [
          BookingStatus.PENDING,
          BookingStatus.CONFIRMED,
          BookingStatus.CHECKED_IN,
        ],
      })
      .andWhere('booking.check_in_date < :endDate', { endDate: query.endDate })
      .andWhere('booking.check_out_date > :startDate', { startDate: query.startDate })
      .orderBy('booking.check_in_date', 'ASC')
      .getMany();

    return bookings.map((booking) => ({
      id: booking.id,
      bookingCode: booking.booking_code,
      customerName: booking.customer_name,
      roomId: booking.room_id || null,
      roomNumber: booking.room?.room_number || null,
      roomCategoryName: booking.roomCategory?.name || null,
      checkInDate: booking.check_in_date,
      checkOutDate: booking.check_out_date,
      bookingStatus: booking.booking_status,
    }));
  }
}
