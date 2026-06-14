import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { AdminDashboardService } from './admin-dashboard.service';
import { JwtAdminGuard } from '../auth/guards/jwt-admin.guard';

@UseGuards(JwtAdminGuard)
@Controller('admin/dashboard')
export class AdminDashboardController {
  constructor(private readonly dashboardService: AdminDashboardService) {}

  @Get()
  async getDashboardData(@Query('filter') filter?: string) {
    const data = await this.dashboardService.getDashboardData(filter || '30days');
    return {
      message: 'Dashboard stats retrieved successfully',
      data,
    };
  }
}
