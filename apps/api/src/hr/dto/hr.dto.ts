import { IsDateString, IsIn, IsInt, IsNotEmpty, IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export const PAYROLL_STATUSES = ['draft', 'approved', 'paid'] as const;
export type PayrollStatus = (typeof PAYROLL_STATUSES)[number];

export const LEAVE_TYPES = ['annual', 'sick', 'unpaid', 'other'] as const;
export type LeaveType = (typeof LEAVE_TYPES)[number];
export const LEAVE_STATUSES = ['pending', 'approved', 'rejected', 'cancelled'] as const;
export type LeaveStatus = (typeof LEAVE_STATUSES)[number];

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

export class CreateLeaveRequestDto {
  @ApiProperty({ example: 'a1b2c3d4-0000-0000-0000-000000000000' })
  @IsString() @IsNotEmpty() staffUserTenantId!: string;

  @ApiProperty({ example: 'Mrs. F. Johnson' })
  @IsString() @IsNotEmpty() staffName!: string;

  @ApiProperty({ enum: LEAVE_TYPES, example: 'annual' })
  @IsIn(LEAVE_TYPES) leaveType!: LeaveType;

  @ApiProperty({ example: '2026-08-01' })
  @IsDateString() startDate!: string;

  @ApiProperty({ example: '2026-08-05' })
  @IsDateString() endDate!: string;

  @ApiProperty({ example: 5 })
  @IsInt() @Min(1) days!: number;

  @ApiPropertyOptional({ example: 'Family event' })
  @IsOptional() @IsString() reason?: string;
}

export class ReviewLeaveRequestDto {
  @ApiProperty({ enum: LEAVE_STATUSES, example: 'approved' })
  @IsIn(LEAVE_STATUSES) status!: LeaveStatus;

  @ApiPropertyOptional({ example: 'Approved — covered by substitute.' })
  @IsOptional() @IsString() reviewNote?: string;
}

export class ListLeaveRequestsDto {
  @ApiPropertyOptional({ enum: LEAVE_STATUSES, example: 'pending' })
  @IsOptional() @IsIn(LEAVE_STATUSES) status?: LeaveStatus;

  @ApiPropertyOptional({ example: 'Johnson', description: 'Free-text search across staff name' })
  @IsOptional() @IsString() query?: string;
}
