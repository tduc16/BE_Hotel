import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import { ChatSession } from './entities/chat-session.entity';
import { ChatMessage, ChatMessageRole } from './entities/chat-message.entity';
import { SendMessageDto } from './dto/send-message.dto';
import { GeminiService, ChatIntent, ChatMessage as GeminiMsg } from './gemini.service';
import { RoomTools } from './tools/room.tools';
import { ServiceTools } from './tools/service.tools';
import { BookingTools } from './tools/booking.tools';

export interface ProcessMessageResult {
  success: boolean;
  reply: string;
  intent: ChatIntent;
  suggestions: string[];
  sessionId: string;
}

interface CustomerContext {
  id?: string;
  name?: string;
  email?: string;
}

@Injectable()
export class ChatbotService {
  private readonly logger = new Logger(ChatbotService.name);

  constructor(
    @InjectRepository(ChatSession)
    private readonly sessionRepo: Repository<ChatSession>,
    @InjectRepository(ChatMessage)
    private readonly messageRepo: Repository<ChatMessage>,
    private readonly geminiService: GeminiService,
    private readonly roomTools: RoomTools,
    private readonly serviceTools: ServiceTools,
    private readonly bookingTools: BookingTools,
  ) { }

  async processMessage(
    dto: SendMessageDto,
    customer?: CustomerContext | null,
  ): Promise<ProcessMessageResult> {
    const { message, sessionId: inputSessionId } = dto;

    // 1. Lấy hoặc tạo session
    const session = await this.getOrCreateSession(inputSessionId, customer?.id);

    // 2. Load lịch sử hội thoại (10 tin gần nhất)
    const history = await this.getHistory(session.session_id);

    // 3. Detect intent để gọi đúng tool
    const intent = this.geminiService.detectIntent(message, session.context || {});
    this.logger.log(`[ChatbotService] Session=${session.session_id} | Intent=${intent} | Customer=${customer?.name || 'guest'}`);

    // 4. Gọi tool lấy dữ liệu thực từ database
    let toolData = '';
    let updatedContext = { ...session.context };

    try {
      toolData = await this.callTool(intent, message, updatedContext, customer);
    } catch (err) {
      this.logger.warn('[ChatbotService] Tool call failed, continuing without data:', err);
      toolData = '';
    }

    // 5. Cập nhật context từ message
    updatedContext = this.extractContextFromMessage(message, updatedContext, intent);

    // 6. Gọi Gemini để tạo reply tự nhiên
    const geminiResponse = await this.geminiService.chat(
      message,
      history,
      toolData,
      customer?.name || null,
    );

    // 7. Lưu messages vào database (bất đồng bộ, không block response)
    this.saveMessages(session.session_id, message, geminiResponse.text, intent)
      .catch((err) =>
        this.logger.error('[ChatbotService] Lỗi lưu message:', err),
      );

    // 8. Cập nhật context của session
    this.updateSessionContext(session, updatedContext).catch((err) =>
      this.logger.error('[ChatbotService] Lỗi update session context:', err),
    );

    return {
      success: true,
      reply: geminiResponse.text,
      intent,
      suggestions: geminiResponse.suggestions,
      sessionId: session.session_id,
    };
  }

  // ─── Tool Dispatcher ────────────────────────────────────────────────────────

