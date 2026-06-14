import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PublicRoomsService } from '../../rooms/public/public-rooms.service';
import { BookingsService } from '../../bookings/bookings.service';
import { RoomCategory } from '../../rooms/entities/room-category.entity';
import { Booking } from '../../bookings/entities/booking.entity';

@Injectable()
export class RoomTools {
  private readonly logger = new Logger(RoomTools.name);

  constructor(
    private readonly publicRoomsService: PublicRoomsService,
    private readonly bookingsService: BookingsService,
    @InjectRepository(RoomCategory)
    private readonly categoryRepo: Repository<RoomCategory>,
    @InjectRepository(Booking)
    private readonly bookingRepo: Repository<Booking>,
  ) {}

  /**
   * TOOL 1: Lấy danh sách tất cả loại phòng với thông tin đầy đủ
   */
  async getAllRoomCategories(): Promise<string> {
    try {
      const result = await this.publicRoomsService.getCategories();
      const categories = result.data;

      if (!categories || categories.length === 0) {
        return 'Hiện tại khách sạn chưa có thông tin phòng. Vui lòng liên hệ lễ tân.';
      }

      const formatted = categories
        .filter((c: any) => c.is_available)
        .map((c: any) => {
          const price = Number(c.base_price).toLocaleString('vi-VN');
          return `• **${c.name}**
  - Sức chứa: ${c.capacity} khách
  - Giá: ${price} VND/đêm
  - Phòng còn trống: ${c.available_rooms}/${c.total_rooms}
  ${c.description ? `- Mô tả: ${c.description.substring(0, 100)}` : ''}`;
        })
        .join('\n\n');

      return `Các loại phòng hiện có tại Khách sạn Hoàng Minh:\n\n${formatted}`;
    } catch (error) {
      this.logger.error('[RoomTools.getAllRoomCategories]', error);
      return 'Không thể lấy thông tin phòng lúc này. Vui lòng thử lại sau.';
    }
  }

  /**
   * TOOL 2: Kiểm tra phòng trống theo khoảng thời gian
   */
  async checkAvailability(checkIn: string, checkOut: string): Promise<string> {
    try {
      const checkInDate = new Date(checkIn);
      const checkOutDate = new Date(checkOut);

      if (isNaN(checkInDate.getTime()) || isNaN(checkOutDate.getTime())) {
        return 'Ngày không hợp lệ. Vui lòng cung cấp ngày theo định dạng YYYY-MM-DD.';
      }

      if (checkOutDate <= checkInDate) {
        return 'Ngày check-out phải sau ngày check-in.';
      }

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (checkInDate < today) {
        return 'Ngày check-in không thể là ngày trong quá khứ.';
      }

      // Lấy tất cả loại phòng đang hoạt động
      const categories = await this.categoryRepo
        .createQueryBuilder('category')
        .leftJoinAndSelect('category.rooms', 'rooms')
        .where('category.is_active = :isActive', { isActive: true })
        .getMany();

      const nights = Math.round(
        (checkOutDate.getTime() - checkInDate.getTime()) / (1000 * 60 * 60 * 24),
      );

      const checkInStr = checkIn.substring(0, 10);
      const checkOutStr = checkOut.substring(0, 10);

      // Đếm số booking đang chiếm phòng trong khoảng thời gian này
      const overlappingBookings = await this.bookingRepo
        .createQueryBuilder('booking')
        .select(['booking.room_category_id', 'booking.room_id'])
        .where('booking.booking_status IN (:...statuses)', {
          statuses: ['PENDING', 'CONFIRMED', 'CHECKED_IN'],
        })
        .andWhere('booking.check_in_date < :checkOut', { checkOut: checkOutStr })
        .andWhere('booking.check_out_date > :checkIn', { checkIn: checkInStr })
        .getMany();

      const bookedCountByCategory: Record<string, number> = {};
      for (const b of overlappingBookings) {
        bookedCountByCategory[b.room_category_id] =
          (bookedCountByCategory[b.room_category_id] || 0) + 1;
      }

      const availableCategories = categories
        .map((cat) => {
          const totalActive = cat.rooms?.filter(
            (r) => r.status !== 'MAINTENANCE',
          ).length || 0;
          const booked = bookedCountByCategory[cat.id] || 0;
          const available = totalActive - booked;
          const price = Number(cat.base_price).toLocaleString('vi-VN');
          const totalCost = (Number(cat.base_price) * nights).toLocaleString('vi-VN');
          return { ...cat, available, price, totalCost, nights };
        })
        .filter((cat) => cat.available > 0);

      if (availableCategories.length === 0) {
        return `Rất tiếc, không còn phòng trống trong khoảng thời gian từ ${checkInStr} đến ${checkOutStr}. Vui lòng chọn ngày khác hoặc liên hệ lễ tân.`;
      }

      const checkInDisplay = new Date(checkIn).toLocaleDateString('vi-VN');
      const checkOutDisplay = new Date(checkOut).toLocaleDateString('vi-VN');

      const list = availableCategories
        .map(
          (c) =>
            `• **${c.name}** (còn ${c.available} phòng)
  - Sức chứa: ${c.capacity} khách/phòng
  - Giá: ${c.price} VND/đêm
  - Tổng ${c.nights} đêm: **${c.totalCost} VND**
  ${c.amenities?.length > 0 ? `- Tiện nghi: ${c.amenities.slice(0, 3).join(', ')}` : ''}`,
        )
        .join('\n\n');

      return `Phòng còn trống từ **${checkInDisplay}** đến **${checkOutDisplay}** (${nights} đêm):\n\n${list}\n\nQuý khách muốn đặt loại phòng nào?`;
    } catch (error) {
      this.logger.error('[RoomTools.checkAvailability]', error);
      return 'Không thể kiểm tra tình trạng phòng lúc này. Vui lòng thử lại sau.';
    }
  }

