/**
 * ChatSessionContext — ngữ cảnh hội thoại được lưu trong DB (ChatSession.context)
 *
 * Được merge sau mỗi tin nhắn, không bao giờ mất data cũ.
 */
export interface ChatSessionContext {
  // ─── State Machine ────────────────────────────────────────────────────────────
  intent?: string;         // Intent hiện tại (CHECK_ROOM_AVAILABILITY, BOOK_ROOM...)
  state?: string;          // State machine step (ASK_CHECKIN, ASK_CHECKOUT...)

  // ─── Booking Data ─────────────────────────────────────────────────────────────
  checkInDate?: string;    // YYYY-MM-DD
  checkOutDate?: string;   // YYYY-MM-DD
  guestCount?: number;
  selectedRoomId?: string;
  selectedRoomType?: string;
  selectedCategoryId?: string;

  // ─── Booking Draft (Yêu cầu số 4) ──────────────────────────────────────────────
  bookingDraft?: {
    checkInDate?: string;
    checkOutDate?: string;
    guestCount?: number;
    selectedCategoryId?: string;
    selectedCategoryName?: string;
    selectedRoomId?: string;
    selectedRoomName?: string;
    selectedRoomNumber?: string;
    selectedCapacity?: number;
    pricePerNight?: number;
    totalPrice?: number;
    totalAmount?: number;
  };

  // ─── Lookup / Cancel ──────────────────────────────────────────────────────────
  bookingCode?: string;

  // ─── Preferences ─────────────────────────────────────────────────────────────
  budget?: number;         // VND
  purpose?: string;        // "cặp đôi", "gia đình", "công tác", "luxury", "du lịch"

  // ─── Customer ────────────────────────────────────────────────────────────────
  customerId?: string;

  // ─── UX Meta ─────────────────────────────────────────────────────────────────
  isGreeted?: boolean;     // Đã gửi lời chào chưa — tránh lặp lại
  messageCount?: number;   // Đếm số tin nhắn trong session
  lastUpdated?: string;    // ISO timestamp

  // ─── Cache (không persist lâu dài) ───────────────────────────────────────────
  availableRoomsCache?: AvailableRoomCacheItem[];

  // Index signature để tương thích với Record<string, any> của TypeORM jsonb
  [key: string]: any;
}

export interface AvailableRoomCacheItem {
  roomType: string;
  categoryId: string;
  available: number;
  capacity: number;
  pricePerNight: number;
  totalPrice: number;
  nights: number;
}

/**
 * Merge partial context vào context hiện tại.
 * Không overwrite giá trị cũ bằng undefined/null.
 */
export function mergeContext(
  current: ChatSessionContext,
  partial: Partial<ChatSessionContext>,
): ChatSessionContext {
  const merged = { ...current };

  for (const key of Object.keys(partial) as (keyof ChatSessionContext)[]) {
    const value = partial[key];
    if (value !== undefined && value !== null) {
      (merged as any)[key] = value;
    }
  }

  merged.lastUpdated = new Date().toISOString();
  merged.messageCount = (merged.messageCount || 0) + 1;

  return merged;
}