  private async callTool(
    intent: ChatIntent,
    message: string,
    context: Record<string, any>,
    customer?: CustomerContext | null,
  ): Promise<string> {
    switch (intent) {
      case 'CHECK_ROOM_AVAILABILITY': {
        const checkIn = context.checkIn || this.extractDate(message, 'checkIn');
        const checkOut = context.checkOut || this.extractDate(message, 'checkOut');

        if (checkIn && checkOut) {
          return await this.roomTools.checkAvailability(checkIn, checkOut);
        }
        // Chưa đủ ngày — lấy danh sách phòng trước
        return await this.roomTools.getAllRoomCategories();
      }

      case 'ROOM_PRICE':
        return await this.roomTools.getAllRoomCategories();

      case 'ROOM_RECOMMENDATION': {
        const guests = context.guestCount || this.extractGuestCount(message) || 1;
        const budget = context.budget || this.extractBudget(message) || null;
        const purpose = context.purpose || this.extractPurpose(message) || 'du lịch';
        return await this.roomTools.recommendRoom(guests, budget, purpose);
      }

      case 'SERVICE_RECOMMENDATION':
        return await this.serviceTools.getAllServices();

      case 'BOOK_ROOM': {
        const guests = context.guestCount || this.extractGuestCount(message);
        const checkIn = context.checkIn || this.extractDate(message, 'checkIn');
        const checkOut = context.checkOut || this.extractDate(message, 'checkOut');
        return await this.bookingTools.assistBooking({
          checkIn,
          checkOut,
          guestCount: guests,
          customerName: customer?.name,
          email: customer?.email,
        });
      }

      case 'BOOKING_LOOKUP': {
        const code = this.extractBookingCode(message);
        if (code) {
          return await this.bookingTools.lookupBooking(code);
        }
        return 'Quý khách vui lòng cung cấp **mã đặt phòng** (dạng BKYYYYxxxx) để tôi tra cứu.';
      }

      case 'BOOKING_CANCEL': {
        const code = this.extractBookingCode(message);
        if (code) {
          const info = await this.bookingTools.lookupBooking(code);
          return `${info}\n\nNếu Quý khách muốn hủy booking này, vui lòng liên hệ lễ tân hoặc sử dụng trang quản lý booking trên website.`;
        }
        return 'Để hủy booking, Quý khách vui lòng cung cấp **mã đặt phòng**.';
      }

      case 'HOTEL_INFORMATION':
        return this.getHotelInfo();

      case 'CONTACT_SUPPORT':
        return this.getContactInfo();

      default:
        // GENERAL_CHAT — không cần tool data cụ thể, cung cấp overview
        return await this.roomTools.getAllRoomCategories();
    }
  }

  // ─── Context Extraction ──────────────────────────────────────────────────────

  private extractContextFromMessage(
    message: string,
    context: Record<string, any>,
    intent: ChatIntent,
  ): Record<string, any> {
    const updated: Record<string, any> = { ...context, intent };

    const guestCount = this.extractGuestCount(message);
    if (guestCount) updated['guestCount'] = guestCount;

    const checkIn = this.extractDate(message, 'checkIn');
    if (checkIn) updated['checkIn'] = checkIn;

    const checkOut = this.extractDate(message, 'checkOut');
    if (checkOut) updated['checkOut'] = checkOut;

    const budget = this.extractBudget(message);
    if (budget) updated['budget'] = budget;

    const purpose = this.extractPurpose(message);
    if (purpose) updated['purpose'] = purpose;

    return updated;
  }

  private extractGuestCount(message: string): number | null {
    const match = message.match(/(\d+)\s*(người|khách|người lớn|adult|guest)/i);
    return match ? parseInt(match[1]) : null;
  }

  private extractDate(message: string, type: 'checkIn' | 'checkOut'): string | null {
    // Match dạng: 2026-07-01, 01/07/2026, 1 tháng 7
    const isoMatch = message.match(/\d{4}-\d{2}-\d{2}/g);
    const vnMatch = message.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/g);

    const dates: string[] = [];

    if (isoMatch) {
      dates.push(...isoMatch.map((d) => d));
    } else if (vnMatch) {
      dates.push(
        ...vnMatch.map((d) => {
          const parts = d.split(/[\/\-]/);
          return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
        }),
      );
    }

    // "tuần tới" / "cuối tuần" keywords
    const now = new Date();
    if (dates.length === 0) {
      if (message.includes('tuần tới') || message.includes('next week')) {
        const nextMonday = new Date(now);
        nextMonday.setDate(now.getDate() + (7 - now.getDay() + 1) % 7 + 1);
        const nextFriday = new Date(nextMonday);
        nextFriday.setDate(nextMonday.getDate() + 4);
        if (type === 'checkIn') return nextMonday.toISOString().split('T')[0];
        if (type === 'checkOut') return nextFriday.toISOString().split('T')[0];
      }
      if (message.includes('cuối tuần') || message.includes('weekend')) {
        const dayOfWeek = now.getDay();
        const daysToSaturday = (6 - dayOfWeek + 7) % 7 || 7;
        const saturday = new Date(now);
        saturday.setDate(now.getDate() + daysToSaturday);
        const sunday = new Date(saturday);
        sunday.setDate(saturday.getDate() + 1);
        if (type === 'checkIn') return saturday.toISOString().split('T')[0];
        if (type === 'checkOut') return sunday.toISOString().split('T')[0];
      }
    }

