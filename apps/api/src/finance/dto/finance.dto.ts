import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CreateInvoiceLineDto } from './catalogue.dto';

export const INVOICE_STATUSES = [
  'draft',
  'issued',
  'paid',
  'partial',
  'overdue',
  'cancelled',
] as const;
export const PAYMENT_STATUSES = [
  'pending',
  'completed',
  'failed',
  'refunded',
] as const;
export const PAYMENT_METHODS = ['transfer', 'card', 'cash', 'cheque'] as const;

export type InvoiceStatus = (typeof INVOICE_STATUSES)[number];
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

// ---- Invoice DTOs ---------------------------------------------------

export class CreateInvoiceDto {
  @ApiProperty({
    example: 'a1b2c3d4-e5f6-4789-9abc-def012345678',
    description: 'Student ID',
  })
  @IsString()
  @IsNotEmpty()
  studentId!: string;

  @ApiPropertyOptional({
    example: 'c2d3e4f5-a6b7-4890-9bcd-ef0123456789',
    description: 'Class ID',
  })
  @IsOptional()
  @IsString()
  classId?: string;

  @ApiPropertyOptional({ example: 'Spring Term' })
  @IsOptional()
  @IsString()
  termName?: string;


  @ApiPropertyOptional({ example: 2025 })
  @IsOptional()
  @IsInt()
  @Min(0)
  termYear?: number;

