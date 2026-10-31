/**
 * Wires the flip-dot Board to a widget in the page: mode buttons, the four input sources
 * (clock, text, drawing, camera), the sound toggle and the dithering comparison.
 * Everything is mounted from `astro:page-load` and torn down on `astro:before-swap`,
 * because ClientRouter keeps this module alive across navigations.
 */
import {
	Board,
	CHAR_W,
	TAU,
	GLYPH_H,
	autoLevels,
	clicker,
	drawText,
	floydSteinberg,
	luminance,
	textWidth,
	threshold,
} from './engine';

const COLS = 84;
const ROWS = 28;

type Mode = 'clock' | 'text' | 'draw' | 'camera' | 'car';
type Dither = 'threshold' | 'fs';

/** Shown three at a time, like the airport wall that cycled through world cities */
const CITIES: [string, string][] = [
	['SEOUL', 'Asia/Seoul'],
	['NEW YORK', 'America/New_York'],
	['LONDON', 'Europe/London'],
	['TOKYO', 'Asia/Tokyo'],
	['PARIS', 'Europe/Paris'],
	['DUBAI', 'Asia/Dubai'],
	['SYDNEY', 'Australia/Sydney'],
	['BERLIN', 'Europe/Berlin'],
	['SAO PAULO', 'America/Sao_Paulo'],
	['SINGAPORE', 'Asia/Singapore'],
	['MOSCOW', 'Europe/Moscow'],
	['CHICAGO', 'America/Chicago'],
];
const CITY_PAGE = 3;
const CITY_PAGE_MS = 6000;

const timeFormats = new Map<string, Intl.DateTimeFormat>();
function localTime(zone: string, date: Date) {
	let fmt = timeFormats.get(zone);
	if (!fmt) {
		fmt = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: zone });
		timeFormats.set(zone, fmt);
	}
	return fmt.format(date);
}

/* ---------------------------------------------------------------- sources */

function clockFrame(frame: Uint8Array, date: Date) {
	frame.fill(0);
	const page = Math.floor(date.getTime() / CITY_PAGE_MS) % Math.ceil(CITIES.length / CITY_PAGE);
	// The colon blinks once a second, which gives the clock its soft tick
	const colon = date.getSeconds() % 2 === 0;
	for (let line = 0; line < CITY_PAGE; line++) {
		const city = CITIES[page * CITY_PAGE + line];
		if (!city) break;
		const y = 1 + line * (GLYPH_H + 2);
		let time = localTime(city[1], date);
		if (!colon) time = time.replace(':', ' ');
		drawText(frame, COLS, ROWS, city[0], 1, y);
		drawText(frame, COLS, ROWS, time, COLS - textWidth(time), y);
	}
}

/**
 * Anything outside the bitmap font (Korean, for instance) is drawn with the system font on
 * a board-sized canvas and thresholded. Rough, but it beats a blank board.
 */
let fontScratch: CanvasRenderingContext2D | null = null;
function systemFontFrame(frame: Uint8Array, text: string) {
	if (!fontScratch) {
		const canvas = document.createElement('canvas');
		canvas.width = COLS;
		canvas.height = ROWS;
		fontScratch = canvas.getContext('2d', { willReadFrequently: true })!;
	}
	const ctx = fontScratch;
	ctx.clearRect(0, 0, COLS, ROWS);
	ctx.fillStyle = '#fff';
	ctx.textBaseline = 'middle';
	ctx.textAlign = 'center';
	// Start tall and shrink until the text fits the board's width
	let size = 24;
	let shown = text;
	for (; size >= 12; size -= 2) {
		ctx.font = `bold ${size}px ${getComputedStyle(document.body).fontFamily}`;
		if (ctx.measureText(shown).width <= COLS - 2) break;
	}
	while (shown.length > 1 && ctx.measureText(shown).width > COLS - 2) shown = shown.slice(0, -1);
	ctx.fillText(shown, COLS / 2, ROWS / 2 + 1);
	const rgba = ctx.getImageData(0, 0, COLS, ROWS).data;
	for (let i = 0; i < frame.length; i++) frame[i] = rgba[i * 4 + 3] >= 128 ? 1 : 0;
}

