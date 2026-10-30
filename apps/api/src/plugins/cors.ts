import type { FastifyInstance } from "fastify";
import fp from "fastify-plugin";
import type { Config } from "../config.js";

const ALLOWED_METHODS = "GET, POST, PUT, PATCH, DELETE, OPTIONS";
const DEFAULT_ALLOWED_HEADERS = "Content-Type, Authorization, Idempotency-Key";

/**
 * D4: the dashboard (apps/web) and ops console (apps/admin) are served from
 * their own origins and call this API with `credentials: "include"`, so the
 * API must answer CORS for exactly those origins (config.corsOrigins), never
 * a wildcard, since the session cookie rides along.
 */
export const corsPlugin = fp(async (app: FastifyInstance, opts: { config: Config }): Promise<void> => {
  const allowed = new Set(opts.config.corsOrigins);

  app.addHook("onRequest", async (request, reply) => {
    const origin = request.headers.origin;
    if (!origin) return;
    // Any cross-origin answer depends on Origin, allowed or not, so caches key on it.
    reply.header("Vary", "Origin");
    if (!allowed.has(origin)) return;

    reply.header("Access-Control-Allow-Origin", origin);
    reply.header("Access-Control-Allow-Credentials", "true");

    if (request.method === "OPTIONS" && request.headers["access-control-request-method"]) {
      const requested = request.headers["access-control-request-headers"];
      reply.header("Access-Control-Allow-Methods", ALLOWED_METHODS);
      reply.header("Access-Control-Allow-Headers", requested ?? DEFAULT_ALLOWED_HEADERS);
      reply.header("Access-Control-Max-Age", "600");
      return reply.code(204).send();
    }
  });
});
