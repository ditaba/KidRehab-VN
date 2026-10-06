import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { AppointmentsModule } from './appointments/appointments.module';
import { AssessmentsModule } from './assessments/assessments.module';
import { AuditModule } from './audit/audit.module';
import { AuthModule } from './auth/auth.module';
import { JwtAuthGuard } from './common/jwt-auth.guard';
import { RolesGuard } from './common/roles.guard';
import { DashboardModule } from './dashboard/dashboard.module';
import { ExercisesModule } from './exercises/exercises.module';
import { HealthController } from './health.controller';
import { PatientsModule } from './patients/patients.module';
import { PrismaModule } from './prisma/prisma.module';
import { ProgressModule } from './progress/progress.module';
import { SessionsModule } from './sessions/sessions.module';
import { TreatmentModule } from './treatment/treatment.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    PrismaModule,
    JwtModule.registerAsync({
      global: true,
      useFactory: () => {
        const secret = process.env.JWT_ACCESS_SECRET;
        if (!secret) throw new Error('JWT_ACCESS_SECRET is not set');
        return { secret, signOptions: { expiresIn: (process.env.JWT_ACCESS_TTL ?? '15m') as never } };
      },
    }),
    AuditModule,
    AuthModule,
    UsersModule,
    DashboardModule,
    PatientsModule,
    AssessmentsModule,
    TreatmentModule,
    SessionsModule,
    ProgressModule,
    ExercisesModule,
    AppointmentsModule,
  ],
  controllers: [HealthController],
  providers: [
    // Order matters: authenticate first, then authorise by role.
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}
