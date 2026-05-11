import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import { randomUUID } from "crypto";
import { users } from "./users.js";
import { wahaSessions } from "./waha-sessions.js";

export const webhookConfigs = sqliteTable("webhook_configs", {
  id: text("id").primaryKey().$defaultFn(() => randomUUID()),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  sessionId: text("session_id")
    .notNull()
    .references(() => wahaSessions.id, { onDelete: "cascade" }),
  url: text("url").notNull(),
  // Stored as JSON array, e.g. '["message","session.status"]'
  events: text("events", { mode: "json" }).$type<string[]>().notNull(),
  signingSecret: text("signing_secret").notNull(),
  active: integer("active", { mode: "boolean" }).notNull().default(true),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
});
