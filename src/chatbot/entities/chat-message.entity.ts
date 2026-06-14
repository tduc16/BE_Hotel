import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
} from 'typeorm';

export enum ChatMessageRole {
  USER = 'user',
  ASSISTANT = 'assistant',
}

@Entity('chat_messages')
export class ChatMessage {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar' })
  session_id: string;

  @Column({
    type: 'enum',
    enum: ChatMessageRole,
    default: ChatMessageRole.USER,
  })
  role: ChatMessageRole;

  @Column({ type: 'text' })
  content: string;

  @Column({ type: 'varchar', nullable: true })
  intent: string | null;

  @CreateDateColumn()
  created_at: Date;
}
