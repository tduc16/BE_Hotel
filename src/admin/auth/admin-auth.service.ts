import { Injectable, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';

import { Admin } from '../entities/admin.entity';
import { LoginDto } from './dto/login.dto';

@Injectable()
export class AdminAuthService {
  constructor(
    @InjectRepository(Admin)
    private readonly adminRepository: Repository<Admin>,
    private readonly jwtService: JwtService,
  ) { }

  async login(loginDto: LoginDto) {
    const { username, password } = loginDto;

    const admin = await this.adminRepository.findOne({
      where: [
        { username: username },
        { email: username }
      ],
    });

    if (!admin) {
      throw new UnauthorizedException('Thông tin đăng nhập không hợp lệ');
    }

    const isPasswordValid = await bcrypt.compare(password, admin.passwordHash);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Thông tin đăng nhập không hợp lệ');
    }

    const payload = {
      id: admin.id,
      username: admin.username,
      role: admin.role,
    };

    return {
      access_token: await this.jwtService.signAsync(payload),
      admin: {
        id: admin.id,
        username: admin.username,
        role: admin.role,
      },
    };
  }
}
