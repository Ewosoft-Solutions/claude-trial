import { Module } from '@nestjs/common';
import { CommonModule } from '../common';
import { AuthModule } from '../auth/auth.module';
import { TransportController } from './controllers/transport.controller';
import { TransportService } from './services/transport.service';

@Module({
  imports: [CommonModule, AuthModule],
  controllers: [TransportController],
  providers: [TransportService],
  exports: [TransportService],
})
export class TransportModule {}
