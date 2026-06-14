import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RoomCategory } from './entities/room-category.entity';
import { Room } from './entities/room.entity';
import { RoomCategoryImage } from './entities/room-category-image.entity';
import { PublicRoomsController } from './public/public-rooms.controller';
import { PublicRoomsService } from './public/public-rooms.service';

@Module({
  imports: [TypeOrmModule.forFeature([RoomCategory, Room, RoomCategoryImage])],
  controllers: [PublicRoomsController],
  providers: [PublicRoomsService],
  exports: [PublicRoomsService, TypeOrmModule],
})
export class RoomsModule {}
