/**
 * The talking-piano widget: pick a movie line, see it as a piano roll,
 * hear it on the piano, then turn on the subtitles and hear it again.
 * Mounted from `astro:page-load` and torn down on `astro:before-swap`, because ClientRouter keeps
 * this module alive across navigations.
 */
import { GRAM_FPS, KEYS, decodeGram, score, type Chord, type Keygram } from './analysis.ts';
import { CLIPS, type Clip } from './clips.ts';
import grams from './grams.json';
import { render } from './synth.ts';

const KEYBOARD_W = 16;
/** Black keys within an octave starting at A (A0 is key 0) */
const BLACK = new Set([1, 4, 6, 9, 11]);

type Locale = 'ko' | 'en';

interface Source {
	id: string;
	gram: Keygram;
	clip: Clip;
}

class TalkingPiano {
	private readonly abort = new AbortController();
	private readonly canvas: HTMLCanvasElement;
	private readonly ctx2d: CanvasRenderingContext2D;
	private readonly layer = document.createElement('canvas');
	private readonly heat = document.createElement('canvas');
	private readonly resize: ResizeObserver;
	private readonly locale: Locale;
	private readonly el: {
		play: HTMLButtonElement;
		subs: HTMLButtonElement;
		line: HTMLElement;
		gloss: HTMLElement;
		source: HTMLAnchorElement;
		status: HTMLElement;
		fps: HTMLInputElement;
		voices: HTMLInputElement;
		fpsOut: HTMLElement;
		voicesOut: HTMLElement;
	};

	private audio: AudioContext | null = null;
	private playing: { node: AudioBufferSourceNode; startAt: number } | null = null;
	private rendered: { key: string; buffer: AudioBuffer } | null = null;
	private raf = 0;
	private src: Source;
	private chords: Chord[] = [];
	private fps = 40;
	private voices = 40;
	private accent = '#4fd1a5';

	constructor(private readonly root: HTMLElement) {
		this.locale = root.dataset.locale === 'en' ? 'en' : 'ko';
		this.canvas = root.querySelector('canvas')!;
		this.ctx2d = this.canvas.getContext('2d')!;
		const q = <T extends HTMLElement>(s: string) => root.querySelector<T>(s)!;
		this.el = {
			play: q('[data-play]'),
			subs: q('[data-subs]'),
			line: q('[data-line]'),
			gloss: q('[data-gloss]'),
			source: q('[data-source]'),
			status: q('[data-status]'),
			fps: q('[data-fps]'),
			voices: q('[data-voices]'),
			fpsOut: q('[data-fps-out]'),
			voicesOut: q('[data-voices-out]'),
		};
		this.accent = getComputedStyle(root).getPropertyValue('--accent').trim() || this.accent;
		this.fps = Number(this.el.fps.value);
		this.voices = Number(this.el.voices.value);
		this.src = this.clipSource(CLIPS[0]);

		const { signal } = this.abort;
		for (const button of root.querySelectorAll<HTMLButtonElement>('[data-clip]')) {
			button.addEventListener(
				'click',
				() => {
					const clip = CLIPS.find((c) => c.id === button.dataset.clip);
					if (clip) this.select(this.clipSource(clip));
				},
				{ signal },
			);
		}
		this.el.play.addEventListener('click', () => this.togglePlay(), { signal });
		this.el.subs.addEventListener(
			'click',
			() => {
				const on = this.el.subs.getAttribute('aria-pressed') !== 'true';
				this.el.subs.setAttribute('aria-pressed', String(on));
				root.classList.toggle('subs-on', on);
			},
			{ signal },
		);
		const onSlider = () => {
			this.fps = Number(this.el.fps.value);
			this.voices = Number(this.el.voices.value);
			this.el.fpsOut.textContent = String(this.fps);
			this.el.voicesOut.textContent = String(this.voices);
			this.stop();
			this.rescore();
		};
		this.el.fps.addEventListener('input', onSlider, { signal });
		this.el.voices.addEventListener('input', onSlider, { signal });

		this.resize = new ResizeObserver(() => this.layout());
		this.resize.observe(this.canvas);
		this.select(this.src);
	}

