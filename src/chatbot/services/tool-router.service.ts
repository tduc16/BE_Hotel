import { Injectable, Logger } from '@nestjs/common';
import { ChatSessionContext, AvailableRoomCacheItem } from '../interfaces/chat-session-context.interface';
import { ChatIntent } from './intent.service';
import { AvailabilityService } from './availability.service';
import { RecommendationService } from './recommendation.service';
import { RoomTools } from '../tools/room.tools';
import { ServiceTools } from '../tools/service.tools';
import { BookingsService } from '../../bookings/bookings.service';
import { BookingStatus } from '../../bookings/entities/booking.entity';
import { DateParserService } from './date-parser.service';
import { ResponseFormatterService } from './response-formatter.service';

import { PublicRoomsService } from '../../rooms/public/public-rooms.service';
import { ServicesService } from '../../services/services.service';

export interface ToolResult {
  /** Dữ liệu thực từ DB để inject vào Gemini */
  data: string;
  /** Hint cho Gemini biết cần làm gì */
  hint?: string;
  /** Cache phòng trống để lưu vào context */
  roomsCache?: AvailableRoomCacheItem[];
  bookingResult?: any;
  services?: any[];
}

/**
 * ToolRouterService — Router trung tâm: chuyển intent → fetch data thực từ DB.
 *
 * Loại bỏ hoàn toàn "string magic" như 'SERVICE_REQUEST: ...' cũ.
 * Mỗi intent gọi đúng service tương ứng.
 */
@Injectable()
export class ToolRouterService {
  private readonly logger = new Logger(ToolRouterService.name);

  constructor(
    private readonly availabilityService: AvailabilityService,
    private readonly recommendationService: RecommendationService,
    private readonly roomTools: RoomTools,
    private readonly serviceTools: ServiceTools,
    private readonly bookingsService: BookingsService,
    private readonly dateParser: DateParserService,
    private readonly responseFormatter: ResponseFormatterService,
    private readonly publicRoomsService: PublicRoomsService,
    private readonly servicesService: ServicesService,
  ) { }

  /**
   * Route intent → fetch dữ liệu thực → trả về ToolResult
   */
  async route(intent: ChatIntent, context: ChatSessionContext): Promise<ToolResult> {
    this.logger.log(`[ToolRouter] intent=${intent} | checkIn=${context.checkInDate} | checkOut=${context.checkOutDate}`);

    switch (intent) {
      case 'CHECK_ROOM_AVAILABILITY':
      case 'BOOKING_CONSULTATION':
        return this.handleAvailability(context);

      case 'ROOM_PRICE':
        return this.handleRoomPrice();

      case 'ROOM_RECOMMENDATION':
        return this.handleRecommendation(context);

      case 'BOOKING_LOOKUP':
        return this.handleBookingLookup(context);

      case 'SERVICE_RECOMMENDATION':
        return this.handleServiceRecommendation();

      case 'HOTEL_INFORMATION':
        return this.handleHotelInfo();

      case 'CONTACT_SUPPORT':
        return this.handleContactInfo();

      default:
        return { data: '', hint: '' };
    }
  }

  // ─── Handlers ─────────────────────────────────────────────────────────────────

