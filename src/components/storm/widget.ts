/**
 * A 3D paper doll in a school uniform that dances a stretch of the "Storm" choreography with
 * your face on it, rendered with three.js.
 *
 * The motion is MediaPipe's *world* landmarks pulled from the music video (dance.json): 3D
 * joint positions in metres with the origin between the hips. The doll is built from simple
 * meshes that are re-fitted between those joints every frame, so it is a puppet strung on the
 * data rather than a tracing of the video. The face is cut out of a photo in the browser and
 * never leaves it.
 */
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import dance from './dance.json';

/* ---------------------------------------------------------------- data */

type JointName = (typeof dance.joints)[number];
const J = Object.fromEntries(dance.joints.map((name, i) => [name, i])) as Record<JointName, number>;
const STRIDE = dance.joints.length * 4;
const FPS = dance.fps;
const clips: { n: number; d: number[] }[] = dance.clips;
const totalFrames = clips.reduce((sum, c) => sum + c.n, 0);

const scratch = new THREE.Vector3();

/** Joint position at an integer frame, in three.js space (metres, y up, z toward the viewer) */
function jointAt(frame: number, name: JointName, out: THREE.Vector3) {
	let f = ((frame % totalFrames) + totalFrames) % totalFrames;
	for (const clip of clips) {
		if (f < clip.n) {
			const o = f * STRIDE + J[name] * 4;
			// MediaPipe: x right, y down, z toward the camera is negative
			return out.set(clip.d[o] / 1000, -clip.d[o + 1] / 1000, -clip.d[o + 2] / 1000);
		}
		f -= clip.n;
	}
	return out.set(0, 0, 0);
}

/** Linear blend between the two surrounding frames so 15fps data moves at 60fps */
function joint(time: number, name: JointName, out: THREE.Vector3) {
	const f0 = Math.floor(time);
	const t = time - f0;
	jointAt(f0, name, out);
	if (t > 0) {
		jointAt(f0 + 1, name, scratch);
		// Don't blend across the loop seam
		if ((f0 + 1) % totalFrames !== 0) out.lerp(scratch, t);
	}
	return out;
}

/* ---------------------------------------------------------------- doll */

const COLOR = {
	shirt: 0xf4f1ea,
	blazer: 0x1c2233,
	trousers: 0x23262e,
	skin: 0xe8c4a8,
	tie: 0x2b3f66,
	shoe: 0x111111,
	paper: 0xfffdf5,
};

const BONES: [JointName, JointName, number, 'top' | 'leg'][] = [
	['shoulderL', 'elbowL', 0.045, 'top'],
	['elbowL', 'wristL', 0.04, 'top'],
	['shoulderR', 'elbowR', 0.045, 'top'],
	['elbowR', 'wristR', 0.04, 'top'],
	['hipL', 'kneeL', 0.06, 'leg'],
	['kneeL', 'ankleL', 0.05, 'leg'],
	['hipR', 'kneeR', 0.06, 'leg'],
	['kneeR', 'ankleR', 0.05, 'leg'],
];

const UP = new THREE.Vector3(0, 1, 0);
const va = new THREE.Vector3();
const vb = new THREE.Vector3();
const vc = new THREE.Vector3();
const vd = new THREE.Vector3();
const mat = new THREE.Matrix4();
const quat = new THREE.Quaternion();

class Doll {
	readonly group = new THREE.Group();
	/** Height of whatever this doll stands on */
	floor = 0;
	private readonly bones: THREE.Mesh[] = [];
	private readonly torso: THREE.Mesh;
	private readonly tie: THREE.Mesh;
	private readonly head: THREE.Mesh;
	private readonly face: THREE.Mesh;
	private readonly paper: THREE.Mesh;
	private readonly hands: THREE.Mesh[];
	private readonly feet: THREE.Mesh[];
	private readonly joints: THREE.Mesh[];
	private readonly faceMaterial: THREE.MeshBasicMaterial;

