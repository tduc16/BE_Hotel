import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddBookingToken1780600000000 implements MigrationInterface {
  name = 'AddBookingToken1780600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Thêm cột booking_token (nullable tạm thời để backfill dữ liệu cũ)
    await queryRunner.query(
      `ALTER TABLE "bookings" ADD COLUMN IF NOT EXISTS "booking_token" uuid`,
    );

    // 2. Backfill: gán UUID cho tất cả row chưa có booking_token
    await queryRunner.query(
      `UPDATE "bookings" SET "booking_token" = uuid_generate_v4() WHERE "booking_token" IS NULL`,
    );

    // 3. Đặt NOT NULL + UNIQUE sau khi đã backfill xong
    await queryRunner.query(
      `ALTER TABLE "bookings" ALTER COLUMN "booking_token" SET NOT NULL`,
    );

    // Chỉ tạo unique constraint nếu chưa tồn tại
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint
          WHERE conname = 'UQ_bookings_booking_token'
        ) THEN
          ALTER TABLE "bookings" ADD CONSTRAINT "UQ_bookings_booking_token" UNIQUE ("booking_token");
        END IF;
      END
      $$;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "bookings" DROP CONSTRAINT IF EXISTS "UQ_bookings_booking_token"`,
    );
    await queryRunner.query(
      `ALTER TABLE "bookings" DROP COLUMN IF EXISTS "booking_token"`,
    );
  }
}