  private async handleAvailability(context: ChatSessionContext): Promise<ToolResult> {
    if (!context.checkInDate || !context.checkOutDate) {
      return {
        data: '',
        hint: 'Chưa có ngày check-in và check-out. Hãy hỏi khách muốn nhận phòng ngày nào và trả phòng ngày nào.',
      };
    }

    try {
      const checkIn = new Date(context.checkInDate);
      const checkOut = new Date(context.checkOutDate);
      const guestCount = context.guestCount || 2;
      const result = await this.availabilityService.checkAvailableRooms(checkIn, checkOut, guestCount);

      const checkInVN = this.dateParser.formatDateVN(checkIn);
      const checkOutVN = this.dateParser.formatDateVN(checkOut);

      if (!result.hasAvailability) {
        return {
          data: this.responseFormatter.formatAvailableRooms([], checkInVN, checkOutVN, result.nights),
          hint: 'Thông báo lịch sự không còn phòng và gợi ý chọn ngày khác hoặc liên hệ lễ tân.',
        };
      }
      const sortedRooms = [...result.rooms].sort((a, b) => {
        const aFit = a.capacity >= guestCount ? 1 : 0;
        const bFit = b.capacity >= guestCount ? 1 : 0;
        if (aFit !== bFit) {
          return bFit - aFit;
        }
        const aDiff = a.capacity - guestCount;
        const bDiff = b.capacity - guestCount;
        if (aDiff !== bDiff) {
          return aDiff - bDiff;
        }
        if (a.pricePerNight !== b.pricePerNight) {
          return a.pricePerNight - b.pricePerNight;
        }
        const getRating = (name: string) => {
          const n = name.toLowerCase();
          if (n.includes('vip')) return 4.9;
          if (n.includes('executive')) return 4.8;
          if (n.includes('deluxe')) return 4.7;
          if (n.includes('family')) return 4.6;
          if (n.includes('standard') || n.includes('standrad')) return 4.5;
          return 4.4;
        };
        return getRating(b.roomType) - getRating(a.roomType);
      });

      const formattedRoomsText = this.responseFormatter.formatAvailableRooms(
        sortedRooms,
        checkInVN,
        checkOutVN,
        result.nights,
        guestCount,
      );

      return {
        data: formattedRoomsText,
        hint: `Trình bày danh sách phòng trống từ ${checkInVN} đến ${checkOutVN} (${result.nights} đêm). Hỏi khách muốn chọn loại nào. Đây là dữ liệu thực, không được bịa thêm.`,
        roomsCache: sortedRooms.map((r) => ({
          categoryId: r.categoryId,
          roomType: r.roomType,
          available: r.available,
          capacity: r.capacity,
          pricePerNight: r.pricePerNight,
          totalPrice: r.totalPrice,
          nights: r.nights,
        })),
      };
    } catch (err) {
      this.logger.error('[ToolRouter.handleAvailability]', err);
      return { data: '', hint: 'Lỗi truy vấn phòng. Xin lỗi khách và đề nghị liên hệ lễ tân.' };
    }
  }

  private async handleRoomPrice(): Promise<ToolResult> {
    try {
      const data = await this.roomTools.getAllRoomCategories();
      const res = await this.publicRoomsService.getCategories();
      const roomsCache: AvailableRoomCacheItem[] = (res.data ? res.data.filter((c: any) => c.is_available) : []).map((c: any) => ({
        roomType: c.name,
        categoryId: c.id,
        available: c.available_rooms !== undefined ? c.available_rooms : 1,
        capacity: c.capacity,
        pricePerNight: Number(c.base_price) || 0,
        totalPrice: Number(c.base_price) || 0,
        nights: 1,
      }));
      return {
        data,
        roomsCache,
        hint: 'Trình bày bảng giá phòng rõ ràng. Đây là dữ liệu thực từ database, không được thêm giá tự bịa.',
      };
    } catch (err) {
      this.logger.error('[ToolRouter.handleRoomPrice]', err);
      return { data: '', hint: 'Không lấy được bảng giá. Đề nghị liên hệ lễ tân.' };
    }
  }

  private async handleRecommendation(context: ChatSessionContext): Promise<ToolResult> {
    try {
      const guests = context.guestCount || 2;
      const recommendations = await this.recommendationService.recommendRooms({
        guestCount: guests,
        checkIn: context.checkInDate,
        checkOut: context.checkOutDate,
      });

      if (recommendations.length === 0) {
        return {
          data: 'Dạ, rất tiếc hiện tại em chưa tìm thấy gợi ý phòng nào phù hợp với số lượng khách yêu cầu.',
          hint: 'Hỏi thêm nhu cầu của khách hoặc gợi ý xem tất cả phòng.',
        };
      }

      const list = recommendations
        .map(
          (r, i) => {
            const badge = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : '▪️';
            return `${badge} **${r.roomType}** (Đánh giá: ⭐ ${r.rating}/5)\n• Sức chứa: Tối đa ${r.capacity} khách\n• Giá phòng: ${r.pricePerNight.toLocaleString('vi-VN')} VND/đêm`;
          }
        )
        .join('\n\n');

      const nights = context.checkInDate && context.checkOutDate
        ? Math.round((new Date(context.checkOutDate).getTime() - new Date(context.checkInDate).getTime()) / (1000 * 60 * 60 * 24))
        : 1;

      const roomsCache: AvailableRoomCacheItem[] = recommendations.map((r) => ({
        roomType: r.roomType,
        categoryId: r.categoryId,
        available: 1,
        capacity: r.capacity,
        pricePerNight: r.pricePerNight,
        totalPrice: r.pricePerNight * nights,
        nights,
      }));

      return {
        data: `Dạ, dựa trên thông tin đoàn ${guests} khách, em xin gợi ý một số hạng phòng phù hợp nhất:\n\n${list}\n\nAnh/Chị muốn chọn đặt phòng nào không ạ?`,
        roomsCache,
        hint: 'Trình bày gợi ý phòng đẹp. Hỏi khách muốn đặt phòng nào.',
      };
    } catch (err) {
      this.logger.error('[ToolRouter.handleRecommendation]', err);
      return { data: '', hint: 'Không lấy được gợi ý phòng. Đề nghị liên hệ lễ tân.' };
    }
  }

