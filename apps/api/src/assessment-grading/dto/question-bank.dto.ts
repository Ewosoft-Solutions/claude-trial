import {
  ArrayNotEmpty,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PaginationDto } from '../../common/dto';

export const QUESTION_STYLES = [
  'mcq',
  'true_false',
  'short_answer',
  'essay',
] as const;
export type QuestionStyle = (typeof QUESTION_STYLES)[number];

export const QUESTION_DIFFICULTIES = ['easy', 'medium', 'hard'] as const;

/** Styles the server can mark without a teacher. */
export const AUTO_GRADABLE_STYLES: readonly QuestionStyle[] = [
  'mcq',
  'true_false',
  'short_answer',
];

export class QuestionOptionDto {
  @ApiProperty({ example: 'A', description: 'Option label (A, B, C…)' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(10)
  label!: string;

  @ApiPropertyOptional({ example: 'Chlorophyll' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  text?: string;

  @ApiPropertyOptional({ description: 'Storage key of an option image' })
  @IsOptional()
  @IsString()
  imageKey?: string;
}

export class CreateQuestionDto {
  @ApiProperty({ description: 'Course the question bank entry belongs to' })
  @IsString()
  @IsNotEmpty()
  courseId!: string;

  @ApiPropertyOptional({ enum: QUESTION_STYLES, default: 'mcq' })
  @IsOptional()
  @IsIn(QUESTION_STYLES)
  style?: QuestionStyle;

  @ApiPropertyOptional({ example: 'Choose the correct option' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  instruction?: string;

  @ApiProperty({ example: 'Which pigment drives photosynthesis?' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(10000)
  text!: string;

  @ApiPropertyOptional({ description: 'Storage key of an illustration' })
  @IsOptional()
  @IsString()
  imageKey?: string;

  @ApiPropertyOptional({ type: [QuestionOptionDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => QuestionOptionDto)
  options?: QuestionOptionDto[];

  @ApiPropertyOptional({
    example: 'A',
    description:
      'Correct option label (mcq/true_false) or model answer (short_answer); omit for essay',
  })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  correctAnswer?: string;

  @ApiPropertyOptional({ description: 'Worked solution shown after grading' })
  @IsOptional()
  @IsString()
  @MaxLength(10000)
  solution?: string;

  @ApiPropertyOptional({ enum: QUESTION_DIFFICULTIES })
  @IsOptional()
  @IsIn(QUESTION_DIFFICULTIES)
  difficulty?: (typeof QUESTION_DIFFICULTIES)[number];
}

export class UpdateQuestionDto {
  @ApiPropertyOptional({ enum: QUESTION_STYLES })
  @IsOptional()
  @IsIn(QUESTION_STYLES)
  style?: QuestionStyle;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  instruction?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(10000)
  text?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  imageKey?: string;

  @ApiPropertyOptional({ type: [QuestionOptionDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => QuestionOptionDto)
  options?: QuestionOptionDto[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  correctAnswer?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(10000)
  solution?: string;

  @ApiPropertyOptional({ enum: QUESTION_DIFFICULTIES })
  @IsOptional()
  @IsIn(QUESTION_DIFFICULTIES)
  difficulty?: (typeof QUESTION_DIFFICULTIES)[number];

  @ApiPropertyOptional({ description: 'Soft-retire a question from the bank' })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class ListQuestionsDto extends PaginationDto {
  @ApiPropertyOptional({ description: 'Filter by course' })
  @IsOptional()
  @IsString()
  courseId?: string;

  @ApiPropertyOptional({ enum: QUESTION_STYLES })
  @IsOptional()
  @IsIn(QUESTION_STYLES)
  style?: QuestionStyle;

  @ApiPropertyOptional({ enum: QUESTION_DIFFICULTIES })
  @IsOptional()
  @IsIn(QUESTION_DIFFICULTIES)
  difficulty?: (typeof QUESTION_DIFFICULTIES)[number];
}

export class AttachQuestionDto {
  @ApiProperty({ description: 'Question bank entry to attach' })
  @IsString()
  @IsNotEmpty()
  questionId!: string;

  @ApiPropertyOptional({ example: 1, description: 'Position on the paper' })
  @IsOptional()
  @IsInt()
  @Min(0)
  order?: number;

  @ApiPropertyOptional({ example: 2, description: 'Points for this question', default: 1 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  points?: number;
}

export class AttachQuestionsDto {
  @ApiProperty({ type: [AttachQuestionDto] })
  @IsArray()
  @ArrayNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => AttachQuestionDto)
  questions!: AttachQuestionDto[];
}

export class SubmittedAnswerDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  questionId!: string;

  @ApiProperty({
    example: 'B',
    description: 'Option label (mcq/true_false) or free text',
  })
  @IsString()
  @MaxLength(20000)
  answer!: string;
}

export class SubmitAssessmentDto {
  @ApiProperty({ type: [SubmittedAnswerDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SubmittedAnswerDto)
  answers!: SubmittedAnswerDto[];
}

export class GradeSubmissionDto {
  @ApiProperty({
    example: 78.5,
    description:
      'Total points earned after manual review of non-auto-gradable answers',
  })
  @IsNumber()
  @Min(0)
  pointsEarned!: number;

  @ApiPropertyOptional({ description: 'Feedback stored on the Grade record' })
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  feedback?: string;
}
