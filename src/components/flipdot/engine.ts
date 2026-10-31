/**
 * Flip-dot display simulated on a 2D canvas.
 *
 * A real panel is a grid of discs, yellow on one side and black on the other, each sitting
 * over an electromagnet. A controller scans the matrix and pulses the coil of every disc that
 * needs to turn. The board here keeps the same shape: `target` is what the controller wants
 * to show, `side` is what each disc currently shows, and `scan()` walks the rows with a time
 * budget so a full-panel change rolls down the board instead of appearing at once.
 */

export const TAU = Math.PI * 2;

/** One disc takes this long to turn over (ms) */
const FLIP_MS = 80;
/** Controller overhead per row scanned (ms); sets the idle refresh rate of the board */
const ROW_MS = 3;
/** Extra time per disc actually flipped in a row (ms); a busy row takes longer */
const DOT_MS = 0.35;
/** Clamp frame gaps (tab switch, long GC) so the scan never tries to catch up on seconds */
const MAX_DT = 50;

const COLOR = {
	panel: '#0c0c0c',
	// Each side has a resting color and a brighter one while the disc is mid-turn and catches light
	on: ['#f3c20a', '#ffe37a'],
	off: ['#1d1d1d', '#303030'],
} as const;

/* ---------------------------------------------------------------- sound */

/**
 * The click of a flip-dot is a short, bright rattle: a burst of band-passed noise with a tiny
 * low thump underneath. Clicks are scheduled per scanned row, offset by where that row sits
 * in the current frame's scan budget, so a full-board change comes out as a "brrrrt" sweep.
 */
export class Clicker {
	private ctx: AudioContext | null = null;
	private noise: AudioBuffer | null = null;
	private master: GainNode | null = null;
	private frameClicks = 0;
	enabled = true;

	/** Browsers only let a page make noise after a user gesture, so call this from a handler */
	unlock() {
		if (this.ctx) {
			if (this.ctx.state === 'suspended') void this.ctx.resume();
			return;
		}
		const ctx = new AudioContext();
		const noise = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.05), ctx.sampleRate);
		const data = noise.getChannelData(0);
		for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
		const master = ctx.createGain();
		master.gain.value = 0.5;
		// Keep a burst of 20 simultaneous clicks from clipping
		const limiter = ctx.createDynamicsCompressor();
		limiter.threshold.value = -12;
		limiter.ratio.value = 8;
		master.connect(limiter).connect(ctx.destination);
		this.ctx = ctx;
		this.noise = noise;
		this.master = master;
	}

	get unlocked() {
		return this.ctx !== null && this.ctx.state === 'running';
	}

	/** Reset the per-frame cap; the board calls this before each scan */
	beginFrame() {
		this.frameClicks = 0;
	}

	/** A row with `flipped` discs turned over, `offsetMs` into this frame's scan */
	row(flipped: number, offsetMs: number) {
		if (!this.enabled || !this.ctx || !this.noise || !this.master || flipped === 0) return;
		// Up to 4 clicks per row depending on how many discs moved, 24 per frame overall
		const clicks = Math.min(1 + Math.floor(flipped / 10), 4);
		const strength = 0.1 + 0.2 * Math.min(1, flipped / 12);
		const base = this.ctx.currentTime + 0.012 + offsetMs / 1000;
		for (let i = 0; i < clicks && this.frameClicks < 24; i++, this.frameClicks++) {
			this.click(base + i * 0.0015 + Math.random() * 0.002, strength);
		}
	}

	private click(when: number, strength: number) {
		const ctx = this.ctx!;
		const out = this.master!;

		const src = ctx.createBufferSource();
		src.buffer = this.noise;
		const band = ctx.createBiquadFilter();
		band.type = 'bandpass';
		band.frequency.value = 1800 + Math.random() * 2400;
		band.Q.value = 1.1;
		const env = ctx.createGain();
		env.gain.setValueAtTime(strength, when);
		env.gain.exponentialRampToValueAtTime(0.001, when + 0.022);
		src.connect(band).connect(env).connect(out);
		src.start(when);
		src.stop(when + 0.03);

		// The thump: the disc hitting its stop
		const thump = ctx.createOscillator();
		thump.type = 'sine';
		thump.frequency.setValueAtTime(190, when);
		thump.frequency.exponentialRampToValueAtTime(90, when + 0.015);
		const tenv = ctx.createGain();
		tenv.gain.setValueAtTime(strength * 0.6, when);
		tenv.gain.exponentialRampToValueAtTime(0.001, when + 0.018);
		thump.connect(tenv).connect(out);
		thump.start(when);
		thump.stop(when + 0.02);
	}
}

