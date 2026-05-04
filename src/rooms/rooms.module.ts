import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RoomsService } from './rooms.service';
import { RoomsController } from './rooms.controller';
import { RoomCategory } from './entities/room-category.entity';
import { Room } from './entities/room.entity';

@Module({
  imports: [TypeOrmModule.forFeature([RoomCategory, Room])],
  controllers: [RoomsController],
  providers: [RoomsService],
})
export class RoomsModule {}