function textFrame(frame: Uint8Array, raw: string) {
	frame.fill(0);
	if (/[^ -~]/.test(raw)) return systemFontFrame(frame, raw.trim());
	const text = raw.toUpperCase();
	const maxChars = Math.floor((COLS + 1) / CHAR_W);
	const lines: string[] = [];
	let current = '';
	for (const word of text.split(/\s+/).filter(Boolean)) {
		const chunks = word.match(new RegExp(`.{1,${maxChars}}`, 'g')) ?? [];
		for (const chunk of chunks) {
			if (current.length === 0) current = chunk;
			else if (current.length + 1 + chunk.length <= maxChars) current += ' ' + chunk;
			else {
				lines.push(current);
				current = chunk;
			}
		}
	}
	if (current) lines.push(current);
	const shown = lines.slice(0, 3);
	// A single short word gets drawn at double size
	const scale = shown.length === 1 && textWidth(shown[0], 2) <= COLS ? 2 : 1;
	const gap = 2;
	const total = shown.length * GLYPH_H * scale + (shown.length - 1) * gap;
	const y0 = Math.floor((ROWS - total) / 2);
	shown.forEach((line, i) => {
		const x0 = Math.floor((COLS - textWidth(line, scale)) / 2);
		drawText(frame, COLS, ROWS, line, x0, y0 + i * (GLYPH_H * scale + gap), scale);
	});
}

/** Webcam → 84×28 grayscale, auto-leveled and smoothed over time to calm sensor noise */
class Camera {
	readonly gray = new Float32Array(COLS * ROWS);
	private readonly video = document.createElement('video');
	private readonly scratch = document.createElement('canvas');
	private readonly ctx: CanvasRenderingContext2D;
	private readonly raw = new Float32Array(COLS * ROWS);
	private stream: MediaStream | null = null;
	private lastTime = -1;
	private primed = false;

	constructor() {
		this.video.muted = true;
		this.video.playsInline = true;
		this.scratch.width = COLS;
		this.scratch.height = ROWS;
		this.ctx = this.scratch.getContext('2d', { willReadFrequently: true })!;
	}

	async start() {
		this.stream = await navigator.mediaDevices.getUserMedia({
			video: { facingMode: 'user', width: { ideal: 320 }, height: { ideal: 240 } },
			audio: false,
		});
		this.video.srcObject = this.stream;
		await this.video.play();
	}

	stop() {
		this.stream?.getTracks().forEach((track) => track.stop());
		this.stream = null;
		this.video.srcObject = null;
		this.primed = false;
		this.lastTime = -1;
	}

	/** Pull the next frame into `gray`; false when the camera has nothing new yet */
	read() {
		const { video, ctx } = this;
		if (video.readyState < 2 || video.currentTime === this.lastTime) return false;
		this.lastTime = video.currentTime;
		// Center-crop the camera to the board's wide aspect and mirror it like a selfie
		const vw = video.videoWidth;
		const vh = video.videoHeight;
		let cw = vw;
		let ch = (vw * ROWS) / COLS;
		if (ch > vh) {
			ch = vh;
			cw = (vh * COLS) / ROWS;
		}
		ctx.save();
		ctx.translate(COLS, 0);
		ctx.scale(-1, 1);
		ctx.drawImage(video, (vw - cw) / 2, (vh - ch) / 2, cw, ch, 0, 0, COLS, ROWS);
		ctx.restore();
		luminance(ctx.getImageData(0, 0, COLS, ROWS).data, this.raw);
		autoLevels(this.raw);
		if (!this.primed) {
			this.gray.set(this.raw);
			this.primed = true;
		} else {
			for (let i = 0; i < this.gray.length; i++) this.gray[i] = this.gray[i] * 0.55 + this.raw[i] * 0.45;
		}
		return true;
	}
}

/* ---------------------------------------------------------------- IONIQ 5 N */

/**
 * Side view, nose to the right. `#` is a yellow disc; the black squares in the body are the
 * pixel lamps. Wheels are left out of the art and drawn separately so they can turn.
 */
