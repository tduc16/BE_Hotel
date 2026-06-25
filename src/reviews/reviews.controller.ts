import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  BadRequestException,
} from '@nestjs/common';
import { ReviewsService } from './reviews.service';
import { JwtAdminGuard } from '../admin/auth/guards/jwt-admin.guard';
import { JwtCustomerGuard } from '../customer-auth/guards/jwt-customer.guard';
import { CreateReviewDto } from './dto/create-review.dto';
import { UpdateReviewDto } from './dto/update-review.dto';
import { AdminReplyDto } from './dto/admin-reply.dto';
import { RejectReviewDto } from './dto/reject-review.dto';

// ─────────────────────────────────────────────────────────────────────────
// PUBLIC CONTROLLER
// ─────────────────────────────────────────────────────────────────────────
@Controller('reviews')
export class PublicReviewsController {
  constructor(private readonly reviewsService: ReviewsService) {}

  @Get()
  async getApprovedReviews(
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('rating') rating?: number,
    @Query('roomCategoryId') roomCategoryId?: string,
    @Query('sort') sort?: string,
    @Query('featured') featured?: string | boolean,
  ) {
    return this.reviewsService.getApprovedReviews({
      page,
      limit,
      rating,
      roomCategoryId,
      sort,
      featured,
    });
  }

  @Get('summary')
  async getSummary() {
    const data = await this.reviewsService.getReviewsSummary();
    return {
      success: true,
      data,
    };
  }
}

// ─────────────────────────────────────────────────────────────────────────
// CUSTOMER CONTROLLER
// ─────────────────────────────────────────────────────────────────────────
@Controller('customer/reviews')
@UseGuards(JwtCustomerGuard)
export class CustomerReviewsController {
  constructor(private readonly reviewsService: ReviewsService) {}

  @Get('eligible-bookings')
  async getEligibleBookings(@Request() req) {
    const data = await this.reviewsService.getEligibleBookings(req.user.id);
    return {
      success: true,
      data,
    };
  }

  @Post()
  async createReview(@Request() req, @Body() dto: CreateReviewDto) {
    const data = await this.reviewsService.createReview(req.user.id, dto);
    return {
      success: true,
      message: 'Gửi đánh giá thành công và đang chờ duyệt.',
      data,
    };
  }

  @Get('my-reviews')
  async getMyReviews(@Request() req) {
    const data = await this.reviewsService.getMyReviews(req.user.id);
    return {
      success: true,
      data,
    };
  }

  @Patch(':id')
  async updateReview(
    @Request() req,
    @Param('id') id: string,
    @Body() dto: UpdateReviewDto,
  ) {
    const data = await this.reviewsService.updateReview(req.user.id, id, dto);
    return {
      success: true,
      message: 'Cập nhật đánh giá thành công',
      data,
    };
  }

  @Delete(':id')
  async deleteReview(@Request() req, @Param('id') id: string) {
    await this.reviewsService.deleteReview(req.user.id, id);
    return {
      success: true,
      message: 'Xóa đánh giá thành công',
    };
  }
}

// ─────────────────────────────────────────────────────────────────────────
// ADMIN CONTROLLER
// ─────────────────────────────────────────────────────────────────────────
@Controller('admin/reviews')
@UseGuards(JwtAdminGuard)
export class AdminReviewsController {
  constructor(private readonly reviewsService: ReviewsService) {}

  @Get('summary')
  async getAdminSummary() {
    const data = await this.reviewsService.getAdminReviewsSummary();
    return {
      success: true,
      data,
    };
  }

  @Get()
  async getAdminReviews(
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('search') search?: string,
    @Query('status') status?: string,
    @Query('rating') rating?: number,
    @Query('source') source?: string,
    @Query('roomCategoryId') roomCategoryId?: string,
    @Query('fromDate') fromDate?: string,
    @Query('toDate') toDate?: string,
  ) {
    return this.reviewsService.getAdminReviews({
      page,
      limit,
      search,
      status,
      rating,
      source,
      roomCategoryId,
      fromDate,
      toDate,
    });
  }

  @Get(':id')
  async getAdminReviewDetail(@Param('id') id: string) {
    const data = await this.reviewsService.getAdminReviewDetail(id);
    return {
      success: true,
      data,
    };
  }

  @Patch(':id/approve')
  async approveReview(@Param('id') id: string) {
    const data = await this.reviewsService.approveReview(id);
    return {
      success: true,
      message: 'Phê duyệt đánh giá thành công',
      data,
    };
  }

  @Patch(':id/reject')
  async rejectReview(@Param('id') id: string, @Body() dto: RejectReviewDto) {
    const data = await this.reviewsService.rejectReview(id, dto.reason);
    return {
      success: true,
      message: 'Từ chối đánh giá thành công',
      data,
    };
  }

  @Patch(':id/hide')
  async hideReview(@Param('id') id: string) {
    const data = await this.reviewsService.hideReview(id);
    return {
      success: true,
      message: 'Ẩn đánh giá thành công',
      data,
    };
  }

  @Patch(':id/reply')
  async replyReview(
    @Request() req,
    @Param('id') id: string,
    @Body() dto: AdminReplyDto,
  ) {
    const data = await this.reviewsService.replyReview(id, req.admin.id, dto.reply);
    return {
      success: true,
      message: 'Phản hồi đánh giá thành công',
      data,
    };
  }

  @Patch(':id/featured')
  async toggleFeatured(
    @Param('id') id: string,
    @Body('isFeatured') isFeatured: boolean,
  ) {
    if (isFeatured === undefined || isFeatured === null) {
      throw new BadRequestException('Trường isFeatured không được để trống');
    }
    const data = await this.reviewsService.toggleFeatured(id, isFeatured);
    return {
      success: true,
      message: isFeatured ? 'Đã gán đánh giá nổi bật' : 'Đã hủy gán đánh giá nổi bật',
      data,
    };
  }
}
