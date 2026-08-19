import {
  IsArray,
  IsDateString,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import { PAYMENT_METHODS, PAYMENT_STATUSES } from './finance.dto';
import type { PaymentMethod, PaymentStatus } from './finance.dto';

export class ReceiptAllocationDto {
  @ApiProperty({ example: 'f1e2d3c4-b5a6-4789-9bcd-ef0123456789' })
  @IsString()
  @IsNotEmpty()
  invoiceId!: string;

  @ApiProperty({
    example: 5000000,
    description: 'Amount in kobo applied to this invoice',
  })
  @IsInt()
  @Min(1)
  amount!: number;
}

export class RecordReceiptDto {
  @ApiPropertyOptional({
    description:
      'The family account the money came in on. Required in practice for a multi-child payment.',
  })
  @IsOptional()
  @IsString()
  householdId?: string;

  @ApiPropertyOptional({
    description:
      'Student the money belongs to when there is no household — used to park any overpayment.',
  })
  @IsOptional()
  @IsString()
  studentId?: string;

  @ApiPropertyOptional({
    example: 'Mrs Adaeze Okonkwo',
    description: 'Who paid. Defaults to the household’s current primary payer.',
  })
  @IsOptional()
  @IsString()
  payerName?: string;

  @ApiProperty({ enum: PAYMENT_METHODS, example: 'transfer' })
  @IsIn(PAYMENT_METHODS)
  method!: PaymentMethod;

  @ApiProperty({ example: '2026-08-19', description: 'ISO date (YYYY-MM-DD)' })
  @IsDateString()
  paidAt!: string;

  @ApiProperty({
    example: 15000000,
    description:
      'Total received, in kobo. Anything unallocated becomes credit.',
  })
  @IsInt()
  @Min(1)
  amount!: number;

  @ApiPropertyOptional({ example: 'TXN-2026-00231' })
  @IsOptional()
  @IsString()
  reference?: string;

  @ApiPropertyOptional({ example: 'Part payment for both children' })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional({
    example: '5f1c3a9e-1c2b-4f1a-9f0e-6a2f4b8c1d3e',
    description:
      'A key for ONE submission. Retrying with the same key returns the receipt already recorded instead of taking the money twice.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  idempotencyKey?: string;

  @ApiPropertyOptional({
    type: [ReceiptAllocationDto],
    description:
      'What this receipt settles. Omit to hold the whole amount as credit.',
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ReceiptAllocationDto)
  allocations?: ReceiptAllocationDto[];
}

export class ListReceiptsDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  householdId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  invoiceId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  studentId?: string;

  @ApiPropertyOptional({ enum: PAYMENT_STATUSES })
  @IsOptional()
  @IsIn(PAYMENT_STATUSES)
  status?: PaymentStatus;

  @ApiPropertyOptional({ enum: PAYMENT_METHODS })
  @IsOptional()
  @IsIn(PAYMENT_METHODS)
  method?: PaymentMethod;

  @ApiPropertyOptional({ description: 'Receipt number, payer or reference' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ example: '2026-08-01' })
  @IsOptional()
  @IsDateString()
  from?: string;

  @ApiPropertyOptional({ example: '2026-08-31' })
  @IsOptional()
  @IsDateString()
  to?: string;

  @ApiPropertyOptional({ example: 25 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number;

  @ApiPropertyOptional({ example: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset?: number;
}

export class ApplyCreditDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  invoiceId!: string;

  @ApiProperty({ example: 250000, description: 'Amount in kobo' })
  @IsInt()
  @Min(1)
  amount!: number;
}

export class ListCreditsDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  householdId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  studentId?: string;

  @ApiPropertyOptional({ enum: ['active', 'exhausted', 'void'] })
  @IsOptional()
  @IsIn(['active', 'exhausted', 'void'])
  status?: string;
}
