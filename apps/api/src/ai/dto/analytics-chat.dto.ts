import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';

export class AnalyticsChatDto {
  @ApiProperty({
    example: 'How many students were in school last week?',
    description: 'The natural-language analytics question.',
  })
  @IsString()
  @MinLength(1)
  @MaxLength(4000)
  message!: string;

  @ApiPropertyOptional({
    description:
      'Existing analytics ChatSession id to continue; omitted = new session.',
  })
  @IsOptional()
  @IsUUID()
  sessionId?: string;
}
