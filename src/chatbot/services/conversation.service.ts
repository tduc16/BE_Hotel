import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import { ChatSession } from '../entities/chat-session.entity';
import { ChatMessage, ChatMessageRole } from '../entities/chat-message.entity';
import {
  ChatSessionContext,
  mergeContext,
} from '../interfaces/chat-session-context.interface';

export interface GeminiMsg {
  role: 'user' | 'model';
  parts: [{ text: string }];
}

/** Số tin nhắn lưu trong history (mỗi turn = 2 messages) */
const HISTORY_LIMIT = 20;

/**
 * ConversationService — Quản lý session, history, context.
 *
 * Tách khỏi ChatbotService để tuân theo SRP.
 * Đây là single source of truth cho state hội thoại.
 */
@Injectable()
export class ConversationService {
  private readonly logger = new Logger(ConversationService.name);

  constructor(
    @InjectRepository(ChatSession)
    private readonly sessionRepo: Repository<ChatSession>,
    @InjectRepository(ChatMessage)
    private readonly messageRepo: Repository<ChatMessage>,
  ) {}

  /**
   * Load hoặc tạo mới session
   */
  async getOrCreateSession(
    sessionId: string | undefined,
    customerId?: string,
  ): Promise<ChatSession> {
    if (sessionId) {
      const existing = await this.sessionRepo.findOne({
        where: { session_id: sessionId },
      });

      if (existing) {
        // Gắn customerId nếu session guest vừa đăng nhập
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

    const saved = await this.sessionRepo.save(session);
    this.logger.log(`[ConversationService] New session created: ${newSessionId}`);
    return saved;
  }

  /**
   * Lấy context hiện tại của session
   */
  getContext(session: ChatSession): ChatSessionContext {
    return (session.context as ChatSessionContext) || {};
  }

  /**
   * Merge partial context vào session và lưu xuống DB (async, không block)
   */
  async mergeAndSaveContext(
    session: ChatSession,
    partial: Partial<ChatSessionContext>,
  ): Promise<ChatSessionContext> {
    const current = this.getContext(session);
    const merged = mergeContext(current, partial);

    session.context = merged as Record<string, any>;

    try {
      await this.sessionRepo.save(session);
    } catch (err) {
      this.logger.error('[ConversationService] Lỗi lưu context:', err);
    }

    return merged;
  }

  /**
   * Lấy lịch sử hội thoại dạng Gemini format (user/model alternating)
   * Lấy tối đa HISTORY_LIMIT tin nhắn gần nhất
   */
  async getHistory(sessionId: string): Promise<GeminiMsg[]> {
    const messages = await this.messageRepo.find({
      where: { session_id: sessionId },
      order: { created_at: 'ASC' },
      take: HISTORY_LIMIT,
    });

    return messages.map((msg) => ({
      role: msg.role === ChatMessageRole.USER ? 'user' : 'model',
      parts: [{ text: msg.content }],
    }));
  }

  /**
   * Kiểm tra đây có phải tin nhắn đầu tiên của session không
   * (để AI chỉ chào 1 lần)
   */
  async isFirstMessage(sessionId: string): Promise<boolean> {
    const count = await this.messageRepo.count({
      where: { session_id: sessionId },
    });
    return count === 0;
  }

  /**
   * Lưu cặp message user + bot vào DB (bất đồng bộ)
   */
  async saveMessages(
    sessionId: string,
    userMessage: string,
    botReply: string,
    intent: string,
  ): Promise<void> {
    const toSave = [
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
    ];

    try {
      await this.messageRepo.save(toSave);
    } catch (err) {
      this.logger.error('[ConversationService] Lỗi lưu messages:', err);
    }
  }

  /**
   * Xóa context để bắt đầu lại (reset flow)
   */
  async resetFlow(session: ChatSession): Promise<void> {
    const ctx = this.getContext(session);
    // Giữ lại customerId và isGreeted, reset các field flow
    const reset: ChatSessionContext = {
      customerId: ctx.customerId,
      isGreeted: ctx.isGreeted,
      messageCount: ctx.messageCount,
      state: 'IDLE',
      intent: undefined,
      checkInDate: undefined,
      checkOutDate: undefined,
      guestCount: undefined,
      selectedRoomId: undefined,
      selectedRoomType: undefined,
      bookingCode: undefined,
      availableRoomsCache: undefined,
    };

    session.context = reset as Record<string, any>;
    await this.sessionRepo.save(session);
  }
}
