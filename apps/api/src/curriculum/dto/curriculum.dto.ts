import {
  IsDateString,
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

const NODE_ORIGINS = ['authored', 'ai', 'imported'] as const;

export class CreateAuthorityDto {
  @ApiProperty() @IsString() @MaxLength(120) name: string;
  @ApiProperty() @IsString() @MaxLength(40) code: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(40) kind?: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2)
  country?: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(400)
  description?: string;
}

export class CreateFrameworkDto {
  @ApiProperty() @IsUUID() authorityId: string;
  @ApiProperty() @IsString() @MaxLength(160) name: string;
  @ApiProperty() @IsString() @MaxLength(40) code: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(80)
  subjectArea?: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(400)
  description?: string;
}

export class CreateVersionDto {
  @ApiProperty() @IsUUID() frameworkId: string;
  @ApiProperty({ example: 'NERDC 2025' })
  @IsString()
  @MaxLength(80)
  versionLabel: string;
  @ApiProperty({ example: '2025-09-01' }) @IsDateString() effectiveFrom: string;
  @ApiPropertyOptional() @IsOptional() @IsDateString() effectiveTo?: string;
  @ApiPropertyOptional() @IsOptional() @IsObject() provenance?: Record<
    string,
    unknown
  >;
}

export class CreateStageDto {
  @ApiProperty({ example: 'Primary 1' })
  @IsString()
  @MaxLength(80)
  name: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(40)
  levelCode?: string;
  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  order?: number;
}

export class CreateSubjectDto {
  @ApiProperty() @IsString() @MaxLength(40) code: string;
  @ApiProperty() @IsString() @MaxLength(160) name: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() stageId?: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(160)
  canonicalName?: string;
  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  order?: number;
}

export class CreateNodeDto {
  @ApiProperty() @IsString() @MaxLength(300) title: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(40) kind?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() parentId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(40) code?: string;
  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  order?: number;
  @ApiPropertyOptional({ enum: NODE_ORIGINS })
  @IsOptional()
  @IsIn(NODE_ORIGINS as unknown as string[])
  origin?: string;
  @ApiPropertyOptional() @IsOptional() @IsObject() provenance?: Record<
    string,
    unknown
  >;
  // No `reviewedBy` here: a node is created unreviewed; review is the explicit,
  // actor-stamped POST /nodes/:id/review step (keeps the provenance gate honest).
}

export class CreateOutcomeDto {
  @ApiProperty() @IsString() @MaxLength(600) statement: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(40) code?: string;
  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  order?: number;
}

export class AdoptDto {
  @ApiProperty() @IsUUID() versionId: string;
  @ApiProperty({ example: 'Primary 1' })
  @IsString()
  @MaxLength(80)
  entryCohort: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  campusId?: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(80)
  programme?: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(40)
  levelFrom?: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(40)
  levelTo?: string;
  @ApiProperty({ example: '2025-09-01' }) @IsDateString() effectiveFrom: string;
  @ApiPropertyOptional() @IsOptional() @IsDateString() effectiveTo?: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(40)
  status?: string;
}

export class ResolveCohortQueryDto {
  @ApiProperty({ example: 'Primary 1' })
  @IsString()
  @MaxLength(80)
  cohort: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  campusId?: string;
  @ApiPropertyOptional() @IsOptional() @IsDateString() at?: string;
}

export class CreateOverlayDto {
  @ApiProperty() @IsUUID() baseVersionId: string;
  @ApiProperty({ example: 'add_subject' })
  @IsString()
  @MaxLength(40)
  changeType: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(40)
  targetType?: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  targetId?: string;
  @ApiPropertyOptional() @IsOptional() @IsObject() payload?: Record<
    string,
    unknown
  >;
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(400)
  note?: string;
}

export class UpsertMappingDto {
  @ApiProperty({ example: 'Cultural And Creative Arts' })
  @IsString()
  @MaxLength(160)
  fromName: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() toSubjectId?: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(160)
  toCanonicalName?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(40) kind?: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(400)
  note?: string;
}