	destroy() {
		this.abort.abort();
		this.resize.disconnect();
		this.stop();
		this.audio?.close();
		this.audio = null;
	}

	/* ------------------------------------------------------------ sources */

	private clipSource(clip: Clip): Source {
		return { id: clip.id, clip, gram: decodeGram((grams as Record<string, string>)[clip.id]) };
	}

	private select(src: Source) {
		this.stop();
		this.src = src;
		for (const b of this.root.querySelectorAll<HTMLButtonElement>('[data-clip]')) {
			b.setAttribute('aria-pressed', String(b.dataset.clip === src.id));
		}
		for (const img of this.root.querySelectorAll<HTMLImageElement>('[data-scene]')) {
			img.hidden = img.dataset.scene !== src.id;
		}

		// Subtitles: one span per word, lit as the piano reaches it
		this.el.line.replaceChildren();
		for (const [time, text] of src.clip.words) {
			const span = document.createElement('span');
			span.textContent = text;
			span.dataset.time = String(time);
			this.el.line.append(span, ' ');
		}
		this.el.gloss.textContent = src.clip.gloss[this.locale] ?? '';
		this.el.gloss.hidden = !this.el.gloss.textContent;
		this.el.source.href = src.clip.source;
		this.status(src.clip.who[this.locale]);
		this.rescore();
	}

	private rescore() {
		this.chords = score(this.src.gram, { fps: this.fps, voices: this.voices });
		this.rendered = null;
		this.drawLayer();
		this.draw(-1);
	}

	/* ------------------------------------------------------------ audio */

	private ensureAudio() {
		if (!this.audio) this.audio = new AudioContext();
		if (this.audio.state === 'suspended') this.audio.resume();
		return this.audio;
	}

	private pianoBuffer(audio: AudioContext) {
		const key = `${this.src.id}:${this.fps}:${this.voices}:${this.src.gram.rows}`;
		if (this.rendered?.key !== key) {
			const samples = render(this.chords, this.fps, audio.sampleRate);
			const buffer = audio.createBuffer(1, samples.length, audio.sampleRate);
			buffer.copyToChannel(samples, 0);
			this.rendered = { key, buffer };
		}
		return this.rendered.buffer;
	}

	private togglePlay() {
		const was = this.playing;
		this.stop();
		if (was) return;
		const audio = this.ensureAudio();
		const buffer = this.pianoBuffer(audio);
		const node = audio.createBufferSource();
		node.buffer = buffer;
		node.connect(audio.destination);
		const startAt = audio.currentTime + 0.05;
		node.start(startAt);
		node.onended = () => {
			if (this.playing?.node === node) this.stop();
		};
		this.playing = { node, startAt };
		this.el.play.setAttribute('aria-pressed', 'true');
		const tick = () => {
			if (!this.playing || !this.audio) return;
			// outputLatency is what the speaker is behind the clock; not every browser reports it
			const t = this.audio.currentTime - this.playing.startAt - (this.audio.outputLatency || 0);
			this.draw(t);
			this.raf = requestAnimationFrame(tick);
		};
		this.raf = requestAnimationFrame(tick);
	}

	private stop() {
		if (this.playing) {
			this.playing.node.onended = null;
			try {
				this.playing.node.stop();
			} catch {
				/* already stopped */
			}
			this.playing = null;
		}
		cancelAnimationFrame(this.raf);
		this.el?.play.setAttribute('aria-pressed', 'false');
		if (this.chords) this.draw(-1);
	}

	/* ------------------------------------------------------------ drawing */

	private layout() {
		const dpr = Math.min(window.devicePixelRatio || 1, 2);
		const w = Math.round(this.canvas.clientWidth * dpr);
		const h = Math.round(this.canvas.clientHeight * dpr);
		if (!w || !h) return;
		if (this.canvas.width !== w || this.canvas.height !== h) {
			this.canvas.width = w;
			this.canvas.height = h;
			this.layer.width = w;
			this.layer.height = h;
			this.drawLayer();
			this.draw(-1);
		}
	}

	private get duration() {
		return Math.max(this.src.gram.rows / GRAM_FPS, 0.5);
	}

