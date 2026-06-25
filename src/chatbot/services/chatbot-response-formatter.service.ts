import { Injectable } from '@nestjs/common';

export interface StructuredToolResult {
  intent: string;
  state: string;
  checkInDate?: string;
  checkOutDate?: string;
  guestCount?: number;
  availableRooms?: any[];
  selectedRoom?: any;
  bookingDraft?: any;
  bookingResult?: any;
  services?: any[];
  errorCode?: string;
}

@Injectable()
export class ChatbotResponseFormatter {
  /**
   * Phương thức chính định dạng kết quả từ nghiệp vụ thành câu trả lời tiếng Việt tự nhiên hướng khách hàng.
   */
  format(result: StructuredToolResult, customerName?: string | null): string {
    const intent = result.intent;
    const state = result.state || 'IDLE';

    switch (intent) {
      case 'CHECK_ROOM_AVAILABILITY':
        return this.formatAvailabilityFlow(result);

      case 'BOOKING_CONSULTATION':
        return this.formatBookingConsultationFlow(result);

      case 'BOOKING_LOOKUP':
        return this.formatBookingLookup(result);

      case 'BOOKING_GUIDANCE':
        return this.formatBookingGuidance(result);

      case 'ROOM_PRICE':
        return this.formatRoomPrices(result);

      case 'SERVICE_RECOMMENDATION':
        return this.formatServices(result);

      case 'ROOM_RECOMMENDATION':
        return this.formatRoomRecommendations(result);

      case 'HOTEL_INFORMATION':
        return this.formatHotelInfo();

      case 'CONTACT_SUPPORT':
        return this.formatContactSupport();

      default:
        return this.formatGeneralChat(customerName);
    }
  }

  // ─── Flow Handlers ────────────────────────────────────────────────────────────

  private formatAvailabilityFlow(result: StructuredToolResult): string {
    const state = result.state;

    if (state === 'WAITING_DATES') {
      return 'Dạ, em có thể tư vấn hạng phòng phù hợp cho anh/chị. Anh/chị dự định đi mấy người và lưu trú ngày nào ạ?';
    }
    if (state === 'WAITING_GUEST_COUNT') {
      return 'Dạ, Anh/Chị dự định đi bao nhiêu khách để em chọn hạng phòng phù hợp nhất ạ?';
    }

    // SHOWING_RECOMMENDATIONS hoặc các trạng thái khác có danh sách phòng
    const checkIn = this.formatDateVN(result.checkInDate);
    const checkOut = this.formatDateVN(result.checkOutDate);
    const nights = this.calcNights(result.checkInDate, result.checkOutDate);
    const guestCount = result.guestCount;

    if (result.errorCode === 'ROOM_UNAVAILABLE' || !result.availableRooms || result.availableRooms.length === 0) {
      return `Dạ, rất tiếc hiện tại khách sạn không còn phòng trống phù hợp từ ngày ${checkIn} đến ngày ${checkOut} (${nights} đêm). Quý khách vui lòng chọn ngày khác hoặc liên hệ bộ phận lễ tân để được hỗ trợ thêm ạ.`;
    }

    return this.formatAvailableRooms(result.availableRooms, checkIn, checkOut, nights, guestCount);
  }

