import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Request } from 'express';
import { Customer } from '../../customer/entities/customer.entity';

@Injectable()
export class JwtCustomerGuard implements CanActivate {
  constructor(
    private jwtService: JwtService,
    private configService: ConfigService,
    @InjectRepository(Customer)
    private customerRepo: Repository<Customer>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const token = this.extractTokenFromHeader(request);

    if (!token) {
      throw new UnauthorizedException('Token đăng nhập bị thiếu');
    }

    try {
      const payload = await this.jwtService.verifyAsync(token, {
        secret: this.configService.get<string>('JWT_SECRET'),
      });

      // Kiểm tra role của user
      if (payload.role !== 'CUSTOMER') {
        throw new UnauthorizedException('Bạn không có quyền truy cập tài nguyên này');
      }

      // Kiểm tra tài khoản có bị BLOCKED không (realtime check từ DB)
      const customer = await this.customerRepo.findOne({
        where: { id: payload.id },
        select: ['id', 'status'],
      });

      if (!customer) {
        throw new UnauthorizedException('Tài khoản không tồn tại');
      }

      if (customer.status === 'BLOCKED') {
        throw new UnauthorizedException(
          'Tài khoản của bạn đã bị khóa. Vui lòng liên hệ khách sạn để được hỗ trợ.',
        );
      }

      // Gán payload vào request
      request['user'] = payload;
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      throw new UnauthorizedException(
        'Token đăng nhập không hợp lệ hoặc đã hết hạn',
      );
    }
    return true;
  }

  private extractTokenFromHeader(request: Request): string | undefined {
    const [type, token] = request.headers.authorization?.split(' ') ?? [];
    return type === 'Bearer' ? token : undefined;
  }
}
