import { Injectable, ConflictException, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RoomCategory } from '../../rooms/entities/room-category.entity';
import { CreateRoomCategoryDto } from './dto/create-room-category.dto';
import { UpdateRoomCategoryDto } from './dto/update-room-category.dto';
import { UploadService } from '../../upload/upload.service';

@Injectable()
export class AdminRoomCategoriesService {
  constructor(
    @InjectRepository(RoomCategory)
    private readonly categoryRepo: Repository<RoomCategory>,
    private readonly uploadService: UploadService,
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
      gallery_images: createDto.gallery_images || [],
    });

    const savedCategory = await this.categoryRepo.save(newCategory);

    return savedCategory;
  }

  async getCategories() {
    return this.categoryRepo.find({
      order: { name: 'ASC' },
      select: {
        id: true,
        name: true,
        base_price: true,
        capacity: true,
        thumbnail_url: true,
        is_active: true,
        amenities: true,
        description: true,
      }
    });
  }

  async getCategoryById(id: string) {
    const category = await this.categoryRepo.findOne({
      where: { id },
      relations: ['images'],
    });

    if (!category) {
      throw new NotFoundException(`Room category with ID ${id} not found`);
    }

    return category;
  }

  async updateCategory(
    id: string, 
    updateDto: UpdateRoomCategoryDto,
  ) {
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

    let currentGallery = [...(category.gallery_images || [])];

    // Process removed gallery images
    const removedImages = updateDto.remove_gallery_images;
    if (removedImages && removedImages.length > 0) {
      currentGallery = currentGallery.filter(url => !removedImages.includes(url));
      
      for (const url of removedImages) {
        this.uploadService.deleteFile(url);
      }
    }

    // Process new gallery images
    if (updateDto.append_gallery_images && updateDto.append_gallery_images.length > 0) {
      currentGallery = [...currentGallery, ...updateDto.append_gallery_images];
    }

    category.gallery_images = currentGallery;

    // Update basic info
    if (updateDto.name !== undefined) category.name = updateDto.name;
    if (updateDto.description !== undefined) category.description = updateDto.description;
    if (updateDto.base_price !== undefined) category.base_price = updateDto.base_price;
    if (updateDto.capacity !== undefined) category.capacity = updateDto.capacity;
    if (updateDto.amenities !== undefined) category.amenities = updateDto.amenities;
    if (updateDto.is_active !== undefined) category.is_active = updateDto.is_active;
    if (updateDto.thumbnail_url !== undefined) {
      // remove old thumbnail if changed
      if (category.thumbnail_url && category.thumbnail_url !== updateDto.thumbnail_url) {
        // we can choose to delete it, but only if it's not in the gallery
        if (!currentGallery.includes(category.thumbnail_url)) {
           this.uploadService.deleteFile(category.thumbnail_url);
        }
      }
      category.thumbnail_url = updateDto.thumbnail_url === '' ? null : updateDto.thumbnail_url;
    }

    await this.categoryRepo.save(category);

    return category;
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
