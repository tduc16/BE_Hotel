import { MigrationInterface, QueryRunner } from 'typeorm';

export class UpdateVoucherModule1781000000000 implements MigrationInterface {
  name = 'UpdateVoucherModule1781000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Xóa khoá ngoại cũ và drop bảng vouchers cũ
    await queryRunner.query(`
      ALTER TABLE "vouchers" DROP CONSTRAINT IF EXISTS "FK_vouchers_customer_id";
    `);
    await queryRunner.query(`
      DROP TABLE IF EXISTS "vouchers";
    `);

    // 2. Tạo bảng vouchers mới
    await queryRunner.query(`
      CREATE TABLE "vouchers" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "code" character varying(50) NOT NULL,
        "name" character varying(200) NOT NULL,
        "description" text,
        "discount_type" character varying(20) NOT NULL,
        "discount_value" numeric(12,2) NOT NULL,
        "max_discount_amount" numeric(12,2),
        "min_booking_amount" numeric(12,2),
        "start_date" date NOT NULL,
        "end_date" date NOT NULL,
        "usage_limit" integer,
        "used_count" integer NOT NULL DEFAULT 0,
        "usage_limit_per_customer" integer,
        "applicable_to" character varying(30) NOT NULL DEFAULT 'ALL',
        "required_membership_level" character varying(20),
        "required_booking_count" integer,
        "required_total_spent" numeric(12,2),
        "status" character varying(20) NOT NULL DEFAULT 'ACTIVE',
        "is_public" boolean NOT NULL DEFAULT false,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_vouchers_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_vouchers_code" UNIQUE ("code")
      )
    `);

    // 3. Tạo bảng voucher_usages
    await queryRunner.query(`
      CREATE TABLE "voucher_usages" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "voucher_id" uuid NOT NULL,
        "customer_id" uuid,
        "booking_id" uuid,
        "guest_email" character varying(255),
        "discount_amount" numeric(12,2) NOT NULL,
        "used_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_voucher_usages_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_voucher_usages_voucher_id" FOREIGN KEY ("voucher_id") REFERENCES "vouchers" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION,
        CONSTRAINT "FK_voucher_usages_customer_id" FOREIGN KEY ("customer_id") REFERENCES "customers" ("id") ON DELETE SET NULL ON UPDATE NO ACTION
      )
    `);

    // 4. Thêm các cột vào bảng bookings
    await queryRunner.query(`
      ALTER TABLE "bookings" ADD COLUMN "voucher_id" uuid;
    `);
    await queryRunner.query(`
      ALTER TABLE "bookings" ADD COLUMN "voucher_code" character varying(50);
    `);
    await queryRunner.query(`
      ALTER TABLE "bookings" ADD COLUMN "original_amount" numeric(12,2);
    `);
    await queryRunner.query(`
      ALTER TABLE "bookings" ADD COLUMN "discount_amount" numeric(12,2) DEFAULT 0;
    `);

    // 5. Thêm khoá ngoại vào bảng bookings
    await queryRunner.query(`
      ALTER TABLE "bookings"
      ADD CONSTRAINT "FK_bookings_voucher_id"
      FOREIGN KEY ("voucher_id") REFERENCES "vouchers" ("id") ON DELETE SET NULL ON UPDATE NO ACTION;
    `);

    // 6. Thêm khoá ngoại booking_id vào bảng voucher_usages
    await queryRunner.query(`
      ALTER TABLE "voucher_usages"
      ADD CONSTRAINT "FK_voucher_usages_booking_id"
      FOREIGN KEY ("booking_id") REFERENCES "bookings" ("id") ON DELETE SET NULL ON UPDATE NO ACTION;
    `);

    // 7. Thêm Indexes
    await queryRunner.query(`
      CREATE INDEX "IDX_vouchers_code" ON "vouchers" ("code");
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_voucher_usages_voucher_id" ON "voucher_usages" ("voucher_id");
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_voucher_usages_customer_id" ON "voucher_usages" ("customer_id");
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "voucher_usages" DROP CONSTRAINT IF EXISTS "FK_voucher_usages_booking_id";
    `);
    await queryRunner.query(`
      ALTER TABLE "bookings" DROP CONSTRAINT IF EXISTS "FK_bookings_voucher_id";
    `);
    await queryRunner.query(`
      ALTER TABLE "bookings" DROP COLUMN IF EXISTS "discount_amount";
    `);
    await queryRunner.query(`
      ALTER TABLE "bookings" DROP COLUMN IF EXISTS "original_amount";
    `);
    await queryRunner.query(`
      ALTER TABLE "bookings" DROP COLUMN IF EXISTS "voucher_code";
    `);
    await queryRunner.query(`
      ALTER TABLE "bookings" DROP COLUMN IF EXISTS "voucher_id";
    `);
    await queryRunner.query(`
      DROP TABLE IF EXISTS "voucher_usages";
    `);
    await queryRunner.query(`
      DROP TABLE IF EXISTS "vouchers";
    `);
    // Tạo lại bảng vouchers cũ để revert
    await queryRunner.query(`
      CREATE TABLE "vouchers" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "customer_id" uuid NOT NULL,
        "code" character varying NOT NULL,
        "discount_percent" integer NOT NULL,
        "is_used" boolean NOT NULL DEFAULT false,
        "expired_at" TIMESTAMP NOT NULL,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_vouchers_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_vouchers_code" UNIQUE ("code")
      )
    `);
    await queryRunner.query(`
      ALTER TABLE "vouchers"
      ADD CONSTRAINT "FK_vouchers_customer_id"
      FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
    `);
  }
}
