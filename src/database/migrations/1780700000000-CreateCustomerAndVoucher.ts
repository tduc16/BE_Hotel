import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateCustomerAndVoucher1780700000000 implements MigrationInterface {
  name = 'CreateCustomerAndVoucher1780700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Tạo bảng customers
    await queryRunner.query(`
      CREATE TABLE "customers" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "full_name" character varying NOT NULL,
        "email" character varying NOT NULL,
        "phone" character varying NOT NULL,
        "password_hash" character varying NOT NULL,
        "avatar" character varying,
        "status" character varying NOT NULL DEFAULT 'ACTIVE',
        "membership_level" character varying NOT NULL DEFAULT 'STANDARD',
        "loyalty_points" integer NOT NULL DEFAULT 0,
        "last_login_at" TIMESTAMP,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_customers_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_customers_email" UNIQUE ("email")
      )
    `);

    // 2. Tạo bảng vouchers
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

    // 3. Thêm cột customer_id vào bảng bookings
    await queryRunner.query(`
      ALTER TABLE "bookings" ADD COLUMN "customer_id" uuid
    `);

    // 4. Tạo các foreign key constraints
    await queryRunner.query(`
      ALTER TABLE "vouchers"
      ADD CONSTRAINT "FK_vouchers_customer_id"
      FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE NO ACTION
    `);

    await queryRunner.query(`
      ALTER TABLE "bookings"
      ADD CONSTRAINT "FK_bookings_customer_id"
      FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE SET NULL ON UPDATE NO ACTION
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // 1. Drop constraints
    await queryRunner.query(`
      ALTER TABLE "bookings" DROP CONSTRAINT IF EXISTS "FK_bookings_customer_id"
    `);

    await queryRunner.query(`
      ALTER TABLE "vouchers" DROP CONSTRAINT IF EXISTS "FK_vouchers_customer_id"
    `);

    // 2. Drop columns
    await queryRunner.query(`
      ALTER TABLE "bookings" DROP COLUMN IF EXISTS "customer_id"
    `);

    // 3. Drop tables
    await queryRunner.query(`DROP TABLE "vouchers"`);
    await queryRunner.query(`DROP TABLE "customers"`);
  }
}
