import { IsDateString, IsIn, IsNotEmpty, IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export const PAYROLL_STATUSES = ['draft', 'approved', 'paid'] as const;
export type PayrollStatus = (typeof PAYROLL_STATUSES)[number];

export class CreatePayrollRecordDto {
  @ApiProperty({ example: 'a1b2c3d4-0000-0000-0000-000000000000' })
  @IsString() @IsNotEmpty() staffUserTenantId!: string;

  @ApiProperty({ example: 'Mrs. F. Johnson' })
  @IsString() @IsNotEmpty() staffName!: string;

  @ApiPropertyOptional({ example: 'Mathematics Teacher' })
  @IsOptional() @IsString() role?: string;

  @ApiProperty({ example: '2026-06' })
  @IsString() @IsNotEmpty() payPeriod!: string;

  @ApiProperty({ example: 350000 })
  @IsNumber() @Min(0) grossPay!: number;

  @ApiPropertyOptional({ example: 25000 })
  @IsOptional() @IsNumber() @Min(0) deductions?: number;
}

export class UpdatePayrollRecordDto {
  @ApiPropertyOptional({ enum: PAYROLL_STATUSES, example: 'approved' })
  @IsOptional() @IsIn(PAYROLL_STATUSES) status?: PayrollStatus;

  @ApiPropertyOptional({ example: '2026-07-01' })
  @IsOptional() @IsDateString() paidDate?: string;
}

export class ListPayrollRecordsDto {
  @ApiPropertyOptional({ enum: PAYROLL_STATUSES, example: 'draft' })
  @IsOptional() @IsIn(PAYROLL_STATUSES) status?: PayrollStatus;

  @ApiPropertyOptional({ example: '2026-06' })
  @IsOptional() @IsString() payPeriod?: string;

  @ApiPropertyOptional({ example: 'Johnson', description: 'Free-text search across staff name' })
  @IsOptional() @IsString() query?: string;
}
