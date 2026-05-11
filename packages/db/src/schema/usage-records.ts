import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";
import { randomUUID } from "crypto";
import { wahaSessions } from "./waha-sessions.js";

export const usageRecords = sqliteTable("usage_records", {
  id: text("id").primaryKey().$defaultFn(() => randomUUID()),
  sessionId: text("session_id")
    .notNull()
    .references(() => wahaSessions.id, { onDelete: "cascade" }),
  periodStart: integer("period_start", { mode: "timestamp_ms" }).notNull(),
  periodEnd: integer("period_end", { mode: "timestamp_ms" }).notNull(),
  connectionHours: real("connection_hours").notNull(),
  reportedToStripe: integer("reported_to_stripe", { mode: "boolean" })
    .notNull()
    .default(false),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
});
