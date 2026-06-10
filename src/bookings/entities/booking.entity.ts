import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
} from 'typeorm';
import { RoomCategory } from '../../rooms/entities/room-category.entity';
import { Room } from '../../rooms/entities/room.entity';
import { BookingHistory } from './booking-history.entity';
import { PaymentMethod, PaymentStatus, BookingStatus } from './booking.enums';

export { PaymentMethod, PaymentStatus, BookingStatus };

@Entity('bookings')
export class Booking {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  booking_code: string;

  @Column({ type: 'uuid', unique: true, nullable: true })
  booking_token: string;

  @Column()
  customer_name: string;

  @Column()
  phone: string;

  @Column()
  email: string;

  @Column({ type: 'text', nullable: true })
  note: string;

  @Column()
  room_category_id: string;

  @ManyToOne(() => RoomCategory, (category) => category.bookings)
  @JoinColumn({ name: 'room_category_id' })
  roomCategory: RoomCategory;

  @Column({ nullable: true })
  room_id: string;

  @ManyToOne(() => Room, (room) => room.bookings, { nullable: true })
  @JoinColumn({ name: 'room_id' })
  room: Room;

  @Column({ type: 'date' })
  check_in_date: string; // Store as 'YYYY-MM-DD'

  @Column({ type: 'date' })
  check_out_date: string; // Store as 'YYYY-MM-DD'

  @Column({ type: 'int' })
  guest_count: number;

  @Column({ type: 'int' })
  night_count: number;

  @Column('decimal', { precision: 10, scale: 2 })
  room_price: number;

  @Column('decimal', { precision: 10, scale: 2 })
  total_amount: number;

  @Column({ type: 'enum', enum: PaymentMethod, default: PaymentMethod.CASH })
  payment_method: PaymentMethod;

  @Column({ type: 'enum', enum: PaymentStatus, default: PaymentStatus.UNPAID })
  payment_status: PaymentStatus;

  @Column({ type: 'enum', enum: BookingStatus, default: BookingStatus.PENDING })
  booking_status: BookingStatus;

  @Column({ type: 'timestamp', nullable: true })
  expired_at: Date;

  @Column({ name: 'customer_id', type: 'uuid', nullable: true })
  customerId: string | null;

  @ManyToOne('Customer', 'bookings', { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'customer_id' })
  customer: any;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  @OneToMany(() => BookingHistory, (history) => history.booking)
  histories: BookingHistory[];
}

