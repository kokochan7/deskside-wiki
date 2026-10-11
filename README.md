# IT Knowledge Base

Internal IT wiki built with [Astro Starlight](https://starlight.astro.build): full-text search, dark/light mode, sidebar navigation and mobile layout out of the box.

## Local development

```sh
npm install
npm run dev      # http://localhost:4321
npm run build    # static site in ./dist
```

## Adding articles

Add a Markdown (`.md`) or MDX (`.mdx`) file under `src/content/docs/<section>/`. The sidebar updates automatically. See `src/content/docs/support/contribute.md`.

Text in **[square brackets]** is placeholder content to replace with company specifics.

## Deploying to Cloudflare

The site deploys as a Cloudflare Worker with static assets (`wrangler.jsonc`).

1. In Cloudflare, go to **Workers & Pages → Create → Import a repository** and pick this repo.
2. Leave the build command empty and the deploy command as `npx wrangler deploy`. Wrangler runs `npm run build` itself, then uploads `dist`.
3. Every push to `main` redeploys automatically.

To deploy by hand: `npx wrangler deploy`.

Because this is internal documentation, put the site behind **Cloudflare Access** (Zero Trust → Access → Applications → Self-hosted) so only company accounts can view it. `public/_headers` already sets `noindex` so search engines won't list it.