	/** The static picture: faint keygram underneath, the chords the piano plays on top */
	private drawLayer() {
		const { width: W, height: H } = this.layer;
		if (!W || !H) return;
		const g = this.layer.getContext('2d')!;
		const dpr = W / Math.max(1, this.canvas.clientWidth);
		const kw = KEYBOARD_W * dpr;
		const rollW = W - kw;
		const rowH = H / KEYS;

		g.fillStyle = '#0c0c0c';
		g.fillRect(0, 0, W, H);

		// Keygram as a tiny grayscale image, stretched
		const { gram } = this.src;
		this.heat.width = gram.rows;
		this.heat.height = KEYS;
		const hctx = this.heat.getContext('2d')!;
		const img = hctx.createImageData(gram.rows, KEYS);
		for (let r = 0; r < gram.rows; r++) {
			for (let k = 0; k < KEYS; k++) {
				const v = gram.data[r * KEYS + k] / 255;
				const p = ((KEYS - 1 - k) * gram.rows + r) * 4;
				img.data[p] = img.data[p + 1] = img.data[p + 2] = 200;
				img.data[p + 3] = Math.round(v ** 4 * 150);
			}
		}
		hctx.putImageData(img, 0, 0);
		g.imageSmoothingEnabled = true;
		g.drawImage(this.heat, kw, 0, rollW * (gram.rows / GRAM_FPS / this.duration), H);

		// Chords
		const slotW = (rollW / this.duration) / this.fps;
		g.fillStyle = this.accent;
		for (const chord of this.chords) {
			const x = kw + (chord.time / this.duration) * rollW;
			for (const n of chord.notes) {
				g.globalAlpha = 0.25 + 0.75 * n.vel;
				g.fillRect(x, H - (n.key + 1) * rowH, Math.max(1, slotW - dpr), Math.max(1, rowH - 0.3 * dpr));
			}
		}
		g.globalAlpha = 1;

		// Keyboard strip
		for (let k = 0; k < KEYS; k++) {
			g.fillStyle = BLACK.has(k % 12) ? '#222' : '#bbb';
			g.fillRect(0, H - (k + 1) * rowH, kw - 2 * dpr, rowH);
		}
		// C marks, so the strip reads as a keyboard
		g.fillStyle = '#666';
		for (let k = 3; k < KEYS; k += 12) g.fillRect(0, H - (k + 1) * rowH, kw - 2 * dpr, Math.max(1, dpr * 0.6));
	}

	/** t < 0 means not playing: everything is shown at full strength */
	private draw(t: number) {
		const { width: W, height: H } = this.canvas;
		if (!W || !H) return;
		const g = this.ctx2d;
		g.drawImage(this.layer, 0, 0);
		const dpr = W / Math.max(1, this.canvas.clientWidth);
		const kw = KEYBOARD_W * dpr;
		const rollW = W - kw;
		const rowH = H / KEYS;

		if (t >= 0) {
			const x = kw + Math.min(1, t / this.duration) * rollW;
			g.fillStyle = 'rgba(12,12,12,0.6)';
			g.fillRect(x, 0, W - x, H);
			g.fillStyle = '#fff';
			g.fillRect(x - dpr / 2, 0, dpr, H);

			// Keys being struck light up on the keyboard
			const chord = this.chords[Math.floor(t * this.fps)];
			if (chord) {
				g.fillStyle = this.accent;
				for (const n of chord.notes) {
					g.globalAlpha = 0.4 + 0.6 * n.vel;
					g.fillRect(0, H - (n.key + 1) * rowH, kw - 2 * dpr, rowH);
				}
				g.globalAlpha = 1;
			}
		}

		for (const span of this.el.line.querySelectorAll<HTMLElement>('span')) {
			span.classList.toggle('ahead', t >= 0 && Number(span.dataset.time) > t);
		}
	}

	private status(text: string) {
		this.el.status.textContent = text;
	}
}

/* ---------------------------------------------------------------- mount */

const mounted = new Map<HTMLElement, TalkingPiano>();

export function mountAll() {
	for (const root of document.querySelectorAll<HTMLElement>('[data-talking-piano]')) {
		if (!mounted.has(root)) mounted.set(root, new TalkingPiano(root));
	}
}

export function unmountAll() {
	for (const w of mounted.values()) w.destroy();
	mounted.clear();
}
