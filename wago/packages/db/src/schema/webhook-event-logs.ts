import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import { randomUUID } from "crypto";
import { webhookConfigs } from "./webhook-configs.js";

export const webhookEventLogs = sqliteTable("webhook_event_logs", {
  id: text("id").primaryKey().$defaultFn(() => randomUUID()),
  webhookConfigId: text("webhook_config_id")
    .notNull()
    .references(() => webhookConfigs.id, { onDelete: "cascade" }),
  eventType: text("event_type").notNull(),
  // Stored as JSON
  payload: text("payload", { mode: "json" }).notNull(),
  status: text("status", { enum: ["pending", "delivered", "failed"] })
    .notNull()
    .default("pending"),
  attempts: integer("attempts").notNull().default(0),
  deliveredAt: integer("delivered_at", { mode: "timestamp_ms" }),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
});
