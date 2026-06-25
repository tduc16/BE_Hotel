import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';

export enum DiscountType {
  PERCENT = 'PERCENT',
  FIXED_AMOUNT = 'FIXED_AMOUNT',
}

export enum ApplicableTo {
  ALL = 'ALL',
  MEMBER_ONLY = 'MEMBER_ONLY',
  GUEST_ONLY = 'GUEST_ONLY',
  MEMBERSHIP_LEVEL = 'MEMBERSHIP_LEVEL',
}

export enum VoucherStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
  EXPIRED = 'EXPIRED',
}

export enum RequiredMembershipLevel {
  STANDARD = 'STANDARD',
  SILVER = 'SILVER',
  GOLD = 'GOLD',
  PLATINUM = 'PLATINUM',
}

@Entity('vouchers')
export class Voucher {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true, length: 50 })
  code: string;

  @Column({ length: 200 })
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ name: 'discount_type', type: 'varchar', length: 20 })
  discountType: DiscountType;

  @Column({ name: 'discount_value', type: 'decimal', precision: 12, scale: 2 })
  discountValue: number;

  @Column({ name: 'max_discount_amount', type: 'decimal', precision: 12, scale: 2, nullable: true })
  maxDiscountAmount: number | null;

  @Column({ name: 'min_booking_amount', type: 'decimal', precision: 12, scale: 2, nullable: true })
  minBookingAmount: number | null;

  @Column({ name: 'start_date', type: 'date' })
  startDate: string;

  @Column({ name: 'end_date', type: 'date' })
  endDate: string;

  @Column({ name: 'usage_limit', type: 'int', nullable: true })
  usageLimit: number | null;

  @Column({ name: 'used_count', type: 'int', default: 0 })
  usedCount: number;

  @Column({ name: 'usage_limit_per_customer', type: 'int', nullable: true })
  usageLimitPerCustomer: number | null;

  @Column({ name: 'applicable_to', type: 'varchar', length: 30, default: ApplicableTo.ALL })
  applicableTo: ApplicableTo;

  @Column({ name: 'required_membership_level', type: 'varchar', length: 20, nullable: true })
  requiredMembershipLevel: RequiredMembershipLevel | null;

  @Column({ name: 'required_booking_count', type: 'int', nullable: true })
  requiredBookingCount: number | null;

  @Column({ name: 'required_total_spent', type: 'decimal', precision: 12, scale: 2, nullable: true })
  requiredTotalSpent: number | null;

  @Column({ name: 'status', type: 'varchar', length: 20, default: VoucherStatus.ACTIVE })
  status: VoucherStatus;

  @Column({ name: 'is_public', type: 'boolean', default: false })
  isPublic: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @OneToMany('VoucherUsage', 'voucher')
  usages: import('./voucher-usage.entity').VoucherUsage[];
}
