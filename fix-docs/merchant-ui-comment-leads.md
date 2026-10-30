# Merchant UI comment leads

Comments extracted from the Vite-served merchant UI HTML shared during the audit on 2026-10-30. They are retained as investigation clues; comments are not proof of a bug. The source implementation was checked where possible.

| Source | Comment | Assessment |
| --- | --- | --- |
| `apps/web/index.html` | `am: title says Checkout but this is the whole dashboard too` | **Confirmed UI bug; tracked as X10 in FIXLOG.** The shared document title is `FilsPay Checkout` on dashboard and checkout routes alike. |
| `apps/web/src/dashboard.css` | `am: dont add bare element selectors here, they leak into checkout (see top)` | **Preventive design note, not a current bug.** The stylesheet currently uses `dash-*` selectors and avoids bare global element rules, so checkout styles remain isolated. Keep this constraint when editing the stylesheet. |
| `apps/web/src/dashboard.css` | `FH: table re-layout on every poll = the overview memory leak?` | **Unverified lead; no bug confirmed.** Overview polling replaces bounded response state every 60 seconds, and the interval is cleaned up on dependency change/unmount. The comment alone does not show a leak. Retain for future profiling context. |
| `apps/web/src/pages/checkout/CheckoutPage.css` | `YA: cosmetic only, never sent to the server` | **Implementation note, not a bug.** The card-brand hint is presentational; checkout submission sends the payment details through the API and does not treat that hint as authoritative. |

Other comments visible in the HTML (`@vite/client` and React refresh injection) are development-server scripts, not application findings.
