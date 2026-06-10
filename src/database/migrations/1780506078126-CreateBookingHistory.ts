import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateBookingHistory1780506078126 implements MigrationInterface {
    name = 'CreateBookingHistory1780506078126'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."booking_status_enum" AS ENUM('PENDING', 'CONFIRMED', 'CHECKED_IN', 'CHECKED_OUT', 'CANCELLED', 'EXPIRED')`);
        await queryRunner.query(`CREATE TABLE "booking_histories" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "booking_id" uuid NOT NULL, "admin_id" uuid, "action" character varying NOT NULL, "previous_status" "public"."booking_status_enum", "new_status" "public"."booking_status_enum", "note" text, "created_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_c7814fb0c8c3a4365b7a5962c3c" PRIMARY KEY ("id"))`);
        await queryRunner.query(`ALTER TABLE "booking_histories" ADD CONSTRAINT "FK_db0e2766567bd94a3d6a98f06d6" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "booking_histories" ADD CONSTRAINT "FK_8b3ea2310608bf5f74af3596468" FOREIGN KEY ("admin_id") REFERENCES "admins"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "booking_histories" DROP CONSTRAINT "FK_8b3ea2310608bf5f74af3596468"`);
        await queryRunner.query(`ALTER TABLE "booking_histories" DROP CONSTRAINT "FK_db0e2766567bd94a3d6a98f06d6"`);
        await queryRunner.query(`DROP TABLE "booking_histories"`);
        await queryRunner.query(`DROP TYPE "public"."booking_status_enum"`);
    }

}
