import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { CommonModule } from '../common';
import { SearchController } from './search.controller';
import { SearchService } from './search.service';

@Module({
  imports: [CommonModule, AuthModule],
  controllers: [SearchController],
  providers: [SearchService],
})
export class SearchModule {}
