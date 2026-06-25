import { Injectable } from '@nestjs/common';
import { DateParserService } from './date-parser.service';

export interface ExtractedEntities {
  /** Ngày check-in và check-out */
  dates: {
    checkIn?: Date;
    checkOut?: Date;
  };
  /** Số lượng khách */
  guestCount?: number;
  /** Mã booking (BKxxxx) */
  bookingCode?: string;
  /** Tên phòng nếu được đề cập */
  roomName?: string;
  /** Ngân sách (VND) */
  budget?: number;
  /** Mục đích: cặp đôi, gia đình, công tác, luxury, du lịch */
  purpose?: string;
  /** User xác nhận (có, đồng ý, ok, yes) */
  isConfirmation: boolean;
  /** User từ chối (không, thôi, cancel, no) */
  isNegation: boolean;
  /** Số đơn giản (dùng để chọn phòng theo số thứ tự) */
  simpleNumber?: number;
}

/**
 * EntityExtractorService — Extract entities từ tin nhắn người dùng.
 *
 * Các entity được extract:
 * - Ngày (dùng DateParserService)
 * - Số khách
 * - Mã booking
 * - Ngân sách
 * - Mục đích
 * - Xác nhận / từ chối
 */
@Injectable()
export class EntityExtractorService {
  constructor(private readonly dateParser: DateParserService) {}

  /**
   * Extract tất cả entities từ một tin nhắn
   */
  extract(message: string): ExtractedEntities {
    const msg = message.trim();

    return {
      dates: this.extractDates(msg),
      guestCount: this.extractGuestCount(msg),
      bookingCode: this.extractBookingCode(msg),
      roomName: this.extractRoomName(msg),
      budget: this.extractBudget(msg),
      purpose: this.extractPurpose(msg),
      isConfirmation: this.isConfirmation(msg),
      isNegation: this.isNegation(msg),
      simpleNumber: this.extractSimpleNumber(msg),
    };
  }

  // ─── Date extraction ──────────────────────────────────────────────────────────

  private extractDates(message: string): { checkIn?: Date; checkOut?: Date } {
    const result = this.dateParser.parseDateRange(message);
    return {
      checkIn: result.checkIn || undefined,
      checkOut: result.checkOut || undefined,
    };
  }

  // ─── Guest count ──────────────────────────────────────────────────────────────

  extractGuestCount(message: string): number | undefined {
    // "2 người", "3 khách", "2 adult", "4 guest"
    const withUnit = message.match(/(\d+)\s*(người|khách|người lớn|adult|guest)/i);
    if (withUnit) {
      const n = parseInt(withUnit[1]);
      return n >= 1 && n <= 20 ? n : undefined;
    }
    return undefined;
  }

  // ─── Booking code ─────────────────────────────────────────────────────────────

  extractBookingCode(message: string): string | undefined {
    const match = message.match(/BK\d{4,}/i);
    return match ? match[0].toUpperCase() : undefined;
  }

  // ─── Room name ────────────────────────────────────────────────────────────────

  private extractRoomName(message: string): string | undefined {
    const msg = message.toLowerCase();
    // Phổ biến: Deluxe, VIP, Suite, Standard, Superior, Junior Suite
    const roomTypes = ['deluxe', 'vip', 'suite', 'junior suite', 'standard', 'superior', 'executive'];
    for (const type of roomTypes) {
      if (msg.includes(type)) {
        return type.charAt(0).toUpperCase() + type.slice(1);
      }
    }
    return undefined;
  }

  // ─── Budget ───────────────────────────────────────────────────────────────────

  extractBudget(message: string): number | undefined {
    // "2 triệu", "2.000.000", "2tr", "1500k", "500 nghìn"
    const match = message.match(/(\d[\d.,]*)\s*(triệu|tr|nghìn|k|vnd|đồng)/i);
    if (!match) return undefined;

    let val = parseFloat(match[1].replace(/[.,]/g, ''));
    const unit = match[2].toLowerCase();

    if (unit === 'triệu' || unit === 'tr') val *= 1_000_000;
    else if (unit === 'nghìn' || unit === 'k') val *= 1_000;

    return val > 0 ? val : undefined;
  }

  // ─── Purpose ──────────────────────────────────────────────────────────────────

  extractPurpose(message: string): string | undefined {
    const msg = message.toLowerCase();

    if (msg.includes('gia đình') || msg.includes('family') || msg.includes('trẻ em') || msg.includes('bé')) {
      return 'gia đình';
    }
    if (
      msg.includes('đôi') ||
      msg.includes('couple') ||
      msg.includes('vợ chồng') ||
      msg.includes('bạn gái') ||
      msg.includes('bạn trai') ||
      msg.includes('honeymoon') ||
      msg.includes('tuần trăng mật')
    ) {
      return 'cặp đôi';
    }
    if (msg.includes('công tác') || msg.includes('business') || msg.includes('làm việc') || msg.includes('hội nghị')) {
      return 'công tác';
    }
    if (
      msg.includes('luxury') ||
      msg.includes('sang trọng') ||
      msg.includes('vip') ||
      msg.includes('cao cấp') ||
      msg.includes('premium')
    ) {
      return 'luxury';
    }
    if (msg.includes('du lịch') || msg.includes('vacation') || msg.includes('nghỉ dưỡng') || msg.includes('nghỉ ngơi')) {
      return 'du lịch';
    }

    return undefined;
  }

  // ─── Confirmation / Negation ──────────────────────────────────────────────────

  isConfirmation(message: string): boolean {
    const msg = message.toLowerCase().trim();
    return (
      msg === 'có' ||
      msg === 'ok' ||
      msg === 'yes' ||
      msg === 'đồng ý' ||
      msg === 'xác nhận' ||
      msg.startsWith('có,') ||
      msg.startsWith('ok,') ||
      msg.includes('đồng ý') ||
      msg.includes('xác nhận') ||
      msg.includes('muốn đặt') ||
      msg.includes('chốt') ||
      msg.includes('đặt luôn')
    );
  }

  isNegation(message: string): boolean {
    const msg = message.toLowerCase().trim();
    return (
      msg === 'không' ||
      msg === 'thôi' ||
      msg === 'no' ||
      msg === 'n' ||
      msg === 'cancel' ||
      msg.startsWith('không,') ||
      msg.includes('không muốn') ||
      msg.includes('thôi không') ||
      msg.includes('bỏ qua') ||
      msg.includes('hủy bỏ')
    );
  }

  // ─── Simple number (chọn phòng theo thứ tự) ───────────────────────────────────

  extractSimpleNumber(message: string): number | undefined {
    const trimmed = message.trim();
    // Chỉ là số thuần (1, 2, 3)
    if (/^\d{1,2}$/.test(trimmed)) {
      const n = parseInt(trimmed);
      return n >= 1 ? n : undefined;
    }
    // "Phòng số 1", "lựa chọn 2"
    const withLabel = trimmed.match(/(?:phòng số|lựa chọn|số)\s*(\d+)/i);
    if (withLabel) return parseInt(withLabel[1]);
    return undefined;
  }
}
