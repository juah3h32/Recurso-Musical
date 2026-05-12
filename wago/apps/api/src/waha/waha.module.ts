import { Global, Module } from '@nestjs/common';
import { WahaService } from './waha.service';
import { AntiSpamService } from './anti-spam.service';

@Global()
@Module({
  providers: [WahaService, AntiSpamService],
  exports: [WahaService, AntiSpamService],
})
export class WahaModule {}
