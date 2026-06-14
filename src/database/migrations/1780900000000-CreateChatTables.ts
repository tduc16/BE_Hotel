import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateChatTables1780900000000 implements MigrationInterface {
  name = 'CreateChatTables1780900000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Tạo bảng chat_sessions
    await queryRunner.query(`
      CREATE TABLE "chat_sessions" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "session_id" character varying NOT NULL,
        "customer_id" uuid,
        "context" jsonb NOT NULL DEFAULT '{}',
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_chat_sessions_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_chat_sessions_session_id" UNIQUE ("session_id")
      )
    `);

    // 2. Tạo bảng chat_messages
    await queryRunner.query(`
      CREATE TYPE "chat_messages_role_enum" AS ENUM ('user', 'assistant')
    `);

    await queryRunner.query(`
      CREATE TABLE "chat_messages" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "session_id" character varying NOT NULL,
        "role" "chat_messages_role_enum" NOT NULL DEFAULT 'user',
        "content" text NOT NULL,
        "intent" character varying,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_chat_messages_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_chat_messages_session" FOREIGN KEY ("session_id")
          REFERENCES "chat_sessions"("session_id") ON DELETE CASCADE ON UPDATE NO ACTION
      )
    `);

    // 3. Indexes để tối ưu truy vấn theo session
    await queryRunner.query(`
      CREATE INDEX "IDX_chat_sessions_customer_id" ON "chat_sessions" ("customer_id")
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_chat_messages_session_id" ON "chat_messages" ("session_id")
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_chat_messages_created_at" ON "chat_messages" ("created_at")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_chat_messages_created_at"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_chat_messages_session_id"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_chat_sessions_customer_id"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "chat_messages"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "chat_messages_role_enum"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "chat_sessions"`);
  }
}
