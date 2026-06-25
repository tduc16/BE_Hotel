import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RoomCategory } from '../../rooms/entities/room-category.entity';
import { ChatSessionContext, AvailableRoomCacheItem } from '../interfaces/chat-session-context.interface';
import { ChatIntent } from '../services/intent.service';
import { EntityExtractorService } from '../services/entity-extractor.service';
import { ToolRouterService } from '../services/tool-router.service';
import { DateParserService } from '../services/date-parser.service';
import { RecommendationService } from '../services/recommendation.service';
import { ResponseFormatterService } from '../services/response-formatter.service';
import { StructuredToolResult } from '../services/chatbot-response-formatter.service';
import { BookingAvailabilityService } from '../../bookings/booking-availability.service';

export interface StateMachineResult {
  /** Dữ liệu thực từ DB để inject vào Gemini */
  toolData: string;
  /** Context đã được cập nhật */
  updatedContext: ChatSessionContext;
  /** Hint cho Gemini */
  hint?: string;
  /** Có cần gọi ToolRouter để fetch data không */
  needsToolCall?: boolean;
  /** Intent để ToolRouter fetch */
  toolIntent?: ChatIntent;
  /** Kết quả nghiệp vụ có cấu trúc phục vụ response formatting */
  structuredToolResult?: StructuredToolResult;
  actions?: { label: string; url: string; primary?: boolean }[];
}

type ConversationState =
  | 'IDLE'
  | 'CONSULTING'
  | 'WAITING_DATES'
  | 'WAITING_GUEST_COUNT'
  | 'SHOWING_RECOMMENDATIONS'
  | 'GUIDE_TO_BOOKING_PAGE'
  | 'WAITING_BOOKING_CODE';

@Injectable()
export class ConversationStateMachine {
  private readonly logger = new Logger(ConversationStateMachine.name);

  constructor(
    private readonly entityExtractor: EntityExtractorService,
    private readonly toolRouter: ToolRouterService,
    private readonly dateParser: DateParserService,
    private readonly recommendationService: RecommendationService,
    private readonly responseFormatter: ResponseFormatterService,
    private readonly bookingAvailabilityService: BookingAvailabilityService,
    @InjectRepository(RoomCategory)
    private readonly categoryRepo: Repository<RoomCategory>,
  ) {}

  /**
   * Điểm vào: xử lý message + intent + context → trả về StateMachineResult
   */
  async process(
    message: string,
    intent: ChatIntent,
    context: ChatSessionContext,
    customerName?: string | null,
  ): Promise<StateMachineResult> {
    const entities = this.entityExtractor.extract(message);
    const state = (context.state || 'IDLE') as ConversationState;

    this.logger.log({
      event: 'SM_PROCESS',
      intent,
      state,
      entities: {
        hasCheckIn: !!entities.dates.checkIn,
        hasCheckOut: !!entities.dates.checkOut,
        guestCount: entities.guestCount,
        bookingCode: entities.bookingCode,
        isConfirmation: entities.isConfirmation,
        isNegation: entities.isNegation,
      },
    });

    // Check user confirmation/negation for booking in consultation flow
    const msgLower = message.toLowerCase().trim();
    const isConfirmation = entities.isConfirmation || 
      msgLower === 'đồng ý' || msgLower === 'xác nhận' || 
      msgLower === 'đặt luôn' || msgLower === 'book luôn' || 
      msgLower === 'ok' || msgLower === 'đặt đi';

    if (isConfirmation && (intent === 'BOOKING_CONSULTATION' || state !== 'IDLE')) {
      // TRẢ VỀ THÔNG BÁO KHÔNG CHO PHÉP ĐẶT TRỰC TIẾP
      return {
        toolData: 'Để đảm bảo thông tin chính xác và thanh toán an toàn, anh/chị vui lòng hoàn tất đặt phòng tại trang đặt phòng.',
        updatedContext: {
          ...context,
          state: 'GUIDE_TO_BOOKING_PAGE',
          intent: 'BOOKING_CONSULTATION',
        },
        hint: 'Thông báo khách hàng cần đặt phòng qua website và hiển thị CTA nút đặt phòng.',
        actions: [
          {
            label: 'Đến trang đặt phòng',
            url: context.selectedCategoryId 
              ? `/booking?roomCategoryId=${context.selectedCategoryId}` 
              : '/booking',
            primary: true,
          }
        ],
        structuredToolResult: {
          intent: 'BOOKING_CONSULTATION',
          state: 'GUIDE_TO_BOOKING_PAGE',
        }
      };
    }

    // Kiểm tra xem user có thay đổi intent chính không
    const mainIntents: ChatIntent[] = ['CHECK_ROOM_AVAILABILITY', 'BOOKING_CONSULTATION', 'BOOKING_LOOKUP', 'BOOKING_GUIDANCE'];
    const currentIntent = context.intent as ChatIntent;
    const isIntentChanged = currentIntent &&
                            intent !== currentIntent &&
                            mainIntents.includes(intent) &&
                            mainIntents.includes(currentIntent);

    // ─── Nếu đang có flow active và không đổi intent chính → tiếp tục ─────────
    let smResult: StateMachineResult;
    if (state !== 'IDLE' && !isIntentChanged) {
      smResult = await this.continueFlow(message, intent, state, context, entities);
    } else {
      // ─── Không có flow hoặc đổi intent chính → bắt đầu flow mới ──────────────
      const contextForNewFlow = isIntentChanged
        ? { ...context, state: 'IDLE' as ConversationState, intent }
        : context;
      smResult = await this.startFlow(message, intent, contextForNewFlow, entities);
    }

    smResult.structuredToolResult = this.buildStructuredResult(smResult, intent);
    return smResult;
  }

