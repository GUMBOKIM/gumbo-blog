// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
	site: 'https://blog.daeheekim.dev',
	i18n: {
		defaultLocale: 'ko',
		locales: ['ko', 'en'],
	},
	integrations: [sitemap({ i18n: { defaultLocale: 'ko', locales: { ko: 'ko', en: 'en' } } })],
	markdown: {
		shikiConfig: {
			theme: 'github-dark',
		},
	},
});
