import {
  Injectable,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Like } from 'typeorm';
import { Service } from './entities/service.entity';
import { CreateServiceDto } from './dto/create-service.dto';
import { UpdateServiceDto } from './dto/update-service.dto';

@Injectable()
export class ServicesService {
  constructor(
    @InjectRepository(Service)
    private readonly serviceRepo: Repository<Service>,
  ) {}

  private slugify(text: string): string {
    return text
      .toString()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // Loại bỏ dấu tiếng Việt
      .toLowerCase()
      .trim()
      .replace(/&/g, 'and') // Thay thế ký tự & thành and
      .replace(/\s+/g, '-') // Thay thế khoảng trắng thành gạch ngang
      .replace(/[^\w\-]+/g, '') // Loại bỏ ký tự đặc biệt
      .replace(/\-\-+/g, '-'); // Thay thế nhiều gạch ngang thành 1 gạch ngang
  }

  // --- ADMIN METHODS ---

  async create(createDto: CreateServiceDto): Promise<Service> {
    const slug = this.slugify(createDto.name);
    
    // Kiểm tra trùng slug
    const existing = await this.serviceRepo.findOne({ where: { slug } });
    if (existing) {
      throw new ConflictException(
        `Dịch vụ với tên '${createDto.name}' (slug: ${slug}) đã tồn tại.`,
      );
    }

    const service = this.serviceRepo.create({
      ...createDto,
      slug,
      isActive: createDto.isActive !== undefined ? createDto.isActive : true,
    });

    return this.serviceRepo.save(service);
  }

  async findAllAdmin(
    search?: string,
    isActiveFilter?: boolean,
    page: number = 1,
    limit: number = 10,
  ): Promise<{ data: Service[]; total: number; page: number; limit: number }> {
    const skip = (page - 1) * limit;
    const where: any = {};

    if (search) {
      where.name = Like(`%${search.trim()}%`);
    }

    if (isActiveFilter !== undefined) {
      where.isActive = isActiveFilter;
    }

    const [data, total] = await this.serviceRepo.findAndCount({
      where,
      order: { createdAt: 'DESC' },
      skip,
      take: limit,
    });

    return {
      data,
      total,
      page,
      limit,
    };
  }

  async findOne(id: string): Promise<Service> {
    const service = await this.serviceRepo.findOne({ where: { id } });
    if (!service) {
      throw new NotFoundException(`Không tìm thấy dịch vụ với ID: ${id}`);
    }
    return service;
  }

  async update(id: string, updateDto: UpdateServiceDto): Promise<Service> {
    const service = await this.findOne(id);

    if (updateDto.name && updateDto.name !== service.name) {
      const slug = this.slugify(updateDto.name);
      
      // Kiểm tra trùng slug với dịch vụ khác
      const existing = await this.serviceRepo.findOne({ where: { slug } });
      if (existing && existing.id !== id) {
        throw new ConflictException(
          `Dịch vụ với tên '${updateDto.name}' (slug: ${slug}) đã tồn tại.`,
        );
      }
      service.slug = slug;
      service.name = updateDto.name;
    }

    // Cập nhật các trường khác
    if (updateDto.shortDescription !== undefined) {
      service.shortDescription = updateDto.shortDescription;
    }
    if (updateDto.description !== undefined) {
      service.description = updateDto.description;
    }
    if (updateDto.imageUrl !== undefined) {
      service.imageUrl = updateDto.imageUrl;
    }
    if (updateDto.icon !== undefined) {
      service.icon = updateDto.icon;
    }
    if (updateDto.openTime !== undefined) {
      service.openTime = updateDto.openTime;
    }
    if (updateDto.closeTime !== undefined) {
      service.closeTime = updateDto.closeTime;
    }
    if (updateDto.location !== undefined) {
      service.location = updateDto.location;
    }
    if (updateDto.isActive !== undefined) {
      service.isActive = updateDto.isActive;
    }

    return this.serviceRepo.save(service);
  }

  async softDelete(id: string): Promise<Service> {
    const service = await this.findOne(id);
    service.isActive = false;
    return this.serviceRepo.save(service);
  }

  // --- PUBLIC METHODS ---

  async findAllPublic(): Promise<Service[]> {
    return this.serviceRepo.find({
      where: { isActive: true },
      order: { name: 'ASC' },
    });
  }

  async findBySlug(slug: string): Promise<Service> {
    const service = await this.serviceRepo.findOne({
      where: { slug, isActive: true },
    });
    if (!service) {
      throw new NotFoundException(
        `Không tìm thấy dịch vụ hoạt động với slug: ${slug}`,
      );
    }
    return service;
  }
}
