import {
  IsString,
  IsOptional,
  IsIn,
  IsBoolean,
  IsBase64,
  IsUUID,
  IsDateString,
  MaxLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export const DOCUMENT_VISIBILITIES = ['private', 'tenant', 'restricted'] as const;

export class UploadDocumentDto {
  @ApiProperty({ example: 'Person', description: 'Owner entity type' })
  @IsString()
  @MaxLength(64)
  ownerType: string;

  @ApiProperty({ description: 'Owner entity id' })
  @IsString()
  @MaxLength(64)
  ownerId: string;

  @ApiPropertyOptional({ description: 'DocumentType key (defines default policy)' })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  typeKey?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  title?: string;

  @ApiPropertyOptional({ enum: DOCUMENT_VISIBILITIES })
  @IsOptional()
  @IsIn(DOCUMENT_VISIBILITIES)
  visibility?: (typeof DOCUMENT_VISIBILITIES)[number];

  @ApiPropertyOptional({ description: 'Sensitive downloads require documents.download_sensitive' })
  @IsOptional()
  @IsBoolean()
  sensitive?: boolean;

  @ApiProperty({ example: 'image/jpeg' })
  @IsString()
  @MaxLength(160)
  mime: string;

  @ApiPropertyOptional({ example: 'passport.jpg' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  filename?: string;

  @ApiProperty({ description: 'File bytes, base64-encoded' })
  @IsBase64()
  contentBase64: string;

  @ApiPropertyOptional({ description: 'Migration source system' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  sourceSystem?: string;

  @ApiPropertyOptional({ description: 'Migration source id' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  sourceId?: string;
}

export class SetLegalHoldDto {
  @ApiProperty()
  @IsBoolean()
  hold: boolean;
}

export class RegisterSigningAuthorityDto {
  @ApiProperty({ description: 'The Person granted signing authority' })
  @IsUUID()
  personId: string;

  @ApiProperty({ example: 'Principal' })
  @IsString()
  @MaxLength(120)
  role: string;

  @ApiPropertyOptional({ description: 'Restricted Document holding the signature image' })
  @IsOptional()
  @IsUUID()
  signatureDocumentId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  validFrom?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  validTo?: string;
}

export class ApplySignatureDto {
  @ApiProperty()
  @IsUUID()
  signingAuthorityId: string;

  @ApiProperty({ example: 'ResultPublication' })
  @IsString()
  @MaxLength(64)
  artifactType: string;

  @ApiProperty({ description: 'The artifact being signed' })
  @IsString()
  @MaxLength(64)
  artifactId: string;

  @ApiPropertyOptional({ description: 'The produced signed-artifact Document' })
  @IsOptional()
  @IsUUID()
  producedDocumentId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(128)
  artifactChecksum?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
