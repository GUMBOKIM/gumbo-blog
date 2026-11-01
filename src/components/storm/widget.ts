/**
 * The class-photo scene from the "Storm" video, rebuilt in three.js with your face on the lead.
 *
 * Two kinds of data drive it, both pulled from the video and nothing else:
 *  - dance.json: the lead's 3D joints (MediaPipe world landmarks, metres, hip-centred),
 *    found by his white shirt. His upper body is strung on those; his legs are built.
 *  - crowd.json: a grid of optical flow over the whole frame, with the camera's zoom removed,
 *    integrated into "how far has this patch of crowd been pushed lately" plus a shaking
 *    term. Pose estimation can't see eighty boys folded over in navy blazers, but the flow
 *    can, so each figure in the crowd bows, rears and sways by the patch it stands in.
 * The camera follows the video's own slow zoom-out, measured from how big the shirt is.
 */
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import dance from './dance.json';
import crowd from './crowd.json';

/* ---------------------------------------------------------------- lead data */

type JointName = (typeof dance.joints)[number];
const NAMES = dance.joints as JointName[];
const J = Object.fromEntries(NAMES.map((name, i) => [name, i])) as Record<JointName, number>;
const NJ = NAMES.length;
const STRIDE = NJ * 4;
const LEAD_FPS = dance.fps;
const clips: { n: number; d: number[]; t0: number }[] = dance.clips;
const CLOSEUP = clips[0].n / LEAD_FPS; // seconds of the opening close-up
const GROUP = clips[1].n / LEAD_FPS; // seconds of the class photo
const LOOP = CLOSEUP + GROUP;

/** Joint position of the lead at scene time `t` (seconds), in three.js space */
function leadJoint(t: number, name: JointName, out: THREE.Vector3) {
	let f: number;
	let clip: { n: number; d: number[] };
	if (t < CLOSEUP) {
		clip = clips[0];
		f = t * LEAD_FPS;
	} else {
		clip = clips[1];
		f = (t - CLOSEUP) * LEAD_FPS;
	}
	const f0 = Math.min(Math.floor(f), clip.n - 1);
	const f1 = Math.min(f0 + 1, clip.n - 1);
	const k = f - f0;
	const o0 = f0 * STRIDE + J[name] * 4;
	const o1 = f1 * STRIDE + J[name] * 4;
	// MediaPipe: x right, y down, z toward the camera is negative
	return out.set(
		(clip.d[o0] * (1 - k) + clip.d[o1] * k) / 1000,
		-(clip.d[o0 + 1] * (1 - k) + clip.d[o1 + 1] * k) / 1000,
		-(clip.d[o0 + 2] * (1 - k) + clip.d[o1 + 2] * k) / 1000,
	);
}

/* ---------------------------------------------------------------- crowd data */

const CROWD_FPS = crowd.fps;
const COLS = crowd.cols;
const ROWS = crowd.rows;
const cells: number[][][] = crowd.cells;
const anchors: number[][] = crowd.anchor;
const CROWD_N = cells.length;
/** Shirt height in metres: what one unit of the crowd field means */
const SHIRT = 0.55;

/** Camera anchor at group time g: [shirt centre x, y in frame fractions, shirt height in frame fractions] */
function anchorAt(g: number, out: number[]) {
	const f = Math.max(0, Math.min(g * CROWD_FPS, CROWD_N - 1));
	const f0 = Math.floor(f);
	const f1 = Math.min(f0 + 1, CROWD_N - 1);
	const k = f - f0;
	for (let i = 0; i < 3; i++) out[i] = anchors[f0][i] * (1 - k) + anchors[f1][i] * k;
	return out;
}

/** Flow field sample at group time g for a patch `u` shirt-widths right of and `v` below the lead */
function fieldAt(g: number, u: number, v: number, out: number[]) {
	const f = g * CROWD_FPS;
	if (f < 0 || f >= CROWD_N) {
		out[0] = out[1] = out[2] = 0;
		return out;
	}
	const f0 = Math.floor(f);
	const f1 = Math.min(f0 + 1, CROWD_N - 1);
	const k = f - f0;
	const a = anchors[f0];
	const x = a[0] + u * a[2];
	const y = a[1] + v * a[2];
	const c = Math.max(0, Math.min(COLS - 1, Math.floor(x * COLS)));
	const r = Math.max(0, Math.min(ROWS - 1, Math.floor(y * ROWS)));
	const cell = r * COLS + c;
	const p = cells[f0][cell];
	const q = cells[f1][cell];
	out[0] = (p[0] * (1 - k) + q[0] * k) / 100;
	out[1] = (p[1] * (1 - k) + q[1] * k) / 100;
	out[2] = (p[2] * (1 - k) + q[2] * k) / 40;
	return out;
}

/* ---------------------------------------------------------------- procedural figure */

/** A standing boy, hips at the origin, facing +z. Arms hang, or make fists at the chest. */
const BASE: Record<JointName, [number, number, number]> = {
	nose: [0, 0.64, 0.09],
	eyeL: [0.03, 0.68, 0.07],
	eyeR: [-0.03, 0.68, 0.07],
	earL: [0.08, 0.66, -0.01],
	earR: [-0.08, 0.66, -0.01],
	shoulderL: [0.19, 0.5, 0],
	shoulderR: [-0.19, 0.5, 0],
	elbowL: [0.24, 0.24, 0.01],
	elbowR: [-0.24, 0.24, 0.01],
	wristL: [0.25, 0.0, 0.05],
	wristR: [-0.25, 0.0, 0.05],
	hipL: [0.1, 0, 0],
	hipR: [-0.1, 0, 0],
	kneeL: [0.1, -0.45, 0],
	kneeR: [-0.1, -0.45, 0],
	ankleL: [0.1, -0.88, 0],
	ankleR: [-0.1, -0.88, 0],
};
const ARMS_UP: Partial<Record<JointName, [number, number, number]>> = {
	elbowL: [0.27, 0.3, 0.06],
	elbowR: [-0.27, 0.3, 0.06],
	wristL: [0.11, 0.42, 0.18],
	wristR: [-0.11, 0.42, 0.18],
};
const UPPER = new Set<JointName>(['nose', 'eyeL', 'eyeR', 'earL', 'earR', 'shoulderL', 'shoulderR', 'elbowL', 'elbowR', 'wristL', 'wristR']);
const HEAD = new Set<JointName>(['nose', 'eyeL', 'eyeR', 'earL', 'earR']);

