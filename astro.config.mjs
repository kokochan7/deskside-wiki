// @ts-check
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';

export default defineConfig({
	integrations: [
		starlight({
			title: 'IT Knowledge Base',
			description: 'Internal IT documentation, how-tos and troubleshooting guides.',
			logo: { src: './src/assets/logo.svg' },
			favicon: '/favicon.svg',
			customCss: ['./src/styles/custom.css'],
			lastUpdated: true,
			pagination: true,
			tableOfContents: { minHeadingLevel: 2, maxHeadingLevel: 3 },
			sidebar: [
				{ label: 'Getting started', items: [{ autogenerate: { directory: 'getting-started' } }] },
				{ label: 'Accounts & access', items: [{ autogenerate: { directory: 'accounts' } }] },
				{ label: 'Network & remote access', items: [{ autogenerate: { directory: 'network' } }] },
				{ label: 'Hardware', items: [{ autogenerate: { directory: 'hardware' } }] },
				{ label: 'Software', items: [{ autogenerate: { directory: 'software' } }] },
				{ label: 'Support', items: [{ autogenerate: { directory: 'support' } }] },
			],
		}),
	],
});
