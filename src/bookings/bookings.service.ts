import { Injectable, BadRequestException, NotFoundException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, EntityManager } from 'typeorm';
import { Booking, BookingStatus, PaymentMethod, PaymentStatus } from './entities/booking.entity';
import { CreateBookingDto } from './dto/create-booking.dto';
import { RoomCategory } from '../rooms/entities/room-category.entity';
import { Room } from '../rooms/entities/room.entity';

@Injectable()
export class BookingsService {
  private readonly logger = new Logger(BookingsService.name);

  constructor(
    @InjectRepository(Booking)
    private bookingRepo: Repository<Booking>,
    @InjectRepository(RoomCategory)
    private roomCategoryRepo: Repository<RoomCategory>,
    private dataSource: DataSource,
  ) {}

  /**
   * Chuẩn hoá date string thành 'YYYY-MM-DD' để tránh lệch timezone.
   * Database lưu kiểu DATE (không có giờ), so sánh bằng string là an toàn.
   */
  private normalizeDateString(date: string | Date): string {
    if (date instanceof Date) {
      return date.toISOString().substring(0, 10);
    }
    // Nếu là string dạng '2026-05-15T00:00:00.000Z', cắt lấy 10 ký tự đầu
    return String(date).substring(0, 10);
  }

  /**
   * Kiểm tra overlap booking cho một phòng (room_category_id).
   *
   * Điều kiện overlap (3 trường hợp bao gồm hết):
   *   - check_in mới nằm trong booking cũ  → checkIn < oldCheckOut
   *   - check_out mới nằm trong booking cũ → checkOut > oldCheckIn
   *   => Kết hợp: newCheckIn < oldCheckOut AND newCheckOut > oldCheckIn
   *   Công thức này bao gồm cả trường hợp booking mới bao trọn booking cũ.
   *
   * Chỉ xét các trạng thái đang hoạt động: PENDING, CONFIRMED, CHECKED_IN.
   * Bỏ qua: CANCELLED, CHECKED_OUT, EXPIRED.
   *
   * @throws BadRequestException nếu có overlap
   */
  private async checkOverlapBookings(
    manager: EntityManager,
    roomCategoryId: string,
    checkInDate: string,
    checkOutDate: string,
    excludeBookingId?: string,
  ): Promise<void> {
    const normalizedCheckIn  = this.normalizeDateString(checkInDate);
    const normalizedCheckOut = this.normalizeDateString(checkOutDate);

    this.logger.log(
      `[OverlapCheck] roomCategoryId=${roomCategoryId} | range=${normalizedCheckIn} → ${normalizedCheckOut}`,
    );

    const ACTIVE_STATUSES = [
      BookingStatus.PENDING,
      BookingStatus.CONFIRMED,
      BookingStatus.CHECKED_IN,
    ];

    let qb = manager
      .createQueryBuilder(Booking, 'booking')
      .select(['booking.id', 'booking.booking_code', 'booking.check_in_date', 'booking.check_out_date', 'booking.booking_status'])
      .where('booking.room_category_id = :categoryId', { categoryId: roomCategoryId })
      .andWhere('booking.booking_status IN (:...statuses)', { statuses: ACTIVE_STATUSES })
      // Điều kiện overlap chuẩn: new.checkIn < old.checkOut AND new.checkOut > old.checkIn
      .andWhere('booking.check_in_date  < :checkOutDate', { checkOutDate: normalizedCheckOut })
      .andWhere('booking.check_out_date > :checkInDate',  { checkInDate:  normalizedCheckIn  });

    // Khi cập nhật booking, loại trừ chính nó khỏi kiểm tra
    if (excludeBookingId) {
      qb = qb.andWhere('booking.id != :excludeId', { excludeId: excludeBookingId });
    }

    const overlappingBookings = await qb.getMany();

    if (overlappingBookings.length > 0) {
      const overlapIds   = overlappingBookings.map((b) => b.id);
      const overlapCodes = overlappingBookings.map((b) => b.booking_code);

      this.logger.warn(
        `[OverlapCheck] CONFLICT detected! roomCategoryId=${roomCategoryId} | range=${normalizedCheckIn} → ${normalizedCheckOut} | overlapBookingIds=[${overlapIds.join(', ')}] | codes=[${overlapCodes.join(', ')}]`,
      );

      throw new BadRequestException({
        statusCode: 400,
        error: 'Bad Request',
        message: 'Phòng đã được đặt trong khoảng thời gian này',
        details: {
          roomCategoryId,
          requestedCheckIn:  normalizedCheckIn,
          requestedCheckOut: normalizedCheckOut,
          conflictingBookings: overlappingBookings.map((b) => ({
            id:            b.id,
            booking_code:  b.booking_code,
            check_in_date: this.normalizeDateString(b.check_in_date),
            check_out_date: this.normalizeDateString(b.check_out_date),
            status:        b.booking_status,
          })),
        },
      });
    }

    this.logger.log(
      `[OverlapCheck] No conflict. roomCategoryId=${roomCategoryId} | range=${normalizedCheckIn} → ${normalizedCheckOut}`,
    );
  }

