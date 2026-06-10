import {
  Injectable,
  ConflictException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Room } from '../../rooms/entities/room.entity';
import { RoomCategory } from '../../rooms/entities/room-category.entity';
import { CreateRoomDto } from './dto/create-room.dto';
import { UpdateRoomDto } from './dto/update-room.dto';

@Injectable()
export class AdminRoomsService {
  constructor(
    @InjectRepository(Room)
    private readonly roomRepo: Repository<Room>,
    @InjectRepository(RoomCategory)
    private readonly categoryRepo: Repository<RoomCategory>,
  ) {}

  async createRoom(createDto: CreateRoomDto) {
    const { room_number, category_id } = createDto;

    // 1. Check unique room_number
    const existingRoom = await this.roomRepo.findOne({
      where: { room_number },
    });
    if (existingRoom) {
      throw new ConflictException(`Room number ${room_number} already exists`);
    }

    // 2. Check category exists
    const category = await this.categoryRepo.findOne({
      where: { id: category_id },
    });
    if (!category) {
      throw new NotFoundException(`Category with ID ${category_id} not found`);
    }

    // 3. Check category active
    if (!category.is_active) {
      throw new BadRequestException(
        `Category ${category.name} is currently inactive. Cannot build rooms under inactive categories.`,
      );
    }

    // 4. Create room (status default AVAILABLE from entity)
    const newRoom = this.roomRepo.create({
      room_number,
      category,
    });

    const savedRoom = await this.roomRepo.save(newRoom);

    return {
      id: savedRoom.id,
      room_number: savedRoom.room_number,
      status: savedRoom.status,
      created_at: savedRoom.created_at,
      category: {
        id: category.id,
        name: category.name,
      },
    };
  }

  async getRooms(search?: string, status?: string) {
    const query = this.roomRepo
      .createQueryBuilder('room')
      .leftJoinAndSelect('room.category', 'category')
      .select([
        'room.id',
        'room.room_number',
        'room.status',
        'room.created_at',
        'category.id',
        'category.name',
      ]);

    if (search) {
      query.andWhere('room.room_number ILIKE :search', {
        search: `%${search}%`,
      });
    }

    if (status) {
      query.andWhere('room.status = :status', { status });
    }

    query.orderBy('room.created_at', 'DESC');

    const rooms = await query.getMany();

    return rooms.map((room) => ({
      id: room.id,
      room_number: room.room_number,
      status: room.status,
      created_at: room.created_at,
      category: room.category
        ? {
            id: room.category.id,
            name: room.category.name,
          }
        : null,
    }));
  }

  async updateRoom(id: string, updateDto: UpdateRoomDto) {
    const room = await this.roomRepo.findOne({
      where: { id },
      relations: ['category'],
    });
    if (!room) {
      throw new NotFoundException(`Room with ID ${id} not found`);
    }

    if (updateDto.room_number && updateDto.room_number !== room.room_number) {
      const existing = await this.roomRepo.findOne({
        where: { room_number: updateDto.room_number },
      });
      if (existing) {
        throw new ConflictException(
          `Room number ${updateDto.room_number} already exists`,
        );
      }
      room.room_number = updateDto.room_number;
    }

    if (updateDto.status) {
      room.status = updateDto.status;
    }

    if (updateDto.category_id && updateDto.category_id !== room.category.id) {
      const category = await this.categoryRepo.findOne({
        where: { id: updateDto.category_id },
      });
      if (!category) {
        throw new NotFoundException(
          `Category with ID ${updateDto.category_id} not found`,
        );
      }
      room.category = category;
    }

    await this.roomRepo.save(room);

    return {
      id: room.id,
      room_number: room.room_number,
      status: room.status,
      created_at: room.created_at,
      category: room.category
        ? {
            id: room.category.id,
            name: room.category.name,
          }
        : null,
    };
  }

  async deleteRoom(id: string) {
    const room = await this.roomRepo.findOne({ where: { id } });
    if (!room) {
      throw new NotFoundException(`Room with ID ${id} not found`);
    }

    await this.roomRepo.remove(room);
    return { id };
  }
}
