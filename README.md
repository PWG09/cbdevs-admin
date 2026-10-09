# CBDEVS Admin

Internal CBDEVS operations dashboard. The application runtime uses the central Supabase project; Firebase is not used by this branch.

## Central Supabase

- Project reference: `rpfupihdsqxprhptxypv`
- Public browser variables: `NEXT_PUBLIC_CBDEVS_SUPABASE_URL`, `NEXT_PUBLIC_CBDEVS_SUPABASE_ANON_KEY`
- Server-only variables, only where needed: `CBDEVS_CENTRAL_SUPABASE_URL`, `CBDEVS_CENTRAL_SUPABASE_SERVICE_ROLE_KEY`
- Authentication: Supabase Auth.
- Data: shared `public` tables with `cbdevs_` prefixes plus the central organization/membership tables.
- Authorization must require active organization membership and an enabled `admin` app. Authentication alone does not grant access.

## Setup

1. Add the public Supabase URL and publishable/legacy anon key to the Admin Vercel project.
2. Add the server-only URL and secret key only for server routes that need privileged Auth Admin operations. Never expose the secret key to browser code.
3. Configure Supabase Auth site URL, redirect URLs, and reliable email/SMTP delivery.
4. Bootstrap the first owner and organization through a controlled server-side process; do not trust client-supplied roles or organization IDs.
5. Install dependencies and run `npm run build`.
6. Test login, owner bootstrap, project CRUD, organization isolation, chat/realtime, team invites/status changes, and quote generation before production cutover.

## Clean start

This branch does not import Firebase users, projects, clients, messages, or files. The central Supabase application tables are intended to start empty. Old Firebase configuration files, rules, admin SDK helpers, and Firebase seed scripts are not part of the runtime.

Do not delete the old Firebase project itself; keep it untouched as a rollback reference until the Supabase version is tested and deployed. No Vercel environment changes are implied by this repository change.

DetailFlow, QuoteSnap, and QuoteAI are separate and excluded from the central CBDEVS database.


## One-time first-owner bootstrap

The central database starts empty. Create the first user directly in Supabase Auth, confirm that email, then set the server-only Vercel variable `CBDEVS_INITIAL_OWNER_EMAIL` to that exact email (lowercase). Sign in to Admin and send the authenticated access token to `POST /api/bootstrap` to initialize the single `CBDEVS` organization, owner membership, profile, and enabled apps. The endpoint refuses unconfirmed users, any email other than the configured initial owner, and any existing unrelated organization. It never accepts a client-supplied role or organization ID. Do not set this variable to a public/shared mailbox; remove it after successful bootstrap.