interface Motion {
	bend: number; // forward bow at the hips, radians (negative rears back)
	sway: number; // side lean, radians
	headTilt: number; // extra nod of the head, radians (negative throws it back)
	armsUp: number; // 0 hanging, 1 fists at the chest
	shake: number; // trembling amplitude
	seed: number;
	time: number;
}

const tmp = new THREE.Vector3();

/** Write the 17 joints of a procedural figure into `out` (xyz per joint) */
function proceduralPose(m: Motion, out: Float32Array) {
	const cb = Math.cos(m.bend);
	const sb = Math.sin(m.bend);
	const cs = Math.cos(m.sway);
	const ss = Math.sin(m.sway);
	const ch = Math.cos(m.headTilt);
	const sh = Math.sin(m.headTilt);
	for (let i = 0; i < NJ; i++) {
		const name = NAMES[i];
		const b = BASE[name];
		let x = b[0];
		let y = b[1];
		let z = b[2];
		const up = ARMS_UP[name];
		if (up) {
			x += (up[0] - x) * m.armsUp;
			y += (up[1] - y) * m.armsUp;
			z += (up[2] - z) * m.armsUp;
		}
		if (HEAD.has(name)) {
			// nod about the neck (y = 0.5)
			const ny = y - 0.5;
			y = 0.5 + ny * ch - z * sh;
			z = ny * sh + z * ch;
		}
		if (UPPER.has(name)) {
			// bow about the hips, then lean sideways
			const y1 = y * cb - z * sb;
			z = y * sb + z * cb;
			y = y1;
			const x1 = x * cs - y * ss;
			y = x * ss + y * cs;
			x = x1;
			if (m.shake > 0) {
				const w = m.time * 58 + i * 1.7 + m.seed;
				const a = m.shake * (name.startsWith('wrist') ? 0.05 : name.startsWith('elbow') ? 0.03 : 0.015);
				x += Math.sin(w) * a;
				y += Math.cos(w * 1.3) * a * 0.6;
			}
		} else if (name.startsWith('knee')) {
			// knees give a little when bowing
			z += Math.max(0, m.bend) * 0.12;
			y += Math.max(0, m.bend) * 0.03;
		}
		out[i * 3] = x;
		out[i * 3 + 1] = y;
		out[i * 3 + 2] = z;
	}
}

/**
 * The lead: his gestures from the tracked joints, retargeted onto a sane torso.
 * MediaPipe's world coordinates flatten a bent torso and stretch arms, so the torso is rebuilt
 * from the tracked lean (clamped) and the arms and head are re-hung from the rebuilt shoulders.
 */
const L = {
	hipL: new THREE.Vector3(), hipR: new THREE.Vector3(), shL: new THREE.Vector3(), shR: new THREE.Vector3(),
	shC: new THREE.Vector3(), up: new THREE.Vector3(), right: new THREE.Vector3(), a: new THREE.Vector3(), b: new THREE.Vector3(),
};
function leadPose(t: number, out: Float32Array) {
	const set = (name: JointName, v: THREE.Vector3) => v.toArray(out, J[name] * 3);
	leadJoint(t, 'hipL', L.hipL);
	leadJoint(t, 'hipR', L.hipR);
	leadJoint(t, 'shoulderL', L.shL);
	leadJoint(t, 'shoulderR', L.shR);
	L.shC.copy(L.shL).add(L.shR).multiplyScalar(0.5);
	// Hips stay at the origin; legs straight under them
	L.hipL.set(0.1, 0, 0);
	L.hipR.set(-0.1, 0, 0);
	set('hipL', L.hipL);
	set('hipR', L.hipR);
	set('kneeL', L.a.set(0.1, -0.45, 0));
	set('kneeR', L.a.set(-0.1, -0.45, 0));
	set('ankleL', L.a.set(0.1, -0.88, 0));
	set('ankleR', L.a.set(-0.1, -0.88, 0));
	// Torso: the tracked lean, clamped, on a fixed-length spine
	const bend = Math.max(-0.3, Math.min(0.8, Math.atan2(L.shC.z, Math.max(0.05, L.shC.y))));
	const sway = Math.max(-0.45, Math.min(0.45, Math.atan2(-L.shC.x, Math.max(0.05, L.shC.y))));
	L.up.set(Math.sin(-sway) * Math.cos(bend), Math.cos(sway) * Math.cos(bend), Math.sin(bend)).normalize();
	const spine = L.up.clone().multiplyScalar(0.5);
	L.right.copy(L.shL).sub(L.shR);
	L.right.addScaledVector(L.up, -L.right.dot(L.up));
	if (L.right.lengthSq() < 1e-4) L.right.set(1, 0, 0);
	L.right.normalize();
	const shL = spine.clone().addScaledVector(L.right, 0.19);
	const shR = spine.clone().addScaledVector(L.right, -0.19);
	set('shoulderL', shL);
	set('shoulderR', shR);
	// Arms: tracked bone vectors, lengths clamped, hung from the rebuilt shoulders
	for (const side of ['L', 'R'] as const) {
		const sh = side === 'L' ? shL : shR;
		const tsh = side === 'L' ? L.shL : L.shR;
		leadJoint(t, `elbow${side}`, L.a).sub(tsh);
		if (L.a.length() > 0.3) L.a.setLength(0.3);
		const elbow = sh.clone().add(L.a);
		leadJoint(t, `wrist${side}`, L.b).sub(leadJoint(t, `elbow${side}`, L.a));
		if (L.b.length() > 0.28) L.b.setLength(0.28);
		set(`elbow${side}`, elbow);
		set(`wrist${side}`, elbow.add(L.b));
	}
	// Head: tracked ears, eyes and nose relative to the tracked shoulder centre, re-hung
	leadJoint(t, 'earL', L.a);
	leadJoint(t, 'earR', L.b);
	const earC = L.a.clone().add(L.b).multiplyScalar(0.5).sub(L.shC);
	if (earC.length() > 0.22) earC.setLength(0.22);
	if (earC.length() < 0.12) earC.setLength(0.12);
	const shift = spine.clone().add(earC).sub(L.a.clone().add(L.b).multiplyScalar(0.5));
	for (const name of ['earL', 'earR', 'eyeL', 'eyeR', 'nose'] as JointName[]) set(name, leadJoint(t, name, L.a).add(shift));
}