/** One AudioContext for the whole page; survives client-side navigation */
export const clicker = new Clicker();

/* ---------------------------------------------------------------- board */

export class Board {
	readonly cols: number;
	readonly rows: number;
	/** Side each disc shows now: 1 = yellow, 0 = black */
	readonly side: Uint8Array;
	/** When each disc started its last flip (performance.now() ms), or 0 */
	readonly flipAt: Float64Array;
	/** What the controller wants to show; swapped by the owner, never resized */
	target: Uint8Array;
	/** Discs flipped since the board was created */
	flips = 0;

	private readonly ctx: CanvasRenderingContext2D;
	private scanRow = 0;
	private budget = 0;
	private dirty = true;
	private pitch = 0;

	constructor(
		readonly canvas: HTMLCanvasElement,
		cols: number,
		rows: number,
		private readonly sound: Clicker | null,
	) {
		this.cols = cols;
		this.rows = rows;
		this.side = new Uint8Array(cols * rows);
		this.flipAt = new Float64Array(cols * rows);
		this.target = new Uint8Array(cols * rows);
		this.ctx = canvas.getContext('2d')!;
		canvas.style.aspectRatio = `${cols + 1} / ${rows + 1}`;
		this.resize();
	}

	/** Match the backing store to the element's CSS size and the device pixel ratio */
	resize() {
		const dpr = Math.min(window.devicePixelRatio || 1, 3);
		const width = Math.round(this.canvas.clientWidth * dpr);
		if (width === 0) return;
		this.pitch = width / (this.cols + 1);
		this.canvas.width = width;
		this.canvas.height = Math.round(this.pitch * (this.rows + 1));
		this.dirty = true;
	}

	/** Advance the simulated controller by `dt` ms and repaint if anything is moving */
	tick(now: number, dt: number) {
		this.scan(now, Math.min(dt, MAX_DT));
		if (this.dirty) this.draw(now);
	}

	/** Canvas cell under a client coordinate, or null when outside the dot area */
	cellAt(clientX: number, clientY: number) {
		const rect = this.canvas.getBoundingClientRect();
		const pitchCss = rect.width / (this.cols + 1);
		const x = Math.floor((clientX - rect.left) / pitchCss - 0.5);
		const y = Math.floor((clientY - rect.top) / pitchCss - 0.5);
		if (x < 0 || y < 0 || x >= this.cols || y >= this.rows) return null;
		return { x, y };
	}

	private scan(now: number, dt: number) {
		this.budget += dt;
		this.sound?.beginFrame();
		let consumed = 0;
		// Never loop more than two full sweeps in one frame, whatever the budget says
		let guard = this.rows * 2;
		while (this.budget > 0 && guard-- > 0) {
			const r = this.scanRow;
			const start = r * this.cols;
			let flipped = 0;
			for (let i = start; i < start + this.cols; i++) {
				if (this.target[i] !== this.side[i]) {
					this.side[i] = this.target[i];
					// Discs later in this frame's sweep start turning later, so a change rolls down the board
					this.flipAt[i] = now + consumed;
					flipped++;
				}
			}
			const cost = ROW_MS + DOT_MS * flipped;
			if (flipped) {
				this.flips += flipped;
				this.dirty = true;
				this.sound?.row(flipped, consumed);
			}
			this.budget -= cost;
			consumed += cost;
			this.scanRow = (r + 1) % this.rows;
		}
		if (guard < 0) this.budget = 0;
	}

