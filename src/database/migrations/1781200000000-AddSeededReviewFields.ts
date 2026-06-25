import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Migration: AddSeededReviewFields
 *
 * Thêm các cột để hỗ trợ seeded reviews (không cần booking/customer thực):
 *  - reviewer_name   : tên hiển thị (cho seeded reviews)
 *  - room_type       : tên loại phòng (cho seeded reviews)
 *  - stay_period     : kỳ lưu trú (vd: "3 ngày 2 đêm")
 *  - source          : SEEDED | CUSTOMER
 *
 * Đồng thời nới lỏng constraint:
 *  - booking_id : nullable (seeded reviews không cần booking)
 *  - customer_id: nullable (seeded reviews không cần customer)
 */
export class AddSeededReviewFields1781200000000 implements MigrationInterface {
  name = 'AddSeededReviewFields1781200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Thêm cột source
    await queryRunner.query(`
      ALTER TABLE "reviews"
      ADD COLUMN IF NOT EXISTS "source" character varying NOT NULL DEFAULT 'CUSTOMER'
    `);

    // 2. Thêm cột reviewer_name (tên hiển thị cho seeded reviews)
    await queryRunner.query(`
      ALTER TABLE "reviews"
      ADD COLUMN IF NOT EXISTS "reviewer_name" character varying(100)
    `);

    // 3. Thêm cột room_type (tên loại phòng tự do)
    await queryRunner.query(`
      ALTER TABLE "reviews"
      ADD COLUMN IF NOT EXISTS "room_type" character varying(100)
    `);

    // 4. Thêm cột stay_period (kỳ lưu trú)
    await queryRunner.query(`
      ALTER TABLE "reviews"
      ADD COLUMN IF NOT EXISTS "stay_period" character varying(50)
    `);

    // 5. Nới lỏng booking_id: bỏ NOT NULL và UNIQUE constraint để seeded reviews không cần booking
    await queryRunner.query(`
      ALTER TABLE "reviews"
      DROP CONSTRAINT IF EXISTS "FK_reviews_booking_id"
    `);
    await queryRunner.query(`
      ALTER TABLE "reviews"
      DROP CONSTRAINT IF EXISTS "UQ_reviews_booking_id"
    `);
    await queryRunner.query(`
      ALTER TABLE "reviews"
      ALTER COLUMN "booking_id" DROP NOT NULL
    `);

    // Thêm lại FK nhưng không bắt buộc
    await queryRunner.query(`
      ALTER TABLE "reviews"
      ADD CONSTRAINT "FK_reviews_booking_id"
      FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE RESTRICT ON UPDATE NO ACTION
    `);

    // 6. Nới lỏng customer_id: bỏ NOT NULL
    await queryRunner.query(`
      ALTER TABLE "reviews"
      DROP CONSTRAINT IF EXISTS "FK_reviews_customer_id"
    `);
    await queryRunner.query(`
      ALTER TABLE "reviews"
      ALTER COLUMN "customer_id" DROP NOT NULL
    `);

    // Thêm lại FK
    await queryRunner.query(`
      ALTER TABLE "reviews"
      ADD CONSTRAINT "FK_reviews_customer_id"
      FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE NO ACTION
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Hoàn tác: xóa cột mới
    await queryRunner.query(`ALTER TABLE "reviews" DROP COLUMN IF EXISTS "stay_period"`);
    await queryRunner.query(`ALTER TABLE "reviews" DROP COLUMN IF EXISTS "room_type"`);
    await queryRunner.query(`ALTER TABLE "reviews" DROP COLUMN IF EXISTS "reviewer_name"`);
    await queryRunner.query(`ALTER TABLE "reviews" DROP COLUMN IF EXISTS "source"`);

    // Khôi phục NOT NULL cho booking_id và customer_id
    await queryRunner.query(`ALTER TABLE "reviews" ALTER COLUMN "booking_id" SET NOT NULL`);
    await queryRunner.query(`ALTER TABLE "reviews" ALTER COLUMN "customer_id" SET NOT NULL`);

    // Khôi phục UNIQUE cho booking_id
    await queryRunner.query(`
      ALTER TABLE "reviews"
      ADD CONSTRAINT "UQ_reviews_booking_id" UNIQUE ("booking_id")
    `);
  }
}
