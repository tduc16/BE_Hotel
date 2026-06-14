import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('chat_sessions')
export class ChatSession {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', unique: true })
  session_id: string;

  @Column({ type: 'uuid', nullable: true })
  customer_id: string | null;

  /**
   * Context hội thoại: lưu trạng thái booking, thông tin khách đã biết
   * Ví dụ: { guestCount: 2, checkIn: '2026-07-01', checkOut: '2026-07-03', purpose: 'family' }
   */
  @Column({ type: 'jsonb', default: {} })
  context: Record<string, any>;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
