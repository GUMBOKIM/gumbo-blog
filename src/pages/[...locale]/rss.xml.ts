import rss from '@astrojs/rss';
import type { APIContext } from 'astro';
import { SITE_TITLE, getPosts, localePaths, localize, postSlug, toLocale, ui } from '../../i18n';

export const getStaticPaths = localePaths;

export async function GET(context: APIContext) {
	const locale = toLocale(context.params.locale);
	const posts = await getPosts(locale);
	return rss({
		title: SITE_TITLE,
		description: ui[locale].description,
		site: context.site!,
		items: posts.map((post) => ({
			title: post.data.title,
			description: post.data.description,
			pubDate: post.data.date,
			link: localize(locale, `/posts/${postSlug(post)}/`),
		})),
	});
}
