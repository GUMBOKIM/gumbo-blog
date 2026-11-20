import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { Resvg } from '@resvg/resvg-js';
import satori from 'satori';

// Link previews (Kakao, Slack, X, GeekNews) need an image file, so this one image is
// the only place a bundled font is used. Pretendard covers Korean and Latin in one file.
const require = createRequire(import.meta.url);
const fontDir = require.resolve('pretendard/dist/public/static/Pretendard-Bold.otf').replace(/[^/]+$/, '');
let fonts: Promise<{ name: string; data: Buffer; weight: 400 | 700 }[]> | undefined;
function loadFonts() {
	fonts ??= Promise.all([
		readFile(`${fontDir}Pretendard-Regular.otf`).then((data) => ({ name: 'Pretendard', data, weight: 400 as const })),
		readFile(`${fontDir}Pretendard-Bold.otf`).then((data) => ({ name: 'Pretendard', data, weight: 700 as const })),
	]);
	return fonts;
}

// Hex versions of the site palette in global.css (satori doesn't read oklch)
const color = {
	bg: '#1e2124',
	border: '#3a3e44',
	headings: '#ededed',
	textSecondary: '#a4abb7',
	links: '#e78bb5',
	accent: '#3fc69b',
};

export const OG_SIZE = { width: 1200, height: 630 };
const CONTENT_WIDTH = OG_SIZE.width - 160;

type Node = { type: string; props: Record<string, unknown> & { children?: unknown } };
const h = (type: string, style: Record<string, unknown>, children?: unknown): Node => ({
	type,
	props: { style, children },
});

interface Card {
	title: string;
	/** Small line above the title, e.g. "dev · 2026년 11월 22일" */
	kicker?: string;
	/** Line under the title */
	subtitle?: string;
}

export async function renderOgImage({ title, kicker, subtitle }: Card) {
	// Long titles step down so they still fit in three lines
	const titleSize = title.length > 40 ? 56 : title.length > 24 ? 64 : 76;
	const tree = h(
		'div',
		{
			width: '100%',
			height: '100%',
			boxSizing: 'border-box',
			display: 'flex',
			flexDirection: 'column',
			justifyContent: 'space-between',
			paddingTop: 72,
			paddingBottom: 64,
			paddingLeft: 80,
			paddingRight: 80,
			backgroundColor: color.bg,
			borderTop: `12px solid ${color.links}`,
			fontFamily: 'Pretendard',
		},
		[
			h('div', { display: 'flex', fontSize: 30, fontWeight: 700, color: color.accent }, kicker ?? ''),
			h('div', { display: 'flex', flexDirection: 'column', gap: 24, width: CONTENT_WIDTH }, [
				h(
					'div',
					{
						display: 'block',
						width: CONTENT_WIDTH,
						fontSize: titleSize,
						fontWeight: 700,
						lineHeight: 1.25,
						color: color.headings,
						lineClamp: 3,
						wordBreak: 'keep-all',
					},
					title,
				),
				subtitle
					? h(
							'div',
							{
								display: 'block',
								width: CONTENT_WIDTH,
								fontSize: 30,
								fontWeight: 400,
								lineHeight: 1.4,
								color: color.textSecondary,
								lineClamp: 2,
								wordBreak: 'keep-all',
							},
							subtitle,
						)
					: h('div', { display: 'flex' }, ''),
			]),
			h(
				'div',
				{
					display: 'flex',
					width: CONTENT_WIDTH,
					justifyContent: 'space-between',
					alignItems: 'center',
					paddingTop: 28,
					borderTop: `2px solid ${color.border}`,
					fontSize: 30,
				},
				[
					h('div', { display: 'flex', fontWeight: 700, color: color.links }, 'gumbo'),
					h('div', { display: 'flex', fontWeight: 400, color: color.textSecondary }, 'blog.daeheekim.dev'),
				],
			),
		],
	);
	const svg = await satori(tree as never, { ...OG_SIZE, fonts: await loadFonts() });
	return new Resvg(svg, { fitTo: { mode: 'width', value: OG_SIZE.width } }).render().asPng();
}
