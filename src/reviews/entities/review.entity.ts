import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';

export enum ReviewStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  HIDDEN = 'HIDDEN',
}

export enum ReviewSource {
  SEEDED = 'SEEDED',
  CUSTOMER = 'CUSTOMER',
}

@Entity('reviews')
export class Review {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // ─── Seeded review fields ────────────────────────────────────────────────
  /** Tên người đánh giá (dùng cho seeded reviews) */
  @Column({ name: 'reviewer_name', type: 'varchar', length: 100, nullable: true })
  reviewerName: string | null;

  /** Loại phòng dạng text tự do (dùng cho seeded reviews) */
  @Column({ name: 'room_type', type: 'varchar', length: 100, nullable: true })
  roomType: string | null;

  /** Kỳ lưu trú (vd: "3 ngày 2 đêm") */
  @Column({ name: 'stay_period', type: 'varchar', length: 50, nullable: true })
  stayPeriod: string | null;

  /** Nguồn gốc đánh giá: SEEDED hoặc CUSTOMER */
  @Column({ type: 'varchar', default: ReviewSource.CUSTOMER })
  source: ReviewSource;

  // ─── Customer booking fields (nullable cho seeded reviews) ───────────────
  @Column({ name: 'booking_id', type: 'uuid', nullable: true })
  bookingId: string | null;

  @ManyToOne('Booking', { onDelete: 'RESTRICT', nullable: true })
  @JoinColumn({ name: 'booking_id' })
  booking: any;

  @Column({ name: 'customer_id', type: 'uuid', nullable: true })
  customerId: string | null;

  @ManyToOne('Customer', { onDelete: 'CASCADE', nullable: true })
  @JoinColumn({ name: 'customer_id' })
  customer: any;

  @Column({ name: 'room_category_id', type: 'uuid', nullable: true })
  roomCategoryId: string | null;

  @ManyToOne('RoomCategory', { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'room_category_id' })
  roomCategory: any;

  @Column({ name: 'room_id', type: 'uuid', nullable: true })
  roomId: string | null;

  @ManyToOne('Room', { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'room_id' })
  room: any;

  // ─── Rating fields ───────────────────────────────────────────────────────
  @Column({ type: 'integer' })
  rating: number;

  @Column({ name: 'cleanliness_rating', type: 'integer', nullable: true })
  cleanlinessRating: number | null;

  @Column({ name: 'service_rating', type: 'integer', nullable: true })
  serviceRating: number | null;

  @Column({ name: 'comfort_rating', type: 'integer', nullable: true })
  comfortRating: number | null;

  @Column({ name: 'location_rating', type: 'integer', nullable: true })
  locationRating: number | null;

  @Column({ name: 'value_rating', type: 'integer', nullable: true })
  valueRating: number | null;

  // ─── Content fields ──────────────────────────────────────────────────────
  @Column({ type: 'varchar', length: 150, nullable: true })
  title: string | null;

  @Column({ type: 'text' })
  comment: string;

  @Column({ type: 'jsonb', nullable: true })
  images: string[] | null;

  // ─── Status & admin fields ───────────────────────────────────────────────
  @Column({ type: 'varchar', default: ReviewStatus.PENDING })
  status: ReviewStatus;

  @Column({ name: 'admin_reply', type: 'text', nullable: true })
  adminReply: string | null;

  @Column({ name: 'admin_reply_at', type: 'timestamp', nullable: true })
  adminReplyAt: Date | null;

  @Column({ name: 'replied_by_admin_id', type: 'uuid', nullable: true })
  repliedByAdminId: string | null;

  @ManyToOne('Admin', { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'replied_by_admin_id' })
  repliedByAdmin: any;

  @Column({ name: 'reject_reason', type: 'text', nullable: true })
  rejectReason: string | null;

  @Column({ name: 'is_featured', type: 'boolean', default: false })
  isFeatured: boolean;

  // ─── Timestamps ──────────────────────────────────────────────────────────
  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
