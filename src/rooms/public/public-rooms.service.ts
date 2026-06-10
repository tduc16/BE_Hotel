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
    // [DEBUG] 1. Kiểm tra số lượng room trong database
    const totalInDb = await this.categoryRepository.count();
    console.log(
      `[PublicRoomsService] Tổng số room categories trong DB: ${totalInDb}`,
    );

    // Sử dụng leftJoinAndSelect để đảm bảo lấy tất cả category, kể cả khi không có room
    const categories = await this.categoryRepository
      .createQueryBuilder('category')
      .leftJoinAndSelect('category.rooms', 'rooms')
      .where('category.is_active = :isActive', { isActive: true })
      .getMany();

    // [DEBUG] 2. Số lượng room sau query
    console.log(
      `[PublicRoomsService] Số lượng sau query (is_active=true): ${categories.length}`,
    );

    const data = categories.map((category) => {
      // [DEBUG] 3. Log từng room id + thumbnail_url
      console.log(
        `[PublicRoomsService] Category ID: ${category.id} | Name: ${category.name} | Thumbnail: ${category.thumbnail_url || 'null'}`,
      );

      const totalRooms = category.rooms?.length || 0;
      const availableRooms =
        category.rooms?.filter((r) => r.status !== 'MAINTENANCE').length || 0;

      const { rooms, ...categoryData } = category;

      // Đảm bảo thumbnail_url = null nếu rỗng
      const normalizedThumbnail = categoryData.thumbnail_url
        ? categoryData.thumbnail_url
        : null;

      return {
        ...categoryData,
        thumbnail_url: normalizedThumbnail,
        base_price: Number(categoryData.base_price),
        total_rooms: totalRooms,
        available_rooms: availableRooms,
        is_available: availableRooms > 0,
      };
    });

    // [DEBUG] 4. Số lượng room sau mapping DTO
    console.log(
      `[PublicRoomsService] Số lượng sau mapping DTO: ${data.length}`,
    );

    return {
      success: true,
      data,
    };
  }

  async getCategoryById(id: string) {
    console.log(
      `[PublicRoomsService.getCategoryById] Nhận yêu cầu get category với ID: ${id}`,
    );

    // Check if UUID
    const isUuid =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        id,
      );
    if (!isUuid) {
      console.log(
        `[PublicRoomsService.getCategoryById] ID không phải là UUID hợp lệ: ${id}`,
      );
      throw new NotFoundException(`Room category with ID ${id} not found`);
    }

    const category = await this.categoryRepository
      .createQueryBuilder('category')
      .leftJoinAndSelect('category.rooms', 'rooms')
      .leftJoinAndSelect('category.images', 'images')
      .where('category.id = :id', { id })
      .andWhere('category.is_active = :isActive', { isActive: true })
      .getOne();

    if (!category) {
      console.log(
        `[PublicRoomsService.getCategoryById] Không tìm thấy category với ID: ${id}`,
      );
      throw new NotFoundException(`Room category with ID ${id} not found`);
    }

    console.log(
      `[PublicRoomsService.getCategoryById] Tìm thấy category: ${category.name}`,
    );

    const totalRooms = category.rooms?.length || 0;
    const availableRooms =
      category.rooms?.filter((r) => r.status !== 'MAINTENANCE').length || 0;

    const { rooms, ...categoryData } = category;

    const responseData = {
      ...categoryData,
      base_price: Number(categoryData.base_price),
      total_rooms: totalRooms,
      available_rooms: availableRooms,
      is_available: availableRooms > 0,
      status: category.is_active ? 'active' : 'inactive',
      created_at: new Date(),
    };

    console.log(
      `[PublicRoomsService.getCategoryById] Response data:`,
      JSON.stringify(responseData),
    );

    return {
      success: true,
      data: responseData,
    };
  }
}
