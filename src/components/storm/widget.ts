/**
 * A paper doll in a school uniform that dances the "Storm" choreography with your face on it.
 *
 * The motion is a list of 2D joint positions pulled from the music video with MediaPipe Pose
 * (see dance.json). Only the *angles* of the bones are taken from that data; the doll has
 * fixed limb lengths, so it is a puppet driven by joint angles rather than a tracing of the
 * video. The face is cut out of a photo in the browser and never leaves it.
 */
import dance from './dance.json';

const TAU = Math.PI * 2;

/* ---------------------------------------------------------------- data */

const J = Object.fromEntries(dance.joints.map((name, i) => [name, i])) as Record<(typeof dance.joints)[number], number>;
const STRIDE = dance.joints.length * 3;
const FPS = dance.fps;
const ASPECT = dance.aspect;

interface Clip {
	n: number;
	d: number[];
}
const clips: Clip[] = dance.clips;
const totalFrames = clips.reduce((sum, c) => sum + c.n, 0);

/** x in video aspect units (so angles are not distorted), y in 0..1, visibility 0..1 */
function joint(frame: number, name: keyof typeof J): [number, number, number] {
	let f = ((frame % totalFrames) + totalFrames) % totalFrames;
	for (const clip of clips) {
		if (f < clip.n) {
			const o = f * STRIDE + J[name] * 3;
			return [(clip.d[o] / 1000) * ASPECT, clip.d[o + 1] / 1000, clip.d[o + 2] / 100];
		}
		f -= clip.n;
	}
	return [0, 0, 0];
}

/* ---------------------------------------------------------------- rig */

/** Bone lengths relative to shoulder width = 1 */
const RIG = {
	shoulderHalf: 0.5,
	hipHalf: 0.36,
	torso: 1.25,
	neck: 0.22,
	headRadius: 0.46,
	upperArm: 0.78,
	foreArm: 0.72,
	thigh: 1.0,
	shin: 0.95,
};

interface Pose {
	/** every point in doll units, origin at the hip centre, y down */
	hipL: [number, number];
	hipR: [number, number];
	shoulderL: [number, number];
	shoulderR: [number, number];
	neck: [number, number];
	head: [number, number];
	headAngle: number;
	headTurn: number;
	elbowL: [number, number];
	elbowR: [number, number];
	wristL: [number, number];
	wristR: [number, number];
	kneeL: [number, number];
	kneeR: [number, number];
	ankleL: [number, number];
	ankleR: [number, number];
	/** how far the hips moved sideways in the video, in shoulder widths */
	sway: number;
	bob: number;
}

const angleOf = (a: [number, number, number], b: [number, number, number]) => Math.atan2(b[1] - a[1], b[0] - a[0]);
const polar = (from: [number, number], angle: number, len: number): [number, number] => [
	from[0] + Math.cos(angle) * len,
	from[1] + Math.sin(angle) * len,
];

/** Angles that persist while a joint is hidden, so a limb out of frame holds instead of flailing */
class AngleMemory {
	private held = new Map<string, number>();
	get(key: string, a: [number, number, number], b: [number, number, number], fallback: number) {
		if (a[2] > 0.45 && b[2] > 0.45) {
			const angle = angleOf(a, b);
			this.held.set(key, angle);
			return angle;
		}
		return this.held.get(key) ?? fallback;
	}
}

