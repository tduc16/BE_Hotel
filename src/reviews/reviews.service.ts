import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Review, ReviewStatus, ReviewSource } from './entities/review.entity';
import { Booking } from '../bookings/entities/booking.entity';
import { Customer } from '../customer/entities/customer.entity';
import { CreateReviewDto } from './dto/create-review.dto';
import { UpdateReviewDto } from './dto/update-review.dto';

@Injectable()
export class ReviewsService {
  constructor(
    @InjectRepository(Review)
    private reviewRepo: Repository<Review>,
    @InjectRepository(Booking)
    private bookingRepo: Repository<Booking>,
    @InjectRepository(Customer)
    private customerRepo: Repository<Customer>,
  ) {}

  // 1. Lấy danh sách booking đủ điều kiện đánh giá của khách hàng
  async getEligibleBookings(customerId: string) {
    const bookings = await this.bookingRepo.find({
      where: {
        customerId,
        booking_status: 'CHECKED_OUT' as any,
      },
      relations: ['roomCategory', 'room'],
      order: { check_out_date: 'DESC' },
    });

    const reviews = await this.reviewRepo.find({
      where: { customerId },
      select: ['bookingId'],
    });
    const reviewedBookingIds = new Set(reviews.map((r) => r.bookingId));

    const eligibleBookings = bookings.filter((b) => !reviewedBookingIds.has(b.id));

    return eligibleBookings.map((b) => ({
      bookingId: b.id,
      bookingCode: b.booking_code,
      roomName: b.room ? b.room.room_number : null,
      roomCategoryName: b.roomCategory ? b.roomCategory.name : null,
      checkInDate: b.check_in_date,
      checkOutDate: b.check_out_date,
      thumbnailUrl: b.roomCategory ? b.roomCategory.thumbnail_url : null,
    }));
  }

  // 2. Gửi review mới (từ khách hàng thực)
  async createReview(customerId: string, dto: CreateReviewDto) {
    const booking = await this.bookingRepo.findOne({
      where: { id: dto.bookingId },
    });

    if (!booking) {
      throw new BadRequestException('Mã đặt phòng không tồn tại');
    }

    if (booking.customerId !== customerId) {
      throw new ForbiddenException('Bạn không có quyền đánh giá đặt phòng này');
    }

    if (booking.booking_status !== ('CHECKED_OUT' as any)) {
      throw new BadRequestException('Chỉ có thể đánh giá đặt phòng đã CHECKED_OUT');
    }

    const existingReview = await this.reviewRepo.findOne({
      where: { bookingId: dto.bookingId },
    });

    if (existingReview) {
      throw new BadRequestException('Đặt phòng này đã được đánh giá trước đó');
    }

    const review = this.reviewRepo.create({
      bookingId: dto.bookingId,
      customerId,
      roomCategoryId: booking.room_category_id,
      roomId: booking.room_id,
      rating: dto.rating,
      cleanlinessRating: dto.cleanlinessRating ?? null,
      serviceRating: dto.serviceRating ?? null,
      comfortRating: dto.comfortRating ?? null,
      locationRating: dto.locationRating ?? null,
      valueRating: dto.valueRating ?? null,
      title: dto.title ?? null,
      comment: dto.comment,
      images: dto.images ?? [],
      status: ReviewStatus.PENDING,
      source: ReviewSource.CUSTOMER,
    });

    return await this.reviewRepo.save(review);
  }

  // 3. Lấy đánh giá của khách hàng hiện tại
  async getMyReviews(customerId: string) {
    const reviews = await this.reviewRepo.find({
      where: { customerId },
      relations: ['booking', 'roomCategory', 'room'],
      order: { createdAt: 'DESC' },
    });

    return reviews.map((r) => ({
      id: r.id,
      rating: r.rating,
      cleanlinessRating: r.cleanlinessRating,
      serviceRating: r.serviceRating,
      comfortRating: r.comfortRating,
      locationRating: r.locationRating,
      valueRating: r.valueRating,
      title: r.title,
      comment: r.comment,
      images: r.images,
      status: r.status,
      adminReply: r.adminReply,
      adminReplyAt: r.adminReplyAt,
      rejectReason: r.rejectReason,
      createdAt: r.createdAt,
      booking: r.booking
        ? {
            id: r.booking.id,
            bookingCode: r.booking.booking_code,
            checkInDate: r.booking.check_in_date,
            checkOutDate: r.booking.check_out_date,
          }
        : null,
      roomCategoryName: r.roomCategory ? r.roomCategory.name : null,
      roomName: r.room ? r.room.room_number : null,
    }));
  }

