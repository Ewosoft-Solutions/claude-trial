import { Module } from '@nestjs/common';
import { CommonModule } from '../common';
import { AuthModule } from '../auth/auth.module';
import { FinanceController } from './controllers/finance.controller';
import { FinanceService } from './services/finance.service';

@Module({
  imports: [CommonModule, AuthModule],
  controllers: [FinanceController],
  providers: [FinanceService],
  exports: [FinanceService],
})
export class FinanceModule {}
