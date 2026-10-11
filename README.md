# Deskside KB

Internal IT knowledge base for technicians. Sign in, write and edit KB articles in Markdown, keep client companies and their contacts, and manage who on the team can access it.

Runs entirely on Cloudflare: a Worker serves the API and the React app, and a D1 database stores the data.

## Features

- **Knowledge base:** create, edit and delete articles with a Markdown editor (toolbar, live split preview, templates, Ctrl/⌘+S to save). Categories, tags, and an optional client per article.
- **Search:** full-text search across titles, bodies and tags, plus a ⌘K / Ctrl+K command palette.
- **Clients:** company details, notes, contacts, and the articles that belong to each client.
- **Team:** admins add technicians, set roles, reset passwords and disable accounts.
  - **Admin:** everything, including the team.
  - **Technician:** create, edit and delete articles, clients and contacts.
  - **Viewer:** read-only.
- Light and dark mode, mobile layout.

## First run

After the first deploy, open the site. It asks you to create the first admin account. That screen only appears while there are no users, so do this right after deploying.

## Deploying

Cloudflare builds and deploys every push to `main` (Workers & Pages → deskside-wiki, connected to this repo). The deploy command is `npx wrangler deploy`, which:

1. runs `npm run build` (configured in `wrangler.jsonc`),
2. creates the `deskside-wiki` D1 database automatically on the first deploy,
3. uploads the Worker and the built app.

The app creates its own database tables on first request. Schema changes go in `worker/schema.ts` as a new entry in `MIGRATIONS`.

## Local development

```sh
npm install
npm run build && npm run dev   # http://localhost:8787 with a local database
```

For hot reload of the UI, run `npm run dev` in one terminal and `npm run dev:ui` in another, then open the Vite URL.

## Project layout

- `worker/` — API (Hono), authentication, database schema
- `src/` — React app (Tailwind CSS)
- `wrangler.jsonc` — Cloudflare config
