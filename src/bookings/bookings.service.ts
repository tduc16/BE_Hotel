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
import { CreateBookingDto } from './dto/create-booking.dto';
import { RoomCategory } from '../rooms/entities/room-category.entity';
import { Room } from '../rooms/entities/room.entity';
import { MailService } from '../mail/mail.service';
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
    private mailService: MailService,
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

  async createBooking(createBookingDto: CreateBookingDto, customerId: string | null = null) {
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
      throw new BadRequestException(
        'Ngày nhận phòng không thể nằm trong quá khứ',
      );
    }

    if (checkOut <= checkIn) {
      throw new BadRequestException(
        'Ngày trả phòng phải lớn hơn ngày nhận phòng',
      );
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
      // 1. Lấy thông tin category
      const category = await queryRunner.manager.findOne(RoomCategory, {
        where: { id: room_category_id },
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
        throw new BadRequestException(
          'Số lượng khách phải lớn hơn hoặc bằng 1',
        );
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

      // 3. Kiểm tra overlap booking — chống trùng lịch và tính availability
      const normalizedCheckIn = this.normalizeDateString(check_in_date);
      const normalizedCheckOut = this.normalizeDateString(check_out_date);

      // Đếm tổng số phòng thực tế khả dụng của hạng phòng (không MAINTENANCE)
      const totalRoomsCount = await queryRunner.manager.count(Room, {
        where: { category: { id: room_category_id } },
      });
      const maintenanceRoomsCount = await queryRunner.manager.count(Room, {
        where: { category: { id: room_category_id }, status: 'MAINTENANCE' },
      });
      const activeRoomsCount = totalRoomsCount - maintenanceRoomsCount;

      // Lấy danh sách các booking trùng lịch trong hạng phòng này
      const overlappingBookings = await queryRunner.manager
        .createQueryBuilder(Booking, 'booking')
        .select(['booking.id', 'booking.room_id', 'booking.booking_code'])
        .where('booking.room_category_id = :categoryId', {
          categoryId: room_category_id,
        })
        .andWhere('booking.booking_status IN (:...statuses)', {
          statuses: [
            BookingStatus.PENDING,
            BookingStatus.CONFIRMED,
            BookingStatus.CHECKED_IN,
          ],
        })
        .andWhere('booking.check_in_date  < :checkOutDate', {
          checkOutDate: normalizedCheckOut,
        })
        .andWhere('booking.check_out_date > :checkInDate', {
          checkInDate: normalizedCheckIn,
        })
        .getMany();

      const bookedRoomsCount = overlappingBookings.length;
      const availableRoomsCount = activeRoomsCount - bookedRoomsCount;

      this.logger.log(
        `[AvailabilityCheck] roomCategoryId=${room_category_id} | totalActiveRooms=${activeRoomsCount} | bookedRooms=${bookedRoomsCount} | availableRooms=${availableRoomsCount}`,
      );

      if (availableRoomsCount <= 0) {
        throw new BadRequestException({
          statusCode: 400,
          error: 'Bad Request',
          message: 'Hết phòng trong khoảng thời gian này',
          details: {
            roomCategoryId: room_category_id,
            requestedCheckIn: normalizedCheckIn,
            requestedCheckOut: normalizedCheckOut,
            totalActiveRooms: activeRoomsCount,
            bookedRooms: bookedRoomsCount,
            availableRooms: availableRoomsCount,
          },
        });
      }

      // 4. Auto assign room_id — tìm phòng thực tế chưa bị trùng lịch để gán cho booking mới
      const occupiedRoomIds = overlappingBookings
        .map((b) => b.room_id)
        .filter((id) => id != null);

      let availableRoomQuery = queryRunner.manager
        .createQueryBuilder(Room, 'room')
        .where('room.category_id = :categoryId', {
          categoryId: room_category_id,
        })
        .andWhere('room.status != :maintenance', {
          maintenance: 'MAINTENANCE',
        });

      if (occupiedRoomIds.length > 0) {
        availableRoomQuery = availableRoomQuery.andWhere(
          'room.id NOT IN (:...occupiedRoomIds)',
          { occupiedRoomIds },
        );
      }

      const availableRoom = await availableRoomQuery.getOne();

      if (!availableRoom) {
        // Fallback an toàn (trường hợp DB không nhất quán)
        throw new BadRequestException(
          'Hết phòng trong khoảng thời gian này (không tìm thấy phòng trống vật lý)',
        );
      }

      const assignedRoomId = availableRoom.id;
      this.logger.log(
        `[BookingCreate] Assigned room_id=${assignedRoomId} cho booking mới`,
      );

      // Lấy booking sequence để gen code
      const currentYear = new Date().getFullYear();
      let newSequence = 1;
      const lastBooking = await queryRunner.manager
        .createQueryBuilder(Booking, 'booking')
        .where('booking.booking_code LIKE :pattern', {
          pattern: `BK${currentYear}%`,
        })
        .orderBy('booking.created_at', 'DESC')
        .getOne();

      if (lastBooking) {
        const lastSeq = parseInt(
          lastBooking.booking_code.replace(`BK${currentYear}`, ''),
          10,
        );
        if (!isNaN(lastSeq)) {
          newSequence = lastSeq + 1;
        }
      }
      const bookingCode = `BK${currentYear}${newSequence.toString().padStart(4, '0')}`;

      // 5. Xác định Status
      let finalBookingStatus = BookingStatus.PENDING;
      const finalPaymentStatus = PaymentStatus.UNPAID;
      let expiredAt: Date | null = null;

      if (payment_method === PaymentMethod.CASH) {
        finalBookingStatus = BookingStatus.CONFIRMED;
      } else {
        // Có thể là Bank Transfer hoặc EWALLET
        finalBookingStatus = BookingStatus.PENDING;
        expiredAt = new Date();
        expiredAt.setMinutes(expiredAt.getMinutes() + 15); // +15 phút
      }

      console.log('--- START CREATE BOOKING ---');
      console.log('DTO:', createBookingDto);

      // Generate booking_token (UUID v4) — dùng cho link quản lý booking không cần đăng nhập
      const bookingToken = randomUUID();

      const newBooking = new Booking();
      Object.assign(newBooking, {
        booking_code: bookingCode,
        booking_token: bookingToken,
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
        expired_at: expiredAt,
        customerId: customerId,
      });

      console.log('--- BEFORE SAVE BOOKING ---');
      console.log(newBooking);

      let savedBooking;
      try {
        savedBooking = await queryRunner.manager.save(newBooking);
        console.log('--- AFTER SAVE BOOKING ---');
        console.log(savedBooking);
      } catch (saveError) {
        console.error('--- SAVE BOOKING ERROR ---', saveError);
        throw new BadRequestException(
          'Lỗi khi lưu thông tin đặt phòng vào CSDL',
        );
      }

      await queryRunner.commitTransaction();

      // Gửi email xác nhận sau khi commit transaction thành công
      // Không await để không block response — lỗi mail sẽ chỉ được log
      this.mailService
        .sendBookingConfirmation({
          customerName: customer_name,
          email,
          bookingCode,
          bookingToken,
          roomName: category.name,
          roomNumber: availableRoom.room_number ?? undefined,
          checkInDate: check_in_date,
          checkOutDate: check_out_date,
          guestCount: guest_count,
          nightCount,
          totalAmount,
          paymentMethod: payment_method,
          paymentStatus: finalPaymentStatus,
          bookingStatus: finalBookingStatus,
        })
        .catch((err) =>
          this.logger.error('[MAIL_ASYNC_ERROR] Lỗi gửi email xác nhận booking:', err),
        );

      return savedBooking;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      console.error('--- CREATE BOOKING TRANSACTION ROLLBACK ---', error);
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
}
