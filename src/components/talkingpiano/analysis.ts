/**
 * Speech → piano, after Peter Ablinger's talking piano.
 *
 * Stage 1 (`keygram`) turns audio into a "keygram": how much energy falls on each of the 88 piano
 * keys, 50 times a second. Stage 2 (`score`) chops that into chords the piano can actually play:
 * a few chords a second, a limited number of keys each.
 *
 * Only the keygram ships with the blog for the movie lines, never the audio itself. The microphone
 * goes through the same two stages in the browser.
 *
 * Kept free of DOM and TS-only syntax so Node can run it directly for the offline prep script.
 */

export const KEYS = 88;
/** MIDI number of the lowest key, A0 */
export const LOW_MIDI = 21;
export const RATE = 22050;
/** Keygram rows per second */
export const GRAM_FPS = 50;
const HOP = RATE / GRAM_FPS; // 441 samples
/** Keygram values are dB below the loudest cell, stored as 0..255 */
export const GRAM_RANGE_DB = 72;

export function keyFreq(key: number) {
	return 440 * 2 ** ((key + LOW_MIDI - 69) / 12);
}

/* ------------------------------------------------------------------ FFT */

const fftCache = new Map<number, { cos: Float32Array; sin: Float32Array; rev: Uint32Array; win: Float32Array }>();

function fftTables(n: number) {
	let t = fftCache.get(n);
	if (t) return t;
	const cos = new Float32Array(n / 2);
	const sin = new Float32Array(n / 2);
	for (let i = 0; i < n / 2; i++) {
		cos[i] = Math.cos((2 * Math.PI * i) / n);
		sin[i] = -Math.sin((2 * Math.PI * i) / n);
	}
	const bits = Math.log2(n);
	const rev = new Uint32Array(n);
	for (let i = 0; i < n; i++) {
		let r = 0;
		for (let b = 0; b < bits; b++) r |= ((i >> b) & 1) << (bits - 1 - b);
		rev[i] = r;
	}
	const win = new Float32Array(n);
	for (let i = 0; i < n; i++) win[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / n);
	t = { cos, sin, rev, win };
	fftCache.set(n, t);
	return t;
}

/** Power spectrum of `n` samples centred on `center`, Hann-windowed. Returns n/2 bins. */
function power(x: Float32Array, center: number, n: number, re: Float32Array, im: Float32Array, out: Float32Array) {
	const { cos, sin, rev, win } = fftTables(n);
	const start = center - n / 2;
	for (let i = 0; i < n; i++) {
		const j = start + i;
		re[rev[i]] = j >= 0 && j < x.length ? x[j] * win[i] : 0;
		im[rev[i]] = 0;
	}
	for (let size = 2; size <= n; size *= 2) {
		const half = size / 2;
		const step = n / size;
		for (let i = 0; i < n; i += size) {
			for (let k = 0; k < half; k++) {
				const a = i + k;
				const b = a + half;
				const c = cos[k * step];
				const s = sin[k * step];
				const tr = re[b] * c - im[b] * s;
				const ti = re[b] * s + im[b] * c;
				re[b] = re[a] - tr;
				im[b] = im[a] - ti;
				re[a] += tr;
				im[a] += ti;
			}
		}
	}
	for (let i = 0; i < n / 2; i++) out[i] = re[i] * re[i] + im[i] * im[i];
}

/* -------------------------------------------------------------- keygram */

/**
 * Low keys sit a few hertz apart and need a long window to tell apart; high keys need a short one
 * so consonants don't smear. Each key reads from the shortest window that still resolves it.
 */
const TIERS = [
	{ n: 4096, below: 39 }, // below C4 (key 39): 5.4 Hz bins, 186 ms
	{ n: 2048, below: 51 }, // C4 – C5: 93 ms
	{ n: 1024, below: KEYS }, // above C5: 46 ms
];

export interface Keygram {
	/** rows × 88, 0 = silent, 255 = loudest cell in the clip */
	data: Uint8Array;
	rows: number;
}

/**
 * Energy per key per 20 ms. A key collects the bins within a quarter tone of its pitch.
 * `tilt` lifts the treble by that many dB per octave above 500 Hz, because formants and consonants
 * are much quieter than the voice's fundamental yet carry most of what makes speech intelligible.
 */
