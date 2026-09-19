import { getCollection, type CollectionEntry } from 'astro:content';
import { CATEGORIES, type Category } from './categories';

export { CATEGORIES, type Category };

export const LOCALES = ['ko', 'en'] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = 'ko';

export const SITE_TITLE = 'gumbo';
export const GITHUB_URL = 'https://github.com/GUMBOKIM';
/** Home lists this many recent posts; everything lives on /posts */
export const HOME_POST_LIMIT = 5;

export const ui = {
	ko: {
		description: '이것저것 생각하는 것들을 기록합니다',
		recent: '최근 글',
		allPosts: '모든 글 보기',
		all: 'all',
		life: 'life',
		dev: 'dev',
		other: 'en',
	},
	en: {
		description: 'Writing down whatever comes to mind',
		recent: 'Recent',
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
	return post.id.split('/').slice(1).join('/');
}

export async function getPosts(locale: Locale, category?: Category) {
	const posts = await getCollection(
		'blog',
		({ id, data }) =>
			id.startsWith(`${locale}/`) && !data.draft && (category === undefined || data.category === category),
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
