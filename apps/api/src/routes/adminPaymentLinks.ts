import type { FastifyInstance } from "fastify";
import { requireAdminRole, requireAdminSession } from "../adminAuth/middleware.js";
import { UUID_RE } from "../admin/merchants.js";
import { BadRequestError, NotFoundError, UnauthorizedError } from "../lib/errors.js";
import { recoverPaymentLinkCapture, type AttestedCaptureOutcome } from "../paymentLinks/recover.js";

interface LinkIdParams {
  id: string;
}

interface RecoverBody {
  attestedOutcome?: unknown;
  reason?: unknown;
  transactionId?: unknown;
}

const MIN_REASON = 5;
const MAX_REASON = 500;

export async function adminPaymentLinkRoutes(app: FastifyInstance): Promise<void> {
  /**
   * R9: payment links held "processing" for longer than recovery waits (15
   * minutes), with or without a capture marker (links reserved before
   * migration 0081 have none). Read-only.
   */
  app.get(
    "/stuck",
    { preHandler: [requireAdminSession, requireAdminRole("finance", "super_admin")] },
    async (_request, reply) => {
      const result = await app.db.query<{
        id: string;
        merchant_id: string;
        amount_fils: string;
        reserved_at: Date;
        capture_transaction_id: string | null;
      }>(
        `SELECT id, merchant_id, amount_fils, reserved_at, capture_transaction_id
           FROM payment_links
          WHERE status = 'reserved' AND reserved_at < now() - interval '15 minutes'
          ORDER BY reserved_at
          LIMIT 500`,
      );
      reply.code(200).send({
        links: result.rows.map((r) => ({
          id: r.id,
          merchantId: r.merchant_id,
          amountFils: Number(r.amount_fils),
          reservedAt: r.reserved_at.toISOString(),
          captureTransactionId: r.capture_transaction_id,
          hasMarker: r.capture_transaction_id !== null,
        })),
      });
    },
  );

  /**
   * R7: resolve a payment link held "processing" after an uncertain capture.
   * The operator reports what they found at the acquirer; see
   * recoverPaymentLinkCapture for what is checked before anything changes.
   */
  app.post<{ Params: LinkIdParams; Body: RecoverBody }>(
    "/:id/recover-capture",
    { preHandler: [requireAdminSession, requireAdminRole("finance", "super_admin")] },
    async (request, reply) => {
      const adminAuth = request.adminAuth;
      if (!adminAuth) throw new UnauthorizedError("unauthenticated");
      if (!UUID_RE.test(request.params.id)) throw new NotFoundError("payment_link_not_found");

      const { attestedOutcome, reason } = request.body ?? {};
      // R8: omit attestedOutcome to have the acquirer asked instead.
      if (attestedOutcome !== undefined && attestedOutcome !== "captured" && attestedOutcome !== "not_captured") {
        throw new BadRequestError("invalid_request", "attestedOutcome must be 'captured', 'not_captured' or omitted");
      }
      const { transactionId } = request.body ?? {};
      if (transactionId !== undefined && (typeof transactionId !== "string" || !UUID_RE.test(transactionId))) {
        throw new BadRequestError("invalid_request", "transactionId must be a uuid");
      }
      const trimmed = typeof reason === "string" ? reason.trim() : "";
      if (trimmed.length < MIN_REASON || trimmed.length > MAX_REASON || trimmed.includes("\0")) {
        throw new BadRequestError("invalid_request", `reason is required (${MIN_REASON}-${MAX_REASON} characters)`);
      }

      const result = await recoverPaymentLinkCapture(
        app.db,
        {
          linkId: request.params.id,
          attestedOutcome: attestedOutcome as AttestedCaptureOutcome | undefined,
          reason: trimmed,
          adminUserId: adminAuth.adminUserId,
          ...(transactionId !== undefined ? { transactionId: transactionId as string } : {}),
        },
        app.acquirer,
      );
      reply.code(result.statusCode).send(result.body);
    },
  );
}
