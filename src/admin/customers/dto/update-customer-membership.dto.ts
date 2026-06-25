import { IsEnum, IsNotEmpty } from 'class-validator';
import { MembershipLevel } from '../../../customer/entities/customer.entity';

export class UpdateCustomerMembershipDto {
  @IsEnum(MembershipLevel)
  @IsNotEmpty()
  membershipLevel: MembershipLevel;
}
