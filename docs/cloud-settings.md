# Private settings setup

The Render website uses Supabase Auth and PostgreSQL for per-account presets. Cloud storage is optional for the optimizer engine; without its configuration, sign-in controls are disabled with an explicit setup message. Projection editing and local/file backups remain available. No state is written to Render's ephemeral disk.

## Configure the service

1. Select or create the Supabase project for this app.
2. Apply `supabase/migrations/202611150001_private_optimizer_presets.sql` once through the Supabase migration tools or SQL editor. It creates `optimizer_presets`, four owner-only RLS policies, and a serialized per-account 20-preset limit. It does not modify existing user records.
3. In Supabase Auth URL configuration, set the site URL to `https://dfs-pro-optimizer.onrender.com/` and allow that exact redirect URL for email confirmation and password recovery. Add localhost only for local testing.
4. Enable email/password sign-in. Keep email confirmation enabled. Configure email delivery as needed; Supabase's default email service has recipient and rate restrictions. Use the provider's email settings for production delivery.
5. The active DFS project’s **public** browser URL and publishable key are saved in `public/account-config.json`. This activates the integration through the existing GitHub → Render deployment without adding another Render connection. Optionally override both with `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY` in the Render service environment. A legacy `SUPABASE_ANON_KEY` is also supported. These are the project's browser configuration, not an admin/service-role key. **Do not use a secret or service-role key.** `/api/config` rejects those key types and never returns `SPORTSDATAIO_API_KEY` or other server variables.
6. Deploy the current commit using the existing Render workflow. `npm start` and the Node/Express deployment remain unchanged. The Supabase browser SDK v2.119.0 is served from `public/vendor/` with its MIT license; it is loaded only when cloud storage is configured. No extra production npm dependency or build step is required.
7. Confirm `/api/config` reports `enabled: true`, then use Create Account on the optimizer, confirm the email, and sign in. Do not share the app password or paste it into a development chat.

## Use on desktop and iPad

Edit projections directly in the player table. The source label distinguishes manual values, SportsDataIO and salary-file averages. Manual overrides survive a SportsDataIO refresh; Reset restores the latest base value. Loading a new slate starts with that file's averages until projections or a matching saved preset are loaded.

Enter a preset name and choose **Save to Account**. On the other device, sign in to the same optimizer account, refresh the account preset list and choose **Load from Account**. The list also refreshes when the page becomes visible. It does not automatically replace unsaved edits on either device. Saving the same name replaces that account's previous snapshot; the most recent successful save wins.

Saved snapshots contain optimizer controls, season/week, manual projections, locks, exclusions, and exposure overrides. They do not contain salaries, API credentials, login tokens or cached SportsDataIO forecasts. Player overrides require an SHA-256 fingerprint of the matching DK player IDs, salaries, positions, teams and games. If the matching CSV is not imported, only general rules load and player edits wait until that file is imported. The pending state is shown explicitly. General presets can be reused across slates without applying another slate's player edits.

Browser-only saves, settings links, and JSON files are optional backups. A link/file is a snapshot, not live sync, and anyone possessing it can read its strategy and manual edits. Account presets are protected by authentication and database row-level security; signing out removes the account list from that device. Sign-out is local to that device and does not sign out the other device.

## Verification

`npm test` covers configuration filtering, private client operations, UI authentication/save flow, source-aware manual projections, stale request protection, profile schema validation, matching-slate restoration, browser persistence, and two-browser link transfer in addition to the lineup engine tests. Account integration tests use a fake provider; do not mistake them for a live email/auth deployment test.

For the real PostgreSQL policy audit, install the optional test engine outside the app dependencies, then run:

```sh
npm install --prefix /tmp/dfs-db-tests --cache /tmp/dfs-npm-cache --no-package-lock --ignore-scripts @electric-sql/pglite@0.5.16
NODE_PATH=/tmp/dfs-db-tests/node_modules node scripts/verify-settings-rls.cjs
```

This executes the shipped migration in PostgreSQL with an auth-schema fixture and proves anonymous denial, two-account read/write isolation, rejected ownership changes, row validation and the account quota. After provisioning, also verify two real authenticated accounts and confirmation/recovery emails against the actual Supabase project before calling the private service fully tested.

Sources: [Supabase password authentication](https://supabase.com/docs/guides/auth/passwords), [row-level security](https://supabase.com/docs/guides/database/postgres/row-level-security).

## Active service

The project `dfs-pro-optimizer` (`ttoiruwgsnwkavnshjpf`) belongs to organization **DFS** (`ntiseofhfujifenjqrgh`) on the Free plan in `us-east-1`. Its API URL is `https://ttoiruwgsnwkavnshjpf.supabase.co`. The private preset migration has been applied, and live security and performance advisors returned no findings. A live transaction proved owner access, denied cross-account reads/writes and anonymous access, then rolled back all test users and rows. Email confirmation and recovery still require the operator to set the production site/redirect URL in the Supabase Auth dashboard; the current integration does not expose an Auth URL configuration mutation.