/* ---------------------------------------------------------------- puppets (instanced) */

const COLOR = {
	shirt: 0xf4f1ea,
	blazer: 0x171c2b,
	trousers: 0x1b1d24,
	shoe: 0x0c0c0c,
};
const SKINS = [0xeccbb2, 0xe3b898, 0xd0a07e, 0xb98564, 0x8f5d3e, 0x5f3f2a, 0xf1d6c2];
const HAIRS = [0x15110d, 0x241a12, 0x3d2a1b, 0x6b4a2c, 0xa07a46, 0x7a3a22, 0x1b1b1b, 0xc9a66b];

const BONES: [JointName, JointName, number, 'top' | 'leg'][] = [
	['shoulderL', 'elbowL', 0.047, 'top'],
	['elbowL', 'wristL', 0.04, 'top'],
	['shoulderR', 'elbowR', 0.047, 'top'],
	['elbowR', 'wristR', 0.04, 'top'],
	['hipL', 'kneeL', 0.065, 'leg'],
	['kneeL', 'ankleL', 0.052, 'leg'],
	['hipR', 'kneeR', 0.065, 'leg'],
	['kneeR', 'ankleR', 0.052, 'leg'],
];
const ROUND: [JointName, number, 'top' | 'leg'][] = [
	['elbowL', 0.048, 'top'],
	['elbowR', 0.048, 'top'],
	['shoulderL', 0.05, 'top'],
	['shoulderR', 0.05, 'top'],
	['kneeL', 0.06, 'leg'],
	['kneeR', 0.06, 'leg'],
];
const SPHERES = ROUND.length + 4; // + head, hair, two hands
const BOXES = 4; // torso, shirt V, two feet

const UP = new THREE.Vector3(0, 1, 0);
const va = new THREE.Vector3();
const vb = new THREE.Vector3();
const vc = new THREE.Vector3();
const vd = new THREE.Vector3();
const mat = new THREE.Matrix4();
const quat = new THREE.Quaternion();
const dummy = new THREE.Object3D();

interface Look {
	blazer: boolean;
	skin: number;
	hair: number;
	scale: number;
}

/** `count` figures sharing one set of instanced meshes */
class Puppets {
	readonly group = new THREE.Group();
	private readonly cyl: THREE.InstancedMesh;
	private readonly sph: THREE.InstancedMesh;
	private readonly box: THREE.InstancedMesh;
	private readonly tie: THREE.InstancedMesh;
	private readonly face: THREE.InstancedMesh;
	private readonly faceMaterial: THREE.MeshBasicMaterial;
	private readonly looks: Look[] = [];
	private readonly joints: Float32Array;
	/** World-space head centre and facing of each figure after `place` */
	private readonly heads: Float32Array;

