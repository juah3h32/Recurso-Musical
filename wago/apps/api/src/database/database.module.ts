import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { drizzle } from 'drizzle-orm/libsql';
import { createClient } from '@libsql/client';
import * as schema from '@wago/db';

export const DRIZZLE_TOKEN = 'DATABASE';

@Global()
@Module({
  providers: [
    {
      provide: DRIZZLE_TOKEN,
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const url = configService.getOrThrow<string>('TURSO_DATABASE_URL');
        const authToken = configService.get<string>('TURSO_AUTH_TOKEN');
        const client = createClient({ url, authToken });
        return drizzle(client, { schema });
      },
    },
  ],
  exports: [DRIZZLE_TOKEN],
})
export class DatabaseModule {}
