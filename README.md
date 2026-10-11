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

## Deploying to Cloudflare Pages

1. Push this folder to a GitHub repository.
2. In Cloudflare, go to **Workers & Pages → Create → Pages → Connect to Git** and pick the repo.
3. Build settings:
   - Framework preset: **Astro**
   - Build command: `npm run build`
   - Build output directory: `dist`
   - Environment variable: `NODE_VERSION` = `22`
4. Save and deploy. Every push to the main branch redeploys automatically.

Because this is internal documentation, put the site behind **Cloudflare Access** (Zero Trust → Access → Applications → Self-hosted) so only company accounts can view it. `public/_headers` already sets `noindex` so search engines won't list it.
