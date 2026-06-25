import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, EntityManager } from 'typeorm';
import { Customer, MembershipLevel } from './entities/customer.entity';
import { Booking, BookingStatus } from '../bookings/entities/booking.entity';
import { BookingHistory } from '../bookings/entities/booking-history.entity';

@Injectable()
export class CustomerService {
  private readonly logger = new Logger(CustomerService.name);

  constructor(
    @InjectRepository(Customer)
    private readonly customerRepo: Repository<Customer>,
    @InjectRepository(Booking)
    private readonly bookingRepo: Repository<Booking>,
    @InjectRepository(BookingHistory)
    private readonly historyRepo: Repository<BookingHistory>,
  ) { }

  async getProfile(customerId: string) {
    const customer = await this.customerRepo.findOne({ where: { id: customerId } });
    if (!customer) {
      throw new NotFoundException('Không tìm thấy tài khoản khách hàng');
    }

    // Tính toán thống kê đặt phòng
    const stats = await this.bookingRepo
      .createQueryBuilder('booking')
      .select('booking.booking_status', 'status')
      .addSelect('COUNT(booking.id)', 'count')
      .addSelect('SUM(booking.total_amount)', 'totalSpent')
      .where('booking.customer_id = :customerId', { customerId })
      .groupBy('booking.booking_status')
      .getRawMany();

    let totalBookings = 0;
    let completedBookings = 0;
    let cancelledBookings = 0;
    let pendingBookings = 0;
    let totalSpent = 0;

    stats.forEach((row) => {
      const count = parseInt(row.count, 10);
      totalBookings += count;
      if (row.status === BookingStatus.CHECKED_OUT) {
        completedBookings = count;
        totalSpent = parseFloat(row.totalSpent || '0');
      } else if (row.status === BookingStatus.CANCELLED) {
        cancelledBookings = count;
      } else if (row.status === BookingStatus.PENDING) {
        pendingBookings = count;
      }
    });

    return {
      ...customer,
      bookingStatistics: {
        totalBookings,
        completedBookings,
        cancelledBookings,
        pendingBookings,
      },
      totalSpent,
    };
  }

  async getBookings(customerId: string) {
    return this.bookingRepo.find({
      where: { customerId },
      relations: ['roomCategory', 'room'],
      order: { created_at: 'DESC' },
    });
  }

  async getBookingById(customerId: string, bookingId: string) {
    const booking = await this.bookingRepo.findOne({
      where: { id: bookingId, customerId },
      relations: ['roomCategory', 'room', 'histories'],
      order: {
        histories: { created_at: 'DESC' },
      },
    });

    if (!booking) {
      throw new NotFoundException('Không tìm thấy đặt phòng hoặc bạn không có quyền truy cập');
    }

    return booking;
  }

  async cancelBooking(customerId: string, bookingId: string) {
    const booking = await this.bookingRepo.findOne({
      where: { id: bookingId, customerId },
    });

    if (!booking) {
      throw new NotFoundException('Không tìm thấy đặt phòng hoặc bạn không có quyền truy cập');
    }

    const prevStatus = booking.booking_status;

    // Chỉ cho phép hủy khi ở trạng thái PENDING hoặc CONFIRMED
    if (
      prevStatus !== BookingStatus.PENDING &&
      prevStatus !== BookingStatus.CONFIRMED
    ) {
      throw new BadRequestException(
        `Không thể hủy đặt phòng ở trạng thái ${prevStatus}. Chỉ PENDING hoặc CONFIRMED mới được hủy.`,
      );
    }

    booking.booking_status = BookingStatus.CANCELLED;
    booking.updated_at = new Date();

    await this.bookingRepo.manager.transaction(async (manager) => {
      await manager.save(Booking, booking);

      // Nếu booking đã được gán phòng, giải phóng phòng đó về trạng thái AVAILABLE
      if (booking.room_id) {
        await manager.query(
          `UPDATE "rooms" SET "status" = 'AVAILABLE' WHERE "id" = $1`,
          [booking.room_id],
        );
      }

      // Tạo lịch sử booking
      const history = manager.create(BookingHistory, {
        booking_id: booking.id,
        action: 'CUSTOMER_CANCEL',
        previous_status: prevStatus,
        new_status: BookingStatus.CANCELLED,
        note: 'Khách hàng tự hủy qua tài khoản',
      });
      await manager.save(BookingHistory, history);
    });

    this.logger.log(`[CUSTOMER_CANCEL] bookingId=${bookingId} customerId=${customerId} prevStatus=${prevStatus}`);

    return { success: true, message: 'Hủy đặt phòng thành công' };
  }

