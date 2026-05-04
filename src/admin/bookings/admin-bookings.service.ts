import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Booking, BookingStatus } from '../../bookings/entities/booking.entity';
import { QueryBookingDto } from '../../bookings/dto/query-booking.dto';
import { Room } from '../../rooms/entities/room.entity';

@Injectable()
export class AdminBookingsService {
  constructor(
    @InjectRepository(Booking)
    private bookingRepo: Repository<Booking>,
    @InjectRepository(Room)
    private roomRepo: Repository<Room>,
  ) {}

  async getBookings(query: QueryBookingDto) {
    const qb = this.bookingRepo.createQueryBuilder('booking')
      .leftJoinAndSelect('booking.room_category', 'category')
      .leftJoinAndSelect('booking.room', 'room')
      .orderBy('booking.created_at', 'DESC');

    if (query.search) {
      qb.andWhere('(booking.booking_code ILIKE :search OR booking.customer_name ILIKE :search OR booking.phone ILIKE :search)', { search: `%${query.search}%` });
    }

    if (query.booking_status) {
      qb.andWhere('booking.booking_status = :status', { status: query.booking_status });
    }

    if (query.payment_status) {
      qb.andWhere('booking.payment_status = :payment', { payment: query.payment_status });
    }

    if (query.room_category_id) {
      qb.andWhere('booking.room_category_id = :categoryId', { categoryId: query.room_category_id });
    }

    if (query.date) {
      qb.andWhere('(:date >= booking.check_in_date AND :date <= booking.check_out_date)', { date: query.date });
    }

    return await qb.getMany();
  }

  async getBookingDetail(id: string) {
    const booking = await this.bookingRepo.findOne({
      where: { id },
      relations: ['room_category', 'room']
    });

    if (!booking) {
      throw new NotFoundException('Không tìm thấy booking');
    }

    return booking;
  }

  async confirmBooking(id: string) {
    const booking = await this.getBookingDetail(id);
    if (booking.booking_status !== BookingStatus.PENDING) {
      throw new BadRequestException('Chỉ có thể xác nhận booking PENDING');
    }

    booking.booking_status = BookingStatus.CONFIRMED;
    return await this.bookingRepo.save(booking);
  }

  async checkInBooking(id: string) {
    const booking = await this.getBookingDetail(id);
    if (booking.booking_status !== BookingStatus.CONFIRMED) {
      throw new BadRequestException('Chỉ booking đã CONFIRMED mới được Check-in');
    }

    booking.booking_status = BookingStatus.CHECKED_IN;
    
    // Đổi trạng thái phòng thành OCCUPIED nếu đã được gán
    if (booking.room_id) {
      await this.roomRepo.update(booking.room_id, { status: 'OCCUPIED' });
    }

    return await this.bookingRepo.save(booking);
  }

  async checkOutBooking(id: string) {
    const booking = await this.getBookingDetail(id);
    if (booking.booking_status !== BookingStatus.CHECKED_IN) {
      throw new BadRequestException('Chỉ booking đã CHECKED_IN mới được Check-out');
    }

    booking.booking_status = BookingStatus.CHECKED_OUT;

    // Trả lại trạng thái phòng thành AVAILABLE
    if (booking.room_id) {
      await this.roomRepo.update(booking.room_id, { status: 'AVAILABLE' });
    }

    return await this.bookingRepo.save(booking);
  }

  async cancelBooking(id: string) {
    const booking = await this.getBookingDetail(id);
    if ([BookingStatus.CHECKED_IN, BookingStatus.CHECKED_OUT, BookingStatus.CANCELLED].includes(booking.booking_status)) {
      throw new BadRequestException('Không thể hủy booking này do trạng thái không hợp lệ');
    }

    booking.booking_status = BookingStatus.CANCELLED;
    return await this.bookingRepo.save(booking);
  }
}