	constructor(
		readonly count: number,
		looks: (i: number) => Look,
		faceTexture: THREE.Texture,
		tieTexture: THREE.Texture,
	) {
		this.joints = new Float32Array(count * NJ * 3);
		this.heads = new Float32Array(count * 6);
		const body = new THREE.MeshStandardMaterial({ roughness: 0.92 });
		this.cyl = new THREE.InstancedMesh(new THREE.CylinderGeometry(1, 1, 1, 10, 1), body, count * BONES.length);
		this.sph = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 14, 11), body, count * SPHERES);
		this.box = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), body, count * BOXES);
		this.tie = new THREE.InstancedMesh(
			new THREE.BoxGeometry(0.05, 0.3, 0.012),
			new THREE.MeshStandardMaterial({ map: tieTexture, roughness: 0.8 }),
			count,
		);
		this.faceMaterial = new THREE.MeshBasicMaterial({ map: faceTexture, transparent: true, side: THREE.DoubleSide });
		this.face = new THREE.InstancedMesh(new THREE.CircleGeometry(0.5, 32), this.faceMaterial, count);
		for (const m of [this.cyl, this.sph, this.box, this.tie, this.face]) {
			m.frustumCulled = false;
			this.group.add(m);
		}
		const c = new THREE.Color();
		for (let i = 0; i < count; i++) {
			const look = looks(i);
			this.looks.push(look);
			const top = look.blazer ? COLOR.blazer : COLOR.shirt;
			BONES.forEach(([, , , kind], k) => this.cyl.setColorAt(i * BONES.length + k, c.setHex(kind === 'leg' ? COLOR.trousers : top)));
			ROUND.forEach(([, , kind], k) => this.sph.setColorAt(i * SPHERES + k, c.setHex(kind === 'leg' ? COLOR.trousers : top)));
			this.sph.setColorAt(i * SPHERES + ROUND.length, c.setHex(look.skin)); // head
			this.sph.setColorAt(i * SPHERES + ROUND.length + 1, c.setHex(look.hair)); // hair
			this.sph.setColorAt(i * SPHERES + ROUND.length + 2, c.setHex(look.skin)); // hands
			this.sph.setColorAt(i * SPHERES + ROUND.length + 3, c.setHex(look.skin));
			this.box.setColorAt(i * BOXES, c.setHex(top)); // torso
			this.box.setColorAt(i * BOXES + 1, c.setHex(COLOR.shirt)); // shirt V
			this.box.setColorAt(i * BOXES + 2, c.setHex(COLOR.shoe));
			this.box.setColorAt(i * BOXES + 3, c.setHex(COLOR.shoe));
			this.face.setColorAt(i, c.setHex(look.skin));
		}
	}

	/** Plain photo (no skin tint) or generic drawn faces tinted by each figure's skin */
	setFace(texture: THREE.Texture, tint: boolean) {
		this.faceMaterial.map = texture;
		this.faceMaterial.needsUpdate = true;
		const c = new THREE.Color();
		for (let i = 0; i < this.count; i++) this.face.setColorAt(i, c.setHex(tint ? this.looks[i].skin : 0xffffff));
		this.face.instanceColor!.needsUpdate = true;
	}

	/** Joint buffer of figure i, to be filled before `place` */
	jointsOf(i: number) {
		return this.joints.subarray(i * NJ * 3, (i + 1) * NJ * 3);
	}

	/** Fit figure i's meshes to its joints, standing at `spot` on a floor at spot.y */
	place(i: number, spot: THREE.Vector3) {
		const jt = this.jointsOf(i);
		const s = this.looks[i].scale;
		const P = (name: JointName, out: THREE.Vector3) => {
			const o = J[name] * 3;
			return out.set(jt[o], jt[o + 1], jt[o + 2]);
		};
		// Plant the lower foot on the floor instead of hanging the figure from its hips
		const lowest = Math.min(jt[J.ankleL * 3 + 1], jt[J.ankleR * 3 + 1]);
		const off = vd.set(spot.x, spot.y - (lowest - 0.03) * s, spot.z);
		const put = (mesh: THREE.InstancedMesh, index: number) => {
			dummy.position.multiplyScalar(s).add(off);
			dummy.scale.multiplyScalar(s);
			dummy.updateMatrix();
			mesh.setMatrixAt(index, dummy.matrix);
		};

		BONES.forEach(([a, b, r], k) => {
			P(a, va);
			P(b, vb);
			const dir = vc.copy(vb).sub(va);
			const len = Math.max(dir.length(), 0.01);
			dummy.position.copy(va).addScaledVector(dir, 0.5);
			dummy.quaternion.setFromUnitVectors(UP, dir.normalize());
			dummy.scale.set(r, len, r);
			put(this.cyl, i * BONES.length + k);
		});
		dummy.quaternion.identity();
		ROUND.forEach(([name, r], k) => {
			P(name, dummy.position);
			dummy.scale.setScalar(r);
			put(this.sph, i * SPHERES + k);
		});

		// Torso: a box whose up axis runs hips → shoulders and whose right axis runs along the shoulders
		const sl = P('shoulderL', va).clone();
		const sr = P('shoulderR', vb).clone();
		const hipC = P('hipL', vc).add(P('hipR', vd)).multiplyScalar(0.5).clone();
		const shoulderC = sl.clone().add(sr).multiplyScalar(0.5);
		const up = shoulderC.clone().sub(hipC);
		const height = Math.max(up.length(), 0.2);
		up.normalize();
		const right = sl.clone().sub(sr);
		right.sub(up.clone().multiplyScalar(right.dot(up))).normalize();
		const forward = new THREE.Vector3().crossVectors(right, up).normalize();
		const width = Math.max(sl.distanceTo(sr), 0.24);
		mat.makeBasis(right, up, forward);
		quat.setFromRotationMatrix(mat);
		// `off` was clobbered by P(); restore it (vd) before any `put`
		off.set(spot.x, spot.y - (lowest - 0.03) * s, spot.z);
		dummy.quaternion.copy(quat);
		dummy.position.copy(hipC).addScaledVector(up, height * 0.5);
		dummy.scale.set(width * 1.08, height * 1.12, 0.17);
		put(this.box, i * BOXES);
		// A white V of shirt between the lapels (hidden on a figure already in shirt sleeves)
		dummy.quaternion.copy(quat);
		dummy.position.copy(shoulderC).addScaledVector(up, -0.09).addScaledVector(forward, 0.087);
		dummy.scale.set(this.looks[i].blazer ? 0.1 : 0.001, 0.15, 0.012);
		put(this.box, i * BOXES + 1);
		dummy.quaternion.copy(quat);
		dummy.position.copy(shoulderC).addScaledVector(up, -0.19).addScaledVector(forward, 0.095);
		dummy.scale.setScalar(1);
		put(this.tie, i);

		for (const [k, name] of (['ankleL', 'ankleR'] as JointName[]).entries()) {
			dummy.quaternion.copy(quat);
			P(name, dummy.position).addScaledVector(forward, 0.05);
			dummy.scale.set(0.1, 0.06, 0.24);
			put(this.box, i * BOXES + 2 + k);
		}
		dummy.quaternion.identity();
		for (const [k, name] of (['wristL', 'wristR'] as JointName[]).entries()) {
			P(name, dummy.position);
			dummy.scale.setScalar(0.05);
			put(this.sph, i * SPHERES + ROUND.length + 2 + k);
		}

		// Head: centred between the ears, facing the nose; a hair cap sits up and back of it
		const earL = P('earL', va).clone();
		const earR = P('earR', vb).clone();
		const nose = P('nose', vc).clone();
		const earC = earL.clone().add(earR).multiplyScalar(0.5);
		const headForward = nose.clone().sub(earC);
		headForward.sub(up.clone().multiplyScalar(headForward.dot(up) * 0.5));
		if (headForward.lengthSq() < 1e-4) headForward.copy(forward);
		headForward.normalize();
		const headRight = earL.clone().sub(earR);
		if (headRight.lengthSq() < 1e-6) headRight.copy(right);
		headRight.normalize();
		const headUp = new THREE.Vector3().crossVectors(headForward, headRight).normalize();
		if (headUp.dot(up) < 0) headUp.negate();
		const center = earC.clone().addScaledVector(headUp, 0.02);
		center.clone().multiplyScalar(s).add(off).toArray(this.heads, i * 6);
		headForward.toArray(this.heads, i * 6 + 3);
		dummy.quaternion.identity();
		dummy.position.copy(center);
		dummy.scale.setScalar(0.105);
		put(this.sph, i * SPHERES + ROUND.length);
		mat.makeBasis(headRight, headUp, headForward);
		dummy.quaternion.setFromRotationMatrix(mat);
		dummy.position.copy(center).addScaledVector(headUp, 0.035).addScaledVector(headForward, -0.04);
		dummy.scale.set(0.112, 0.1, 0.115);
		put(this.sph, i * SPHERES + ROUND.length + 1);
		dummy.quaternion.setFromRotationMatrix(mat);
		dummy.position.copy(center).addScaledVector(headForward, 0.1).addScaledVector(headUp, 0.01);
		dummy.scale.set(0.185, 0.225, 1);
		put(this.face, i);
	}

	/** Where figure i's head is and which way it faces, in world space */
	head(i: number, center: THREE.Vector3, forward: THREE.Vector3) {
		center.fromArray(this.heads, i * 6);
		forward.fromArray(this.heads, i * 6 + 3);
	}

	commit() {
		for (const m of [this.cyl, this.sph, this.box, this.tie, this.face]) {
			m.instanceMatrix.needsUpdate = true;
			if (m.instanceColor) m.instanceColor.needsUpdate = true;
		}
	}

	dispose() {
		for (const m of [this.cyl, this.sph, this.box, this.tie, this.face]) {
			m.geometry.dispose();
			(m.material as THREE.Material).dispose();
			m.dispose();
		}
	}
}

