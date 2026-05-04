import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RoomCategory } from './entities/room-category.entity';
import { GetCategoriesDto } from './dto/get-categories.dto';

@Injectable()
export class RoomsService {
  constructor(
    @InjectRepository(RoomCategory)
    private readonly roomCategoryRepository: Repository<RoomCategory>,
  ) {}

  async getCategories(getCategoriesDto: GetCategoriesDto) {
    const { page = 1, limit = 10, guests, min_price, max_price } = getCategoriesDto;
    const skip = (page - 1) * limit;

    const queryBuilder = this.roomCategoryRepository.createQueryBuilder('rc')
      .leftJoinAndSelect('rc.rooms', 'room')
      .where('rc.is_active = :isActive', { isActive: true });

    if (guests !== undefined) {
      queryBuilder.andWhere('rc.capacity >= :guests', { guests });
    }

    if (min_price !== undefined) {
      queryBuilder.andWhere('rc.base_price >= :minPrice', { minPrice: min_price });
    }

    if (max_price !== undefined) {
      queryBuilder.andWhere('rc.base_price <= :maxPrice', { maxPrice: max_price });
    }

    queryBuilder.skip(skip).take(limit);

    const [categories, total] = await queryBuilder.getManyAndCount();

    const data = categories.map((category) => {
      // Logic: is_available is true if there's at least one room with status 'AVAILABLE'
      const isAvailable = category.rooms.some(room => room.status === 'AVAILABLE');

      // Do not return the rooms array in the final response as per requirement
      const { rooms, is_active, ...categoryData } = category as any;
      
      // Parse base_price to number if it comes as string from DB (pg decimal type issue)
      return {
        ...categoryData,
        base_price: parseFloat(category.base_price as any),
        is_available: isAvailable,
      };
    });

    return {
      data,
      meta: {
        page,
        limit,
        total,
      },
    };
  }
}
