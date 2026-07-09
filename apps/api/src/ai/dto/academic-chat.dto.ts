import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';

export class AcademicChatDto {
  @ApiProperty({
    example: 'Can you explain what photosynthesis is?',
    description: 'The student question, answered from the lesson materials.',
  })
  @IsString()
  @MinLength(1)
  @MaxLength(4000)
  message!: string;

  @ApiProperty({
    description:
      'Lesson to ground the answer in. Required for a new conversation; ' +
      'when resuming a session the session\'s lesson is authoritative.',
  })
  @IsUUID()
  lessonId!: string;

  @ApiPropertyOptional({
    description:
      'Existing academic ChatSession id to continue; omitted = new session.',
  })
  @IsOptional()
  @IsUUID()
  sessionId?: string;
}
