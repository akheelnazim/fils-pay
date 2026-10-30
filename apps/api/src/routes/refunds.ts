import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { toFils } from "@filspay/money";
import {
  requireMerchantAuth,
  requireMerchantRole,
  requireMerchantWriterActor,
} from "../auth/requireMerchantAuth.js";
import { assertRefundRequestScope, initiateMerchantRefund } from "../refunds/initiateMerchantRefund.js";
import { BadRequestError } from "../lib/errors.js";

/**
 * Refunds (FP-300 / F6). Two addresses, one handler:
 * - `POST /v1/refunds`: the documented API address for API-key integrations.
 * - `POST /v1/merchants/:merchantId/refunds`: the dashboard's RefundDrawer.
 * The merchant always comes from the login, never from the body, so neither
 * address can refund another merchant's payment (F2).
 */

interface RefundBody {
  transactionId?: unknown;
  amountFils?: unknown;
  reason?: unknown;
}

const MAX_IDEMPOTENCY_KEY_LENGTH = 255;
const MAX_REASON_LENGTH = 500;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Same rule as routes/transactions.ts: header required, no server-generated fallback. */
function getIdempotencyKey(request: FastifyRequest): string {
  const header = request.headers["idempotency-key"];
  const key = Array.isArray(header) ? header[0] : header;
  if (!key) {
    throw new BadRequestError("idempotency_key_required", "Idempotency-Key header is required");
  }
  // A very long key overflows the idempotency_keys index (a 500).
  if (key.length > MAX_IDEMPOTENCY_KEY_LENGTH) {
    throw new BadRequestError("invalid_request", `Idempotency-Key must be at most ${MAX_IDEMPOTENCY_KEY_LENGTH} characters`);
  }
  return key;
}

async function handleRefund(
  app: FastifyInstance,
  request: FastifyRequest<{ Body: RefundBody }>,
  reply: FastifyReply,
): Promise<void> {
  const auth = request.merchantAuth!;
  const idempotencyKey = getIdempotencyKey(request);
  const { transactionId, amountFils, reason } = request.body ?? {};

  if (typeof transactionId !== "string" || !UUID_RE.test(transactionId)) {
    throw new BadRequestError("invalid_request", "transactionId must be a transaction id");
  }
  if (amountFils !== undefined && !(typeof amountFils === "number" && Number.isSafeInteger(amountFils) && amountFils > 0)) {
    throw new BadRequestError("invalid_request", "amountFils must be a positive whole number of fils");
  }
  // Postgres text can't hold a NUL character (a 500), and the reason is a note, not a document.
  if (reason !== undefined && (typeof reason !== "string" || reason.includes("\u0000") || reason.length > MAX_REASON_LENGTH)) {
    throw new BadRequestError("invalid_request", `reason must be text of at most ${MAX_REASON_LENGTH} characters`);
  }

  const result = await initiateMerchantRefund(app.db, app.acquirer, {
    merchantId: auth.merchantId,
    transactionId,
    amountFils: amountFils === undefined ? undefined : toFils(amountFils),
    idempotencyKey,
    actor: requireMerchantWriterActor(auth),
    reason,
  });
  reply.code(result.statusCode).send(result.body);
}

const preHandler = [requireMerchantAuth, requireMerchantRole("owner", "finance")];

/** Registered with prefix '/v1/refunds'. */
export async function refundRoutes(app: FastifyInstance): Promise<void> {
  app.post<{ Body: RefundBody }>("/", { preHandler }, (request, reply) => handleRefund(app, request, reply));
}

/** Registered with prefix '/v1/merchants'. */
export async function merchantRefundRoutes(app: FastifyInstance): Promise<void> {
  app.post<{ Params: { merchantId: string }; Body: RefundBody }>(
    "/:merchantId/refunds",
    { preHandler },
    async (request, reply) => {
      assertRefundRequestScope(request.merchantAuth!, request.params.merchantId);
      await handleRefund(app, request, reply);
    },
  );
}
