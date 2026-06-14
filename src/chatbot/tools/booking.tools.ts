import { Injectable, Logger } from '@nestjs/common';
import { BookingsService } from '../../bookings/bookings.service';

@Injectable()
export class BookingTools {
  private readonly logger = new Logger(BookingTools.name);

  constructor(private readonly bookingsService: BookingsService) {}

  /**
   * TOOL 5: Tra cứu booking theo mã
   */
  async lookupBooking(bookingCode: string): Promise<string> {
    try {
      const code = bookingCode.trim().toUpperCase();
      const booking = await this.bookingsService.getBookingByCode(code);

      const checkIn = new Date(booking.check_in_date).toLocaleDateString('vi-VN');
      const checkOut = new Date(booking.check_out_date).toLocaleDateString('vi-VN');
      const totalAmount = Number(booking.total_amount).toLocaleString('vi-VN');

      const statusMap: Record<string, string> = {
        PENDING: '⏳ Chờ xác nhận',
        CONFIRMED: '✅ Đã xác nhận',
        CHECKED_IN: '🏨 Đang lưu trú',
        CHECKED_OUT: '🚪 Đã trả phòng',
        CANCELLED: '❌ Đã hủy',
        EXPIRED: '⌛ Hết hạn',
      };

      const paymentStatusMap: Record<string, string> = {
        UNPAID: '💳 Chưa thanh toán',
        PAID: '✅ Đã thanh toán',
        REFUNDED: '↩️ Đã hoàn tiền',
      };

      const bookingStatus = statusMap[booking.booking_status] || booking.booking_status;
      const paymentStatus = paymentStatusMap[booking.payment_status] || booking.payment_status;
      const roomName = booking.roomCategory?.name || 'Không rõ';

      return `Thông tin đặt phòng **${code}**:

• Loại phòng: ${roomName}
• Check-in: ${checkIn}
• Check-out: ${checkOut}
• Số khách: ${booking.guest_count} người (${booking.night_count} đêm)
• Tổng tiền: **${totalAmount} VND**
• Trạng thái: ${bookingStatus}
• Thanh toán: ${paymentStatus}
• Khách hàng: ${booking.customer_name}

${booking.booking_status === 'CONFIRMED' ? '💡 Tip: Quý khách có thể check-in sau 14:00 ngày ' + checkIn : ''}`;
    } catch (error: any) {
      this.logger.warn(`[BookingTools.lookupBooking] Không tìm thấy booking: ${bookingCode}`);

      if (error?.status === 404 || error?.message?.includes('không tìm thấy')) {
        return `Không tìm thấy đặt phòng với mã **${bookingCode.toUpperCase()}**. Vui lòng kiểm tra lại mã booking hoặc liên hệ lễ tân để được hỗ trợ.`;
      }

      return 'Không thể tra cứu booking lúc này. Vui lòng thử lại sau hoặc liên hệ lễ tân.';
    }
  }

  /**
   * TOOL 6: Thu thập thông tin để đặt phòng
   * Trả về thông báo hướng dẫn và đường dẫn đặt phòng
   */
  async assistBooking(context: {
    checkIn?: string;
    checkOut?: string;
    guestCount?: number;
    roomCategoryName?: string;
    customerName?: string;
    email?: string;
  }): Promise<string> {
    const missing: string[] = [];

    if (!context.checkIn) missing.push('ngày check-in');
    if (!context.checkOut) missing.push('ngày check-out');
    if (!context.guestCount) missing.push('số lượng khách');

    if (missing.length > 0) {
      return `Để đặt phòng, tôi cần thêm thông tin: **${missing.join(', ')}**. Quý khách vui lòng cho biết?`;
    }

    // Đã đủ thông tin cơ bản
    const checkInDisplay = context.checkIn
      ? new Date(context.checkIn).toLocaleDateString('vi-VN')
      : '';
    const checkOutDisplay = context.checkOut
      ? new Date(context.checkOut).toLocaleDateString('vi-VN')
      : '';

    const summary = `
✅ Tôi đã ghi nhận thông tin đặt phòng của Quý khách:
• Check-in: **${checkInDisplay}**
• Check-out: **${checkOutDisplay}**
• Số khách: **${context.guestCount} người**
${context.roomCategoryName ? `• Loại phòng: **${context.roomCategoryName}**` : ''}

👉 Vui lòng nhấn nút bên dưới để hoàn tất đặt phòng, hoặc tôi có thể kiểm tra phòng trống cho Quý khách trước.
    `.trim();

    return summary;
  }
}
