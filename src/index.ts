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
  async fetch(
    request: Request,
    env: Env,
    ctx: ExecutionContext,
  ): Promise<Response> {
    try {
      const url = new URL(request.url);

      // 1. HEALTH CHECK (For the browser)
      if (url.pathname === "/" && request.method === "GET") {
        return Response.json({ status: "online", engine: "AI Credit Ledger" });
      }

      // 2. STRICT ROUTING
      if (url.pathname !== "/api/deduct" || request.method !== "POST") {
        return Response.json(
          { error: "Method Not Allowed or Invalid Route" },
          { status: 405 },
        );
      }

      const { userId, action, jobId } = (await request.json()) as any;
      const cost = PRICING[action as keyof typeof PRICING];

      // 3. VALIDATION
      if (!userId)
        return Response.json({ error: "Missing userId" }, { status: 400 });
      if (!cost)
        return Response.json(
          { error: `Invalid action type: ${action}` },
          { status: 400 },
        );

      // 4. DATABASE CONNECTION
      const db = new Kysely<Database>({
        dialect: new D1Dialect({ database: env.DB }),
      });

      // 5. ATOMIC DEDUCTION
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
            `Insufficient credits or user ${userId} does not exist`,
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

      return Response.json({
        success: true,
        remaining: remainingBalance,
        cost,
      });
    } catch (error: any) {
      // 6. CATCH ERRORS PREVENTING 1101 CRASHES
      return Response.json(
        { success: false, error: error.message },
        { status: 400 },
      );
    }
  },
};
