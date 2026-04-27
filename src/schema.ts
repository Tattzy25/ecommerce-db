import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  shopifyId: text("shopify_id").unique(),
  email: text("email").notNull().unique(),
  name: text("name"),

  creditBalance: integer("credit_balance").notNull().default(25),
  // Stored as Unix timestamp for SQLite compatibility
  lastMonthlyGrant: integer("last_monthly_grant", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),

  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
});

export const products = sqliteTable("products", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  price: real("price").notNull(), // SQLite float
  creditYield: integer("credit_yield").notNull(),
  description: text("description"),
});

export const orders = sqliteTable("orders", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id),
  totalAmount: real("total_amount").notNull(),
  status: text("status").notNull().default("PENDING"),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
});

export const creditLedger = sqliteTable("credit_ledger", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id),
  amount: integer("amount").notNull(),
  actionType: text("action_type").notNull(),
  referenceId: text("reference_id"),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
});
