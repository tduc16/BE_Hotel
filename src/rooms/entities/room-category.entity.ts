import { Entity, PrimaryGeneratedColumn, Column, OneToMany } from 'typeorm';
import { Room } from './room.entity';
import { Booking } from '../../bookings/entities/booking.entity';
import { RoomCategoryImage } from './room-category-image.entity';

@Entity('room_categories')
export class RoomCategory {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar' })
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column('decimal', { precision: 10, scale: 2 })
  base_price: number;

  @Column('int')
  capacity: number;

  @Column({ type: 'varchar', nullable: true })
  thumbnail_url: string | null;

  @Column('jsonb', { default: [] })
  amenities: string[];

  @Column({ type: 'boolean', default: true })
  is_active: boolean;

  @OneToMany(() => Room, (room) => room.category)
  rooms: Room[];

  @OneToMany(() => Booking, (booking) => booking.room_category)
  bookings: Booking[];
  @Column('text', { array: true, default: [] })
  gallery_images: string[];

  @OneToMany(() => RoomCategoryImage, (image) => image.roomCategory, { cascade: true })
  images: RoomCategoryImage[];
}
