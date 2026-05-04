import { Injectable, OnApplicationBootstrap, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { Admin, AdminRole } from '../entities/admin.entity';

@Injectable()
export class AdminSeedService implements OnApplicationBootstrap {
  private readonly logger = new Logger(AdminSeedService.name);

  constructor(
    @InjectRepository(Admin)
    private readonly adminRepository: Repository<Admin>,
  ) {}

  async onApplicationBootstrap() {
    await this.seedAdmin();
  }

  private async seedAdmin() {
    const adminCount = await this.adminRepository.count();
    
    if (adminCount === 0) {
      this.logger.log('Không tìm thấy Admin, đang tạo Admin mặc định...');
      
      const saltOrRounds = 10;
      const hashedPassword = await bcrypt.hash('123456', saltOrRounds);

      const defaultAdmin = this.adminRepository.create({
        username: 'admin',
        email: 'admin@hotel.com',
        passwordHash: hashedPassword,
        role: AdminRole.SUPER_ADMIN,
      });

      await this.adminRepository.save(defaultAdmin);
      this.logger.log('Đã tạo thành công Admin mặc định: username "admin", password "123456"');
    } else {
      this.logger.log('Đã có dữ liệu Admin, bỏ qua bước seeder.');
    }
  }
}
