import type { APIRoute, GetStaticPaths } from 'astro';
import { renderOgImage } from '../../og';
import { LOCALES, formatDate, getPosts, postSlug, ui, type Locale } from '../../i18n';

// One preview image per post and locale (/og/ko/<slug>.png) plus a site card per locale (/og/ko.png)
export const getStaticPaths = (async () => {
	const paths = await Promise.all(
		LOCALES.map(async (locale) => {
			const posts = await getPosts(locale);
			return [
				{ params: { path: locale }, props: { locale, title: 'gumbo', subtitle: ui[locale].description } },
				...posts.map((post) => ({
					params: { path: `${locale}/${postSlug(post)}` },
					props: {
						locale,
						title: post.data.title,
						kicker: `${ui[locale][post.data.category]} · ${formatDate(locale, post.data.date)}`,
					},
				})),
			];
		}),
	);
	return paths.flat();
}) satisfies GetStaticPaths;

interface Props {
	locale: Locale;
	title: string;
	kicker?: string;
	subtitle?: string;
}

export const GET: APIRoute<Props> = async ({ props }) => {
	const png = await renderOgImage(props);
	return new Response(new Uint8Array(png), { headers: { 'Content-Type': 'image/png' } });
};
