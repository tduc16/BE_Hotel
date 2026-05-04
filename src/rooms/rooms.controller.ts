import { Controller, Get, Query, ValidationPipe, UsePipes } from '@nestjs/common';
import { RoomsService } from './rooms.service';
import { GetCategoriesDto } from './dto/get-categories.dto';

@Controller('rooms')
export class RoomsController {
  constructor(private readonly roomsService: RoomsService) {}

  @Get('categories')
  @UsePipes(new ValidationPipe({ transform: true }))
  getCategories(@Query() getCategoriesDto: GetCategoriesDto) {
    return this.roomsService.getCategories(getCategoriesDto);
  }
}
