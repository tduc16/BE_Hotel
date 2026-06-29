import { MigrationInterface, QueryRunner } from "typeorm";

export class AddBankTransferFieldsToBooking1782499491296 implements MigrationInterface {
    name = 'AddBankTransferFieldsToBooking1782499491296'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "bookings" ADD "bank_transfer_content" character varying(100)`);
        await queryRunner.query(`ALTER TABLE "bookings" ADD "bank_qr_url" text`);
        await queryRunner.query(`ALTER TABLE "bookings" ADD "paid_at" TIMESTAMP`);
        await queryRunner.query(`ALTER TYPE "public"."bookings_payment_method_enum" RENAME TO "bookings_payment_method_enum_old"`);
        await queryRunner.query(`CREATE TYPE "public"."bookings_payment_method_enum" AS ENUM('CASH', 'BANK_TRANSFER')`);
        await queryRunner.query(`ALTER TABLE "bookings" ALTER COLUMN "payment_method" DROP DEFAULT`);
        await queryRunner.query(`ALTER TABLE "bookings" ALTER COLUMN "payment_method" TYPE "public"."bookings_payment_method_enum" USING "payment_method"::"text"::"public"."bookings_payment_method_enum"`);
        await queryRunner.query(`ALTER TABLE "bookings" ALTER COLUMN "payment_method" SET DEFAULT 'CASH'`);
        await queryRunner.query(`DROP TYPE "public"."bookings_payment_method_enum_old"`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."bookings_payment_method_enum_old" AS ENUM('CASH', 'BANK_TRANSFER', 'EWALLET')`);
        await queryRunner.query(`ALTER TABLE "bookings" ALTER COLUMN "payment_method" DROP DEFAULT`);
        await queryRunner.query(`ALTER TABLE "bookings" ALTER COLUMN "payment_method" TYPE "public"."bookings_payment_method_enum_old" USING "payment_method"::"text"::"public"."bookings_payment_method_enum_old"`);
        await queryRunner.query(`ALTER TABLE "bookings" ALTER COLUMN "payment_method" SET DEFAULT 'CASH'`);
        await queryRunner.query(`DROP TYPE "public"."bookings_payment_method_enum"`);
        await queryRunner.query(`ALTER TYPE "public"."bookings_payment_method_enum_old" RENAME TO "bookings_payment_method_enum"`);
        await queryRunner.query(`ALTER TABLE "bookings" DROP COLUMN "paid_at"`);
        await queryRunner.query(`ALTER TABLE "bookings" DROP COLUMN "bank_qr_url"`);
        await queryRunner.query(`ALTER TABLE "bookings" DROP COLUMN "bank_transfer_content"`);
    }

}