function solve(frame: number, mem: AngleMemory): Pose {
	const nose = joint(frame, 'nose');
	const earL = joint(frame, 'earL');
	const earR = joint(frame, 'earR');
	const sL = joint(frame, 'shoulderL');
	const sR = joint(frame, 'shoulderR');
	const hL = joint(frame, 'hipL');
	const hR = joint(frame, 'hipR');
	const shoulderC: [number, number, number] = [(sL[0] + sR[0]) / 2, (sL[1] + sR[1]) / 2, Math.min(sL[2], sR[2])];
	const hipC: [number, number, number] = [(hL[0] + hR[0]) / 2, (hL[1] + hR[1]) / 2, Math.min(hL[2], hR[2])];
	const shoulderW = Math.max(Math.hypot(sL[0] - sR[0], sL[1] - sR[1]), 0.02);

	const torsoAngle = mem.get('torso', hipC, shoulderC, -Math.PI / 2);
	const shoulderAngle = mem.get('shoulders', sR, sL, 0);
	const hipAngle = mem.get('hips', hR, hL, 0);

	const origin: [number, number] = [0, 0];
	const hipL = polar(origin, hipAngle, RIG.hipHalf);
	const hipR = polar(origin, hipAngle + Math.PI, RIG.hipHalf);
	const neckBase = polar(origin, torsoAngle, RIG.torso);
	const shoulderL = polar(neckBase, shoulderAngle, RIG.shoulderHalf);
	const shoulderR = polar(neckBase, shoulderAngle + Math.PI, RIG.shoulderHalf);

	const earAngle = mem.get('ears', earR, earL, 0);
	const earC: [number, number, number] = [(earL[0] + earR[0]) / 2, (earL[1] + earR[1]) / 2, Math.min(earL[2], earR[2])];
	const neckAngle = mem.get('neck', shoulderC, earC, torsoAngle);
	const neck = polar(neckBase, neckAngle, RIG.neck);
	const head = polar(neck, neckAngle, RIG.headRadius * 0.9);
	// Nose offset from the ear line says which way the head is turned
	const earDist = Math.max(Math.hypot(earL[0] - earR[0], earL[1] - earR[1]), 0.01);
	const headTurn = Math.max(-1, Math.min(1, ((nose[0] - earC[0]) / earDist) * 2));

	const upperL = mem.get('upperL', sL, joint(frame, 'elbowL'), Math.PI / 2 + 0.3);
	const upperR = mem.get('upperR', sR, joint(frame, 'elbowR'), Math.PI / 2 - 0.3);
	const foreL = mem.get('foreL', joint(frame, 'elbowL'), joint(frame, 'wristL'), upperL);
	const foreR = mem.get('foreR', joint(frame, 'elbowR'), joint(frame, 'wristR'), upperR);
	const elbowL = polar(shoulderL, upperL, RIG.upperArm);
	const elbowR = polar(shoulderR, upperR, RIG.upperArm);
	const wristL = polar(elbowL, foreL, RIG.foreArm);
	const wristR = polar(elbowR, foreR, RIG.foreArm);

	const thighL = mem.get('thighL', hL, joint(frame, 'kneeL'), Math.PI / 2 + 0.08);
	const thighR = mem.get('thighR', hR, joint(frame, 'kneeR'), Math.PI / 2 - 0.08);
	const shinL = mem.get('shinL', joint(frame, 'kneeL'), joint(frame, 'ankleL'), Math.PI / 2);
	const shinR = mem.get('shinR', joint(frame, 'kneeR'), joint(frame, 'ankleR'), Math.PI / 2);
	const kneeL = polar(hipL, thighL, RIG.thigh);
	const kneeR = polar(hipR, thighR, RIG.thigh);
	const ankleL = polar(kneeL, shinL, RIG.shin);
	const ankleR = polar(kneeR, shinR, RIG.shin);

	return {
		hipL, hipR, shoulderL, shoulderR, neck, head,
		headAngle: earAngle, headTurn,
		elbowL, elbowR, wristL, wristR, kneeL, kneeR, ankleL, ankleR,
		sway: (hipC[0] - ASPECT / 2) / shoulderW,
		bob: hipC[1],
	};
}

/* ---------------------------------------------------------------- drawing */

const COLORS = {
	bg: '#1f2126',
	floor: '#2a2d34',
	shirt: '#f4f1ea',
	shirtShade: '#d9d4c8',
	blazer: '#1c2233',
	tie: '#2b3f66',
	trousers: '#23262e',
	skin: '#e8c4a8',
	shoe: '#111',
	outline: '#0e0f12',
	paper: '#fffdf5',
};

interface DollStyle {
	/** shoulder width in canvas pixels */
	scale: number;
	blazer: boolean;
	tint: number;
}

function limb(ctx: CanvasRenderingContext2D, a: [number, number], b: [number, number], width: number, color: string) {
	ctx.strokeStyle = COLORS.outline;
	ctx.lineWidth = width + 3;
	ctx.lineCap = 'round';
	ctx.beginPath();
	ctx.moveTo(a[0], a[1]);
	ctx.lineTo(b[0], b[1]);
	ctx.stroke();
	ctx.strokeStyle = color;
	ctx.lineWidth = width;
	ctx.stroke();
}

