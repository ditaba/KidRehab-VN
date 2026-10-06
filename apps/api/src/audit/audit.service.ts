import { Injectable, Logger } from '@nestjs/common';
import { AuditAction, Prisma } from '@prisma/client';
import { AuthUser } from '../common/auth-user';
import { PrismaService } from '../prisma/prisma.service';

type Tx = Prisma.TransactionClient | PrismaService;

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Records who did what to which entity. Pass the transaction client when the
   * change happens inside a transaction so the log commits atomically with it.
   */
  async log(
    user: Pick<AuthUser, 'id' | 'clinicId' | 'fullName'>,
    action: AuditAction,
    entity: string,
    entityId: string | null,
    metadata?: Prisma.InputJsonValue,
    tx: Tx = this.prisma,
  ) {
    try {
      await tx.auditLog.create({
        data: {
          clinicId: user.clinicId,
          userId: user.id,
          userName: user.fullName,
          action,
          entity,
          entityId,
          metadata,
        },
      });
    } catch (err) {
      // Audit failures must not silently break clinical work outside a transaction, but are always logged.
      if (tx !== this.prisma) throw err;
      this.logger.error(`Failed to write audit log for ${entity}:${entityId}`, err as Error);
    }
  }
}
