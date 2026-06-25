import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  Customer,
  CustomerStatus,
  MembershipLevel,
} from '../../customer/entities/customer.entity';
import { Booking } from '../../bookings/entities/booking.entity';
import { QueryCustomerDto } from './dto/query-customer.dto';
import { UpdateCustomerStatusDto } from './dto/update-customer-status.dto';
import { UpdateCustomerMembershipDto } from './dto/update-customer-membership.dto';
import { AdjustCustomerPointsDto } from './dto/adjust-customer-points.dto';

@Injectable()
export class AdminCustomersService {
  constructor(
    @InjectRepository(Customer)
    private readonly customerRepo: Repository<Customer>,
    @InjectRepository(Booking)
    private readonly bookingRepo: Repository<Booking>,
  ) {}

  // ─────────────────────────────────────────────────────────
  // GET /admin/customers — Danh sách + phân trang + tìm kiếm + lọc
  // ─────────────────────────────────────────────────────────
  async getCustomers(query: QueryCustomerDto) {
    const page = Number(query.page) || 1;
    const limit = Number(query.limit) || 10;
    const skip = (page - 1) * limit;

    // Count query (không có LIMIT/OFFSET để đếm tổng)
    const countQb = this.customerRepo.createQueryBuilder('c');
    this.applyFilters(countQb, query);
    const total = await countQb.getCount();

    // Data query
    const qb = this.customerRepo
      .createQueryBuilder('c')
      .select([
        'c.id          AS id',
        'c.full_name   AS "fullName"',
        'c.email       AS email',
        'c.phone       AS phone',
        'c.avatar      AS avatar',
        'c.membership_level AS "membershipLevel"',
        'c.loyalty_points   AS "loyaltyPoints"',
        'c.status      AS status',
        'c.created_at  AS "createdAt"',
        'COUNT(b.id)::int                    AS "bookingCount"',
        'COALESCE(SUM(b.total_amount), 0)    AS "totalSpent"',
      ])
      .leftJoin('c.bookings', 'b')
      .groupBy('c.id')
      .orderBy('c.created_at', 'DESC')
      .offset(skip)
      .limit(limit);

    this.applyFilters(qb, query);

    const rawData = await qb.getRawMany();

    const data = rawData.map((row) => ({
      id: row.id,
      fullName: row.fullName,
      email: row.email,
      phone: row.phone,
      avatar: row.avatar,
      membershipLevel: row.membershipLevel,
      loyaltyPoints: Number(row.loyaltyPoints) || 0,
      status: row.status,
      createdAt: row.createdAt,
      bookingCount: Number(row.bookingCount) || 0,
      totalSpent: Number(row.totalSpent) || 0,
    }));

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  private applyFilters(qb: any, query: QueryCustomerDto) {
    if (query.search) {
      const s = `%${query.search}%`;
      qb.andWhere(
        '(c.full_name ILIKE :search OR c.email ILIKE :search OR c.phone ILIKE :search)',
        { search: s },
      );
    }
    if (query.fullName) {
      qb.andWhere('c.full_name ILIKE :fullName', { fullName: `%${query.fullName}%` });
    }
    if (query.email) {
      qb.andWhere('c.email ILIKE :email', { email: `%${query.email}%` });
    }
    if (query.phone) {
      qb.andWhere('c.phone ILIKE :phone', { phone: `%${query.phone}%` });
    }
    if (query.status) {
      qb.andWhere('c.status = :status', { status: query.status });
    }
    if (query.membershipLevel) {
      qb.andWhere('c.membership_level = :level', { level: query.membershipLevel });
    }
  }

  // ─────────────────────────────────────────────────────────
  // GET /admin/customers/:id — Chi tiết + thống kê + bookings gần nhất
  // ─────────────────────────────────────────────────────────
  async getCustomerDetail(id: string) {
    const customer = await this.customerRepo.findOne({
      where: { id },
      select: [
        'id',
        'fullName',
        'email',
        'phone',
        'avatar',
        'membershipLevel',
        'loyaltyPoints',
        'status',
        'lastLoginAt',
        'createdAt',
        'updatedAt',
      ],
    });

    if (!customer) {
      throw new NotFoundException(`Không tìm thấy khách hàng với ID: ${id}`);
    }

    // Thống kê tổng hợp
    const statsRaw = await this.bookingRepo
      .createQueryBuilder('b')
      .select('COUNT(b.id)::int', 'bookingCount')
      .addSelect('COALESCE(SUM(b.total_amount), 0)', 'totalSpent')
      .addSelect('COALESCE(SUM(b.night_count), 0)::int', 'totalNights')
      .where('b.customer_id = :id', { id })
      .getRawOne();

    // Booking gần nhất (10 bản ghi)
    const recentBookings = await this.bookingRepo
      .createQueryBuilder('b')
      .leftJoinAndSelect('b.roomCategory', 'rc')
      .leftJoinAndSelect('b.room', 'r')
      .where('b.customer_id = :id', { id })
      .orderBy('b.created_at', 'DESC')
      .take(10)
      .getMany();

    return {
      customer,
      stats: {
        bookingCount: Number(statsRaw?.bookingCount) || 0,
        totalSpent: Number(statsRaw?.totalSpent) || 0,
        totalNights: Number(statsRaw?.totalNights) || 0,
        loyaltyPoints: customer.loyaltyPoints,
      },
      recentBookings: recentBookings.map((b) => ({
        id: b.id,
        bookingCode: b.booking_code,
        checkInDate: b.check_in_date,
        checkOutDate: b.check_out_date,
        nightCount: b.night_count,
        guestCount: b.guest_count,
        totalAmount: Number(b.total_amount),
        bookingStatus: b.booking_status,
        paymentStatus: b.payment_status,
        paymentMethod: b.payment_method,
        roomCategoryName: b.roomCategory?.name || null,
        roomNumber: b.room?.room_number || null,
        createdAt: b.created_at,
      })),
    };
  }

  // ─────────────────────────────────────────────────────────
  // PATCH /admin/customers/:id/status
  // ─────────────────────────────────────────────────────────
  async updateStatus(id: string, dto: UpdateCustomerStatusDto) {
    const customer = await this.customerRepo.findOne({ where: { id } });
    if (!customer) {
      throw new NotFoundException(`Không tìm thấy khách hàng với ID: ${id}`);
    }

    const allowed = [CustomerStatus.ACTIVE, CustomerStatus.BLOCKED];
    if (!allowed.includes(dto.status)) {
      throw new BadRequestException(
        `Trạng thái không hợp lệ. Chỉ cho phép: ${allowed.join(', ')}`,
      );
    }

    await this.customerRepo.update(id, { status: dto.status });

    return {
      id,
      previousStatus: customer.status,
      status: dto.status,
      message:
        dto.status === CustomerStatus.ACTIVE
          ? 'Tài khoản đã được kích hoạt'
          : 'Tài khoản đã bị khóa. Khách hàng không thể đăng nhập hoặc đặt phòng.',
    };
  }

  // ─────────────────────────────────────────────────────────
  // PATCH /admin/customers/:id/membership
  // ─────────────────────────────────────────────────────────
  async updateMembership(id: string, dto: UpdateCustomerMembershipDto) {
    const customer = await this.customerRepo.findOne({ where: { id } });
    if (!customer) {
      throw new NotFoundException(`Không tìm thấy khách hàng với ID: ${id}`);
    }

    await this.customerRepo.update(id, { membershipLevel: dto.membershipLevel });

    return {
      id,
      previousMembership: customer.membershipLevel,
      membershipLevel: dto.membershipLevel,
      message: `Hạng thành viên đã được cập nhật thành ${dto.membershipLevel}`,
    };
  }

  // ─────────────────────────────────────────────────────────
  // PATCH /admin/customers/:id/points
  // ─────────────────────────────────────────────────────────
  async adjustPoints(id: string, dto: AdjustCustomerPointsDto) {
    const customer = await this.customerRepo.findOne({ where: { id } });
    if (!customer) {
      throw new NotFoundException(`Không tìm thấy khách hàng với ID: ${id}`);
    }

    const newPoints = customer.loyaltyPoints + dto.points;
    if (newPoints < 0) {
      throw new BadRequestException(
        `Không thể trừ: điểm hiện tại (${customer.loyaltyPoints}) không đủ để trừ ${Math.abs(dto.points)} điểm`,
      );
    }

    await this.customerRepo.update(id, { loyaltyPoints: newPoints });

    return {
      id,
      previousPoints: customer.loyaltyPoints,
      adjustedPoints: dto.points,
      currentPoints: newPoints,
      reason: dto.reason,
    };
  }

  // ─────────────────────────────────────────────────────────
  // GET /admin/customers/:id/bookings — Lịch sử booking phân trang
  // ─────────────────────────────────────────────────────────
  async getCustomerBookings(id: string, page = 1, limit = 10) {
    const customer = await this.customerRepo.findOne({ where: { id } });
    if (!customer) {
      throw new NotFoundException(`Không tìm thấy khách hàng với ID: ${id}`);
    }

    const skip = (page - 1) * limit;

    const [bookings, total] = await this.bookingRepo
      .createQueryBuilder('b')
      .leftJoinAndSelect('b.roomCategory', 'rc')
      .leftJoinAndSelect('b.room', 'r')
      .where('b.customer_id = :id', { id })
      .orderBy('b.created_at', 'DESC')
      .skip(skip)
      .take(limit)
      .getManyAndCount();

    return {
      data: bookings.map((b) => ({
        id: b.id,
        bookingCode: b.booking_code,
        checkInDate: b.check_in_date,
        checkOutDate: b.check_out_date,
        nightCount: b.night_count,
        guestCount: b.guest_count,
        totalAmount: Number(b.total_amount),
        bookingStatus: b.booking_status,
        paymentStatus: b.payment_status,
        paymentMethod: b.payment_method,
        roomCategoryName: b.roomCategory?.name || null,
        roomNumber: b.room?.room_number || null,
        createdAt: b.created_at,
      })),
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  // ─────────────────────────────────────────────────────────
  // Thống kê tổng quan cho header cards
  // ─────────────────────────────────────────────────────────
  async getCustomerStats() {
    const rawStats = await this.customerRepo
      .createQueryBuilder('c')
      .select('COUNT(*)::int', 'total')
      .addSelect(
        `SUM(CASE WHEN c.status = 'ACTIVE' THEN 1 ELSE 0 END)::int`,
        'active',
      )
      .addSelect(
        `SUM(CASE WHEN c.status = 'BLOCKED' THEN 1 ELSE 0 END)::int`,
        'blocked',
      )
      .addSelect(
        `SUM(CASE WHEN c.membership_level IN ('GOLD','PLATINUM') THEN 1 ELSE 0 END)::int`,
        'vip',
      )
      .getRawOne();

    return {
      totalCustomers: Number(rawStats?.total) || 0,
      activeCustomers: Number(rawStats?.active) || 0,
      blockedCustomers: Number(rawStats?.blocked) || 0,
      vipCustomers: Number(rawStats?.vip) || 0,
    };
  }
}
