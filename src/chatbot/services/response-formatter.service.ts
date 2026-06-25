import { Injectable } from '@nestjs/common';
import { AvailableRoomCacheItem } from '../interfaces/chat-session-context.interface';

@Injectable()
export class ResponseFormatterService {
  /**
   * Định dạng danh sách phòng trống
   */
  formatAvailableRooms(
    rooms: AvailableRoomCacheItem[],
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
        const rating = this.getMockRating(r.roomType);
        return `${badge} **${r.roomType}** (Đánh giá: ⭐ ${rating}/5)\n` +
          `• Còn trống: ${r.available} phòng\n` +
          `• Giá phòng: ${r.pricePerNight.toLocaleString('vi-VN')} VND/đêm\n` +
          `• Sức chứa: Tối đa ${r.capacity} khách\n` +
          `• Tổng chi phí (${nights} đêm): **${r.totalPrice.toLocaleString('vi-VN')} VND**`;
      })
      .join('\n\n');

    return title + list + `\n\nAnh/Chị muốn đặt hạng phòng nào trong danh sách trên ạ?`;
  }

  /**
   * Định dạng tóm tắt đặt phòng để khách xác nhận
   */
  formatBookingConfirmation(draft: {
    selectedRoomName?: string;
    checkInDate?: string;
    checkOutDate?: string;
    guestCount?: number;
    totalPrice?: number;
  }, nights: number): string {
    return `Dạ, em xin gửi Anh/Chị thông tin tóm tắt đặt phòng để xác nhận:\n\n` +
      `• Hạng phòng: **${draft.selectedRoomName}**\n` +
      `• Ngày nhận phòng (Check-in): **${draft.checkInDate}**\n` +
      `• Ngày trả phòng (Check-out): **${draft.checkOutDate}**\n` +
      `• Số lượng khách: **${draft.guestCount} khách** (${nights} đêm)\n` +
      `• Tổng chi phí thanh toán: **${draft.totalPrice?.toLocaleString('vi-VN')} VND**\n\n` +
      `Anh/Chị vui lòng nhắn **"Đồng ý"** hoặc **"Xác nhận"** để tiến hành đặt phòng, hoặc nhắn **"Hủy"** để thay đổi thông tin nhé.`;
  }

  /**
   * Định dạng đơn đặt phòng thành công
   */
  formatBookingSuccess(booking: any, roomType: string): string {
    const checkIn = new Date(booking.check_in_date).toLocaleDateString('vi-VN');
    const checkOut = new Date(booking.check_out_date).toLocaleDateString('vi-VN');
    
    return `🎉 **Chúc mừng Quý khách! Đơn đặt phòng đã được tạo thành công trên hệ thống.**\n\n` +
      `**Thông tin chi tiết đơn đặt phòng:**\n` +
      `• Mã đặt phòng: **${booking.booking_code}**\n` +
      `• Tên khách hàng: ${booking.customer_name}\n` +
      `• Số điện thoại liên hệ: ${booking.phone}\n` +
      `• Địa chỉ Email: ${booking.email}\n` +
      `• Hạng phòng đã chọn: **${roomType}**\n` +
      `• Thời gian lưu trú: Từ ${checkIn} đến ${checkOut} (${booking.night_count} đêm)\n` +
      `• Số lượng khách: ${booking.guest_count} khách\n` +
      `• Tổng chi phí thanh toán: **${Number(booking.total_amount).toLocaleString('vi-VN')} VND**\n` +
      `• Phương thức thanh toán: Chuyển khoản ngân hàng (BANK_TRANSFER)\n` +
      `• Trạng thái đơn phòng: Chờ xác nhận (Vui lòng hoàn tất chuyển khoản trong vòng 15 phút)\n` +
      `• Link xem chi tiết và quản lý đặt phòng: http://localhost:3000/bookings/manage/${booking.booking_token}\n\n` +
      `Quý khách vui lòng thực hiện chuyển khoản thanh toán trong vòng 15 phút để đảm bảo phòng được giữ chính thức trên hệ thống nhé. Khách sạn Hoàng Minh xin chân thành cảm ơn Quý khách!`;
  }

  /**
   * Định dạng lỗi vượt quá sức chứa và đề xuất phòng thay thế
   */
  formatOvercapacityError(
    selectedRoomName: string,
    maxCapacity: number,
    guestCount: number,
    alternativeRooms: any[],
  ): string {
    const title = `Dạ, phòng **${selectedRoomName}** chỉ phù hợp tối đa **${maxCapacity} khách**.\n` +
      `Trong khi đoàn của mình đi **${guestCount} người**.\n\n` +
      `Em xin đề xuất các hạng phòng có sức chứa phù hợp hơn với đoàn của mình:\n\n`;

    const list = alternativeRooms
      .map((r, i) => {
        const badge = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : '▪️';
        const rating = this.getMockRating(r.roomType);
        return `${badge} **${r.roomType}**\n` +
          `• Sức chứa: Tối đa ${r.capacity} khách\n` +
          `• Đánh giá: ⭐ ${rating}/5\n` +
          `• Giá phòng: ${r.pricePerNight.toLocaleString('vi-VN')} VND/đêm`;
      })
      .join('\n\n');

    return title + list + `\n\nAnh/chị muốn chọn phòng nào ạ?`;
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
}