  // ─── Start New Flow ───────────────────────────────────────────────────────────

  private async startFlow(
    message: string,
    intent: ChatIntent,
    context: ChatSessionContext,
    entities: ReturnType<EntityExtractorService['extract']>,
  ): Promise<StateMachineResult> {
    switch (intent) {
      case 'CHECK_ROOM_AVAILABILITY':
        return this.startAvailabilityFlow(context, entities);

      case 'BOOKING_CONSULTATION':
        return this.startConsultationFlow(message, context, entities);

      case 'BOOKING_LOOKUP':
        return this.startLookupFlow(context, entities);

      case 'BOOKING_GUIDANCE':
        return this.startGuidanceFlow(context, entities);

      case 'ROOM_RECOMMENDATION':
      case 'ROOM_PRICE':
      case 'SERVICE_RECOMMENDATION':
      case 'HOTEL_INFORMATION':
      case 'CONTACT_SUPPORT': {
        // Merge entities vào context trước khi route
        const updatedCtx = this.mergeEntitiesIntoContext(context, entities, intent);
        const toolResult = await this.toolRouter.route(intent, updatedCtx);
        return {
          toolData: toolResult.data,
          updatedContext: updatedCtx,
          hint: toolResult.hint,
          structuredToolResult: {
            intent,
            state: 'IDLE',
            availableRooms: toolResult.roomsCache,
            services: toolResult.services,
          },
        };
      }

      default:
        return {
          toolData: '',
          updatedContext: { ...context, state: 'IDLE' },
          hint: 'Câu hỏi chung. Chào hỏi thân thiện và gợi ý các dịch vụ: xem phòng, đặt phòng, tra cứu booking.',
        };
    }
  }

  // ─── Continue Active Flow ─────────────────────────────────────────────────────

  private async continueFlow(
    message: string,
    intent: ChatIntent,
    state: ConversationState,
    context: ChatSessionContext,
    entities: ReturnType<EntityExtractorService['extract']>,
  ): Promise<StateMachineResult> {
    switch (state) {
      case 'WAITING_DATES':
        return this.handleWaitingDates(message, context, entities);

      case 'WAITING_GUEST_COUNT':
        return this.handleWaitingGuestCount(message, context, entities);

      case 'SHOWING_RECOMMENDATIONS':
        return this.recommendRoomsConsultation(context);

      case 'WAITING_BOOKING_CODE':
        return this.handleWaitingLookupCode(context, entities);

      default:
        return this.startFlow(message, intent, { ...context, state: 'IDLE' }, entities);
    }
  }

  // ─── CHECK_ROOM_AVAILABILITY Flow ────────────────────────────────────────────

