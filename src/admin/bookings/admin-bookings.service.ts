import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Not, In } from 'typeorm';
import { Booking, BookingStatus } from '../../bookings/entities/booking.entity';
import { BookingHistory } from '../../bookings/entities/booking-history.entity';
import { QueryBookingDto } from '../../bookings/dto/query-booking.dto';
import { Room } from '../../rooms/entities/room.entity';

@Injectable()
export class AdminBookingsService {
  constructor(
    @InjectRepository(Booking)
    private bookingRepo: Repository<Booking>,
    @InjectRepository(BookingHistory)
    private historyRepo: Repository<BookingHistory>,
    @InjectRepository(Room)
    private roomRepo: Repository<Room>,
  ) {}

  private async logHistory(
    booking_id: string,
    action: string,
    admin_id?: string,
    previous_status?: BookingStatus,
    new_status?: BookingStatus,
    note?: string
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

  private async checkOverlap(room_id: string, check_in: string, check_out: string, exclude_booking_id?: string): Promise<boolean> {
    const qb = this.bookingRepo.createQueryBuilder('booking')
      .where('booking.room_id = :room_id', { room_id })
      .andWhere('booking.booking_status IN (:...statuses)', { 
        statuses: [BookingStatus.CONFIRMED, BookingStatus.CHECKED_IN] 
      })
      .andWhere('booking.check_in_date < :check_out', { check_out })
      .andWhere('booking.check_out_date > :check_in', { check_in });

    if (exclude_booking_id) {
      qb.andWhere('booking.id != :exclude_booking_id', { exclude_booking_id });
    }

    const count = await qb.getCount();
    return count > 0;
  }

  async getBookings(query: QueryBookingDto) {
    const page = query.page || 1;
    const limit = query.limit || 10;

    const qb = this.bookingRepo.createQueryBuilder('booking')
      .leftJoinAndSelect('booking.room_category', 'category')
      .leftJoinAndSelect('booking.room', 'room')
      .orderBy('booking.created_at', 'DESC');

    if (query.search) {
      qb.andWhere('(booking.booking_code ILIKE :search OR booking.customer_name ILIKE :search OR booking.phone ILIKE :search)', { search: `%${query.search}%` });
    }

    // Hỗ trợ cả ?status= (frontend mới) lẫn ?booking_status= (backward compat)
    const bookingStatus = query.status || query.booking_status;
    if (bookingStatus) {
      qb.andWhere('booking.booking_status = :status', { status: bookingStatus });
    }

    if (query.payment_status) {
      qb.andWhere('booking.payment_status = :payment', { payment: query.payment_status });
    }

    if (query.room_category_id) {
      qb.andWhere('booking.room_category_id = :categoryId', { categoryId: query.room_category_id });
    }

    if (query.check_in_from) {
      qb.andWhere('booking.check_in_date >= :from', { from: query.check_in_from });
    }

    if (query.check_in_to) {
      qb.andWhere('booking.check_in_date <= :to', { to: query.check_in_to });
    }

    if (query.date) {
      qb.andWhere('(:date >= booking.check_in_date AND :date <= booking.check_out_date)', { date: query.date });
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
      }
    };
  }

  async getBookingDetail(id: string) {
    const booking = await this.bookingRepo.findOne({
      where: { id },
      relations: ['room_category', 'room', 'histories', 'histories.admin'],
      order: {
        histories: { created_at: 'DESC' }
      }
    });

    if (!booking) {
      throw new NotFoundException('Không tìm thấy booking');
    }

    // Lọc bớt dữ liệu admin (tránh leak password_hash)
    if (booking.histories) {
      booking.histories.forEach(h => {
        if (h.admin) {
          delete (h.admin as any).passwordHash;
        }
      });
    }

    return booking;
  }

  async updateBookingStatus(id: string, newStatus: BookingStatus, adminId?: string, note?: string) {
    const booking = await this.getBookingDetail(id);
    const prevStatus = booking.booking_status;

    if (prevStatus === newStatus) {
      throw new BadRequestException('Booking đã ở trạng thái này');
    }

    // Nếu chuyển sang CONFIRMED hoặc CHECKED_IN, check overlap
    if ([BookingStatus.CONFIRMED, BookingStatus.CHECKED_IN].includes(newStatus) && booking.room_id) {
      const isOverlap = await this.checkOverlap(booking.room_id, booking.check_in_date, booking.check_out_date, booking.id);
      if (isOverlap) {
        throw new BadRequestException('Phòng đã được đặt trong khoảng thời gian này');
      }
    }

    booking.booking_status = newStatus;
    const updated = await this.bookingRepo.save(booking);

    await this.logHistory(booking.id, 'STATUS_UPDATE', adminId, prevStatus, newStatus, note);

    return updated;
  }