/* ---------------------------------------------------------------- textures */

const FACE_W = 200;
const FACE_H = 240;

function canvas(w: number, h: number) {
	const c = document.createElement('canvas');
	c.width = w;
	c.height = h;
	return [c, c.getContext('2d')!] as const;
}

function textureFrom(c: HTMLCanvasElement, repeat?: [number, number]) {
	const t = new THREE.CanvasTexture(c);
	t.colorSpace = THREE.SRGBColorSpace;
	t.anisotropy = 4;
	if (repeat) {
		t.wrapS = t.wrapT = THREE.RepeatWrapping;
		t.repeat.set(repeat[0], repeat[1]);
	}
	return t;
}

/** A drawn face on a white ground, so the instance colour supplies the skin */
function genericFace() {
	const [c, ctx] = canvas(FACE_W, FACE_H);
	ctx.fillStyle = '#fff';
	ctx.fillRect(0, 0, FACE_W, FACE_H);
	ctx.fillStyle = '#1a1512';
	ctx.beginPath();
	ctx.arc(FACE_W * 0.37, FACE_H * 0.45, 6, 0, Math.PI * 2);
	ctx.arc(FACE_W * 0.63, FACE_H * 0.45, 6, 0, Math.PI * 2);
	ctx.fill();
	ctx.lineWidth = 4;
	ctx.strokeStyle = '#2a2018';
	ctx.beginPath();
	ctx.moveTo(FACE_W * 0.29, FACE_H * 0.37);
	ctx.lineTo(FACE_W * 0.44, FACE_H * 0.36);
	ctx.moveTo(FACE_W * 0.56, FACE_H * 0.36);
	ctx.lineTo(FACE_W * 0.71, FACE_H * 0.37);
	ctx.stroke();
	ctx.strokeStyle = '#7a4a40';
	ctx.beginPath();
	ctx.moveTo(FACE_W * 0.42, FACE_H * 0.7);
	ctx.lineTo(FACE_W * 0.58, FACE_H * 0.7);
	ctx.stroke();
	ctx.globalCompositeOperation = 'destination-in';
	ctx.beginPath();
	ctx.ellipse(FACE_W / 2, FACE_H / 2, FACE_W / 2, FACE_H / 2, 0, 0, Math.PI * 2);
	ctx.fill();
	return c;
}

function tieStripes() {
	const [c, ctx] = canvas(32, 128);
	ctx.fillStyle = '#20355e';
	ctx.fillRect(0, 0, 32, 128);
	ctx.strokeStyle = '#9fc3e8';
	ctx.lineWidth = 5;
	for (let y = -32; y < 160; y += 16) {
		ctx.beginPath();
		ctx.moveTo(0, y);
		ctx.lineTo(32, y - 22);
		ctx.stroke();
	}
	return c;
}

function bricks() {
	const [c, ctx] = canvas(256, 256);
	ctx.fillStyle = '#b9b2a4';
	ctx.fillRect(0, 0, 256, 256);
	const rows = 12;
	const bh = 256 / rows;
	const bw = bh * 2.4;
	for (let r = 0; r < rows; r++) {
		const shift = r % 2 ? bw / 2 : 0;
		for (let x = -bw; x < 256 + bw; x += bw) {
			const h = 8 + Math.random() * 10;
			const l = 34 + Math.random() * 14;
			ctx.fillStyle = `hsl(${h}, ${42 + Math.random() * 12}%, ${l}%)`;
			ctx.fillRect(x + shift + 1.5, r * bh + 1.5, bw - 3, bh - 3);
		}
	}
	return c;
}

function windowPane() {
	const [c, ctx] = canvas(192, 320);
	ctx.fillStyle = '#3c4a58';
	ctx.fillRect(0, 0, 192, 320);
	const g = ctx.createLinearGradient(0, 0, 192, 320);
	g.addColorStop(0, 'rgba(255,255,255,0.18)');
	g.addColorStop(1, 'rgba(255,255,255,0)');
	ctx.fillStyle = g;
	ctx.fillRect(0, 0, 192, 320);
	ctx.strokeStyle = '#e9e6df';
	ctx.lineWidth = 7;
	ctx.strokeRect(3.5, 3.5, 185, 313);
	ctx.lineWidth = 4;
	for (let x = 48; x < 192; x += 48) {
		ctx.beginPath();
		ctx.moveTo(x, 0);
		ctx.lineTo(x, 320);
		ctx.stroke();
	}
	for (let y = 40; y < 320; y += 40) {
		ctx.beginPath();
		ctx.moveTo(0, y);
		ctx.lineTo(192, y);
		ctx.stroke();
	}
	// the curly transom bar halfway up
	ctx.lineWidth = 3;
	ctx.beginPath();
	for (let x = 0; x <= 192; x += 24) ctx.arc(x + 12, 160, 12, Math.PI, 0, false);
	ctx.stroke();
	return c;
}

