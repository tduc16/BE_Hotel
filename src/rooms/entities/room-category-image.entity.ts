import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, CreateDateColumn } from 'typeorm';
import { RoomCategory } from './room-category.entity';

@Entity('room_category_images')
export class RoomCategoryImage {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  room_category_id: string;

  @ManyToOne(() => RoomCategory, (category) => category.images, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'room_category_id' })
  roomCategory: RoomCategory;

  @Column()
  image_url: string;

  @Column({ default: false })
  is_thumbnail: boolean;

  @CreateDateColumn()
  created_at: Date;
}
