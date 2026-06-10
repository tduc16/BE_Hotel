import { Injectable, BadRequestException, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { Customer } from '../customer/entities/customer.entity';
import { RegisterCustomerDto } from './dto/register-customer.dto';
import { LoginCustomerDto } from './dto/login-customer.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';

@Injectable()
export class CustomerAuthService {
  constructor(
    @InjectRepository(Customer)
    private readonly customerRepo: Repository<Customer>,
    private readonly jwtService: JwtService,
  ) {}

  async register(dto: RegisterCustomerDto) {
    const { fullName, email, phone, password, avatar } = dto;

    // Check unique email
    const existing = await this.customerRepo.findOne({ where: { email } });
    if (existing) {
      throw new BadRequestException('Email này đã được đăng ký sử dụng');
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);

    const customer = this.customerRepo.create({
      fullName,
      email,
      phone: phone || '',
      passwordHash,
      avatar,
    });

    const saved = await this.customerRepo.save(customer);

    // Remove passwordHash from return payload
    const { passwordHash: _, ...result } = saved;
    return result;
  }

  async login(dto: LoginCustomerDto) {
    const { email, password } = dto;

    // Phải explicitly select password_hash vì select: false
    const customer = await this.customerRepo
      .createQueryBuilder('customer')
      .addSelect('customer.passwordHash')
      .where('customer.email = :email', { email })
      .getOne();

    if (!customer || customer.status === 'INACTIVE') {
      throw new UnauthorizedException('Thông tin đăng nhập không hợp lệ');
    }

    const isMatch = await bcrypt.compare(password, customer.passwordHash);
    if (!isMatch) {
      throw new UnauthorizedException('Thông tin đăng nhập không hợp lệ');
    }

    // Update lastLoginAt
    customer.lastLoginAt = new Date();
    await this.customerRepo.save(customer);

    const payload = {
      id: customer.id,
      email: customer.email,
      fullName: customer.fullName,
      role: 'CUSTOMER',
    };

    const accessToken = await this.jwtService.signAsync(payload);

    const { passwordHash: _, ...customerInfo } = customer;

    return {
      access_token: accessToken,
      customer: customerInfo,
    };
  }

  async getMe(id: string) {
    const customer = await this.customerRepo.findOne({ where: { id } });
    if (!customer) {
      throw new BadRequestException('Không tìm thấy tài khoản khách hàng');
    }
    return customer;
  }

  async changePassword(id: string, dto: ChangePasswordDto) {
    const { oldPassword, newPassword } = dto;

    const customer = await this.customerRepo
      .createQueryBuilder('customer')
      .addSelect('customer.passwordHash')
      .where('customer.id = :id', { id })
      .getOne();

    if (!customer) {
      throw new BadRequestException('Không tìm thấy tài khoản');
    }

    const isMatch = await bcrypt.compare(oldPassword, customer.passwordHash);
    if (!isMatch) {
      throw new BadRequestException('Mật khẩu cũ không chính xác');
    }

    customer.passwordHash = await bcrypt.hash(newPassword, 10);
    await this.customerRepo.save(customer);

    return { success: true, message: 'Đổi mật khẩu thành công' };
  }

  async updateProfile(id: string, dto: UpdateProfileDto) {
    const customer = await this.customerRepo.findOne({ where: { id } });
    if (!customer) {
      throw new BadRequestException('Không tìm thấy tài khoản');
    }

    if (dto.fullName !== undefined) customer.fullName = dto.fullName;
    if (dto.phone !== undefined) customer.phone = dto.phone;
    if (dto.avatar !== undefined) customer.avatar = dto.avatar;

    const saved = await this.customerRepo.save(customer);
    return saved;
  }
}
