/**
 * WB4-2 · Spreadsheet score-import DTOs (parity job 54). The file arrives
 * base64-encoded in a JSON body — the same shape the F2 import platform uses for
 * a source file — so the web proxy needs no multipart handling.
 */
import {
  IsBase64,
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export const IMPORT_FORMATS = ['csv', 'xlsx'] as const;
export type ImportFormat = (typeof IMPORT_FORMATS)[number];

export class ImportResultScoresDto {
  @ApiProperty({ description: 'The class section the sheet covers' })
  @IsString()
  @MaxLength(64)
  sectionId: string;

  @ApiPropertyOptional({
    description:
      'Single-subject sheet: the offering every row belongs to. Omit for a ' +
      'multi-subject sheet carrying a Subject column.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  subjectOfferingId?: string;

  @ApiPropertyOptional({ example: 'jss1a-first-ca.xlsx' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  filename?: string;

  @ApiPropertyOptional({
    enum: IMPORT_FORMATS,
    description: 'Defaults to the filename extension, else csv',
  })
  @IsOptional()
  @IsIn(IMPORT_FORMATS as unknown as string[])
  format?: ImportFormat;

  @ApiProperty({ description: 'Sheet bytes, base64-encoded (≈5 MB max)' })
  @IsBase64()
  @MaxLength(7_000_000)
  contentBase64: string;

  @ApiPropertyOptional({
    description:
      'false (default) = dry run: validate + report, write nothing. true = ' +
      'commit, refused unless the dry run is error-free.',
  })
  @IsOptional()
  @IsBoolean()
  commit?: boolean;
}
