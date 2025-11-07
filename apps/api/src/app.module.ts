import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common';

import { CommonModule } from './common';
import { LinksModule } from './links/links.module';
import { AuthModule } from './auth/auth.module';
import { TenantModule } from './tenant/tenant.module';
import { RequestLoggerMiddleware } from './common/middleware';

import { AppService } from './app.service';
import { AppController } from './app.controller';

@Module({
  imports: [CommonModule, LinksModule, AuthModule, TenantModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    // Apply request logging middleware to all routes
    consumer.apply(RequestLoggerMiddleware).forRoutes('*');
  }
}
