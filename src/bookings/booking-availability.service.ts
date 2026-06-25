import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, EntityManager } from 'typeorm';
import { RoomCategory } from '../rooms/entities/room-category.entity';
import { Room } from '../rooms/entities/room.entity';
import { Booking, BookingStatus } from './entities/booking.entity';

export interface AvailableRoomInfo {
  id: string;
  room_number: string;
}

export interface AvailableRoomCategoryResult {
  categoryId: string;
  categoryName: string;
  capacity: number;
  pricePerNight: number;
  availableRoomCount: number;
  availableRooms: AvailableRoomInfo[];
  totalAmount: number;
}

@Injectable()
export class BookingAvailabilityService {
  private readonly logger = new Logger(BookingAvailabilityService.name);

  constructor(
    @InjectRepository(RoomCategory)
    private readonly categoryRepo: Repository<RoomCategory>,
    @InjectRepository(Room)
    private readonly roomRepo: Repository<Room>,
    @InjectRepository(Booking)
    private readonly bookingRepo: Repository<Booking>,
  ) {}

  private normalizeDateString(date: string | Date): string {
    if (date instanceof Date) {
      return date.toISOString().substring(0, 10);
    }
    return String(date).substring(0, 10);
  }

  /**
   * Tính toán danh sách hạng phòng còn trống thực tế dựa trên ngày nhận, trả phòng và sức chứa.
   * Chấp nhận EntityManager tùy chọn để chạy an toàn trong transaction.
   *
   * Điều kiện phòng được tính là "trống":
   * 1. Thuộc category đang is_active = true
   * 2. Phòng có status = 'AVAILABLE' (loại bỏ MAINTENANCE và OCCUPIED)
   * 3. Không có booking nào (PENDING/CONFIRMED/CHECKED_IN) trùng khoảng thời gian
   *    Điều kiện trùng: checkIn < booking.checkOut AND checkOut > booking.checkIn
   */
  async findAvailableRoomCategories(
    params: {
      checkInDate: string | Date;
      checkOutDate: string | Date;
      guestCount?: number;
    },
    manager?: EntityManager,
  ): Promise<AvailableRoomCategoryResult[]> {
    const checkInStr = this.normalizeDateString(params.checkInDate);
    const checkOutStr = this.normalizeDateString(params.checkOutDate);
    const guestCount = params.guestCount;

    const checkIn = new Date(checkInStr);
    const checkOut = new Date(checkOutStr);

    const nights = Math.round(
      (checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24),
    );
    const actualNights = nights > 0 ? nights : 1;

    const currentManager = manager || this.bookingRepo.manager;

    // 1. Lấy tất cả loại phòng đang hoạt động
    const categories = await currentManager.find(RoomCategory, {
      where: { is_active: true },
    });

    // 2. Lấy tất cả phòng có status AVAILABLE hoặc OCCUPIED (loại bỏ phòng MAINTENANCE)
    const rooms = await currentManager.find(Room, {
      where: [
        { status: 'AVAILABLE' },
        { status: 'OCCUPIED' },
      ],
      relations: ['category'],
    });

    // 3. Lấy tất cả booking đang hoạt động trùng lịch trong khoảng thời gian này
    const overlappingBookings = await currentManager
      .createQueryBuilder(Booking, 'booking')
      .select(['booking.id', 'booking.room_category_id', 'booking.room_id', 'booking.booking_code'])
      .where('booking.booking_status IN (:...statuses)', {
        statuses: [
          BookingStatus.PENDING,
          BookingStatus.CONFIRMED,
          BookingStatus.CHECKED_IN,
        ],
      })
      .andWhere('booking.check_in_date < :checkOut', { checkOut: checkOutStr })
      .andWhere('booking.check_out_date > :checkIn', { checkIn: checkInStr })
      .getMany();

    // Tập hợp room_id đã bị chiếm dụng
    const occupiedRoomIds = new Set<string>();
    for (const b of overlappingBookings) {
      if (b.room_id) {
        occupiedRoomIds.add(b.room_id);
      }
    }

    const availableCategories: AvailableRoomCategoryResult[] = [];

    for (const cat of categories) {
      // Filter theo capacity
      if (guestCount !== undefined && guestCount !== null) {
        if (cat.capacity < guestCount) {
          continue;
        }
      }

      // Lọc các phòng vật lý thuộc category này và không bị chiếm dụng
      const roomsOfCategory = rooms.filter((r) => r.category && r.category.id === cat.id);
      const freeRooms = roomsOfCategory.filter((r) => !occupiedRoomIds.has(r.id));

      // Chỉ trả về category nếu có ít nhất 1 phòng trống
      if (freeRooms.length === 0) {
        continue;
      }

      const availableRooms: AvailableRoomInfo[] = freeRooms.map((r) => ({
        id: r.id,
        room_number: r.room_number,
      }));

      const pricePerNight = Number(cat.base_price) || 0;
      const totalAmount = pricePerNight * actualNights;

      availableCategories.push({
        categoryId: cat.id,
        categoryName: cat.name,
        capacity: cat.capacity,
        pricePerNight,
        availableRoomCount: availableRooms.length,
        availableRooms,
        totalAmount,
      });
    }

    this.logger.log(
      `[BookingAvailabilityService] checkIn=${checkInStr} | checkOut=${checkOutStr} | guestCount=${guestCount || 'N/A'} -> Found ${availableCategories.length} categories`,
    );

    return availableCategories;
  }

