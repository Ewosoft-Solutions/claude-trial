import {
  IsString,
  IsOptional,
  IsIn,
  IsBoolean,
  IsArray,
  ValidateNested,
  IsObject,
  IsBase64,
  MaxLength,
  ArrayMaxSize,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export const TARGET_DOMAINS = [
  'people',
  'students',
  'staff',
  'guardians',
  'opening_debt',
  'grades',
] as const;

export class ReconciliationRuleDto {
  @ApiProperty({ example: 'row-count' })
  @IsString()
  @MaxLength(120)
  name: string;

  @ApiProperty({ enum: ['count', 'sum', 'checksum', 'sample'] })
  @IsIn(['count', 'sum', 'checksum', 'sample'])
  kind: 'count' | 'sum' | 'checksum' | 'sample';

  @ApiPropertyOptional({
    description: 'e.g. { field: "amountKobo", expected: "1500000" }',
  })
  @IsOptional()
  @IsObject()
  config?: Record<string, unknown>;

  @ApiPropertyOptional({ description: 'Tolerance; "0" = exact (money)' })
  @IsOptional()
  @IsString()
  tolerance?: string;
}

export class CreateDefinitionDto {
  @ApiProperty({ example: 'people-v1' })
  @IsString()
  @MaxLength(64)
  key: string;

  @ApiProperty({ example: 'People (students + guardians)' })
  @IsString()
  @MaxLength(160)
  name: string;

  @ApiProperty({ enum: TARGET_DOMAINS })
  @IsIn(TARGET_DOMAINS)
  targetDomain: (typeof TARGET_DOMAINS)[number];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiPropertyOptional({ description: 'e.g. { strictCommit: true }' })
  @IsOptional()
  @IsObject()
  spec?: Record<string, unknown>;

  @ApiPropertyOptional({ type: [ReconciliationRuleDto] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => ReconciliationRuleDto)
  reconciliationRules?: ReconciliationRuleDto[];
}

export class CreateJobDto {
  @ApiProperty({ example: 'people-v1' })
  @IsString()
  @MaxLength(64)
  definitionKey: string;

  @ApiProperty({
    example: 'legacy-system',
    description: 'The legacy source system for this wave',
  })
  @IsString()
  @MaxLength(120)
  sourceSystem: string;
}

export class AttachSourceFileDto {
  @ApiProperty({ example: 'people.csv' })
  @IsString()
  @MaxLength(255)
  filename: string;

  @ApiPropertyOptional({ example: 'text/csv' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  mime?: string;

  @ApiProperty({ description: 'CSV bytes, base64-encoded (≈15 MB max)' })
  @IsBase64()
  @MaxLength(20_000_000)
  contentBase64: string;
}

export class ColumnMappingDto {
  @ApiProperty({ example: 'First Name' })
  @IsString()
  @MaxLength(160)
  sourceColumn: string;

  @ApiProperty({ example: 'firstName' })
  @IsString()
  @MaxLength(120)
  targetField: string;

  @ApiPropertyOptional({ description: 'Transform: { type, config }' })
  @IsOptional()
  @IsObject()
  transform?: { type: string; config?: Record<string, unknown> };

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  required?: boolean;
}

export class SetMappingDto {
  @ApiProperty({ type: [ColumnMappingDto] })
  @IsArray()
  @ArrayMaxSize(200)
  @ValidateNested({ each: true })
  @Type(() => ColumnMappingDto)
  mappings: ColumnMappingDto[];
}
