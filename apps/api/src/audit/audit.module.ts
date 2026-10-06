import { Global, Module } from '@nestjs/common';
import { AccessService } from '../common/access.service';
import { AuditController } from './audit.controller';
import { AuditService } from './audit.service';

@Global()
@Module({
  controllers: [AuditController],
  providers: [AuditService, AccessService],
  exports: [AuditService, AccessService],
})
export class AuditModule {}
