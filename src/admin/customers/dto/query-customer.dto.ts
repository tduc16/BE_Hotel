import { IsOptional, IsString, IsEnum } from 'class-validator';
import { CustomerStatus, MembershipLevel } from '../../../customer/entities/customer.entity';

export class QueryCustomerDto {
  @IsOptional()
  page?: number;

  @IsOptional()
  limit?: number;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsString()
  fullName?: string;

  @IsOptional()
  @IsString()
  email?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsEnum(CustomerStatus)
  status?: CustomerStatus;

  @IsOptional()
  @IsEnum(MembershipLevel)
  membershipLevel?: MembershipLevel;
}
