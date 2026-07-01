import { IsDateString, IsIn, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export const LIBRARY_BOOK_STATUSES = ['available', 'on_loan', 'reserved', 'overdue'] as const;
export type LibraryBookStatus = (typeof LIBRARY_BOOK_STATUSES)[number];

export class CreateBookDto {
  @ApiProperty({ example: 'Things Fall Apart' })
  @IsString() @IsNotEmpty() title!: string;

  @ApiProperty({ example: 'Chinua Achebe' })
  @IsString() @IsNotEmpty() author!: string;

  @ApiPropertyOptional({ example: '978-0385474542' })
  @IsOptional() @IsString() isbn?: string;

  @ApiPropertyOptional({ example: 'Fiction' })
  @IsOptional() @IsString() category?: string;

  @ApiPropertyOptional({ example: 'Copy 1 of 3' })
  @IsOptional() @IsString() copyLabel?: string;
}

export class UpdateBookDto {
  @ApiPropertyOptional({ example: 'Things Fall Apart' })
  @IsOptional() @IsString() title?: string;

  @ApiPropertyOptional({ example: 'Chinua Achebe' })
  @IsOptional() @IsString() author?: string;

  @ApiPropertyOptional({ example: '978-0385474542' })
  @IsOptional() @IsString() isbn?: string;

  @ApiPropertyOptional({ example: 'Fiction' })
  @IsOptional() @IsString() category?: string;

  @ApiPropertyOptional({ example: 'Copy 1 of 3' })
  @IsOptional() @IsString() copyLabel?: string;
}

export class ListBooksDto {
  @ApiPropertyOptional({ enum: LIBRARY_BOOK_STATUSES, example: 'available' })
  @IsOptional() @IsIn(LIBRARY_BOOK_STATUSES) status?: LibraryBookStatus;

  @ApiPropertyOptional({ example: 'Fiction' })
  @IsOptional() @IsString() category?: string;

  @ApiPropertyOptional({ example: 'Achebe', description: 'Free-text search across title/author/ISBN' })
  @IsOptional() @IsString() query?: string;
}

export class CheckoutBookDto {
  @ApiProperty({ example: 'a1b2c3d4-0000-0000-0000-000000000000' })
  @IsString() @IsNotEmpty() studentId!: string;

  @ApiPropertyOptional({ example: '2026-07-15' })
  @IsOptional() @IsDateString() dueDate?: string;
}
