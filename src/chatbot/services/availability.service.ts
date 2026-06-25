import { Injectable, Logger } from '@nestjs/common';
import { BookingAvailabilityService } from '../../bookings/booking-availability.service';

export interface AvailableRoomResult {
  roomType: string;
  categoryId: string;
  available: number;
  capacity: number;
  pricePerNight: number;
  totalPrice: number;
  nights: number;
  amenities: string[];
}

export interface AvailabilityCheckResult {
  checkIn: string;
  checkOut: string;
  nights: number;
  rooms: AvailableRoomResult[];
  hasAvailability: boolean;
}

@Injectable()
export class AvailabilityService {
  private readonly logger = new Logger(AvailabilityService.name);

  constructor(
    private readonly bookingAvailabilityService: BookingAvailabilityService,
  ) {}

  /**
   * Kiểm tra phòng trống trong khoảng thời gian checkIn → checkOut
   */
  async checkAvailableRooms(
    checkIn: Date,
    checkOut: Date,
    guestCount?: number,
  ): Promise<AvailabilityCheckResult> {
    const checkInStr = this.formatDate(checkIn);
    const checkOutStr = this.formatDate(checkOut);

    const nights = Math.round(
      (checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24),
    );
    const actualNights = nights > 0 ? nights : 1;

    this.logger.log(
      `[AvailabilityService] Delegating checkAvailableRooms: ${checkInStr} → ${checkOutStr} (${actualNights} nights) | guestCount=${guestCount || 'N/A'}`,
    );

    const availCategories = await this.bookingAvailabilityService.findAvailableRoomCategories({
      checkInDate: checkIn,
      checkOutDate: checkOut,
      guestCount,
    });

    const rooms: AvailableRoomResult[] = availCategories.map((cat) => ({
      roomType: cat.categoryName,
      categoryId: cat.categoryId,
      available: cat.availableRoomCount,
      capacity: cat.capacity,
      pricePerNight: cat.pricePerNight,
      totalPrice: cat.totalAmount,
      nights: actualNights,
      amenities: [],
    }));

    return {
      checkIn: checkInStr,
      checkOut: checkOutStr,
      nights: actualNights,
      rooms,
      hasAvailability: rooms.length > 0,
    };
  }

  private formatDate(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
}
