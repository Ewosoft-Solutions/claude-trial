import {
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export const ADJUSTMENT_TYPES = [
  'discount',
  'waiver',
  'scholarship',
  'correction',
] as const;
export type AdjustmentType = (typeof ADJUSTMENT_TYPES)[number];

export const DISCOUNT_POLICY_TYPES = ['discount', 'scholarship'] as const;
export type DiscountPolicyType = (typeof DISCOUNT_POLICY_TYPES)[number];

/** Request a discretionary adjustment (needs maker-checker approval to apply). */
export class CreateAdjustmentDto {
  @ApiProperty({ example: 'a1b2c3d4-e5f6-4789-9abc-def012345678' })
  @IsString()
  @IsNotEmpty()
  invoiceId!: string;

  @ApiPropertyOptional({
    description: 'Adjust one line rather than the whole invoice',
  })
  @IsOptional()
  @IsString()
  lineId?: string;

  @ApiProperty({ enum: ADJUSTMENT_TYPES, example: 'waiver' })
  @IsIn(ADJUSTMENT_TYPES)
  type!: AdjustmentType;

  @ApiProperty({
    example: 500000,
    description: 'Amount off, in kobo (minor units)',
  })
  @IsInt()
  @Min(1)
  amount!: number;

  @ApiPropertyOptional({ example: 'Hardship — approved by bursar' })
  @IsOptional()
  @IsString()
  reason?: string;
}

/** Approve or reject a pending adjustment / policy activation. */
export class ApprovalDecisionDto {
  @ApiPropertyOptional({ example: 'Verified supporting documents' })
  @IsOptional()
  @IsString()
  reason?: string;
}

/** Create a discount policy (activation is a separate maker-checker step). */
export class CreateDiscountPolicyDto {
  @ApiProperty({ example: 'Sibling discount' })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiProperty({ enum: DISCOUNT_POLICY_TYPES, example: 'discount' })
  @IsIn(DISCOUNT_POLICY_TYPES)
  type!: DiscountPolicyType;

  @ApiPropertyOptional({
    description: 'Target a specific fee item; omit for the whole invoice',
  })
  @IsOptional()
  @IsString()
  feeItemId?: string;

  @ApiPropertyOptional({
    example: 500000,
    description: 'Fixed amount off in kobo (use this OR percentBps)',
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  amount?: number;

  @ApiPropertyOptional({
    example: 1000,
    description: 'Percentage off in basis points (1000 = 10%)',
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10000)
  percentBps?: number;

  @ApiPropertyOptional({ example: 'Second and subsequent siblings' })
  @IsOptional()
  @IsString()
  reason?: string;
}

/** Filter the approvals queue. */
export class ListAdjustmentsDto {
  @ApiPropertyOptional({
    enum: ['pending', 'approved', 'rejected', 'applied'],
    example: 'pending',
  })
  @IsOptional()
  @IsIn(['pending', 'approved', 'rejected', 'applied'])
  status?: string;

  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ example: 25 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  limit?: number;
}