function dot(ctx: CanvasRenderingContext2D, p: [number, number], r: number, color: string) {
	ctx.fillStyle = COLORS.outline;
	ctx.beginPath();
	ctx.arc(p[0], p[1], r + 1.5, 0, TAU);
	ctx.fill();
	ctx.fillStyle = color;
	ctx.beginPath();
	ctx.arc(p[0], p[1], r, 0, TAU);
	ctx.fill();
}

function drawDoll(ctx: CanvasRenderingContext2D, pose: Pose, face: HTMLCanvasElement, style: DollStyle, x: number, y: number) {
	const s = style.scale;
	const P = (p: [number, number]): [number, number] => [x + p[0] * s, y + p[1] * s];
	const armW = s * 0.26;
	const legW = s * 0.3;
	const top = style.blazer ? COLORS.blazer : COLORS.shirt;

	ctx.save();
	if (style.tint < 1) ctx.globalAlpha = style.tint;

	// Legs first so the torso sits on top of them
	limb(ctx, P(pose.hipL), P(pose.kneeL), legW, COLORS.trousers);
	limb(ctx, P(pose.kneeL), P(pose.ankleL), legW * 0.9, COLORS.trousers);
	limb(ctx, P(pose.hipR), P(pose.kneeR), legW, COLORS.trousers);
	limb(ctx, P(pose.kneeR), P(pose.ankleR), legW * 0.9, COLORS.trousers);
	for (const ankle of [pose.ankleL, pose.ankleR]) {
		const a = P(ankle);
		ctx.fillStyle = COLORS.outline;
		ctx.beginPath();
		ctx.ellipse(a[0], a[1] + s * 0.05, s * 0.24, s * 0.12, 0, 0, TAU);
		ctx.fill();
		ctx.fillStyle = COLORS.shoe;
		ctx.beginPath();
		ctx.ellipse(a[0], a[1] + s * 0.05, s * 0.21, s * 0.095, 0, 0, TAU);
		ctx.fill();
	}

	// Arms behind the torso
	limb(ctx, P(pose.shoulderL), P(pose.elbowL), armW, top);
	limb(ctx, P(pose.elbowL), P(pose.wristL), armW * 0.9, top);
	limb(ctx, P(pose.shoulderR), P(pose.elbowR), armW, top);
	limb(ctx, P(pose.elbowR), P(pose.wristR), armW * 0.9, top);
	dot(ctx, P(pose.wristL), s * 0.14, COLORS.skin);
	dot(ctx, P(pose.wristR), s * 0.14, COLORS.skin);

	// Torso: a shirt (or blazer) cut from paper
	const sl = P(pose.shoulderL);
	const sr = P(pose.shoulderR);
	const hl = P(pose.hipL);
	const hr = P(pose.hipR);
	ctx.fillStyle = top;
	ctx.strokeStyle = COLORS.outline;
	ctx.lineWidth = 3;
	ctx.lineJoin = 'round';
	ctx.beginPath();
	ctx.moveTo(sl[0], sl[1] - s * 0.1);
	ctx.lineTo(sr[0], sr[1] - s * 0.1);
	ctx.lineTo(hr[0], hr[1] + s * 0.1);
	ctx.lineTo(hl[0], hl[1] + s * 0.1);
	ctx.closePath();
	ctx.fill();
	ctx.stroke();
	// Collar and tie
	const nk = P(pose.neck);
	const mid: [number, number] = [(hl[0] + hr[0]) / 2, (hl[1] + hr[1]) / 2];
	const tieEnd: [number, number] = [nk[0] + (mid[0] - nk[0]) * 0.75, nk[1] + (mid[1] - nk[1]) * 0.75];
	ctx.fillStyle = style.blazer ? COLORS.shirt : COLORS.shirtShade;
	ctx.beginPath();
	ctx.moveTo(nk[0] - s * 0.18, nk[1] + s * 0.02);
	ctx.lineTo(nk[0] + s * 0.18, nk[1] + s * 0.02);
	ctx.lineTo(nk[0], nk[1] + s * 0.32);
	ctx.closePath();
	ctx.fill();
	ctx.fillStyle = COLORS.tie;
	ctx.beginPath();
	ctx.moveTo(nk[0] - s * 0.07, nk[1] + s * 0.06);
	ctx.lineTo(nk[0] + s * 0.07, nk[1] + s * 0.06);
	ctx.lineTo(tieEnd[0] + s * 0.09, tieEnd[1]);
	ctx.lineTo(tieEnd[0], tieEnd[1] + s * 0.12);
	ctx.lineTo(tieEnd[0] - s * 0.09, tieEnd[1]);
	ctx.closePath();
	ctx.fill();

	// Neck, then the face glued on top with a paper edge
	limb(ctx, P(pose.neck), P(pose.head), s * 0.22, COLORS.skin);
	const hc = P(pose.head);
	const r = RIG.headRadius * s;
	ctx.save();
	ctx.translate(hc[0], hc[1]);
	ctx.rotate(pose.headAngle);
	// A turned head is a narrower cut-out shifted toward the nose
	const squeeze = 1 - Math.abs(pose.headTurn) * 0.18;
	ctx.translate(pose.headTurn * r * 0.12, 0);
	ctx.scale(squeeze, 1);
	ctx.fillStyle = COLORS.paper;
	ctx.strokeStyle = COLORS.outline;
	ctx.lineWidth = 3;
	ctx.beginPath();
	ctx.ellipse(0, 0, r * 1.08, r * 1.28, 0, 0, TAU);
	ctx.fill();
	ctx.stroke();
	ctx.beginPath();
	ctx.ellipse(0, 0, r, r * 1.2, 0, 0, TAU);
	ctx.clip();
	ctx.drawImage(face, -r, -r * 1.2, r * 2, r * 2.4);
	ctx.restore();

	ctx.restore();
}

