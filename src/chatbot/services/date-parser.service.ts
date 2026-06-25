import { Injectable, Logger } from '@nestjs/common';

export interface ParsedDateRange {
  checkIn: Date | null;
  checkOut: Date | null;
}

/**
 * DateParserService: Parse ngày từ tin nhắn tiếng Việt
 *
 * Hỗ trợ các định dạng:
 * - "20/6 đến 22/6"
 * - "20-06 tới 22-06"
 * - "20/06/2026"
 * - "20 tháng 6"
 * - "cuối tuần này"
 * - "ngày mai"
 * - "tuần tới"
 * - "2026-06-20" (ISO)
 */
@Injectable()
export class DateParserService {
  private readonly logger = new Logger(DateParserService.name);

  /**
   * Parse cặp ngày check-in / check-out từ tin nhắn
   */
  parseDateRange(message: string): ParsedDateRange {
    const now = new Date();
    const currentYear = now.getFullYear();
    const msg = message.toLowerCase().trim();

    // 1. Thử parse keyword đặc biệt (ngày mai, cuối tuần, tuần tới)
    const keywordResult = this.parseKeywordDates(msg, now);
    if (keywordResult.checkIn) {
      this.logger.debug(`[DateParser] Keyword match: ${JSON.stringify(keywordResult)}`);
      return keywordResult;
    }

    // 2. Thu thập tất cả ngày tìm thấy trong tin nhắn
    const allDates = this.extractAllDates(msg, currentYear);

    if (allDates.length === 0) {
      return { checkIn: null, checkOut: null };
    }

    if (allDates.length === 1) {
      // Chỉ có 1 ngày → đó là check-in, check-out = check-in + 1
      const checkIn = allDates[0];
      const checkOut = new Date(checkIn);
      checkOut.setDate(checkOut.getDate() + 1);
      return { checkIn, checkOut };
    }

    // >= 2 ngày → lấy ngày nhỏ nhất là check-in, lớn nhất là check-out
    allDates.sort((a, b) => a.getTime() - b.getTime());
    return { checkIn: allDates[0], checkOut: allDates[allDates.length - 1] };
  }

  /**
   * Parse ngày đơn từ chuỗi
   */
  parseSingleDate(text: string): Date | null {
    const result = this.parseDateRange(text);
    return result.checkIn;
  }

  // ─── Private helpers ──────────────────────────────────────────────────────────

  private parseKeywordDates(msg: string, now: Date): ParsedDateRange {
    // "ngày mai"
    if (msg.includes('ngày mai') || msg.includes('tomorrow')) {
      const tomorrow = new Date(now);
      tomorrow.setDate(now.getDate() + 1);
      tomorrow.setHours(0, 0, 0, 0);
      const checkOut = new Date(tomorrow);
      checkOut.setDate(tomorrow.getDate() + 1);
      return { checkIn: tomorrow, checkOut };
    }

    // "hôm nay"
    if (msg.includes('hôm nay') || msg.includes('today')) {
      const today = new Date(now);
      today.setHours(0, 0, 0, 0);
      const checkOut = new Date(today);
      checkOut.setDate(today.getDate() + 1);
      return { checkIn: today, checkOut };
    }

    // "cuối tuần này" hoặc "cuối tuần"
    if (msg.includes('cuối tuần') || msg.includes('weekend')) {
      const dayOfWeek = now.getDay(); // 0=CN, 6=T7
      const daysToSaturday = dayOfWeek === 6 ? 7 : (6 - dayOfWeek + 7) % 7;
      const saturday = new Date(now);
      saturday.setDate(now.getDate() + (daysToSaturday || 7));
      saturday.setHours(0, 0, 0, 0);
      const sunday = new Date(saturday);
      sunday.setDate(saturday.getDate() + 1);
      return { checkIn: saturday, checkOut: sunday };
    }

    // "tuần tới" hoặc "tuần sau"
    if (
      msg.includes('tuần tới') ||
      msg.includes('tuần sau') ||
      msg.includes('next week')
    ) {
      const dayOfWeek = now.getDay();
      const daysToNextMonday = (8 - dayOfWeek) % 7 || 7;
      const nextMonday = new Date(now);
      nextMonday.setDate(now.getDate() + daysToNextMonday);
      nextMonday.setHours(0, 0, 0, 0);
      const nextFriday = new Date(nextMonday);
      nextFriday.setDate(nextMonday.getDate() + 4);
      return { checkIn: nextMonday, checkOut: nextFriday };
    }

    // "tháng tới" hoặc "tháng sau"
    if (msg.includes('tháng tới') || msg.includes('tháng sau')) {
      const nextMonth = new Date(now);
      nextMonth.setMonth(now.getMonth() + 1);
      nextMonth.setDate(1);
      nextMonth.setHours(0, 0, 0, 0);
      const checkOut = new Date(nextMonth);
      checkOut.setDate(nextMonth.getDate() + 2);
      return { checkIn: nextMonth, checkOut };
    }

    return { checkIn: null, checkOut: null };
  }

