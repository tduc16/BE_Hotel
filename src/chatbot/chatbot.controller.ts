import {
  Controller,
  Post,
  Body,
  Logger,
  Req,
} from '@nestjs/common';
import type { Request } from 'express';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ChatbotService } from './chatbot.service';
import { SendMessageDto } from './dto/send-message.dto';
import { Customer } from '../customer/entities/customer.entity';

@Controller('chatbot')
export class ChatbotController {
  private readonly logger = new Logger(ChatbotController.name);

  constructor(
    private readonly chatbotService: ChatbotService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    @InjectRepository(Customer)
    private readonly customerRepo: Repository<Customer>,
  ) {}

  /**
   * POST /api/chatbot/message
   * Public endpoint — JWT optional, không throw nếu thiếu token
   */
  @Post('message')
  async sendMessage(@Body() dto: SendMessageDto, @Req() request: Request) {
    // Cố gắng decode JWT nếu có (không bắt buộc)
    const customer = await this.extractCustomerFromRequest(request);

    this.logger.log(
      `[ChatbotController] Message from ${customer?.name || 'guest'} | sessionId=${dto.sessionId || 'new'}`,
    );

    const result = await this.chatbotService.processMessage(dto, customer);
    return result;
  }

  /**
   * Extract customer info từ Bearer token nếu có
   * Không throw lỗi nếu token thiếu hoặc không hợp lệ
   */
  private async extractCustomerFromRequest(
    request: Request,
  ): Promise<{ id: string; name: string; email: string; phone: string } | null> {
    try {
      const authHeader = request.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return null;
      }

      const token = authHeader.split(' ')[1];
      const secret = this.configService.get<string>('JWT_SECRET');

      const payload = this.jwtService.verify(token, { secret });

      // Chỉ nhận customer JWT (role=CUSTOMER), không nhận admin token
      if (payload?.role !== 'CUSTOMER') {
        return null;
      }

      // Query database lấy thông tin đầy đủ gồm cả phone
      const customer = await this.customerRepo.findOne({ where: { id: payload.id } });
      if (!customer) {
        return null;
      }

      return {
        id: customer.id,
        name: customer.fullName || '',
        email: customer.email || '',
        phone: customer.phone || '',
      };
    } catch {
      // Token lỗi hoặc hết hạn — không throw, chỉ bỏ qua
      return null;
    }
  }
}
