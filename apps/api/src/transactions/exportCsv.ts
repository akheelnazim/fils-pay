import type { Pool } from "pg";
import { formatBhd, toFils } from "@filspay/money";
import type { TransactionRow } from "./serialize.js";

export interface TransactionsExportFilters {
  merchantId: string;
  from?: Date;
  to?: Date;
  status?: string[];
}

function csvEscape(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function toCsvRow(row: TransactionRow): string {
  return [
    row.id,
    row.status,
    formatBhd(toFils(Number(row.amount_fils))),
    formatBhd(toFils(Number(row.captured_fils))),
    csvEscape(row.reference ?? ""),
    row.occurred_at.toISOString(),
  ].join(",");
}

/** Builds the CSV body for `GET /v1/transactions/export`. */
export async function buildTransactionsExportCsv(
  pool: Pool,
  filters: TransactionsExportFilters,
): Promise<string> {
  const statusArray = filters.status && filters.status.length > 0 ? filters.status : null;
  const result = await pool.query<TransactionRow>(
    `SELECT * FROM transactions
      WHERE merchant_id = $1
        AND ($2::timestamptz IS NULL OR occurred_at >= $2)
        AND ($3::timestamptz IS NULL OR occurred_at <  $3)
        AND ($4::text[] IS NULL OR status = ANY($4))
      ORDER BY occurred_at ASC`,
    [filters.merchantId, filters.from ?? null, filters.to ?? null, statusArray],
  );

  const header = "id,status,amount_bhd,captured_bhd,reference,occurred_at";
  const lines = result.rows.map(toCsvRow);
  return [header, ...lines].join("\n");
}


/**
 * Streaming export for `GET /v1/transactions/export` (X3): yields the same body
 * as buildTransactionsExportCsv one page at a time, so memory stays at one page.
 * Pages by (occurred_at, id) with the timestamp kept as exact text: rows sharing
 * an instant are neither skipped nor repeated at a page boundary.
 */
export async function* streamTransactionsExportCsv(
  pool: Pool,
  filters: TransactionsExportFilters,
): AsyncGenerator<string> {
  yield "id,status,amount_bhd,captured_bhd,reference,occurred_at";

  const statusArray = filters.status && filters.status.length > 0 ? filters.status : null;
  const PAGE_SIZE = 1000;
  let cursor: { at: string; id: string } | null = null;

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const result: { rows: (TransactionRow & { cursor_at: string })[] } = await pool.query<
      TransactionRow & { cursor_at: string }
    >(
      `SELECT *, occurred_at::text AS cursor_at FROM transactions
        WHERE merchant_id = $1
          AND ($2::timestamptz IS NULL OR occurred_at >= $2)
          AND ($3::timestamptz IS NULL OR occurred_at <  $3)
          AND ($4::text[] IS NULL OR status = ANY($4))
          AND ($5::timestamptz IS NULL OR (occurred_at, id) > ($5::timestamptz, $6::uuid))
        ORDER BY occurred_at ASC, id ASC
        LIMIT $7`,
      [
        filters.merchantId,
        filters.from ?? null,
        filters.to ?? null,
        statusArray,
        cursor?.at ?? null,
        cursor?.id ?? null,
        PAGE_SIZE,
      ],
    );

    if (result.rows.length > 0) {
      yield "\n" + result.rows.map(toCsvRow).join("\n");
    }

    if (result.rows.length < PAGE_SIZE) break;
    const last = result.rows[result.rows.length - 1]!;
    cursor = { at: last.cursor_at, id: last.id };
  }
}
