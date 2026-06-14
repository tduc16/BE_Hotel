import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateHotelServices1780800000000 implements MigrationInterface {
  name = 'CreateHotelServices1780800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Tạo bảng services
    await queryRunner.query(`
      CREATE TABLE "services" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "name" character varying NOT NULL,
        "slug" character varying NOT NULL,
        "short_description" character varying,
        "description" text,
        "image_url" character varying,
        "icon" character varying,
        "open_time" character varying,
        "close_time" character varying,
        "location" character varying,
        "is_active" boolean NOT NULL DEFAULT true,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_services_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_services_slug" UNIQUE ("slug")
      )
    `);

    // 2. Tạo bảng liên kết room_category_services (quan hệ nhiều-nhiều)
    await queryRunner.query(`
      CREATE TABLE "room_category_services" (
        "room_category_id" uuid NOT NULL,
        "service_id" uuid NOT NULL,
        CONSTRAINT "PK_room_category_services" PRIMARY KEY ("room_category_id", "service_id"),
        CONSTRAINT "FK_room_category_services_room_category" FOREIGN KEY ("room_category_id") REFERENCES "room_categories"("id") ON DELETE CASCADE ON UPDATE NO ACTION,
        CONSTRAINT "FK_room_category_services_service" FOREIGN KEY ("service_id") REFERENCES "services"("id") ON DELETE CASCADE ON UPDATE NO ACTION
      )
    `);

    // 3. Tạo index cho các trường FK để tăng tốc truy vấn
    await queryRunner.query(`
      CREATE INDEX "IDX_room_category_services_room_category_id" ON "room_category_services" ("room_category_id")
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_room_category_services_service_id" ON "room_category_services" ("service_id")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // 1. Xóa các indexes
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_room_category_services_service_id"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_room_category_services_room_category_id"`);

    // 2. Xóa bảng liên kết
    await queryRunner.query(`DROP TABLE IF EXISTS "room_category_services"`);

    // 3. Xóa bảng services
    await queryRunner.query(`DROP TABLE IF EXISTS "services"`);
  }
}
