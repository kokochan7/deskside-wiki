# Deskside KB

Internal IT knowledge base for technicians. Sign in, write and edit KB articles in Markdown, keep a list of client companies, and manage who on the team can access it.

Runs entirely on Cloudflare: a Worker serves the API and the React app, and a D1 database stores the data.

## Features

- **Knowledge base:** a compact article list with every client in a sidebar for one-click filtering. Create, edit and delete articles with a Markdown editor (toolbar, live split preview, templates, Ctrl/⌘+S to save). Categories (from a list admins manage and reorder in Settings), tags, and any number of clients per article. Technicians can select several articles to change their category or clients at once; admins can also delete them.
- **Images:** paste screenshots straight into the editor, drag them in, or use the image button. Large images are shrunk in the browser and stored in D1, and only signed-in users can see them. Click an image in an article to zoom.
- **Share links:** technicians can create a link to a single article (with its images) that works without an account, and turn it off again. **Copy** starts a new article with all the fields of an existing one.
- **Public viewing:** anyone can browse read-only without signing in; signing in unlocks editing. Admins can turn this off in Settings.
- **Search:** full-text search across titles, bodies and tags, plus a ⌘K / Ctrl+K command palette.
- **Clients:** an alphabetical list with company details, notes, a logo, and the articles that belong to each client.
- **Dashboard:** totals, new articles per week, and articles by category and by client.
- **Settings (admins):** site name, logo (also the browser tab icon) and accent colour. The name and logo also show on the sign-in page.
- **User Accounts:** people sign in with a username and password. Admins add technicians, set roles, reset passwords and disable accounts.
  - **Admin:** everything, including deleting articles and clients and managing user accounts.
  - **Technician:** create and edit articles and clients (no deleting).
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
