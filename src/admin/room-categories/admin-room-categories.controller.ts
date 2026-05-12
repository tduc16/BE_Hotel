import { 
  Controller, Post, Body, Get, Put, Patch, Param, ParseUUIDPipe, UseGuards, HttpCode, HttpStatus, UseInterceptors, UploadedFiles, Delete 
} from '@nestjs/common';
import { FilesInterceptor, FileFieldsInterceptor } from '@nestjs/platform-express';
import { AdminRoomCategoriesService } from './admin-room-categories.service';
import { CreateRoomCategoryDto } from './dto/create-room-category.dto';
import { UpdateRoomCategoryDto } from './dto/update-room-category.dto';
import { JwtAdminGuard } from '../auth/guards/jwt-admin.guard';
import { multerOptions } from '../../upload/upload.service';

@UseGuards(JwtAdminGuard)
@Controller('admin/room-categories')
export class AdminRoomCategoriesController {
  constructor(private readonly categoriesService: AdminRoomCategoriesService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async createCategory(
    @Body() createDto: CreateRoomCategoryDto,
  ) {
    const data = await this.categoriesService.createCategory(createDto);
    return {
      message: 'Room category created successfully',
      data,
    };
  }

  @Get()
  async getCategories() {
    const data = await this.categoriesService.getCategories();
    return {
      success: true,
      message: 'Room categories retrieved successfully',
      data,
    };
  }

  @Get(':id')
  async getCategoryById(@Param('id', ParseUUIDPipe) id: string) {
    const data = await this.categoriesService.getCategoryById(id);
    return {
      success: true,
      message: 'Room category retrieved successfully',
      data,
    };
  }

  @Patch(':id')
  async updateCategory(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateDto: UpdateRoomCategoryDto,
  ) {
    const data = await this.categoriesService.updateCategory(id, updateDto);
    return {
      message: 'Room category updated successfully',
      data,
    };
  }

  @Patch(':id/toggle-status')
  async toggleStatus(@Param('id', ParseUUIDPipe) id: string) {
    const data = await this.categoriesService.toggleStatus(id);
    return {
      message: `Room category status toggled to ${data.is_active ? 'ACTIVE' : 'INACTIVE'}`,
      data,
    };
  }

  @Post('upload')
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(FilesInterceptor('images', 10, multerOptions))
  async uploadImages(
    @UploadedFiles() files: Express.Multer.File[]
  ) {
    const urls = files.map(file => `/uploads/room-categories/${file.filename}`);
    return {
      message: 'Images uploaded successfully',
      urls,
    };
  }
}