  private formatBookingConsultationFlow(result: StructuredToolResult): string {
    const state = result.state;

    if (state === 'WAITING_DATES') {
      return 'Dạ, em có thể tư vấn hạng phòng phù hợp cho anh/chị. Anh/chị dự định đi mấy người và lưu trú ngày nào ạ?';
    }
    if (state === 'WAITING_GUEST_COUNT') {
      return 'Dạ, Anh/Chị dự định đi bao nhiêu khách để em chọn hạng phòng phù hợp nhất ạ?';
    }

    if (state === 'SHOWING_RECOMMENDATIONS' || state === 'GUIDE_TO_BOOKING_PAGE') {
      const rooms = result.availableRooms || [];
      if (rooms.length === 0) {
        const checkIn = this.formatDateVN(result.checkInDate);
        const checkOut = this.formatDateVN(result.checkOutDate);
        return `Dạ, rất tiếc hiện tại khách sạn không còn phòng trống phù hợp từ ngày ${checkIn} đến ngày ${checkOut}. Quý khách vui lòng chọn ngày khác hoặc liên hệ bộ phận lễ tân để được hỗ trợ thêm ạ.`;
      }
      
      const checkIn = this.formatDateVN(result.checkInDate);
      const checkOut = this.formatDateVN(result.checkOutDate);
      const nights = this.calcNights(result.checkInDate, result.checkOutDate);
      
      const roomName = result.selectedRoom?.name || rooms[0]?.categoryName || rooms[0]?.roomType || 'Hạng phòng đề xuất';
      const price = result.selectedRoom?.pricePerNight || rooms[0]?.pricePerNight || 2500000;

      return `Dạ, với ${result.guestCount || 2} khách lưu trú từ ${checkIn} đến ${checkOut} (${nights} đêm), em đề xuất hạng phòng **${roomName}** vì sức chứa phù hợp và có không gian rộng rãi.\n\n` +
        `Giá tham khảo: ${Number(price).toLocaleString('vi-VN')}đ/đêm.\n` +
        `Anh/chị có thể bấm nút bên dưới để sang trang đặt phòng.`;
    }

    return 'Dạ, em có thể tư vấn hạng phòng phù hợp cho anh/chị. Anh/chị dự định đi mấy người và lưu trú ngày nào ạ?';
  }

  private formatBookingLookup(result: StructuredToolResult): string {
    if (result.errorCode === 'BOOKING_NOT_FOUND' || !result.bookingResult) {
      const code = result.bookingDraft?.bookingCode || 'của Quý khách';
      return `Dạ, rất tiếc em không tìm thấy đơn đặt phòng nào với mã **${code}**. Quý khách vui lòng kiểm tra lại mã đặt phòng nhé.`;
    }

    const booking = result.bookingResult;
    const checkIn = this.formatDateVN(booking.check_in_date);
    const checkOut = this.formatDateVN(booking.check_out_date);
    const total = Number(booking.total_amount).toLocaleString('vi-VN');

    const statusMap: Record<string, string> = {
      PENDING: 'Chờ xác nhận',
      CONFIRMED: 'Đã xác nhận',
      CHECKED_IN: 'Đang lưu trú',
      CHECKED_OUT: 'Đã trả phòng',
      CANCELLED: 'Đã hủy',
      EXPIRED: 'Hết hạn',
    };

    return `Dạ, em xin gửi thông tin đơn đặt phòng tra cứu được trên hệ thống:\n\n` +
      `• Mã đặt phòng: **${booking.booking_code}**\n` +
      `• Tên khách hàng: ${booking.customer_name}\n` +
      `• Hạng phòng: **${booking.roomCategory?.name || 'Không rõ'}**\n` +
      `• Thời gian lưu trú: Từ **${checkIn}** đến **${checkOut}** (${booking.night_count} đêm)\n` +
      `• Số lượng khách: ${booking.guest_count} người\n` +
      `• Tổng chi phí: **${total} VND**\n` +
      `• Trạng thái đơn phòng: ${statusMap[booking.booking_status] || booking.booking_status}\n` +
      `• Thanh toán: ${booking.payment_status}`;
  }

  private formatBookingGuidance(result: StructuredToolResult): string {
    return 'Dạ, để hủy đặt phòng, anh/chị vui lòng truy cập trang quản lý đặt phòng trên website để thực hiện nhé. Vì lý do bảo mật và đảm bảo quyền lợi, hệ thống AI chatbot không thể thực hiện thao tác hủy phòng trực tiếp.';
  }