  /**
   * TOOL 3: Lấy chi tiết một loại phòng
   */
  async getRoomDetail(categoryId: string): Promise<string> {
    try {
      const result = await this.publicRoomsService.getCategoryById(categoryId);
      const room = result.data;

      const price = Number(room.base_price).toLocaleString('vi-VN');
      const services =
        room.services?.length > 0
          ? room.services.map((s: any) => s.name).join(', ')
          : 'Không có';
      const amenities =
        room.amenities?.length > 0 ? room.amenities.join(', ') : 'Không có';

      return `**${room.name}**\n- Sức chứa: ${room.capacity} khách\n- Giá: ${price} VND/đêm\n- Tiện nghi: ${amenities}\n- Dịch vụ đi kèm: ${services}\n- Còn trống: ${room.available_rooms} phòng\n${room.description ? `- Mô tả: ${room.description}` : ''}`;
    } catch (error) {
      this.logger.error('[RoomTools.getRoomDetail]', error);
      return 'Không tìm thấy thông tin phòng.';
    }
  }

  /**
   * TOOL 4: Gợi ý phòng phù hợp theo nhu cầu
   */
  async recommendRoom(
    guests: number,
    budget: number | null,
    purpose: string,
  ): Promise<string> {
    try {
      const result = await this.publicRoomsService.getCategories();
      const categories = result.data.filter((c: any) => c.is_available);

      if (categories.length === 0) {
        return 'Hiện tại không có phòng trống. Vui lòng liên hệ lễ tân.';
      }

      // Lọc theo sức chứa
      let filtered = categories.filter((c: any) => c.capacity >= guests);

      if (filtered.length === 0) {
        filtered = categories;
      }

      // Lọc theo ngân sách nếu có
      if (budget && budget > 0) {
        const withinBudget = filtered.filter(
          (c: any) => Number(c.base_price) <= budget,
        );
        if (withinBudget.length > 0) {
          filtered = withinBudget;
        }
      }

      // Sắp xếp theo phù hợp với mục đích
      const purposeLower = purpose.toLowerCase();
      if (
        purposeLower.includes('gia đình') ||
        purposeLower.includes('family')
      ) {
        filtered.sort((a: any, b: any) => b.capacity - a.capacity);
      } else if (
        purposeLower.includes('đôi') ||
        purposeLower.includes('couple') ||
        purposeLower.includes('vợ chồng')
      ) {
        filtered.sort(
          (a: any, b: any) => Number(b.base_price) - Number(a.base_price),
        );
      } else if (
        purposeLower.includes('công tác') ||
        purposeLower.includes('business')
      ) {
        filtered.sort(
          (a: any, b: any) => Number(a.base_price) - Number(b.base_price),
        );
      }

      const top3 = filtered.slice(0, 3);
      const list = top3
        .map((c: any, i: number) => {
          const price = Number(c.base_price).toLocaleString('vi-VN');
          const badge = i === 0 ? '⭐ Gợi ý tốt nhất' : i === 1 ? '✨ Lựa chọn tốt' : '💡 Cũng phù hợp';
          return `${badge}\n• **${c.name}**\n  - Sức chứa: ${c.capacity} khách\n  - Giá: ${price} VND/đêm\n  - Còn trống: ${c.available_rooms} phòng`;
        })
        .join('\n\n');

      const budgetText =
        budget && budget > 0
          ? ` trong ngân sách ${budget.toLocaleString('vi-VN')} VND/đêm`
          : '';

      return `Dựa trên nhu cầu **${guests} khách**, mục đích **${purpose}**${budgetText}, tôi gợi ý:\n\n${list}\n\nQuý khách muốn biết thêm về loại phòng nào?`;
    } catch (error) {
      this.logger.error('[RoomTools.recommendRoom]', error);
      return 'Không thể tạo gợi ý phòng lúc này. Vui lòng thử lại.';
    }
  }
}
