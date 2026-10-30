import type { Pool } from "pg";
import type { EventType } from "@filspay/events";
import { withTransaction } from "../db/withTransaction.js";
import type { ReportingConfig } from "../config.js";
import { readCursor, advanceCursor } from "./cursor.js";
import { applyEvent, type OutboxEventRow } from "./applyEvent.js";

export const REPORTING_EVENT_TYPES: readonly EventType[] = [
  "transaction.captured",
  "transaction.voided",
  "refund.succeeded",
  "settlement.batch_closed",
];

/**
 * Keys this worker's row in reporting_outbox_cursor. Two processes using the
 * same name serialize on that row, so a catch-up run beside a live worker
 * cannot apply an event twice.
 */
export const CONSUMER_NAME = "reporting";

/**
 * X6: is this error caused by the event itself (a payload that can't be
 * applied), so retrying can never succeed? Postgres data exceptions (22xxx)
 * and integrity violations (23xxx), and JS TypeError/RangeError from a bad
 * payload shape, yes. Anything else (lost connection, serialization failure,
 * missing table) may succeed on a retry, so the whole pass rolls back.
 */
export function isPoisonEventError(err: unknown): boolean {
  if (err instanceof TypeError || err instanceof RangeError) return true;
  const code = (err as { code?: unknown } | null)?.code;
  return typeof code === "string" && (code.startsWith("22") || code.startsWith("23"));
}

/**
 * The one function both the NOTIFY handler and the poll timer call.
 * Everything — the read of due outbox_events, every rollup
 * upsert `applyEvent` performs, and the watermark advance — happens inside
 * one `withTransaction` call: either the whole batch of up-to-
 * `consumerBatchLimit` events is applied *and* the watermark moves past all
 * of them, atomically, or (on an error that might pass on retry) nothing in
 * this pass is applied and the watermark is untouched — the next pass simply
 * re-selects the identical event range and retries. This is the exact property that makes
 * the watermark alone sufficient for exactly-once application, with no
 * separate per-event dedup table the way webhook_deliveries needs one.
 *
 * X6: an event whose own payload can't be applied is set aside in
 * reporting_dead_letter_events instead (see isPoisonEventError).
 *
 * The `SELECT` below is a plain, unlocked read — no row lock, no
 * `FOR UPDATE`, no mutation of any outbox_events column — identical
 * posture to webhooks/dispatcher.ts's Step A.
 */
export async function runConsumerPass(
  pool: Pool,
  config: Pick<ReportingConfig, "consumerBatchLimit">,
  deps: { apply?: typeof applyEvent } = {},
): Promise<{ processedCount: number }> {
  const apply = deps.apply ?? applyEvent;
  return withTransaction(pool, async (client) => {
    const cursor = await readCursor(client, CONSUMER_NAME);

    // MK 2026-06: ids come from a sequence, they're monotonic. fine for now.
    const eventsResult = await client.query<OutboxEventRow>(
      `SELECT id, event_type, aggregate_id, payload, created_at
         FROM outbox_events
        WHERE id > $1
          AND event_type = ANY($2::text[])
        ORDER BY id ASC
        LIMIT $3`,
      [cursor.lastProcessedId.toString(), REPORTING_EVENT_TYPES, config.consumerBatchLimit],
    );

    // FH: redundant with ORDER BY id ASC (last row is max). harmless
    let maxId = cursor.lastProcessedId;
    for (const row of eventsResult.rows) {
      // X6: each event in its own savepoint. An event that can never apply
      // (bad payload) is set aside in reporting_dead_letter_events and the
      // pass carries on; any other error still rolls the whole pass back.
      await client.query("SAVEPOINT apply_event");
      try {
        await apply(client, row);
        await client.query("RELEASE SAVEPOINT apply_event");
      } catch (err) {
        if (!isPoisonEventError(err)) throw err;
        await client.query("ROLLBACK TO SAVEPOINT apply_event");
        await client.query(
          `INSERT INTO reporting_dead_letter_events (consumer_name, outbox_event_id, event_type, error)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT (consumer_name, outbox_event_id) DO NOTHING`,
          [CONSUMER_NAME, row.id.toString(), row.event_type, (err as Error).message],
        );
        console.error(`reporting: set aside outbox event ${row.id} (${row.event_type}): ${(err as Error).message}`);
      }
      const rowId = BigInt(row.id);
      if (rowId > maxId) maxId = rowId;
    }

    if (eventsResult.rows.length > 0) {
      await advanceCursor(client, CONSUMER_NAME, maxId);
    }

    return { processedCount: eventsResult.rows.length };
  });
}
