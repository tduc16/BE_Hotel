import { Controller, Get, Param } from '@nestjs/common';
import { PublicRoomsService } from './public-rooms.service';

@Controller('rooms/categories')
export class PublicRoomsController {
  constructor(private readonly publicRoomsService: PublicRoomsService) {}

  @Get()
  getCategories() {
    return this.publicRoomsService.getCategories();
  }

  @Get(':id')
  getCategoryById(@Param('id') id: string) {
    return this.publicRoomsService.getCategoryById(id);
  }
}
