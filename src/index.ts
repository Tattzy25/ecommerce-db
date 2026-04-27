import { Kysely } from "kysely";
import { D1Dialect } from "kysely-d1";
import { Database } from "./types";

export const PRICING = {
  IMAGE_GEN: 1,
  BATCH_IMAGE_GEN: 4,
  MODEL_TRAINING: 100,
  FACETIME_CALL: 200,
} as const;

export interface Env {
  DB: D1Database;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    // 1. Initialize Kysely with Cloudflare's D1 Dialect
    const db = new Kysely<Database>({
      dialect: new D1Dialect({ database: env.DB }),
    });

    const url = new URL(request.url);

    if (url.pathname === "/api/deduct" && request.method === "POST") {
      const { userId, action, jobId } = (await request.json()) as any;
      const cost = PRICING[action as keyof typeof PRICING];

      if (!cost)
        return Response.json({ error: "Invalid action" }, { status: 400 });

      try {
        // 2. Kysely Transaction
        const remainingBalance = await db.transaction().execute(async (tx) => {
          // The Atomic Update: UPDATE users SET balance = balance - cost WHERE id = ? AND balance >= cost
          const updatedUser = await tx
            .updateTable("users")
            .set((eb) => ({
              credit_balance: eb("credit_balance", "-", cost),
            }))
            .where("id", "=", userId)
            .where("credit_balance", ">=", cost) // Prevents overdrafts instantly
            .returning("credit_balance")
            .executeTakeFirst();

          if (!updatedUser) {
            throw new Error("Insufficient credits or user not found");
          }

          // Insert Ledger Record
          await tx
            .insertInto("credit_ledger")
            .values({
              id: crypto.randomUUID(),
              user_id: userId,
              amount: -cost,
              action_type: action,
              reference_id: jobId || null,
            })
            .execute();

          return updatedUser.credit_balance;
        });

        return Response.json({ success: true, remaining: remainingBalance });
      } catch (e: any) {
        return Response.json(
          { success: false, error: e.message },
          { status: 400 },
        );
      }
    }

    return new Response("Not found", { status: 404 });
  },
};
