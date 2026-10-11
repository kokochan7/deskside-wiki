import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// Builds the React app into ./dist. The API in ./worker is bundled by Wrangler.
export default defineConfig({
	plugins: [react(), tailwindcss()],
	server: { proxy: { '/api': 'http://localhost:8787' } },
});