  // 4. Chỉnh sửa review
  async updateReview(customerId: string, reviewId: string, dto: UpdateReviewDto) {
    const review = await this.reviewRepo.findOne({
      where: { id: reviewId },
    });

    if (!review) {
      throw new NotFoundException('Đánh giá không tồn tại');
    }

    if (review.customerId !== customerId) {
      throw new ForbiddenException('Bạn không có quyền chỉnh sửa đánh giá này');
    }

    if (review.status !== ReviewStatus.PENDING) {
      throw new BadRequestException('Chỉ có thể chỉnh sửa đánh giá đang chờ duyệt');
    }

    if (dto.rating !== undefined) review.rating = dto.rating;
    if (dto.cleanlinessRating !== undefined) review.cleanlinessRating = dto.cleanlinessRating;
    if (dto.serviceRating !== undefined) review.serviceRating = dto.serviceRating;
    if (dto.comfortRating !== undefined) review.comfortRating = dto.comfortRating;
    if (dto.locationRating !== undefined) review.locationRating = dto.locationRating;
    if (dto.valueRating !== undefined) review.valueRating = dto.valueRating;
    if (dto.title !== undefined) review.title = dto.title;
    if (dto.comment !== undefined) review.comment = dto.comment;
    if (dto.images !== undefined) review.images = dto.images;

    return await this.reviewRepo.save(review);
  }

  // 5. Xoá review
  async deleteReview(customerId: string, reviewId: string) {
    const review = await this.reviewRepo.findOne({
      where: { id: reviewId },
    });

    if (!review) {
      throw new NotFoundException('Đánh giá không tồn tại');
    }

    if (review.customerId !== customerId) {
      throw new ForbiddenException('Bạn không có quyền xoá đánh giá này');
    }

    if (review.status !== ReviewStatus.PENDING) {
      throw new BadRequestException('Chỉ có thể xoá đánh giá đang chờ duyệt');
    }

    await this.reviewRepo.remove(review);
    return { success: true };
  }