	private draw(now: number) {
		const { ctx, pitch, cols, rows } = this;
		const radius = pitch * 0.44;
		ctx.fillStyle = COLOR.panel;
		ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

		let animating = false;
		let fill = '';
		for (let y = 0; y < rows; y++) {
			const cy = (y + 1) * pitch;
			for (let x = 0; x < cols; x++) {
				const i = y * cols + x;
				const cx = (x + 1) * pitch;
				// Progress of the turn: <0 not started yet, 0..1 turning, >=1 at rest
				const p = (now - this.flipAt[i]) / FLIP_MS;
				let ry = radius;
				let on = this.side[i] === 1;
				let moving = 0;
				if (p < 1) {
					animating = true;
					if (p < 0) {
						on = !on;
					} else {
						// The disc turns on its horizontal axle, top over bottom, so its visible height is
						// the cosine of the angle; the color changes when it is edge-on at the halfway point
						ry = Math.max(radius * Math.abs(Math.cos(p * Math.PI)), 0.4);
						if (p < 0.5) on = !on;
						moving = 1;
					}
				}
				const color = (on ? COLOR.on : COLOR.off)[moving];
				if (color !== fill) ctx.fillStyle = fill = color;
				ctx.beginPath();
				ctx.ellipse(cx, cy, radius, ry, 0, 0, TAU);
				ctx.fill();
			}
		}
		this.dirty = animating;
	}
}

/* ---------------------------------------------------------------- 5×7 font */

