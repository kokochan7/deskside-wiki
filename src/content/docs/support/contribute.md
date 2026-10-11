---
title: Add or edit an article
description: How to contribute to this knowledge base.
sidebar:
  order: 2
---

Every article is a Markdown file in `src/content/docs/`. The folder decides which sidebar section it appears in.

1. Create a file such as `src/content/docs/network/new-topic.md`.
2. Start it with front matter:

   ```md
   ---
   title: Article title
   description: One-line summary shown in search results.
   ---
   ```

3. Write the article in Markdown. Use `.mdx` if you want components like steps, tabs or callouts.
4. Commit and push. The site rebuilds and deploys automatically.

Run `npm run dev` to preview changes locally.
