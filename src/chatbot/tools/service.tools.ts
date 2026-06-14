import { Injectable, Logger } from '@nestjs/common';
import { ServicesService } from '../../services/services.service';

@Injectable()
export class ServiceTools {
  private readonly logger = new Logger(ServiceTools.name);

  constructor(private readonly servicesService: ServicesService) {}

  /**
   * TOOL 4: Lấy tất cả dịch vụ khách sạn từ database
   */
  async getAllServices(): Promise<string> {
    try {
      const services = await this.servicesService.findAllPublic();

      if (!services || services.length === 0) {
        return 'Hiện tại khách sạn chưa có thông tin dịch vụ. Vui lòng liên hệ lễ tân.';
      }

      const formatted = services
        .map((s) => {
          const hours =
            s.openTime && s.closeTime
              ? ` (${s.openTime} - ${s.closeTime})`
              : '';
          const location = s.location ? ` | Vị trí: ${s.location}` : '';
          return `• **${s.name}**${hours}${location}${s.shortDescription ? `\n  ${s.shortDescription}` : ''}`;
        })
        .join('\n\n');

      return `Dịch vụ tại Khách sạn Hoàng Minh:\n\n${formatted}\n\nQuý khách muốn biết thêm về dịch vụ nào?`;
    } catch (error) {
      this.logger.error('[ServiceTools.getAllServices]', error);
      return 'Không thể lấy thông tin dịch vụ lúc này. Vui lòng thử lại sau.';
    }
  }

  /**
   * TOOL 4b: Gợi ý dịch vụ sau khi booking
   */
  async recommendServicesAfterBooking(): Promise<string> {
    try {
      const services = await this.servicesService.findAllPublic();

      // Ưu tiên các dịch vụ cross-sell phổ biến
      const priorityKeywords = ['spa', 'nhà hàng', 'restaurant', 'sân bay', 'airport', 'hồ bơi', 'pool', 'gym'];

      const recommended = services
        .filter((s) =>
          priorityKeywords.some((kw) =>
            s.name.toLowerCase().includes(kw) ||
            (s.shortDescription || '').toLowerCase().includes(kw),
          ),
        )
        .slice(0, 4);

      const list = recommended.length > 0 ? recommended : services.slice(0, 3);

      const formatted = list
        .map((s) => `• **${s.name}** — ${s.shortDescription || 'Dịch vụ cao cấp tại khách sạn'}`)
        .join('\n');

      return `Để chuyến lưu trú hoàn hảo hơn, Quý khách có thể quan tâm đến:\n\n${formatted}\n\nQuý khách muốn đặt thêm dịch vụ nào không?`;
    } catch (error) {
      this.logger.error('[ServiceTools.recommendServicesAfterBooking]', error);
      return '';
    }
  }
}
