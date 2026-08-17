/**
 * WB4-3 · Trait DTOs — the affective / psychomotor rubric a cycle carries beside
 * its academic components, and the per-student ratings against it. A trait is
 * rated on a small ordinal scale (1..maxRating), never scored out of a max, and
 * never enters the academic total.
 */
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export const TRAIT_DOMAINS = ['affective', 'psychomotor'] as const;
export type TraitDomain = (typeof TRAIT_DOMAINS)[number];

export class ResultTraitInputDto {
  @ApiProperty({ enum: TRAIT_DOMAINS, example: 'affective' })
  @IsIn(TRAIT_DOMAINS as unknown as string[])
  domain: TraitDomain;

  @ApiProperty({ example: 'punctuality' })
  @IsString()
  @MaxLength(48)
  key: string;

  @ApiProperty({ example: 'Punctuality' })
  @IsString()
  @MaxLength(120)
  label: string;

  @ApiPropertyOptional({
    description: 'Top of the ordinal scale (2–10); default 5',
    example: 5,
  })
  @IsOptional()
  @IsInt()
  @Min(2)
  @Max(10)
  maxRating?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(500)
  order?: number;
}

export class ConfigureTraitsDto {
  @ApiProperty({ type: [ResultTraitInputDto] })
  @IsArray()
  @ArrayMaxSize(60)
  @ValidateNested({ each: true })
  @Type(() => ResultTraitInputDto)
  traits: ResultTraitInputDto[];
}

export class TraitRatingInputDto {
  @ApiProperty()
  @IsString()
  @MaxLength(64)
  studentId: string;

  @ApiProperty({ example: 'punctuality' })
  @IsString()
  @MaxLength(48)
  traitKey: string;

  @ApiPropertyOptional({
    description: 'Null clears the rating — unrated is not the lowest rating',
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10)
  rating?: number | null;
}

export class RateTraitsDto {
  @ApiProperty({ type: [TraitRatingInputDto] })
  @IsArray()
  @ArrayMaxSize(3000)
  @ValidateNested({ each: true })
  @Type(() => TraitRatingInputDto)
  ratings: TraitRatingInputDto[];
}
