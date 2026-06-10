import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
} from 'typeorm';
import { RoomCategory } from './room-category.entity';

@Entity('room_category_images')
export class RoomCategoryImage {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'text' })
  image_url: string;

  @Column({ name: 'is_thumbnail', type: 'boolean', default: false })
  is_thumbnail: boolean;

  @Column({ name: 'room_category_id' })
  room_category_id: string;

  @CreateDateColumn({ name: 'created_at' })
  created_at: Date;

  @ManyToOne(() => RoomCategory, (category) => category.images, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'room_category_id' })
  roomCategory: RoomCategory;
}
