// Configuration Astro : site 100 % statique, publié sur GitHub Pages (undocpourtous.com).
// format 'file' : src/pages/albion.astro → dist/albion.html (mêmes adresses qu'avant la migration).
import { defineConfig } from 'astro/config';

export default defineConfig({
    site: 'https://undocpourtous.com',
    build: { format: 'file' },
    trailingSlash: 'ignore',
    // HTML lisible, identique à la mise en forme des sources (plus facile à relire et à comparer)
    compressHTML: false,
    devToolbar: { enabled: false },
});
