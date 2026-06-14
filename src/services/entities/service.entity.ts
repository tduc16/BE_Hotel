import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToMany,
} from 'typeorm';
import { RoomCategory } from '../../rooms/entities/room-category.entity';

@Entity('services')
export class Service {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar' })
  name: string;

  @Column({ type: 'varchar', unique: true })
  slug: string;

  @Column({ name: 'short_description', type: 'varchar', nullable: true })
  shortDescription: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ name: 'image_url', type: 'varchar', nullable: true })
  imageUrl: string;

  @Column({ type: 'varchar', nullable: true })
  icon: string;

  @Column({ name: 'open_time', type: 'varchar', nullable: true })
  openTime: string;

  @Column({ name: 'close_time', type: 'varchar', nullable: true })
  closeTime: string;

  @Column({ type: 'varchar', nullable: true })
  location: string;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @ManyToMany(() => RoomCategory, (category) => category.services)
  roomCategories: RoomCategory[];
}
