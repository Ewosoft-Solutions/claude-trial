import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Enable CORS
  app.enableCors();

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
  const config = new DocumentBuilder()
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
    )
    .addTag('auth', 'Authentication endpoints')
    .addTag('mfa', 'Multi-factor authentication endpoints')
    .addTag('security-policy', 'Security policy management endpoints')
    .addTag('tenant', 'Tenant (school) management endpoints')
    .addTag('links', 'Links management endpoints')
    .addTag('students', 'Student management endpoints')
    .addTag('academic-structure', 'Academic structure endpoints')
    .addTag('courses', 'Course catalog endpoints')
    .addTag('classes', 'Class/section endpoints')
    .addTag('grading-systems', 'Grading system endpoints')
    .addTag('assessments', 'Assessment endpoints')
    .addTag('grades', 'Grades endpoints')
    .addTag('announcements', 'Announcements endpoints')
    .addTag('messages', 'Messaging endpoints')
    .addTag('reports', 'Reporting & analytics endpoints')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document, {
    swaggerOptions: {
      persistAuthorization: true, // Persist authorization token in Swagger UI
    },
  });

  const port = process.env.PORT || 3000;
  await app.listen(port);

  console.log(`Application is running on: http://localhost:${port}`);
  console.log(
    `Swagger documentation available at: http://localhost:${port}/api/docs`,
  );
}

void bootstrap();
