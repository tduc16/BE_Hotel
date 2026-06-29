import { Injectable, Logger } from '@nestjs/common';
import { MailerService } from '@nestjs-modules/mailer';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);

  constructor(
    private readonly mailerService: MailerService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Log cấu hình SMTP an toàn (không lộ mật khẩu) trước khi gửi
   */
  private logSmtpConfig(recipient: string, subject: string) {
    const host = this.configService.get<string>('MAIL_HOST', 'smtp.gmail.com');
    const port = this.configService.get<number>('MAIL_PORT', 587);
    const user = this.configService.get<string>('MAIL_USER');
    const pass = this.configService.get<string>('MAIL_PASSWORD');
    this.logger.log(
      `[SMTP Config Check] Host: ${host}, Port: ${port}, User Exists: ${!!user}, Pass Exists: ${!!pass}, Recipient: ${recipient}, Subject: ${subject}`
    );
  }

  /**
   * Helper format tiền tệ Việt Nam
   */
  private formatVND(amount: number | string): string {
    const value = Number(amount);
    if (isNaN(value)) return '0 VNĐ';
    return value.toLocaleString('vi-VN') + ' VNĐ';
  }

  /**
   * Helper format ngày dd/MM/yyyy
   */
  private formatDate(dateInput: string | Date): string {
    if (!dateInput) return '';
    const date = new Date(dateInput);
    if (isNaN(date.getTime())) return String(dateInput);
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  }

  /**
   * 1. Gửi email chào mừng khi khách đăng ký tài khoản thành công
   */
  async sendWelcomeEmail(customerEmail: string, customerName: string): Promise<void> {
    const frontendUrl = this.configService.get<string>('FRONTEND_URL', 'http://localhost:3000');
    const loginLink = `${frontendUrl}/login`;

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Chào mừng quý khách đến với Khách sạn Hoàng Minh</title>
      </head>
      <body style="margin: 0; padding: 0; background-color: #F8F6F3; font-family: 'Segoe UI', Arial, sans-serif; color: #333333;">
        <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #F8F6F3; padding: 40px 0;">
          <tr>
            <td align="center">
              <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border: 1px solid #E5E2DD; border-radius: 4px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.03);">
                <!-- Header -->
                <tr>
                  <td style="background-color: #1A1A1A; padding: 40px; text-align: center; border-bottom: 3px solid #C8A97E;">
                    <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 300; letter-spacing: 4px; text-transform: uppercase;">Hoàng Minh</h1>
                    <p style="color: #C8A97E; margin: 5px 0 0 0; font-size: 10px; font-weight: 600; letter-spacing: 3px; text-transform: uppercase;">Resort & Hotel</p>
                  </td>
                </tr>
                <!-- Content -->
                <tr>
                  <td style="padding: 40px 50px;">
                    <p style="font-size: 16px; line-height: 1.6; color: #1A1A1A; margin-top: 0;">Xin chào <strong>${customerName}</strong>,</p>
                    <p style="font-size: 15px; line-height: 1.6; color: #555555;">
                      Cảm ơn quý khách đã tin tưởng và đăng ký tài khoản thành viên tại <strong>Khách sạn Hoàng Minh</strong>. Chúng tôi rất vinh hạnh được đồng hành cùng quý khách trong những hành trình nghỉ dưỡng sắp tới.
                    </p>
                    <p style="font-size: 15px; line-height: 1.6; color: #555555;">
                      Với tài khoản thành viên này, quý khách có thể dễ dàng:
                    </p>
                    <ul style="font-size: 14px; line-height: 1.8; color: #555555; padding-left: 20px;">
                      <li>Khám phá các hạng phòng sang trọng & đẳng cấp.</li>
                      <li>Đặt phòng trực tuyến nhanh chóng với thông tin lưu sẵn.</li>
                      <li>Áp dụng các mã ưu đãi, voucher giảm giá đặc quyền VIP.</li>
                      <li>Gửi đánh giá dịch vụ trực tiếp sau mỗi kỳ nghỉ.</li>
                      <li>Đặc biệt: Trò chuyện cùng <strong>Chatbot AI</strong> thông minh để nhận tư vấn phòng và lịch trình du lịch 24/7.</li>
                    </ul>
                    <p style="font-size: 15px; line-height: 1.6; color: #555555; margin-bottom: 30px;">
                      Hãy bắt đầu hành trình trải nghiệm dịch vụ thượng lưu bằng cách đăng nhập vào tài khoản của quý khách:
                    </p>
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td align="center">
                          <a href="${loginLink}" style="display: inline-block; background-color: #C8A97E; color: #ffffff; text-decoration: none; padding: 15px 35px; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 2px; border-radius: 2px; transition: background-color 0.2s;">Đăng nhập tài khoản</a>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <!-- Footer -->
                <tr>
                  <td style="background-color: #F8F6F3; padding: 30px; text-align: center; border-top: 1px solid #E5E2DD; font-size: 12px; color: #888888; line-height: 1.6;">
                    <p style="margin: 0 0 5px 0; font-weight: 600; color: #1A1A1A;">Khách sạn Hoàng Minh</p>
                    <p style="margin: 0;">Địa chỉ nghỉ dưỡng đẳng cấp & thượng lưu</p>
                    <p style="margin: 5px 0 0 0;">Email này được gửi tự động, vui lòng không trả lời trực tiếp.</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
      </html>
    `;

    const subject = 'Chào mừng quý khách đến với Khách sạn Hoàng Minh';
    this.logSmtpConfig(customerEmail, subject);

    try {
      await this.mailerService.sendMail({
        to: customerEmail,
        subject,
        html,
      });
      this.logger.log(`[EmailWelcome] Gửi email chào mừng thành công tới ${customerEmail}`);
    } catch (error: any) {
      this.logger.error(`[EmailWelcomeError] Lỗi gửi email chào mừng tới ${customerEmail}: ${error.message}. SMTP Error Detail: ${JSON.stringify(error)}`, error.stack);
    }
  }

  /**
   * 2. Gửi email xác nhận đặt phòng thành công
   */
  async sendBookingConfirmationEmail(customerEmail: string, booking: any): Promise<void> {
    const frontendUrl = this.configService.get<string>('FRONTEND_URL', 'http://localhost:3000');
    // Link tra cứu đơn hàng: dùng token để truy cập trực tiếp
    const lookupLink = `${frontendUrl}/manage-booking/${booking.booking_token || booking.bookingToken}`;

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Xác nhận đặt phòng thành công - Hoàng Minh Hotel</title>
      </head>
      <body style="margin: 0; padding: 0; background-color: #F8F6F3; font-family: 'Segoe UI', Arial, sans-serif; color: #333333;">
        <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #F8F6F3; padding: 40px 0;">
          <tr>
            <td align="center">
              <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border: 1px solid #E5E2DD; border-radius: 4px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.03);">
                <!-- Header -->
                <tr>
                  <td style="background-color: #1A1A1A; padding: 40px; text-align: center; border-bottom: 3px solid #C8A97E;">
                    <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 300; letter-spacing: 4px; text-transform: uppercase;">Hoàng Minh</h1>
                    <p style="color: #C8A97E; margin: 5px 0 0 0; font-size: 10px; font-weight: 600; letter-spacing: 3px; text-transform: uppercase;">Resort & Hotel</p>
                  </td>
                </tr>
                <!-- Content -->
                <tr>
                  <td style="padding: 40px 40px 30px 40px;">
                    <p style="font-size: 16px; line-height: 1.6; color: #1A1A1A; margin-top: 0;">Kính chào quý khách <strong>${booking.customer_name || booking.customerName}</strong>,</p>
                    <p style="font-size: 15px; line-height: 1.6; color: #555555;">
                      Cảm ơn quý khách đã lựa chọn đặt phòng tại <strong>Khách sạn Hoàng Minh</strong>. Đơn đặt phòng của quý khách đã được ghi nhận thành công trong hệ thống. Dưới đây là thông tin chi tiết:
                    </p>

                    <!-- Booking Code Banner -->
                    <div style="background-color: #F8F6F3; border-left: 4px solid #C8A97E; padding: 15px 20px; margin: 25px 0; border-radius: 2px;">
                      <p style="margin: 0; font-size: 12px; color: #888888; text-transform: uppercase; letter-spacing: 1px;">Mã đặt phòng (Booking Code)</p>
                      <p style="margin: 5px 0 0 0; font-size: 22px; font-weight: bold; color: #1A1A1A; letter-spacing: 2px;">${booking.booking_code || booking.bookingCode}</p>
                    </div>

                    <!-- Bảng thông tin -->
                    <table width="100%" cellpadding="0" cellspacing="0" style="font-size: 14px; color: #555555; border-collapse: collapse; margin-bottom: 35px;">
                      <tr>
                        <td colspan="2" style="padding: 10px 0; border-bottom: 2px solid #E5E2DD; font-weight: bold; color: #1A1A1A; font-size: 15px;">Thông tin khách hàng</td>
                      </tr>
                      <tr>
                        <td width="40%" style="padding: 10px 0; border-bottom: 1px solid #F0ECE7;">Họ tên khách hàng</td>
                        <td width="60%" style="padding: 10px 0; border-bottom: 1px solid #F0ECE7; font-weight: bold; color: #1A1A1A;">${booking.customer_name || booking.customerName}</td>
                      </tr>
                      <tr>
                        <td style="padding: 10px 0; border-bottom: 1px solid #F0ECE7;">Số điện thoại</td>
                        <td style="padding: 10px 0; border-bottom: 1px solid #F0ECE7; color: #1A1A1A;">${booking.phone}</td>
                      </tr>
                      <tr>
                        <td style="padding: 10px 0; border-bottom: 1px solid #F0ECE7;">Email liên hệ</td>
                        <td style="padding: 10px 0; border-bottom: 1px solid #F0ECE7; color: #1A1A1A;">${customerEmail}</td>
                      </tr>

                      <tr>
                        <td colspan="2" style="padding: 25px 0 10px 0; border-bottom: 2px solid #E5E2DD; font-weight: bold; color: #1A1A1A; font-size: 15px;">Chi tiết dịch vụ lưu trú</td>
                      </tr>
                      <tr>
                        <td style="padding: 10px 0; border-bottom: 1px solid #F0ECE7;">Hạng phòng đặt</td>
                        <td style="padding: 10px 0; border-bottom: 1px solid #F0ECE7; font-weight: bold; color: #C8A97E;">${booking.roomName || booking.roomCategory?.name || 'Hạng phòng đã đặt'}</td>
                      </tr>
                      <tr>
                        <td style="padding: 10px 0; border-bottom: 1px solid #F0ECE7;">Ngày nhận phòng (Check-in)</td>
                        <td style="padding: 10px 0; border-bottom: 1px solid #F0ECE7; color: #1A1A1A;">${this.formatDate(booking.check_in_date || booking.checkInDate)}</td>
                      </tr>
                      <tr>
                        <td style="padding: 10px 0; border-bottom: 1px solid #F0ECE7;">Ngày trả phòng (Check-out)</td>
                        <td style="padding: 10px 0; border-bottom: 1px solid #F0ECE7; color: #1A1A1A;">${this.formatDate(booking.check_out_date || booking.checkOutDate)}</td>
                      </tr>
                      <tr>
                        <td style="padding: 10px 0; border-bottom: 1px solid #F0ECE7;">Thời gian lưu trú</td>
                        <td style="padding: 10px 0; border-bottom: 1px solid #F0ECE7; color: #1A1A1A;">${booking.night_count || booking.nightCount} đêm</td>
                      </tr>
                      <tr>
                        <td style="padding: 10px 0; border-bottom: 1px solid #F0ECE7;">Số khách lưu trú</td>
                        <td style="padding: 10px 0; border-bottom: 1px solid #F0ECE7; color: #1A1A1A;">${booking.guest_count || booking.guestCount} người</td>
                      </tr>
                      <tr>
                        <td style="padding: 10px 0; border-bottom: 1px solid #F0ECE7;">Giá phòng mỗi đêm</td>
                        <td style="padding: 10px 0; border-bottom: 1px solid #F0ECE7; color: #1A1A1A;">${this.formatVND(booking.room_price || booking.roomPrice)}</td>
                      </tr>
                      
                      ${Number(booking.discountAmount || booking.discount_amount || 0) > 0 ? `
                      <tr>
                        <td style="padding: 10px 0; border-bottom: 1px solid #F0ECE7;">Mức giảm giá ưu đãi</td>
                        <td style="padding: 10px 0; border-bottom: 1px solid #F0ECE7; color: #DC2626;">-${this.formatVND(booking.discountAmount || booking.discount_amount)}</td>
                      </tr>` : ''}

                      <tr style="background-color: #FDFBF7;">
                        <td style="padding: 15px 10px; border-bottom: 1px solid #E5E2DD; font-weight: bold; color: #1A1A1A;">Tổng chi phí thanh toán</td>
                        <td style="padding: 15px 10px; border-bottom: 1px solid #E5E2DD; font-weight: bold; color: #C8A97E; font-size: 16px;">${this.formatVND(booking.total_amount || booking.totalAmount)}</td>
                      </tr>

                      <tr>
                        <td colspan="2" style="padding: 25px 0 10px 0; border-bottom: 2px solid #E5E2DD; font-weight: bold; color: #1A1A1A; font-size: 15px;">Trạng thái thanh toán & Đặt phòng</td>
                      </tr>
                      <tr>
                        <td style="padding: 10px 0; border-bottom: 1px solid #F0ECE7;">Phương thức thanh toán</td>
                        <td style="padding: 10px 0; border-bottom: 1px solid #F0ECE7; color: #1A1A1A;">${booking.payment_method || booking.paymentMethod}</td>
                      </tr>
                      <tr>
                        <td style="padding: 10px 0; border-bottom: 1px solid #F0ECE7;">Trạng thái đặt phòng</td>
                        <td style="padding: 10px 0; border-bottom: 1px solid #F0ECE7; font-weight: bold; color: #1A1A1A;">${booking.booking_status || booking.bookingStatus}</td>
                      </tr>
                      <tr>
                        <td style="padding: 10px 0; border-bottom: 1px solid #E5E2DD;">Trạng thái thanh toán</td>
                        <td style="padding: 10px 0; border-bottom: 1px solid #E5E2DD; font-weight: bold; color: #1A1A1A;">${booking.payment_status || booking.paymentStatus}</td>
                      </tr>
                    </table>

                    <p style="font-size: 14px; line-height: 1.6; color: #555555; margin-bottom: 25px; text-align: center;">
                      Quý khách có thể quản lý, kiểm tra trạng thái thanh toán hoặc yêu cầu hỗ trợ đơn đặt phòng của mình trực tiếp bằng liên kết dưới đây:
                    </p>
                    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom: 20px;">
                      <tr>
                        <td align="center">
                          <a href="${lookupLink}" style="display: inline-block; background-color: #1A1A1A; color: #ffffff; text-decoration: none; padding: 15px 35px; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 2px; border-radius: 2px; transition: background-color 0.2s; border: 1px solid #1A1A1A;">Quản lý đơn đặt phòng</a>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <!-- Footer -->
                <tr>
                  <td style="background-color: #F8F6F3; padding: 30px; text-align: center; border-top: 1px solid #E5E2DD; font-size: 12px; color: #888888; line-height: 1.6;">
                    <p style="margin: 0 0 5px 0; font-weight: 600; color: #1A1A1A;">Khách sạn Hoàng Minh</p>
                    <p style="margin: 0;">Trải nghiệm nghỉ dưỡng đẳng cấp thượng lưu</p>
                    <p style="margin: 5px 0 0 0;">Email này được gửi tự động, vui lòng không trả lời trực tiếp.</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
      </html>
    `;

    const code = booking.booking_code || booking.bookingCode;
    const subject = `[${code}] Xác nhận đặt phòng thành công - Hoàng Minh Hotel`;
    this.logSmtpConfig(customerEmail, subject);

    try {
      await this.mailerService.sendMail({
        to: customerEmail,
        subject,
        html,
      });
      this.logger.log(`[EmailBookingConfirm] Gửi email đặt phòng ${code} thành công tới ${customerEmail}`);
    } catch (error: any) {
      this.logger.error(`[EmailBookingConfirmError] Lỗi gửi email đặt phòng tới ${customerEmail}: ${error.message}. SMTP Error Detail: ${JSON.stringify(error)}`, error.stack);
    }
  }

  /**
   * 3. Gửi email yêu cầu đặt lại mật khẩu (Quên mật khẩu)
   */
  async sendForgotPasswordEmail(customerEmail: string, customerName: string, resetLink: string): Promise<void> {
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Yêu cầu đặt lại mật khẩu - Khách sạn Hoàng Minh</title>
      </head>
      <body style="margin: 0; padding: 0; background-color: #F8F6F3; font-family: 'Segoe UI', Arial, sans-serif; color: #333333;">
        <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #F8F6F3; padding: 40px 0;">
          <tr>
            <td align="center">
              <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border: 1px solid #E5E2DD; border-radius: 4px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.03);">
                <!-- Header -->
                <tr>
                  <td style="background-color: #1A1A1A; padding: 40px; text-align: center; border-bottom: 3px solid #C8A97E;">
                    <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 300; letter-spacing: 4px; text-transform: uppercase;">Hoàng Minh</h1>
                    <p style="color: #C8A97E; margin: 5px 0 0 0; font-size: 10px; font-weight: 600; letter-spacing: 3px; text-transform: uppercase;">Resort & Hotel</p>
                  </td>
                </tr>
                <!-- Content -->
                <tr>
                  <td style="padding: 40px 50px;">
                    <p style="font-size: 16px; line-height: 1.6; color: #1A1A1A; margin-top: 0;">Kính chào quý khách <strong>${customerName}</strong>,</p>
                    <p style="font-size: 15px; line-height: 1.6; color: #555555;">
                      Chúng tôi nhận được yêu cầu đặt lại mật khẩu cho tài khoản của quý khách tại <strong>Khách sạn Hoàng Minh</strong>.
                    </p>
                    <p style="font-size: 15px; line-height: 1.6; color: #555555;">
                      Vui lòng bấm vào nút đặt lại mật khẩu bên dưới để tạo mật khẩu mới. Liên kết này chỉ có hiệu lực trong vòng <strong>15 phút</strong>.
                    </p>
                    <table width="100%" cellpadding="0" cellspacing="0" style="margin: 30px 0;">
                      <tr>
                        <td align="center">
                          <a href="${resetLink}" style="display: inline-block; background-color: #C8A97E; color: #ffffff; text-decoration: none; padding: 15px 35px; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 2px; border-radius: 2px; transition: background-color 0.2s;">Đặt lại mật khẩu</a>
                        </td>
                      </tr>
                    </table>
                    <p style="font-size: 13px; line-height: 1.6; color: #EF4444; margin-bottom: 20px; font-weight: 500;">
                      * Nếu không thể click trực tiếp vào nút trên, quý khách vui lòng sao chép và dán liên kết sau vào thanh địa chỉ của trình duyệt:
                      <br>
                      <span style="color: #555555; word-break: break-all; font-weight: normal; font-size: 12px;">${resetLink}</span>
                    </p>
                    <p style="font-size: 14px; line-height: 1.6; color: #888888;">
                      Nếu quý khách không thực hiện yêu cầu này, xin vui lòng bỏ qua email này. Mật khẩu hiện tại của quý khách vẫn được bảo mật an toàn.
                    </p>
                  </td>
                </tr>
                <!-- Footer -->
                <tr>
                  <td style="background-color: #F8F6F3; padding: 30px; text-align: center; border-top: 1px solid #E5E2DD; font-size: 12px; color: #888888; line-height: 1.6;">
                    <p style="margin: 0 0 5px 0; font-weight: 600; color: #1A1A1A;">Khách sạn Hoàng Minh</p>
                    <p style="margin: 0;">Trải nghiệm nghỉ dưỡng đẳng cấp thượng lưu</p>
                    <p style="margin: 5px 0 0 0;">Email này được gửi tự động, vui lòng không trả lời trực tiếp.</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
      </html>
    `;

    const subject = 'Yêu cầu đặt lại mật khẩu - Khách sạn Hoàng Minh';
    this.logSmtpConfig(customerEmail, subject);

    try {
      await this.mailerService.sendMail({
        to: customerEmail,
        subject,
        html,
      });
      this.logger.log(`[EmailForgotPassword] Gửi email hướng dẫn đổi mật khẩu thành công tới ${customerEmail}`);
    } catch (error: any) {
      this.logger.error(`[EmailForgotPasswordError] Lỗi gửi email hướng dẫn tới ${customerEmail}: ${error.message}. SMTP Error Detail: ${JSON.stringify(error)}`, error.stack);
    }
  }

  /**
   * 4. Gửi thông báo sau khi đổi mật khẩu thành công
   */
  async sendPasswordChangedEmail(customerEmail: string, customerName: string): Promise<void> {
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Mật khẩu của bạn đã được thay đổi - Khách sạn Hoàng Minh</title>
      </head>
      <body style="margin: 0; padding: 0; background-color: #F8F6F3; font-family: 'Segoe UI', Arial, sans-serif; color: #333333;">
        <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #F8F6F3; padding: 40px 0;">
          <tr>
            <td align="center">
              <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border: 1px solid #E5E2DD; border-radius: 4px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.03);">
                <!-- Header -->
                <tr>
                  <td style="background-color: #1A1A1A; padding: 40px; text-align: center; border-bottom: 3px solid #C8A97E;">
                    <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 300; letter-spacing: 4px; text-transform: uppercase;">Hoàng Minh</h1>
                    <p style="color: #C8A97E; margin: 5px 0 0 0; font-size: 10px; font-weight: 600; letter-spacing: 3px; text-transform: uppercase;">Resort & Hotel</p>
                  </td>
                </tr>
                <!-- Content -->
                <tr>
                  <td style="padding: 40px 50px;">
                    <p style="font-size: 16px; line-height: 1.6; color: #1A1A1A; margin-top: 0;">Kính chào quý khách <strong>${customerName}</strong>,</p>
                    <p style="font-size: 15px; line-height: 1.6; color: #555555;">
                      Email này được gửi nhằm thông báo rằng mật khẩu cho tài khoản tại <strong>Khách sạn Hoàng Minh</strong> của quý khách vừa được thay đổi thành công.
                    </p>
                    <div style="background-color: #FEF2F2; border-left: 4px solid #EF4444; padding: 15px; margin: 25px 0; border-radius: 2px;">
                      <p style="margin: 0; font-size: 13px; color: #991B1B; font-weight: bold;">⚠️ Lưu ý quan trọng:</p>
                      <p style="margin: 5px 0 0 0; font-size: 13px; color: #7F1D1D; line-height: 1.5;">
                        Nếu quý khách KHÔNG thực hiện thay đổi này, vui lòng liên hệ ngay lập tức với bộ phận hỗ trợ khách hàng của Khách sạn Hoàng Minh qua hotline hoặc email để bảo vệ tài khoản.
                      </p>
                    </div>
                    <p style="font-size: 14px; line-height: 1.6; color: #555555;">
                      Cảm ơn quý khách đã đồng hành cùng chúng tôi.
                    </p>
                  </td>
                </tr>
                <!-- Footer -->
                <tr>
                  <td style="background-color: #F8F6F3; padding: 30px; text-align: center; border-top: 1px solid #E5E2DD; font-size: 12px; color: #888888; line-height: 1.6;">
                    <p style="margin: 0 0 5px 0; font-weight: 600; color: #1A1A1A;">Khách sạn Hoàng Minh</p>
                    <p style="margin: 0;">Trải nghiệm nghỉ dưỡng đẳng cấp thượng lưu</p>
                    <p style="margin: 5px 0 0 0;">Email này được gửi tự động, vui lòng không trả lời trực tiếp.</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
      </html>
    `;

    const subject = 'Mật khẩu tài khoản của bạn đã được thay đổi - Khách sạn Hoàng Minh';
    this.logSmtpConfig(customerEmail, subject);

    try {
      await this.mailerService.sendMail({
        to: customerEmail,
        subject,
        html,
      });
      this.logger.log(`[EmailPasswordChanged] Gửi email thông báo đổi mật khẩu thành công tới ${customerEmail}`);
    } catch (error: any) {
      this.logger.error(`[EmailPasswordChangedError] Lỗi gửi email thông báo tới ${customerEmail}: ${error.message}. SMTP Error Detail: ${JSON.stringify(error)}`, error.stack);
    }
  }

  /**
   * 5. Gửi email test cấu hình SMTP
   */
  async sendTestEmail(to: string): Promise<void> {
    const subject = 'Test email từ Khách sạn Hoàng Minh';
    this.logSmtpConfig(to, subject);

    try {
      await this.mailerService.sendMail({
        to,
        subject,
        html: `
          <div style="font-family: Arial, sans-serif; padding: 20px; border: 1px solid #ddd; border-radius: 5px;">
            <h2 style="color: #C8A97E;">Khách sạn Hoàng Minh</h2>
            <p>Chào bạn,</p>
            <p>Đây là email kiểm tra hệ thống gửi thư (SMTP) được gửi tự động từ <strong>Khách sạn Hoàng Minh</strong>.</p>
            <p>Nếu bạn nhận được email này, cấu hình SMTP của bạn đã hoạt động hoàn toàn chính xác.</p>
            <hr style="border: 0; border-top: 1px solid #eee;" />
            <p style="font-size: 12px; color: #888;">Email này được gửi tự động, vui lòng không trả lời trực tiếp.</p>
          </div>
        `,
      });
      this.logger.log(`[EmailTest] Gửi email test thành công tới ${to}`);
    } catch (error: any) {
      this.logger.error(`[EmailTestError] Lỗi gửi email test tới ${to}: ${error.message}. SMTP Error Detail: ${JSON.stringify(error)}`, error.stack);
      throw error;
    }
  }
}