  private extractAllDates(msg: string, currentYear: number): Date[] {
    const dates: Date[] = [];

    // Pattern 1: ISO format "2026-06-20" hoặc "2026/06/20"
    const isoPattern = /(\d{4})[-\/](\d{1,2})[-\/](\d{1,2})/g;
    let match: RegExpExecArray | null;

    while ((match = isoPattern.exec(msg)) !== null) {
      const d = this.buildDate(
        parseInt(match[1]),
        parseInt(match[2]),
        parseInt(match[3]),
      );
      if (d) dates.push(d);
    }

    if (dates.length > 0) return dates;

    // Pattern 2: "dd/mm/yyyy" hoặc "dd-mm-yyyy"
    const fullDatePattern = /(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/g;
    while ((match = fullDatePattern.exec(msg)) !== null) {
      const d = this.buildDate(
        parseInt(match[3]),
        parseInt(match[2]),
        parseInt(match[1]),
      );
      if (d) dates.push(d);
    }

    if (dates.length > 0) return dates;

    // Pattern 3: "dd/mm" hoặc "dd-mm" (không có năm)
    const shortDatePattern = /(\d{1,2})[\/\-](\d{1,2})(?![\/\-]\d)/g;
    while ((match = shortDatePattern.exec(msg)) !== null) {
      const day = parseInt(match[1]);
      const month = parseInt(match[2]);
      // Heuristic: nếu month > 12 thì thử đổi ngày/tháng
      const [d, m] = month > 12 ? [month, day] : [day, month];
      const date = this.buildDate(currentYear, m, d);
      if (date) {
        // Nếu ngày đã qua trong năm nay, tăng lên năm sau
        const adjustedDate = this.adjustPastDate(date);
        dates.push(adjustedDate);
      }
    }

    if (dates.length > 0) return dates;

    // Pattern 4: "20 tháng 6" hoặc "ngày 20 tháng 6"
    const vietnamesePattern = /(?:ngày\s*)?(\d{1,2})\s*tháng\s*(\d{1,2})(?:\s*(?:năm\s*)?(\d{4}))?/g;
    while ((match = vietnamesePattern.exec(msg)) !== null) {
      const day = parseInt(match[1]);
      const month = parseInt(match[2]);
      const year = match[3] ? parseInt(match[3]) : currentYear;
      const d = this.buildDate(year, month, day);
      if (d) {
        dates.push(this.adjustPastDate(d));
      }
    }

    return dates;
  }

  private buildDate(year: number, month: number, day: number): Date | null {
    if (month < 1 || month > 12) return null;
    if (day < 1 || day > 31) return null;
    if (year < 2020 || year > 2030) return null;

    const date = new Date(year, month - 1, day);
    // Kiểm tra ngày hợp lệ (tránh 31/2 etc.)
    if (
      date.getFullYear() !== year ||
      date.getMonth() !== month - 1 ||
      date.getDate() !== day
    ) {
      return null;
    }

    date.setHours(0, 0, 0, 0);
    return date;
  }

  /**
   * Nếu ngày đã qua (trong quá khứ), tự động +1 năm
   */
  private adjustPastDate(date: Date): Date {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    if (date < now) {
      const adjusted = new Date(date);
      adjusted.setFullYear(adjusted.getFullYear() + 1);
      return adjusted;
    }
    return date;
  }

  /**
   * Format date sang chuỗi YYYY-MM-DD để lưu DB
   */
  formatDate(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  /**
   * Format date sang chuỗi dd/mm/yyyy để hiển thị
   */
  formatDateVN(date: Date): string {
    return date.toLocaleDateString('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  }
}
