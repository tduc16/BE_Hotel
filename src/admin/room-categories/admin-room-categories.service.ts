import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RoomCategory } from '../../rooms/entities/room-category.entity';
import { CreateRoomCategoryDto } from './dto/create-room-category.dto';
import { UpdateRoomCategoryDto } from './dto/update-room-category.dto';

@Injectable()
export class AdminRoomCategoriesService {
  constructor(
    @InjectRepository(RoomCategory)
    private readonly categoryRepo: Repository<RoomCategory>,
  ) {}

  async createCategory(createDto: CreateRoomCategoryDto) {
    // 1. Kiểm tra không trùng tên
    const existing = await this.categoryRepo.findOne({ where: { name: createDto.name } });
    if (existing) {
      throw new ConflictException(`Room category name '${createDto.name}' already exists`);
    }

    // 2. Default is_active = true nếu ko gửi
    const is_active = createDto.is_active !== undefined ? createDto.is_active : true;
    
    // 3. Khởi tạo và lưu
    const newCategory = this.categoryRepo.create({
      ...createDto,
      is_active,
      amenities: createDto.amenities || [],
    });

    const savedCategory = await this.categoryRepo.save(newCategory);

    // 4. Trả Format payload theo đúng cấu trúc yêu cầu
    return {
      id: savedCategory.id,
      name: savedCategory.name,
      base_price: savedCategory.base_price,
      capacity: savedCategory.capacity,
      is_active: savedCategory.is_active,
    };
  }

  async getCategories() {
    return this.categoryRepo.find({
      order: { name: 'ASC' },
      select: ['id', 'name', 'base_price', 'capacity', 'thumbnail_url', 'is_active', 'amenities', 'description'],
    });
  }

  async updateCategory(id: string, updateDto: UpdateRoomCategoryDto) {
    const category = await this.categoryRepo.findOne({ where: { id } });
    if (!category) {
      throw new NotFoundException(`Room category with ID ${id} not found`);
    }

    if (updateDto.name && updateDto.name !== category.name) {
      const existing = await this.categoryRepo.findOne({ where: { name: updateDto.name } });
      if (existing) {
        throw new ConflictException(`Room category name '${updateDto.name}' already exists`);
      }
    }

    Object.assign(category, updateDto);
    const updated = await this.categoryRepo.save(category);
    
    return updated;
  }

  async toggleStatus(id: string) {
    const category = await this.categoryRepo.findOne({ where: { id } });
    if (!category) {
      throw new NotFoundException(`Room category with ID ${id} not found`);
    }

    category.is_active = !category.is_active;
    const saved = await this.categoryRepo.save(category);
    
    return {
      id: saved.id,
      is_active: saved.is_active,
    };
  }
}
