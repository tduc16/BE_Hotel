import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';

// Entities
import { ChatSession } from './entities/chat-session.entity';
import { ChatMessage } from './entities/chat-message.entity';
import { RoomCategory } from '../rooms/entities/room-category.entity';
import { Room } from '../rooms/entities/room.entity';
import { Booking } from '../bookings/entities/booking.entity';
import { Customer } from '../customer/entities/customer.entity';

// Controller & Core
import { ChatbotController } from './chatbot.controller';
import { ChatbotService } from './chatbot.service';
import { GeminiService } from './gemini.service';

// External modules
import { RoomsModule } from '../rooms/rooms.module';
import { BookingsModule } from '../bookings/bookings.module';
import { ServicesModule } from '../services/services.module';

// Legacy tools (giữ lại để ToolRouterService dùng)
import { RoomTools } from './tools/room.tools';
import { ServiceTools } from './tools/service.tools';
import { BookingTools } from './tools/booking.tools';

// ★ New Service-Based Architecture
import { ConversationStateMachine } from './state-machine/conversation-state-machine';

// Services layer
import { DateParserService } from './services/date-parser.service';
import { AvailabilityService } from './services/availability.service';
import { RecommendationService } from './services/recommendation.service';
import { IntentService } from './services/intent.service';
import { EntityExtractorService } from './services/entity-extractor.service';
import { ToolRouterService } from './services/tool-router.service';
import { ConversationService } from './services/conversation.service';
import { ResponseFormatterService } from './services/response-formatter.service';
import { ChatbotResponseFormatter } from './services/chatbot-response-formatter.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ChatSession,
      ChatMessage,
      RoomCategory,
      Room,
      Booking,
      Customer,
    ]),
    RoomsModule,
    BookingsModule,
    ServicesModule,
    ConfigModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET'),
        signOptions: {
          expiresIn: configService.get<string>('JWT_EXPIRES_IN', '1h') as any,
        },
      }),
      inject: [ConfigService],
    }),
  ],
  controllers: [ChatbotController],
  providers: [
    // Core orchestrator
    ChatbotService,
    GeminiService,

    // ★ Service Layer (mới)
    ConversationService,
    IntentService,
    EntityExtractorService,
    ToolRouterService,
    ResponseFormatterService,
    ChatbotResponseFormatter,

    // State Machine (v2)
    ConversationStateMachine,

    // Data services
    DateParserService,
    AvailabilityService,
    RecommendationService,

    // Legacy tools (dùng bởi ToolRouterService)
    RoomTools,
    ServiceTools,
    BookingTools,
  ],
  exports: [ResponseFormatterService, ChatbotResponseFormatter],
})
export class ChatbotModule {}