    if (dates.length === 0) return null;
    if (dates.length === 1) return dates[0];
    return type === 'checkIn' ? dates[0] : dates[1];
  }

  private extractBudget(message: string): number | null {
    const match = message.match(/(\d[\d.,]*)\s*(triệu|tr|nghìn|k|vnd|đồng)?/i);
    if (!match) return null;
    let val = parseFloat(match[1].replace(/[.,]/g, ''));
    const unit = (match[2] || '').toLowerCase();
    if (unit.includes('triệu') || unit === 'tr') val *= 1_000_000;
    else if (unit === 'nghìn' || unit === 'k') val *= 1_000;
    return val > 0 ? val : null;
  }

  private extractPurpose(message: string): string | null {
    const msg = message.toLowerCase();
    if (msg.includes('gia đình') || msg.includes('family')) return 'gia đình';
    if (msg.includes('đôi') || msg.includes('couple') || msg.includes('vợ chồng') || msg.includes('bạn gái') || msg.includes('bạn trai')) return 'cặp đôi';
    if (msg.includes('công tác') || msg.includes('business') || msg.includes('làm việc')) return 'công tác';
    if (msg.includes('luxury') || msg.includes('sang trọng') || msg.includes('vip')) return 'luxury';
    if (msg.includes('du lịch') || msg.includes('vacation') || msg.includes('nghỉ dưỡng')) return 'du lịch';
    return null;
  }

  private extractBookingCode(message: string): string | null {
    const match = message.match(/BK\d{4,}/i);
    return match ? match[0].toUpperCase() : null;
  }

  // ─── Static Data ─────────────────────────────────────────────────────────────

  private getHotelInfo(): string {
    return `**Khách sạn Hoàng Minh** — Không gian nghỉ dưỡng tiện nghi và sang trọng.

🕐 **Giờ check-in:** 14:00
🕑 **Giờ check-out:** 12:00
🏊 **Tiện ích chung:** Hồ bơi, Spa, Nhà hàng, Phòng gym
🚗 **Đưa đón sân bay:** Có (đặt trước 24h)
📶 **WiFi:** Miễn phí toàn bộ khách sạn

Quý khách cần hỗ trợ gì thêm?`;
  }

  private getContactInfo(): string {
    return `Để liên hệ với **Khách sạn Hoàng Minh**:

📞 **Lễ tân 24/7:** Liên hệ qua form trên website
📧 **Email:** Sử dụng trang Liên hệ trên website
🌐 **Website:** Truy cập trang Liên hệ để gửi yêu cầu

Lễ tân của chúng tôi sẵn sàng hỗ trợ Quý khách 24/7.`;
  }

  // ─── Session & History ───────────────────────────────────────────────────────

  private async getOrCreateSession(
    sessionId: string | undefined,
    customerId?: string,
  ): Promise<ChatSession> {
    if (sessionId) {
      const existing = await this.sessionRepo.findOne({
        where: { session_id: sessionId },
      });
      if (existing) {
        // Cập nhật customer_id nếu mới đăng nhập
        if (customerId && !existing.customer_id) {
          existing.customer_id = customerId;
          await this.sessionRepo.save(existing);
        }
        return existing;
      }
    }

    const newSessionId = sessionId || uuidv4();
    const session = this.sessionRepo.create({
      session_id: newSessionId,
      customer_id: customerId || null,
      context: {},
    });
    return await this.sessionRepo.save(session);
  }

  private async getHistory(sessionId: string): Promise<GeminiMsg[]> {
    const messages = await this.messageRepo.find({
      where: { session_id: sessionId },
      order: { created_at: 'ASC' },
      take: 20,
    });

    // Chuyển sang format Gemini yêu cầu
    return messages.map((msg) => ({
      role: msg.role === ChatMessageRole.USER ? 'user' : 'model',
      parts: [{ text: msg.content }],
    }));
  }

  private async saveMessages(
    sessionId: string,
    userMessage: string,
    botReply: string,
    intent: ChatIntent,
  ): Promise<void> {
    await this.messageRepo.save([
      this.messageRepo.create({
        session_id: sessionId,
        role: ChatMessageRole.USER,
        content: userMessage,
        intent,
      }),
      this.messageRepo.create({
        session_id: sessionId,
        role: ChatMessageRole.ASSISTANT,
        content: botReply,
        intent,
      }),
    ]);
  }

  private async updateSessionContext(
    session: ChatSession,
    context: Record<string, any>,
  ): Promise<void> {
    session.context = context;
    await this.sessionRepo.save(session);
  }
}
