import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/** Create a fee item in the tenant's catalogue. */
export const FEE_PRICING_MODES = ['fixed', 'open'] as const;
export type FeePricingMode = (typeof FEE_PRICING_MODES)[number];

export class CreateFeeItemDto {
  @ApiProperty({
    example: 'boarding',
    description: 'Stable slug, unique per tenant',
  })
  @IsString()
  @IsNotEmpty()
  @Matches(/^[a-z0-9_]+$/, {
    message: 'code must be lowercase letters, digits or underscore',
  })
  code!: string;

  @ApiProperty({ example: 'Boarding' })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiPropertyOptional({
    enum: FEE_PRICING_MODES,
    default: 'fixed',
    description:
      "'fixed' prices the item here and locks the invoice line to it; " +
      "'open' leaves the amount to be typed per line (damages, misc).",
  })
  @IsOptional()
  @IsIn(FEE_PRICING_MODES)
  pricingMode?: FeePricingMode;

  @ApiPropertyOptional({
    example: 15000000,
    description: 'Price in kobo. Required before a FIXED item can be billed.',
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  defaultAmount?: number;
}

/** Edit a fee item (its code is immutable — it's referenced by lines/policies). */
export class UpdateFeeItemDto {
  @ApiPropertyOptional({ example: 'Boarding (full term)' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  name?: string;

  @ApiPropertyOptional({ enum: FEE_PRICING_MODES })
  @IsOptional()
  @IsIn(FEE_PRICING_MODES)
  pricingMode?: FeePricingMode;

  @ApiPropertyOptional({ example: 15000000, nullable: true })
  @IsOptional()
  @IsInt()
  @Min(0)
  defaultAmount?: number | null;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

/** Add a line to an invoice. */
export class CreateInvoiceLineDto {
  @ApiProperty({ example: 'a1b2c3d4-e5f6-4789-9abc-def012345678' })
  @IsString()
  @IsNotEmpty()
  feeItemId!: string;

  @ApiPropertyOptional({ example: 'First term boarding' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ example: 15000000, description: 'Per-unit amount in kobo' })
  @IsInt()
  @Min(0)
  amount!: number;

  @ApiPropertyOptional({ example: 1, default: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  quantity?: number;
}

/** Edit an invoice line. */
export class UpdateInvoiceLineDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  feeItemId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ example: 15000000 })
  @IsOptional()
  @IsInt()
  @Min(0)
  amount?: number;

  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  quantity?: number;
}

/**
 * One line as the browser currently holds it.
 *
 * `id` present means "this is the line you already have"; absent means it was
 * added while composing. A line the server holds but this list omits has been
 * removed — the whole point of sending the set rather than a change log.
 */
export class DraftLineDto {
  @ApiPropertyOptional({ description: 'Omitted for a line added on screen' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  id?: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  feeItemId!: string;

  @ApiPropertyOptional({ description: 'Ignored for a fixed-price item' })
  @IsOptional()
  @IsInt()
  @Min(0)
  amount?: number;

  @ApiProperty({ example: 1 })
  @IsInt()
  @Min(1)
  quantity!: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;
}

/**
 * A draft as edited in the browser, applied in one request.
 *
 * Editing used to write per change. That is correct but chatty, and the owner
 * would rather hold edits locally and push them once. So this carries the
 * whole intended state and the server reconciles: matching ids are updated,
 * new lines created, and anything it holds that is missing here is deleted.
 *
 * That makes it a REPLACE, which is worth naming: whoever saves last wins, and
 * a second person editing the same draft will have their changes overwritten
 * rather than merged. Acceptable for a draft (it is not yet a receivable, and
 * one bursar composes one bill), and the reason this endpoint refuses anything
 * that has left draft.
 */
export class UpdateDraftContentsDto {
  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  termName?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsInt()
  @Min(0)
  termYear?: number | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsInt()
  @Min(1)
  termCycle?: number | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsDateString()
  dueDate?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  notes?: string | null;

  @ApiProperty({ type: [DraftLineDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => DraftLineDto)
  lines!: DraftLineDto[];
}
