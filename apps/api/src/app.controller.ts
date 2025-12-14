import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { SwaggerTags } from './common/swagger-tags';
import { AppService } from './app.service';

@ApiTags(SwaggerTags.app.name)
@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  @ApiOperation({ summary: 'Return hello message (health check)' })
  getHello(): string {
    return this.appService.getHello();
  }
}
