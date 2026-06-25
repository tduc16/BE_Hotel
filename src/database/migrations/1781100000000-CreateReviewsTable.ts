import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateReviewsTable1781100000000 implements MigrationInterface {
  name = 'CreateReviewsTable1781100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "reviews" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "booking_id" uuid NOT NULL,
        "customer_id" uuid NOT NULL,
        "room_category_id" uuid,
        "room_id" uuid,
        "rating" integer NOT NULL,
        "cleanliness_rating" integer,
        "service_rating" integer,
        "comfort_rating" integer,
        "location_rating" integer,
        "value_rating" integer,
        "title" character varying(150),
        "comment" text NOT NULL,
        "images" jsonb,
        "status" character varying NOT NULL DEFAULT 'PENDING',
        "admin_reply" text,
        "admin_reply_at" TIMESTAMP,
        "replied_by_admin_id" uuid,
        "reject_reason" text,
        "is_featured" boolean NOT NULL DEFAULT false,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_reviews_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_reviews_booking_id" UNIQUE ("booking_id")
      )
    `);

    // Tạo foreign keys
    await queryRunner.query(`
      ALTER TABLE "reviews"
      ADD CONSTRAINT "FK_reviews_booking_id"
      FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE RESTRICT ON UPDATE NO ACTION
    `);

    await queryRunner.query(`
      ALTER TABLE "reviews"
      ADD CONSTRAINT "FK_reviews_customer_id"
      FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE NO ACTION
    `);

    await queryRunner.query(`
      ALTER TABLE "reviews"
      ADD CONSTRAINT "FK_reviews_room_category_id"
      FOREIGN KEY ("room_category_id") REFERENCES "room_categories"("id") ON DELETE SET NULL ON UPDATE NO ACTION
    `);

    await queryRunner.query(`
      ALTER TABLE "reviews"
      ADD CONSTRAINT "FK_reviews_room_id"
      FOREIGN KEY ("room_id") REFERENCES "rooms"("id") ON DELETE SET NULL ON UPDATE NO ACTION
    `);

    await queryRunner.query(`
      ALTER TABLE "reviews"
      ADD CONSTRAINT "FK_reviews_replied_by_admin_id"
      FOREIGN KEY ("replied_by_admin_id") REFERENCES "admins"("id") ON DELETE SET NULL ON UPDATE NO ACTION
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "reviews" DROP CONSTRAINT IF EXISTS "FK_reviews_replied_by_admin_id"`);
    await queryRunner.query(`ALTER TABLE "reviews" DROP CONSTRAINT IF EXISTS "FK_reviews_room_id"`);
    await queryRunner.query(`ALTER TABLE "reviews" DROP CONSTRAINT IF EXISTS "FK_reviews_room_category_id"`);
    await queryRunner.query(`ALTER TABLE "reviews" DROP CONSTRAINT IF EXISTS "FK_reviews_customer_id"`);
    await queryRunner.query(`ALTER TABLE "reviews" DROP CONSTRAINT IF EXISTS "FK_reviews_booking_id"`);
    await queryRunner.query(`DROP TABLE "reviews"`);
  }
}
