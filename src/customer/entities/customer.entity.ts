import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import { Voucher } from './voucher.entity';
import { Booking } from '../../bookings/entities/booking.entity';

export enum CustomerStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
}

export enum MembershipLevel {
  STANDARD = 'STANDARD',
  SILVER = 'SILVER',
  GOLD = 'GOLD',
  PLATINUM = 'PLATINUM',
}

@Entity('customers')
export class Customer {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'full_name' })
  fullName: string;

  @Column({ unique: true })
  email: string;

  @Column()
  phone: string;

  @Column({ name: 'password_hash', select: false })
  passwordHash: string;

  @Column({ nullable: true })
  avatar: string;

  @Column({
    type: 'varchar',
    default: CustomerStatus.ACTIVE,
  })
  status: CustomerStatus;

  @Column({
    name: 'membership_level',
    type: 'varchar',
    default: MembershipLevel.STANDARD,
  })
  membershipLevel: MembershipLevel;

  @Column({ name: 'loyalty_points', type: 'int', default: 0 })
  loyaltyPoints: number;

  @Column({ name: 'last_login_at', type: 'timestamp', nullable: true })
  lastLoginAt: Date;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @OneToMany(() => Voucher, (voucher) => voucher.customer)
  vouchers: Voucher[];

  @OneToMany(() => Booking, (booking) => booking.customer)
  bookings: Booking[];
}
