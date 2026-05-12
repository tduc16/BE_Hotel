import { MigrationInterface, QueryRunner } from "typeorm";

export class InitialSchema1778000000000 implements MigrationInterface {
  name = 'InitialSchema1778000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Bảng admins
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "admins" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "username" character varying NOT NULL,
        "password" character varying NOT NULL,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_admins_username" UNIQUE ("username"),
        CONSTRAINT "PK_admins" PRIMARY KEY ("id")
      )
    `);

    // Bảng room_categories
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "room_categories" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "name" character varying NOT NULL,
        "description" text,
        "base_price" numeric(10,2) NOT NULL,
        "capacity" integer NOT NULL,
        "thumbnail_url" character varying,
        "amenities" jsonb NOT NULL DEFAULT '[]',
        "is_active" boolean NOT NULL DEFAULT true,
        CONSTRAINT "PK_room_categories" PRIMARY KEY ("id")
      )
    `);

    // Bảng room_category_images
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "room_category_images" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "image_url" text NOT NULL,
        "is_thumbnail" boolean NOT NULL DEFAULT false,
        "room_category_id" uuid NOT NULL,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_room_category_images" PRIMARY KEY ("id"),
        CONSTRAINT "FK_room_category_images_category"
          FOREIGN KEY ("room_category_id")
          REFERENCES "room_categories"("id")
          ON DELETE CASCADE
      )
    `);

    // Bảng rooms
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "rooms" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "room_number" character varying NOT NULL,
        "floor" integer NOT NULL DEFAULT 1,
        "is_available" boolean NOT NULL DEFAULT true,
        "category_id" uuid,
        CONSTRAINT "UQ_rooms_room_number" UNIQUE ("room_number"),
        CONSTRAINT "PK_rooms" PRIMARY KEY ("id"),
        CONSTRAINT "FK_rooms_category"
          FOREIGN KEY ("category_id")
          REFERENCES "room_categories"("id")
          ON DELETE SET NULL
      )
    `);

    // Bảng bookings
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "bookings" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "guest_name" character varying NOT NULL,
        "guest_email" character varying NOT NULL,
        "guest_phone" character varying NOT NULL,
        "check_in" TIMESTAMP NOT NULL,
        "check_out" TIMESTAMP NOT NULL,
        "total_price" numeric(10,2) NOT NULL,
        "status" character varying NOT NULL DEFAULT 'pending',
        "notes" text,
        "room_id" uuid,
        "room_category_id" uuid,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_bookings" PRIMARY KEY ("id"),
        CONSTRAINT "FK_bookings_room"
          FOREIGN KEY ("room_id")
          REFERENCES "rooms"("id")
          ON DELETE SET NULL,
        CONSTRAINT "FK_bookings_room_category"
          FOREIGN KEY ("room_category_id")
          REFERENCES "room_categories"("id")
          ON DELETE SET NULL
      )
    `);

    // Cần extension uuid-ossp
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`).catch(() => {});
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "bookings"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "rooms"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "room_category_images"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "room_categories"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "admins"`);
  }
}
