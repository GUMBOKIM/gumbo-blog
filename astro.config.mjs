// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import { globSync, readFileSync } from 'node:fs';

import mdx from '@astrojs/mdx';

const SITE = 'https://blog.daeheekim.dev';

/**
 * lastmod for the sitemap: each post gets its frontmatter date (or `updated` if set),
 * and list pages get the newest post date in that list, so Google knows when to come back.
 */
function lastmodByUrl() {
	const map = new Map();
	const newest = (url, date) => {
		if (!map.has(url) || map.get(url) < date) map.set(url, date);
	};
	for (const file of globSync('src/content/blog/*/{ko,en}.{md,mdx}')) {
		const fm = readFileSync(file, 'utf8').match(/^---\n([\s\S]*?)\n---/)?.[1] ?? '';
		const field = (name) => fm.match(new RegExp(`^${name}:\\s*['"]?([^'"\\n]+)`, 'm'))?.[1].trim();
		if (field('draft') === 'true') continue;
		const date = field('updated') ?? field('date');
		// skip scheduled posts the same way src/i18n.ts does (dates are KST days)
		if (!date || new Date(date).getTime() > Date.now() + 9 * 60 * 60 * 1000) continue;
		const [, slug, locale] = file.match(/blog\/(.+)\/(ko|en)\.mdx?$/) ?? [];
		const prefix = locale === 'ko' ? '' : `/${locale}`;
		map.set(`${SITE}${prefix}/posts/${slug}/`, date);
		for (const list of ['/', '/posts/', `/posts/${field('category')}/`]) newest(`${SITE}${prefix}${list}`, date);
	}
	return map;
}
const lastmod = lastmodByUrl();

export default defineConfig({
    site: SITE,
    i18n: {
        defaultLocale: 'ko',
        locales: ['ko', 'en'],
    },
    integrations: [
        sitemap({
            i18n: { defaultLocale: 'ko', locales: { ko: 'ko', en: 'en' } },
            serialize(item) {
                const date = lastmod.get(item.url);
                if (date) item.lastmod = new Date(date).toISOString();
                return item;
            },
        }),
        mdx(),
    ],
    markdown: {
        shikiConfig: {
            theme: 'vitesse-dark',
        },
    },
});
