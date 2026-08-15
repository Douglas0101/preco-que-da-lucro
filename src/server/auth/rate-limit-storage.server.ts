import { sql } from "drizzle-orm";
import type { Database } from "@/db/client.server";
import { rateLimits } from "@/db/schema";

type RateLimitValue = {
  key: string;
  count: number;
  lastRequest: number;
};

type RateLimitRule = { window: number; max: number };

/**
 * Better Auth's default Drizzle adapter exposes get/set for rate limits. That
 * fallback is not safe under concurrent inserts: two instances can both miss
 * the row and race on the unique key. Keep the storage in PostgreSQL, but make
 * consume a transactionally locked check-and-increment operation.
 */
export function createDatabaseRateLimitStorage(database: Database) {
  return {
    async get(key: string): Promise<RateLimitValue | null> {
      const result = await database.execute<{
        key: string;
        count: number | string;
        last_request: number | string;
      }>(sql`
        select key, count, last_request
        from ${rateLimits}
        where key = ${key}
        limit 1
      `);
      const row = result.rows[0];
      return row
        ? {
            key: row.key,
            count: Number(row.count),
            lastRequest: Number(row.last_request),
          }
        : null;
    },

    async set(key: string, value: RateLimitValue): Promise<void> {
      await database.execute(sql`
        insert into ${rateLimits} (key, count, last_request)
        values (${key}, ${value.count}, ${value.lastRequest})
        on conflict (key) do update
          set count = excluded.count,
              last_request = excluded.last_request
      `);
    },

    async consume(
      key: string,
      rule: RateLimitRule,
    ): Promise<{ allowed: boolean; retryAfter: number | null }> {
      const now = Date.now();
      const windowMs = rule.window * 1000;
      const cutoff = now - windowMs;

      return database.transaction(async (transaction) => {
        // Materialize the row before UPDATE so concurrent first requests
        // serialize on the same unique key instead of racing on INSERT.
        await transaction.execute(sql`
          insert into ${rateLimits} (key, count, last_request)
          values (${key}, 0, ${now})
          on conflict (key) do nothing
        `);

        const updated = await transaction.execute<{
          count: number | string;
          last_request: number | string;
        }>(sql`
          update ${rateLimits}
          set count = case
                when last_request < ${cutoff} then 1
                else count + 1
              end,
              last_request = ${now}
          where key = ${key}
            and (last_request < ${cutoff} or count < ${rule.max})
          returning count, last_request
        `);

        if (updated.rows[0]) {
          return { allowed: true, retryAfter: null };
        }

        const current = await transaction.execute<{
          last_request: number | string;
        }>(sql`
          select last_request
          from ${rateLimits}
          where key = ${key}
          limit 1
        `);
        const lastRequest = Number(current.rows[0]?.last_request ?? now);
        return {
          allowed: false,
          retryAfter: Math.max(1, Math.ceil((lastRequest + windowMs - now) / 1000)),
        };
      });
    },
  };
}
