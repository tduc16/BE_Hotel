import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Booking, BookingStatus } from './booking.entity';
import { Admin } from '../../admin/entities/admin.entity';

@Entity('booking_histories')
export class BookingHistory {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  booking_id: string;

  @ManyToOne(() => Booking, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'booking_id' })
  booking: Booking;

  @Column({ nullable: true })
  admin_id: string;

  @ManyToOne(() => Admin, { nullable: true })
  @JoinColumn({ name: 'admin_id' })
  admin: Admin;

  @Column()
  action: string;

  @Column({ type: 'enum', enum: BookingStatus, enumName: 'booking_status_enum', nullable: true })
  previous_status: BookingStatus;

  @Column({ type: 'enum', enum: BookingStatus, enumName: 'booking_status_enum', nullable: true })
  new_status: BookingStatus;

  @Column({ type: 'text', nullable: true })
  note: string;

  @CreateDateColumn()
  created_at: Date;
}