/** Rows top to bottom, five bits each, leftmost pixel is the high bit */
const GLYPHS: Record<string, number[]> = {
	' ': [0, 0, 0, 0, 0, 0, 0],
	'0': [0b01110, 0b10001, 0b10011, 0b10101, 0b11001, 0b10001, 0b01110],
	'1': [0b00100, 0b01100, 0b00100, 0b00100, 0b00100, 0b00100, 0b01110],
	'2': [0b01110, 0b10001, 0b00001, 0b00010, 0b00100, 0b01000, 0b11111],
	'3': [0b11111, 0b00010, 0b00100, 0b00010, 0b00001, 0b10001, 0b01110],
	'4': [0b00010, 0b00110, 0b01010, 0b10010, 0b11111, 0b00010, 0b00010],
	'5': [0b11111, 0b10000, 0b11110, 0b00001, 0b00001, 0b10001, 0b01110],
	'6': [0b00110, 0b01000, 0b10000, 0b11110, 0b10001, 0b10001, 0b01110],
	'7': [0b11111, 0b00001, 0b00010, 0b00100, 0b01000, 0b01000, 0b01000],
	'8': [0b01110, 0b10001, 0b10001, 0b01110, 0b10001, 0b10001, 0b01110],
	'9': [0b01110, 0b10001, 0b10001, 0b01111, 0b00001, 0b00010, 0b01100],
	A: [0b01110, 0b10001, 0b10001, 0b11111, 0b10001, 0b10001, 0b10001],
	B: [0b11110, 0b10001, 0b10001, 0b11110, 0b10001, 0b10001, 0b11110],
	C: [0b01110, 0b10001, 0b10000, 0b10000, 0b10000, 0b10001, 0b01110],
	D: [0b11100, 0b10010, 0b10001, 0b10001, 0b10001, 0b10010, 0b11100],
	E: [0b11111, 0b10000, 0b10000, 0b11110, 0b10000, 0b10000, 0b11111],
	F: [0b11111, 0b10000, 0b10000, 0b11110, 0b10000, 0b10000, 0b10000],
	G: [0b01110, 0b10001, 0b10000, 0b10111, 0b10001, 0b10001, 0b01111],
	H: [0b10001, 0b10001, 0b10001, 0b11111, 0b10001, 0b10001, 0b10001],
	I: [0b01110, 0b00100, 0b00100, 0b00100, 0b00100, 0b00100, 0b01110],
	J: [0b00111, 0b00010, 0b00010, 0b00010, 0b00010, 0b10010, 0b01100],
	K: [0b10001, 0b10010, 0b10100, 0b11000, 0b10100, 0b10010, 0b10001],
	L: [0b10000, 0b10000, 0b10000, 0b10000, 0b10000, 0b10000, 0b11111],
	M: [0b10001, 0b11011, 0b10101, 0b10101, 0b10001, 0b10001, 0b10001],
	N: [0b10001, 0b10001, 0b11001, 0b10101, 0b10011, 0b10001, 0b10001],
	O: [0b01110, 0b10001, 0b10001, 0b10001, 0b10001, 0b10001, 0b01110],
	P: [0b11110, 0b10001, 0b10001, 0b11110, 0b10000, 0b10000, 0b10000],
	Q: [0b01110, 0b10001, 0b10001, 0b10001, 0b10101, 0b10010, 0b01101],
	R: [0b11110, 0b10001, 0b10001, 0b11110, 0b10100, 0b10010, 0b10001],
	S: [0b01111, 0b10000, 0b10000, 0b01110, 0b00001, 0b00001, 0b11110],
	T: [0b11111, 0b00100, 0b00100, 0b00100, 0b00100, 0b00100, 0b00100],
	U: [0b10001, 0b10001, 0b10001, 0b10001, 0b10001, 0b10001, 0b01110],
	V: [0b10001, 0b10001, 0b10001, 0b10001, 0b10001, 0b01010, 0b00100],
	W: [0b10001, 0b10001, 0b10001, 0b10101, 0b10101, 0b10101, 0b01010],
	X: [0b10001, 0b10001, 0b01010, 0b00100, 0b01010, 0b10001, 0b10001],
	Y: [0b10001, 0b10001, 0b10001, 0b01010, 0b00100, 0b00100, 0b00100],
	Z: [0b11111, 0b00001, 0b00010, 0b00100, 0b01000, 0b10000, 0b11111],
	':': [0b00000, 0b00100, 0b00100, 0b00000, 0b00100, 0b00100, 0b00000],
	'.': [0b00000, 0b00000, 0b00000, 0b00000, 0b00000, 0b01100, 0b01100],
	',': [0b00000, 0b00000, 0b00000, 0b00000, 0b01100, 0b00100, 0b01000],
	'-': [0b00000, 0b00000, 0b00000, 0b11111, 0b00000, 0b00000, 0b00000],
	'!': [0b00100, 0b00100, 0b00100, 0b00100, 0b00100, 0b00000, 0b00100],
	'?': [0b01110, 0b10001, 0b00001, 0b00010, 0b00100, 0b00000, 0b00100],
	'/': [0b00001, 0b00010, 0b00010, 0b00100, 0b01000, 0b01000, 0b10000],
	"'": [0b01100, 0b00100, 0b01000, 0b00000, 0b00000, 0b00000, 0b00000],
	'+': [0b00000, 0b00100, 0b00100, 0b11111, 0b00100, 0b00100, 0b00000],
	'=': [0b00000, 0b00000, 0b11111, 0b00000, 0b11111, 0b00000, 0b00000],
	'#': [0b01010, 0b01010, 0b11111, 0b01010, 0b11111, 0b01010, 0b01010],
	'(': [0b00010, 0b00100, 0b01000, 0b01000, 0b01000, 0b00100, 0b00010],
	')': [0b01000, 0b00100, 0b00010, 0b00010, 0b00010, 0b00100, 0b01000],
	'<': [0b00010, 0b00100, 0b01000, 0b10000, 0b01000, 0b00100, 0b00010],
	'>': [0b01000, 0b00100, 0b00010, 0b00001, 0b00010, 0b00100, 0b01000],
	// A heart, typed as *
	'*': [0b00000, 0b01010, 0b11111, 0b11111, 0b01110, 0b00100, 0b00000],
};