const CAR_ART = [
	'..........................................................',
	'...#######................................................',
	'...##...##................................................',
	'........###############################...................',
	'.......##..#...........##...............#.................',
	'......##...#...........##.................#...............',
	'.....##....#...........##....................#............',
	'....##.....#...........##......................#..........',
	'...#########...........##.........................######..',
	'..######################################################..',
	'..#..#################################################..#.',
	'..#..######.....###########################.....######..#.',
	'..########.......#########################.......########.',
	'..#######.........#.....................#.........#######.',
	'..#######.........#######################.........#######.',
	'..#######.........#######################.........#######.',
	'..#######.........#######################.........#######.',
];
const CAR_W = CAR_ART[0].length;
/** Row of the board where the art's first row sits */
const CAR_TOP = 3;
const AXLES = [13, 45];
const AXLE_Y = 15;
const WHEEL_R = 4;
/** Pixel lamps: tail light and head light, as [x, y] of their top-left corner in the art */
const LAMPS: [number, number][] = [
	[3, 10],
	[54, 10],
];
const ROAD_Y = CAR_TOP + AXLE_Y + WHEEL_R + 2;

const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);
const easeIn = (t: number) => t * t * t;

/** The car drives in from the left, stops in the middle with its hazards on, then drives off */
class CarScene {
	private t = 0;
	private x = -CAR_W;
	private angle = 0;

	reset() {
		this.t = 0;
		this.x = -CAR_W;
	}

	step(dt: number, frame: Uint8Array) {
		this.t = (this.t + dt / 1000) % 7;
		const t = this.t;
		const center = Math.floor((COLS - CAR_W) / 2);
		let x: number;
		if (t < 2.4) x = -CAR_W + (center + CAR_W) * easeOut(t / 2.4);
		else if (t < 4.2) x = center;
		else if (t < 6.2) x = center + (COLS + 4 - center) * easeIn((t - 4.2) / 2);
		else x = COLS + 4;
		// Wheels roll with the ground: angle grows with distance over radius
		if (x > this.x) this.angle += (x - this.x) / WHEEL_R;
		this.x = x;
		const left = Math.round(x);
		const hazards = t >= 2.4 && t < 4.2 && Math.floor(t * 2) % 2 === 0;

		frame.fill(0);
		for (let xx = 0; xx < COLS; xx++) frame[ROAD_Y * COLS + xx] = 1;
		const set = (cx: number, cy: number) => {
			if (cx >= 0 && cx < COLS && cy >= 0 && cy < ROWS) frame[cy * COLS + cx] = 1;
		};
		CAR_ART.forEach((row, ry) => {
			for (let rx = 0; rx < row.length; rx++) if (row[rx] === '#') set(left + rx, CAR_TOP + ry);
		});
		if (hazards) {
			for (const [lx, ly] of LAMPS) {
				for (let dy = 0; dy < 2; dy++) for (let dx = 0; dx < 2; dx++) set(left + lx + dx, CAR_TOP + ly + dy);
			}
		}
		for (const ax of AXLES) {
			const wx = left + ax;
			const wy = CAR_TOP + AXLE_Y;
			for (let dy = -WHEEL_R; dy <= WHEEL_R; dy++) {
				for (let dx = -WHEEL_R; dx <= WHEEL_R; dx++) {
					const d = Math.hypot(dx, dy);
					if ((d >= WHEEL_R - 0.8 && d <= WHEEL_R + 0.4) || d < 0.8) set(wx + dx, wy + dy);
				}
			}
			// Three spokes
			for (let k = 0; k < 3; k++) {
				const a = this.angle + (k * TAU) / 3;
				for (let r = 1; r <= WHEEL_R - 1.2; r += 0.5) {
					set(Math.round(wx + Math.cos(a) * r), Math.round(wy + Math.sin(a) * r));
				}
			}
		}
	}
}

/* ---------------------------------------------------------------- shared loop helpers */

interface Widget {
	destroy(): void;
}

/** Runs `step` on animation frames only while `root` is on screen */
class Loop {
	private raf = 0;
	private last = 0;
	private readonly observer: IntersectionObserver;

	constructor(
		root: Element,
		private readonly step: (now: number, dt: number) => void,
	) {
		this.observer = new IntersectionObserver(([entry]) => {
			if (entry.isIntersecting) this.start();
			else this.stop();
		});
		this.observer.observe(root);
	}

	private start() {
		if (this.raf) return;
		this.last = performance.now();
		const frame = (now: number) => {
			this.raf = requestAnimationFrame(frame);
			const dt = now - this.last;
			this.last = now;
			this.step(now, dt);
		};
		this.raf = requestAnimationFrame(frame);
	}

	private stop() {
		cancelAnimationFrame(this.raf);
		this.raf = 0;
	}

	destroy() {
		this.stop();
		this.observer.disconnect();
	}
}