  async confirmBooking(id: string, adminId?: string, note?: string) {
    const booking = await this.getBookingDetail(id);
    const prevStatus = booking.booking_status;

    if (prevStatus !== BookingStatus.PENDING) {
      throw new BadRequestException('Chỉ có thể xác nhận booking đang ở trạng thái PENDING');
    }

    if (booking.expired_at && new Date() > new Date(booking.expired_at)) {
      throw new BadRequestException('Booking này đã quá hạn xác nhận');
    }

    if (booking.room_id) {
      const isOverlap = await this.checkOverlap(booking.room_id, booking.check_in_date, booking.check_out_date, booking.id);
      if (isOverlap) {
        throw new BadRequestException('Phòng này đã bị chiếm trong khoảng thời gian này. Vui lòng đổi phòng trước khi xác nhận.');
      }
    }

    booking.booking_status = BookingStatus.CONFIRMED;
    const updated = await this.bookingRepo.save(booking);

    await this.logHistory(booking.id, 'CONFIRM_BOOKING', adminId, prevStatus, BookingStatus.CONFIRMED, note);
    return updated;
  }

  async checkInBooking(id: string, adminId?: string, note?: string) {
    const booking = await this.getBookingDetail(id);
    const prevStatus = booking.booking_status;

    if (prevStatus !== BookingStatus.CONFIRMED) {
      throw new BadRequestException('Chỉ booking đã CONFIRMED mới được Check-in');
    }

    if (!booking.room_id) {
      throw new BadRequestException('Vui lòng gán phòng cho booking trước khi Check-in');
    }

    const isOverlap = await this.checkOverlap(booking.room_id, booking.check_in_date, booking.check_out_date, booking.id);
    if (isOverlap) {
      throw new BadRequestException('Phòng này đang bị trùng lịch với một booking khác.');
    }

    booking.booking_status = BookingStatus.CHECKED_IN;
    
    // Đổi trạng thái phòng thành OCCUPIED
    await this.roomRepo.update(booking.room_id, { status: 'OCCUPIED' });

    const updated = await this.bookingRepo.save(booking);
    await this.logHistory(booking.id, 'CHECK_IN_BOOKING', adminId, prevStatus, BookingStatus.CHECKED_IN, note);
    return updated;
  }

  async checkOutBooking(id: string, adminId?: string, note?: string) {
    const booking = await this.getBookingDetail(id);
    const prevStatus = booking.booking_status;

    if (prevStatus !== BookingStatus.CHECKED_IN) {
      throw new BadRequestException('Chỉ booking đã CHECKED_IN mới được Check-out');
    }

    booking.booking_status = BookingStatus.CHECKED_OUT;

    // Trả lại trạng thái phòng thành AVAILABLE
    if (booking.room_id) {
      await this.roomRepo.update(booking.room_id, { status: 'AVAILABLE' });
    }

    const updated = await this.bookingRepo.save(booking);
    await this.logHistory(booking.id, 'CHECK_OUT_BOOKING', adminId, prevStatus, BookingStatus.CHECKED_OUT, note);
    return updated;
  }

  async cancelBooking(id: string, adminId?: string, reason?: string) {
    const booking = await this.getBookingDetail(id);
    const prevStatus = booking.booking_status;

    if ([BookingStatus.CHECKED_IN, BookingStatus.CHECKED_OUT, BookingStatus.CANCELLED].includes(prevStatus)) {
      throw new BadRequestException('Không thể hủy booking này do trạng thái không hợp lệ');
    }

    booking.booking_status = BookingStatus.CANCELLED;
    
    // Nếu huỷ booking đã check-in (có thể lỗi logic hoặc huỷ ngoại lệ), ta phải nhả phòng
    // Dù chặn ở trên, nhưng an toàn thì ta vẫn check nếu room OCCUPIED bởi booking này.
    // Thực tế cancel chỉ áp dụng cho PENDING/CONFIRMED -> phòng vẫn là AVAILABLE.

    const updated = await this.bookingRepo.save(booking);
    await this.logHistory(booking.id, 'CANCEL_BOOKING', adminId, prevStatus, BookingStatus.CANCELLED, reason);
    return updated;
  }
}