	constructor(blazer: boolean, faceTexture: THREE.Texture) {
		const top = new THREE.MeshStandardMaterial({ color: blazer ? COLOR.blazer : COLOR.shirt, roughness: 0.9 });
		const leg = new THREE.MeshStandardMaterial({ color: COLOR.trousers, roughness: 0.9 });
		const skin = new THREE.MeshStandardMaterial({ color: COLOR.skin, roughness: 0.8 });
		const cyl = new THREE.CylinderGeometry(1, 1, 1, 10, 1);
		for (const [, , r, kind] of BONES) {
			const m = new THREE.Mesh(cyl, kind === 'leg' ? leg : top);
			m.userData.radius = r;
			this.bones.push(m);
			this.group.add(m);
		}
		// Round the elbows, knees and shoulders so the limbs read as one piece
		const sphere = new THREE.SphereGeometry(1, 12, 10);
		this.joints = (['elbowL', 'elbowR', 'kneeL', 'kneeR', 'shoulderL', 'shoulderR'] as JointName[]).map((name) => {
			const m = new THREE.Mesh(sphere, name.startsWith('knee') ? leg : top);
			m.userData.name = name;
			m.scale.setScalar(name.startsWith('knee') ? 0.058 : 0.047);
			this.group.add(m);
			return m;
		});
		this.torso = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), top);
		this.group.add(this.torso);
		this.tie = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.28, 0.012), new THREE.MeshStandardMaterial({ color: COLOR.tie }));
		this.group.add(this.tie);
		this.hands = [0, 1].map(() => {
			const m = new THREE.Mesh(sphere, skin);
			m.scale.setScalar(0.05);
			this.group.add(m);
			return m;
		});
		this.feet = [0, 1].map(() => {
			const m = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.06, 0.22), new THREE.MeshStandardMaterial({ color: COLOR.shoe }));
			this.group.add(m);
			return m;
		});
		this.head = new THREE.Mesh(sphere, skin);
		this.head.scale.setScalar(0.105);
		this.group.add(this.head);
		// The face is a paper cut-out glued to the front of the head
		this.faceMaterial = new THREE.MeshBasicMaterial({ map: faceTexture, transparent: true, side: THREE.DoubleSide });
		// Ovals, not rectangles: a circle scaled to the face's proportions, UVs span its bounding box
		const oval = new THREE.CircleGeometry(0.5, 40);
		this.face = new THREE.Mesh(oval, this.faceMaterial);
		this.face.scale.set(0.21, 0.252, 1);
		this.paper = new THREE.Mesh(oval, new THREE.MeshBasicMaterial({ color: COLOR.paper, side: THREE.DoubleSide }));
		this.paper.scale.set(0.235, 0.28, 1);
		this.group.add(this.paper);
		this.group.add(this.face);
	}

	setFace(texture: THREE.Texture) {
		this.faceMaterial.map = texture;
		this.faceMaterial.needsUpdate = true;
	}

	/** Re-fit every mesh to the joints at `time` (in frames) */
	pose(time: number) {
		// Plant the lower foot on the ground instead of hanging the doll from its hips
		const lowest = Math.min(joint(time, 'ankleL', va).y, joint(time, 'ankleR', vb).y);
		this.group.position.y = this.floor - lowest + 0.03;
		this.bones.forEach((m, i) => {
			const [a, b, r] = BONES[i];
			joint(time, a, va);
			joint(time, b, vb);
			fitCylinder(m, va, vb, r);
		});
		for (const m of this.joints) m.position.copy(joint(time, m.userData.name as JointName, va));

		// Torso: a box whose up axis runs hips → shoulders and whose right axis runs along the shoulders
		const sl = joint(time, 'shoulderL', va).clone();
		const sr = joint(time, 'shoulderR', vb).clone();
		const hl = joint(time, 'hipL', vc).clone();
		const hr = joint(time, 'hipR', vd).clone();
		const shoulderC = sl.clone().add(sr).multiplyScalar(0.5);
		const hipC = hl.clone().add(hr).multiplyScalar(0.5);
		const up = shoulderC.clone().sub(hipC);
		const height = Math.max(up.length(), 0.2);
		up.normalize();
		const right = sl.clone().sub(sr);
		right.sub(up.clone().multiplyScalar(right.dot(up))).normalize();
		const forward = new THREE.Vector3().crossVectors(right, up).normalize();
		const width = Math.max(sl.distanceTo(sr), 0.22);
		mat.makeBasis(right, up, forward);
		this.torso.quaternion.setFromRotationMatrix(mat);
		this.torso.position.copy(hipC).addScaledVector(up, height * 0.5);
		this.torso.scale.set(width * 1.05, height * 1.1, 0.16);
		this.tie.quaternion.copy(this.torso.quaternion);
		this.tie.position.copy(shoulderC).addScaledVector(up, -0.17).addScaledVector(forward, 0.085);

		this.hands[0].position.copy(joint(time, 'wristL', va));
		this.hands[1].position.copy(joint(time, 'wristR', va));
		this.feet[0].position.copy(joint(time, 'ankleL', va)).addScaledVector(forward, 0.05);
		this.feet[0].quaternion.copy(this.torso.quaternion);
		this.feet[1].position.copy(joint(time, 'ankleR', va)).addScaledVector(forward, 0.05);
		this.feet[1].quaternion.copy(this.torso.quaternion);

		// Head: centred between the ears, facing the nose
		const earL = joint(time, 'earL', va).clone();
		const earR = joint(time, 'earR', vb).clone();
		const nose = joint(time, 'nose', vc).clone();
		const earC = earL.clone().add(earR).multiplyScalar(0.5);
		const headForward = nose.clone().sub(earC);
		headForward.sub(up.clone().multiplyScalar(headForward.dot(up) * 0.5));
		if (headForward.lengthSq() < 1e-4) headForward.copy(forward);
		headForward.normalize();
		const headRight = earL.clone().sub(earR).normalize();
		const headUp = new THREE.Vector3().crossVectors(headForward, headRight).normalize();
		if (headUp.dot(up) < 0) headUp.negate();
		const center = earC.clone().addScaledVector(headUp, 0.02);
		this.head.position.copy(center);
		mat.makeBasis(headRight, headUp, headForward);
		quat.setFromRotationMatrix(mat);
		this.face.quaternion.copy(quat);
		this.face.position.copy(center).addScaledVector(headForward, 0.1).addScaledVector(headUp, 0.01);
		this.paper.quaternion.copy(quat);
		this.paper.position.copy(center).addScaledVector(headForward, 0.097).addScaledVector(headUp, 0.01);
	}
}

