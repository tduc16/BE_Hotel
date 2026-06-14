import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  GoogleGenerativeAI,
  HarmBlockThreshold,
  HarmCategory,
} from '@google/generative-ai';
import { HOTEL_SYSTEM_PROMPT } from './prompts/system.prompt';

export type ChatRole = 'user' | 'model';

export interface ChatMessage {
  role: ChatRole;
  parts: [{ text: string }];
}

export type ChatIntent =
  | 'CHECK_ROOM_AVAILABILITY'
  | 'ROOM_PRICE'
  | 'ROOM_RECOMMENDATION'
  | 'SERVICE_RECOMMENDATION'
  | 'BOOK_ROOM'
  | 'BOOKING_LOOKUP'
  | 'BOOKING_CANCEL'
  | 'HOTEL_INFORMATION'
  | 'CONTACT_SUPPORT'
  | 'GENERAL_CHAT';

export interface GeminiResponse {
  text: string;
  intent: ChatIntent;
  suggestions: string[];
}

@Injectable()
export class GeminiService implements OnModuleInit {
  private readonly logger = new Logger(GeminiService.name);
  private readonly genAI: GoogleGenerativeAI;
  private readonly MODELS = ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-1.5-flash'];
  private activeModel = 'gemini-2.5-flash';
  private readonly TIMEOUT_MS = 20000;

  constructor(private readonly configService: ConfigService) {
    const apiKey = this.configService.get<string>('GEMINI_API_KEY');

    if (!apiKey) {
      this.logger.error(
        '[GeminiService] GEMINI_API_KEY chưa được cấu hình trong .env',
      );
      throw new Error('GEMINI_API_KEY is required');
    }

    this.genAI = new GoogleGenerativeAI(apiKey);
  }

  /**
   * Detect intent từ tin nhắn người dùng
   */
  detectIntent(message: string, context: Record<string, any>): ChatIntent {
    const msg = message.toLowerCase();
    const ctx = context || {};

    // CHECK_ROOM_AVAILABILITY
    if (
      msg.includes('phòng trống') ||
      msg.includes('còn phòng') ||
      msg.includes('available') ||
      (msg.includes('check') && (msg.includes('in') || msg.includes('out'))) ||
      (msg.includes('ngày') && (msg.includes('đến') || msg.includes('từ')))
    ) {
      return 'CHECK_ROOM_AVAILABILITY';
    }

    // ROOM_PRICE
    if (
      msg.includes('giá') ||
      msg.includes('price') ||
      msg.includes('bao nhiêu') ||
      msg.includes('chi phí') ||
      msg.includes('cost') ||
      msg.includes('tiền')
    ) {
      return 'ROOM_PRICE';
    }

    // BOOK_ROOM
    if (
      msg.includes('đặt phòng') ||
      msg.includes('book') ||
      msg.includes('đặt') ||
      msg.includes('thuê phòng') ||
      msg.includes('reserve') ||
      (ctx.intent === 'BOOK_ROOM')
    ) {
      return 'BOOK_ROOM';
    }

    // BOOKING_LOOKUP
    if (
      msg.includes('tra cứu') ||
      msg.includes('lookup') ||
      msg.includes('mã đặt') ||
      msg.includes('booking code') ||
      msg.match(/bk\d{4,}/i) ||
      msg.includes('xem booking') ||
      msg.includes('trạng thái')
    ) {
      return 'BOOKING_LOOKUP';
    }

    // BOOKING_CANCEL
    if (
      msg.includes('hủy') ||
      msg.includes('cancel') ||
      msg.includes('cancellation')
    ) {
      return 'BOOKING_CANCEL';
    }

    // SERVICE_RECOMMENDATION
    if (
      msg.includes('dịch vụ') ||
      msg.includes('service') ||
      msg.includes('spa') ||
      msg.includes('nhà hàng') ||
      msg.includes('restaurant') ||
      msg.includes('gym') ||
      msg.includes('hồ bơi') ||
      msg.includes('pool') ||
      msg.includes('sân bay') ||
      msg.includes('airport')
    ) {
      return 'SERVICE_RECOMMENDATION';
    }

    // ROOM_RECOMMENDATION
    if (
      msg.includes('gợi ý') ||
      msg.includes('suggest') ||
      msg.includes('recommend') ||
      msg.includes('phù hợp') ||
      msg.includes('phòng nào') ||
      msg.includes('loại phòng')
    ) {
      return 'ROOM_RECOMMENDATION';
    }

    // HOTEL_INFORMATION
    if (
      msg.includes('khách sạn') ||
      msg.includes('hotel') ||
      msg.includes('địa chỉ') ||
      msg.includes('giờ') ||
      msg.includes('check-in') ||
      msg.includes('check-out') ||
      msg.includes('chính sách')
    ) {
      return 'HOTEL_INFORMATION';
    }

    // CONTACT_SUPPORT
    if (
      msg.includes('liên hệ') ||
      msg.includes('contact') ||
      msg.includes('hỗ trợ') ||
      msg.includes('support') ||
      msg.includes('điện thoại') ||
      msg.includes('phone') ||
      msg.includes('email')
    ) {
      return 'CONTACT_SUPPORT';
    }

    return 'GENERAL_CHAT';
  }

