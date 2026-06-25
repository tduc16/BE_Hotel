/**
 * Conversation State Machine
 *
 * Định nghĩa các state và transition cho từng intent.
 * Backend xử lý logic, Gemini chỉ format câu trả lời.
 */

export type ConversationIntent =
  | 'CHECK_ROOM_AVAILABILITY'
  | 'BOOK_ROOM'
  | 'ROOM_RECOMMENDATION'
  | 'BOOKING_LOOKUP'
  | 'BOOKING_CANCEL'
  | 'ROOM_PRICE'
  | 'SERVICE_RECOMMENDATION'
  | 'HOTEL_INFORMATION'
  | 'CONTACT_SUPPORT'
  | 'GENERAL_CHAT';

export type ConversationState =
  // CHECK_ROOM_AVAILABILITY states
  | 'WAITING_DATE'           // Đang chờ ngày check-in / check-out
  | 'SEARCHING_ROOM'         // Đang query DB
  | 'SHOWING_ROOMS'          // Đã hiển thị phòng, chờ chọn

  // BOOK_ROOM states
  | 'WAITING_CHECKIN'        // Chờ ngày check-in
  | 'WAITING_CHECKOUT'       // Chờ ngày check-out
  | 'WAITING_GUEST_COUNT'    // Chờ số khách
  | 'WAITING_ROOM_CHOICE'    // Chờ chọn loại phòng
  | 'WAITING_CONFIRM'        // Chờ xác nhận đặt phòng
  | 'BOOKING_CREATED'        // Đã tạo booking thành công

  // Lookup/Cancel states
  | 'WAITING_BOOKING_CODE'   // Chờ mã booking
  | 'WAITING_CANCEL_CONFIRM' // Chờ xác nhận hủy

  // Generic
  | 'IDLE'                   // Trạng thái rảnh, không có flow đang mở
  | 'COMPLETED';             // Flow đã hoàn thành

export interface ConversationContext {
  // Flow state
  intent?: ConversationIntent;
  state?: ConversationState;

  // Booking/Availability data
  checkIn?: string;          // YYYY-MM-DD
  checkOut?: string;         // YYYY-MM-DD
  guestCount?: number;
  selectedRoomType?: string;
  selectedCategoryId?: string;
  budget?: number;
  purpose?: string;

  // Booking lookup/cancel
  bookingCode?: string;

  // Customer info
  customerName?: string;
  customerEmail?: string;
  customerPhone?: string;

  // Metadata
  lastUpdated?: string;
  [key: string]: any;
}

/**
 * Kết quả sau khi xử lý message qua State Machine
 */
export interface StateMachineResult {
  /** Dữ liệu thực từ DB để truyền cho Gemini format */
  toolData: string;
  /** Context đã cập nhật */
  updatedContext: ConversationContext;
  /** Prompt instruction bổ sung cho Gemini */
  systemHint?: string;
  /** Nếu true: đây là câu trả lời thẳng, không cần gọi Gemini */
  bypassGemini?: boolean;
  /** Câu trả lời thẳng (khi bypassGemini=true) */
  directReply?: string;
}

/**
 * Kiểm tra xem một state có thuộc về một intent cụ thể không
 */
export function isStateForIntent(
  state: ConversationState | undefined,
  intent: ConversationIntent,
): boolean {
  if (!state || state === 'IDLE' || state === 'COMPLETED') return false;

  switch (intent) {
    case 'CHECK_ROOM_AVAILABILITY':
      return ['WAITING_DATE', 'SEARCHING_ROOM', 'SHOWING_ROOMS'].includes(state);
    case 'BOOK_ROOM':
      return [
        'WAITING_CHECKIN',
        'WAITING_CHECKOUT',
        'WAITING_GUEST_COUNT',
        'WAITING_ROOM_CHOICE',
        'WAITING_CONFIRM',
        'BOOKING_CREATED',
      ].includes(state);
    case 'BOOKING_LOOKUP':
      return ['WAITING_BOOKING_CODE'].includes(state);
    case 'BOOKING_CANCEL':
      return ['WAITING_BOOKING_CODE', 'WAITING_CANCEL_CONFIRM'].includes(state);
    default:
      return false;
  }
}

/**
 * Kiểm tra xem context có một flow đang active không
 */
export function hasActiveFlow(context: ConversationContext): boolean {
  return (
    !!context.state &&
    context.state !== 'IDLE' &&
    context.state !== 'COMPLETED'
  );
}
