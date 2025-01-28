import { pgTable, uuid, text, timestamp, jsonb } from "drizzle-orm/pg-core";

export const specifications = pgTable("specifications", {
  id: uuid("id").primaryKey().defaultRandom(),
  endpoint: text("endpoint").notNull(),
  method: text("method", {
    enum: ["GET", "POST", "PUT", "PATCH", "DELETE"],
  }).notNull(),
  document: jsonb("document").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at"),
});

export type Specification = typeof specifications.$inferInsert;
