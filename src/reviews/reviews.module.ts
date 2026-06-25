import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Review } from './entities/review.entity';
import { Customer } from '../customer/entities/customer.entity';
import { Booking } from '../bookings/entities/booking.entity';
import { RoomCategory } from '../rooms/entities/room-category.entity';
import { Room } from '../rooms/entities/room.entity';
import { ReviewsService } from './reviews.service';
import { ReviewSeedService } from './review-seed.service';
import { PublicReviewsController, CustomerReviewsController, AdminReviewsController } from './reviews.controller';
import { AdminModule } from '../admin/admin.module';
import { CustomerAuthModule } from '../customer-auth/customer-auth.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Review, Customer, Booking, RoomCategory, Room]),
    AdminModule,
    CustomerAuthModule,
  ],
  controllers: [PublicReviewsController, CustomerReviewsController, AdminReviewsController],
  providers: [ReviewsService, ReviewSeedService],
  exports: [ReviewsService],
})
export class ReviewsModule {}
