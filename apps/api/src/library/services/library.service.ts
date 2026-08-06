import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@workspace/database';
import { DatabaseService } from '../../common/database/database.service';
import { TenantDbService } from '../../common/database/tenant-db.service';
import { resolvePaginationOrderBy, type SortAllowList } from '../../common/dto';
import {
  CheckoutBookDto,
  CreateBookDto,
  ListBooksDto,
  UpdateBookDto,
} from '../dto/library.dto';

/** Allow-listed sort columns for the catalog list; default is title A–Z. */
const BOOK_LIST_SORT: SortAllowList<Prisma.LibraryBookOrderByWithRelationInput> =
  {
    title: (dir) => [{ title: dir }],
    author: (dir) => [{ author: dir }, { title: 'asc' }],
    category: (dir) => [{ category: dir }, { title: 'asc' }],
    status: (dir) => [{ status: dir }, { title: 'asc' }],
    dueDate: (dir) => [{ dueDate: dir }, { title: 'asc' }],
  };

const STUDENT_SELECT = {
  id: true,
  studentNumber: true,
  userTenant: {
    select: { user: { select: { firstName: true, lastName: true } } },
  },
} as const;

@Injectable()
export class LibraryService {
  constructor(
    private readonly db: DatabaseService,
    private readonly tenantDb: TenantDbService,
  ) {}

  private get client() {
    return this.tenantDb.isScoped ? this.tenantDb.client : this.db.client;
  }

  async listBooks(tenantId: string, query: ListBooksDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 25;
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = { tenantId };
    if (query.status) where['status'] = query.status;
    if (query.category) where['category'] = query.category;
    if (query.search) {
      where['OR'] = [
        { title: { contains: query.search, mode: 'insensitive' } },
        { author: { contains: query.search, mode: 'insensitive' } },
        { isbn: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    const [data, total] = await Promise.all([
      this.client.libraryBook.findMany({
        where,
        include: { student: { select: STUDENT_SELECT } },
        orderBy: resolvePaginationOrderBy(
          query.sortBy,
          query.sortOrder,
          BOOK_LIST_SORT,
          [{ title: 'asc' }],
        ),
        skip,
        take: limit,
      }),
      this.client.libraryBook.count({ where }),
    ]);

    return {
      data,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasNext: page * limit < total,
        hasPrev: page > 1,
      },
    };
  }

  async catalogSummary(tenantId: string) {
    const books = await this.client.libraryBook.findMany({
      where: { tenantId },
      select: { status: true, category: true },
    });

    const statusCounts: Record<string, number> = {};
    const categoryCounts: Record<string, number> = {};
    for (const b of books) {
      statusCounts[b.status] = (statusCounts[b.status] ?? 0) + 1;
      const category = b.category ?? 'Uncategorized';
      categoryCounts[category] = (categoryCounts[category] ?? 0) + 1;
    }

    return { totalBooks: books.length, statusCounts, categoryCounts };
  }

  /**
   * Loans view: books currently on loan, with borrower + due date and an
   * overdue flag. Derived from LibraryBook (status 'on_loan') — there is no
   * separate loan table; a checkout stamps the book row.
   */
  async loans(tenantId: string) {
    const books = await this.client.libraryBook.findMany({
      where: { tenantId, status: 'on_loan' },
      include: { student: { select: STUDENT_SELECT } },
      orderBy: [{ dueDate: 'asc' }],
    });

    const now = Date.now();
    return books.map((b) => ({
      id: b.id,
      title: b.title,
      author: b.author,
      category: b.category ?? null,
      copyLabel: b.copyLabel ?? null,
      dueDate: b.dueDate ? b.dueDate.toISOString() : null,
      overdue: b.dueDate ? b.dueDate.getTime() < now : false,
      borrower: b.student
        ? {
            name: `${b.student.userTenant.user.firstName} ${b.student.userTenant.user.lastName}`,
            studentNumber: b.student.studentNumber,
          }
        : null,
    }));
  }

  async createBook(tenantId: string, dto: CreateBookDto, userId: string) {
    return this.client.libraryBook.create({
      data: {
        tenantId,
        title: dto.title,
        author: dto.author,
        isbn: dto.isbn ?? null,
        category: dto.category ?? null,
        copyLabel: dto.copyLabel ?? null,
        status: 'available',
        createdBy: userId,
        updatedBy: userId,
      },
    });
  }

  async updateBook(
    tenantId: string,
    id: string,
    dto: UpdateBookDto,
    userId: string,
  ) {
    const book = await this.client.libraryBook.findFirst({
      where: { id, tenantId },
    });
    if (!book) throw new NotFoundException('Book not found');

    return this.client.libraryBook.update({
      where: { id },
      data: {
        ...(dto.title !== undefined && { title: dto.title }),
        ...(dto.author !== undefined && { author: dto.author }),
        ...(dto.isbn !== undefined && { isbn: dto.isbn }),
        ...(dto.category !== undefined && { category: dto.category }),
        ...(dto.copyLabel !== undefined && { copyLabel: dto.copyLabel }),
        updatedBy: userId,
      },
    });
  }

  async checkoutBook(
    tenantId: string,
    id: string,
    dto: CheckoutBookDto,
    userId: string,
  ) {
    const book = await this.client.libraryBook.findFirst({
      where: { id, tenantId },
    });
    if (!book) throw new NotFoundException('Book not found');
    if (book.status === 'on_loan') {
      throw new BadRequestException('Book is already on loan');
    }

    const student = await this.client.student.findFirst({
      where: { id: dto.studentId, tenantId },
    });
    if (!student) throw new NotFoundException('Student not found');

    return this.client.libraryBook.update({
      where: { id },
      data: {
        status: 'on_loan',
        borrowerStudentId: dto.studentId,
        dueDate: dto.dueDate ? new Date(dto.dueDate) : null,
        updatedBy: userId,
      },
    });
  }

  async returnBook(tenantId: string, id: string, userId: string) {
    const book = await this.client.libraryBook.findFirst({
      where: { id, tenantId },
    });
    if (!book) throw new NotFoundException('Book not found');

    return this.client.libraryBook.update({
      where: { id },
      data: {
        status: 'available',
        borrowerStudentId: null,
        dueDate: null,
        updatedBy: userId,
      },
    });
  }
}
