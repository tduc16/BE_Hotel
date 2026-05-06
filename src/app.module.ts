import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { DbModule } from './db/db.module';
import { RoomsModule } from './rooms/rooms.module';
import { AdminModule } from './admin/admin.module';
import { BookingsModule } from './bookings/bookings.module';
import { ScheduleModule } from '@nestjs/schedule';
import { UploadModule } from './upload/upload.module';

@Module({
  imports: [DbModule, RoomsModule, AdminModule, BookingsModule, ScheduleModule.forRoot(), UploadModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
