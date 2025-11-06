import { IsUUID } from 'class-validator';

export class SelectSchoolDto {
  @IsUUID()
  tenantId: string;

  @IsUUID()
  profileId: string;
}
