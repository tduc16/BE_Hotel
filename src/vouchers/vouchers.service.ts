import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, EntityManager } from 'typeorm';
import {
  Voucher,
  VoucherStatus,
  DiscountType,
  ApplicableTo,
  RequiredMembershipLevel,
} from './entities/voucher.entity';
import { VoucherUsage } from './entities/voucher-usage.entity';
import { Customer, MembershipLevel } from '../customer/entities/customer.entity';
import { Booking, BookingStatus } from '../bookings/entities/booking.entity';
import { CreateVoucherDto } from './dto/create-voucher.dto';
import { UpdateVoucherDto } from './dto/update-voucher.dto';

// Ánh xạ thứ tự hạng thành viên để so sánh
const MEMBERSHIP_LEVEL_ORDER = {
  [RequiredMembershipLevel.STANDARD]: 1,
  [RequiredMembershipLevel.SILVER]: 2,
  [RequiredMembershipLevel.GOLD]: 3,
  [RequiredMembershipLevel.PLATINUM]: 4,
};

@Injectable()
export class VouchersService {
  private readonly logger = new Logger(VouchersService.name);

  constructor(
    @InjectRepository(Voucher)
    private readonly voucherRepo: Repository<Voucher>,
    @InjectRepository(VoucherUsage)
    private readonly usageRepo: Repository<VoucherUsage>,
    @InjectRepository(Customer)
    private readonly customerRepo: Repository<Customer>,
    @InjectRepository(Booking)
    private readonly bookingRepo: Repository<Booking>,
  ) {}

  // ─────────────────────────────────────────────────────────────────────────
  // Admin Methods
  // ─────────────────────────────────────────────────────────────────────────

