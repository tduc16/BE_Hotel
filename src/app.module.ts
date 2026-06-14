import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { DbModule } from './db/db.module';
import { RoomsModule } from './rooms/rooms.module';
import { AdminModule } from './admin/admin.module';
import { BookingsModule } from './bookings/bookings.module';
import { ScheduleModule } from '@nestjs/schedule';
import { UploadModule } from './upload/upload.module';
import { ServeStaticModule } from '@nestjs/serve-static';
import { join } from 'path';
import { PublicBookingsModule } from './public-bookings/public-bookings.module';
import { MailModule } from './mail/mail.module';
import { CustomerAuthModule } from './customer-auth/customer-auth.module';
import { CustomerModule } from './customer/customer.module';
import { ServicesModule } from './services/services.module';
import { ChatbotModule } from './chatbot/chatbot.module';

@Module({
  imports: [
    DbModule,
    RoomsModule,
    AdminModule,
    BookingsModule,
    PublicBookingsModule,
    MailModule,
    CustomerAuthModule,
    CustomerModule,
    ServicesModule,
    ChatbotModule,
    ScheduleModule.forRoot(),
    UploadModule,
    ServeStaticModule.forRoot({
      rootPath: join(process.cwd(), 'uploads'),
      serveRoot: '/uploads',
    }),
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}