function formatCount(n: number) {
	return n.toLocaleString('en-US');
}

/* ---------------------------------------------------------------- the main demo */

class Demo implements Widget {
	private readonly board: Board;
	private readonly frame = new Uint8Array(COLS * ROWS);
	private readonly ones = new Uint8Array(COLS * ROWS).fill(1);
	private readonly loop: Loop;
	private readonly resize: ResizeObserver;
	private readonly camera = new Camera();
	private readonly car = new CarScene();
	private readonly bits = new Uint8Array(COLS * ROWS);
	private readonly abort = new AbortController();
	private mode: Mode = 'clock';
	private dither: Dither = 'threshold';
	private flashUntil = 0;
	private lastSecond = -1;
	private lastStatus = 0;
	private cameraState: 'off' | 'starting' | 'on' | 'failed' = 'off';
	private cameraError = '';
	private stroke: { value: number; last: { x: number; y: number } | null; radius: number } | null = null;

	private readonly canvas: HTMLCanvasElement;
	private readonly status: HTMLElement;
	private readonly input: HTMLInputElement;
	private readonly msg: DOMStringMap;

	constructor(private readonly root: HTMLElement) {
		this.canvas = root.querySelector('canvas')!;
		this.status = root.querySelector('[data-status]')!;
		this.input = root.querySelector('[data-text]')!;
		this.msg = root.dataset;
		this.board = new Board(this.canvas, COLS, ROWS, clicker);
		this.board.target = this.frame;
		this.resize = new ResizeObserver(() => this.board.resize());
		this.resize.observe(this.canvas);

		const { signal } = this.abort;
		const on = <K extends keyof HTMLElementEventMap>(
			el: EventTarget,
			type: K,
			fn: (e: HTMLElementEventMap[K]) => void,
			opts?: AddEventListenerOptions,
		) => el.addEventListener(type, fn as EventListener, { ...opts, signal });

		// Any press on the widget is the user gesture that lets the page make sound
		on(root, 'pointerdown', () => this.unlockSound(), { capture: true });
		on(root, 'keydown', () => this.unlockSound(), { capture: true });

		for (const button of root.querySelectorAll<HTMLButtonElement>('[data-mode]')) {
			on(button, 'click', () => this.setMode(button.dataset.mode as Mode));
		}
		for (const button of root.querySelectorAll<HTMLButtonElement>('[data-dither]')) {
			on(button, 'click', () => this.setDither(button.dataset.dither as Dither));
		}
		const sound = root.querySelector<HTMLButtonElement>('[data-sound]')!;
		sound.setAttribute('aria-pressed', String(clicker.enabled));
		on(sound, 'click', () => {
			clicker.enabled = !clicker.enabled;
			sound.setAttribute('aria-pressed', String(clicker.enabled));
			if (clicker.enabled) this.flash();
		});
		on(root.querySelector('[data-clear]')!, 'click', () => this.frame.fill(0));
		on(this.input, 'input', () => this.renderText());

		on(this.canvas, 'pointerdown', (e) => this.strokeStart(e as PointerEvent));
		on(this.canvas, 'pointermove', (e) => this.strokeMove(e as PointerEvent));
		on(this.canvas, 'pointerup', () => (this.stroke = null));
		on(this.canvas, 'pointercancel', () => (this.stroke = null));
		on(this.canvas, 'lostpointercapture', () => (this.stroke = null));

		this.setMode('clock');
		this.loop = new Loop(root, (now, dt) => this.step(now, dt));
	}

	destroy() {
		this.abort.abort();
		this.loop.destroy();
		this.resize.disconnect();
		this.camera.stop();
	}

	private unlockSound() {
		const was = clicker.unlocked;
		clicker.unlock();
		if (!was && clicker.enabled) this.flash();
	}

	/** Turn every disc yellow for a moment, then back: the test pattern a real sign runs at boot */
	private flash() {
		this.flashUntil = performance.now() + 450;
	}

