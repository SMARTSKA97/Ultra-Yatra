import { defineConfig } from 'astro/config';
import remarkGfm from 'remark-gfm';

export default defineConfig({
  site: process.env.SITE_URL || 'http://localhost:4321',
  markdown: { remarkPlugins: [remarkGfm] }
});
