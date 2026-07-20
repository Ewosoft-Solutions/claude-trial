import {
  IsDateString,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export const INVOICE_STATUSES = ['draft', 'issued', 'paid', 'partial', 'overdue', 'cancelled'] as const;
export const PAYMENT_STATUSES = ['pending', 'completed', 'failed', 'refunded'] as const;
export const PAYMENT_METHODS = ['transfer', 'card', 'cash', 'cheque'] as const;

export type InvoiceStatus = (typeof INVOICE_STATUSES)[number];
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

// ---- Invoice DTOs ---------------------------------------------------

export class CreateInvoiceDto {
  @ApiProperty({ example: 'a1b2c3d4-e5f6-4789-9abc-def012345678', description: 'Student ID' })
  @IsString() @IsNotEmpty() studentId!: string;

  @ApiPropertyOptional({ example: 'c2d3e4f5-a6b7-4890-9bcd-ef0123456789', description: 'Class ID' })
  @IsOptional() @IsString() classId?: string;

  @ApiPropertyOptional({ example: 'Spring Term' })
  @IsOptional() @IsString() termName?: string;

  @ApiPropertyOptional({ example: 2025 })
  @IsOptional() @IsInt() @Min(0) termYear?: number;

  @ApiPropertyOptional({ example: 1, description: 'Term cycle number within the year' })
  @IsOptional() @IsInt() @Min(1) termCycle?: number;

  @ApiPropertyOptional({ example: '2025-03-01' })
  @IsOptional() @IsDateString() issuedDate?: string;

  @ApiPropertyOptional({ example: '2025-03-15' })
  @IsOptional() @IsDateString() dueDate?: string;

  @ApiProperty({ example: 18500000, description: 'Amount due in kobo (integer minor units)' })
  @IsInt() @Min(0) amountDue!: number;

  @ApiPropertyOptional({ example: 'First term tuition and boarding fees' })
  @IsOptional() @IsString() notes?: string;
}

export class UpdateInvoiceDto {
  @ApiPropertyOptional({ enum: INVOICE_STATUSES, example: 'issued' })
  @IsOptional() @IsIn(INVOICE_STATUSES) status?: InvoiceStatus;

  @ApiPropertyOptional({ example: 19000000 })
  @IsOptional() @IsInt() @Min(0) amountDue?: number;

  @ApiPropertyOptional({ example: '2025-03-20' })
  @IsOptional() @IsDateString() dueDate?: string;

  @ApiPropertyOptional({ example: 'Extended due date per parent request' })
  @IsOptional() @IsString() notes?: string;
}

export class ListInvoicesDto {
  @ApiPropertyOptional({ example: 'a1b2c3d4-e5f6-4789-9abc-def012345678' })
  @IsOptional() @IsString() studentId?: string;

  @ApiPropertyOptional({ example: 'c2d3e4f5-a6b7-4890-9bcd-ef0123456789' })
  @IsOptional() @IsString() classId?: string;

  @ApiPropertyOptional({ enum: INVOICE_STATUSES, example: 'overdue' })
  @IsOptional() @IsIn(INVOICE_STATUSES) status?: InvoiceStatus;

  @ApiPropertyOptional({ example: 'Spring Term' })
  @IsOptional() @IsString() termName?: string;
}

// ---- Payment DTOs ---------------------------------------------------

export class RecordPaymentDto {
  @ApiProperty({ example: 'f1e2d3c4-b5a6-4789-9bcd-ef0123456789', description: 'Invoice ID' })
  @IsString() @IsNotEmpty() invoiceId!: string;

  @ApiProperty({ example: 'a1b2c3d4-e5f6-4789-9abc-def012345678', description: 'Student ID' })
  @IsString() @IsNotEmpty() studentId!: string;

  @ApiProperty({ enum: PAYMENT_METHODS, example: 'transfer' })
  @IsIn(PAYMENT_METHODS) method!: PaymentMethod;

  @ApiProperty({ example: '2025-03-10', description: 'ISO date string (YYYY-MM-DD)' })
  @IsDateString() paidAt!: string;

  @ApiProperty({ example: 10000000, description: 'Amount in kobo (integer minor units)' })
  @IsInt() @Min(1) amount!: number;

  @ApiPropertyOptional({ example: 'TXN-2025-00231', description: 'Payment gateway ref / cheque number' })
  @IsOptional() @IsString() reference?: string;

  @ApiPropertyOptional({ example: 'Part payment toward first term fees' })
  @IsOptional() @IsString() notes?: string;
}

export class ListPaymentsDto {
  @ApiPropertyOptional({ example: 'f1e2d3c4-b5a6-4789-9bcd-ef0123456789' })
  @IsOptional() @IsString() invoiceId?: string;

  @ApiPropertyOptional({ example: 'a1b2c3d4-e5f6-4789-9abc-def012345678' })
  @IsOptional() @IsString() studentId?: string;

  @ApiPropertyOptional({ enum: PAYMENT_STATUSES, example: 'completed' })
  @IsOptional() @IsIn(PAYMENT_STATUSES) status?: PaymentStatus;

  @ApiPropertyOptional({ example: '2025-03-01' })
  @IsOptional() @IsDateString() from?: string;

  @ApiPropertyOptional({ example: '2025-03-31' })
  @IsOptional() @IsDateString() to?: string;
}
