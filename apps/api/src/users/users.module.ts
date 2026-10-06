import { Module } from '@nestjs/common';
import { ClinicController, UsersController } from './users.controller';

@Module({ controllers: [UsersController, ClinicController] })
export class UsersModule {}