  // 6. API Public: Lấy danh sách reviews APPROVED
  async getApprovedReviews(query: any) {
    const page = parseInt(query.page || '1', 10);
    const limit = parseInt(query.limit || '10', 10);
    const skip = (page - 1) * limit;

    const queryBuilder = this.reviewRepo.createQueryBuilder('review')
      .leftJoinAndSelect('review.customer', 'customer')
      .leftJoinAndSelect('review.roomCategory', 'roomCategory')
      .where('review.status = :status', { status: ReviewStatus.APPROVED });

    if (query.rating) {
      queryBuilder.andWhere('review.rating = :rating', { rating: parseInt(query.rating, 10) });
    }

    if (query.roomCategoryId) {
      queryBuilder.andWhere('review.roomCategoryId = :roomCategoryId', { roomCategoryId: query.roomCategoryId });
    }

    if (query.featured === 'true' || query.featured === true) {
      queryBuilder.andWhere('review.isFeatured = :isFeatured', { isFeatured: true });
    }

    const sort = query.sort || 'newest';
    if (sort === 'highest') {
      queryBuilder.orderBy('review.rating', 'DESC').addOrderBy('review.createdAt', 'DESC');
    } else if (sort === 'lowest') {
      queryBuilder.orderBy('review.rating', 'ASC').addOrderBy('review.createdAt', 'DESC');
    } else if (sort === 'featured') {
      queryBuilder.orderBy('review.isFeatured', 'DESC').addOrderBy('review.createdAt', 'DESC');
    } else {
      queryBuilder.orderBy('review.createdAt', 'DESC');
    }

    queryBuilder.skip(skip).take(limit);

    const [reviews, total] = await queryBuilder.getManyAndCount();

    const items = reviews.map((r) => ({
      id: r.id,
      // Ưu tiên reviewerName (seeded) hoặc lấy từ customer (real)
      customerName: r.reviewerName || (r.customer ? r.customer.fullName : 'Khách hàng ẩn danh'),
      customerAvatar: r.customer ? r.customer.avatar : null,
      rating: r.rating,
      cleanlinessRating: r.cleanlinessRating,
      serviceRating: r.serviceRating,
      comfortRating: r.comfortRating,
      locationRating: r.locationRating,
      valueRating: r.valueRating,
      title: r.title,
      comment: r.comment,
      images: r.images,
      adminReply: r.adminReply,
      // Ưu tiên roomType (seeded) hoặc lấy từ roomCategory (real)
      roomCategoryName: r.roomType || (r.roomCategory ? r.roomCategory.name : null),
      stayPeriod: r.stayPeriod || null,
      source: r.source,
      isFeatured: r.isFeatured,
      createdAt: r.createdAt,
    }));

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  // 7. API Public: Lấy reviews summary
  async getReviewsSummary() {
    const approvedReviews = await this.reviewRepo.find({
      where: { status: ReviewStatus.APPROVED },
    });

    const totalReviews = approvedReviews.length;
    let averageRating = 0;
    // Format mới: five, four, three, two, one
    const ratingDistribution = { five: 0, four: 0, three: 0, two: 0, one: 0 };
    const ratingMap: Record<number, keyof typeof ratingDistribution> = {
      5: 'five', 4: 'four', 3: 'three', 2: 'two', 1: 'one',
    };
    let featuredCount = 0;

    let sumCleanliness = 0, countCleanliness = 0;
    let sumService = 0, countService = 0;
    let sumComfort = 0, countComfort = 0;
    let sumLocation = 0, countLocation = 0;
    let sumValue = 0, countValue = 0;

    if (totalReviews > 0) {
      let sumRating = 0;
      for (const r of approvedReviews) {
        sumRating += r.rating;
        const key = ratingMap[r.rating];
        if (key) ratingDistribution[key]++;
        if (r.isFeatured) featuredCount++;

        if (r.cleanlinessRating !== null) {
          sumCleanliness += r.cleanlinessRating;
          countCleanliness++;
        }
        if (r.serviceRating !== null) {
          sumService += r.serviceRating;
          countService++;
        }
        if (r.comfortRating !== null) {
          sumComfort += r.comfortRating;
          countComfort++;
        }
        if (r.locationRating !== null) {
          sumLocation += r.locationRating;
          countLocation++;
        }
        if (r.valueRating !== null) {
          sumValue += r.valueRating;
          countValue++;
        }
      }
      averageRating = Math.round((sumRating / totalReviews) * 10) / 10;
    }

    const categoryAverages = {
      cleanliness: countCleanliness > 0 ? Math.round((sumCleanliness / countCleanliness) * 10) / 10 : 0,
      service: countService > 0 ? Math.round((sumService / countService) * 10) / 10 : 0,
      comfort: countComfort > 0 ? Math.round((sumComfort / countComfort) * 10) / 10 : 0,
      location: countLocation > 0 ? Math.round((sumLocation / countLocation) * 10) / 10 : 0,
      value: countValue > 0 ? Math.round((sumValue / countValue) * 10) / 10 : 0,
    };

    return {
      averageRating,
      totalReviews,
      ratingDistribution,
      featuredCount,
      categoryAverages,
    };
  }

  // 8. API Admin: Lấy reviews summary đầy đủ các trạng thái
  async getAdminReviewsSummary() {
    const totalReviews = await this.reviewRepo.count();
    const pendingReviews = await this.reviewRepo.count({
      where: { status: ReviewStatus.PENDING },
    });
    const approvedReviews = await this.reviewRepo.count({
      where: { status: ReviewStatus.APPROVED },
    });
    const rejectedReviews = await this.reviewRepo.count({
      where: { status: ReviewStatus.REJECTED },
    });
    const hiddenReviews = await this.reviewRepo.count({
      where: { status: ReviewStatus.HIDDEN },
    });

    const approvedReviewsList = await this.reviewRepo.find({
      where: { status: ReviewStatus.APPROVED },
      select: ['rating'],
    });

    let averageRating = 0;
    if (approvedReviewsList.length > 0) {
      const sum = approvedReviewsList.reduce((acc, r) => acc + r.rating, 0);
      averageRating = Math.round((sum / approvedReviewsList.length) * 10) / 10;
    }

    return {
      totalReviews,
      pendingReviews,
      approvedReviews,
      rejectedReviews,
      hiddenReviews,
      averageRating,
    };
  }

  // 9. API Admin: Danh sách reviews
  async getAdminReviews(query: any) {
    const page = parseInt(query.page || '1', 10);
    const limit = parseInt(query.limit || '10', 10);
    const skip = (page - 1) * limit;

    const queryBuilder = this.reviewRepo.createQueryBuilder('review')
      .leftJoinAndSelect('review.customer', 'customer')
      .leftJoinAndSelect('review.booking', 'booking')
      .leftJoinAndSelect('review.room', 'room');

    if (query.status) {
      queryBuilder.andWhere('review.status = :status', { status: query.status });
    }

    if (query.rating) {
      queryBuilder.andWhere('review.rating = :rating', { rating: parseInt(query.rating, 10) });
    }

    // Filter theo source (SEEDED / CUSTOMER)
    if (query.source) {
      queryBuilder.andWhere('review.source = :source', { source: query.source });
    }

    if (query.roomCategoryId) {
      queryBuilder.andWhere('review.roomCategoryId = :roomCategoryId', { roomCategoryId: query.roomCategoryId });
    }

    if (query.fromDate) {
      queryBuilder.andWhere('review.createdAt >= :fromDate', { fromDate: new Date(query.fromDate) });
    }

    if (query.toDate) {
      const toDate = new Date(query.toDate);
      toDate.setHours(23, 59, 59, 999);
      queryBuilder.andWhere('review.createdAt <= :toDate', { toDate });
    }

    if (query.search) {
      queryBuilder.andWhere(
        '(customer.fullName ILIKE :search OR review.reviewer_name ILIKE :search OR review.title ILIKE :search OR review.comment ILIKE :search OR booking.booking_code ILIKE :search)',
        { search: `%${query.search}%` },
      );
    }

    queryBuilder.orderBy('review.createdAt', 'DESC');
    queryBuilder.skip(skip).take(limit);

    const [reviews, total] = await queryBuilder.getManyAndCount();

    const items = reviews.map((r) => ({
      id: r.id,
      customerName: r.reviewerName || (r.customer ? r.customer.fullName : 'Khách hàng'),
      bookingCode: r.booking ? r.booking.booking_code : null,
      roomName: r.room ? r.room.room_number : null,
      roomType: r.roomType || null,
      stayPeriod: r.stayPeriod || null,
      rating: r.rating,
      title: r.title,
      comment: r.comment,
      status: r.status,
      source: r.source,
      isFeatured: r.isFeatured,
      createdAt: r.createdAt,
    }));

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  // 10. API Admin: Chi tiết review
  async getAdminReviewDetail(id: string) {
    const review = await this.reviewRepo.findOne({
      where: { id },
      relations: ['customer', 'booking', 'room', 'roomCategory'],
    });

    if (!review) {
      throw new NotFoundException('Đánh giá không tồn tại');
    }

    return review;
  }

  // 11. API Admin: Duyệt review
  async approveReview(id: string) {
    const review = await this.reviewRepo.findOne({ where: { id } });
    if (!review) {
      throw new NotFoundException('Đánh giá không tồn tại');
    }

    review.status = ReviewStatus.APPROVED;
    return await this.reviewRepo.save(review);
  }

  // 12. API Admin: Từ chối review
  async rejectReview(id: string, reason: string) {
    const review = await this.reviewRepo.findOne({ where: { id } });
    if (!review) {
      throw new NotFoundException('Đánh giá không tồn tại');
    }

    review.status = ReviewStatus.REJECTED;
    review.rejectReason = reason;
    return await this.reviewRepo.save(review);
  }

  // 13. API Admin: Ẩn review
  async hideReview(id: string) {
    const review = await this.reviewRepo.findOne({ where: { id } });
    if (!review) {
      throw new NotFoundException('Đánh giá không tồn tại');
    }

    review.status = ReviewStatus.HIDDEN;
    return await this.reviewRepo.save(review);
  }

  // 14. API Admin: Phản hồi review
  async replyReview(id: string, adminId: string, reply: string) {
    const review = await this.reviewRepo.findOne({ where: { id } });
    if (!review) {
      throw new NotFoundException('Đánh giá không tồn tại');
    }

    review.adminReply = reply;
    review.adminReplyAt = new Date();
    review.repliedByAdminId = adminId;
    return await this.reviewRepo.save(review);
  }

  // 15. API Admin: Đặt featured
  async toggleFeatured(id: string, isFeatured: boolean) {
    const review = await this.reviewRepo.findOne({ where: { id } });
    if (!review) {
      throw new NotFoundException('Đánh giá không tồn tại');
    }

    review.isFeatured = isFeatured;
    return await this.reviewRepo.save(review);
  }
}
