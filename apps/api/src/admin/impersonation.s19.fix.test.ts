import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, test } from "node:test";
import { Pool } from "pg";
import { lookupImpersonationGrant, startImpersonation } from "./impersonation.js";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
after(async () => { await pool.end(); });

test("S19: disabled admins cannot use impersonation grants", async () => {
  const admin = await pool.query<{ id: string }>(
    "INSERT INTO admin_users (email, password_hash, display_name, role) VALUES ($1, 'unused', 'S19', 'support') RETURNING id",
    [`s19-${randomUUID()}@example.com`],
  );
  const merchant = await pool.query<{ id: string }>(
    "INSERT INTO merchants (display_name, mdr_bps) VALUES ($1, 250) RETURNING id", [`S19 ${randomUUID()}`],
  );
  const adminUserId = admin.rows[0]!.id;
  const grant = await startImpersonation(pool, { adminUserId, merchantId: merchant.rows[0]!.id, ttlMinutes: 15 });
  assert.equal((await lookupImpersonationGrant(pool, grant.rawToken))?.grantId, grant.grantId);
  await pool.query("UPDATE admin_users SET status = 'disabled' WHERE id = $1", [adminUserId]);
  assert.equal(await lookupImpersonationGrant(pool, grant.rawToken), null);
  await pool.query("UPDATE admin_users SET status = 'active' WHERE id = $1", [adminUserId]);
  assert.equal((await lookupImpersonationGrant(pool, grant.rawToken))?.grantId, grant.grantId);
  await pool.query("UPDATE admin_impersonation_grants SET revoked_at = now() WHERE id = $1", [grant.grantId]);
  assert.equal(await lookupImpersonationGrant(pool, grant.rawToken), null);
});