/** Raw joints as a stick figure, for the "what the model actually gives you" view */
function drawSkeleton(ctx: CanvasRenderingContext2D, frame: number, x: number, y: number, w: number, h: number) {
	const pt = (name: keyof typeof J): [number, number, number] => {
		const j = joint(frame, name);
		return [x + (j[0] / ASPECT) * w, y + j[1] * h, j[2]];
	};
	const bones: [keyof typeof J, keyof typeof J][] = [
		['shoulderL', 'shoulderR'], ['shoulderL', 'elbowL'], ['elbowL', 'wristL'], ['shoulderR', 'elbowR'], ['elbowR', 'wristR'],
		['shoulderL', 'hipL'], ['shoulderR', 'hipR'], ['hipL', 'hipR'], ['hipL', 'kneeL'], ['kneeL', 'ankleL'],
		['hipR', 'kneeR'], ['kneeR', 'ankleR'], ['earL', 'earR'], ['nose', 'earL'], ['nose', 'earR'],
	];
	ctx.save();
	ctx.fillStyle = COLORS.floor;
	ctx.fillRect(x, y, w, h);
	ctx.lineWidth = 2;
	for (const [a, b] of bones) {
		const pa = pt(a);
		const pb = pt(b);
		ctx.strokeStyle = `rgba(120, 200, 255, ${Math.min(pa[2], pb[2])})`;
		ctx.beginPath();
		ctx.moveTo(pa[0], pa[1]);
		ctx.lineTo(pb[0], pb[1]);
		ctx.stroke();
	}
	for (const name of dance.joints) {
		const p = pt(name);
		ctx.fillStyle = `rgba(255, 220, 90, ${p[2]})`;
		ctx.beginPath();
		ctx.arc(p[0], p[1], 3, 0, TAU);
		ctx.fill();
	}
	ctx.restore();
}

/* ---------------------------------------------------------------- face cut-out */

const FACE_W = 200;
const FACE_H = 240;

