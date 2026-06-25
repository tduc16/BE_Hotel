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
  | 'BOOKING_CONSULTATION'
  | 'BOOKING_LOOKUP'
  | 'BOOKING_GUIDANCE'
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
   * @deprecated Dùng IntentService.detect() thay thế
   * Giữ lại để tương thích ngược trong quá trình migration
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

    // BOOKING_CONSULTATION
    if (
      msg.includes('đặt phòng') ||
      msg.includes('book') ||
      msg.includes('đặt') ||
      msg.includes('thuê phòng') ||
      msg.includes('reserve') ||
      (ctx.intent === 'BOOKING_CONSULTATION')
    ) {
      return 'BOOKING_CONSULTATION';
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

    // BOOKING_GUIDANCE
    if (
      msg.includes('hủy') ||
      msg.includes('cancel') ||
      msg.includes('cancellation')
    ) {
      return 'BOOKING_GUIDANCE';
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

        if (errorType.type === 'MODEL_UNAVAILABLE' || errorType.type === 'QUOTA_EXCEEDED') {
          this.logger.warn(`[GeminiService] Model ${modelName} không khả dụng hoặc hết quota, thử model tiếp theo...`);
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
    systemHint?: string,
    intent?: ChatIntent,
    isFirstMessage?: boolean,
    state?: string,
  ): Promise<GeminiResponse> {
    const resolvedIntent = intent || this.detectIntent(userMessage, {});
    const suggestions = this.generateSuggestions(resolvedIntent, state);

    // ─── Build system instruction ─────────────────────────────────────────────
    const customerPart = customerName
      ? `Khách hàng hiện tại: ${customerName}. Gọi tên khách khi phù hợp.`
      : 'Khách hàng chưa đăng nhập — xưng "Quý khách".';

    const greetingInstruction = isFirstMessage
      ? 'Đây là TIN NHẮN ĐẦU TIÊN trong cuộc hội thoại. Hãy chào hỏi ngắn gọn và tự giới thiệu một lần duy nhất.'
      : 'KHÔNG lặp lại lời chào "Xin chào" hay "Tôi là AI Concierge" vì đã chào trước đó rồi. Trả lời thẳng vào vấn đề.';

    const toolDataPart = toolData
      ? `Dữ liệu THỰC từ hệ thống (BẮT BUỘC dùng dữ liệu này, KHÔNG được bịa thêm):\n${toolData}`
      : 'Chưa có dữ liệu cụ thể từ hệ thống.';

    const hintPart = systemHint ? `\n\nHướng dẫn xử lý: ${systemHint}` : '';

    const polishInstruction = `
[CHỈ DẪN QUAN TRỌNG]
Hệ thống đã chuẩn bị sẵn câu phản hồi thô bằng tiếng Việt tại nhãn [FORMATTED RESPONSE] trong phần Hướng dẫn xử lý bên dưới.
Nhiệm vụ duy nhất của bạn là: Làm mượt (polish) câu phản hồi đó để nó trở nên tự nhiên, lịch sự, thân thiện và giống văn phong con người hơn.
Nguyên tắc bắt buộc:
1. Giữ nguyên 100% các thông tin cốt lõi (Mã đặt phòng BK..., Ngày check-in, Ngày check-out, Số lượng khách, Tên hạng phòng, Số tiền thanh toán VND, Đường link liên kết). Tuyệt đối không được bịa thêm, sửa đổi hay làm mất đi các dữ liệu này.
2. Không thêm bất kỳ nhãn kỹ thuật nào như DATABASE, FILTER, TOOL RESULT, JSON vào câu trả lời.
3. Nếu không có nhãn [FORMATTED RESPONSE], hãy tự soạn câu trả lời tự nhiên, lịch sự bằng tiếng Việt dựa trên thông tin hệ thống.
`;

    const systemInstruction = `${HOTEL_SYSTEM_PROMPT}\n${polishInstruction}\n\n${customerPart}\n\n${greetingInstruction}\n\n${toolDataPart}${hintPart}`;

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
          intent: resolvedIntent,
          suggestions,
        };
      } catch (error: any) {
        lastError = error;
        const errorType = this.classifyRawError(error);

        this.logger.error(
          `[GeminiService.chat] Lỗi khi gọi model ${modelName}: ${errorType.type} - ${errorType.message}`
        );

        if (
          errorType.type === 'MODEL_UNAVAILABLE' ||
          errorType.type === 'QUOTA_EXCEEDED' ||
          errorType.type === 'TIMEOUT'
        ) {
          this.logger.warn(`[GeminiService] Model ${modelName} gặp lỗi ${errorType.type}. Thử model tiếp theo...`);
          continue;
        }

        break;
      }
    }

    this.logger.error(`[GeminiService.chat] Lỗi chi tiết phát sinh:`, lastError);
    this.logger.warn(`[GeminiService.chat] Kích hoạt cơ chế Fallback Downtime Template cho intent=${resolvedIntent}, state=${state}`);

    const fallbackText = this.getFallbackReply(resolvedIntent, state || 'IDLE', toolData, isFirstMessage);

    return {
      text: fallbackText,
      intent: resolvedIntent,
      suggestions,
    };
  }

  public generateSuggestions(intent: ChatIntent, state?: string): string[] {
    const consultationStates = [
      'WAITING_DATES',
      'WAITING_GUEST_COUNT',
      'SHOWING_RECOMMENDATIONS',
      'GUIDE_TO_BOOKING_PAGE',
    ];

    if (state && consultationStates.includes(state)) {
      return [
        '✨ Tư vấn phòng phù hợp',
        '🏨 Kiểm tra phòng trống',
        '💰 Xem giá phòng',
        '☎ Liên hệ hỗ trợ',
      ];
    }

    const suggestionMap: Record<ChatIntent, string[]> = {
      CHECK_ROOM_AVAILABILITY: [
        '✨ Tư vấn phòng phù hợp',
        '💰 Xem giá phòng',
        '🎁 Dịch vụ khách sạn',
      ],
      ROOM_PRICE: [
        '🏨 Kiểm tra phòng trống',
        '✨ Tư vấn phòng phù hợp',
        '🎁 Dịch vụ khách sạn',
      ],
      ROOM_RECOMMENDATION: [
        '🏨 Kiểm tra phòng trống',
        '💰 Xem giá phòng',
        '☎ Liên hệ hỗ trợ',
      ],
      SERVICE_RECOMMENDATION: [
        '🏨 Kiểm tra phòng trống',
        '📋 Tra cứu booking',
        '☎ Liên hệ hỗ trợ',
      ],
      BOOKING_CONSULTATION: [
        '🏨 Kiểm tra phòng trống',
        '💰 Xem giá phòng',
        '🎁 Dịch vụ khách sạn',
      ],
      BOOKING_LOOKUP: [
        '🏨 Kiểm tra phòng trống',
        '☎ Liên hệ hỗ trợ',
        '🎁 Dịch vụ khách sạn',
      ],
      BOOKING_GUIDANCE: [
        '📋 Tra cứu booking',
        '🏨 Kiểm tra phòng trống',
        '☎ Liên hệ hỗ trợ',
      ],
      HOTEL_INFORMATION: [
        '🏨 Kiểm tra phòng trống',
        '🎁 Dịch vụ khách sạn',
        '☎ Liên hệ',
      ],
      CONTACT_SUPPORT: [
        '🏨 Kiểm tra phòng trống',
        '📋 Tra cứu booking',
        '🎁 Dịch vụ',
      ],
      GENERAL_CHAT: [
        '✨ Tư vấn phòng phù hợp',
        '🏨 Kiểm tra phòng trống',
        '💰 Xem giá phòng',
        '🎁 Dịch vụ khách sạn',
      ],
    };

    return suggestionMap[intent] || suggestionMap.GENERAL_CHAT;
  }

  /**
   * Định dạng phản hồi tĩnh bằng Tiếng Việt dựa trên dữ liệu thực từ hệ thống khi API AI gặp sự cố.
   */
  getFallbackReply(
    intent: ChatIntent,
    state: string,
    toolData: string,
    isFirstMessage?: boolean,
  ): string {
    if (isFirstMessage) {
      return 'Xin chào Quý khách! Chào mừng Quý khách đến với Khách sạn Hoàng Minh. Em là trợ lý ảo AI Concierge. Em có thể hỗ trợ Quý khách kiểm tra phòng trống, đặt phòng, tra cứu booking hoặc tìm hiểu dịch vụ khách sạn. Hôm nay em có thể giúp gì cho Quý khách ạ?';
    }

    const cleanedData = toolData ? toolData.trim() : '';
    if (cleanedData.length > 0) {
      return cleanedData;
    }

    switch (intent) {
      case 'CHECK_ROOM_AVAILABILITY': {
        return 'Dạ, Quý khách vui lòng cung cấp ngày nhận phòng (check-in) và ngày trả phòng (check-out) để em hỗ trợ kiểm tra phòng trống trên hệ thống ạ.';
      }

      case 'ROOM_PRICE': {
        return 'Dạ, em xin gửi Quý khách bảng giá phòng hiện tại của khách sạn:\n\n• Deluxe Room: 1.500.000 VND/đêm\n• Vip: 10.000.000 VND/đêm\n• Standrad: 2.000.000 VND/đêm\n\nQuý khách có nhu cầu đặt phòng nào không ạ?';
      }

      case 'ROOM_RECOMMENDATION': {
        return 'Dạ, để em gợi ý phòng phù hợp nhất, Quý khách vui lòng cho biết số lượng khách lưu trú, mức ngân sách dự kiến hoặc mục đích chuyến đi (như công tác, nghỉ dưỡng gia đình, tuần trăng mật...) ạ.';
      }

      case 'BOOKING_CONSULTATION': {
        if (state === 'WAITING_DATES') {
          return 'Dạ, em có thể tư vấn hạng phòng phù hợp cho anh/chị. Anh/chị dự định đi mấy người và lưu trú ngày nào ạ?';
        }
        if (state === 'WAITING_GUEST_COUNT') {
          return 'Dạ, Anh/Chị dự định đi bao nhiêu khách để em chọn hạng phòng phù hợp nhất ạ?';
        }
        if (state === 'SHOWING_RECOMMENDATIONS' || state === 'GUIDE_TO_BOOKING_PAGE') {
          return 'Dạ, em đã đề xuất hạng phòng trống phù hợp. Anh/chị có thể bấm nút bên dưới để chuyển sang trang đặt phòng hoàn tất thông tin ạ.';
        }
        return 'Dạ, em có thể tư vấn hạng phòng phù hợp cho anh/chị. Anh/chị dự định đi mấy người và lưu trú ngày nào ạ?';
      }

      case 'BOOKING_LOOKUP': {
        return `Dạ, Anh/Chị vui lòng cung cấp mã đặt phòng để em tra cứu thông tin nhé.`;
      }

      case 'BOOKING_GUIDANCE': {
        return `Dạ, để hủy đặt phòng, anh/chị vui lòng truy cập trang quản lý đặt phòng trên website để thực hiện nhé.`;
      }

      case 'SERVICE_RECOMMENDATION': {
        return `Dạ, Khách sạn Hoàng Minh rất hân hạnh mang tới Quý khách các dịch vụ tiện ích đẳng cấp:\n\n• Nhà hàng ẩm thực Á - Âu\n• Spa & Massage trị liệu\n• Phòng Gym hiện đại\n• Hồ bơi vô cực ngoài trời\n• Dịch vụ đưa đón sân bay\n\nQuý khách có nhu cầu sử dụng hoặc cần tư vấn thêm về dịch vụ nào không ạ?`;
      }

      case 'HOTEL_INFORMATION': {
        return `Dạ, em xin gửi một số thông tin cơ bản về Khách sạn Hoàng Minh:\n\n• Giờ nhận phòng (Check-in): sau 14:00\n• Giờ trả phòng (Check-out): trước 12:00\n• Tiện ích: Nhà hàng, Spa, Gym, Hồ bơi ngoài trời, Đưa đón sân bay\n• Địa chỉ: Trung tâm thành phố, thuận tiện đi lại\n\nQuý khách cần tìm hiểu thêm thông tin nào khác không ạ?`;
      }

      case 'CONTACT_SUPPORT': {
        return `Dạ, Quý khách có thể liên hệ với chúng em qua điện thoại Lễ tân: Phục vụ 24/7 qua form liên hệ trên website. Chúng em luôn sẵn sàng phục vụ Quý khách!`;
      }

      default: {
        return 'Dạ, em là trợ lý ảo AI Concierge của Khách sạn Hoàng Minh. Em có thể hỗ trợ Quý khách kiểm tra phòng trống, đặt phòng, tra cứu thông tin đặt phòng hoặc các dịch vụ tiện ích của khách sạn. Quý khách cần em hỗ trợ gì thêm không ạ?';
      }
    }
  }
}
