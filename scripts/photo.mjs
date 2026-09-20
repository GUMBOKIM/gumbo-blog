// Prepares a photo for a post (or the about page): node scripts/photo.mjs <source> <dest> [name] [width] [square]
// <dest> is the content folder under src/content, e.g. "blog/<slug>" or "about".
// Fixes rotation, strips EXIF (which can hold GPS), resizes, and writes src/content/<dest>/assets/<name>.jpg
import sharp from 'sharp';
import { mkdirSync } from 'node:fs';
import { basename } from 'node:path';

const [source, dest, rawName, width = '800', shape = 'keep'] = process.argv.slice(2);
if (!source || !dest) {
	console.error('Usage: npm run photo <source> <dest> [name] [width] [square]');
	console.error('  <dest> is a content folder, e.g. blog/my-post or about');
	process.exit(1);
}
const name = (rawName ?? basename(source).replace(/\.[^.]+$/, '')).replace(/[^a-z0-9-]/gi, '-').toLowerCase();
const dir = `src/content/${dest}/assets`;
mkdirSync(dir, { recursive: true });
const out = `${dir}/${name}.jpg`;

// .rotate() applies the EXIF orientation, and sharp drops metadata unless asked to keep it
const upright = await sharp(source).rotate().toBuffer();
const { width: w, height: h } = await sharp(upright).metadata();

let pipeline = sharp(upright);
if (shape === 'square') {
	const size = Math.min(w, h);
	pipeline = pipeline.extract({ left: Math.round((w - size) / 2), top: Math.round((h - size) / 2), width: size, height: size });
}

const info = await pipeline
	.resize({ width: Number(width), withoutEnlargement: true })
	.jpeg({ quality: 82, mozjpeg: true })
	.toFile(out);

console.log(`${out}  ${info.width}x${info.height}  ${Math.round(info.size / 1024)}KB  (EXIF removed)`);
console.log(`markdown: ![설명](./assets/${name}.jpg)`);
