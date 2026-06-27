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
  @ApiProperty() @IsString() @IsNotEmpty() studentId!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() classId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() termName?: string;
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(0) termYear?: number;
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(1) termCycle?: number;
  @ApiPropertyOptional() @IsOptional() @IsDateString() issuedDate?: string;
  @ApiPropertyOptional() @IsOptional() @IsDateString() dueDate?: string;
  @ApiProperty({ description: 'Amount due in kobo (integer minor units)' })
  @IsInt() @Min(0) amountDue!: number;
  @ApiPropertyOptional() @IsOptional() @IsString() notes?: string;
}

export class UpdateInvoiceDto {
  @ApiPropertyOptional({ enum: INVOICE_STATUSES })
  @IsOptional() @IsIn(INVOICE_STATUSES) status?: InvoiceStatus;
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(0) amountDue?: number;
  @ApiPropertyOptional() @IsOptional() @IsDateString() dueDate?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() notes?: string;
}

export class ListInvoicesDto {
  @ApiPropertyOptional() @IsOptional() @IsString() studentId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() classId?: string;
  @ApiPropertyOptional({ enum: INVOICE_STATUSES })
  @IsOptional() @IsIn(INVOICE_STATUSES) status?: InvoiceStatus;
  @ApiPropertyOptional() @IsOptional() @IsString() termName?: string;
}

// ---- Payment DTOs ---------------------------------------------------

export class RecordPaymentDto {
  @ApiProperty() @IsString() @IsNotEmpty() invoiceId!: string;
  @ApiProperty() @IsString() @IsNotEmpty() studentId!: string;
  @ApiProperty({ enum: PAYMENT_METHODS })
  @IsIn(PAYMENT_METHODS) method!: PaymentMethod;
  @ApiProperty({ description: 'ISO date string (YYYY-MM-DD)' })
  @IsDateString() paidAt!: string;
  @ApiProperty({ description: 'Amount in kobo (integer minor units)' })
  @IsInt() @Min(1) amount!: number;
  @ApiPropertyOptional() @IsOptional() @IsString() reference?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() notes?: string;
}

export class ListPaymentsDto {
  @ApiPropertyOptional() @IsOptional() @IsString() invoiceId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() studentId?: string;
  @ApiPropertyOptional({ enum: PAYMENT_STATUSES })
  @IsOptional() @IsIn(PAYMENT_STATUSES) status?: PaymentStatus;
  @ApiPropertyOptional() @IsOptional() @IsDateString() from?: string;
  @ApiPropertyOptional() @IsOptional() @IsDateString() to?: string;
}