	private setMode(mode: Mode) {
		if (mode === 'camera' && !navigator.mediaDevices?.getUserMedia) return;
		const previous = this.mode;
		this.mode = mode;
		for (const button of this.root.querySelectorAll<HTMLButtonElement>('[data-mode]')) {
			button.setAttribute('aria-pressed', String(button.dataset.mode === mode));
		}
		this.input.hidden = mode !== 'text';
		this.root.querySelector<HTMLElement>('[data-clear]')!.hidden = mode !== 'draw';
		this.root.querySelector<HTMLElement>('[data-dither-group]')!.hidden = mode !== 'camera';
		// In drawing mode a finger paints instead of scrolling the page
		this.canvas.style.touchAction = mode === 'draw' ? 'none' : '';
		this.canvas.style.cursor = mode === 'draw' ? 'crosshair' : '';
		this.stroke = null;

		if (previous === 'camera' && mode !== 'camera') {
			this.camera.stop();
			this.cameraState = 'off';
		}
		if (mode === 'camera' && this.cameraState === 'off') this.startCamera();
		if (mode === 'draw' && previous !== 'draw') this.frame.fill(0);
		if (mode === 'car') this.car.reset();
		if (mode === 'text') {
			this.renderText();
			this.input.focus({ preventScroll: true });
		}
		this.lastSecond = -1;
		this.showStatus(performance.now(), true);
	}

	private setDither(dither: Dither) {
		this.dither = dither;
		for (const button of this.root.querySelectorAll<HTMLButtonElement>('[data-dither]')) {
			button.setAttribute('aria-pressed', String(button.dataset.dither === dither));
		}
	}

	private async startCamera() {
		this.cameraState = 'starting';
		this.frame.fill(0);
		try {
			await this.camera.start();
			if (this.mode === 'camera') this.cameraState = 'on';
			else this.camera.stop();
		} catch (error) {
			this.cameraState = 'failed';
			this.cameraError = error instanceof Error ? error.name : String(error);
			this.showStatus(performance.now(), true);
		}
	}

	private renderText() {
		textFrame(this.frame, this.input.value || this.input.placeholder);
	}

	private strokeStart(e: PointerEvent) {
		if (this.mode !== 'draw') return;
		const cell = this.board.cellAt(e.clientX, e.clientY);
		if (!cell) return;
		this.canvas.setPointerCapture(e.pointerId);
		// Tapping a yellow disc starts an erasing stroke, a black one a painting stroke
		this.stroke = {
			value: this.frame[cell.y * COLS + cell.x] ? 0 : 1,
			last: null,
			radius: e.pointerType === 'touch' ? 1.3 : 0.6,
		};
		this.paint(cell.x + 0.5, cell.y + 0.5);
		e.preventDefault();
	}

	private strokeMove(e: PointerEvent) {
		if (!this.stroke) return;
		const rect = this.canvas.getBoundingClientRect();
		const pitch = rect.width / (COLS + 1);
		this.paint((e.clientX - rect.left) / pitch - 0.5, (e.clientY - rect.top) / pitch - 0.5);
	}

	/** Paint at a fractional cell position, filling in the gap since the previous sample */
	private paint(x: number, y: number) {
		const stroke = this.stroke!;
		const from = stroke.last ?? { x, y };
		const steps = Math.max(1, Math.ceil(Math.hypot(x - from.x, y - from.y) / 0.5));
		for (let s = 0; s <= steps; s++) {
			const px = from.x + ((x - from.x) * s) / steps;
			const py = from.y + ((y - from.y) * s) / steps;
			const r = stroke.radius;
			for (let cy = Math.floor(py - r); cy <= Math.ceil(py + r); cy++) {
				for (let cx = Math.floor(px - r); cx <= Math.ceil(px + r); cx++) {
					if (cx < 0 || cy < 0 || cx >= COLS || cy >= ROWS) continue;
					if (Math.hypot(cx + 0.5 - px, cy + 0.5 - py) <= r) this.frame[cy * COLS + cx] = stroke.value;
				}
			}
		}
		stroke.last = { x, y };
	}

	private step(now: number, dt: number) {
		if (this.mode === 'clock') {
			const date = new Date();
			if (date.getSeconds() !== this.lastSecond) {
				this.lastSecond = date.getSeconds();
				clockFrame(this.frame, date);
			}
		} else if (this.mode === 'car') {
			this.car.step(Math.min(dt, 50), this.frame);
		} else if (this.mode === 'camera' && this.cameraState === 'on' && this.camera.read()) {
			if (this.dither === 'fs') floydSteinberg(this.camera.gray, COLS, ROWS, this.frame);
			else threshold(this.camera.gray, this.frame);
		}
		this.board.target = now < this.flashUntil ? this.ones : this.frame;
		this.board.tick(now, dt);
		this.showStatus(now);
	}