  private formatRoomPrices(result: StructuredToolResult): string {
    const rooms = result.availableRooms || [];
    if (rooms.length === 0) {
      return 'Dạ, Khách sạn Hoàng Minh cung cấp nhiều hạng phòng đẳng cấp như Deluxe Room, Family Room, Executive Suite và Vip. Để biết bảng giá cụ thể theo ngày, Anh/Chị vui lòng cung cấp ngày nhận và trả phòng nhé.';
    }

    const list = rooms
      .map((c) => {
        const price = c.base_price || c.pricePerNight || 0;
        return `• **${c.name || c.roomType}**\n` +
          `  - Sức chứa: Tối đa ${c.capacity} khách\n` +
          `  - Giá phòng: **${Number(price).toLocaleString('vi-VN')} VND/đêm**\n` +
          `  - Tiện nghi: ${c.amenities ? c.amenities.slice(0, 3).join(', ') : 'Điều hòa, Tivi, Wifi, Mini Bar'}`;
      })
      .join('\n\n');

    return `Dạ, em xin gửi Anh/Chị bảng giá phòng tham khảo tại Khách sạn Hoàng Minh:\n\n${list}\n\nAnh/Chị có nhu cầu đặt phòng nào không ạ?`;
  }

  private formatServices(result: StructuredToolResult): string {
    const services = result.services || [];
    if (services.length === 0) {
      return 'Dạ, Khách sạn Hoàng Minh cung cấp đầy đủ dịch vụ cao cấp: Nhà hàng ẩm thực Á - Âu, Spa & Massage, phòng Gym, Hồ bơi vô cực ngoài trời và dịch vụ đưa đón sân bay. Anh/Chị cần em tư vấn thêm về dịch vụ nào ạ?';
    }

    const list = services
      .map((s) => {
        const hours = s.openTime && s.closeTime ? ` (${s.openTime} - ${s.closeTime})` : '';
        const location = s.location ? ` | Vị trí: ${s.location}` : '';
        return `• **${s.name}**${hours}${location}\n  ${s.shortDescription || 'Dịch vụ cao cấp chuẩn 5 sao'}`;
      })
      .join('\n\n');

    return `Dạ, Khách sạn Hoàng Minh rất hân hạnh mang tới Anh/Chị các dịch vụ tiện ích đẳng cấp:\n\n${list}\n\nAnh/Chị có nhu cầu sử dụng hoặc cần tư vấn thêm về dịch vụ nào không ạ?`;
  }

  private formatRoomRecommendations(result: StructuredToolResult): string {
    const rooms = result.availableRooms || [];
    if (rooms.length === 0) {
      return 'Dạ, để em gợi ý phòng phù hợp nhất, Anh/Chị vui lòng cho biết số lượng khách lưu trú và ngày check-in/out mong muốn nhé.';
    }

    const list = rooms
      .map((r, i) => {
        const badge = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : '▪️';
        const rating = this.getMockRating(r.roomType || r.name);
        const price = r.pricePerNight || r.base_price || 0;
        return `${badge} **${r.roomType || r.name}** (Đánh giá: ⭐ ${rating}/5)\n` +
          `  • Sức chứa: Tối đa ${r.capacity} khách\n` +
          `  • Giá phòng: **${Number(price).toLocaleString('vi-VN')} VND/đêm**`;
      })
      .join('\n\n');

    return `Dạ, dựa trên số lượng đoàn khách của mình, em xin gợi ý các hạng phòng phù hợp nhất tại Khách sạn Hoàng Minh:\n\n${list}\n\nAnh/Chị muốn chọn đặt hạng phòng nào không ạ?`;
  }

  private formatHotelInfo(): string {
    return `Dạ, em xin gửi một số thông tin cơ bản về Khách sạn Hoàng Minh:\n\n` +
      `• Giờ nhận phòng (Check-in): sau **14:00**\n` +
      `• Giờ trả phòng (Check-out): trước **12:00**\n` +
      `• Tiện ích khách sạn: Nhà hàng ẩm thực Á-Âu, Spa & Massage, Hồ bơi vô cực ngoài trời, Phòng Gym hiện đại, WiFi tốc độ cao miễn phí\n` +
      `• Chính sách hủy phòng: Miễn phí hủy trước ngày check-in 24 giờ. Hủy trễ sẽ áp dụng phí theo chính sách khách sạn\n\n` +
      `Anh/Chị cần tìm hiểu thêm thông tin nào khác của khách sạn không ạ?`;
  }

