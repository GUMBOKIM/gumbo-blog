import { getCollection, type CollectionEntry } from 'astro:content';
import { CATEGORIES, type Category } from './categories';

export { CATEGORIES, type Category };

export const LOCALES = ['ko', 'en'] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = 'ko';

export const SITE_TITLE = 'gumbo';
export const AUTHOR = 'Gumbo';
export const GITHUB_URL = 'https://github.com/GUMBOKIM';
/** Home lists this many recent posts; everything lives on /posts */
export const HOME_POST_LIMIT = 5;

export const ui = {
	ko: {
		description: '이것저것 생각하는 것들을 기록합니다',
		recent: '최근 글',
		older: '이전 글',
		minutes: '분',
		newer: '다음 글',
		allPosts: '모든 글 보기',
		all: 'all',
		life: 'life',
		dev: 'dev',
		other: 'en',
	},
	en: {
		description: 'Writing down whatever comes to mind',
		recent: 'Recent',
		older: 'Older',
		minutes: 'min read',
		newer: 'Newer',
		allPosts: 'All posts',
		all: 'all',
		life: 'life',
		dev: 'dev',
		other: 'ko',
	},
} satisfies Record<Locale, Record<string, string>>;

export function otherLocale(locale: Locale): Locale {
	return locale === 'ko' ? 'en' : 'ko';
}

/** Route param for [...locale]: undefined for the default locale (served at /) */
export function localeParam(locale: Locale) {
	return locale === DEFAULT_LOCALE ? undefined : locale;
}

/** getStaticPaths for pages under [...locale]: Korean at /, English at /en */
export function localePaths() {
	return LOCALES.map((locale) => ({ params: { locale: localeParam(locale) } }));
}

export function toLocale(param: string | undefined): Locale {
	return param === 'en' ? 'en' : DEFAULT_LOCALE;
}

export function localize(locale: Locale, path: string) {
	return locale === DEFAULT_LOCALE ? path : `/${locale}${path}`;
}

/** Converts the current path to the same path in the other locale */
export function switchLocale(pathname: string, to: Locale) {
	const bare = pathname.replace(/^\/en(?=\/|$)/, '') || '/';
	return localize(to, bare);
}

export function postSlug(post: CollectionEntry<'blog'>) {
	// Posts live at blog/<slug>/<locale>.md, so the slug is everything before the locale segment
	return post.id.split('/').slice(0, -1).join('/');
}

/** 예약 발행: 날짜가 아직 안 된 글은 빌드에서 빠진다. dev에서는 미리 보이게 둔다 */
function isPublished(date: Date) {
	return !import.meta.env.PROD || date <= new Date();
}

export async function getPosts(locale: Locale, category?: Category) {
	const posts = await getCollection(
		'blog',
		({ id, data }) =>
			id.endsWith(`/${locale}`) &&
			!data.draft &&
			isPublished(data.date) &&
			(category === undefined || data.category === category),
	);
	return posts.sort((a, b) => b.data.date.valueOf() - a.data.date.valueOf());
}

export function formatDate(locale: Locale, date: Date) {
	return date.toLocaleDateString(locale === 'ko' ? 'ko-KR' : 'en-US', {
		year: 'numeric',
		month: 'long',
		day: 'numeric',
		timeZone: 'UTC',
	});
}

/** Groups posts by year, newest year first (posts are already sorted) */
export function groupByYear(posts: CollectionEntry<'blog'>[]) {
	const groups = new Map<number, CollectionEntry<'blog'>[]>();
	for (const post of posts) {
		const year = post.data.date.getUTCFullYear();
		groups.set(year, [...(groups.get(year) ?? []), post]);
	}
	return [...groups];
}

/** MM-DD */
export function shortDate(date: Date) {
	return date.toISOString().slice(5, 10);
}

/** Rough reading time in minutes: ~500 Korean characters or ~200 English words per minute */
export function readingTime(body: string, locale: Locale) {
	const text = body
		.replace(/```[\s\S]*?```/g, '') // code blocks
		.replace(/!?\[[^\]]*\]\([^)]*\)/g, '') // links and images
		.replace(/<[^>]+>/g, '');
	const minutes = locale === 'ko' ? text.replace(/\s/g, '').length / 500 : text.split(/\s+/).filter(Boolean).length / 200;
	return Math.max(1, Math.round(minutes));
}
