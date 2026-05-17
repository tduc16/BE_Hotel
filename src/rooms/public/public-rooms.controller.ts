import { Controller, Get, Param } from '@nestjs/common';
import { PublicRoomsService } from './public-rooms.service';

@Controller()
export class PublicRoomsController {
  constructor(private readonly publicRoomsService: PublicRoomsService) {}

  @Get('rooms/categories')
  getCategories() {
    return this.publicRoomsService.getCategories();
  }

  @Get('rooms/categories/:id')
  getCategoryById(@Param('id') id: string) {
    return this.publicRoomsService.getCategoryById(id);
  }

  @Get('rooms/:id')
  getRoomById(@Param('id') id: string) {
    return this.publicRoomsService.getCategoryById(id);
  }

  @Get('room-categories/:id')
  getRoomCategoryById(@Param('id') id: string) {
    return this.publicRoomsService.getCategoryById(id);
  }
}