/** A placeholder face so the doll dances before a photo is chosen */
function placeholderFace() {
	const c = document.createElement('canvas');
	c.width = FACE_W;
	c.height = FACE_H;
	const ctx = c.getContext('2d')!;
	ctx.fillStyle = COLORS.skin;
	ctx.fillRect(0, 0, FACE_W, FACE_H);
	ctx.fillStyle = COLORS.outline;
	ctx.beginPath();
	ctx.arc(FACE_W * 0.36, FACE_H * 0.42, 7, 0, TAU);
	ctx.arc(FACE_W * 0.64, FACE_H * 0.42, 7, 0, TAU);
	ctx.fill();
	ctx.lineWidth = 5;
	ctx.strokeStyle = COLORS.outline;
	ctx.beginPath();
	ctx.moveTo(FACE_W * 0.38, FACE_H * 0.66);
	ctx.lineTo(FACE_W * 0.62, FACE_H * 0.66);
	ctx.stroke();
	ctx.fillStyle = '#5a3a2a';
	ctx.beginPath();
	ctx.ellipse(FACE_W / 2, FACE_H * 0.12, FACE_W * 0.52, FACE_H * 0.2, 0, Math.PI, TAU);
	ctx.fill();
	return c;
}

/** Lets the user drag and zoom a photo under an oval, then cuts the oval out */
class Cropper {
	private readonly ctx: CanvasRenderingContext2D;
	private image: HTMLImageElement | null = null;
	private zoom = 1;
	private cx = 0;
	private cy = 0;
	private drag: { x: number; y: number; cx: number; cy: number } | null = null;
	private pinch: { dist: number; zoom: number } | null = null;
	private readonly pointers = new Map<number, [number, number]>();

	constructor(
		readonly canvas: HTMLCanvasElement,
		private readonly zoomInput: HTMLInputElement,
		private readonly signal: AbortSignal,
	) {
		canvas.width = 320;
		canvas.height = 320;
		this.ctx = canvas.getContext('2d')!;
		const opts = { signal };
		canvas.addEventListener('pointerdown', (e) => this.down(e), opts);
		canvas.addEventListener('pointermove', (e) => this.move(e), opts);
		canvas.addEventListener('pointerup', (e) => this.up(e), opts);
		canvas.addEventListener('pointercancel', (e) => this.up(e), opts);
		canvas.addEventListener('wheel', (e) => {
			e.preventDefault();
			this.setZoom(this.zoom * (e.deltaY < 0 ? 1.08 : 0.93));
		}, { ...opts, passive: false });
		zoomInput.addEventListener('input', () => this.setZoom(Number(zoomInput.value)), opts);
	}

	load(image: HTMLImageElement) {
		this.image = image;
		// Start with the photo filling the oval's height
		this.zoom = Math.max(this.canvas.width / image.width, this.canvas.height / image.height) * 1.1;
		this.cx = image.width / 2;
		this.cy = image.height / 2.4;
		this.zoomInput.min = String(this.zoom * 0.5);
		this.zoomInput.max = String(this.zoom * 5);
		this.zoomInput.step = 'any';
		this.zoomInput.value = String(this.zoom);
		this.draw();
	}

	private setZoom(z: number) {
		this.zoom = Math.max(Number(this.zoomInput.min), Math.min(Number(this.zoomInput.max), z));
		this.zoomInput.value = String(this.zoom);
		this.draw();
	}

	private pos(e: PointerEvent): [number, number] {
		const rect = this.canvas.getBoundingClientRect();
		const k = this.canvas.width / rect.width;
		return [(e.clientX - rect.left) * k, (e.clientY - rect.top) * k];
	}

	private down(e: PointerEvent) {
		this.canvas.setPointerCapture(e.pointerId);
		this.pointers.set(e.pointerId, this.pos(e));
		if (this.pointers.size === 1) {
			const [x, y] = this.pos(e);
			this.drag = { x, y, cx: this.cx, cy: this.cy };
		} else if (this.pointers.size === 2) {
			const [a, b] = [...this.pointers.values()];
			this.pinch = { dist: Math.hypot(a[0] - b[0], a[1] - b[1]), zoom: this.zoom };
			this.drag = null;
		}
		e.preventDefault();
	}

	private move(e: PointerEvent) {
		if (!this.pointers.has(e.pointerId)) return;
		this.pointers.set(e.pointerId, this.pos(e));
		if (this.pinch && this.pointers.size >= 2) {
			const [a, b] = [...this.pointers.values()];
			this.setZoom((this.pinch.zoom * Math.hypot(a[0] - b[0], a[1] - b[1])) / this.pinch.dist);
		} else if (this.drag) {
			const [x, y] = this.pos(e);
			this.cx = this.drag.cx - (x - this.drag.x) / this.zoom;
			this.cy = this.drag.cy - (y - this.drag.y) / this.zoom;
			this.draw();
		}
	}

