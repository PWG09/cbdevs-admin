# CBDEVS Admin

Internal CBDEVS operations dashboard. The application runtime uses the central Supabase project; Firebase is not used by this branch.

## Central Supabase

- Project reference: `rpfupihdsqxprhptxypv`
- Public browser variables: `NEXT_PUBLIC_CBDEVS_SUPABASE_URL`, `NEXT_PUBLIC_CBDEVS_SUPABASE_ANON_KEY`
- Server-only variables, only where needed: `CBDEVS_CENTRAL_SUPABASE_URL`, `CBDEVS_CENTRAL_SUPABASE_SERVICE_ROLE_KEY`
- Authentication: Supabase Auth.
- Data: shared `public` tables with `cbdevs_` prefixes plus the central organization/membership tables.
- Authorization must require active organization membership and an enabled `admin` app. Authentication alone does not grant access.

## Leads (ventas)

`/leads` shows inquiries submitted from the CBDEVS website contact form, live via Supabase Realtime. The team can:

- Contact the lead by email (prefilled), WhatsApp (`wa.me` with a prefilled message) or phone, and log calls, emails, WhatsApp messages, meetings and notes on an append-only timeline.
- Move it through the pipeline: Nuevo → Contactado → Calificado → Propuesta → Ganado / Perdido (reason required) / Spam.
- Assign a responsible member, set the next follow-up (overdue follow-ups are flagged) and an estimated value.
- Convert it into a client and, optionally, a quoted project in one step (owner/admin/manager).

The sidebar shows a live count of new leads and the dashboard summarizes the pipeline. All access is enforced by RLS in the central database (`cbdevs-database` migration `20261019201500_cbdevs_leads_crm.sql`), which must be applied before deploying this page.

## Setup

1. Add the public Supabase URL and publishable/legacy anon key to the Admin Vercel project.
2. Add the server-only URL and secret key only for server routes that need privileged Auth Admin operations. Never expose the secret key to browser code.
3. Configure Supabase Auth site URL, redirect URLs, and reliable email/SMTP delivery.
4. Bootstrap the first owner and organization through a controlled server-side process; do not trust client-supplied roles or organization IDs.
5. Install dependencies and run `npm run build`.
6. Test login, owner bootstrap, project CRUD, organization isolation, chat/realtime, team invites/status changes, and quote generation before considering the migration operationally complete.

## Clean start

This branch does not import Firebase users, projects, clients, messages, or files. The central Supabase application tables are intended to start empty. Old Firebase configuration files, rules, admin SDK helpers, and Firebase seed scripts are not part of the runtime.

Do not delete the old Firebase project itself; keep it untouched as a rollback reference until the Supabase version is tested and deployed. No Vercel environment changes are implied by this repository change.

DetailFlow, QuoteSnap, and QuoteAI are separate and excluded from the central CBDEVS database.


## One-time first-owner bootstrap

The production code now uses central Supabase. The first-owner bootstrap is still pending because the project has no Auth users or organizations yet. Create the intended owner in Supabase Auth, confirm that email, set the server-only Vercel variable `CBDEVS_INITIAL_OWNER_EMAIL` to that exact email (lowercase), visit `/setup`, sign in with that user, and initialize the organization through the restricted bootstrap endpoint. The endpoint refuses unconfirmed users, any email other than the configured initial owner, and any unrelated existing organization. It never accepts a client-supplied role or organization ID. Remove the email allowlist variable after successful bootstrap.
