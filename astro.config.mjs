// @ts-check
import { defineConfig, fontProviders } from 'astro/config';
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
	// Self-hosted with metric-matched fallbacks so text doesn't jump when fonts swap in
	fonts: [
		{
			provider: fontProviders.google(),
			name: 'Source Serif 4',
			cssVariable: '--font-serif',
			weights: [400, 700],
			styles: ['normal', 'italic'],
			subsets: ['latin'],
			fallbacks: ['Georgia', 'serif'],
		},
		{
			provider: fontProviders.google(),
			name: 'Noto Serif KR',
			cssVariable: '--font-serif-kr',
			weights: [400, 700],
			fallbacks: ['serif'],
		},
		{
			provider: fontProviders.google(),
			name: 'Inter',
			cssVariable: '--font-sans',
			weights: [400, 700],
			subsets: ['latin'],
			fallbacks: ['sans-serif'],
		},
		{
			provider: fontProviders.google(),
			name: 'JetBrains Mono',
			cssVariable: '--font-mono',
			weights: [400, 700],
			subsets: ['latin'],
			fallbacks: ['monospace'],
		},
	],
});
