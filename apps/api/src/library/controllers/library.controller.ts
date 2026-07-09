import { Body, Controller, Get, Param, Patch, Post, Query, Request, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { SwaggerTags } from '../../common/swagger-tags';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { TenantContextGuard } from '../../auth/guards/tenant-context.guard';
import { PermissionGuard, RequirePermissions } from '../../auth/guards/permission.guard';
import { TenantScoped } from '../../common/database/rls-tenant.interceptor';
import { LibraryService } from '../services/library.service';
import { CheckoutBookDto, CreateBookDto, ListBooksDto, UpdateBookDto } from '../dto/library.dto';
import type { AuthenticatedRequest } from 'src/auth';

@ApiTags(SwaggerTags.library.name)
@Controller('library')
@UseGuards(JwtAuthGuard, TenantContextGuard, PermissionGuard)
@TenantScoped()
@ApiBearerAuth('JWT-auth')
export class LibraryController {
  constructor(private readonly libraryService: LibraryService) {}

  @Get('books')
  @RequirePermissions(['library.view'])
  @ApiOperation({ summary: 'List catalog copies' })
  async listBooks(@Query() query: ListBooksDto, @Request() req: AuthenticatedRequest) {
    return this.libraryService.listBooks(req.user.tenantId, query);
  }

  @Get('books/summary')
  @RequirePermissions(['library.view'])
  @ApiOperation({ summary: 'Catalog summary (status + category counts)' })
  async catalogSummary(@Request() req: AuthenticatedRequest) {
    return this.libraryService.catalogSummary(req.user.tenantId);
  }

  @Get('loans')
  @RequirePermissions(['library.view'])
  @ApiOperation({ summary: 'Books currently on loan (borrower, due date, overdue)' })
  async loans(@Request() req: AuthenticatedRequest) {
    return this.libraryService.loans(req.user.tenantId);
  }

  @Post('books')
  @RequirePermissions(['library.books.create'])
  @ApiOperation({ summary: 'Add a book copy to the catalog' })
  async createBook(@Body() dto: CreateBookDto, @Request() req: AuthenticatedRequest) {
    return this.libraryService.createBook(req.user.tenantId, dto, req.user.profileId!);
  }

  @Patch('books/:id')
  @RequirePermissions(['library.books.edit'])
  @ApiOperation({ summary: 'Edit a catalog entry' })
  async updateBook(
    @Param('id') id: string,
    @Body() dto: UpdateBookDto,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.libraryService.updateBook(req.user.tenantId, id, dto, req.user.profileId!);
  }

  @Post('books/:id/checkout')
  @RequirePermissions(['library.circulation'])
  @ApiOperation({ summary: 'Check a book out to a student' })
  async checkoutBook(
    @Param('id') id: string,
    @Body() dto: CheckoutBookDto,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.libraryService.checkoutBook(req.user.tenantId, id, dto, req.user.profileId!);
  }

  @Post('books/:id/return')
  @RequirePermissions(['library.circulation'])
  @ApiOperation({ summary: 'Return a book to the catalog' })
  async returnBook(@Param('id') id: string, @Request() req: AuthenticatedRequest) {
    return this.libraryService.returnBook(req.user.tenantId, id, req.user.profileId!);
  }
}
