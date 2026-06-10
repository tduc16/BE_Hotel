import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import { Transporter } from 'nodemailer';

export interface BookingEmailData {
  customerName: string;
  email: string;
  bookingCode: string;
  bookingToken: string;
  roomName: string;
  roomNumber?: string;
  checkInDate: string;
  checkOutDate: string;
  guestCount: number;
  nightCount: number;
  totalAmount: number;
  paymentMethod: string;
  paymentStatus: string;
  bookingStatus: string;
}

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private transporter: Transporter | null = null;

  constructor(private configService: ConfigService) {
    const mailHost = this.configService.get<string>('MAIL_HOST');
    const mailUser = this.configService.get<string>('MAIL_USER');
    const mailPass = this.configService.get<string>('MAIL_PASS');

    if (mailHost && mailUser && mailPass) {
      this.transporter = nodemailer.createTransport({
        host: mailHost,
        port: this.configService.get<number>('MAIL_PORT', 587),
        secure: false,
        auth: {
          user: mailUser,
          pass: mailPass,
        },
      });
      this.logger.log('Mail transporter initialized');
    } else {
      this.logger.warn(
        'MAIL_HOST/MAIL_USER/MAIL_PASS chưa được cấu hình — email sẽ được log ra console thay vì gửi thật.',
      );
    }
  }

  async sendBookingConfirmation(data: BookingEmailData): Promise<void> {
    const frontendUrl = this.configService.get<string>(
      'FRONTEND_URL',
      'http://localhost:3000',
    );
    const manageLink = `${frontendUrl}/manage-booking/${data.bookingToken}`;
    const mailFrom = this.configService.get<string>(
      'MAIL_FROM',
      'noreply@hotel.com',
    );

    const formattedAmount = new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND',
    }).format(data.totalAmount);

    const html = this.buildBookingEmail(data, manageLink, formattedAmount);

    const mailOptions = {
      from: `"Khách sạn" <${mailFrom}>`,
      to: data.email,
      subject: `[${data.bookingCode}] Xác nhận đặt phòng thành công`,
      html,
    };

    if (!this.transporter) {
      // Chưa config SMTP — log ra console để dev kiểm tra
      this.logger.log('=== [EMAIL LOG - SMTP chưa cấu hình] ===');
      this.logger.log(`To: ${data.email}`);
      this.logger.log(`Subject: ${mailOptions.subject}`);
      this.logger.log(`Manage Link: ${manageLink}`);
      this.logger.log(`Booking Code: ${data.bookingCode}`);
      this.logger.log('=========================================');
      return;
    }

    try {
      const info = await this.transporter.sendMail(mailOptions);
      this.logger.log(
        `[MAIL_SENT] bookingCode=${data.bookingCode} to=${data.email} messageId=${info.messageId}`,
      );
    } catch (error) {
      // Lỗi gửi mail không được crash app — chỉ log warning
      this.logger.error(
        `[MAIL_ERROR] Không thể gửi email cho booking ${data.bookingCode}:`,
        error,
      );
    }
  }

  private buildBookingEmail(
    data: BookingEmailData,
    manageLink: string,
    formattedAmount: string,
  ): string {
    return `
<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Xác nhận đặt phòng</title>
</head>
<body style="margin:0;padding:0;background-color:#f5f5f5;font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f5f5f5;padding:30px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.08);">
          
          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(135deg,#1a1a2e 0%,#16213e 100%);padding:32px 40px;text-align:center;">
              <h1 style="color:#c9a96e;margin:0;font-size:28px;letter-spacing:2px;">🏨 KHÁCH SẠN</h1>
              <p style="color:#ffffff;margin:8px 0 0;font-size:14px;opacity:0.8;">Xác nhận đặt phòng thành công</p>
            </td>
          </tr>

          <!-- Greeting -->
          <tr>
            <td style="padding:32px 40px 0;">
              <p style="font-size:16px;color:#333;margin:0;">Xin chào <strong>${data.customerName}</strong>,</p>
              <p style="font-size:15px;color:#555;margin:12px 0 0;">
                Cảm ơn bạn đã đặt phòng tại khách sạn chúng tôi. Dưới đây là thông tin xác nhận booking của bạn.
              </p>
            </td>
          </tr>

          <!-- Booking Code Banner -->
          <tr>
            <td style="padding:24px 40px;">
              <div style="background:linear-gradient(135deg,#f8f4e8,#fef9ec);border:2px solid #c9a96e;border-radius:8px;padding:20px;text-align:center;">
                <p style="margin:0;font-size:13px;color:#8a7355;text-transform:uppercase;letter-spacing:1px;">Mã đặt phòng</p>
                <p style="margin:8px 0 0;font-size:30px;font-weight:bold;color:#1a1a2e;letter-spacing:3px;">${data.bookingCode}</p>
              </div>
            </td>
          </tr>

          <!-- Booking Details -->
          <tr>
            <td style="padding:0 40px 24px;">
              <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;">
                <tr style="background:#f9fafb;">
                  <td colspan="2" style="padding:14px 20px;font-weight:600;font-size:14px;color:#374151;border-bottom:1px solid #e5e7eb;">
                    📋 Chi tiết đặt phòng
                  </td>
                </tr>
                ${this.emailRow('Loại phòng', data.roomName)}
                ${data.roomNumber ? this.emailRow('Số phòng', data.roomNumber) : ''}
                ${this.emailRow('Ngày nhận phòng', this.formatDate(data.checkInDate))}
                ${this.emailRow('Ngày trả phòng', this.formatDate(data.checkOutDate))}
                ${this.emailRow('Số đêm', `${data.nightCount} đêm`)}
                ${this.emailRow('Số khách', `${data.guestCount} người`)}
                ${this.emailRow('Phương thức thanh toán', this.translatePaymentMethod(data.paymentMethod))}
                <tr style="background:#f0fdf4;">
                  <td style="padding:14px 20px;font-size:14px;color:#374151;font-weight:600;border-top:1px solid #e5e7eb;">Tổng tiền</td>
                  <td style="padding:14px 20px;font-size:16px;color:#059669;font-weight:700;border-top:1px solid #e5e7eb;">${formattedAmount}</td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Manage Button -->
          <tr>
            <td style="padding:0 40px 32px;text-align:center;">
              <p style="font-size:14px;color:#555;margin:0 0 16px;">
                Bạn có thể xem chi tiết và quản lý booking (bao gồm hủy phòng nếu cần) tại đây:
              </p>
              <a href="${manageLink}" 
                 style="display:inline-block;background:linear-gradient(135deg,#c9a96e,#b8914a);color:#ffffff;text-decoration:none;padding:14px 32px;border-radius:8px;font-size:15px;font-weight:600;letter-spacing:0.5px;">
                🔗 Quản lý đặt phòng
              </a>
              <p style="font-size:12px;color:#9ca3af;margin:12px 0 0;">
                Hoặc copy link: <span style="color:#6366f1;">${manageLink}</span>
              </p>
            </td>
          </tr>

          <!-- Note -->
          <tr>
            <td style="padding:0 40px 24px;">
              <div style="background:#fff7ed;border-left:4px solid #f97316;border-radius:4px;padding:16px;">
                <p style="margin:0;font-size:13px;color:#9a3412;">
                  <strong>⚠️ Lưu ý:</strong> Bạn có thể hủy đặt phòng trước ngày nhận phòng. 
                  Sau khi đã nhận phòng, việc hủy sẽ không còn khả dụng.
                </p>
              </div>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background:#f9fafb;padding:24px 40px;text-align:center;border-top:1px solid #e5e7eb;">
              <p style="margin:0;font-size:13px;color:#9ca3af;">
                Email này được gửi tự động, vui lòng không trả lời.<br>
                Nếu bạn cần hỗ trợ, vui lòng liên hệ lễ tân khách sạn.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
  }

  private emailRow(label: string, value: string): string {
    return `
      <tr>
        <td style="padding:12px 20px;font-size:14px;color:#6b7280;border-top:1px solid #f3f4f6;width:45%;">${label}</td>
        <td style="padding:12px 20px;font-size:14px;color:#111827;font-weight:500;border-top:1px solid #f3f4f6;">${value}</td>
      </tr>`;
  }

  private formatDate(dateStr: string): string {
    const date = new Date(dateStr);
    return date.toLocaleDateString('vi-VN', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  }

  private translatePaymentMethod(method: string): string {
    const map: Record<string, string> = {
      CASH: 'Tiền mặt',
      BANK_TRANSFER: 'Chuyển khoản ngân hàng',
      EWALLET: 'Ví điện tử',
    };
    return map[method] || method;
  }
}
