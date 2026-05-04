import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Booking, BookingStatus, PaymentMethod, PaymentStatus } from './entities/booking.entity';
import { CreateBookingDto } from './dto/create-booking.dto';
import { RoomCategory } from '../rooms/entities/room-category.entity';
import { Room } from '../rooms/entities/room.entity';

@Injectable()
export class BookingsService {
  constructor(
    @InjectRepository(Booking)
    private bookingRepo: Repository<Booking>,
    @InjectRepository(RoomCategory)
    private roomCategoryRepo: Repository<RoomCategory>,
    private dataSource: DataSource,
  ) {}

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
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (checkIn < today) {
      throw new BadRequestException('Ngày nhận phòng không thể nằm trong quá khứ');
    }
    
    if (checkOut <= checkIn) {
      throw new BadRequestException('Ngày trả phòng phải sau ngày nhận phòng');
    }

    const nightCount = Math.round((checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24));

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

      if (guest_count > category.capacity) {
        throw new BadRequestException(`Hạng phòng này chỉ chứa tối đa ${category.capacity} khách`);
      }

      // 2. Tính tiền
      const roomPrice = category.base_price;
      const totalAmount = Number(roomPrice) * nightCount;

      // 3. Kiểm tra phòng trống THỰC TẾ
      const totalRoomsCount = await queryRunner.manager.count(Room, {
        where: {
          category: { id: room_category_id },
        }
      });
      // Giả sử lấy cả phòng MAINTENANCE ra trừ đi nếu cần, hiện tại ta đếm phòng thực tế khả dụng.
      const maintenanceRoomsCount = await queryRunner.manager.count(Room, {
        where: {
          category: { id: room_category_id },
          status: 'MAINTENANCE'
        }
      });

      const activeRoomsCount = totalRoomsCount - maintenanceRoomsCount;

      // Đếm số lượng booking đang chiếm dụng phòng này trong khoảng thời gian in-out
      const occupiedBookingsCount = await queryRunner.manager.createQueryBuilder(Booking, 'booking')
        .where('booking.room_category_id = :categoryId', { categoryId: room_category_id })
        .andWhere('booking.booking_status IN (:...statuses)', { 
          statuses: [BookingStatus.PENDING, BookingStatus.CONFIRMED, BookingStatus.CHECKED_IN] 
        })
        .andWhere('booking.check_in_date < :checkOutDate', { checkOutDate: check_out_date })
        .andWhere('booking.check_out_date > :checkInDate', { checkInDate: check_in_date })
        .getCount();

      const availableRooms = activeRoomsCount - occupiedBookingsCount;

      if (availableRooms <= 0) {
        throw new BadRequestException('Loại phòng này đã hết trong thời gian bạn chọn');
      }

      // 4. Auto assign room_id (nếu đơn giản tìm được phòng không bị trùng thì gán)
      // Lấy danh sách các room_id đang bị chiếm trong khoảng thời gian này
      const occupiedRoomsSubQuery = queryRunner.manager.createQueryBuilder(Booking, 'b')
        .select('b.room_id')
        .where('b.room_category_id = :categoryId', { categoryId: room_category_id })
        .andWhere('b.booking_status IN (:...statuses)')
        .andWhere('b.check_in_date < :checkOutDate')
        .andWhere('b.check_out_date > :checkInDate')
        .andWhere('b.room_id IS NOT NULL');

      const availableRoom = await queryRunner.manager.createQueryBuilder(Room, 'room')
        .where('room.category_id = :categoryId', { categoryId: room_category_id })
        .andWhere('room.status != :maintenance', { maintenance: 'MAINTENANCE' })
        .andWhere(`room.id NOT IN (${occupiedRoomsSubQuery.getQuery()})`)
        .setParameters(occupiedRoomsSubQuery.getParameters())
        .getOne();

      const assignedRoomId = availableRoom ? availableRoom.id : null;

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