export const GLYPH_W = 5;
export const GLYPH_H = 7;
/** Advance per character: glyph plus a one-column gap */
export const CHAR_W = GLYPH_W + 1;

export function textWidth(text: string, scale = 1) {
	return text.length === 0 ? 0 : (text.length * CHAR_W - 1) * scale;
}

/** Stamp `text` onto `frame` with its top-left at (x0, y0); clipped to the frame */
export function drawText(frame: Uint8Array, cols: number, rows: number, text: string, x0: number, y0: number, scale = 1) {
	for (let c = 0; c < text.length; c++) {
		const glyph = GLYPHS[text[c]] ?? GLYPHS[' '];
		for (let gy = 0; gy < GLYPH_H; gy++) {
			const bits = glyph[gy];
			for (let gx = 0; gx < GLYPH_W; gx++) {
				if (!(bits & (0b10000 >> gx))) continue;
				for (let sy = 0; sy < scale; sy++) {
					for (let sx = 0; sx < scale; sx++) {
						const x = x0 + (c * CHAR_W + gx) * scale + sx;
						const y = y0 + gy * scale + sy;
						if (x >= 0 && x < cols && y >= 0 && y < rows) frame[y * cols + x] = 1;
					}
				}
			}
		}
	}
}

/* ---------------------------------------------------------------- 1-bit conversion */

/** Plain threshold: anything at least mid-gray becomes a yellow disc */
export function threshold(gray: Float32Array, out: Uint8Array) {
	for (let i = 0; i < gray.length; i++) out[i] = gray[i] >= 128 ? 1 : 0;
}

/**
 * Floyd–Steinberg dithering: the error of each rounding decision is pushed onto the pixels
 * not yet visited (right, lower-left, below, lower-right), so a mid-gray area comes out as
 * a checkerboard instead of a hard edge.
 */
export function floydSteinberg(gray: Float32Array, cols: number, rows: number, out: Uint8Array) {
	const buf = Float32Array.from(gray);
	for (let y = 0; y < rows; y++) {
		for (let x = 0; x < cols; x++) {
			const i = y * cols + x;
			const old = buf[i];
			const bit = old >= 128 ? 1 : 0;
			out[i] = bit;
			const err = old - (bit ? 255 : 0);
			if (x + 1 < cols) buf[i + 1] += (err * 7) / 16;
			if (y + 1 < rows) {
				if (x > 0) buf[i + cols - 1] += (err * 3) / 16;
				buf[i + cols] += (err * 5) / 16;
				if (x + 1 < cols) buf[i + cols + 1] += (err * 1) / 16;
			}
		}
	}
}

/** Stretch the 5th–95th percentile of `gray` to 0–255 so a dim webcam still reads as a face */
export function autoLevels(gray: Float32Array) {
	const hist = new Uint32Array(256);
	for (let i = 0; i < gray.length; i++) hist[Math.min(255, Math.max(0, gray[i] | 0))]++;
	const pick = (fraction: number) => {
		let acc = 0;
		const stop = gray.length * fraction;
		for (let v = 0; v < 256; v++) {
			acc += hist[v];
			if (acc >= stop) return v;
		}
		return 255;
	};
	const lo = pick(0.05);
	const hi = Math.max(pick(0.95), lo + 16);
	const scale = 255 / (hi - lo);
	for (let i = 0; i < gray.length; i++) gray[i] = Math.min(255, Math.max(0, (gray[i] - lo) * scale));
}

/** Luminance of an RGBA buffer into `gray`, in place-friendly for reuse */
export function luminance(rgba: Uint8ClampedArray, gray: Float32Array) {
	for (let i = 0, j = 0; j < gray.length; i += 4, j++) {
		gray[j] = rgba[i] * 0.299 + rgba[i + 1] * 0.587 + rgba[i + 2] * 0.114;
	}
}
