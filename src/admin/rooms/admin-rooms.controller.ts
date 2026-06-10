import {
  Controller,
  Post,
  Body,
  Get,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
  Patch,
  Param,
  Delete,
} from '@nestjs/common';
import { AdminRoomsService } from './admin-rooms.service';
import { CreateRoomDto } from './dto/create-room.dto';
import { UpdateRoomDto } from './dto/update-room.dto';
import { JwtAdminGuard } from '../auth/guards/jwt-admin.guard';

@UseGuards(JwtAdminGuard)
@Controller('admin/rooms')
export class AdminRoomsController {
  constructor(private readonly roomsService: AdminRoomsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async createRoom(@Body() createDto: CreateRoomDto) {
    const data = await this.roomsService.createRoom(createDto);
    return {
      message: 'Room created successfully',
      data,
    };
  }

  @Get()
  async getRooms(
    @Query('search') search?: string,
    @Query('status') status?: string,
  ) {
    const data = await this.roomsService.getRooms(search, status);
    return {
      message: 'Rooms retrieved successfully',
      data,
    };
  }

  @Patch(':id')
  async updateRoom(@Param('id') id: string, @Body() updateDto: UpdateRoomDto) {
    const data = await this.roomsService.updateRoom(id, updateDto);
    return {
      message: 'Room updated successfully',
      data,
    };
  }

  @Delete(':id')
  async deleteRoom(@Param('id') id: string) {
    await this.roomsService.deleteRoom(id);
    return {
      message: 'Room deleted successfully',
    };
  }
}