  private formatContactSupport(): string {
    return `Dạ, để được hỗ trợ trực tiếp từ bộ phận chăm sóc khách hàng hoặc Lễ tân, Anh/Chị có thể:\n\n` +
      `• Gọi số Hotline lễ tân hoạt động 24/7 (hiển thị trên form liên hệ website)\n` +
      `• Gửi tin nhắn qua cổng hỗ trợ trực tuyến\n` +
      `• Đến trực tiếp quầy Lễ tân tại sảnh chính khách sạn\n\n` +
      `Chúng em luôn sẵn lòng hỗ trợ Anh/Chị bất kỳ lúc nào ạ!`;
  }

  private formatGeneralChat(customerName?: string | null): string {
    const greeting = customerName ? `Chào Anh/Chị ${customerName}!` : 'Xin kính chào Quý khách!';
    return `${greeting} Chào mừng Quý khách đến với Khách sạn Hoàng Minh. Em là trợ lý ảo AI Concierge.\n\n` +
      `Em có thể hỗ trợ Quý khách: kiểm tra phòng trống, đặt phòng nhanh, tra cứu booking hoặc tư vấn các dịch vụ tiện ích tại khách sạn. Hôm nay em có thể giúp gì cho Quý khách ạ?`;
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────────

  private calcNights(checkIn?: string, checkOut?: string): number {
    if (!checkIn || !checkOut) return 1;
    const nights = Math.round(
      (new Date(checkOut).getTime() - new Date(checkIn).getTime()) / (1000 * 60 * 60 * 24),
    );
    return nights > 0 ? nights : 1;
  }

  private formatDateVN(dateStr?: string): string {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return dateStr;
    return date.toLocaleDateString('vi-VN');
  }

  private getMockRating(name: string): number {
    const n = name.toLowerCase();
    if (n.includes('vip')) return 4.9;
    if (n.includes('executive')) return 4.8;
    if (n.includes('deluxe')) return 4.7;
    if (n.includes('family')) return 4.6;
    if (n.includes('standard') || n.includes('standrad')) return 4.5;
    return 4.4;
  }

  private formatAvailableRooms(
    rooms: any[],
    checkIn: string,
    checkOut: string,
    nights: number,
    guestCount?: number,
  ): string {
    if (rooms.length === 0) {
      return `Dạ, rất tiếc hiện tại khách sạn không còn phòng trống phù hợp từ ngày ${checkIn} đến ngày ${checkOut} (${nights} đêm).`;
    }

    const title = `Dạ, Khách sạn Hoàng Minh xin gửi đến Anh/Chị danh sách phòng trống từ ngày ${checkIn} đến ngày ${checkOut} (${nights} đêm)${guestCount ? ` phù hợp với đoàn ${guestCount} khách` : ''}:\n\n`;

    const list = rooms
      .map((r, i) => {
        const badge = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : '▪️';
        const rating = this.getMockRating(r.roomType || r.categoryName || r.name);
        const roomType = r.roomType || r.categoryName || r.name;
        const availableCount = r.available !== undefined ? r.available : (r.availableRoomCount !== undefined ? r.availableRoomCount : 1);
        const price = r.pricePerNight || r.base_price || 0;
        const total = r.totalPrice || r.totalAmount || (price * nights);

        return `${badge} **${roomType}** (Đánh giá: ⭐ ${rating}/5)\n` +
          `• Sức chứa: Tối đa ${r.capacity} khách\n` +
          `• Còn trống: ${availableCount} phòng\n` +
          `• Giá phòng: ${Number(price).toLocaleString('vi-VN')} VND/đêm\n` +
          `• Tổng chi phí (${nights} đêm): **${Number(total).toLocaleString('vi-VN')} VND**`;
      })
      .join('\n\n');

    return title + list + `\n\nAnh/Chị muốn đặt hạng phòng nào trong danh sách trên ạ?`;
  }
}