  /**
   * Kiểm tra xem một phòng vật lý cụ thể (room_id) có còn trống trong khoảng thời gian không.
   */
  async isRoomPhysicalAvailable(
    roomId: string,
    checkInDate: string | Date,
    checkOutDate: string | Date,
    manager?: EntityManager,
  ): Promise<boolean> {
    const checkInStr = this.normalizeDateString(checkInDate);
    const checkOutStr = this.normalizeDateString(checkOutDate);
    const currentManager = manager || this.bookingRepo.manager;

    // Phòng phải ở trạng thái AVAILABLE hoặc OCCUPIED (không bảo trì)
    const room = await currentManager.findOne(Room, { where: { id: roomId } });
    if (!room || (room.status !== 'AVAILABLE' && room.status !== 'OCCUPIED')) {
      return false;
    }

    // Kiểm tra booking trùng lịch chiếm phòng vật lý này
    const count = await currentManager
      .createQueryBuilder(Booking, 'booking')
      .where('booking.room_id = :roomId', { roomId })
      .andWhere('booking.booking_status IN (:...statuses)', {
        statuses: [
          BookingStatus.PENDING,
          BookingStatus.CONFIRMED,
          BookingStatus.CHECKED_IN,
        ],
      })
      .andWhere('booking.check_in_date < :checkOut', { checkOut: checkOutStr })
      .andWhere('booking.check_out_date > :checkIn', { checkIn: checkInStr })
      .getCount();

    return count === 0;
  }

  /**
   * Kiểm tra một hạng phòng cụ thể có còn phòng trống không.
   * Dùng cho public API: GET /public/bookings/availability
   *
   * Trả về: available, availableRoomCount, pricePerNight, subtotal, nightCount, capacity, categoryName
   */
  async checkCategoryAvailability(
    categoryId: string,
    checkInDate: string | Date,
    checkOutDate: string | Date,
    guestCount?: number,
    manager?: EntityManager,
  ): Promise<{
    available: boolean;
    availableRoomCount: number;
    categoryName: string;
    pricePerNight: number;
    capacity: number;
    nightCount: number;
    subtotal: number;
  }> {
    const checkInStr = this.normalizeDateString(checkInDate);
    const checkOutStr = this.normalizeDateString(checkOutDate);
    const currentManager = manager || this.bookingRepo.manager;

    const checkIn = new Date(checkInStr);
    const checkOut = new Date(checkOutStr);
    const nights = Math.max(
      1,
      Math.round((checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24)),
    );

    const category = await currentManager.findOne(RoomCategory, {
      where: { id: categoryId },
    });

    if (!category || !category.is_active) {
      return {
        available: false,
        availableRoomCount: 0,
        categoryName: category?.name || '',
        pricePerNight: 0,
        capacity: 0,
        nightCount: nights,
        subtotal: 0,
      };
    }

    if (guestCount !== undefined && guestCount > category.capacity) {
      return {
        available: false,
        availableRoomCount: 0,
        categoryName: category.name,
        pricePerNight: Number(category.base_price),
        capacity: category.capacity,
        nightCount: nights,
        subtotal: 0,
      };
    }

    // Lấy phòng AVAILABLE hoặc OCCUPIED thuộc category này
    const allRooms = await currentManager.find(Room, {
      where: [
        { status: 'AVAILABLE' },
        { status: 'OCCUPIED' },
      ],
      relations: ['category'],
    });
    const rooms = allRooms.filter((r) => r.category && r.category.id === categoryId);

    // Lấy booking trùng lịch cho category này
    const overlappingBookings = await currentManager
      .createQueryBuilder(Booking, 'booking')
      .select(['booking.room_id'])
      .where('booking.room_category_id = :categoryId', { categoryId })
      .andWhere('booking.booking_status IN (:...statuses)', {
        statuses: [BookingStatus.PENDING, BookingStatus.CONFIRMED, BookingStatus.CHECKED_IN],
      })
      .andWhere('booking.check_in_date < :checkOut', { checkOut: checkOutStr })
      .andWhere('booking.check_out_date > :checkIn', { checkIn: checkInStr })
      .getMany();

    const occupiedRoomIds = new Set(
      overlappingBookings.filter((b) => b.room_id).map((b) => b.room_id),
    );

    const freeRooms = rooms.filter((r) => !occupiedRoomIds.has(r.id));
    const pricePerNight = Number(category.base_price);

    return {
      available: freeRooms.length > 0,
      availableRoomCount: freeRooms.length,
      categoryName: category.name,
      pricePerNight,
      capacity: category.capacity,
      nightCount: nights,
      subtotal: pricePerNight * nights,
    };
  }
}
