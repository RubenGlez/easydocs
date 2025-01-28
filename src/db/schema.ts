import { OperationSchema } from "@/lib/ai/swagger-schema";
import { pgTable, uuid, text, jsonb, timestamp } from "drizzle-orm/pg-core";
import { z } from "zod";

export const endpoints = pgTable("endpoints", {
  id: uuid("id").primaryKey().defaultRandom(),
  path: text("path").notNull(),
  method: text("method").notNull(),
  spec: jsonb("spec").$type<z.infer<typeof OperationSchema>>(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export type Endpoint = typeof endpoints.$inferInsert;
