import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddRoomCategoryImagesAndFixTypes1778261951153 implements MigrationInterface {
  name = 'AddRoomCategoryImagesAndFixTypes1778261951153';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "room_categories" ADD "gallery_images" text array NOT NULL DEFAULT '{}'`,
    );
    await queryRunner.query(
      `ALTER TABLE "room_category_images" ALTER COLUMN "image_url" TYPE text`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "room_category_images" ALTER COLUMN "image_url" TYPE character varying`,
    );
    await queryRunner.query(
      `ALTER TABLE "room_categories" DROP COLUMN "gallery_images"`,
    );
  }
}
