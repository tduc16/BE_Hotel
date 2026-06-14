import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, In } from 'typeorm';
import { Room } from '../../rooms/entities/room.entity';
import { RoomCategory } from '../../rooms/entities/room-category.entity';
import { Booking } from '../../bookings/entities/booking.entity';
import { Customer } from '../../customer/entities/customer.entity';
import { BookingStatus, PaymentStatus } from '../../bookings/entities/booking.enums';

@Injectable()
export class AdminDashboardService {
  constructor(
    @InjectRepository(Room)
    private readonly roomRepo: Repository<Room>,
    @InjectRepository(RoomCategory)
    private readonly categoryRepo: Repository<RoomCategory>,
    @InjectRepository(Booking)
    private readonly bookingRepo: Repository<Booking>,
    @InjectRepository(Customer)
    private readonly customerRepo: Repository<Customer>,
  ) {}

  async getDashboardData(revenueFilter: string = '30days') {
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];

    // --- 1. THỜI GIAN THỐNG KÊ (THÁNG NÀY & THÁNG TRƯỚC) ---
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

    const startOfPrevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const endOfPrevMonth = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);

    const daysInMonth = now.getDate();
    const daysInPrevMonth = new Date(now.getFullYear(), now.getMonth(), 0).getDate();

    // --- 2. TRUY VẤN CƠ BẢN ĐỂ TÍNH TOÁN KPI ---
    // Doanh thu trọn đời
    const totalRevenueResult = await this.bookingRepo
      .createQueryBuilder('booking')
      .select('SUM(booking.total_amount)', 'sum')
      .where('booking.payment_status = :status', { status: PaymentStatus.PAID })
      .getRawOne();
    const totalRevenue = parseFloat(totalRevenueResult?.sum || '0');

    // Doanh thu tháng này
    const revMonthResult = await this.bookingRepo
      .createQueryBuilder('booking')
      .select('SUM(booking.total_amount)', 'sum')
      .where('booking.payment_status = :status', { status: PaymentStatus.PAID })
      .andWhere('booking.created_at BETWEEN :start AND :end', { start: startOfMonth, end: endOfToday })
      .getRawOne();
    const revMonth = parseFloat(revMonthResult?.sum || '0');

    // Doanh thu tháng trước
    const revPrevMonthResult = await this.bookingRepo
      .createQueryBuilder('booking')
      .select('SUM(booking.total_amount)', 'sum')
      .where('booking.payment_status = :status', { status: PaymentStatus.PAID })
      .andWhere('booking.created_at BETWEEN :start AND :end', { start: startOfPrevMonth, end: endOfPrevMonth })
      .getRawOne();
    const revPrevMonth = parseFloat(revPrevMonthResult?.sum || '0');

    // Tính tăng trưởng doanh thu
    let revenueGrowth = 0;
    if (revPrevMonth > 0) {
      revenueGrowth = ((revMonth - revPrevMonth) / revPrevMonth) * 100;
    } else if (revMonth > 0) {
      revenueGrowth = 100;
    }

    // Đặt phòng: Tổng đặt phòng
    const totalBookings = await this.bookingRepo.count();

    // Đặt phòng tháng này
    const bookingsMonth = await this.bookingRepo.count({
      where: {
        created_at: Between(startOfMonth, endOfToday),
      },
    });

    // Đặt phòng tháng trước
    const bookingsPrevMonth = await this.bookingRepo.count({
      where: {
        created_at: Between(startOfPrevMonth, endOfPrevMonth),
      },
    });

    // Tính tăng trưởng đặt phòng
    let bookingGrowth = 0;
    if (bookingsPrevMonth > 0) {
      bookingGrowth = ((bookingsMonth - bookingsPrevMonth) / bookingsPrevMonth) * 100;
    } else if (bookingsMonth > 0) {
      bookingGrowth = 100;
    }

    // Khách hàng mới tháng này
    const newCustomers = await this.customerRepo.count({
      where: {
        createdAt: Between(startOfMonth, endOfToday),
      },
    });

    // Khách hàng mới tháng trước
    const customersPrevMonth = await this.customerRepo.count({
      where: {
        createdAt: Between(startOfPrevMonth, endOfPrevMonth),
      },
    });

    // Tính tăng trưởng khách hàng
    let customerGrowth = 0;
    if (customersPrevMonth > 0) {
      customerGrowth = ((newCustomers - customersPrevMonth) / customersPrevMonth) * 100;
    } else if (newCustomers > 0) {
      customerGrowth = 100;
    }

    // Tỷ lệ lấp đầy phòng trung bình và tăng trưởng
    const totalRooms = await this.roomRepo.count();

    // Số lượng đêm phòng được đặt tháng này
    const activeStatuses = [BookingStatus.CONFIRMED, BookingStatus.CHECKED_IN, BookingStatus.CHECKED_OUT];
    const bookingsForOccupancyMonth = await this.bookingRepo.find({
      where: {
        booking_status: In(activeStatuses),
      },
    });

    // Hàm tính số đêm phòng được đặt trong một khoảng thời gian
    const calculateOccupiedNights = (bookings: Booking[], start: Date, end: Date): number => {
      let nights = 0;
      const startTime = start.getTime();
      const endTime = end.getTime();

      for (const booking of bookings) {
        const checkIn = new Date(booking.check_in_date).getTime();
        const checkOut = new Date(booking.check_out_date).getTime();

        // Khoảng giao nhau
        const overlapStart = Math.max(startTime, checkIn);
        const overlapEnd = Math.min(endTime, checkOut);

        if (overlapStart < overlapEnd) {
          nights += Math.round((overlapEnd - overlapStart) / (1000 * 60 * 60 * 24));
        }
      }
      return nights;
    };

    const occupiedNightsMonth = calculateOccupiedNights(bookingsForOccupancyMonth, startOfMonth, endOfToday);
    const occupiedNightsPrevMonth = calculateOccupiedNights(bookingsForOccupancyMonth, startOfPrevMonth, endOfPrevMonth);

    const occupancyRate = totalRooms > 0 && daysInMonth > 0 
      ? (occupiedNightsMonth / (totalRooms * daysInMonth)) * 100 
      : 0;

    const occupancyPrevRate = totalRooms > 0 && daysInPrevMonth > 0 
      ? (occupiedNightsPrevMonth / (totalRooms * daysInPrevMonth)) * 100 
      : 0;

    let occupancyGrowth = 0;
    if (occupancyPrevRate > 0) {
      occupancyGrowth = ((occupancyRate - occupancyPrevRate) / occupancyPrevRate) * 100;
    } else if (occupancyRate > 0) {
      occupancyGrowth = 100;
    }

    // --- 3. TODAY STATS ---
    const checkInsToday = await this.bookingRepo.count({
      where: {
        check_in_date: todayStr,
        booking_status: In([BookingStatus.CONFIRMED, BookingStatus.CHECKED_IN]),
      },
    });

    const checkOutsToday = await this.bookingRepo.count({
      where: {
        check_out_date: todayStr,
        booking_status: In([BookingStatus.CHECKED_IN, BookingStatus.CHECKED_OUT]),
      },
    });

    // Lấy khoảng thời gian của ngày hôm nay
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    const bookingsToday = await this.bookingRepo.count({
      where: {
        created_at: Between(startOfToday, endOfToday),
      },
    });

    const revTodayResult = await this.bookingRepo
      .createQueryBuilder('booking')
      .select('SUM(booking.total_amount)', 'sum')
      .where('booking.payment_status = :status', { status: PaymentStatus.PAID })
      .andWhere('booking.created_at BETWEEN :start AND :end', { start: startOfToday, end: endOfToday })
      .getRawOne();
    const revenueToday = parseFloat(revTodayResult?.sum || '0');

    // --- 4. ROOM STATUS ---
    const roomStatusRaw = await this.roomRepo
      .createQueryBuilder('room')
      .select('room.status', 'status')
      .addSelect('COUNT(room.id)', 'count')
      .groupBy('room.status')
      .getRawMany();

    const roomStatus = {
      available: 0,
      occupied: 0,
      cleaning: 0,
      maintenance: 0,
    };

    for (const item of roomStatusRaw) {
      const statusKey = item.status.toLowerCase();
      if (statusKey in roomStatus) {
        roomStatus[statusKey] = parseInt(item.count);
      }
    }

    // --- 5. REVENUE CHART DATA ---
    const revenueChart: { label: string; revenue: number }[] = [];
    let chartStartDate: Date;

    if (revenueFilter === '7days') {
      chartStartDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6, 0, 0, 0, 0);
    } else if (revenueFilter === '12months') {
      chartStartDate = new Date(now.getFullYear(), now.getMonth() - 11, 1, 0, 0, 0, 0);
    } else {
      // Mặc định 30days
      chartStartDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 29, 0, 0, 0, 0);
    }

    const chartBookings = await this.bookingRepo.find({
      where: {
        payment_status: PaymentStatus.PAID,
        created_at: Between(chartStartDate, endOfToday),
      },
      order: {
        created_at: 'ASC',
      },
    });

    if (revenueFilter === '12months') {
      // Gom nhóm theo tháng (MM/YYYY)
      const monthlyData: { [key: string]: number } = {};
      for (let i = 0; i < 12; i++) {
        const d = new Date(now.getFullYear(), now.getMonth() - 11 + i, 1);
        const label = `${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
        monthlyData[label] = 0;
      }

      for (const booking of chartBookings) {
        const d = new Date(booking.created_at);
        const label = `${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
        if (label in monthlyData) {
          monthlyData[label] += parseFloat(booking.total_amount as any);
        }
      }

      for (const label of Object.keys(monthlyData)) {
        revenueChart.push({ label, revenue: monthlyData[label] });
      }
    } else {
      // Gom nhóm theo ngày (DD/MM)
      const dailyData: { [key: string]: number } = {};
      const limitDays = revenueFilter === '7days' ? 7 : 30;

      for (let i = 0; i < limitDays; i++) {
        const d = new Date(chartStartDate.getTime() + i * 24 * 60 * 60 * 1000);
        const label = `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
        dailyData[label] = 0;
      }

      for (const booking of chartBookings) {
        const d = new Date(booking.created_at);
        const label = `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
        if (label in dailyData) {
          dailyData[label] += parseFloat(booking.total_amount as any);
        }
      }

      for (const label of Object.keys(dailyData)) {
        revenueChart.push({ label, revenue: dailyData[label] });
      }
    }

    // --- 6. RECENT BOOKINGS ---
    const recentBookings = await this.bookingRepo.find({
      relations: ['roomCategory'],
      order: {
        created_at: 'DESC',
      },
      take: 5,
    });

    // --- 7. TOP ROOM CATEGORIES ---
    const topRoomsRaw = await this.bookingRepo
      .createQueryBuilder('booking')
      .leftJoinAndSelect('booking.roomCategory', 'category')
      .select('category.name', 'roomName')
      .addSelect('COUNT(booking.id)', 'bookingCount')
      .groupBy('category.id')
      .addGroupBy('category.name')
      .orderBy('COUNT(booking.id)', 'DESC')
      .limit(5)
      .getRawMany();

    const topRooms = topRoomsRaw.map((item) => ({
      roomName: item.roomName,
      bookingCount: parseInt(item.bookingCount),
    }));

    // --- 8. TOP CUSTOMERS ---
    const topCustomersRaw = await this.bookingRepo
      .createQueryBuilder('booking')
      .leftJoin(Customer, 'customer', 'booking.customer_id = customer.id')
      .select('booking.customer_name', 'customerName')
      .addSelect('COUNT(booking.id)', 'bookingCount')
      .addSelect('SUM(booking.total_amount)', 'totalSpent')
      .addSelect('MAX(customer.membership_level)', 'membershipLevel')
      .where('booking.payment_status = :status', { status: PaymentStatus.PAID })
      .groupBy('booking.customer_name')
      .addGroupBy('booking.customer_id')
      .orderBy('SUM(booking.total_amount)', 'DESC')
      .limit(5)
      .getRawMany();

    const topCustomers = topCustomersRaw.map((item) => ({
      customerName: item.customerName,
      bookingCount: parseInt(item.bookingCount),
      totalSpent: parseFloat(item.totalSpent || '0'),
      membershipLevel: item.membershipLevel || 'STANDARD',
    }));

    // --- 9. ALERTS ---
    const alerts: string[] = [];

    // Cảnh báo số lượng check-in hôm nay
    if (checkInsToday > 0) {
      alerts.push(`Hôm nay có ${checkInsToday} lượt nhận phòng cần xử lý.`);
    }

    // Cảnh báo đặt phòng chưa thanh toán
    const unpaidCount = await this.bookingRepo.count({
      where: {
        payment_status: PaymentStatus.UNPAID,
        booking_status: In([BookingStatus.PENDING, BookingStatus.CONFIRMED]),
      },
    });
    if (unpaidCount > 0) {
      alerts.push(`Phát hiện ${unpaidCount} đặt phòng chưa được thanh toán.`);
    }

    // Cảnh báo phòng đang sửa chữa
    if (roomStatus.maintenance > 0) {
      alerts.push(`Có ${roomStatus.maintenance} phòng đang trong trạng thái bảo trì.`);
    }

    // Cảnh báo phòng trống thấp
    if (roomStatus.available < 3) {
      alerts.push(`Cảnh báo: Số phòng trống hiện tại rất thấp (${roomStatus.available} phòng trống).`);
    }

    // --- 10. BOOKING OCCUPANCY CALENDAR (30 DAYS FUTURE) ---
    const bookingCalendar: { date: string; occupancyPercent: number }[] = [];
    const calendarStartDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);

    const bookingsForCalendar = await this.bookingRepo.find({
      where: {
        booking_status: In(activeStatuses),
      },
    });

    for (let i = 0; i < 30; i++) {
      const targetDate = new Date(calendarStartDate.getTime() + i * 24 * 60 * 60 * 1000);
      const targetDateStr = targetDate.toISOString().split('T')[0];
      const targetTime = targetDate.getTime();

      let occupiedCount = 0;
      for (const booking of bookingsForCalendar) {
        const checkIn = new Date(booking.check_in_date).getTime();
        const checkOut = new Date(booking.check_out_date).getTime();

        if (targetTime >= checkIn && targetTime < checkOut) {
          occupiedCount++;
        }
      }

      const percent = totalRooms > 0 ? (occupiedCount / totalRooms) * 100 : 0;
      bookingCalendar.push({
        date: targetDateStr,
        occupancyPercent: Math.round(percent),
      });
    }

    return {
      summary: {
        totalRevenue,
        revenueGrowth: Math.round(revenueGrowth * 10) / 10,
        totalBookings,
        bookingGrowth: Math.round(bookingGrowth * 10) / 10,
        occupancyRate: Math.round(occupancyRate * 10) / 10,
        occupancyGrowth: Math.round(occupancyGrowth * 10) / 10,
        newCustomers,
        customerGrowth: Math.round(customerGrowth * 10) / 10,
        averageRating: 4.8, // Giá trị mặc định
      },
      todayStats: {
        checkInsToday,
        checkOutsToday,
        bookingsToday,
        revenueToday,
      },
      roomStatus,
      revenueChart,
      recentBookings,
      topRooms,
      topCustomers,
      alerts,
      bookingCalendar,
    };
  }
}
