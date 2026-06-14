import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
} from '@nestjs/common';
import { ServicesService } from './services.service';
import { CreateServiceDto } from './dto/create-service.dto';
import { UpdateServiceDto } from './dto/update-service.dto';
import { JwtAdminGuard } from '../admin/auth/guards/jwt-admin.guard';

@Controller()
export class ServicesController {
  constructor(private readonly servicesService: ServicesService) {}

  // ==========================================
  // PUBLIC APIs (Không cần đăng nhập)
  // ==========================================

  @Get('services')
  async findAllPublic() {
    const data = await this.servicesService.findAllPublic();
    return {
      success: true,
      message: 'Lấy danh sách dịch vụ thành công',
      data,
    };
  }

  @Get('services/:slug')
  async findBySlug(@Param('slug') slug: string) {
    const data = await this.servicesService.findBySlug(slug);
    return {
      success: true,
      message: 'Lấy thông tin dịch vụ thành công',
      data,
    };
  }

  // ==========================================
  // ADMIN APIs (Cần đăng nhập)
  // ==========================================

  @UseGuards(JwtAdminGuard)
  @Get('admin/services')
  async findAllAdmin(
    @Query('search') search?: string,
    @Query('isActive') isActiveStr?: string,
    @Query('page') pageStr?: string,
    @Query('limit') limitStr?: string,
  ) {
    const page = pageStr ? parseInt(pageStr, 10) : 1;
    const limit = limitStr ? parseInt(limitStr, 10) : 10;
    
    let isActive: boolean | undefined = undefined;
    if (isActiveStr === 'true') isActive = true;
    if (isActiveStr === 'false') isActive = false;

    const result = await this.servicesService.findAllAdmin(
      search,
      isActive,
      page,
      limit,
    );

    return {
      success: true,
      message: 'Lấy danh sách dịch vụ admin thành công',
      ...result,
    };
  }

  @UseGuards(JwtAdminGuard)
  @Get('admin/services/:id')
  async findOneAdmin(@Param('id', ParseUUIDPipe) id: string) {
    const data = await this.servicesService.findOne(id);
    return {
      success: true,
      message: 'Lấy thông tin dịch vụ admin thành công',
      data,
    };
  }

  @UseGuards(JwtAdminGuard)
  @Post('admin/services')
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() createDto: CreateServiceDto) {
    const data = await this.servicesService.create(createDto);
    return {
      success: true,
      message: 'Tạo dịch vụ thành công',
      data,
    };
  }

  @UseGuards(JwtAdminGuard)
  @Put('admin/services/:id')
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateDto: UpdateServiceDto,
  ) {
    const data = await this.servicesService.update(id, updateDto);
    return {
      success: true,
      message: 'Cập nhật dịch vụ thành công',
      data,
    };
  }

  @UseGuards(JwtAdminGuard)
  @Delete('admin/services/:id')
  async softDelete(@Param('id', ParseUUIDPipe) id: string) {
    const data = await this.servicesService.softDelete(id);
    return {
      success: true,
      message: 'Ngưng hoạt động dịch vụ thành công',
      data,
    };
  }
}
