import { Kysely } from "kysely";
import { D1Dialect } from "kysely-d1";
import { Database } from "./types"; // <-- Importing from your types.ts file

// --- CONFIG ---
export const PRICING = {
  IMAGE_GEN: 1,
  BATCH_IMAGE_GEN: 4,
  MODEL_TRAINING: 100,
  FACETIME_CALL: 200,
} as const;

export interface Env {
  DB: D1Database;
}

// --- WORKER ENTRY POINT ---
export default {
  async fetch(
    request: Request,
    env: Env,
    ctx: ExecutionContext,
  ): Promise<Response> {
    const url = new URL(request.url);

    // STRICT ROUTING
    if (url.pathname !== "/api/deduct" || request.method !== "POST") {
      throw new Error(
        `[405] Method Not Allowed or Invalid Route: ${request.method} ${url.pathname}`,
      );
    }

    const { userId, action, jobId } = (await request.json()) as any;
    const cost = PRICING[action as keyof typeof PRICING];

    // STRICT VALIDATION
    if (!userId) throw new Error("[400] Missing userId in payload");
    if (!cost) throw new Error(`[400] Invalid action type: ${action}`);

    // Initialize DB Connection using your imported Database type
    const db = new Kysely<Database>({
      dialect: new D1Dialect({ database: env.DB }),
    });

    // Execute Atomic Transaction
    const remainingBalance = await db.transaction().execute(async (tx) => {
      const updatedUser = await tx
        .updateTable("users")
        .set((eb) => ({
          credit_balance: eb("credit_balance", "-", cost),
        }))
        .where("id", "=", userId)
        .where("credit_balance", ">=", cost)
        .returning("credit_balance")
        .executeTakeFirst();

      if (!updatedUser) {
        throw new Error(
          `[402] Payment Required: Insufficient credits or user ${userId} not found`,
        );
      }

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

    return Response.json({ success: true, remaining: remainingBalance, cost });
  },
};
