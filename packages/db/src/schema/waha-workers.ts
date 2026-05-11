import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import { randomUUID } from "crypto";

export const wahaWorkers = sqliteTable("waha_workers", {
  id: text("id").primaryKey().$defaultFn(() => randomUUID()),
  podName: text("pod_name").unique(),
  internalIp: text("internal_ip"),
  apiKeyEnc: text("api_key_enc").notNull(),
  ingressSecret: text("ingress_secret").$defaultFn(() => randomUUID()),
  status: text("status", {
    enum: ["provisioning", "active", "draining", "stopped"],
  })
    .notNull()
    .default("provisioning"),
  maxSessions: integer("max_sessions").notNull().default(50),
  currentSessions: integer("current_sessions").notNull().default(0),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
});