  /**
   * Khởi động và kiểm tra các model theo thứ tự ưu tiên
   */
  async onModuleInit() {
    await this.validateAndSelectModel();
  }

  /**
   * Validate API Key và dò tìm model hoạt động tốt nhất
   */
  private async validateAndSelectModel(): Promise<void> {
    const apiKey = this.configService.get<string>('GEMINI_API_KEY');
    if (!apiKey) {
      this.logger.error('[GeminiService] GEMINI_API_KEY chưa được cấu hình trong .env');
      return;
    }

    for (const modelName of this.MODELS) {
      try {
        const model = this.genAI.getGenerativeModel({ model: modelName });
        const responsePromise = model.generateContent({
          contents: [{ role: 'user', parts: [{ text: 'Hello' }] }],
          generationConfig: { maxOutputTokens: 5 }
        });

        const timeoutPromise = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('TIMEOUT')), 5000)
        );

        await Promise.race([responsePromise, timeoutPromise]);

        this.activeModel = modelName;
        this.logger.log('[Gemini] Initialized successfully');
        this.logger.log(`[Gemini] Active model: ${this.activeModel}`);
        return;
      } catch (error: any) {
        const errorType = this.classifyRawError(error);

        this.logger.warn(
          `[GeminiService] Thử model ${modelName} thất bại. Loại lỗi: ${errorType.type}. Chi tiết: ${errorType.message}`
        );

        if (errorType.type === 'MODEL_UNAVAILABLE') {
          this.logger.warn(`[GeminiService] Model ${modelName} không khả dụng, thử model tiếp theo...`);
          continue;
        }

        this.activeModel = modelName;
        this.logger.log('[Gemini] Initialized with errors');
        this.logger.log(`[Gemini] Active model (due to general error): ${this.activeModel}`);
        return;
      }
    }

    this.activeModel = this.MODELS[0];
    this.logger.error(`[GeminiService] Tất cả model đều không khả dụng. Sử dụng mặc định: ${this.activeModel}`);
  }

  /**
   * Phân loại lỗi trả về từ Gemini API
   */
  private classifyRawError(error: any): { type: string; message: string } {
    const message = error?.message || String(error);
    const status = error?.status;

    if (message === 'TIMEOUT' || message.includes('timeout') || message.includes('Timeout')) {
      return { type: 'TIMEOUT', message: 'Yêu cầu kết nối tới Gemini AI bị quá thời gian (Timeout)' };
    }

    if (
      status === 400 &&
      (message.includes('API key') || message.includes('API_KEY') || message.includes('invalid') || message.includes('not valid'))
    ) {
      return { type: 'INVALID_API_KEY', message: 'API key của Gemini AI không hợp lệ hoặc đã bị khóa' };
    }

    if (
      status === 403 &&
      (message.includes('API key') || message.includes('API_KEY') || message.includes('invalid') || message.includes('not valid'))
    ) {
      return { type: 'INVALID_API_KEY', message: 'API key của Gemini AI không hợp lệ hoặc đã bị khóa' };
    }

    if (
      status === 429 ||
      message.includes('quota') ||
      message.includes('RESOURCE_EXHAUSTED') ||
      message.includes('Too Many Requests')
    ) {
      return { type: 'QUOTA_EXCEEDED', message: 'Đã vượt quá hạn mức sử dụng (Quota) của API key' };
    }

    if (
      status === 404 ||
      message.includes('not found') ||
      (message.includes('model') && message.includes('not found')) ||
      message.includes('not supported')
    ) {
      return { type: 'MODEL_UNAVAILABLE', message: 'Model được yêu cầu không tồn tại hoặc không được hỗ trợ' };
    }

    if (
      message.includes('fetch failed') ||
      message.includes('network') ||
      message.includes('ENOTFOUND') ||
      message.includes('connect')
    ) {
      return { type: 'NETWORK_FAILURE', message: 'Lỗi kết nối mạng tới máy chủ Google Gemini' };
    }

    return { type: 'UNKNOWN', message };
  }

  /**
   * Kiểm tra sức khỏe của Gemini Service
   */
  async healthCheck(): Promise<{
    success: boolean;
    model: string;
    responseReceived: boolean;
  }> {
    try {
      const model = this.genAI.getGenerativeModel({ model: this.activeModel });
      const responsePromise = model.generateContent({
        contents: [{ role: 'user', parts: [{ text: 'Hello' }] }],
        generationConfig: { maxOutputTokens: 5 }
      });

      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('TIMEOUT')), 10000)
      );

      await Promise.race([responsePromise, timeoutPromise]);

      return {
        success: true,
        model: this.activeModel,
        responseReceived: true,
      };
    } catch (error) {
      this.logger.error(`[GeminiService.healthCheck] Lỗi:`, error);
      return {
        success: false,
        model: this.activeModel,
        responseReceived: false,
      };
    }
  }

  /**
   * Gọi Gemini API với context và tool data đã được chuẩn bị sẵn
   */
  async chat(
    userMessage: string,
    history: ChatMessage[],
    toolData: string,
    customerName?: string | null,
  ): Promise<GeminiResponse> {
    const intent = this.detectIntent(userMessage, {});
    const suggestions = this.generateSuggestions(intent);

    const customerGreeting = customerName
      ? `Khách hàng hiện tại đã đăng nhập: ${customerName}. Hãy gọi tên khách trong câu trả lời khi phù hợp.`
      : 'Khách hàng chưa đăng nhập.';

    const systemInstruction = `${HOTEL_SYSTEM_PROMPT}\n\n${customerGreeting}\n\nDữ liệu từ hệ thống (dùng để trả lời khách):\n${toolData || 'Chưa có dữ liệu cụ thể.'}`;

    const startIndex = this.MODELS.indexOf(this.activeModel);
    const modelsToTry = startIndex === -1 ? this.MODELS : this.MODELS.slice(startIndex);

    let lastError: any = null;

    for (let i = 0; i < modelsToTry.length; i++) {
      const modelName = modelsToTry[i];
      try {
        const model = this.genAI.getGenerativeModel({
          model: modelName,
          systemInstruction,
          safetySettings: [
            {
              category: HarmCategory.HARM_CATEGORY_HARASSMENT,
              threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
            },
            {
              category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
              threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
            },
          ],
          generationConfig: {
            temperature: 0.7,
            topP: 0.8,
            maxOutputTokens: 1024,
          },
        });

        const limitedHistory = history.slice(-10);
        const chat = model.startChat({ history: limitedHistory });

        const responsePromise = chat.sendMessage(userMessage);
        const timeoutPromise = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('TIMEOUT')), this.TIMEOUT_MS)
        );

        const result = await Promise.race([responsePromise, timeoutPromise]);
        const responseText = result.response.text();

        if (modelName !== this.activeModel) {
          this.activeModel = modelName;
          this.logger.log(`[GeminiService] Cập nhật activeModel mới do fallback: ${this.activeModel}`);
        }

        return {
          text: responseText || 'Tôi có thể giúp gì thêm cho Quý khách?',
          intent,
          suggestions,
        };
      } catch (error: any) {
        lastError = error;
        const errorType = this.classifyRawError(error);

        this.logger.error(
          `[GeminiService.chat] Lỗi khi gọi model ${modelName}: ${errorType.type} - ${errorType.message}`
        );

        if (errorType.type === 'MODEL_UNAVAILABLE') {
          this.logger.warn(`[GeminiService] Model ${modelName} không khả dụng. Thử model tiếp theo...`);
          continue;
        }

        break;
      }
    }

    this.logger.error(`[GeminiService.chat] Lỗi chi tiết phát sinh:`, lastError);

    const finalErrorType = this.classifyRawError(lastError);
    let errorText = 'Xin lỗi, đã xảy ra lỗi trong quá trình xử lý. Vui lòng thử lại hoặc liên hệ lễ tân để được hỗ trợ.';
    let errorSuggestions = suggestions;

    if (finalErrorType.type === 'TIMEOUT') {
      errorText = 'Xin lỗi, kết nối tới hệ thống AI đang phản hồi chậm. Vui lòng thử lại sau giây lát.';
      errorSuggestions = ['🔄 Thử lại', '☎ Liên hệ lễ tân'];
    } else if (finalErrorType.type === 'INVALID_API_KEY') {
      errorText = 'Dịch vụ tư vấn AI tạm thời không khả dụng. Vui lòng liên hệ lễ tân để được hỗ trợ trực tiếp.';
      errorSuggestions = ['☎ Liên hệ lễ tân'];
    } else if (finalErrorType.type === 'QUOTA_EXCEEDED') {
      errorText = 'Hệ thống AI đang bận do vượt quá hạn mức yêu cầu. Vui lòng thử lại sau vài phút hoặc liên hệ lễ tân.';
      errorSuggestions = ['🔄 Thử lại sau', '☎ Liên hệ lễ tân'];
    } else if (finalErrorType.type === 'MODEL_UNAVAILABLE') {
      errorText = 'Hệ thống đang cấu hình lại mô hình AI. Vui lòng thử lại sau giây lát hoặc liên hệ lễ tân.';
      errorSuggestions = ['🔄 Thử lại', '☎ Liên hệ lễ tân'];
    } else if (finalErrorType.type === 'NETWORK_FAILURE') {
      errorText = 'Không thể kết nối tới máy chủ AI. Vui lòng kiểm tra lại kết nối mạng hoặc thử lại sau.';
      errorSuggestions = ['🔄 Thử lại', '☎ Liên hệ lễ tân'];
    }

    return {
      text: errorText,
      intent,
      suggestions: errorSuggestions,
    };
  }

  private generateSuggestions(intent: ChatIntent): string[] {
    const suggestionMap: Record<ChatIntent, string[]> = {
      CHECK_ROOM_AVAILABILITY: [
        '✨ Gợi ý phòng phù hợp',
        '💰 Xem giá phòng',
        '🏨 Đặt phòng',
      ],
      ROOM_PRICE: [
        '🏨 Tìm phòng trống',
        '✨ Gợi ý phòng phù hợp',
        '📋 Đặt phòng ngay',
      ],
      ROOM_RECOMMENDATION: [
        '🏨 Kiểm tra phòng trống',
        '💰 Xem giá chi tiết',
        '🏨 Đặt phòng',
      ],
      SERVICE_RECOMMENDATION: [
        '🏨 Tìm phòng trống',
        '📋 Tra cứu booking',
        '☎ Liên hệ hỗ trợ',
      ],
      BOOK_ROOM: [
        '🏨 Kiểm tra phòng trống',
        '💰 Xem giá phòng',
        '🎁 Dịch vụ đi kèm',
      ],
      BOOKING_LOOKUP: [
        '❌ Hủy booking',
        '🏨 Đặt phòng mới',
        '☎ Liên hệ hỗ trợ',
      ],
      BOOKING_CANCEL: ['📋 Tra cứu booking', '🏨 Đặt phòng mới', '☎ Hỗ trợ'],
      HOTEL_INFORMATION: [
        '🏨 Tìm phòng trống',
        '🎁 Dịch vụ khách sạn',
        '☎ Liên hệ',
      ],
      CONTACT_SUPPORT: [
        '🏨 Tìm phòng trống',
        '📋 Tra cứu booking',
        '🎁 Dịch vụ',
      ],
      GENERAL_CHAT: [
        '🏨 Tìm phòng trống',
        '💰 Xem giá phòng',
        '✨ Gợi ý phòng',
        '🎁 Dịch vụ khách sạn',
      ],
    };

    return suggestionMap[intent] || suggestionMap.GENERAL_CHAT;
  }
}