export function keygram(x: Float32Array, tilt = 2): Keygram {
	const rows = Math.max(1, Math.ceil(x.length / HOP));
	const db = new Float32Array(rows * KEYS);
	const re = new Float32Array(4096);
	const im = new Float32Array(4096);
	const spec = new Float32Array(2048);
	const lift = new Float32Array(KEYS);
	for (let k = 0; k < KEYS; k++) lift[k] = Math.max(0, Math.log2(keyFreq(k) / 500)) * tilt;

	let tierStart = 0;
	for (const { n, below } of TIERS) {
		const binHz = RATE / n;
		// Bin ranges for this tier's keys
		const lo: number[] = [];
		const hi: number[] = [];
		for (let k = tierStart; k < below; k++) {
			const f = keyFreq(k);
			lo.push(Math.max(1, Math.round((f * 2 ** (-1 / 24)) / binHz)));
			hi.push(Math.max(1, Math.round((f * 2 ** (1 / 24)) / binHz)));
		}
		for (let r = 0; r < rows; r++) {
			power(x, r * HOP, n, re, im, spec);
			for (let k = tierStart; k < below; k++) {
				let sum = 0;
				for (let b = lo[k - tierStart]; b <= hi[k - tierStart]; b++) sum += spec[b];
				db[r * KEYS + k] = 10 * Math.log10(sum / n + 1e-12) + lift[k];
			}
		}
		tierStart = below;
	}

	let max = -Infinity;
	for (const v of db) if (v > max) max = v;
	const data = new Uint8Array(rows * KEYS);
	for (let i = 0; i < db.length; i++) {
		const rel = (db[i] - max + GRAM_RANGE_DB) / GRAM_RANGE_DB;
		data[i] = Math.round(Math.min(1, Math.max(0, rel)) * 255);
	}
	return { data, rows };
}

/* ---------------------------------------------------------------- score */

export interface Note {
	key: number;
	/** 0..1 */
	vel: number;
}

export interface Chord {
	/** seconds */
	time: number;
	notes: Note[];
}

export interface ScoreOptions {
	/** Chords per second */
	fps: number;
	/** Keys per chord */
	voices: number;
	/** A slot whose total energy is this many dB under the loudest slot is a rest */
	gateDb?: number;
	/** Within a chord, keys this many dB under its loudest key are left out */
	rangeDb?: number;
}

const toDb = (v: number) => ((v / 255) - 1) * GRAM_RANGE_DB;

/**
 * One chord per 1/fps seconds. Inside each slot, the louder of each key's cells wins, then the
 * keys that stand out from their neighbours (spectral peaks) are kept, loudest first.
 * Quiet slots become rests: without that, the breath and leftover room noise between words
 * turns into a constant rain of soft notes and the gaps that make speech readable disappear.
 */
export function score(gram: Keygram, { fps, voices, gateDb = 22, rangeDb = 30 }: ScoreOptions): Chord[] {
	const slot = GRAM_FPS / fps;
	const slots = Math.ceil(gram.rows / slot);
	const levels: Float32Array[] = [];
	const energy: number[] = [];
	for (let c = 0; c < slots; c++) {
		const r0 = Math.floor(c * slot);
		const r1 = Math.min(gram.rows, Math.max(r0 + 1, Math.floor((c + 1) * slot)));
		const level = new Float32Array(KEYS);
		for (let r = r0; r < r1; r++) {
			for (let k = 0; k < KEYS; k++) level[k] = Math.max(level[k], gram.data[r * KEYS + k]);
		}
		let sum = 0;
		for (let k = 0; k < KEYS; k++) sum += 10 ** (toDb(level[k]) / 10);
		levels.push(level);
		energy.push(10 * Math.log10(sum + 1e-12));
	}
	const loudest = Math.max(...energy);

	const chords: Chord[] = [];
	for (let c = 0; c < slots; c++) {
		const notes: Note[] = [];
		const level = levels[c];
		if (energy[c] >= loudest - gateDb) {
			let top = 0;
			for (let k = 0; k < KEYS; k++) top = Math.max(top, level[k]);
			const floor = top - (rangeDb / GRAM_RANGE_DB) * 255;
			for (let k = 0; k < KEYS; k++) {
				const v = level[k];
				if (v <= floor) continue;
				if (k > 0 && level[k - 1] > v) continue;
				if (k < KEYS - 1 && level[k + 1] >= v) continue;
				// Loudness follows the slot's place in the whole clip, not just within the chord
				const slotGain = Math.min(1, Math.max(0, 1 - (loudest - energy[c]) / gateDb));
				notes.push({ key: k, vel: ((v - floor) / (top - floor)) * (0.35 + 0.65 * slotGain) });
			}
			notes.sort((a, b) => b.vel - a.vel);
		}
		chords.push({ time: c / fps, notes: notes.slice(0, voices) });
	}
	return chords;
}

/* ------------------------------------------------------------- encoding */

export function encodeGram(gram: Keygram): string {
	let s = '';
	for (let i = 0; i < gram.data.length; i++) s += String.fromCharCode(gram.data[i]);
	return btoa(s);
}

export function decodeGram(b64: string): Keygram {
	const s = atob(b64);
	const data = new Uint8Array(s.length);
	for (let i = 0; i < s.length; i++) data[i] = s.charCodeAt(i);
	return { data, rows: data.length / KEYS };
}
