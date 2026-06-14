import { Entity, PrimaryGeneratedColumn, Column, OneToMany, ManyToMany, JoinTable } from 'typeorm';
import { Room } from './room.entity';
import { Booking } from '../../bookings/entities/booking.entity';
import { RoomCategoryImage } from './room-category-image.entity';
import { Service } from '../../services/entities/service.entity';

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

  @OneToMany(() => Booking, (booking) => booking.roomCategory)
  bookings: Booking[];
  @Column('text', { array: true, default: [] })
  gallery_images: string[];

  @OneToMany(() => RoomCategoryImage, (image) => image.roomCategory, {
    cascade: true,
  })
  images: RoomCategoryImage[];

  @ManyToMany(() => Service, (service) => service.roomCategories)
  @JoinTable({
    name: 'room_category_services',
    joinColumn: { name: 'room_category_id', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'service_id', referencedColumnName: 'id' },
  })
  services: Service[];
}