function banner() {
	const [c, ctx] = canvas(128, 768);
	ctx.fillStyle = '#1b2440';
	ctx.fillRect(0, 0, 128, 768);
	ctx.fillStyle = '#e8e4d8';
	ctx.font = 'italic 900 78px "Apple Chancery", "Snell Roundhand", "Palatino", Georgia, serif';
	ctx.textAlign = 'center';
	ctx.textBaseline = 'middle';
	ctx.save();
	ctx.translate(64, 384);
	ctx.rotate(Math.PI / 2);
	ctx.fillText('Class of 2034', 0, 0);
	ctx.restore();
	return c;
}

/* ---------------------------------------------------------------- crowd layout */

const TIER = 0.42;
const ROW_Z0 = 1.3;
const ROW_DZ = 0.62;
const ROWS_N = 8;
const PER_ROW = 17;
const LEAD_ROW = 4;
const BACK = ROWS_N - 1; // the back row stands at the door

interface Spot {
	pos: THREE.Vector3;
	u: number; // shirt-widths right of the lead on screen
	v: number; // shirt-heights below the lead on screen
	gain: number;
	delay: number;
	motion: Motion;
}

function hash(n: number) {
	const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
	return x - Math.floor(x);
}

function layout() {
	const spots: Spot[] = [];
	let lead: Spot | null = null;
	for (let r = 0; r < ROWS_N; r++) {
		for (let i = 0; i < PER_ROW; i++) {
			const n = r * PER_ROW + i;
			const x = (i - (PER_ROW - 1) / 2) * 0.5 + (r % 2 ? 0.25 : 0) + (hash(n) - 0.5) * 0.12;
			const y = TIER * r;
			const z = ROW_Z0 - ROW_DZ * r + (hash(n + 99) - 0.5) * 0.2;
			const spot: Spot = {
				pos: new THREE.Vector3(x, y, z),
				u: 0,
				v: 0,
				gain: 0.8 + hash(n + 13) * 0.5,
				delay: hash(n + 31) * 0.25,
				motion: { bend: 0, sway: 0, headTilt: 0, armsUp: 0, shake: 0, seed: hash(n + 7) * 100, time: 0 },
			};
			if (r === LEAD_ROW && i === (PER_ROW - 1) / 2) {
				spot.pos.set(0, y, ROW_Z0 - ROW_DZ * r);
				lead = spot;
			} else spots.push(spot);
		}
	}
	// Screen offsets from the lead, in shirt units: rows behind sit higher on the tiers
	for (const s of spots) {
		s.u = (s.pos.x - lead!.pos.x) / SHIRT;
		s.v = -(s.pos.y - lead!.pos.y) / SHIRT - (lead!.pos.z - s.pos.z) * 0.12;
	}
	return { lead: lead!, spots };
}

/* ---------------------------------------------------------------- the school */

const WALL_Z = ROW_Z0 - ROW_DZ * BACK - 0.7;

function buildSet(scene: THREE.Scene) {
	const brick = new THREE.MeshStandardMaterial({ map: textureFrom(bricks(), [7, 4.7]), roughness: 1 });
	const wall = new THREE.Mesh(new THREE.PlaneGeometry(18, 12), brick);
	wall.position.set(0, 6, WALL_Z);
	scene.add(wall);
	// The arched doorway: a dark recess behind an opening drawn in front of the wall
	const shape = new THREE.Shape();
	shape.moveTo(-1.25, 0);
	shape.lineTo(-1.25, 2.9);
	shape.absarc(0, 2.9, 1.25, Math.PI, 0, true);
	shape.lineTo(1.25, 0);
	shape.closePath();
	const recess = new THREE.Mesh(
		new THREE.ExtrudeGeometry(shape, { depth: 1.6, bevelEnabled: false }),
		new THREE.MeshStandardMaterial({ color: 0x14110f, roughness: 1, side: THREE.BackSide }),
	);
	recess.position.set(0, TIER * BACK, WALL_Z - 1.55);
	scene.add(recess);
	const door = new THREE.Mesh(new THREE.PlaneGeometry(2.5, 4.3), new THREE.MeshStandardMaterial({ color: 0x2b2017, roughness: 1 }));
	door.position.set(0, TIER * BACK + 2.1, WALL_Z - 1.5);
	scene.add(door);
	// Brick ring around the arch and the maroon canopy over it
	const ring = new THREE.Mesh(new THREE.RingGeometry(1.25, 1.55, 32, 1, 0, Math.PI), new THREE.MeshStandardMaterial({ color: 0x8c4a3a, roughness: 1 }));
	ring.position.set(0, TIER * BACK + 2.9, WALL_Z + 0.01);
	scene.add(ring);
	const hood = new THREE.Shape();
	const hy = TIER * BACK + 4.2;
	hood.moveTo(-3.4, hy);
	hood.lineTo(-2.1, hy);
	hood.lineTo(0, hy + 2.1);
	hood.lineTo(2.1, hy);
	hood.lineTo(3.4, hy);
	hood.lineTo(3.4, hy + 0.3);
	hood.lineTo(2.2, hy + 0.3);
	hood.lineTo(0, hy + 2.5);
	hood.lineTo(-2.2, hy + 0.3);
	hood.lineTo(-3.4, hy + 0.3);
	hood.closePath();
	const canopy = new THREE.Mesh(new THREE.ExtrudeGeometry(hood, { depth: 0.35, bevelEnabled: false }), new THREE.MeshStandardMaterial({ color: 0x6e2a3a, roughness: 0.9 }));
	canopy.position.set(0, 0, WALL_Z);
	scene.add(canopy);
	// The bust in its niche above the door
	const niche = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.7, 0.2), new THREE.MeshStandardMaterial({ color: 0xcfc8b8 }));
	niche.position.set(0, hy + 3.1, WALL_Z + 0.1);
	scene.add(niche);
	const bust = new THREE.Mesh(new THREE.SphereGeometry(0.17, 12, 10), new THREE.MeshStandardMaterial({ color: 0xe9e4d8 }));
	bust.position.set(0, hy + 3.3, WALL_Z + 0.22);
	scene.add(bust);
	// Windows and the banners hanging beside them
	const pane = new THREE.MeshStandardMaterial({ map: textureFrom(windowPane()), roughness: 0.4, metalness: 0.2 });
	const paneGeo = new THREE.PlaneGeometry(2.2, 3.6);
	const bannerMat = new THREE.MeshStandardMaterial({ map: textureFrom(banner()), roughness: 1, side: THREE.DoubleSide });
	const bannerGeo = new THREE.PlaneGeometry(0.85, 5.1);
	for (const side of [-1, 1]) {
		const w = new THREE.Mesh(paneGeo, pane);
		w.position.set(side * 4.7, TIER * BACK + 3.4, WALL_Z + 0.02);
		scene.add(w);
		const b = new THREE.Mesh(bannerGeo, bannerMat);
		b.position.set(side * 4.35, TIER * BACK + 4.0, WALL_Z + 0.3);
		scene.add(b);
	}
	// The yard and the bleachers
	const ground = new THREE.Mesh(new THREE.PlaneGeometry(60, 60), new THREE.MeshStandardMaterial({ color: 0x5c5d5f, roughness: 1 }));
	ground.rotation.x = -Math.PI / 2;
	scene.add(ground);
	const wood = new THREE.MeshStandardMaterial({ color: 0x2c2a28, roughness: 1 });
	for (let k = 1; k < BACK; k++) {
		const step = new THREE.Mesh(new THREE.BoxGeometry(9.5, TIER * k, ROW_DZ + 0.04), wood);
		step.position.set(0, (TIER * k) / 2, ROW_Z0 - ROW_DZ * k);
		scene.add(step);
	}
	const porch = new THREE.Mesh(new THREE.BoxGeometry(18, TIER * BACK, 1.6), new THREE.MeshStandardMaterial({ color: 0x4a4744, roughness: 1 }));
	porch.position.set(0, (TIER * BACK) / 2, WALL_Z + 0.75);
	scene.add(porch);
}

