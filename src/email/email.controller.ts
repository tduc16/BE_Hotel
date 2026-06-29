import { Controller, Get, Query, BadRequestException, InternalServerErrorException } from '@nestjs/common';
import { EmailService } from './email.service';
import { ApiTags, ApiOperation, ApiQuery, ApiResponse } from '@nestjs/swagger';

@ApiTags('Email')
@Controller('email')
export class EmailController {
  constructor(private readonly emailService: EmailService) {}

  @Get('test')
  @ApiOperation({ summary: 'Gửi email test để kiểm tra cấu hình SMTP' })
  @ApiQuery({ name: 'to', description: 'Địa chỉ email người nhận', required: true, type: String })
  @ApiResponse({ status: 200, description: 'Gửi email thành công' })
  @ApiResponse({ status: 400, description: 'Thiếu email người nhận hoặc cấu hình sai' })
  async testEmail(@Query('to') to: string) {
    if (!to || to.trim() === '') {
      throw new BadRequestException('Vui lòng cung cấp địa chỉ email người nhận (query param: to)');
    }

    try {
      await this.emailService.sendTestEmail(to);
      return {
        success: true,
        message: `Email test đã được gửi thành công tới ${to}. Vui lòng kiểm tra hộp thư (bao gồm cả thư rác/spam).`,
      };
    } catch (error: any) {
      throw new InternalServerErrorException({
        success: false,
        message: `Gửi email test thất bại: ${error.message}`,
        error: error.name,
        stack: error.stack,
      });
    }
  }
}
