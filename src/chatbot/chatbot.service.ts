import { Injectable, Logger } from '@nestjs/common';
import { ChatSession } from './entities/chat-session.entity';
import { SendMessageDto } from './dto/send-message.dto';
import { GeminiService, ChatIntent } from './gemini.service';
import { IntentService } from './services/intent.service';
import { ConversationService } from './services/conversation.service';
import { EntityExtractorService } from './services/entity-extractor.service';
import { ConversationStateMachine } from './state-machine/conversation-state-machine';
import { ChatSessionContext, mergeContext } from './interfaces/chat-session-context.interface';

export interface ProcessMessageResult {
  success: boolean;
  reply: string;
  intent: ChatIntent;
  suggestions: string[];
  sessionId: string;
  /** Context sau khi xử lý (debug) */
  context?: ChatSessionContext;
  actions?: { label: string; url: string; primary?: boolean }[];
}

interface CustomerContext {
  id?: string;
  name?: string;
  email?: string;
  phone?: string;
}

import { ChatbotResponseFormatter } from './services/chatbot-response-formatter.service';

/**
 * ChatbotService — Pure Orchestrator.
 *
 * Không chứa logic nghiệp vụ. Chỉ gọi các service theo thứ tự:
 * 1. ConversationService → session + history + context
 * 2. IntentService → detect intent
 * 3. EntityExtractorService → extract entities (merge vào context)
 * 4. ConversationStateMachine → điều phối flow + fetch data
 * 5. ChatbotResponseFormatter → sinh câu trả lời thô tiếng Việt sạch
 * 6. GeminiService → format/polish câu trả lời tự nhiên
 * 7. ConversationService → lưu messages + update context
 */
@Injectable()
export class ChatbotService {
  private readonly logger = new Logger(ChatbotService.name);

  constructor(
    private readonly conversationService: ConversationService,
    private readonly intentService: IntentService,
    private readonly entityExtractor: EntityExtractorService,
    private readonly stateMachine: ConversationStateMachine,
    private readonly geminiService: GeminiService,
    private readonly chatbotResponseFormatter: ChatbotResponseFormatter,
  ) {}