/** Stretch a unit cylinder between two points with the given radius */
function fitCylinder(m: THREE.Mesh, a: THREE.Vector3, b: THREE.Vector3, radius: number) {
	const dir = vc.copy(b).sub(a);
	const len = Math.max(dir.length(), 0.01);
	m.position.copy(a).addScaledVector(dir, 0.5);
	m.quaternion.setFromUnitVectors(UP, dir.normalize());
	m.scale.set(radius, len, radius);
}

/** The raw joints as a stick figure, for the "what the model actually gives you" view */
class Skeleton {
	readonly object: THREE.LineSegments;
	private readonly pairs: [JointName, JointName][] = [
		['shoulderL', 'shoulderR'], ['shoulderL', 'elbowL'], ['elbowL', 'wristL'], ['shoulderR', 'elbowR'], ['elbowR', 'wristR'],
		['shoulderL', 'hipL'], ['shoulderR', 'hipR'], ['hipL', 'hipR'], ['hipL', 'kneeL'], ['kneeL', 'ankleL'],
		['hipR', 'kneeR'], ['kneeR', 'ankleR'], ['earL', 'earR'], ['nose', 'earL'], ['nose', 'earR'], ['eyeL', 'eyeR'],
	];
	private readonly positions: Float32Array;

	constructor() {
		this.positions = new Float32Array(this.pairs.length * 6);
		const geo = new THREE.BufferGeometry();
		geo.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));
		this.object = new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ color: 0x78c8ff }));
		this.object.frustumCulled = false;
	}

	pose(time: number) {
		this.pairs.forEach(([a, b], i) => {
			joint(time, a, va).toArray(this.positions, i * 6);
			joint(time, b, vb).toArray(this.positions, i * 6 + 3);
		});
		this.object.geometry.attributes.position.needsUpdate = true;
	}
}

/* ---------------------------------------------------------------- face cut-out */

const FACE_W = 200;
const FACE_H = 240;

