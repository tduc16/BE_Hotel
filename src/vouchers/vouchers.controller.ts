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
  HttpCode,
  HttpStatus,
  BadRequestException,
} from '@nestjs/common';
import { VouchersService } from './vouchers.service';
import { JwtAdminGuard } from '../admin/auth/guards/jwt-admin.guard';
import { JwtCustomerGuard } from '../customer-auth/guards/jwt-customer.guard';
import { CreateVoucherDto } from './dto/create-voucher.dto';
import { UpdateVoucherDto } from './dto/update-voucher.dto';
import { VoucherStatus, DiscountType, ApplicableTo } from './entities/voucher.entity';

@Controller()
export class VouchersController {
  constructor(private readonly vouchersService: VouchersService) {}

  // ─────────────────────────────────────────────────────────────────────────
  // PUBLIC ENDPOINTS
  // ─────────────────────────────────────────────────────────────────────────

  @Post('vouchers/validate')
  @HttpCode(HttpStatus.OK)
  async validateVoucher(
    @Body()
    body: {
      code: string;
      totalAmount: number;
      customerId?: string;
      guestEmail?: string;
    },
  ) {
    if (!body.code) {
      throw new BadRequestException('Mã voucher không được để trống');
    }
    if (body.totalAmount === undefined || body.totalAmount === null) {
      throw new BadRequestException('Tổng tiền booking không được để trống');
    }

    const result = await this.vouchersService.validateVoucher(
      body.code,
      body.totalAmount,
      body.customerId,
      body.guestEmail,
    );

    if (!result.valid) {
      return {
        valid: false,
        message: result.message,
      };
    }

    return {
      valid: true,
      voucherId: result.voucher?.id,
      code: result.voucher?.code,
      discountAmount: result.discountAmount,
      finalAmount: result.finalAmount,
      message: result.message,
    };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // CUSTOMER ENDPOINTS
  // ─────────────────────────────────────────────────────────────────────────

  @Get('customers/me/vouchers')
  @UseGuards(JwtCustomerGuard)
  async getMyVouchers(@Request() req) {
    const data = await this.vouchersService.getAvailableVouchersForCustomer(req.user.id);
    return {
      success: true,
      data,
    };
  }

  // Route fallback dự phòng cho khách hàng cũ
  @Get('customer/vouchers')
  @UseGuards(JwtCustomerGuard)
  async getMyVouchersFallback(@Request() req) {
    const data = await this.vouchersService.getAvailableVouchersForCustomer(req.user.id);
    return {
      success: true,
      data,
    };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // ADMIN ENDPOINTS
  // ─────────────────────────────────────────────────────────────────────────

  @Get('admin/vouchers')
  @UseGuards(JwtAdminGuard)
  async getAdminVouchers(
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('search') search?: string,
    @Query('status') status?: VoucherStatus,
    @Query('discountType') discountType?: DiscountType,
    @Query('applicableTo') applicableTo?: ApplicableTo,
  ) {
    return this.vouchersService.findAll({
      page,
      limit,
      search,
      status,
      discountType,
      applicableTo,
    });
  }

  @Get('admin/vouchers/:id')
  @UseGuards(JwtAdminGuard)
  async getAdminVoucherById(@Param('id') id: string) {
    const data = await this.vouchersService.findOne(id);
    return {
      success: true,
      data: data.voucher,
      recentUsages: data.recentUsages,
    };
  }

  @Post('admin/vouchers')
  @UseGuards(JwtAdminGuard)
  async createAdminVoucher(@Body() dto: CreateVoucherDto) {
    const data = await this.vouchersService.create(dto);
    return {
      success: true,
      message: 'Tạo voucher mới thành công',
      data,
    };
  }

  @Patch('admin/vouchers/:id')
  @UseGuards(JwtAdminGuard)
  async updateAdminVoucher(@Param('id') id: string, @Body() dto: UpdateVoucherDto) {
    const data = await this.vouchersService.update(id, dto);
    return {
      success: true,
      message: 'Cập nhật voucher thành công',
      data,
    };
  }

  @Patch('admin/vouchers/:id/status')
  @UseGuards(JwtAdminGuard)
  async updateAdminVoucherStatus(
    @Param('id') id: string,
    @Body('status') status: VoucherStatus,
  ) {
    if (!status) {
      throw new BadRequestException('Trạng thái status không được để trống');
    }
    const data = await this.vouchersService.toggleStatus(id, status);
    return {
      success: true,
      message: 'Cập nhật trạng thái voucher thành công',
      data,
    };
  }

  @Delete('admin/vouchers/:id')
  @UseGuards(JwtAdminGuard)
  async deleteAdminVoucher(@Param('id') id: string) {
    const result = await this.vouchersService.remove(id);
    return {
      success: true,
      message: result.message,
    };
  }

  @Get('admin/vouchers/:id/usages')
  @UseGuards(JwtAdminGuard)
  async getAdminVoucherUsages(@Param('id') id: string) {
    const data = await this.vouchersService.getUsages(id);
    return {
      success: true,
      data,
    };
  }
}
