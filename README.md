# React + TypeScript + Vite

This template provides a minimal setup to get React working in Vite with HMR and some Oxlint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the Oxlint configuration

If you are developing a production application, we recommend enabling type-aware lint rules by installing `oxlint-tsgolint` and editing `.oxlintrc.json`:

```json
{
  "$schema": "./node_modules/oxlint/configuration_schema.json",
  "plugins": ["react", "typescript", "oxc"],
  "options": {
    "typeAware": true
  },
  "rules": {
    "react/rules-of-hooks": "error",
    "react/only-export-components": ["warn", { "allowConstantExport": true }]
  }
}
```

See the [Oxlint rules documentation](https://oxc.rs/docs/guide/usage/linter/rules) for the full list of rules and categories.

## Analytics (`/admin`)

Move keeps its own anonymous counts (visits, pages, sign-ins, looks, uploads, exports) and shows them at `/admin`
behind one password. No cookies for visitors, no IP addresses stored, a visitor hash that changes daily.

- **While developing** nothing needs setting up besides `ADMIN_PASSWORD` in `.env.local` (see `.env.example`).
  The numbers go to `.analytics/dev.json`, and `/admin?demo` shows made-up numbers.
- **On Vercel** the numbers live in Firestore's free tier behind a tiny Cloud Run service (`stats/`). Deploy it,
  then set `ADMIN_PASSWORD`, `STATS_URL` and `STATS_SECRET` in Vercel and redeploy. Until then tracking is a no-op and
  `/admin` explains what is missing.

```bash
# from stats/, with the same secret you will give Vercel as STATS_SECRET
gcloud run deploy move-stats --source . --region us-central1 --allow-unauthenticated --set-env-vars STATS_SECRET=<secret>
# lets Firestore delete old records (the 13 months promised on /legal)
gcloud firestore fields ttls update expires --collection-group=move_days --enable-ttl
gcloud firestore fields ttls update expires --collection-group=visitors --enable-ttl
gcloud firestore fields ttls update expires --collection-group=move_logins --enable-ttl
```
