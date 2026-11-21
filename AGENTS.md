<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.

## What Lovable manages

Rules outside this block are the project's own. Change the pieces below in
Lovable, not by hand. With the [Lovable MCP](https://mcp.lovable.dev)
connected, `send_message` asks Lovable to do it; otherwise ask the user to
use the editor.

- **Database.** Do not add or edit `supabase/migrations/` or `drizzle/`.
  Ask Lovable to change the schema.
- **Generated files.** Do not edit a file whose header says it is automatically
  generated.
- **AI gateway.** Keep model calls on Lovable's gateway, and keep
  `LOVABLE_API_KEY` out of browser code.
- **Connectors.** Lovable provides native connectors. `list_connectors` shows
  which are enabled; `add_connector` only returns the dashboard link. When a
  connector is enabled, calls go through the connector gateway and need
  `LOVABLE_API_KEY`. When Lovable does not provide one, users can bring their
  own key and store it in Secrets.
- **Secrets.** Lovable manages them. Do not put secret values in the repo.
<!-- LOVABLE:END -->

## CarePulse data boundary

- Keep prototype workflows on sample data until the existing clinic database's RLS and membership access are verified; do not create or replace database tables because CarePulse already has an external schema.

## Route and access boundary

- Keep staff sign-in public at `/` and the sample clinic workspace under the authenticated `/dashboard` route so the workspace is not exposed to signed-out visitors.

## Staff data access

- Keep staff reads and permitted writes in the browser Supabase client with RLS, resolve clinic membership before loading records, and filter every clinic dataset by verified membership IDs; never use the service-role client for ordinary staff data.

## QR pass check-in

- Verify scanned appointment passes and perform QR check-ins only in `requireSupabaseAuth` server functions that use the caller's RLS client and the existing `verify_appointment_pass` database function; never return the pass token to the browser, and keep the confirmed-to-checked_in update conditional so a pass checks in once.
