import {
  IsBoolean,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  Min,
} from 'class-validator';
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