  async getDashboard(customerId: string) {
    const customer = await this.customerRepo.findOne({ where: { id: customerId } });
    if (!customer) {
      throw new NotFoundException('Không tìm thấy tài khoản khách hàng');
    }

    const stats = await this.bookingRepo
      .createQueryBuilder('booking')
      .select('booking.booking_status', 'status')
      .addSelect('COUNT(booking.id)', 'count')
      .addSelect('SUM(booking.total_amount)', 'totalSpent')
      .where('booking.customer_id = :customerId', { customerId })
      .groupBy('booking.booking_status')
      .getRawMany();

    let totalBookings = 0;
    let completedBookings = 0;
    let cancelledBookings = 0;
    let pendingBookings = 0;
    let totalSpent = 0;

    stats.forEach((row) => {
      const count = parseInt(row.count, 10);
      totalBookings += count;
      if (row.status === BookingStatus.CHECKED_OUT) {
        completedBookings = count;
        totalSpent = parseFloat(row.totalSpent || '0');
      } else if (row.status === BookingStatus.CANCELLED) {
        cancelledBookings = count;
      } else if (row.status === BookingStatus.PENDING) {
        pendingBookings = count;
      }
    });

    // Tính toán level tiếp theo
    let nextLevel: MembershipLevel | null = null;
    let pointsToNextLevel = 0;

    if (customer.loyaltyPoints < 300) {
      nextLevel = MembershipLevel.SILVER;
      pointsToNextLevel = 300 - customer.loyaltyPoints;
    } else if (customer.loyaltyPoints < 1000) {
      nextLevel = MembershipLevel.GOLD;
      pointsToNextLevel = 1000 - customer.loyaltyPoints;
    } else if (customer.loyaltyPoints < 2000) {
      nextLevel = MembershipLevel.PLATINUM;
      pointsToNextLevel = 2000 - customer.loyaltyPoints;
    } else {
      nextLevel = null;
      pointsToNextLevel = 0;
    }

    return {
      totalBookings,
      completedBookings,
      cancelledBookings,
      pendingBookings,
      totalSpent,
      loyaltyPoints: customer.loyaltyPoints,
      membershipLevel: customer.membershipLevel,
      nextLevel,
      pointsToNextLevel,
    };
  }

  /**
   * Xử lý tích điểm và thăng hạng thành viên khi booking chuyển sang CHECKED_OUT.
   * Method này có thể chạy trong một transaction của TypeORM (truyền manager).
   */
  async handleBookingCompleted(bookingId: string, manager: EntityManager) {
    const booking = await manager.findOne(Booking, { where: { id: bookingId } });
    if (!booking || !booking.customerId) {
      return;
    }

    const customerId = booking.customerId;
    const customer = await manager.findOne(Customer, { where: { id: customerId } });
    if (!customer) {
      return;
    }

    // 1. Cộng điểm tích lũy (1.000.000đ = 100 điểm, tức là cứ 10.000đ được 1 điểm)
    const pointsToAdd = Math.floor(Number(booking.total_amount) / 10000);
    customer.loyaltyPoints += pointsToAdd;

    // 2. Tự động tính lại hạng thành viên
    // Đếm số booking đã checkout (bao gồm cả booking hiện tại)
    const completedCount = await manager.count(Booking, {
      where: { customerId, booking_status: BookingStatus.CHECKED_OUT },
    });

    // Tính tổng chi tiêu đã checkout
    const stats = await manager
      .createQueryBuilder(Booking, 'booking')
      .select('SUM(booking.total_amount)', 'total')
      .where('booking.customer_id = :customerId AND booking.booking_status = :status', {
        customerId,
        status: BookingStatus.CHECKED_OUT,
      })
      .getRawOne();
    const totalSpent = Number(stats?.total) || 0;

    let newLevel = MembershipLevel.STANDARD;
    if (completedCount >= 10 || totalSpent >= 60000000) {
      newLevel = MembershipLevel.PLATINUM;
    } else if (completedCount >= 6 || totalSpent >= 30000000) {
      newLevel = MembershipLevel.GOLD;
    } else if (completedCount >= 3 || totalSpent >= 10000000) {
      newLevel = MembershipLevel.SILVER;
    }

    const oldLevel = customer.membershipLevel;
    customer.membershipLevel = newLevel;
    await manager.save(Customer, customer);

    this.logger.log(
      `[LOYALTY_UPDATE] Customer ${customer.fullName} (${customerId}): Points ${customer.loyaltyPoints - pointsToAdd} -> ${customer.loyaltyPoints}, Level ${oldLevel} -> ${newLevel}, TotalSpent: ${totalSpent}, CompletedBookings: ${completedCount}`,
    );
  }
}