  private async startAvailabilityFlow(
    context: ChatSessionContext,
    entities: ReturnType<EntityExtractorService['extract']>,
  ): Promise<StateMachineResult> {
    const checkIn = entities.dates.checkIn
      ? this.dateParser.formatDate(entities.dates.checkIn)
      : context.checkInDate;

    const checkOut = entities.dates.checkOut
      ? this.dateParser.formatDate(entities.dates.checkOut)
      : context.checkOutDate;

    if (checkIn && checkOut) {
      const updatedContext: ChatSessionContext = {
        ...context,
        intent: 'CHECK_ROOM_AVAILABILITY',
        checkInDate: checkIn,
        checkOutDate: checkOut,
      };
      return this.doQueryRooms(updatedContext);
    }

    if (!checkIn) {
      return {
        toolData: 'Dạ, Anh/Chị muốn nhận phòng ngày nào và đi bao nhiêu người ạ?',
        updatedContext: {
          ...context,
          intent: 'CHECK_ROOM_AVAILABILITY',
          state: 'WAITING_DATES',
          checkInDate: checkIn,
          checkOutDate: checkOut,
        },
        hint: 'Khách muốn xem phòng trống. Hỏi ngày nhận phòng (check-in) và số lượng khách.',
      };
    } else {
      return {
        toolData: 'Dạ, Anh/Chị dự định trả phòng ngày nào ạ?',
        updatedContext: {
          ...context,
          intent: 'CHECK_ROOM_AVAILABILITY',
          state: 'WAITING_DATES',
          checkInDate: checkIn,
          checkOutDate: checkOut,
        },
        hint: 'Đã có ngày check-in. Hỏi ngày trả phòng (check-out).',
      };
    }
  }

  private async doQueryRooms(context: ChatSessionContext): Promise<StateMachineResult> {
    const toolResult = await this.toolRouter.route('CHECK_ROOM_AVAILABILITY', context);
    const rooms = toolResult.roomsCache || [];
    const actions = rooms.length > 0 ? [
      {
        label: 'Đặt phòng trên website',
        url: `/booking?roomCategoryId=${rooms[0].categoryId}`,
        primary: true,
      },
      {
        label: 'Xem phòng phù hợp',
        url: '/rooms',
        primary: false,
      }
    ] : [];

    return {
      toolData: toolResult.data,
      updatedContext: {
        ...context,
        state: 'SHOWING_RECOMMENDATIONS',
        availableRoomsCache: rooms,
      },
      hint: toolResult.hint,
      actions,
    };
  }

  // ─── BOOKING_CONSULTATION Flow ────────────────────────────────────────────────

  private async startConsultationFlow(
    message: string,
    context: ChatSessionContext,
    entities: ReturnType<EntityExtractorService['extract']>,
  ): Promise<StateMachineResult> {
    const checkIn = entities.dates.checkIn
      ? this.dateParser.formatDate(entities.dates.checkIn)
      : context.checkInDate;

    const checkOut = entities.dates.checkOut
      ? this.dateParser.formatDate(entities.dates.checkOut)
      : context.checkOutDate;

    const guests = entities.guestCount || context.guestCount;

    // Check specific room category mention
    const categories = await this.categoryRepo.find({ where: { is_active: true } });
    let matchedCategory: RoomCategory | undefined = undefined;
    const msgLower = message.toLowerCase();
    
    if (entities.roomName) {
      matchedCategory = categories.find(c => c.name.toLowerCase().includes(entities.roomName!.toLowerCase()));
    } else {
      matchedCategory = categories.find(c => msgLower.includes(c.name.toLowerCase()));
    }

    const updatedContext: ChatSessionContext = {
      ...context,
      intent: 'BOOKING_CONSULTATION',
      checkInDate: checkIn,
      checkOutDate: checkOut,
      guestCount: guests,
    };

    if (matchedCategory) {
      updatedContext.selectedCategoryId = matchedCategory.id;
      updatedContext.selectedRoomName = matchedCategory.name;
      updatedContext.selectedRoomCapacity = matchedCategory.capacity;
    }

    if (!checkIn || !checkOut) {
      updatedContext.state = 'WAITING_DATES';
      return {
        toolData: 'Dạ, em có thể tư vấn hạng phòng phù hợp cho anh/chị. Anh/chị dự định đi mấy người và lưu trú ngày nào ạ?',
        updatedContext,
        hint: 'Hỏi ngày nhận/trả phòng và số khách để tư vấn hạng phòng.',
      };
    }

    if (!guests) {
      updatedContext.state = 'WAITING_GUEST_COUNT';
      return {
        toolData: 'Dạ, Anh/Chị dự định đi bao nhiêu khách để em chọn hạng phòng phù hợp nhất ạ?',
        updatedContext,
        hint: 'Hỏi số lượng khách đi cùng.',
      };
    }

    return this.recommendRoomsConsultation(updatedContext);
  }

