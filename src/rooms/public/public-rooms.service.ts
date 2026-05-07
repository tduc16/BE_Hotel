import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RoomCategory } from '../entities/room-category.entity';

@Injectable()
export class PublicRoomsService {
  constructor(
    @InjectRepository(RoomCategory)
    private readonly categoryRepository: Repository<RoomCategory>,
  ) {}

  async getCategories() {
    const categories = await this.categoryRepository
      .createQueryBuilder('category')
      .leftJoinAndSelect('category.images', 'images')
      .leftJoinAndSelect('category.rooms', 'rooms')
      .where('category.is_active = :isActive', { isActive: true })
      .getMany();

    const data = categories.map((category) => {
      const totalRooms = category.rooms?.length || 0;
      const availableRooms = category.rooms?.filter(r => r.status !== 'MAINTENANCE').length || 0;

      const { rooms, ...categoryData } = category;

      return {
        ...categoryData,
        base_price: Number(categoryData.base_price),
        total_rooms: totalRooms,
        available_rooms: availableRooms,
        is_available: availableRooms > 0,
      };
    });

    return {
      success: true,
      data,
    };
  }

  async getCategoryById(id: string) {
    const category = await this.categoryRepository
      .createQueryBuilder('category')
      .leftJoinAndSelect('category.images', 'images')
      .leftJoinAndSelect('category.rooms', 'rooms')
      .where('category.id = :id', { id })
      .andWhere('category.is_active = :isActive', { isActive: true })
      .getOne();

    if (!category) {
      throw new NotFoundException(`Room category with ID ${id} not found`);
    }

    const totalRooms = category.rooms?.length || 0;
    const availableRooms = category.rooms?.filter(r => r.status !== 'MAINTENANCE').length || 0;

    const { rooms, ...categoryData } = category;

    return {
      success: true,
      data: {
        ...categoryData,
        base_price: Number(categoryData.base_price),
        total_rooms: totalRooms,
        available_rooms: availableRooms,
        is_available: availableRooms > 0,
        created_at: new Date(),
      },
    };
  }
}
