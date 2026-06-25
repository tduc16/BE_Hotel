import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Service } from './entities/service.entity';
import { ServicesController, AdminServicesController } from './services.controller';
import { ServicesService } from './services.service';
import { AdminModule } from '../admin/admin.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Service]),
    forwardRef(() => AdminModule), // forwardRef tránh circular dependency nếu AdminModule cũng import ServicesModule
  ],
  controllers: [ServicesController, AdminServicesController],
  providers: [ServicesService],
  exports: [ServicesService, TypeOrmModule],
})
export class ServicesModule {}
