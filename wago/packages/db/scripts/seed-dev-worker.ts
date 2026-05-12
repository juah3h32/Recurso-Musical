/**
 * Registers a local WAHA Docker instance as a worker in the DB.
 * Run this once before testing QR codes in local dev.
 *
 * Usage:
 *   TURSO_DATABASE_URL=... TURSO_AUTH_TOKEN=... tsx scripts/seed-dev-worker.ts
 *   or: pnpm --filter @wago/db dev:worker
 *
 * Prerequisites:
 *   docker run -it --rm -p 3000:3000 -e WHATSAPP_API_KEY=devkey devlikeapro/waha
 */
import { drizzle } from 'drizzle-orm/libsql';
import { createClient } from '@libsql/client';
import { eq } from 'drizzle-orm';
import { wahaWorkers } from '../src/schema/waha-workers.js';
import { randomUUID } from 'crypto';

async function seedDevWorker() {
  const url = process.env.TURSO_DATABASE_URL;
  if (!url) {
    console.error('TURSO_DATABASE_URL is required');
    process.exit(1);
  }

  const client = createClient({ url, authToken: process.env.TURSO_AUTH_TOKEN });
  const db = drizzle(client);

  const DEV_POD = 'local-docker-waha';
  const DEV_IP  = '127.0.0.1';
  const DEV_KEY = process.env.WAHA_API_KEY ?? 'devkey';

  // Remove stale dev worker if exists
  await db.delete(wahaWorkers).where(eq(wahaWorkers.podName, DEV_POD));

  await db.insert(wahaWorkers).values({
    id: randomUUID(),
    podName: DEV_POD,
    internalIp: DEV_IP,
    apiKeyEnc: DEV_KEY,
    status: 'active',
    maxSessions: 1,
    currentSessions: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  console.log(`Worker registrado: ${DEV_POD} → http://${DEV_IP}:3000 (key: ${DEV_KEY})`);
  client.close();
}

seedDevWorker().catch((err) => {
  console.error(err);
  process.exit(1);
});
