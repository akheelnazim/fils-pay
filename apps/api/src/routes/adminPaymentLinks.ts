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
}

const MIN_REASON = 5;
const MAX_REASON = 500;

export async function adminPaymentLinkRoutes(app: FastifyInstance): Promise<void> {
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
      if (attestedOutcome !== "captured" && attestedOutcome !== "not_captured") {
        throw new BadRequestError("invalid_request", "attestedOutcome must be 'captured' or 'not_captured'");
      }
      const trimmed = typeof reason === "string" ? reason.trim() : "";
      if (trimmed.length < MIN_REASON || trimmed.length > MAX_REASON || trimmed.includes("\0")) {
        throw new BadRequestError("invalid_request", `reason is required (${MIN_REASON}-${MAX_REASON} characters)`);
      }

      const result = await recoverPaymentLinkCapture(app.db, {
        linkId: request.params.id,
        attestedOutcome: attestedOutcome as AttestedCaptureOutcome,
        reason: trimmed,
        adminUserId: adminAuth.adminUserId,
      });
      reply.code(result.statusCode).send(result.body);
    },
  );
}
