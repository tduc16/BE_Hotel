import { 
  Controller, Post, Body, Get, Put, Patch, Param, ParseUUIDPipe, UseGuards, HttpCode, HttpStatus 
} from '@nestjs/common';
import { AdminRoomCategoriesService } from './admin-room-categories.service';
import { CreateRoomCategoryDto } from './dto/create-room-category.dto';
import { UpdateRoomCategoryDto } from './dto/update-room-category.dto';
import { JwtAdminGuard } from '../auth/guards/jwt-admin.guard';

@UseGuards(JwtAdminGuard)
@Controller('admin/room-categories')
export class AdminRoomCategoriesController {
  constructor(private readonly categoriesService: AdminRoomCategoriesService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async createCategory(@Body() createDto: CreateRoomCategoryDto) {
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
}