	private up(e: PointerEvent) {
		this.pointers.delete(e.pointerId);
		if (this.pointers.size < 2) this.pinch = null;
		if (this.pointers.size === 0) this.drag = null;
	}

	draw() {
		const { ctx, canvas } = this;
		ctx.clearRect(0, 0, canvas.width, canvas.height);
		if (!this.image) return;
		ctx.save();
		ctx.translate(canvas.width / 2, canvas.height / 2);
		ctx.scale(this.zoom, this.zoom);
		ctx.drawImage(this.image, -this.cx, -this.cy);
		ctx.restore();
		// Dim everything outside the oval
		ctx.save();
		ctx.beginPath();
		ctx.rect(0, 0, canvas.width, canvas.height);
		ctx.ellipse(canvas.width / 2, canvas.height / 2, FACE_W / 2 * 1.25, FACE_H / 2 * 1.25, 0, 0, TAU);
		ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
		ctx.fill('evenodd');
		ctx.strokeStyle = '#fff';
		ctx.lineWidth = 2;
		ctx.setLineDash([6, 4]);
		ctx.beginPath();
		ctx.ellipse(canvas.width / 2, canvas.height / 2, FACE_W / 2 * 1.25, FACE_H / 2 * 1.25, 0, 0, TAU);
		ctx.stroke();
		ctx.restore();
	}

	/** The oval region as its own canvas, feathered at the edge */
	cut() {
		const out = document.createElement('canvas');
		out.width = FACE_W;
		out.height = FACE_H;
		const ctx = out.getContext('2d')!;
		if (!this.image) return out;
		const k = 1 / 1.25;
		ctx.save();
		ctx.translate(FACE_W / 2, FACE_H / 2);
		ctx.scale(this.zoom * k, this.zoom * k);
		ctx.drawImage(this.image, -this.cx, -this.cy);
		ctx.restore();
		ctx.globalCompositeOperation = 'destination-in';
		const g = ctx.createRadialGradient(FACE_W / 2, FACE_H / 2, 0, FACE_W / 2, FACE_H / 2, FACE_H / 2);
		g.addColorStop(0.88, 'rgba(0,0,0,1)');
		g.addColorStop(1, 'rgba(0,0,0,0)');
		ctx.fillStyle = g;
		ctx.save();
		ctx.translate(FACE_W / 2, FACE_H / 2);
		ctx.scale(FACE_W / FACE_H, 1);
		ctx.translate(-FACE_W / 2, -FACE_H / 2);
		ctx.fillRect(-FACE_W, -FACE_H, FACE_W * 3, FACE_H * 3);
		ctx.restore();
		return out;
	}
}

/* ---------------------------------------------------------------- widget */

interface Widget {
	destroy(): void;
}

class Storm implements Widget {
	private readonly canvas: HTMLCanvasElement;
	private readonly ctx: CanvasRenderingContext2D;
	private readonly abort = new AbortController();
	private readonly observer: IntersectionObserver;
	private readonly resize: ResizeObserver;
	private readonly cropper: Cropper;
	private readonly mem = new AngleMemory();
	private readonly crowdMem: AngleMemory[] = [];
	private face = placeholderFace();
	private raf = 0;
	private start = 0;
	private crowd = true;
	private skeleton = false;
	private width = 0;
	private height = 0;

	constructor(private readonly root: HTMLElement) {
		this.canvas = root.querySelector('canvas[data-stage]')!;
		this.ctx = this.canvas.getContext('2d')!;
		const { signal } = this.abort;
		const q = <T extends HTMLElement>(sel: string) => root.querySelector<T>(sel)!;

		this.cropper = new Cropper(q('canvas[data-crop]'), q('[data-zoom]'), signal);
		const file = q<HTMLInputElement>('[data-file]');
		file.addEventListener('change', () => this.pick(file), { signal });
		q('[data-ok]').addEventListener('click', () => this.confirm(), { signal });
		q('[data-cancel]').addEventListener('click', () => this.closeCropper(), { signal });
		q('[data-reset]').addEventListener('click', () => {
			this.face = placeholderFace();
		}, { signal });
		const crowd = q<HTMLInputElement>('[data-crowd]');
		crowd.addEventListener('change', () => (this.crowd = crowd.checked), { signal });
		const skel = q<HTMLInputElement>('[data-skeleton]');
		skel.addEventListener('change', () => (this.skeleton = skel.checked), { signal });

		this.resize = new ResizeObserver(() => this.fit());
		this.resize.observe(this.canvas);
		this.fit();
		this.observer = new IntersectionObserver(([entry]) => (entry.isIntersecting ? this.play() : this.pause()));
		this.observer.observe(root);
	}

