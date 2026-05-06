import { 
  Controller, Post, Body, Get, Put, Patch, Param, ParseUUIDPipe, UseGuards, HttpCode, HttpStatus, UseInterceptors, UploadedFiles, Delete 
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
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
  @UseInterceptors(FilesInterceptor('images', 10, multerOptions))
  async createCategory(
    @Body() createDto: CreateRoomCategoryDto,
    @UploadedFiles() files: Express.Multer.File[]
  ) {
    const data = await this.categoriesService.createCategory(createDto, files);
    return {
      message: 'Room category created successfully',
      data,
    };
  }

  @Get()
  async getCategories() {
    const data = await this.categoriesService.getCategories();
    return {
      message: 'Room categories retrieved successfully',
      data,
    };
  }

  @Put(':id')
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

  // Bonus
  @Delete('images/:imageId')
  async deleteImage(@Param('imageId', ParseUUIDPipe) imageId: string) {
    await this.categoriesService.deleteImage(imageId);
    return {
      message: 'Image deleted successfully',
    };
  }

  @Patch(':categoryId/thumbnail/:imageId')
  async setThumbnail(
    @Param('categoryId', ParseUUIDPipe) categoryId: string,
    @Param('imageId', ParseUUIDPipe) imageId: string
  ) {
    const data = await this.categoriesService.setThumbnail(categoryId, imageId);
    return {
      message: 'Thumbnail updated successfully',
      data,
    };
  }
}
