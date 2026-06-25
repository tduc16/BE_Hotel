import { Injectable } from '@nestjs/common';
import { ChatSessionContext } from '../interfaces/chat-session-context.interface';

export type ChatIntent =
  | 'CHECK_ROOM_AVAILABILITY'
  | 'ROOM_PRICE'
  | 'ROOM_RECOMMENDATION'
  | 'SERVICE_RECOMMENDATION'
  | 'BOOKING_CONSULTATION'
  | 'BOOKING_LOOKUP'
  | 'BOOKING_GUIDANCE'
  | 'HOTEL_INFORMATION'
  | 'CONTACT_SUPPORT'
  | 'GENERAL_CHAT';

export interface IntentResult {
  intent: ChatIntent;
  /** Mức độ tin cậy 0–1 */
  confidence: number;
  /** Lý do detect (debug) */
  reason: string;
}

/**
 * IntentService — Detect intent từ tin nhắn + ngữ cảnh hiện tại.
 *
 * Nguyên tắc:
 * 1. Nếu đang có flow active (state != IDLE), ưu tiên tiếp tục flow đó.
 * 2. Dùng keyword matching có trọng số.
 * 3. KHÔNG gọi Gemini — hoàn toàn deterministic.
 */
@Injectable()
export class IntentService {
  /**
   * Detect intent từ message + context hiện tại
   */
  detect(message: string, context: ChatSessionContext): IntentResult {
    const msg = message.toLowerCase().trim();
    const currentIntent = context.intent as ChatIntent | undefined;
    const currentState = context.state;

    // ─── 1. Context-aware: tiếp tục flow đang chạy ────────────────────────────
    if (currentState && currentState !== 'IDLE' && currentState !== 'COMPLETED') {
      // Đang chờ ngày → nếu có ngày trong message, giữ intent cũ
      if (
        (currentState === 'ASK_CHECKIN' || currentState === 'ASK_CHECKOUT' || currentState === 'WAITING_DATES') &&
        this.hasDatePattern(msg)
      ) {
        return {
          intent: currentIntent || 'BOOKING_CONSULTATION',
          confidence: 0.95,
          reason: `Continuing ${currentState} flow — date detected`,
        };
      }

      // Đang chờ số khách → nếu có số, giữ intent BOOKING_CONSULTATION
      if ((currentState === 'ASK_GUEST_COUNT' || currentState === 'WAITING_GUEST_COUNT') && this.hasGuestCount(msg)) {
        return {
          intent: 'BOOKING_CONSULTATION',
          confidence: 0.95,
          reason: 'Continuing BOOKING_CONSULTATION flow — guest count detected',
        };
      }

      // Đang hiển thị phòng trống → nếu có số khách, tiếp tục sang tư vấn đặt phòng
      if (currentState === 'SHOW_ROOMS' && this.hasGuestCount(msg)) {
        return {
          intent: 'BOOKING_CONSULTATION',
          confidence: 0.9,
          reason: 'Adding guest count while showing rooms',
        };
      }

      // Đang chờ chọn phòng → giữ intent BOOKING_CONSULTATION để xử lý tư vấn chọn phòng
      if (currentState === 'WAIT_ROOM_SELECTION' || currentState === 'SHOWING_RECOMMENDATIONS') {
        return {
          intent: 'BOOKING_CONSULTATION',
          confidence: 0.95,
          reason: 'Continuing BOOKING_CONSULTATION flow — room selection expected',
        };
      }

      // Đang trong luồng tư vấn, nếu người dùng đồng ý/xác nhận
      if (['CONSULTING', 'SHOWING_RECOMMENDATIONS', 'GUIDE_TO_BOOKING_PAGE'].includes(currentState)) {
        if (
          this.isConfirmation(msg) ||
          msg.includes('đặt luôn') ||
          msg.includes('book luôn') ||
          msg.includes('đặt đi')
        ) {
          return {
            intent: 'BOOKING_CONSULTATION',
            confidence: 0.95,
            reason: 'User confirmed in consultation flow',
          };
        }
      }

      // Đang chờ mã booking để hủy / tra cứu
      if (currentState === 'WAITING_BOOKING_CODE' && this.hasBookingCode(msg)) {
        return {
          intent: currentIntent || 'BOOKING_LOOKUP',
          confidence: 0.95,
          reason: 'Continuing booking lookup — code detected',
        };
      }
    }

    // ─── 2. Fresh intent detection ────────────────────────────────────────────

    // BOOKING_LOOKUP — check mã booking trước (BKxxxx rất đặc trưng)
    if (this.hasBookingCode(msg)) {
      if (msg.includes('hủy') || msg.includes('cancel')) {
        return { intent: 'BOOKING_GUIDANCE', confidence: 0.95, reason: 'BK code + cancel keyword' };
      }
      return { intent: 'BOOKING_LOOKUP', confidence: 0.95, reason: 'BK code detected' };
    }

    // BOOKING_LOOKUP
    if (
      msg.includes('tra cứu') ||
      msg.includes('lookup') ||
      msg.includes('mã đặt') ||
      msg.includes('booking code') ||
      msg.includes('xem booking') ||
      msg.includes('trạng thái booking') ||
      msg.includes('kiểm tra booking')
    ) {
      return { intent: 'BOOKING_LOOKUP', confidence: 0.9, reason: 'Lookup keywords' };
    }

    // BOOKING_GUIDANCE
    if (
      msg.includes('hủy đặt') ||
      msg.includes('hủy booking') ||
      msg.includes('cancel booking') ||
      (msg.includes('hủy') && msg.includes('phòng'))
    ) {
      return { intent: 'BOOKING_GUIDANCE', confidence: 0.9, reason: 'Cancel booking keywords' };
    }

    // CHECK_ROOM_AVAILABILITY
    if (
      msg.includes('phòng trống') ||
      msg.includes('còn phòng') ||
      msg.includes('phòng nào trống') ||
      (msg.includes('từ') && this.hasDatePattern(msg)) ||
      (msg.includes('đến') && this.hasDatePattern(msg)) ||
      (msg.includes('ngày') && this.hasDatePattern(msg))
    ) {
      return { intent: 'CHECK_ROOM_AVAILABILITY', confidence: 0.9, reason: 'Availability keywords' };
    }

    // BOOKING_CONSULTATION
    if (
      msg.includes('đặt phòng') ||
      msg.includes('book phòng') ||
      msg.includes('thuê phòng') ||
      msg.includes('reserve phòng') ||
      msg.includes('muốn ở') ||
      msg.includes('muốn lưu trú') ||
      (msg.includes('đặt') && (msg.includes('check in') || msg.includes('check-in') || msg.includes('nhận phòng')))
    ) {
      return { intent: 'BOOKING_CONSULTATION', confidence: 0.9, reason: 'Book room keywords' };
    }

    // ROOM_PRICE
    if (
      msg.includes('giá phòng') ||
      msg.includes('bao nhiêu tiền') ||
      msg.includes('chi phí') ||
      msg.includes('price') ||
      msg.includes('cost') ||
      (msg.includes('giá') && (msg.includes('phòng') || msg.includes('đêm') || msg.includes('đêm')))
    ) {
      return { intent: 'ROOM_PRICE', confidence: 0.85, reason: 'Price keywords' };
    }

    // SERVICE_RECOMMENDATION
    if (
      msg.includes('dịch vụ') ||
      msg.includes('spa') ||
      msg.includes('nhà hàng') ||
      msg.includes('restaurant') ||
      msg.includes('gym') ||
      msg.includes('hồ bơi') ||
      msg.includes('bể bơi') ||
      msg.includes('pool') ||
      msg.includes('đưa đón sân bay') ||
      msg.includes('airport transfer')
    ) {
      return { intent: 'SERVICE_RECOMMENDATION', confidence: 0.85, reason: 'Service keywords' };
    }

    // ROOM_RECOMMENDATION
    if (
      msg.includes('gợi ý phòng') ||
      msg.includes('recommend phòng') ||
      msg.includes('phòng phù hợp') ||
      msg.includes('phòng nào tốt') ||
      msg.includes('loại phòng nào') ||
      msg.includes('nên chọn phòng')
    ) {
      return { intent: 'ROOM_RECOMMENDATION', confidence: 0.85, reason: 'Recommendation keywords' };
    }

    // HOTEL_INFORMATION
    if (
      msg.includes('thông tin khách sạn') ||
      msg.includes('địa chỉ') ||
      msg.includes('check-in lúc') ||
      msg.includes('giờ check') ||
      msg.includes('chính sách') ||
      msg.includes('quy định') ||
      msg.includes('tiện ích khách sạn') ||
      msg.includes('wifi') ||
      msg.includes('parking') ||
      msg.includes('bãi đỗ xe')
    ) {
      return { intent: 'HOTEL_INFORMATION', confidence: 0.8, reason: 'Hotel info keywords' };
    }

    // CONTACT_SUPPORT
    if (
      msg.includes('liên hệ') ||
      msg.includes('số điện thoại') ||
      msg.includes('hotline') ||
      msg.includes('gọi cho') ||
      msg.includes('gặp nhân viên') ||
      (msg.includes('hỗ trợ') && msg.includes('con người'))
    ) {
      return { intent: 'CONTACT_SUPPORT', confidence: 0.8, reason: 'Contact keywords' };
    }

    // GENERAL_CHAT — fallback
    return { intent: 'GENERAL_CHAT', confidence: 0.5, reason: 'No specific intent detected' };
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────────

  private hasDatePattern(msg: string): boolean {
    return (
      /\d{1,2}[\/\-]\d{1,2}/.test(msg) ||
      /\d{4}-\d{2}-\d{2}/.test(msg) ||
      /\d{1,2}\s*tháng\s*\d{1,2}/.test(msg) ||
      msg.includes('ngày mai') ||
      msg.includes('cuối tuần') ||
      msg.includes('tuần tới') ||
      msg.includes('tuần sau')
    );
  }

  private hasGuestCount(msg: string): boolean {
    return /\d+\s*(người|khách|adult|guest)/i.test(msg) || /^\d+$/.test(msg.trim());
  }

  private hasBookingCode(msg: string): boolean {
    return /bk\d{4,}/i.test(msg);
  }

  private isNegation(msg: string): boolean {
    return (
      msg.includes('không') ||
      msg.includes('thôi') ||
      msg.includes('cancel') ||
      msg.includes('no') ||
      msg === 'n'
    );
  }

  private isConfirmation(msg: string): boolean {
    return (
      msg.includes('đồng ý') ||
      msg.includes('xác nhận') ||
      msg.includes('ok') ||
      msg.includes('đúng vậy') ||
      msg.includes('đặt luôn') ||
      msg.includes('yes') ||
      msg.includes('yup') ||
      msg === 'y'
    );
  }
}