/* ---------------------------------------------------------------- face cut-out */

function placeholderFace() {
	const [c, ctx] = canvas(FACE_W, FACE_H);
	ctx.drawImage(genericFace(), 0, 0);
	ctx.globalCompositeOperation = 'multiply';
	ctx.fillStyle = '#e8c4a8';
	ctx.fillRect(0, 0, FACE_W, FACE_H);
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
		const [out, ctx] = canvas(FACE_W, FACE_H);
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

const FOV = 16;
const CLOSEUP_FOV = 36;
const ASPECT = 16 / 9;

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
	private readonly lead: Puppets;
	private readonly crowd: Puppets;
	private readonly leadSpot: Spot;
	private readonly spots: Spot[];
	private readonly genericTexture: THREE.Texture;
	private faceTexture: THREE.Texture;
	private allFaces = false;
	private cinematic = true;
	private readonly camTarget = new THREE.Vector3(0, 1, 0);
	private readonly camPos = new THREE.Vector3(0, 1.5, 6);
	private readonly anchor = [0.5, 0.5, 0.2];
	private readonly field = [0, 0, 0];
	private raf = 0;
	private start = 0;
	private lastT = 0;

	constructor(private readonly root: HTMLElement) {
		this.canvas = root.querySelector('canvas[data-stage]')!;
		const { signal } = this.abort;
		const q = <T extends HTMLElement>(sel: string) => root.querySelector<T>(sel)!;

		this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true });
		this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
		this.scene.background = new THREE.Color(0xc2c7cc);
		this.camera = new THREE.PerspectiveCamera(FOV, ASPECT, 0.1, 80);
		this.controls = new OrbitControls(this.camera, this.canvas);
		this.controls.enablePan = false;
		this.controls.enableZoom = false;
		this.controls.enableDamping = true;
		this.controls.maxPolarAngle = Math.PI * 0.53;
		this.controls.minPolarAngle = Math.PI * 0.2;
		this.controls.minAzimuthAngle = -Math.PI * 0.45;
		this.controls.maxAzimuthAngle = Math.PI * 0.45;
		this.controls.addEventListener('start', () => this.setCinematic(false));
		// Let the page scroll vertically over the canvas on a phone; sideways drags still orbit
		this.canvas.style.touchAction = 'pan-y';

		// An overcast day in Leeds
		this.scene.add(new THREE.HemisphereLight(0xe6ebf2, 0x50524f, 1.5));
		const sun = new THREE.DirectionalLight(0xfff4e6, 1.0);
		sun.position.set(4, 9, 7);
		this.scene.add(sun);
		buildSet(this.scene);

		const tieTexture = textureFrom(tieStripes());
		this.genericTexture = textureFrom(genericFace());
		this.faceTexture = textureFrom(placeholderFace());
		const { lead, spots } = layout();
		this.leadSpot = lead;
		this.spots = spots;
		this.lead = new Puppets(1, () => ({ blazer: false, skin: SKINS[0], hair: HAIRS[4], scale: 1 }), this.faceTexture, tieTexture);
		this.crowd = new Puppets(
			spots.length,
			(i) => ({
				blazer: true,
				skin: SKINS[Math.floor(hash(i + 1000) * SKINS.length)],
				hair: HAIRS[Math.floor(hash(i + 2000) * HAIRS.length)],
				scale: 0.94 + hash(i + 3000) * 0.1,
			}),
			this.genericTexture,
			tieTexture,
		);
		this.crowd.setFace(this.genericTexture, true);
		this.scene.add(this.lead.group, this.crowd.group);

		this.cropper = new Cropper(q('canvas[data-crop]'), q('[data-zoom]'), signal);
		const file = q<HTMLInputElement>('[data-file]');
		file.addEventListener('change', () => this.pick(file), { signal });
		q('[data-ok]').addEventListener('click', () => this.confirm(), { signal });
		q('[data-cancel]').addEventListener('click', () => this.closeCropper(), { signal });
		q('[data-reset]').addEventListener('click', () => this.setFace(placeholderFace()), { signal });
		q('[data-camera]').addEventListener('click', () => this.setCinematic(true), { signal });
		const crowdBox = q<HTMLInputElement>('[data-crowd]');
		crowdBox.addEventListener('change', () => (this.crowd.group.visible = crowdBox.checked), { signal });
		const all = q<HTMLInputElement>('[data-allfaces]');
		all.addEventListener(
			'change',
			() => {
				this.allFaces = all.checked;
				this.applyFaces();
			},
			{ signal },
		);

		this.resize = new ResizeObserver(() => this.fit());
		this.resize.observe(this.canvas);
		this.fit();
		this.observer = new IntersectionObserver(([entry]) => (entry.isIntersecting ? this.play() : this.pause()));
		this.observer.observe(root);
		// Jump to a scene time, for poking at it from the console
		(root as HTMLElement & { seek?: (t: number) => void }).seek = (t) => (this.start = performance.now() - t * 1000);
	}

	destroy() {
		this.abort.abort();
		this.pause();
		this.observer.disconnect();
		this.resize.disconnect();
		this.controls.dispose();
		this.lead.dispose();
		this.crowd.dispose();
		this.renderer.dispose();
	}

	private setCinematic(on: boolean) {
		this.cinematic = on;
		this.root.querySelector<HTMLElement>('[data-camera]')!.hidden = on;
	}

	private setFace(c: HTMLCanvasElement) {
		this.faceTexture.dispose();
		this.faceTexture = textureFrom(c);
		this.applyFaces();
	}

	private applyFaces() {
		this.lead.setFace(this.faceTexture, false);
		if (this.allFaces) this.crowd.setFace(this.faceTexture, false);
		else this.crowd.setFace(this.genericTexture, true);
	}

	private fit() {
		const w = this.canvas.clientWidth;
		if (!w) return;
		const h = Math.round(w / ASPECT);
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
		this.start = performance.now() - this.lastT * 1000;
		const tick = (now: number) => {
			this.raf = requestAnimationFrame(tick);
			this.frame(((now - this.start) / 1000) % LOOP);
		};
		this.raf = requestAnimationFrame(tick);
	}

	private pause() {
		cancelAnimationFrame(this.raf);
		this.raf = 0;
	}

	private frame(t: number) {
		const dt = Math.max(0, Math.min(0.1, t - this.lastT));
		this.lastT = t;
		const g = t - CLOSEUP; // seconds into the class photo (negative during the close-up)

		leadPose(t, this.lead.jointsOf(0));
		this.lead.place(0, this.leadSpot.pos);
		this.lead.commit();

		if (this.crowd.group.visible) {
			const k = 1 - Math.exp(-dt * 9); // smoothing so cell boundaries don't snap
			for (const [i, s] of this.spots.entries()) {
				const m = s.motion;
				m.time = t;
				fieldAt(g - s.delay, s.u, s.v, this.field);
				const dx = this.field[0] * s.gain;
				const dy = this.field[1] * s.gain;
				// A patch rarely moves a whole shirt-height, so the response saturates early
				const soft = (d: number) => {
					const a = Math.max(0, Math.abs(d) - 0.03);
					return Math.sign(d) * Math.min(1, Math.pow(a / 0.18, 0.75));
				};
				const bend = soft(dy) * (dy > 0 ? 1.6 : 0.9);
				const sway = -soft(dx) * 0.7;
				const shake = Math.max(0, this.field[2] * s.gain - 0.12);
				m.bend += (bend - m.bend) * k;
				m.sway += (sway - m.sway) * k;
				m.shake += (shake - m.shake) * k;
				m.headTilt += ((bend < 0 ? 0.9 * bend : -0.35 * bend) - m.headTilt) * k;
				const arms = Math.max(0, Math.min(1, shake * 2.5 + Math.abs(bend) * 0.9));
				m.armsUp += (arms - m.armsUp) * k * 0.5;
				proceduralPose(m, this.crowd.jointsOf(i));
				this.crowd.place(i, s.pos);
			}
			this.crowd.commit();
		}

		if (this.cinematic) this.aim(g, dt);
		else this.controls.update();
		this.renderer.render(this.scene, this.camera);
	}

	/** Reproduce the video's framing: a long lens that pulls back as the shirt shrinks in frame */
	private aim(g: number, dt: number) {
		const chestY = this.leadSpot.pos.y + 0.9 + 0.35;
		const k = 1 - Math.exp(-dt * 4);
		const fov = g < 0 ? CLOSEUP_FOV : FOV;
		if (this.camera.fov !== fov) {
			this.camera.fov = fov;
			this.camera.updateProjectionMatrix();
		}
		if (g < 0) {
			// close-up: a wider lens right in front of the face, between the heads of the row ahead
			this.lead.head(0, va, vb);
			vb.y = Math.max(-0.35, Math.min(0.25, vb.y));
			vb.normalize();
			if (vb.z < 0.4) vb.set(0, 0, 1);
			this.camTarget.lerp(va, this.lastT < 0.05 ? 1 : k);
			vc.copy(va).addScaledVector(vb, 0.85);
			vc.y += 0.03;
			this.camPos.lerp(vc, this.lastT < 0.05 ? 1 : k);
		} else {
			anchorAt(g, this.anchor);
			const dist = SHIRT / (2 * Math.tan((FOV / 2) * (Math.PI / 180)) * this.anchor[2]);
			const viewH = 2 * dist * Math.tan((FOV / 2) * (Math.PI / 180));
			const viewW = viewH * this.camera.aspect;
			va.set(this.leadSpot.pos.x + (0.5 - this.anchor[0]) * viewW, chestY + (this.anchor[1] - 0.5) * viewH, this.leadSpot.pos.z);
			vb.set(va.x, va.y + 0.35, va.z + dist);
			const snap = g < 0.05;
			this.camTarget.lerp(va, snap ? 1 : k);
			this.camPos.lerp(vb, snap ? 1 : k);
		}
		if (!Number.isFinite(this.camPos.x + this.camPos.y + this.camPos.z + this.camTarget.x + this.camTarget.y + this.camTarget.z)) {
			this.camPos.set(0, 2.5, 12);
			this.camTarget.set(0, 1.8, 0);
		}
		this.camera.position.copy(this.camPos);
		this.camera.lookAt(this.camTarget);
		this.controls.target.copy(this.camTarget);
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
