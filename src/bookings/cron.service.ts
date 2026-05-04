import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan } from 'typeorm';
import { Booking, BookingStatus } from './entities/booking.entity';

@Injectable()
export class BookingCronService {
  private readonly logger = new Logger(BookingCronService.name);

  constructor(
    @InjectRepository(Booking)
    private bookingRepo: Repository<Booking>,
  ) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async handleCleanupExpiredBookings() {
    this.logger.debug('Running cron job to cleanup expired bookings...');

    try {
      const now = new Date();
      
      const result = await this.bookingRepo.createQueryBuilder()
        .update(Booking)
        .set({ booking_status: BookingStatus.EXPIRED })
        .where('booking_status = :status', { status: BookingStatus.PENDING })
        .andWhere('expired_at < :now', { now })
        .execute();

      if (result.affected && result.affected > 0) {
        this.logger.log(`Expired ${result.affected} pending booking(s) automatically.`);
      }
    } catch (error) {
      this.logger.error('Failed to cleanup expired bookings', error);
    }
  }
}