  private async handleBookingLookup(context: ChatSessionContext): Promise<ToolResult> {
    if (!context.bookingCode) {
      return {
        data: '',
        hint: 'Hỏi mã đặt phòng của khách (dạng BKYYYYxxxx, ví dụ: BK20260010).',
      };
    }

    try {
      const booking = await this.bookingsService.getBookingByCode(context.bookingCode);

      const checkIn = new Date(booking.check_in_date).toLocaleDateString('vi-VN');
      const checkOut = new Date(booking.check_out_date).toLocaleDateString('vi-VN');
      const total = Number(booking.total_amount).toLocaleString('vi-VN');

      const statusMap: Record<string, string> = {
        PENDING: 'Chờ xác nhận',
        CONFIRMED: 'Đã xác nhận',
        CHECKED_IN: 'Đang lưu trú',
        CHECKED_OUT: 'Đã trả phòng',
        CANCELLED: 'Đã hủy',
        EXPIRED: 'Hết hạn',
      };

      const data = `KẾT QUẢ TRA CỨU BOOKING ${context.bookingCode}:
• Mã: ${booking.booking_code}
• Khách: ${booking.customer_name}
• Loại phòng: ${booking.roomCategory?.name || 'Không rõ'}
• Check-in: ${checkIn}
• Check-out: ${checkOut}
• Số khách: ${booking.guest_count} người (${booking.night_count} đêm)
• Tổng tiền: ${total} VND
• Trạng thái: ${statusMap[booking.booking_status] || booking.booking_status}
• Thanh toán: ${booking.payment_status}`;

      return {
        data,
        bookingResult: booking,
        hint: 'Trình bày thông tin booking một cách thân thiện.',
      };
    } catch (err) {
      return {
        data: `KHÔNG TÌM THẤY booking với mã "${context.bookingCode}".`,
        bookingResult: null,
        hint: 'Thông báo lịch sự không tìm thấy và đề nghị kiểm tra lại mã booking.',
      };
    }
  }

  private async handleServiceRecommendation(): Promise<ToolResult> {
    try {
      const data = await this.serviceTools.getAllServices();
      const services = await this.servicesService.findAllPublic();
      return {
        data,
        services,
        hint: 'Giới thiệu dịch vụ khách sạn một cách thú vị. Upsell dịch vụ phù hợp.',
      };
    } catch (err) {
      this.logger.error('[ToolRouter.handleServiceRecommendation]', err);
      return { data: '', hint: 'Không lấy được dịch vụ. Đề nghị liên hệ lễ tân.' };
    }
  }

  private handleHotelInfo(): ToolResult {
    return {
      data: `THÔNG TIN KHÁCH SẠN HOÀNG MINH:
• Check-in: 14:00 | Check-out: 12:00
• Tiện ích: Hồ bơi, Spa, Nhà hàng, Gym, WiFi miễn phí
• Đưa đón sân bay: Có (đặt trước 24 giờ)
• Chính sách hủy: Miễn phí trước 24h, tính phí nếu sau 24h`,
      hint: 'Trình bày thông tin khách sạn thân thiện, ngắn gọn.',
    };
  }

  private handleContactInfo(): ToolResult {
    return {
      data: `THÔNG TIN LIÊN HỆ:
• Lễ tân: Hoạt động 24/7, liên hệ qua form trên website
• Hỗ trợ trực tuyến: Qua chatbot này
• Kênh liên hệ: Trang "Liên hệ" trên website khách sạn`,
      hint: 'Hướng dẫn khách liên hệ một cách thân thiện. Nhắc có thể đặt phòng online ngay.',
    };
  }
}
