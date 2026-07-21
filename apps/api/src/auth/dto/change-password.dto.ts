import { IsEmail, IsString, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ChangePasswordDto {
  @ApiProperty({
    example: 'architect@example.com',
    description:
      'Account to change. Sent explicitly because this endpoint takes no token — an account under forced rotation cannot obtain one.',
  })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'OldPassw0rd!' })
  @IsString()
  @MinLength(1)
  currentPassword: string;

  @ApiProperty({ example: 'NewPassw0rd!2025' })
  @IsString()
  @MinLength(8)
  newPassword: string;
}
