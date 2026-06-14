import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';

@Injectable()
export class JwtAdminGuard implements CanActivate {
  constructor(
    private jwtService: JwtService,
    private configService: ConfigService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const token = this.extractTokenFromHeader(request);

    console.log('--- ADMIN AUTH DEBUG ---');
    console.log('Headers:', request.headers);
    console.log('Extracted Token:', token);
    console.log('Authorization Header:', request.headers.authorization);

    if (!token) {
      console.log('=> Admin token missing');
      throw new UnauthorizedException('Admin token missing');
    }

    try {
      const payload = await this.jwtService.verifyAsync(token, {
        secret: this.configService.get<string>('JWT_SECRET'),
      });

      console.log('JWT Payload:', payload);
      console.log('Decoded Payload:', payload);
      console.log('User Role:', payload?.role);

      // Gán payload vào cả user (để chuẩn hóa) và admin
      request['user'] = payload;
      request['admin'] = payload;

      console.log('Request User Object:', request.user);
      console.log('------------------------');

      // Kiểm tra role (nếu cần)
      if (payload.role !== 'SUPER_ADMIN' && payload.role !== 'MANAGER') {
        throw new UnauthorizedException('Require admin role');
      }
    } catch (error) {
      console.error('JWT Verification Error:', error.message);
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