  private async handleWaitingDates(
    message: string,
    context: ChatSessionContext,
    entities: ReturnType<EntityExtractorService['extract']>,
  ): Promise<StateMachineResult> {
    const checkIn = entities.dates.checkIn 
      ? this.dateParser.formatDate(entities.dates.checkIn)
      : context.checkInDate;

    const checkOut = entities.dates.checkOut
      ? this.dateParser.formatDate(entities.dates.checkOut)
      : context.checkOutDate;

    const guests = entities.guestCount || context.guestCount;

    const updatedContext = {
      ...context,
      checkInDate: checkIn,
      checkOutDate: checkOut,
      guestCount: guests,
    };

    if (!checkIn || !checkOut) {
      return {
        toolData: 'Dạ, Anh/Chị vui lòng cung cấp ngày nhận phòng và trả phòng cụ thể nhé (ví dụ: từ 20/6 đến 22/6).',
        updatedContext,
        hint: 'Yêu cầu khách nhập ngày nhận phòng và ngày trả phòng.',
      };
    }

    if (!guests) {
      updatedContext.state = 'WAITING_GUEST_COUNT';
      return {
        toolData: 'Dạ, em đã lưu ngày lưu trú. Anh/chị đi đoàn bao nhiêu khách ạ?',
        updatedContext,
        hint: 'Hỏi số lượng khách.',
      };
    }

    return this.recommendRoomsConsultation(updatedContext);
  }

  private async handleWaitingGuestCount(
    message: string,
    context: ChatSessionContext,
    entities: ReturnType<EntityExtractorService['extract']>,
  ): Promise<StateMachineResult> {
    const guests = entities.guestCount || parseInt(message.trim(), 10);

    if (isNaN(guests) || guests < 1) {
      return {
        toolData: 'Dạ, Anh/Chị vui lòng cho biết số lượng khách lưu trú cụ thể (ví dụ: 2 người).',
        updatedContext: context,
        hint: 'Yêu cầu nhập số lượng khách hợp lệ.',
      };
    }

    const updatedContext = {
      ...context,
      guestCount: guests,
    };

    return this.recommendRoomsConsultation(updatedContext);
  }

