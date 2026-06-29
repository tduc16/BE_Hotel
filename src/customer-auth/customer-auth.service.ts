import { Injectable, BadRequestException, UnauthorizedException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { Customer } from '../customer/entities/customer.entity';
import { RegisterCustomerDto } from './dto/register-customer.dto';
import { LoginCustomerDto } from './dto/login-customer.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { EmailService } from '../email/email.service';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';

@Injectable()
export class CustomerAuthService {
  private readonly logger = new Logger(CustomerAuthService.name);

  constructor(
    @InjectRepository(Customer)
    private readonly customerRepo: Repository<Customer>,
    private readonly jwtService: JwtService,
    private readonly emailService: EmailService,
    private readonly configService: ConfigService,
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

    // Gửi email chào mừng bất đồng bộ, không làm crash luồng đăng ký
    this.emailService.sendWelcomeEmail(saved.email, saved.fullName).catch((err) => {
      this.logger.error(`[WelcomeEmailError] Lỗi gửi email chào mừng tới ${saved.email}: ${err.message}`, err.stack);
    });

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

    if (customer.status === 'BLOCKED') {
      throw new UnauthorizedException(
        'Tài khoản của bạn đã bị khóa. Vui lòng liên hệ khách sạn để được hỗ trợ.',
      );
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

  async forgotPassword(dto: ForgotPasswordDto) {
    const { email } = dto;
    const customer = await this.customerRepo.findOne({ where: { email } });

    // Bảo mật: luôn trả về một câu thông báo chung cho dù email có tồn tại hay không
    const genericMessage = 'Nếu email tồn tại trong hệ thống, hướng dẫn đặt lại mật khẩu sẽ được gửi đến email của bạn.';

    if (!customer) {
      this.logger.log(`[ForgotPassword] Email ${email} không tồn tại trong hệ thống.`);
      return { success: true, message: genericMessage };
    }

    // Tạo token ngẫu nhiên
    const rawToken = crypto.randomBytes(32).toString('hex');
    // Hash token bằng sha256 trước khi lưu database
    const hashedToken = crypto.createHash('sha256').update(rawToken).digest('hex');

    // Lưu token và hạn sử dụng (15 phút)
    customer.resetPasswordToken = hashedToken;
    customer.resetPasswordExpires = new Date(Date.now() + 15 * 60 * 1000);
    await this.customerRepo.save(customer);

    // Tạo link reset
    const frontendUrl = this.configService.get<string>('FRONTEND_URL', 'http://localhost:3000');
    const resetLink = `${frontendUrl}/reset-password?token=${rawToken}&email=${encodeURIComponent(email)}`;

    // Gửi email bất đồng bộ
    this.emailService.sendForgotPasswordEmail(email, customer.fullName, resetLink).catch((err) => {
      this.logger.error(`[ForgotPasswordEmailError] Lỗi gửi email quên mật khẩu tới ${email}: ${err.message}`, err.stack);
    });

    return { success: true, message: genericMessage };
  }

  async resetPassword(dto: ResetPasswordDto) {
    const { email, token, newPassword, confirmPassword } = dto;

    if (newPassword !== confirmPassword) {
      throw new BadRequestException('Mật khẩu mới và mật khẩu xác nhận không trùng khớp');
    }

    // Hash token nhận được để so sánh với database
    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

    // Tìm customer bằng email
    const customer = await this.customerRepo
      .createQueryBuilder('customer')
      .addSelect('customer.passwordHash')
      .addSelect('customer.resetPasswordToken')
      .addSelect('customer.resetPasswordExpires')
      .where('customer.email = :email', { email })
      .getOne();

    if (!customer) {
      throw new BadRequestException('Liên kết khôi phục mật khẩu không hợp lệ hoặc đã hết hạn');
    }

    // Kiểm tra token và ngày hết hạn
    if (
      !customer.resetPasswordToken ||
      customer.resetPasswordToken !== hashedToken ||
      !customer.resetPasswordExpires ||
      customer.resetPasswordExpires.getTime() < Date.now()
    ) {
      throw new BadRequestException('Liên kết khôi phục mật khẩu không hợp lệ hoặc đã hết hạn');
    }

    // Cập nhật mật khẩu mới
    customer.passwordHash = await bcrypt.hash(newPassword, 10);
    customer.resetPasswordToken = null;
    customer.resetPasswordExpires = null;
    await this.customerRepo.save(customer);

    // Gửi email thông báo đổi mật khẩu thành công bất đồng bộ
    this.emailService.sendPasswordChangedEmail(customer.email, customer.fullName).catch((err) => {
      this.logger.error(`[PasswordChangedEmailError] Lỗi gửi email thông báo đổi mật khẩu tới ${customer.email}: ${err.message}`, err.stack);
    });

    return { success: true, message: 'Đổi mật khẩu thành công' };
  }
}
