import { Injectable, ConflictException, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RoomCategory } from '../../rooms/entities/room-category.entity';
import { RoomCategoryImage } from '../../rooms/entities/room-category-image.entity';
import { CreateRoomCategoryDto } from './dto/create-room-category.dto';
import { UpdateRoomCategoryDto } from './dto/update-room-category.dto';
import { UploadService } from '../../upload/upload.service';

@Injectable()
export class AdminRoomCategoriesService {
  constructor(
    @InjectRepository(RoomCategory)
    private readonly categoryRepo: Repository<RoomCategory>,
    @InjectRepository(RoomCategoryImage)
    private readonly imageRepo: Repository<RoomCategoryImage>,
    private readonly uploadService: UploadService,
  ) {}

  async createCategory(createDto: CreateRoomCategoryDto, files: Express.Multer.File[]) {
    // 1. Kiểm tra không trùng tên
    const existing = await this.categoryRepo.findOne({ where: { name: createDto.name } });
    if (existing) {
      if (files?.length) {
        files.forEach(f => this.uploadService.deleteFile(`uploads/room-categories/${f.filename}`));
      }
      throw new ConflictException(`Room category name '${createDto.name}' already exists`);
    }

    if (!files || files.length === 0) {
      throw new BadRequestException('Phải có ít nhất 1 ảnh cho hạng phòng');
    }

    // 2. Default is_active = true nếu ko gửi
    const is_active = createDto.is_active !== undefined ? createDto.is_active : true;
    
    // 3. Khởi tạo ảnh
    const images = files.map((file, index) => {
      const img = new RoomCategoryImage();
      img.image_url = `/uploads/room-categories/${file.filename}`;
      img.is_thumbnail = index === 0;
      return img;
    });

    const thumbnailUrl = images.find(img => img.is_thumbnail)?.image_url;

    // 4. Khởi tạo và lưu
    const newCategory = this.categoryRepo.create({
      ...createDto,
      is_active,
      amenities: createDto.amenities || [],
      thumbnail_url: thumbnailUrl, // Backward compatibility
      images,
    });

    const savedCategory = await this.categoryRepo.save(newCategory);

    // 5. Trả Format payload theo đúng cấu trúc yêu cầu
    return {
      id: savedCategory.id,
      name: savedCategory.name,
      base_price: savedCategory.base_price,
      capacity: savedCategory.capacity,
      is_active: savedCategory.is_active,
      thumbnail_url: savedCategory.thumbnail_url,
      images: savedCategory.images.map(img => ({
        id: img.id,
        image_url: img.image_url,
        is_thumbnail: img.is_thumbnail,
      })),
    };
  }

  async getCategories() {
    return this.categoryRepo.find({
      order: { name: 'ASC' },
      relations: ['images'],
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

  async deleteImage(imageId: string) {
    const image = await this.imageRepo.findOne({ where: { id: imageId }, relations: ['roomCategory'] });
    if (!image) {
      throw new NotFoundException('Image not found');
    }

    if (image.is_thumbnail) {
      throw new BadRequestException('Cannot delete the thumbnail image. Please set another thumbnail first.');
    }

    // Delete file
    this.uploadService.deleteFile(image.image_url);

    // Delete DB record
    await this.imageRepo.remove(image);
  }

  async setThumbnail(categoryId: string, imageId: string) {
    const category = await this.categoryRepo.findOne({ where: { id: categoryId }, relations: ['images'] });
    if (!category) {
      throw new NotFoundException('Room category not found');
    }

    const imageToSet = category.images.find(img => img.id === imageId);
    if (!imageToSet) {
      throw new NotFoundException('Image does not belong to this category or does not exist');
    }

    // Reset all thumbnails
    for (const img of category.images) {
      img.is_thumbnail = false;
    }

    // Set new thumbnail
    imageToSet.is_thumbnail = true;

    // Update category backward compatible url
    category.thumbnail_url = imageToSet.image_url;

    // Save everything
    await this.categoryRepo.save(category);

    return {
      id: category.id,
      thumbnail_url: category.thumbnail_url,
    };
  }
}
