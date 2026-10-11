# Deskside KB

Internal IT knowledge base for technicians. Sign in, write and edit KBs in a rich text editor, keep a list of client companies, and manage who on the team can access it.

Runs entirely on Cloudflare: a Worker serves the API and the React app, and a D1 database stores the data.

## Features

- **Knowledge base:** a compact KB list with every client in a sidebar for one-click filtering. Create, edit and delete KBs with a rich text editor (headings, lists, checklists, tables, links, code, images; Ctrl/⌘+S to save). Content is stored as Markdown behind the scenes (Tiptap with its Markdown extension), so search and share links work on it directly. Categories (from a list admins manage and reorder in Settings) and any number of clients per KB. Technicians can select several KBs and use **Change category** or **Change clients** (add, remove or replace) on all of them at once; admins can also delete them.
- **Images:** paste screenshots straight into the editor, drag them in, or use the image button. Large images are shrunk in the browser and stored in D1, and only signed-in users can see them. Click an image in a KB to zoom.
- **Share links:** technicians can create a link to a single KB (with its images) that works without an account, and turn it off again. **Copy** starts a new KB with all the fields of an existing one.
- **Public viewing:** anyone can browse read-only without signing in; signing in unlocks editing. Admins can turn this off in Settings.
- **Search:** full-text search across titles and bodies, plus a ⌘K / Ctrl+K command palette.
- **Clients:** an alphabetical list. Each client page has company details, a logo, an **Information** section and a **New Hire Procedure** section (rich text with images; everyone can read them, only admins edit them), and the client's KBs at the bottom.
- **Dashboard:** totals and the most recently updated KBs.
- **Settings (admins):** site name, logo (also the browser tab icon) and accent colour. The name and logo also show on the sign-in page.
- **User Accounts:** people sign in with a username and password. Admins add technicians, set roles, reset passwords and disable accounts.
  - **Admin:** everything, including deleting KBs and clients, editing client Information and New Hire Procedure, and managing user accounts.
  - **Technician:** create and edit KBs and client details (no deleting).
  - **Viewer:** read-only.
- Light and dark mode, mobile layout.

## First run

After the first deploy, open the site. It asks you to create the first admin account. That screen only appears while there are no users, so do this right after deploying.

## Deploying

Cloudflare builds and deploys every push to `main` (Workers & Pages → wiki, connected to this repo; live at https://wiki.kenny-kao.workers.dev). The deploy command is `npx wrangler deploy`, which:

1. runs `npm run build` (configured in `wrangler.jsonc`),
2. connects the `deskside-wiki` D1 database (created automatically on the first deploy; it kept that name when the Worker was renamed to `wiki`),
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
