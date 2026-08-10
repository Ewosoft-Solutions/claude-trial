import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * WB3-3 · a school-authored, versioned application form + typed responses.
 *
 * A form version is a DRAFT until published; publishing supersedes the prior
 * published version (which is archived), and a published version is immutable —
 * editing forks a fresh draft. Answers are validated against the current
 * published version by field type, then snapshotted onto the response so a later
 * form edit never rewrites captured answers.
 */

/** Typed field kinds a school can put on the application form. */
export const FORM_FIELD_TYPES = [
  'text',
  'paragraph',
  'number',
  'date',
  'select',
  'multiselect',
  'boolean',
] as const;
export type FormFieldType = (typeof FORM_FIELD_TYPES)[number];

/** Field kinds whose answer is chosen from a fixed option set. */
export const OPTION_FIELD_TYPES: readonly FormFieldType[] = [
  'select',
  'multiselect',
];

export const FORM_VERSION_STATUSES = [
  'draft',
  'published',
  'archived',
] as const;
export type FormVersionStatus = (typeof FORM_VERSION_STATUSES)[number];

/** One typed field on the form (stored in AdmissionFormVersion.fields). */
export class FormFieldDto {
  @ApiProperty({ example: 'previous_school', description: 'Stable field key' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  key!: string;

  @ApiProperty({ example: 'Previous school attended' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(160)
  label!: string;

  @ApiProperty({ enum: FORM_FIELD_TYPES, example: 'text' })
  @IsIn(FORM_FIELD_TYPES)
  type!: FormFieldType;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  required?: boolean;

  @ApiPropertyOptional({
    type: [String],
    description: 'Choices for select / multiselect fields.',
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @IsString({ each: true })
  @MaxLength(160, { each: true })
  options?: string[];

  @ApiPropertyOptional({ example: 'As written on the transfer certificate.' })
  @IsOptional()
  @IsString()
  @MaxLength(240)
  help?: string;

  @ApiPropertyOptional({ example: 'e.g. Sunrise Primary School' })
  @IsOptional()
  @IsString()
  @MaxLength(160)
  placeholder?: string;
}

export class CreateFormVersionDto {
  @ApiProperty({ example: 'Sunrise 2026/27 Application' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(160)
  title!: string;

  @ApiPropertyOptional({ example: 'Extra questions for senior-school entry.' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiProperty({ type: [FormFieldDto] })
  @IsArray()
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => FormFieldDto)
  fields!: FormFieldDto[];
}

/** Update a DRAFT version (published versions are immutable). */
export class UpdateFormVersionDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(160)
  title?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiPropertyOptional({ type: [FormFieldDto] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => FormFieldDto)
  fields?: FormFieldDto[];
}

/** An application's typed answers to the current published form. */
export class SubmitFormResponseDto {
  @ApiProperty({
    description: 'Answers keyed by field key, e.g. { previous_school: "…" }.',
    example: { previous_school: 'Sunrise Primary', siblings_here: true },
  })
  @IsObject()
  answers!: Record<string, unknown>;
}
