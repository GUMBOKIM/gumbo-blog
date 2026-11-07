// Builds the keygrams for the talking-piano post from the movie clips.
// Only the keygrams are committed; the audio never goes into the repo.
//
//   uvx yt-dlp -x --audio-format wav -o '<dir>/<id>.%(ext)s' <source>      # each clip in clips.ts
//   demucs -d cpu --two-stems=vocals -o <sep> <dir>/*.wav                   # strip music and effects
//   node scripts/talking-piano-prep.mjs <sep>/htdemucs                       # reads <id>/vocals.wav
import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { RATE, encodeGram, keygram } from '../src/components/talkingpiano/analysis.ts';
import { CLIPS } from '../src/components/talkingpiano/clips.ts';

const [dir] = process.argv.slice(2);
if (!dir) {
	console.error('Usage: node scripts/talking-piano-prep.mjs <demucs output dir>');
	process.exit(1);
}

const grams = {};
for (const clip of CLIPS) {
	const [from, to] = clip.trim;
	const raw = execFileSync(
		'ffmpeg',
		['-v', 'quiet', '-ss', String(from), '-to', String(to), '-i', `${dir}/${clip.id}/vocals.wav`, '-ac', '1', '-ar', String(RATE), '-f', 'f32le', '-'],
		{ maxBuffer: 1e8 },
	);
	const gram = keygram(new Float32Array(raw.buffer, raw.byteOffset, raw.length / 4));
	grams[clip.id] = encodeGram(gram);
	console.log(`${clip.id.padEnd(12)} ${(gram.rows / 50).toFixed(2)}s  ${grams[clip.id].length} bytes`);
}
writeFileSync('src/components/talkingpiano/grams.json', JSON.stringify(grams, null, '\t') + '\n');