  async processMessage(
    dto: SendMessageDto,
    customer?: CustomerContext | null,
  ): Promise<ProcessMessageResult> {
    const { message, sessionId: inputSessionId } = dto;
    const startTime = Date.now();

    // ─── Step 1: Session + History + Context ──────────────────────────────────
    const session = await this.conversationService.getOrCreateSession(
      inputSessionId,
      customer?.id,
    );
    const currentContext = this.conversationService.getContext(session);

    // Tự động gán thông tin khách đã đăng nhập vào context (Yêu cầu số 9)
    if (customer) {
      currentContext.customerId = customer.id;
      currentContext.customerName = customer.name;
      currentContext.customerEmail = customer.email;
      currentContext.customerPhone = customer.phone;
    }
    const history = await this.conversationService.getHistory(session.session_id);
    const isFirstMessage = await this.conversationService.isFirstMessage(session.session_id);

    // ─── Step 2: Detect Intent ────────────────────────────────────────────────
    const intentResult = this.intentService.detect(message, currentContext);

    this.logger.log({
      event: 'PROCESS_START',
      sessionId: session.session_id,
      customerId: customer?.id || 'guest',
      customerName: customer?.name || 'guest',
      intent: intentResult.intent,
      intentConfidence: intentResult.confidence,
      intentReason: intentResult.reason,
      currentState: currentContext.state || 'IDLE',
      isFirstMessage,
      message: message.substring(0, 100),
    });

    // ─── Step 3: Extract Entities → Merge vào context ─────────────────────────
    const entities = this.entityExtractor.extract(message);
    const contextWithEntities: ChatSessionContext = this.premergeEntities(currentContext, entities);

    // ─── Step 4: State Machine xử lý flow ────────────────────────────────────
    const smResult = await this.stateMachine.process(
      message,
      intentResult.intent,
      contextWithEntities,
      customer?.name,
    );

    // ─── Step 5: Định dạng câu trả lời thô sạch bằng tiếng Việt trước ─────────
    const formattedResponse = this.chatbotResponseFormatter.format(
      smResult.structuredToolResult || {
        intent: smResult.updatedContext.intent || intentResult.intent,
        state: smResult.updatedContext.state || 'IDLE',
      },
      customer?.name,
    );

    // ─── Step 6: Gọi Gemini làm mượt (try-catch để fallback nếu Gemini lỗi) ───
    const finalIntent = (smResult.updatedContext.intent || intentResult.intent) as ChatIntent;
    let replyText = '';
    let suggestions: string[] = [];

    try {
      const geminiResponse = await this.geminiService.chat(
        message,
        history,
        smResult.toolData,
        customer?.name || null,
        `${smResult.hint || ''}\n\n[FORMATTED RESPONSE]\n${formattedResponse}`,
        intentResult.intent,
        isFirstMessage,
        smResult.updatedContext.state,
      );
      replyText = geminiResponse.text;
      suggestions = geminiResponse.suggestions;
    } catch (err) {
      this.logger.error(
        `[ChatbotService] Lỗi kết nối Gemini API: ${err?.message || err}. Kích hoạt fallback từ backend formatter.`,
      );
      replyText = formattedResponse;
      suggestions = this.geminiService.generateSuggestions(
        finalIntent,
        smResult.updatedContext.state,
      );
    }

    const cleanReply = this.cleanResponse(replyText);

    // ─── Step 7: Update context (merge với state machine result) ──────────────
    const finalContext: ChatSessionContext = mergeContext(smResult.updatedContext, {
      isGreeted: true, // Đánh dấu đã chào
      customerId: customer?.id,
    });

    // ─── Step 8: Persist ─────────────────────────────────────────────────────
    await this.conversationService.saveMessages(
      session.session_id,
      message,
      cleanReply,
      finalIntent,
    );

    await this.conversationService.mergeAndSaveContext(session, finalContext);

    // ─── Log kết quả ──────────────────────────────────────────────────────────
    this.logger.log({
      event: 'PROCESS_DONE',
      sessionId: session.session_id,
      intent: finalIntent,
      newState: finalContext.state || 'IDLE',
      toolDataLength: smResult.toolData.length,
      durationMs: Date.now() - startTime,
    });

    return {
      success: true,
      reply: cleanReply,
      intent: finalIntent,
      suggestions,
      sessionId: session.session_id,
      actions: smResult.actions || [],
    };
  }

  // ─── Private Helpers ──────────────────────────────────────────────────────────

  /**
   * Pre-merge entities rõ ràng vào context trước khi vào State Machine.
   * Chỉ merge những gì đã extract được, không overwrite undefined.
   */
  private premergeEntities(
    context: ChatSessionContext,
    entities: ReturnType<EntityExtractorService['extract']>,
  ): ChatSessionContext {
    const partial: Partial<ChatSessionContext> = {};

    if (entities.guestCount) partial.guestCount = entities.guestCount;
    if (entities.budget) partial.budget = entities.budget;
    if (entities.purpose) partial.purpose = entities.purpose;
    if (entities.bookingCode) partial.bookingCode = entities.bookingCode;

    return mergeContext(context, partial);
  }

  private cleanResponse(text: string): string {
    if (!text) return '';
    return text
      .replace(/\[?DATABASE\]?/gi, '')
      .replace(/\[?FILTER\]?/gi, '')
      .replace(/\[?TOOL RESULT\]?/gi, '')
      .replace(/\[?JSON\]?/gi, '')
      .replace(/\[?INTERNAL\]?/gi, '')
      .replace(/\[?FORMATTED RESPONSE\]?/gi, '')
      .trim();
  }
}
