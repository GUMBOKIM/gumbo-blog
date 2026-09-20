// Creates an empty post in both languages: node scripts/new-post.mjs <slug> [life|dev]
import { mkdirSync, existsSync, writeFileSync } from 'node:fs';

const [slug, category = 'life'] = process.argv.slice(2);
if (!slug) {
	console.error('Usage: npm run post <slug> [life|dev]');
	process.exit(1);
}
if (!['life', 'dev'].includes(category)) {
	console.error(`Unknown category "${category}". Use life or dev.`);
	process.exit(1);
}

const date = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Seoul' }); // YYYY-MM-DD in KST
const front = (title, description) =>
	`---\ntitle: ${title}\ndescription: ${description}\ncategory: ${category}\ndate: ${date}\n---\n\n`;

for (const [locale, body] of [
	['ko', front(slug, '')],
	['en', front(slug, '')],
]) {
	const dir = `src/content/blog/${locale}`;
	const file = `${dir}/${slug}.md`;
	mkdirSync(dir, { recursive: true });
	if (existsSync(file)) {
		console.log(`skip  ${file} (already exists)`);
		continue;
	}
	writeFileSync(file, body);
	console.log(`create ${file}`);
}
