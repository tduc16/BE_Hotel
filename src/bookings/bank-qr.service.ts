import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * BankQrService — Tạo URL VietQR để hiển thị mã QR chuyển khoản ngân hàng.
 *
 * VietQR API endpoint:
 *   https://img.vietqr.io/image/{BANK_BIN}-{ACCOUNT_NUMBER}-{TEMPLATE}.jpg
 *   ?amount={AMOUNT}&addInfo={CONTENT}&accountName={ACCOUNT_NAME}
 *
 * Không cần API key, không cần xác thực.
 * Tài liệu: https://www.vietqr.io/danh-sach-api/tao-ma-qr/
 */
@Injectable()
export class BankQrService {
  private readonly logger = new Logger(BankQrService.name);

  private readonly bankBin: string;
  private readonly bankAccountNumber: string;
  private readonly bankAccountName: string;
  private readonly bankName: string;

  constructor(private readonly configService: ConfigService) {
    this.bankBin = this.configService.get<string>('BANK_BIN', '970422');
    this.bankAccountNumber = this.configService.get<string>('BANK_ACCOUNT_NUMBER', '');
    this.bankAccountName = this.configService.get<string>('BANK_ACCOUNT_NAME', 'KHACH SAN HOANG MINH');
    this.bankName = this.configService.get<string>('BANK_NAME', 'MB Bank');

    if (!this.bankAccountNumber) {
      this.logger.warn('[BankQR] BANK_ACCOUNT_NUMBER chưa được cấu hình trong .env!');
    }

    this.logger.log(
      `[BankQR] Initialized — BIN=${this.bankBin}, Account=${this.bankAccountNumber}, Name=${this.bankAccountName}`,
    );
  }

  /**
   * Sinh nội dung chuyển khoản từ booking_code.
   * Format: "DAT PHONG {BOOKING_CODE}" (không dấu tiếng Việt để tương thích ngân hàng)
   */
  generateTransferContent(bookingCode: string): string {
    return `DAT PHONG ${bookingCode}`;
  }

  /**
   * Tạo URL ảnh QR VietQR.
   *
   * @param amount Số tiền cần chuyển (VNĐ)
   * @param bookingCode Mã đặt phòng (dùng làm nội dung CK)
   * @returns URL ảnh QR dạng JPEG
   */
  generateQrUrl(amount: number, bookingCode: string): string {
    if (!this.bankAccountNumber) {
      this.logger.error('[BankQR] Không thể tạo QR — BANK_ACCOUNT_NUMBER chưa cấu hình');
      return '';
    }

    const transferContent = this.generateTransferContent(bookingCode);
    const template = 'compact'; // compact | compact2 | qr_only | print

    // Encode nội dung chuyển khoản để đảm bảo URL hợp lệ
    const encodedContent = encodeURIComponent(transferContent);
    const encodedAccountName = encodeURIComponent(this.bankAccountName);

    const qrUrl =
      `https://img.vietqr.io/image/${this.bankBin}-${this.bankAccountNumber}-${template}.jpg` +
      `?amount=${amount}` +
      `&addInfo=${encodedContent}` +
      `&accountName=${encodedAccountName}`;

    this.logger.log(`[BankQR] Generated QR URL for bookingCode=${bookingCode}, amount=${amount}`);

    return qrUrl;
  }

  /**
   * Trả về thông tin ngân hàng để hiển thị lên UI.
   */
  getBankInfo() {
    return {
      bankName: this.bankName,
      bankBin: this.bankBin,
      accountNumber: this.bankAccountNumber,
      accountName: this.bankAccountName,
    };
  }
}
