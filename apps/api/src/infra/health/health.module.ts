import { Module } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';

import { CloudinaryModule } from '../cloudinary/cloudinary.module';

import { HealthController } from './health.controller';
import { CloudinaryHealthIndicator } from './indicators/cloudinary.indicator';
import { PrismaHealthIndicator } from './indicators/prisma.indicator';

@Module({
  imports: [
    // logger: false because Terminus logs a full error dump on every failed
    // check, which at a one-minute probe interval floods the log during any
    // outage. Our indicators return a structured reason instead.
    TerminusModule.forRoot({ logger: false }),
    CloudinaryModule,
  ],
  controllers: [HealthController],
  providers: [PrismaHealthIndicator, CloudinaryHealthIndicator],
})
export class HealthModule {}
