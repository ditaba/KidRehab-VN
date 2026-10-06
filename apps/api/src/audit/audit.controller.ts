import { Controller, Get, Query } from '@nestjs/common';
import { Role } from '@prisma/client';
import { IsOptional, IsString } from 'class-validator';
import { AuthUser } from '../common/auth-user';
import { CurrentUser, Roles } from '../common/decorators';
import { paginated, PaginationQuery } from '../common/pagination';
import { PrismaService } from '../prisma/prisma.service';

class AuditQuery extends PaginationQuery {
  @IsOptional() @IsString() entity?: string;
  @IsOptional() @IsString() entityId?: string;
}

@Controller('audit-logs')
@Roles(Role.ADMIN)
export class AuditController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async list(@CurrentUser() user: AuthUser, @Query() q: AuditQuery) {
    const where = { clinicId: user.clinicId, entity: q.entity, entityId: q.entityId };
    const [data, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (q.page - 1) * q.pageSize,
        take: q.pageSize,
      }),
      this.prisma.auditLog.count({ where }),
    ]);
    return paginated(data, total, q.page, q.pageSize);
  }
}