  private async recommendRoomsConsultation(context: ChatSessionContext): Promise<StateMachineResult> {
    const checkIn = context.checkInDate!;
    const checkOut = context.checkOutDate!;
    const guests = context.guestCount || 2;

    const availCategories = await this.bookingAvailabilityService.findAvailableRoomCategories({
      checkInDate: checkIn,
      checkOutDate: checkOut,
      guestCount: guests,
    });

    let selectedCategory = availCategories[0];
    if (context.selectedCategoryId) {
      const found = availCategories.find(c => c.categoryId === context.selectedCategoryId);
      if (found) selectedCategory = found;
    }

    const checkInVN = new Date(checkIn).toLocaleDateString('vi-VN');
    const checkOutVN = new Date(checkOut).toLocaleDateString('vi-VN');
    const nights = this.calcNights(checkIn, checkOut);

    let reply = '';
    const actions: { label: string; url: string; primary?: boolean }[] = [];

    if (availCategories.length === 0) {
      reply = `Dạ, rất tiếc trong khoảng thời gian từ ${checkInVN} đến ${checkOutVN}, khách sạn đã hết phòng trống phù hợp với đoàn ${guests} khách. Anh/chị có thể đổi ngày lưu trú hoặc liên hệ lễ tân để được hỗ trợ.`;
      actions.push({
        label: 'Xem tất cả phòng',
        url: '/rooms',
        primary: true,
      });
    } else if (context.selectedCategoryId && !availCategories.find(c => c.categoryId === context.selectedCategoryId)) {
      const matchedCat = await this.categoryRepo.findOne({ where: { id: context.selectedCategoryId } });
      if (matchedCat && matchedCat.capacity < guests) {
        reply = `Dạ, hạng phòng **${matchedCat.name}** chỉ phù hợp tối đa ${matchedCat.capacity} khách, không đủ sức chứa cho đoàn ${guests} khách. Em đề xuất hạng phòng **${selectedCategory.categoryName}** vì có sức chứa phù hợp hơn.\n\n` +
                `Giá tham khảo: ${selectedCategory.pricePerNight.toLocaleString('vi-VN')}đ/đêm.\n` +
                `Anh/chị có thể bấm nút bên dưới để sang trang đặt phòng.`;
      } else {
        reply = `Dạ, hạng phòng **${matchedCat?.name || 'phòng chọn'}** hiện đã hết phòng từ ngày ${checkInVN} đến ${checkOutVN}. Em đề xuất hạng phòng **${selectedCategory.categoryName}** đang còn trống.\n\n` +
                `Giá tham khảo: ${selectedCategory.pricePerNight.toLocaleString('vi-VN')}đ/đêm.\n` +
                `Anh/chị có thể bấm nút bên dưới để sang trang đặt phòng.`;
      }
      actions.push({
        label: 'Đặt phòng trên website',
        url: `/booking?roomCategoryId=${selectedCategory.categoryId}`,
        primary: true,
      });
      actions.push({
        label: 'Xem phòng phù hợp',
        url: '/rooms',
        primary: false,
      });
    } else {
      const cat = selectedCategory;
      reply = `Dạ, với ${guests} khách lưu trú từ ${checkInVN} đến ${checkOutVN} (${nights} đêm), em đề xuất hạng phòng **${cat.categoryName}** vì sức chứa phù hợp và có không gian rộng rãi.\n\n` +
              `Giá tham khảo: ${cat.pricePerNight.toLocaleString('vi-VN')}đ/đêm.\n` +
              `Anh/chị có thể bấm nút bên dưới để sang trang đặt phòng.`;
              
      actions.push({
        label: 'Đặt phòng trên website',
        url: `/booking?roomCategoryId=${cat.categoryId}`,
        primary: true,
      });
      actions.push({
        label: 'Xem chi tiết phòng',
        url: '/rooms',
        primary: false,
      });
    }

    const roomsCache: AvailableRoomCacheItem[] = availCategories.map(c => ({
      roomType: c.categoryName,
      categoryId: c.categoryId,
      available: c.availableRoomCount,
      capacity: c.capacity,
      pricePerNight: c.pricePerNight,
      totalPrice: c.pricePerNight * nights,
      nights,
    }));

    return {
      toolData: reply,
      updatedContext: {
        ...context,
        state: 'SHOWING_RECOMMENDATIONS',
        availableRoomsCache: roomsCache,
        selectedCategoryId: selectedCategory?.categoryId,
      },
      hint: 'Tư vấn đề xuất phòng và hướng dẫn khách click các nút CTA đặt phòng.',
      actions,
    };
  }

  // ─── BOOKING_LOOKUP Flow ──────────────────────────────────────────────────────

  private async startLookupFlow(
    context: ChatSessionContext,
    entities: ReturnType<EntityExtractorService['extract']>,
  ): Promise<StateMachineResult> {
    const bookingCode = entities.bookingCode || context.bookingCode;

    if (bookingCode) {
      const updatedContext = { ...context, intent: 'BOOKING_LOOKUP', bookingCode, state: 'IDLE' };
      const toolResult = await this.toolRouter.route('BOOKING_LOOKUP', updatedContext);
      return {
        toolData: toolResult.data,
        updatedContext,
        hint: toolResult.hint,
        actions: [
          {
            label: 'Xem chi tiết booking',
            url: `/booking-lookup?code=${bookingCode}`,
            primary: true,
          }
        ]
      };
    }

    return {
      toolData: 'Dạ, Anh/Chị vui lòng cung cấp mã đặt phòng để em tra cứu thông tin nhé (ví dụ: BK20260001).',
      updatedContext: { ...context, intent: 'BOOKING_LOOKUP', state: 'WAITING_BOOKING_CODE' },
      hint: 'Hỏi mã đặt phòng của khách.',
    };
  }

