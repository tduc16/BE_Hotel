import {
  Controller,
  Get,
  Param,
  Patch,
  Query,
  UseGuards,
  Body,
  ParseUUIDPipe,
  ParseIntPipe,
  DefaultValuePipe,
} from '@nestjs/common';
import { AdminCustomersService } from './admin-customers.service';
import { JwtAdminGuard } from '../auth/guards/jwt-admin.guard';
import { QueryCustomerDto } from './dto/query-customer.dto';
import { UpdateCustomerStatusDto } from './dto/update-customer-status.dto';
import { UpdateCustomerMembershipDto } from './dto/update-customer-membership.dto';
import { AdjustCustomerPointsDto } from './dto/adjust-customer-points.dto';

@UseGuards(JwtAdminGuard)
@Controller('admin/customers')
export class AdminCustomersController {
  constructor(private readonly service: AdminCustomersService) {}

  /**
   * GET /admin/customers
   * Danh sách khách hàng — phân trang, tìm kiếm, lọc
   */
  @Get()
  async getCustomers(@Query() query: QueryCustomerDto) {
    const [list, stats] = await Promise.all([
      this.service.getCustomers(query),
      this.service.getCustomerStats(),
    ]);
    return {
      success: true,
      data: list.data,
      meta: list.meta,
      stats,
    };
  }

  /**
   * GET /admin/customers/:id
   * Chi tiết khách hàng + thống kê + booking gần nhất
   */
  @Get(':id')
  async getCustomerDetail(@Param('id', ParseUUIDPipe) id: string) {
    const result = await this.service.getCustomerDetail(id);
    return { success: true, data: result };
  }

  /**
   * GET /admin/customers/:id/bookings
   * Lịch sử booking của khách hàng (phân trang)
   */
  @Get(':id/bookings')
  async getCustomerBookings(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number,
  ) {
    const result = await this.service.getCustomerBookings(id, page, limit);
    return { success: true, data: result.data, meta: result.meta };
  }

  /**
   * PATCH /admin/customers/:id/status
   * Cập nhật trạng thái: ACTIVE | BLOCKED
   */
  @Patch(':id/status')
  async updateStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCustomerStatusDto,
  ) {
    const result = await this.service.updateStatus(id, dto);
    return { success: true, data: result };
  }

  /**
   * PATCH /admin/customers/:id/membership
   * Cập nhật hạng thành viên: STANDARD | SILVER | GOLD | PLATINUM
   */
  @Patch(':id/membership')
  async updateMembership(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCustomerMembershipDto,
  ) {
    const result = await this.service.updateMembership(id, dto);
    return { success: true, data: result };
  }

  /**
   * PATCH /admin/customers/:id/points
   * Điều chỉnh điểm tích lũy (points > 0: cộng, points < 0: trừ)
   */
  @Patch(':id/points')
  async adjustPoints(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AdjustCustomerPointsDto,
  ) {
    const result = await this.service.adjustPoints(id, dto);
    return { success: true, data: result };
  }
}