function placeholderFace() {
	const c = document.createElement('canvas');
	c.width = FACE_W;
	c.height = FACE_H;
	const ctx = c.getContext('2d')!;
	ctx.fillStyle = '#e8c4a8';
	ctx.fillRect(0, 0, FACE_W, FACE_H);
	ctx.fillStyle = '#0e0f12';
	ctx.beginPath();
	ctx.arc(FACE_W * 0.36, FACE_H * 0.42, 7, 0, Math.PI * 2);
	ctx.arc(FACE_W * 0.64, FACE_H * 0.42, 7, 0, Math.PI * 2);
	ctx.fill();
	ctx.lineWidth = 5;
	ctx.strokeStyle = '#0e0f12';
	ctx.beginPath();
	ctx.moveTo(FACE_W * 0.38, FACE_H * 0.66);
	ctx.lineTo(FACE_W * 0.62, FACE_H * 0.66);
	ctx.stroke();
	ctx.fillStyle = '#5a3a2a';
	ctx.beginPath();
	ctx.ellipse(FACE_W / 2, FACE_H * 0.12, FACE_W * 0.52, FACE_H * 0.2, 0, Math.PI, Math.PI * 2);
	ctx.fill();
	// Oval mask so the placeholder matches a cut-out photo
	ctx.globalCompositeOperation = 'destination-in';
	ctx.beginPath();
	ctx.ellipse(FACE_W / 2, FACE_H / 2, FACE_W / 2, FACE_H / 2, 0, 0, Math.PI * 2);
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
		signal: AbortSignal,
	) {
		canvas.width = 320;
		canvas.height = 320;
		this.ctx = canvas.getContext('2d')!;
		const opts = { signal };
		canvas.addEventListener('pointerdown', (e) => this.down(e), opts);
		canvas.addEventListener('pointermove', (e) => this.move(e), opts);
		canvas.addEventListener('pointerup', (e) => this.up(e), opts);
		canvas.addEventListener('pointercancel', (e) => this.up(e), opts);
		canvas.addEventListener(
			'wheel',
			(e) => {
				e.preventDefault();
				this.setZoom(this.zoom * (e.deltaY < 0 ? 1.08 : 0.93));
			},
			{ ...opts, passive: false },
		);
		zoomInput.addEventListener('input', () => this.setZoom(Number(zoomInput.value)), opts);
	}

	load(image: HTMLImageElement) {
		this.image = image;
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
		ctx.save();
		ctx.beginPath();
		ctx.rect(0, 0, canvas.width, canvas.height);
		ctx.ellipse(canvas.width / 2, canvas.height / 2, (FACE_W / 2) * 1.25, (FACE_H / 2) * 1.25, 0, 0, Math.PI * 2);
		ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
		ctx.fill('evenodd');
		ctx.strokeStyle = '#fff';
		ctx.lineWidth = 2;
		ctx.setLineDash([6, 4]);
		ctx.beginPath();
		ctx.ellipse(canvas.width / 2, canvas.height / 2, (FACE_W / 2) * 1.25, (FACE_H / 2) * 1.25, 0, 0, Math.PI * 2);
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
		g.addColorStop(0.9, 'rgba(0,0,0,1)');
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
	private readonly renderer: THREE.WebGLRenderer;
	private readonly scene = new THREE.Scene();
	private readonly camera: THREE.PerspectiveCamera;
	private readonly controls: OrbitControls;
	private readonly abort = new AbortController();
	private readonly observer: IntersectionObserver;
	private readonly resize: ResizeObserver;
	private readonly cropper: Cropper;
	private readonly lead: Doll;
	private readonly crowd: { doll: Doll; lag: number }[] = [];
	private readonly crowdGroup = new THREE.Group();
	private readonly skeleton = new Skeleton();
	private faceTexture: THREE.CanvasTexture;
	private raf = 0;
	private start = 0;

	constructor(private readonly root: HTMLElement) {
		this.canvas = root.querySelector('canvas[data-stage]')!;
		const { signal } = this.abort;
		const q = <T extends HTMLElement>(sel: string) => root.querySelector<T>(sel)!;

		this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true });
		this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
		this.scene.background = new THREE.Color(0x1f2126);
		this.scene.fog = new THREE.Fog(0x1f2126, 7, 15);
		this.camera = new THREE.PerspectiveCamera(38, 1, 0.1, 30);
		this.camera.position.set(0.5, 1.35, 3.4);
		this.controls = new OrbitControls(this.camera, this.canvas);
		this.controls.target.set(0, 0.85, -0.5);
		this.controls.enablePan = false;
		this.controls.enableZoom = false;
		this.controls.enableDamping = true;
		this.controls.autoRotate = true;
		this.controls.autoRotateSpeed = 0.6;
		this.controls.maxPolarAngle = Math.PI * 0.52;
		this.controls.minPolarAngle = Math.PI * 0.25;
		// Let the page scroll vertically over the canvas on a phone; sideways drags still orbit
		this.canvas.style.touchAction = 'pan-y';

		this.scene.add(new THREE.HemisphereLight(0xdfe6f5, 0x2a2d34, 1.1));
		const sun = new THREE.DirectionalLight(0xffffff, 1.6);
		sun.position.set(2, 4, 3);
		this.scene.add(sun);
		const floor = new THREE.Mesh(new THREE.CircleGeometry(16, 48), new THREE.MeshStandardMaterial({ color: 0x2a2d34, roughness: 1 }));
		floor.rotation.x = -Math.PI / 2;
		this.scene.add(floor);
		// Two tiers of bleachers for the class photo
		for (const [z, h] of [
			[-1.2, 0.22],
			[-2.1, 0.44],
		] as const) {
			const step = new THREE.Mesh(new THREE.BoxGeometry(6, h, 0.9), new THREE.MeshStandardMaterial({ color: 0x33373f, roughness: 1 }));
			step.position.set(0, h / 2, z);
			this.scene.add(step);
		}

		this.faceTexture = this.textureFrom(placeholderFace());
		this.lead = new Doll(false, this.faceTexture);
		this.scene.add(this.lead.group);
		const rows: [number, number, number, number][] = [
			// z, floor height, count, lag in frames
			[-1.2, 0.22, 6, 5],
			[-2.1, 0.44, 8, 9],
		];
		for (const [z, h, n, lag] of rows) {
			for (let i = 0; i < n; i++) {
				const doll = new Doll(true, this.faceTexture);
				doll.group.position.set(((i + 0.5) / n - 0.5) * 4.8 + Math.sin(i * 7 + z) * 0.1, h, z + Math.cos(i * 3) * 0.12);
				doll.floor = h;
				doll.group.scale.setScalar(0.92);
				this.crowdGroup.add(doll.group);
				this.crowd.push({ doll, lag: lag + (i % 3) * 2 });
			}
		}
		this.scene.add(this.crowdGroup);
		this.skeleton.object.position.set(1.4, 0.95, 0);
		this.skeleton.object.visible = false;
		this.scene.add(this.skeleton.object);

		this.cropper = new Cropper(q('canvas[data-crop]'), q('[data-zoom]'), signal);
		const file = q<HTMLInputElement>('[data-file]');
		file.addEventListener('change', () => this.pick(file), { signal });
		q('[data-ok]').addEventListener('click', () => this.confirm(), { signal });
		q('[data-cancel]').addEventListener('click', () => this.closeCropper(), { signal });
		q('[data-reset]').addEventListener('click', () => this.setFace(placeholderFace()), { signal });
		const crowd = q<HTMLInputElement>('[data-crowd]');
		crowd.addEventListener('change', () => (this.crowdGroup.visible = crowd.checked), { signal });
		const skel = q<HTMLInputElement>('[data-skeleton]');
		skel.addEventListener('change', () => (this.skeleton.object.visible = skel.checked), { signal });

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
		this.controls.dispose();
		this.renderer.dispose();
	}

	private textureFrom(canvas: HTMLCanvasElement) {
		const t = new THREE.CanvasTexture(canvas);
		t.colorSpace = THREE.SRGBColorSpace;
		return t;
	}

	private setFace(canvas: HTMLCanvasElement) {
		this.faceTexture.dispose();
		this.faceTexture = this.textureFrom(canvas);
		this.lead.setFace(this.faceTexture);
		for (const { doll } of this.crowd) doll.setFace(this.faceTexture);
	}

	private fit() {
		const w = this.canvas.clientWidth;
		if (!w) return;
		const h = Math.round(w * 0.62);
		this.renderer.setSize(w, h, false);
		this.camera.aspect = w / h;
		this.camera.updateProjectionMatrix();
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
		this.setFace(this.cropper.cut());
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
			this.frame(((now - this.start) / 1000) * FPS);
		};
		this.raf = requestAnimationFrame(tick);
	}

	private pause() {
		cancelAnimationFrame(this.raf);
		this.raf = 0;
	}

	private frame(time: number) {
		this.lead.pose(time);
		if (this.crowdGroup.visible) for (const { doll, lag } of this.crowd) doll.pose(time - lag);
		if (this.skeleton.object.visible) this.skeleton.pose(time);
		this.controls.update();
		this.renderer.render(this.scene, this.camera);
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