  @ApiPropertyOptional({
    example: 1,
    description: 'Term cycle number within the year',
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  termCycle?: number;

  @ApiPropertyOptional({ example: '2025-03-01' })
  @IsOptional()
  @IsDateString()
  issuedDate?: string;

  @ApiPropertyOptional({ example: '2025-03-15' })
  @IsOptional()
  @IsDateString()
  dueDate?: string;

  @ApiProperty({
    example: 18500000,
    description: 'Amount due in kobo (integer minor units)',
  })
  @IsInt()
  @Min(0)
  amountDue!: number;

  @ApiPropertyOptional({ example: 'First term tuition and boarding fees' })
  @IsOptional()
  @IsString()
  notes?: string;
}

export class UpdateInvoiceDto {
  @ApiPropertyOptional({ enum: INVOICE_STATUSES, example: 'issued' })
  @IsOptional()
  @IsIn(INVOICE_STATUSES)
  status?: InvoiceStatus;

  @ApiPropertyOptional({ example: 19000000 })
  @IsOptional()
  @IsInt()
  @Min(0)
  amountDue?: number;

  @ApiPropertyOptional({ example: '2025-03-20' })
  @IsOptional()
  @IsDateString()
  dueDate?: string;

  @ApiPropertyOptional({ example: 'Extended due date per parent request' })
  @IsOptional()
  @IsString()
  notes?: string;
}

/**
 * The details a DRAFT invoice was created with, corrected in place.
 *
 * Deliberately separate from `UpdateInvoiceDto`: that one carries the status
 * transitions, and issuing posts a receivable, applies standing discount
 * policies and draws down held credit — which is why it is step-up gated. A
 * draft is not yet a financial document, so correcting the term or due date it
 * was opened with is composition, guarded like its line items
 * (`finance.manage`) rather than like issuing it. The service refuses anything
 * that is no longer a draft.
 *
 * Every field is nullable, not merely optional: a term typed by mistake has to
 * be clearable, and `@IsOptional()` skips validation for `null` as well as
 * `undefined`.
 */
export class UpdateInvoiceHeaderDto {
  @ApiPropertyOptional({ example: 'Spring Term', nullable: true })
  @IsOptional()
  @IsString()
  termName?: string | null;

  @ApiPropertyOptional({ example: 2025, nullable: true })
  @IsOptional()
  @IsInt()
  @Min(0)
  termYear?: number | null;

  @ApiPropertyOptional({
    example: 1,
    description: 'Term cycle number within the year',
    nullable: true,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  termCycle?: number | null;

  @ApiPropertyOptional({ example: '2025-03-15', nullable: true })
  @IsOptional()
  @IsDateString()
  dueDate?: string | null;

  @ApiPropertyOptional({
    example: 'Extended due date per parent request',
    nullable: true,
  })
  @IsOptional()
  @IsString()
  notes?: string | null;
}

/**
 * A whole invoice, composed in the browser and written in one request.
 *
 * The compose surface holds a new invoice in memory — no row exists until the
 * bursar commits it — so this carries the header, every line, and whether to
 * issue it on the spot. It is one call for a hard reason: `StepUpGuard`
 * CONSUMES the challenge it verifies, so "create then issue" as two guarded
 * calls would demand two separate confirmations for one action. Issuing has to
 * happen inside the same request that creates the bill.
 */
export class ComposeInvoiceDto {
  @ApiProperty({ example: 'a1b2c3d4-e5f6-4789-9abc-def012345678' })
  @IsString()
  @IsNotEmpty()
  studentId!: string;

  @ApiPropertyOptional({ example: 'Spring Term' })
  @IsOptional()
  @IsString()
  termName?: string;

  @ApiPropertyOptional({ example: 2025 })
  @IsOptional()
  @IsInt()
  @Min(0)
  termYear?: number;

  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  termCycle?: number;

  @ApiPropertyOptional({ example: '2025-03-15' })
  @IsOptional()
  @IsDateString()
  dueDate?: string;

  @ApiPropertyOptional({ example: 'Extended due date per parent request' })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiProperty({ type: [CreateInvoiceLineDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateInvoiceLineDto)
  lines!: CreateInvoiceLineDto[];

  /**
   * Issue it as part of this same request rather than leaving it a draft.
   * Posts the receivable, applies standing discount policies and draws down
   * held credit — all inside the one transaction that created it.
   */
  @ApiPropertyOptional({ example: false, default: false })
  @IsOptional()
  @IsBoolean()
  issue?: boolean;
}

/**
 * Reserved `termName` meaning "filed under no term at all".
 *
 * A sentinel rather than a separate flag so one control on the list can offer
 * every term plus this, and the URL stays one parameter. Chosen to be
 * implausible as a real term name.
 */
export const UNTERMED = '__untermed__';

export class ListInvoicesDto {
  @ApiPropertyOptional({ example: 'a1b2c3d4-e5f6-4789-9abc-def012345678' })
  @IsOptional()
  @IsString()
  studentId?: string;

  @ApiPropertyOptional({ example: 'c2d3e4f5-a6b7-4890-9bcd-ef0123456789' })
  @IsOptional()
  @IsString()
  classId?: string;

  @ApiPropertyOptional({ enum: INVOICE_STATUSES, example: 'overdue' })
  @IsOptional()
  @IsIn(INVOICE_STATUSES)
  status?: InvoiceStatus;

  @ApiPropertyOptional({ example: 'Spring Term' })
  @IsOptional()
  @IsString()
  termName?: string;

  /**
   * Bound the list by DUE date — the date a bursar chases, and the one a
   * question like "what is overdue this month" is really about. Issue dates
   * cluster on the day a term was billed, so filtering by them mostly answers
   * "when did we run the billing", which is a different question.
   */
  @ApiPropertyOptional({ example: '2026-01-01', description: 'Due on or after' })
  @IsOptional()
  @IsDateString()
  dueFrom?: string;

  @ApiPropertyOptional({ example: '2026-12-31', description: 'Due on or before' })
  @IsOptional()
  @IsDateString()
  dueTo?: string;


  @ApiPropertyOptional({
    description: 'Search by invoice number or student name',
    example: 'Achebe',
  })
  @IsOptional()
  @IsString()
  search?: string;

  // Pagination + sort are optional here (not via PaginationDto) ON PURPOSE:
  // when `limit` is omitted the endpoint returns the FULL set, which the
  // finance-report and student-fees aggregate pages depend on. A `limit` opts
  // into a page for the server-driven invoices list.
  @ApiPropertyOptional({
    description: 'Page (1-based); only used when limit is set',
    example: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({
    description: 'Page size; omit to return all rows',
    example: 25,
    maximum: 100,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  @ApiPropertyOptional({ description: 'Sort field', example: 'studentName' })
  @IsOptional()
  @IsString()
  sortBy?: string;

  @ApiPropertyOptional({ enum: ['asc', 'desc'], example: 'asc' })
  @IsOptional()
  @IsIn(['asc', 'desc'])
  sortOrder?: 'asc' | 'desc';
}