  async findAll(query: {
    page?: number;
    limit?: number;
    search?: string;
    status?: VoucherStatus;
    discountType?: DiscountType;
    applicableTo?: ApplicableTo;
  }) {
    const page = Number(query.page) || 1;
    const limit = Number(query.limit) || 10;
    const skip = (page - 1) * limit;

    const queryBuilder = this.voucherRepo.createQueryBuilder('voucher');

    if (query.search) {
      queryBuilder.andWhere(
        '(voucher.code ILIKE :search OR voucher.name ILIKE :search)',
        { search: `%${query.search}%` },
      );
    }

    if (query.status) {
      queryBuilder.andWhere('voucher.status = :status', { status: query.status });
    }

    if (query.discountType) {
      queryBuilder.andWhere('voucher.discountType = :discountType', {
        discountType: query.discountType,
      });
    }

    if (query.applicableTo) {
      queryBuilder.andWhere('voucher.applicableTo = :applicableTo', {
        applicableTo: query.applicableTo,
      });
    }

    queryBuilder.orderBy('voucher.createdAt', 'DESC');
    queryBuilder.skip(skip).take(limit);

    const [vouchers, total] = await queryBuilder.getManyAndCount();

    return {
      data: vouchers,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(id: string) {
    const voucher = await this.voucherRepo.findOne({
      where: { id },
      relations: ['usages'],
    });

    if (!voucher) {
      throw new NotFoundException('Không tìm thấy voucher');
    }

    // Lấy 10 lịch sử sử dụng gần nhất
    const recentUsages = await this.usageRepo.find({
      where: { voucherId: id },
      order: { usedAt: 'DESC' },
      take: 10,
    });

    return {
      voucher,
      recentUsages,
    };
  }

  async create(dto: CreateVoucherDto) {
    // Check code unique
    const existing = await this.voucherRepo.findOne({ where: { code: dto.code.toUpperCase() } });
    if (existing) {
      throw new BadRequestException('Mã voucher này đã tồn tại trên hệ thống');
    }

    // Validate dates
    if (new Date(dto.endDate) < new Date(dto.startDate)) {
      throw new BadRequestException('Ngày kết thúc phải lớn hơn hoặc bằng ngày bắt đầu');
    }

    const voucher = this.voucherRepo.create({
      ...dto,
      code: dto.code.toUpperCase(),
    });

    return this.voucherRepo.save(voucher);
  }

  async update(id: string, dto: UpdateVoucherDto) {
    const voucher = await this.voucherRepo.findOne({ where: { id } });
    if (!voucher) {
      throw new NotFoundException('Không tìm thấy voucher');
    }

    if (dto.code) {
      const codeUpper = dto.code.toUpperCase();
      if (codeUpper !== voucher.code) {
        // Kiểm tra xem đã có ai dùng voucher này chưa
        const usageCount = await this.usageRepo.count({ where: { voucherId: id } });
        if (usageCount > 0) {
          throw new BadRequestException('Không thể sửa mã voucher đã phát sinh lượt sử dụng');
        }

        // Check unique code mới
        const existing = await this.voucherRepo.findOne({ where: { code: codeUpper } });
        if (existing) {
          throw new BadRequestException('Mã voucher mới đã tồn tại trên hệ thống');
        }
        voucher.code = codeUpper;
      }
    }

    if (dto.startDate || dto.endDate) {
      const start = dto.startDate || voucher.startDate;
      const end = dto.endDate || voucher.endDate;
      if (new Date(end) < new Date(start)) {
        throw new BadRequestException('Ngày kết thúc phải lớn hơn hoặc bằng ngày bắt đầu');
      }
    }

    // Merge update
    Object.assign(voucher, dto);
    if (dto.code) voucher.code = dto.code.toUpperCase();

    return this.voucherRepo.save(voucher);
  }

  async toggleStatus(id: string, status: VoucherStatus) {
    const voucher = await this.voucherRepo.findOne({ where: { id } });
    if (!voucher) {
      throw new NotFoundException('Không tìm thấy voucher');
    }

    voucher.status = status;
    return this.voucherRepo.save(voucher);
  }

  async remove(id: string) {
    const voucher = await this.voucherRepo.findOne({ where: { id } });
    if (!voucher) {
      throw new NotFoundException('Không tìm thấy voucher');
    }

    const usageCount = await this.usageRepo.count({ where: { voucherId: id } });
    if (usageCount > 0) {
      // Đã có người dùng, chuyển sang INACTIVE để bảo toàn lịch sử
      voucher.status = VoucherStatus.INACTIVE;
      await this.voucherRepo.save(voucher);
      return { success: true, message: 'Voucher đã được chuyển sang trạng thái không hoạt động do đã phát sinh lượt sử dụng.' };
    }

    await this.voucherRepo.remove(voucher);
    return { success: true, message: 'Đã xóa voucher thành công.' };
  }

  async getUsages(id: string) {
    const usages = await this.usageRepo.find({
      where: { voucherId: id },
      order: { usedAt: 'DESC' },
    });
    return usages;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Public & Validation Logic
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Kiểm tra tính hợp lệ của Voucher dựa trên 9 quy tắc.
   * Method này có thể nhận EntityManager để chạy trong cùng 1 Transaction khi tạo booking.
   */
  async validateVoucher(
    code: string,
    totalAmount: number,
    customerId?: string | null,
    guestEmail?: string | null,
    manager?: EntityManager,
  ) {
    const repo = manager ? manager.getRepository(Voucher) : this.voucherRepo;
    const usageRepo = manager ? manager.getRepository(VoucherUsage) : this.usageRepo;
    const customerRepo = manager ? manager.getRepository(Customer) : this.customerRepo;
    const bookingRepo = manager ? manager.getRepository(Booking) : this.bookingRepo;

    const codeUpper = code.trim().toUpperCase();
    const voucher = await repo.findOne({ where: { code: codeUpper } });

    if (!voucher) {
      return { valid: false, message: 'Voucher không tồn tại' };
    }

    // 1. Kiểm tra trạng thái ACTIVE
    if (voucher.status !== VoucherStatus.ACTIVE) {
      return { valid: false, message: 'Voucher hiện tại đang không hoạt động' };
    }

    // 2. Ngày hiện tại nằm trong startDate - endDate
    const todayStr = new Date().toISOString().substring(0, 10);
    if (todayStr < voucher.startDate) {
      return { valid: false, message: `Voucher chưa đến thời gian áp dụng (Bắt đầu từ: ${voucher.startDate})` };
    }
    if (todayStr > voucher.endDate) {
      return { valid: false, message: 'Voucher đã hết hạn sử dụng' };
    }

    // 3. usedCount chưa vượt usageLimit
    if (voucher.usageLimit !== null && voucher.usedCount >= voucher.usageLimit) {
      return { valid: false, message: 'Voucher đã đạt giới hạn lượt sử dụng tối đa' };
    }

    // 4. Khách chưa vượt usageLimitPerCustomer
    if (voucher.usageLimitPerCustomer !== null) {
      let currentCustomerUsage = 0;
      if (customerId) {
        currentCustomerUsage = await usageRepo.count({
          where: { voucherId: voucher.id, customerId },
        });
      } else if (guestEmail) {
        currentCustomerUsage = await usageRepo.count({
          where: { voucherId: voucher.id, guestEmail },
        });
      }
      if (currentCustomerUsage >= voucher.usageLimitPerCustomer) {
        return {
          valid: false,
          message: `Bạn đã sử dụng voucher này tối đa ${voucher.usageLimitPerCustomer} lần cho phép`,
        };
      }
    }

    // 5. Tổng tiền booking >= minBookingAmount
    if (voucher.minBookingAmount !== null && totalAmount < Number(voucher.minBookingAmount)) {
      return {
        valid: false,
        message: `Giá trị đơn đặt phòng chưa đạt tối thiểu (${new Intl.NumberFormat('vi-VN', {
          style: 'currency',
          currency: 'VND',
        }).format(Number(voucher.minBookingAmount))})`,
      };
    }

    // Thông tin khách hàng (nếu đăng nhập) để kiểm tra các rule tiếp theo
    let customer: Customer | null = null;
    let completedBookingsCount = 0;
    let totalSpentAmount = 0;

    if (customerId) {
      customer = await customerRepo.findOne({ where: { id: customerId } });
      if (customer) {
        // Đếm số booking đã checkout
        completedBookingsCount = await bookingRepo.count({
          where: { customerId, booking_status: BookingStatus.CHECKED_OUT },
        });
        // Tính tổng tiền đã check_out
        const stats = await bookingRepo
          .createQueryBuilder('booking')
          .select('SUM(booking.total_amount)', 'total')
          .where('booking.customer_id = :customerId AND booking.booking_status = :status', {
            customerId,
            status: BookingStatus.CHECKED_OUT,
          })
          .getRawOne();
        totalSpentAmount = Number(stats?.total) || 0;
      }
    }

    // 6. Nếu MEMBER_ONLY thì khách phải đăng nhập
    if (voucher.applicableTo === ApplicableTo.MEMBER_ONLY && !customerId) {
      return { valid: false, message: 'Voucher này chỉ áp dụng cho khách hàng đã đăng ký thành viên và đăng nhập' };
    }

    // Nếu GUEST_ONLY thì khách hàng đăng nhập không được dùng
    if (voucher.applicableTo === ApplicableTo.GUEST_ONLY && customerId) {
      return { valid: false, message: 'Voucher này chỉ dành cho khách vãng lai (chưa đăng nhập)' };
    }

    // 7. Nếu MEMBERSHIP_LEVEL thì khách phải đạt đúng hoặc cao hơn requiredMembershipLevel
    if (voucher.applicableTo === ApplicableTo.MEMBERSHIP_LEVEL) {
      if (!customerId || !customer) {
        return { valid: false, message: 'Voucher yêu cầu hạng thành viên, vui lòng đăng nhập tài khoản' };
      }
      const requiredLevelVal = MEMBERSHIP_LEVEL_ORDER[voucher.requiredMembershipLevel || RequiredMembershipLevel.STANDARD];
      const customerLevelVal = MEMBERSHIP_LEVEL_ORDER[customer.membershipLevel || RequiredMembershipLevel.STANDARD];

      if (customerLevelVal < requiredLevelVal) {
        return {
          valid: false,
          message: `Voucher yêu cầu hạng thành viên từ ${voucher.requiredMembershipLevel} trở lên. Hạng của bạn hiện tại là ${customer.membershipLevel}`,
        };
      }
    }

    // 8. Nếu requiredBookingCount thì khách phải có số booking hoàn tất >= điều kiện
    if (voucher.requiredBookingCount !== null) {
      if (!customerId) {
        return { valid: false, message: 'Mã giảm giá yêu cầu số lần đặt phòng trước đó, vui lòng đăng nhập' };
      }
      if (completedBookingsCount < voucher.requiredBookingCount) {
        return {
          valid: false,
          message: `Voucher yêu cầu tối thiểu ${voucher.requiredBookingCount} lần đặt phòng hoàn thành (Bạn đã có: ${completedBookingsCount} lần)`,
        };
      }
    }

    // 9. Nếu requiredTotalSpent thì tổng chi tiêu của khách >= điều kiện
    if (voucher.requiredTotalSpent !== null) {
      if (!customerId) {
        return { valid: false, message: 'Mã giảm giá yêu cầu tổng chi tiêu tích lũy, vui lòng đăng nhập' };
      }
      if (totalSpentAmount < Number(voucher.requiredTotalSpent)) {
        const diffStr = new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(
          Number(voucher.requiredTotalSpent),
        );
        return {
          valid: false,
          message: `Voucher yêu cầu tổng chi tiêu tích lũy tối thiểu ${diffStr} (Bạn hiện có: ${new Intl.NumberFormat(
            'vi-VN',
            { style: 'currency', currency: 'VND' },
          ).format(totalSpentAmount)})`,
        };
      }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // DISCOUNT CALCULATION
    // ─────────────────────────────────────────────────────────────────────────
    let discountAmount = 0;
    if (voucher.discountType === DiscountType.PERCENT) {
      discountAmount = (totalAmount * Number(voucher.discountValue)) / 100;
      if (voucher.maxDiscountAmount !== null) {
        discountAmount = Math.min(discountAmount, Number(voucher.maxDiscountAmount));
      }
    } else if (voucher.discountType === DiscountType.FIXED_AMOUNT) {
      discountAmount = Number(voucher.discountValue);
    }

    // Không cho discountAmount > totalAmount
    if (discountAmount > totalAmount) {
      discountAmount = totalAmount;
    }

    const finalAmount = totalAmount - discountAmount;

    return {
      valid: true,
      voucher,
      discountAmount,
      finalAmount,
      message: 'Áp dụng voucher thành công',
    };
  }

  /**
   * Lấy danh sách vouchers mà khách hàng thỏa mãn và chưa thỏa mãn (để hiển thị lý do).
   */
  async getAvailableVouchersForCustomer(customerId: string) {
    const customer = await this.customerRepo.findOne({ where: { id: customerId } });
    if (!customer) {
      throw new NotFoundException('Không tìm thấy tài khoản khách hàng');
    }

    // Tính toán số booking và tổng chi tiêu checked_out
    const completedBookingsCount = await this.bookingRepo.count({
      where: { customerId, booking_status: BookingStatus.CHECKED_OUT },
    });
    const stats = await this.bookingRepo
      .createQueryBuilder('booking')
      .select('SUM(booking.total_amount)', 'total')
      .where('booking.customer_id = :customerId AND booking.booking_status = :status', {
        customerId,
        status: BookingStatus.CHECKED_OUT,
      })
      .getRawOne();
    const totalSpentAmount = Number(stats?.total) || 0;

    // Lấy tất cả voucher ACTIVE
    const todayStr = new Date().toISOString().substring(0, 10);
    const activeVouchers = await this.voucherRepo.find({
      where: { status: VoucherStatus.ACTIVE },
    });

    const result: any[] = [];

    for (const voucher of activeVouchers) {
      // Bỏ qua nếu quá hạn
      if (todayStr > voucher.endDate || todayStr < voucher.startDate) {
        continue;
      }
      // Bỏ qua nếu hết lượt sử dụng chung
      if (voucher.usageLimit !== null && voucher.usedCount >= voucher.usageLimit) {
        continue;
      }
      // Bỏ qua nếu chỉ dành cho Guest
      if (voucher.applicableTo === ApplicableTo.GUEST_ONLY) {
        continue;
      }

      // Check lượt dùng của khách hàng này
      const currentUsage = await this.usageRepo.count({
        where: { voucherId: voucher.id, customerId },
      });
      if (voucher.usageLimitPerCustomer !== null && currentUsage >= voucher.usageLimitPerCustomer) {
        // Khách hàng đã dùng hết lượt cho phép
        continue;
      }

      // Kiểm tra xem có hợp lệ về các quy tắc hạng/booking/chi tiêu không
      let isEligible = true;
      let reason = '';

      // Check membership level
      if (voucher.applicableTo === ApplicableTo.MEMBERSHIP_LEVEL) {
        const requiredLevelVal = MEMBERSHIP_LEVEL_ORDER[voucher.requiredMembershipLevel || RequiredMembershipLevel.STANDARD];
        const customerLevelVal = MEMBERSHIP_LEVEL_ORDER[customer.membershipLevel || RequiredMembershipLevel.STANDARD];
        if (customerLevelVal < requiredLevelVal) {
          isEligible = false;
          reason = `Yêu cầu hạng thành viên từ ${voucher.requiredMembershipLevel} trở lên (Hạng của bạn: ${customer.membershipLevel})`;
        }
      }

      // Check booking count
      if (voucher.requiredBookingCount !== null && completedBookingsCount < voucher.requiredBookingCount) {
        isEligible = false;
        const diff = voucher.requiredBookingCount - completedBookingsCount;
        reason = `Cần hoàn thành thêm ${diff} booking nữa để nhận voucher này`;
      }

      // Check total spent
      if (voucher.requiredTotalSpent !== null && totalSpentAmount < Number(voucher.requiredTotalSpent)) {
        isEligible = false;
        const diff = Number(voucher.requiredTotalSpent) - totalSpentAmount;
        const diffStr = new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(diff);
        reason = `Cần tích luỹ thêm ${diffStr} chi tiêu đặt phòng để nhận voucher này`;
      }

      result.push({
        id: voucher.id,
        code: voucher.code,
        name: voucher.name,
        description: voucher.description,
        discountType: voucher.discountType,
        discountValue: Number(voucher.discountValue),
        maxDiscountAmount: voucher.maxDiscountAmount ? Number(voucher.maxDiscountAmount) : null,
        minBookingAmount: voucher.minBookingAmount ? Number(voucher.minBookingAmount) : null,
        endDate: voucher.endDate,
        isPublic: voucher.isPublic,
        isEligible,
        reason,
      });
    }

    // Sắp xếp: các voucher đủ điều kiện lên trước, isPublic lên trước
    return result.sort((a, b) => {
      if (a.isEligible && !b.isEligible) return -1;
      if (!a.isEligible && b.isEligible) return 1;
      return b.isPublic ? 1 : -1;
    });
  }
}