  // ─── BOOKING_GUIDANCE Flow ────────────────────────────────────────────────────

  private async startGuidanceFlow(
    context: ChatSessionContext,
    entities: ReturnType<EntityExtractorService['extract']>,
  ): Promise<StateMachineResult> {
    const bookingCode = entities.bookingCode || context.bookingCode;
    const actions = [
      {
        label: 'Đến trang tra cứu booking',
        url: bookingCode ? `/booking-lookup?code=${bookingCode}` : '/booking-lookup',
        primary: true,
      }
    ];

    return {
      toolData: 'Dạ, để hủy đặt phòng, anh/chị vui lòng truy cập trang quản lý đặt phòng trên website để thực hiện nhé. Vì lý do bảo mật và đảm bảo quyền lợi, hệ thống AI chatbot không thể thực hiện thao tác hủy phòng trực tiếp.',
      updatedContext: {
        ...context,
        state: 'IDLE',
        intent: undefined,
      },
      hint: 'Hướng dẫn khách hàng hủy phòng qua website và hiển thị CTA liên kết.',
      actions,
    };
  }

  private async handleWaitingLookupCode(
    context: ChatSessionContext,
    entities: ReturnType<EntityExtractorService['extract']>,
  ): Promise<StateMachineResult> {
    if (!entities.bookingCode) {
      return {
        toolData: 'Dạ, em chưa tìm thấy mã đặt phòng hợp lệ. Anh/Chị vui lòng cung cấp mã dạng BKXXXX (ví dụ: BK20260001).',
        updatedContext: context,
        hint: 'Yêu cầu mã booking.',
      };
    }

    const updatedContext = { ...context, bookingCode: entities.bookingCode, state: 'IDLE' };
    const toolResult = await this.toolRouter.route('BOOKING_LOOKUP', updatedContext);
    return {
      toolData: toolResult.data,
      updatedContext,
      hint: toolResult.hint,
      actions: [
        {
          label: 'Xem chi tiết booking',
          url: `/booking-lookup?code=${entities.bookingCode}`,
          primary: true,
        }
      ]
    };
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────────

  private mergeEntitiesIntoContext(
    context: ChatSessionContext,
    entities: ReturnType<EntityExtractorService['extract']>,
    intent: string,
  ): ChatSessionContext {
    const updated = { ...context, intent };

    if (entities.guestCount) updated.guestCount = entities.guestCount;
    if (entities.budget) updated.budget = entities.budget;
    if (entities.purpose) updated.purpose = entities.purpose;
    if (entities.bookingCode) updated.bookingCode = entities.bookingCode;
    if (entities.dates.checkIn) updated.checkInDate = this.dateParser.formatDate(entities.dates.checkIn);
    if (entities.dates.checkOut) updated.checkOutDate = this.dateParser.formatDate(entities.dates.checkOut);

    return updated;
  }

  private calcNights(checkIn?: string, checkOut?: string): number {
    if (!checkIn || !checkOut) return 1;
    const nights = Math.round(
      (new Date(checkOut).getTime() - new Date(checkIn).getTime()) / (1000 * 60 * 60 * 24),
    );
    return nights > 0 ? nights : 1;
  }

  private buildStructuredResult(smResult: StateMachineResult, originalIntent: ChatIntent): StructuredToolResult {
    const ctx = smResult.updatedContext;
    const base: StructuredToolResult = {
      intent: ctx.intent || originalIntent,
      state: ctx.state || 'IDLE',
      checkInDate: ctx.checkInDate,
      checkOutDate: ctx.checkOutDate,
      guestCount: ctx.guestCount,
      bookingDraft: ctx.bookingDraft,
      availableRooms: ctx.availableRoomsCache,
      selectedRoom: ctx.selectedRoomName ? {
        name: ctx.selectedRoomName,
        capacity: ctx.selectedRoomCapacity,
      } : undefined,
    };

    return {
      ...base,
      ...smResult.structuredToolResult,
    };
  }
}