	private showStatus(now: number, force = false) {
		if (!force && now - this.lastStatus < 250) return;
		this.lastStatus = now;
		const parts: string[] = [];
		if (this.mode === 'camera') {
			if (this.cameraState === 'starting') parts.push(this.msg.msgCameraWait ?? '');
			if (this.cameraState === 'failed') parts.push((this.msg.msgCameraFail ?? '') + ` (${this.cameraError})`);
			if (this.cameraState === 'on') parts.push(this.msg.msgCameraOn ?? '');
		}
		if (this.mode === 'draw') parts.push(this.msg.msgDraw ?? '');
		if (!clicker.unlocked && clicker.enabled) parts.push(this.msg.msgUnlock ?? '');
		parts.push((this.msg.msgFlips ?? '{n}').replace('{n}', formatCount(this.board.flips)));
		const text = parts.filter(Boolean).join(' · ');
		if (this.status.textContent !== text) this.status.textContent = text;
	}
}

/* ---------------------------------------------------------------- threshold vs dithering */

const CMP_COLS = 40;
const CMP_ROWS = 28;

/** A gray ramp with a lit sphere on it: smooth tones that a plain threshold destroys */
function scene() {
	const gray = new Float32Array(CMP_COLS * CMP_ROWS);
	const r = CMP_ROWS * 0.4;
	const len = Math.hypot(-0.5, -0.6, 0.75);
	const light = [-0.5 / len, -0.6 / len, 0.75 / len];
	for (let y = 0; y < CMP_ROWS; y++) {
		for (let x = 0; x < CMP_COLS; x++) {
			let g = 20 + (215 * (x + 0.5)) / CMP_COLS;
			const dx = (x + 0.5 - CMP_COLS / 2) / r;
			const dy = (y + 0.5 - CMP_ROWS / 2) / r;
			const d2 = dx * dx + dy * dy;
			if (d2 < 1) {
				const nz = Math.sqrt(1 - d2);
				const lambert = Math.max(0, dx * light[0] + dy * light[1] + nz * light[2]);
				g = 10 + 240 * Math.pow(lambert, 1.3);
			}
			gray[y * CMP_COLS + x] = g;
		}
	}
	return gray;
}

class Compare implements Widget {
	private readonly boards: Board[];
	private readonly frames: Uint8Array[];
	private readonly blank = new Uint8Array(CMP_COLS * CMP_ROWS);
	private readonly loop: Loop;
	private readonly resize: ResizeObserver;
	private readonly abort = new AbortController();
	private blankUntil = 0;

	constructor(root: HTMLElement) {
		const gray = scene();
		const canvases = [...root.querySelectorAll<HTMLCanvasElement>('canvas')];
		this.boards = canvases.map((canvas) => new Board(canvas, CMP_COLS, CMP_ROWS, clicker));
		this.frames = canvases.map((canvas) => {
			const out = new Uint8Array(CMP_COLS * CMP_ROWS);
			if (canvas.dataset.which === 'fs') floydSteinberg(gray, CMP_COLS, CMP_ROWS, out);
			else threshold(gray, out);
			return out;
		});
		this.resize = new ResizeObserver(() => this.boards.forEach((b) => b.resize()));
		canvases.forEach((c) => this.resize.observe(c));
		root.querySelector('[data-replay]')?.addEventListener(
			'click',
			() => {
				clicker.unlock();
				this.blankUntil = performance.now() + 600;
			},
			{ signal: this.abort.signal },
		);
		this.loop = new Loop(root, (now, dt) => {
			const blank = now < this.blankUntil;
			this.boards.forEach((board, i) => {
				board.target = blank ? this.blank : this.frames[i];
				board.tick(now, dt);
			});
		});
	}

	destroy() {
		this.abort.abort();
		this.loop.destroy();
		this.resize.disconnect();
	}
}

/* ---------------------------------------------------------------- mounting */

const mounted = new Map<HTMLElement, Widget>();

export function mountAll() {
	for (const root of document.querySelectorAll<HTMLElement>('[data-flipdot]')) {
		if (mounted.has(root)) continue;
		mounted.set(root, root.dataset.flipdot === 'compare' ? new Compare(root) : new Demo(root));
	}
}

export function unmountAll() {
	for (const widget of mounted.values()) widget.destroy();
	mounted.clear();
}
