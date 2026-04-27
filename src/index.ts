import { drizzle } from 'drizzle-orm/d1';
import { eq, and, gte, sql } from 'drizzle-orm';
import { users, creditLedger } from './schema';

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
    const db = drizzle(env.DB);
    const url = new URL(request.url);

    // Endpoint: Deduct Credits
    if (url.pathname === '/api/deduct' && request.method === 'POST') {
      const { userId, action, jobId } = await request.json() as any;
      const cost = PRICING[action as keyof typeof PRICING];

      if (!cost) return Response.json({ error: "Invalid action" }, { status: 400 });

      try {
        // D1 Transactions guarantee both operations succeed or both fail
        await db.transaction(async (tx) => {
          // 1. Atomic Update: Only decrement IF balance >= cost
          const updateResult = await tx.update(users)
            .set({ 
              creditBalance: sql`${users.creditBalance} - ${cost}` 
            })
            .where(
              and(
                eq(users.id, userId),
                gte(users.creditBalance, cost) // Concurrency lock
              )
            )
            .returning({ newBalance: users.creditBalance });

          // If no rows were updated, they either don't exist or lack funds
          if (updateResult.length === 0) {
            throw new Error("Insufficient credits or user not found");
          }

          // 2. Write Ledger Entry
          await tx.insert(creditLedger).values({
            id: crypto.randomUUID(),
            userId,
            amount: -cost,
            actionType: action,
            referenceId: jobId
          });
        });

        // Fetch final balance to return to client
        const [user] = await db.select({ bal: users.creditBalance }).from(users).where(eq(users.id, userId));

        return Response.json({ success: true, remaining: user.bal });

      } catch (e: any) {
        return Response.json({ success: false, error: e.message }, { status: 400 });
      }
    }

    return new Response("Not found", { status: 404 });
  }
};