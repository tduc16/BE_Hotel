import { IsEnum, IsNotEmpty } from 'class-validator';
import { CustomerStatus } from '../../../customer/entities/customer.entity';

export class UpdateCustomerStatusDto {
  @IsEnum(CustomerStatus)
  @IsNotEmpty()
  status: CustomerStatus;
}