	destroy() {
		this.abort.abort();
		this.pause();
		this.observer.disconnect();
		this.resize.disconnect();
	}

	private fit() {
		const dpr = Math.min(window.devicePixelRatio || 1, 2);
		const w = this.canvas.clientWidth;
		if (!w) return;
		this.width = w;
		this.height = Math.round(w * 0.62);
		this.canvas.width = Math.round(w * dpr);
		this.canvas.height = Math.round(this.height * dpr);
		this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
	}

	private pick(input: HTMLInputElement) {
		const f = input.files?.[0];
		if (!f) return;
		const url = URL.createObjectURL(f);
		const img = new Image();
		img.onload = () => {
			URL.revokeObjectURL(url);
			this.cropper.load(img);
			this.root.querySelector<HTMLElement>('[data-cropper]')!.hidden = false;
		};
		img.src = url;
		input.value = '';
	}

	private confirm() {
		this.face = this.cropper.cut();
		this.closeCropper();
	}

	private closeCropper() {
		this.root.querySelector<HTMLElement>('[data-cropper]')!.hidden = true;
	}

	private play() {
		if (this.raf) return;
		this.start = performance.now();
		const tick = (now: number) => {
			this.raf = requestAnimationFrame(tick);
			this.draw(((now - this.start) / 1000) * FPS);
		};
		this.raf = requestAnimationFrame(tick);
	}

	private pause() {
		cancelAnimationFrame(this.raf);
		this.raf = 0;
	}

	private draw(frame: number) {
		const { ctx, width: w, height: h } = this;
		ctx.fillStyle = COLORS.bg;
		ctx.fillRect(0, 0, w, h);
		ctx.fillStyle = COLORS.floor;
		ctx.fillRect(0, h * 0.86, w, h * 0.14);

		const scale = Math.min(w, h * 1.6) * 0.13;
		const f = Math.floor(frame);

		if (this.crowd) {
			// Classmates in blazers, a few frames behind and smaller the further back they stand
			const rows = [
				{ y: 0.5, s: 0.55, n: 8, lag: 9, tint: 0.5 },
				{ y: 0.6, s: 0.7, n: 6, lag: 5, tint: 0.72 },
			];
			let k = 0;
			for (const row of rows) {
				for (let i = 0; i < row.n; i++, k++) {
					if (!this.crowdMem[k]) this.crowdMem[k] = new AngleMemory();
					const pose = solve(f - row.lag - (i % 3) * 2, this.crowdMem[k]);
					const x = (w * (i + 0.5)) / row.n + Math.sin(k) * 8;
					drawDoll(ctx, pose, this.face, { scale: scale * row.s, blazer: true, tint: row.tint }, x, h * row.y);
				}
			}
		}

		const pose = solve(f, this.mem);
		const sway = Math.max(-1.5, Math.min(1.5, pose.sway)) * scale * 0.4;
		drawDoll(ctx, pose, this.face, { scale, blazer: false, tint: 1 }, w / 2 + sway, h * 0.74);

		if (this.skeleton) {
			const sw = Math.min(w * 0.3, 220);
			drawSkeleton(ctx, f, w - sw - 10, 10, sw, sw / ASPECT);
		}
	}
}

/* ---------------------------------------------------------------- mounting */

const mounted = new Map<HTMLElement, Widget>();

export function mountAll() {
	for (const root of document.querySelectorAll<HTMLElement>('[data-storm]')) {
		if (!mounted.has(root)) mounted.set(root, new Storm(root));
	}
}

export function unmountAll() {
	for (const w of mounted.values()) w.destroy();
	mounted.clear();
}
