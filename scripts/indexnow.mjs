// Tells IndexNow (Bing, Naver, Yandex, Seznam…) which pages are new or changed, so they get
// crawled right after a deploy instead of whenever the search engine next drops by.
//
//   node scripts/indexnow.mjs diff     # after `astro build`: prints URLs whose sitemap entry is new
//                                      # or has a newer lastmod than the live site, one per line
//   node scripts/indexnow.mjs submit   # reads URLs from stdin and submits them
//   node scripts/indexnow.mjs all      # submits every URL in the live sitemap (first-time setup)
//
// lastmod comes from a post's `date` (or `updated`), so set `updated` to re-announce an edited post.
// The key is public by design: search engines check it at https://<site>/<key>.txt.
import { readFileSync, globSync } from 'node:fs';

const SITE = 'https://blog.daeheekim.dev';
const KEY = '12553ffd4b7baec727c8810d2cc0349c';

/** loc → lastmod from one or more sitemap XML strings */
function entries(xmls) {
	const map = new Map();
	for (const xml of xmls) {
		for (const [, body] of xml.matchAll(/<url>([\s\S]*?)<\/url>/g)) {
			const loc = body.match(/<loc>(.*?)<\/loc>/)?.[1];
			if (loc) map.set(loc, body.match(/<lastmod>(.*?)<\/lastmod>/)?.[1] ?? '');
		}
	}
	return map;
}

async function liveSitemap() {
	const index = await fetch(`${SITE}/sitemap-index.xml`);
	if (!index.ok) return new Map(); // nothing deployed yet: everything is new
	const parts = [...(await index.text()).matchAll(/<loc>(.*?)<\/loc>/g)].map((m) => m[1]);
	return entries(await Promise.all(parts.map(async (url) => (await fetch(url)).text())));
}

async function submit(urls) {
	if (!urls.length) return console.log('IndexNow: nothing to submit');
	const res = await fetch('https://api.indexnow.org/indexnow', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json; charset=utf-8' },
		body: JSON.stringify({ host: new URL(SITE).host, key: KEY, keyLocation: `${SITE}/${KEY}.txt`, urlList: urls }),
	});
	console.log(`IndexNow: ${res.status} for ${urls.length} URL(s)`);
	for (const url of urls) console.log(`  ${url}`);
	// 200 and 202 are both success; anything else is worth seeing in the log but shouldn't fail a deploy
}

const mode = process.argv[2];
if (mode === 'diff') {
	const built = entries(globSync('dist/sitemap-*.xml').filter((f) => !f.endsWith('index.xml')).map((f) => readFileSync(f, 'utf8')));
	const live = await liveSitemap();
	for (const [loc, lastmod] of built) {
		if (!live.has(loc) || live.get(loc) < lastmod) console.log(loc);
	}
} else if (mode === 'submit') {
	const urls = readFileSync(0, 'utf8').split('\n').map((s) => s.trim()).filter(Boolean);
	await submit(urls);
} else if (mode === 'all') {
	await submit([...(await liveSitemap()).keys()]);
} else {
	console.error('Usage: node scripts/indexnow.mjs diff | submit | all');
	process.exit(1);
}
