import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RoomCategory } from '../../rooms/entities/room-category.entity';
import { BookingAvailabilityService } from '../../bookings/booking-availability.service';

export interface RoomRecommendation {
  roomType: string;
  categoryId: string;
  pricePerNight: number;
  capacity: number;
  reason: string;
  score: number;
}

export interface RecommendationInput {
  guests: number;
  budget?: number | null;
  purpose?: string;
  checkIn?: string;
  checkOut?: string;
}

/**
 * RecommendationService: Gợi ý phòng thông minh theo nhu cầu khách
 */
@Injectable()
export class RecommendationService {
  private readonly logger = new Logger(RecommendationService.name);

  constructor(
    @InjectRepository(RoomCategory)
    private readonly categoryRepo: Repository<RoomCategory>,
    private readonly bookingAvailabilityService: BookingAvailabilityService,
  ) {}

  async recommendRooms(
    input: { guestCount: number; checkIn?: string; checkOut?: string },
  ): Promise<any[]> {
    const { guestCount, checkIn, checkOut } = input;

    this.logger.log(
      `[RecommendationService] guestCount=${guestCount}, checkIn=${checkIn}, checkOut=${checkOut}`,
    );

    let scored: any[] = [];

    if (checkIn && checkOut) {
      // 1. Dùng BookingAvailabilityService để chỉ gợi ý các phòng thực sự trống trong ngày đó
      const availCategories = await this.bookingAvailabilityService.findAvailableRoomCategories({
        checkInDate: checkIn,
        checkOutDate: checkOut,
        guestCount,
      });

      scored = availCategories.map((cat) => {
        const rating = this.getMockRating(cat.categoryName);
        return {
          roomType: cat.categoryName,
          categoryId: cat.categoryId,
          pricePerNight: cat.pricePerNight,
          capacity: cat.capacity,
          rating,
          reason: `sức chứa tối đa ${cat.capacity} khách`,
        };
      });
    } else {
      // 2. Nếu thiếu ngày, fallback về query categories thô từ DB
      const categories = await this.categoryRepo.find({ where: { is_active: true } });
      scored = categories
        .filter((cat) => cat.capacity >= guestCount)
        .map((cat) => {
          const rating = this.getMockRating(cat.name);
          return {
            roomType: cat.name,
            categoryId: cat.id,
            pricePerNight: Number(cat.base_price) || 0,
            capacity: cat.capacity,
            rating,
            reason: `sức chứa tối đa ${cat.capacity} khách`,
          };
        });
    }

    // 3. Sắp xếp các category theo: capacity phù hợp nhất -> giá thấp nhất -> rating cao nhất
    scored.sort((a, b) => {
      // Tiêu chí 1: capacity phù hợp nhất (capacity >= guestCount và hiệu số capacity - guestCount nhỏ nhất)
      const aDiff = a.capacity - guestCount;
      const bDiff = b.capacity - guestCount;
      if (aDiff !== bDiff) {
        return aDiff - bDiff;
      }

      // Tiêu chí 2: Giá thấp nhất
      if (a.pricePerNight !== b.pricePerNight) {
        return a.pricePerNight - b.pricePerNight;
      }

      // Tiêu chí 3: Rating cao nhất
      return b.rating - a.rating;
    });

    return scored.slice(0, 3);
  }

  private getMockRating(name: string): number {
    const n = name.toLowerCase();
    if (n.includes('vip')) return 4.9;
    if (n.includes('executive')) return 4.8;
    if (n.includes('deluxe')) return 4.7;
    if (n.includes('family')) return 4.6;
    if (n.includes('standard') || n.includes('standrad')) return 4.5;
    return 4.4;
  }

  private scorePurpose(
    name: string,
    purpose: string,
    price: number,
    capacity: number,
  ): { score: number; reason: string } {
    const n = name.toLowerCase();
    const p = purpose.toLowerCase();

    // Cặp đôi / honeymoon
    if (
      p.includes('đôi') ||
      p.includes('couple') ||
      p.includes('vợ chồng') ||
      p.includes('honeymoon')
    ) {
      if (n.includes('vip') || n.includes('suite') || n.includes('deluxe')) {
        return { score: 25, reason: 'lý tưởng cho cặp đôi' };
      }
      if (price > 1_500_000) {
        return { score: 15, reason: 'phù hợp cho cặp đôi' };
      }
    }

    // Gia đình
    if (p.includes('gia đình') || p.includes('family')) {
      if (capacity >= 3) {
        return { score: 25, reason: `rộng rãi cho gia đình (${capacity} người)` };
      }
    }

    // Công tác / Business
    if (p.includes('công tác') || p.includes('business')) {
      if (price < 2_000_000) {
        return { score: 20, reason: 'tiết kiệm cho công tác' };
      }
    }

    // Luxury / VIP
    if (p.includes('luxury') || p.includes('vip') || p.includes('sang trọng')) {
      if (n.includes('vip') || n.includes('suite') || n.includes('deluxe')) {
        return { score: 25, reason: 'phòng cao cấp sang trọng' };
      }
    }

    return { score: 5, reason: '' };
  }
}
