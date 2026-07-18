import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import type { Express } from 'express';

import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters';
import { swaggerTagList } from './common/swagger-tags';
import type { EnvConfig } from './common/config/env.config';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  const configService = app.get(ConfigService);
  const env: EnvConfig = configService.getOrThrow<EnvConfig>('env', {
    infer: true,
  });
  const isProduction = env.NODE_ENV === 'production';

  // Trust the platform's edge/load-balancer (Cloudflare → Render) so the client
  // IP, protocol, and `Secure` cookie handling reflect the original request.
  const expressApp = app.getHttpAdapter().getInstance() as Express;
  expressApp.set('trust proxy', 1);

  // CORS — locked down by design. The deployed web app (Vercel) reaches the API
  // only server-side via its proxy (`lib/api-proxy.ts`), so the browser never
  // calls the API cross-origin; this allow-list is a deny-by-default backstop,
  // not an open door. Defaults to APP_WEB_URL; `*` is honoured only outside
  // production (local tooling).
  const corsOrigins = (env.CORS_ALLOWED_ORIGINS ?? env.APP_WEB_URL)
    .split(',')
    .map((origin) => origin.trim().replace(/\/+$/, ''))
    .filter(Boolean);
  const allowAnyOrigin = !isProduction && corsOrigins.includes('*');
  app.enableCors({
    origin: allowAnyOrigin ? true : corsOrigins,
    credentials: true,
    methods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });

  // Fire OnApplicationShutdown / OnModuleDestroy hooks on SIGTERM/SIGINT so the
  // DB pool (and any in-flight work) drains gracefully on redeploy.
  app.enableShutdownHooks();

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // Strip properties that don't have decorators
      forbidNonWhitelisted: true, // Throw error if non-whitelisted properties are present
      transform: true, // Automatically transform payloads to DTO instances
      transformOptions: {
        enableImplicitConversion: true, // Enable implicit type conversion
      },
    }),
  );

  // Global exception filter
  app.useGlobalFilters(new HttpExceptionFilter());

  // Swagger/OpenAPI documentation
  const builder = new DocumentBuilder()
    .setTitle('School Management API')
    .setDescription('API documentation for the School With Ease')
    .setVersion('1.0')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        name: 'JWT',
        description: 'Enter JWT token',
        in: 'header',
      },
      'JWT-auth', // This name here is important for matching up with @ApiBearerAuth() in your controller!
    );

  swaggerTagList.forEach((tag) => builder.addTag(tag.name, tag.description));

  const config = builder.build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document, {
    swaggerOptions: {
      persistAuthorization: true, // Persist authorization token in Swagger UI
    },
  });

  // Bind to 0.0.0.0 so the container's published port is reachable (localhost
  // -only binding is not routable from outside the container).
  const port = env.PORT;
  await app.listen(port, '0.0.0.0');

  console.log(`Application is running on port ${port}`);
  console.log(`Swagger documentation available at /api/docs`);
}

void bootstrap();
