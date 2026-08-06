import { IsIn, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/** Create a billing household (family account) by hand. */
export class CreateHouseholdDto {
  @ApiProperty({ example: 'Okafor family' })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiPropertyOptional({ example: 'Mrs. Amaka Okafor' })
  @IsOptional()
  @IsString()
  primaryPayerName?: string;
}

/** Edit a household's display fields. */
export class UpdateHouseholdDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  primaryPayerName?: string;
}

/** Add a student to a household (opens a membership effective now). */
export class AddHouseholdMemberDto {
  @ApiProperty({ example: 'a1b2c3d4-e5f6-4789-9abc-def012345678' })
  @IsString()
  @IsNotEmpty()
  studentId!: string;

  @ApiPropertyOptional({ example: 'Chidi Okafor' })
  @IsOptional()
  @IsString()
  studentName?: string;
}

/** Add a payer (a guardian Person) to a household. */
export class AddHouseholdPayerDto {
  @ApiProperty({ example: 'p1a2b3c4-d5e6-4789-9abc-def012345678' })
  @IsString()
  @IsNotEmpty()
  guardianId!: string;

  @ApiPropertyOptional({ example: 'Mrs. Amaka Okafor' })
  @IsOptional()
  @IsString()
  payerName?: string;

  @ApiPropertyOptional({ enum: ['primary', 'secondary'], example: 'secondary' })
  @IsOptional()
  @IsIn(['primary', 'secondary'])
  role?: 'primary' | 'secondary';
}

/** Merge one household into another (members + payers move to the target). */
export class MergeHouseholdsDto {
  @ApiProperty({ description: 'The household that is absorbed and then ended' })
  @IsString()
  @IsNotEmpty()
  sourceHouseholdId!: string;
}
