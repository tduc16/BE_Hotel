import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ChatSession } from './entities/chat-session.entity';
import { ChatMessage } from './entities/chat-message.entity';
import { ChatbotController } from './chatbot.controller';
import { ChatbotService } from './chatbot.service';
import { GeminiService } from './gemini.service';
import { GoogleGenerativeAI } from "@google/generative-ai";
import { RoomTools } from './tools/room.tools';
import { ServiceTools } from './tools/service.tools';
import { BookingTools } from './tools/booking.tools';
import { RoomsModule } from '../rooms/rooms.module';
import { BookingsModule } from '../bookings/bookings.module';
import { ServicesModule } from '../services/services.module';
import { RoomCategory } from '../rooms/entities/room-category.entity';
import { Room } from '../rooms/entities/room.entity';
import { Booking } from '../bookings/entities/booking.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([ChatSession, ChatMessage, RoomCategory, Room, Booking]),
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
    ChatbotService,
    GeminiService,
    RoomTools,
    ServiceTools,
    BookingTools,
  ],
})
export class ChatbotModule { }
