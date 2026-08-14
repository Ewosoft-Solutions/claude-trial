import { Module } from '@nestjs/common';
import { CommonModule } from '../common';
import { AuthModule } from '../auth/auth.module';
import { NavController } from './controllers/nav.controller';
import { NavCountsService } from './services/nav-counts.service';

@Module({
  imports: [CommonModule, AuthModule],
  controllers: [NavController],
  providers: [NavCountsService],
  exports: [NavCountsService],
})
export class NavModule {}
