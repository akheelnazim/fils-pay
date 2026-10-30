# Merchant UI comment leads

Comments extracted from the Vite-served merchant UI HTML shared during the audit on 2026-10-30. They are retained as investigation clues; comments are not proof of a bug. The source implementation was checked where possible.

The browser page supplied alongside the HTML also showed React Router's default `Unexpected Application Error! 404 Not Found` screen at the site root. This is tracked as **X11**: `apps/web/src/router.tsx` has no `/` or catch-all route, so `/` displays the framework error instead of a useful merchant entry point.

The source comment in `apps/api/src/routes/analytics.ts` says invalid dates such as `2026-02-30` are rejected, but `Date.parse` normalizes that value to March 2. This is a confirmed API validation lead, tracked as **X12** in FIXLOG; PostgreSQL rejects the original impossible date when the query uses it.

| Source | Comment | Assessment |
| --- | --- | --- |
| `apps/web/index.html` | `am: title says Checkout but this is the whole dashboard too` | **Confirmed UI bug; tracked as X10 in FIXLOG.** The shared document title is `FilsPay Checkout` on dashboard and checkout routes alike. |
| `apps/web/src/dashboard.css` | `am: dont add bare element selectors here, they leak into checkout (see top)` | **Preventive design note, not a current bug.** The stylesheet currently uses `dash-*` selectors and avoids bare global element rules, so checkout styles remain isolated. Keep this constraint when editing the stylesheet. |
| `apps/web/src/dashboard.css` | `FH: table re-layout on every poll = the overview memory leak?` | **Unverified lead; no bug confirmed.** Overview polling replaces bounded response state every 60 seconds, and the interval is cleaned up on dependency change/unmount. The comment alone does not show a leak. Retain for future profiling context. |
| `apps/web/src/pages/checkout/CheckoutPage.css` | `YA: cosmetic only, never sent to the server` | **Implementation note, not a bug.** The card-brand hint is presentational; checkout submission sends the payment details through the API and does not treat that hint as authoritative. |

Other comments visible in the HTML (`@vite/client` and React refresh injection) are development-server scripts, not application findings.
