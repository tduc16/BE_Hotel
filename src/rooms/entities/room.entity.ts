import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, CreateDateColumn, UpdateDateColumn, OneToMany } from 'typeorm';
import { RoomCategory } from './room-category.entity';
import { Booking } from '../../bookings/entities/booking.entity';

@Entity('rooms')
export class Room {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  room_number: string;

  @Column({ default: 'AVAILABLE' }) // Or enum: 'AVAILABLE', 'MAINTENANCE', 'OCCUPIED'
  status: string;

  @ManyToOne(() => RoomCategory, (category) => category.rooms)
  @JoinColumn({ name: 'category_id' })
  category: RoomCategory;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  @OneToMany(() => Booking, (booking) => booking.room)
  bookings: Booking[];
}
