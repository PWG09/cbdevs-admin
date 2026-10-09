# CBDEVS Admin

Internal operations dashboard for CBDEVS. This branch migrates runtime authentication and app data from Firebase to the central Supabase project shared by CBDEVS Admin, Web, Courses, and Client Portal.

## Central Supabase

- Project reference: `rpfupihdsqxprhptxypv`
- Browser-safe variables: `NEXT_PUBLIC_CBDEVS_SUPABASE_URL`, `NEXT_PUBLIC_CBDEVS_SUPABASE_ANON_KEY`
- Server-only variables: `CBDEVS_CENTRAL_SUPABASE_URL`, `CBDEVS_CENTRAL_SUPABASE_SERVICE_ROLE_KEY`
- Operational tables use the `cbdevs_` prefix and are protected by organization-scoped RLS.
- Auth is Supabase Auth. Access requires active membership and the enabled `admin` app; being authenticated alone grants no Admin access.

## Main features

- Project pipeline and dashboard from `cbdevs_projects`
- Internal chat from `cbdevs_messages`
- Team membership and invitation management using Supabase Auth Admin APIs on the server
- AI quote endpoint authenticated with a Supabase access token

## Setup

1. Configure the two public browser variables for the central project in Vercel.
2. Configure the two server-only central variables. Never use a `NEXT_PUBLIC_` prefix for the service-role key.
3. Set NVIDIA server-side variables if the AI quote tool is enabled.
4. In Supabase Auth, set production/local redirect URLs, email templates, and SMTP. Invitation delivery must be tested.
5. Ensure the intended staff accounts exist in Supabase Auth, have profiles, and are members of an organization with the `admin` app enabled.
6. Run `npm install`, `npm run build`, then test login, team invitations, project CRUD, chat, and quote generation.

## Migration safety

The central schema is deployed, but the existing Firebase users and records have **not** been imported. Firebase Admin dependencies/scripts are retained only to support controlled legacy exports during the migration. Do not remove the old Firebase project or redirect production users until account mapping, data counts, access-control tests, and rollback are verified.

DetailFlow, QuoteSnap, and QuoteAI are explicitly excluded from the central database.
