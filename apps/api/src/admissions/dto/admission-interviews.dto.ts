import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * WB3-4 · interview / exam / screening scheduling + outcome, and the inline
 * admission quiz (an 'exam' kind carrying a question paper, auto-marked with the
 * shared objective marker).
 */
export const INTERVIEW_KINDS = ['interview', 'exam', 'screening'] as const;
export type InterviewKind = (typeof INTERVIEW_KINDS)[number];

export const INTERVIEW_MODES = ['in_person', 'online', 'phone'] as const;
export const INTERVIEW_STATUSES = [
  'scheduled',
  'completed',
  'cancelled',
  'no_show',
] as const;
export const INTERVIEW_OUTCOMES = ['pass', 'fail', 'hold'] as const;

/** Statuses the cancel action may set (a closed-not-completed file). */
export const CANCEL_STATUSES = ['cancelled', 'no_show'] as const;

// Same styles as classroom assessments; the objective ones are auto-marked.
export const QUIZ_QUESTION_STYLES = [
  'mcq',
  'true_false',
  'short_answer',
  'essay',
] as const;
export type QuizQuestionStyle = (typeof QUIZ_QUESTION_STYLES)[number];
export const QUIZ_AUTO_GRADABLE_STYLES: readonly string[] = [
  'mcq',
  'true_false',
  'short_answer',
];

/** One inline question on an exam paper. */
export class QuizQuestionDto {
  @ApiPropertyOptional({
    description: 'Stable id; server-assigned if omitted.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  id?: string;

  @ApiProperty({ enum: QUIZ_QUESTION_STYLES, example: 'mcq' })
  @IsIn(QUIZ_QUESTION_STYLES)
  style!: QuizQuestionStyle;

  @ApiProperty({ example: 'What is 7 × 8?' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  text!: string;

  @ApiPropertyOptional({
    type: [String],
    description: 'Option labels for mcq / true_false.',
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(26)
  @IsString({ each: true })
  @MaxLength(240, { each: true })
  options?: string[];

  @ApiPropertyOptional({
    description:
      'Answer key (label/text) for objective styles; omit for essay.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(240)
  correctAnswer?: string;

  @ApiPropertyOptional({ example: 1, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(100)
  points?: number;
}

export class ScheduleInterviewDto {
  @ApiProperty({ enum: INTERVIEW_KINDS, example: 'interview' })
  @IsIn(INTERVIEW_KINDS)
  kind!: InterviewKind;

  @ApiPropertyOptional({ example: 'Head-teacher interview' })
  @IsOptional()
  @IsString()
  @MaxLength(160)
  title?: string;

  @ApiPropertyOptional({ enum: INTERVIEW_MODES, default: 'in_person' })
  @IsOptional()
  @IsIn(INTERVIEW_MODES)
  mode?: (typeof INTERVIEW_MODES)[number];

  @ApiPropertyOptional({ example: 'Room 2, Admin block' })
  @IsOptional()
  @IsString()
  @MaxLength(240)
  location?: string;

  @ApiPropertyOptional({ example: '2026-03-20T10:00:00.000Z' })
  @IsOptional()
  @IsDateString()
  scheduledFor?: string;

  @ApiPropertyOptional({ example: 30 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(600)
  durationMinutes?: number;

  @ApiPropertyOptional({ description: 'UserTenant id of the interviewer.' })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  interviewerId?: string;

  @ApiPropertyOptional({
    type: [QuizQuestionDto],
    description:
      'Question paper for an exam-kind interview (the admission quiz).',
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => QuizQuestionDto)
  questions?: QuizQuestionDto[];
}

/** Edit a scheduled interview (reschedule / retitle / amend the paper). */
export class UpdateInterviewDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(160)
  title?: string;

  @ApiPropertyOptional({ enum: INTERVIEW_MODES })
  @IsOptional()
  @IsIn(INTERVIEW_MODES)
  mode?: (typeof INTERVIEW_MODES)[number];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(240)
  location?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  scheduledFor?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(600)
  durationMinutes?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(64)
  interviewerId?: string;

  @ApiPropertyOptional({ type: [QuizQuestionDto] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => QuizQuestionDto)
  questions?: QuizQuestionDto[];
}

/** Record a structured outcome (marks the interview completed). */
export class RecordOutcomeDto {
  @ApiPropertyOptional({ enum: INTERVIEW_OUTCOMES, example: 'pass' })
  @IsOptional()
  @IsIn(INTERVIEW_OUTCOMES)
  outcome?: (typeof INTERVIEW_OUTCOMES)[number];

  @ApiPropertyOptional({ example: 78, minimum: 0, maximum: 1000 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(1000)
  score?: number;

  @ApiPropertyOptional({ example: 100, minimum: 1, maximum: 1000 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(1000)
  maxScore?: number;

  @ApiPropertyOptional({ example: 'Confident; strong numeracy.' })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;
}

/** Close an interview without completing it (cancelled / no-show). */
export class CancelInterviewDto {
  @ApiPropertyOptional({ enum: CANCEL_STATUSES, default: 'cancelled' })
  @IsOptional()
  @IsIn(CANCEL_STATUSES)
  status?: (typeof CANCEL_STATUSES)[number];

  @ApiPropertyOptional({ example: 'Guardian requested a new date.' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}

export class QuizAnswerDto {
  @ApiProperty({ description: 'The question id from the paper.' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  questionId!: string;

  @ApiProperty({ example: 'B' })
  @IsString()
  @MaxLength(4000)
  answer!: string;
}

/** Submit an applicant's answers to an exam-kind interview's quiz (auto-marked). */
export class SubmitQuizDto {
  @ApiProperty({ type: [QuizAnswerDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => QuizAnswerDto)
  answers!: QuizAnswerDto[];
}