  async createBooking(createBookingDto: CreateBookingDto) {
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
    } = createBookingDto;

    // Validate dates
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
      throw new BadRequestException('Ngày trả phòng phải lớn hơn ngày nhận phòng');
    }

    const nightCount = Math.round((checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24));

    if (nightCount < 1) {
      throw new BadRequestException('Số đêm phải lớn hơn hoặc bằng 1');
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // 1. Lấy thông tin category
      const category = await queryRunner.manager.findOne(RoomCategory, {
        where: { id: room_category_id }
      });

      if (!category) {
        throw new NotFoundException('Không tìm thấy hạng phòng');
      }

      if (!category.is_active) {
        throw new BadRequestException('Hạng phòng này hiện không hoạt động');
      }

      // Validate guest_count vs capacity — BẮT BUỘC phải check ở backend
      console.log({
        roomId: room_category_id,
        roomCapacity: category.capacity,
        guestCount: guest_count,
      });

      if (guest_count < 1) {
        throw new BadRequestException('Số lượng khách phải lớn hơn hoặc bằng 1');
      }

      if (guest_count > category.capacity) {
        throw new BadRequestException(
          `Số lượng khách vượt quá sức chứa phòng (tối đa ${category.capacity} khách)`,
        );
      }

      // 2. Tính tiền
      const roomPrice = Number(category.base_price);
      const totalAmount = roomPrice * nightCount;

      if (totalAmount < 0) {
        throw new BadRequestException('Tổng tiền không thể là số âm');
      }

      console.log({
        roomId: room_category_id,
        checkinDate: check_in_date,
        checkoutDate: check_out_date,
        nights: nightCount,
        basePrice: roomPrice,
        totalPrice: totalAmount,
        roomCapacity: category.capacity,
        guestCount: guest_count,
      });

      // 3. Kiểm tra overlap booking — chống trùng lịch
      // Logic: booking mới overlap booking cũ khi:
      //   newCheckIn < oldCheckOut AND newCheckOut > oldCheckIn
      // Chỉ xét: PENDING, CONFIRMED, CHECKED_IN
      // Bỏ qua: CANCELLED, CHECKED_OUT, EXPIRED
      const normalizedCheckIn  = this.normalizeDateString(check_in_date);
      const normalizedCheckOut = this.normalizeDateString(check_out_date);

      // Đếm phòng thực tế khả dụng (không MAINTENANCE)
      const totalRoomsCount = await queryRunner.manager.count(Room, {
        where: { category: { id: room_category_id } }
      });
      const maintenanceRoomsCount = await queryRunner.manager.count(Room, {
        where: { category: { id: room_category_id }, status: 'MAINTENANCE' }
      });
      const activeRoomsCount = totalRoomsCount - maintenanceRoomsCount;

      this.logger.log(
        `[BookingCreate] roomCategoryId=${room_category_id} | totalRooms=${totalRoomsCount} | maintenanceRooms=${maintenanceRoomsCount} | activeRooms=${activeRoomsCount}`,
      );

      // Đếm số booking đang chiếm dụng trong khoảng thời gian này
      const occupiedBookingsCount = await queryRunner.manager
        .createQueryBuilder(Booking, 'booking')
        .where('booking.room_category_id = :categoryId', { categoryId: room_category_id })
        .andWhere('booking.booking_status IN (:...statuses)', {
          statuses: [BookingStatus.PENDING, BookingStatus.CONFIRMED, BookingStatus.CHECKED_IN],
        })
        .andWhere('booking.check_in_date  < :checkOutDate', { checkOutDate: normalizedCheckOut })
        .andWhere('booking.check_out_date > :checkInDate',  { checkInDate:  normalizedCheckIn  })
        .getCount();

      this.logger.log(
        `[BookingCreate] occupiedBookings=${occupiedBookingsCount} | availableRooms=${activeRoomsCount - occupiedBookingsCount}`,
      );

      const availableRooms = activeRoomsCount - occupiedBookingsCount;

      if (availableRooms <= 0) {
        // Gọi checkOverlapBookings để lấy chi tiết booking trùng + log đầy đủ
        await this.checkOverlapBookings(
          queryRunner.manager,
          room_category_id,
          normalizedCheckIn,
          normalizedCheckOut,
        );
        // Nếu có phòng nhưng tất cả bị chiếm (trường hợp hiếm)
        throw new BadRequestException({
          statusCode: 400,
          error: 'Bad Request',
          message: 'Phòng đã được đặt trong khoảng thời gian này',
          details: {
            roomCategoryId: room_category_id,
            requestedCheckIn: normalizedCheckIn,
            requestedCheckOut: normalizedCheckOut,
          },
        });
      }

      // 4. Auto assign room_id — tìm phòng thực tế chưa bị trùng lịch
      const occupiedRoomsSubQuery = queryRunner.manager
        .createQueryBuilder(Booking, 'b')
        .select('b.room_id')
        .where('b.room_category_id = :categoryId',       { categoryId: room_category_id })
        .andWhere('b.booking_status IN (:...statuses)',   {
          statuses: [BookingStatus.PENDING, BookingStatus.CONFIRMED, BookingStatus.CHECKED_IN],
        })
        .andWhere('b.check_in_date  < :checkOutDate',    { checkOutDate: normalizedCheckOut })
        .andWhere('b.check_out_date > :checkInDate',     { checkInDate:  normalizedCheckIn  })
        .andWhere('b.room_id IS NOT NULL');

      const availableRoom = await queryRunner.manager
        .createQueryBuilder(Room, 'room')
        .where('room.category_id = :categoryId',         { categoryId: room_category_id })
        .andWhere('room.status != :maintenance',          { maintenance: 'MAINTENANCE' })
        .andWhere(`room.id NOT IN (${occupiedRoomsSubQuery.getQuery()})`)
        .setParameters(occupiedRoomsSubQuery.getParameters())
        .getOne();

      const assignedRoomId = availableRoom ? availableRoom.id : null;
      this.logger.log(
        `[BookingCreate] autoAssign roomId=${assignedRoomId ?? 'null (category-level booking)'}`,
      );

      // Lấy booking sequence để gen code
      const currentYear = new Date().getFullYear();
      let newSequence = 1;
      const lastBooking = await queryRunner.manager.createQueryBuilder(Booking, 'booking')
        .where('booking.booking_code LIKE :pattern', { pattern: `BK${currentYear}%` })
        .orderBy('booking.created_at', 'DESC')
        .getOne();

      if (lastBooking) {
        const lastSeq = parseInt(lastBooking.booking_code.replace(`BK${currentYear}`, ''), 10);
        if (!isNaN(lastSeq)) {
          newSequence = lastSeq + 1;
        }
      }
      const bookingCode = `BK${currentYear}${newSequence.toString().padStart(4, '0')}`;

      // 5. Xác định Status
      let finalBookingStatus = BookingStatus.PENDING;
      let finalPaymentStatus = PaymentStatus.UNPAID;
      let expiredAt: Date | null = null;

      if (payment_method === PaymentMethod.CASH) {
        finalBookingStatus = BookingStatus.CONFIRMED;
      } else {
        // Có thể là Bank Transfer hoặc EWALLET
        finalBookingStatus = BookingStatus.PENDING;
        expiredAt = new Date();
        expiredAt.setMinutes(expiredAt.getMinutes() + 15); // +15 phút
      }

      const newBooking = new Booking();
      Object.assign(newBooking, {
        booking_code: bookingCode,
        customer_name,
        phone,
        email,
        note,
        room_category_id,
        room_id: assignedRoomId,
        check_in_date: check_in_date,
        check_out_date: check_out_date,
        guest_count,
        night_count: nightCount,
        room_price: roomPrice,
        total_amount: totalAmount,
        payment_method,
        payment_status: finalPaymentStatus,
        booking_status: finalBookingStatus,
        expired_at: expiredAt
      });

      await queryRunner.manager.save(newBooking);
      await queryRunner.commitTransaction();

      return newBooking;

    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async getBookingByCode(booking_code: string) {
    const booking = await this.bookingRepo.createQueryBuilder('booking')
      .leftJoinAndSelect('booking.room_category', 'category')
      .leftJoinAndSelect('booking.room', 'room')
      .where('booking.booking_code = :booking_code', { booking_code })
      .getOne();

    if (!booking) {
      throw new NotFoundException('Không tìm thấy thông tin đặt phòng');
    }

    return booking;
  }
}
