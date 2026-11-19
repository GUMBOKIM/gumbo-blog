/**
 * Draws one RGB cube per paint target in a single WebGL canvas. Seen along the black to white
 * axis a cube is a regular hexagon, so every target can be compared at the same angle.
 * Loaded on demand because three.js is only needed once the reader reaches this demo.
 */
import {
	Box3,
	BufferGeometry,
	CanvasTexture,
	DataTexture,
	DoubleSide,
	Float32BufferAttribute,
	Group,
	LinearSRGBColorSpace,
	Mesh,
	MeshBasicMaterial,
	NearestFilter,
	NoColorSpace,
	OrthographicCamera,
	Quaternion,
	Raycaster,
	RGBAFormat,
	Scene,
	Sprite,
	SpriteMaterial,
	UnsignedByteType,
	Vector2,
	Vector3,
	WebGLRenderer,
} from 'three';
import type { RGB } from './engine';

export type CubeSide = 'white' | 'black';

export interface CubeCell {
	view: HTMLElement;
	convert: (rgb: RGB) => RGB;
}

export interface CubeOptions {
	stage: HTMLElement;
	canvas: HTMLCanvasElement;
	cells: CubeCell[];
	onPick: (rgb: RGB) => void;
	onRotate: () => void;
}

type Corner = readonly [number, number, number];

/** Each face as three corners in RGB space: the origin, the end of u, and the end of v */
const FACES: readonly (readonly [Corner, Corner, Corner])[] = [
	[[1, 0, 0], [1, 1, 0], [1, 0, 1]],
	[[0, 0, 0], [0, 1, 0], [0, 0, 1]],
	[[0, 1, 0], [1, 1, 0], [0, 1, 1]],
	[[0, 0, 0], [1, 0, 0], [0, 0, 1]],
	[[0, 0, 1], [1, 0, 1], [0, 1, 1]],
	[[0, 0, 0], [1, 0, 0], [0, 1, 0]],
];

const TEXTURE_SIZE = 128;
const DRAG_SPEED = 0.01;
const CLICK_SLOP_PX = 6;
const TURN_MS = 450;

function faceGeometry([a, b, c]: readonly [Corner, Corner, Corner]) {
	const d = [b[0] + c[0] - a[0], b[1] + c[1] - a[1], b[2] + c[2] - a[2]];
	const geometry = new BufferGeometry();
	geometry.setAttribute('position', new Float32BufferAttribute([...a, ...b, ...c, ...d].map((v) => v - 0.5), 3));
	geometry.setAttribute('uv', new Float32BufferAttribute([0, 0, 1, 0, 0, 1, 1, 1], 2));
	geometry.setIndex([0, 1, 2, 2, 1, 3]);
	return geometry;
}

/** Bakes the converted colors of one face, sampled at the center of each texel */
function faceTexture([a, b, c]: readonly [Corner, Corner, Corner], convert: CubeCell['convert']) {
	const data = new Uint8Array(TEXTURE_SIZE * TEXTURE_SIZE * 4);
	let i = 0;
	for (let y = 0; y < TEXTURE_SIZE; y++) {
		const v = (y + 0.5) / TEXTURE_SIZE;
		for (let x = 0; x < TEXTURE_SIZE; x++) {
			const u = (x + 0.5) / TEXTURE_SIZE;
			const at = (axis: number) => Math.round((a[axis] + u * (b[axis] - a[axis]) + v * (c[axis] - a[axis])) * 255);
			const [red, green, blue] = convert([at(0), at(1), at(2)]);
			data[i++] = red;
			data[i++] = green;
			data[i++] = blue;
			data[i++] = 255;
		}
	}
	const texture = new DataTexture(data, TEXTURE_SIZE, TEXTURE_SIZE, RGBAFormat, UnsignedByteType);
	texture.magFilter = texture.minFilter = NearestFilter;
	// The texels are final sRGB values, so nothing may convert them on the way to the screen.
	texture.colorSpace = NoColorSpace;
	texture.needsUpdate = true;
	return texture;
}

function markerTexture() {
	const canvas = document.createElement('canvas');
	canvas.width = canvas.height = 64;
	const ctx = canvas.getContext('2d');
	if (ctx) {
		ctx.lineWidth = 12;
		ctx.strokeStyle = '#000000';
		ctx.beginPath();
		ctx.arc(32, 32, 22, 0, Math.PI * 2);
		ctx.stroke();
		ctx.lineWidth = 6;
		ctx.strokeStyle = '#ffffff';
		ctx.stroke();
	}
	const texture = new CanvasTexture(canvas);
	texture.colorSpace = NoColorSpace;
	return texture;
}

/** The orientation that puts a corner toward the camera and the red corner at the top */
function hexagonView(side: CubeSide) {
	const toCamera = new Vector3(0, 0, 1);
	const corner = new Vector3(1, 1, 1).normalize().multiplyScalar(side === 'white' ? 1 : -1);
	const view = new Quaternion().setFromUnitVectors(corner, toCamera);
	const red = new Vector3(0.5, -0.5, -0.5).applyQuaternion(view);
	const spin = new Quaternion().setFromAxisAngle(toCamera, Math.PI / 2 - Math.atan2(red.y, red.x));
	return view.premultiply(spin);
}

export function startCube({ stage, canvas, cells, onPick, onRotate }: CubeOptions) {
	const renderer = new WebGLRenderer({ canvas, alpha: true, antialias: true });
	renderer.outputColorSpace = LinearSRGBColorSpace;
	renderer.setClearColor(0x000000, 0);
	renderer.setScissorTest(true);
	// All cubes share one canvas, so it is cleared once per frame rather than once per cube.
	renderer.autoClear = false;

	const scene = new Scene();
	const pivot = new Group();
	pivot.quaternion.copy(hexagonView('white'));
	scene.add(pivot);

	// Wide enough for the cube's longest diagonal, so turning it never clips a corner.
	const reach = 0.9;
	const camera = new OrthographicCamera(-reach, reach, reach, -reach, 0.1, 10);
	camera.position.z = 4;

	const geometries = FACES.map(faceGeometry);
	const textures: DataTexture[] = [];
	const materials: MeshBasicMaterial[] = [];
	const groups = cells.map(() => {
		const group = new Group();
		group.visible = false;
		pivot.add(group);
		return group;
	});

	const ringTexture = markerTexture();
	const ringMaterial = new SpriteMaterial({ map: ringTexture, depthTest: false, depthWrite: false, transparent: true });
	const ring = new Sprite(ringMaterial);
	ring.scale.setScalar(0.2);
	ring.renderOrder = 10;
	ring.visible = false;
	pivot.add(ring);

	let frame = 0;
	let stopped = false;
	const draw = () => {
		frame = 0;
		if (stopped) return;
		const stageBox = stage.getBoundingClientRect();
		renderer.setScissor(0, 0, stageBox.width, stageBox.height);
		renderer.clear();
		cells.forEach(({ view }, index) => {
			const box = view.getBoundingClientRect();
			const left = box.left - stageBox.left;
			const bottom = stageBox.bottom - box.bottom;
			renderer.setViewport(left, bottom, box.width, box.height);
			renderer.setScissor(left, bottom, box.width, box.height);
			for (const [i, group] of groups.entries()) group.visible = i === index && group.userData.ready === true;
			renderer.render(scene, camera);
		});
	};
	const invalidate = () => {
		if (!frame && !stopped) frame = requestAnimationFrame(draw);
	};

	const resize = () => {
		renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
		renderer.setSize(stage.clientWidth, stage.clientHeight, false);
		invalidate();
	};
	const observer = new ResizeObserver(resize);
	observer.observe(stage);
	resize();

	// Baking every face takes a moment, so hand one target per frame back to the page.
	const bake = async () => {
		for (const [index, cell] of cells.entries()) {
			await new Promise(requestAnimationFrame);
			if (stopped) return;
			FACES.forEach((face, i) => {
				const map = faceTexture(face, cell.convert);
				const material = new MeshBasicMaterial({ map, side: DoubleSide });
				textures.push(map);
				materials.push(material);
				groups[index].add(new Mesh(geometries[i], material));
			});
			groups[index].userData.ready = true;
			invalidate();
		}
	};
	void bake();

	let turn = 0;
	const stopTurn = () => {
		cancelAnimationFrame(turn);
		turn = 0;
	};
	const setSide = (side: CubeSide) => {
		stopTurn();
		const from = pivot.quaternion.clone();
		const to = hexagonView(side);
		if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
			pivot.quaternion.copy(to);
			invalidate();
			return;
		}
		const start = performance.now();
		const step = (now: number) => {
			const t = Math.min((now - start) / TURN_MS, 1);
			pivot.quaternion.slerpQuaternions(from, to, t * t * (3 - 2 * t));
			draw();
			turn = t < 1 ? requestAnimationFrame(step) : 0;
		};
		turn = requestAnimationFrame(step);
	};

	const setMarker = ([red, green, blue]: RGB) => {
		ring.position.set(red / 255 - 0.5, green / 255 - 0.5, blue / 255 - 0.5);
		ring.visible = true;
		invalidate();
	};

	const raycaster = new Raycaster();
	const bounds = new Box3(new Vector3(-0.5, -0.5, -0.5), new Vector3(0.5, 0.5, 0.5));
	/** Finds the color under the pointer on the face of whichever cube was pressed */
	const pickAt = (x: number, y: number): RGB | null => {
		for (const { view } of cells) {
			const box = view.getBoundingClientRect();
			if (x < box.left || x > box.right || y < box.top || y > box.bottom) continue;
			const pointer = new Vector2(((x - box.left) / box.width) * 2 - 1, -((y - box.top) / box.height) * 2 + 1);
			camera.updateMatrixWorld();
			raycaster.setFromCamera(pointer, camera);
			pivot.updateMatrixWorld();
			const ray = raycaster.ray.clone().applyMatrix4(pivot.matrixWorld.clone().invert());
			const hit = ray.intersectBox(bounds, new Vector3());
			if (!hit) return null;
			const channel = (value: number) => Math.max(0, Math.min(255, Math.round((value + 0.5) * 255)));
			return [channel(hit.x), channel(hit.y), channel(hit.z)];
		}
		return null;
	};

	let press: { id: number; x: number; y: number; lastX: number; lastY: number; moved: boolean } | null = null;
	const spinX = new Quaternion();
	const spinY = new Quaternion();
	const axisX = new Vector3(1, 0, 0);
	const axisY = new Vector3(0, 1, 0);

	const onDown = (event: PointerEvent) => {
		if (event.button !== 0) return;
		press = { id: event.pointerId, x: event.clientX, y: event.clientY, lastX: event.clientX, lastY: event.clientY, moved: false };
		stage.setPointerCapture(event.pointerId);
	};
	const onMove = (event: PointerEvent) => {
		if (!press || event.pointerId !== press.id) return;
		if (!press.moved && Math.hypot(event.clientX - press.x, event.clientY - press.y) < CLICK_SLOP_PX) return;
		if (!press.moved) {
			press.moved = true;
			stopTurn();
			onRotate();
		}
		spinY.setFromAxisAngle(axisY, (event.clientX - press.lastX) * DRAG_SPEED);
		spinX.setFromAxisAngle(axisX, (event.clientY - press.lastY) * DRAG_SPEED);
		pivot.quaternion.premultiply(spinY).premultiply(spinX).normalize();
		press.lastX = event.clientX;
		press.lastY = event.clientY;
		invalidate();
	};
	const onUp = (event: PointerEvent) => {
		if (!press || event.pointerId !== press.id) return;
		const picked = press.moved ? null : pickAt(event.clientX, event.clientY);
		press = null;
		if (picked) onPick(picked);
	};
	const onCancel = () => {
		press = null;
	};
	stage.addEventListener('pointerdown', onDown);
	stage.addEventListener('pointermove', onMove);
	stage.addEventListener('pointerup', onUp);
	stage.addEventListener('pointercancel', onCancel);

	const dispose = () => {
		stopped = true;
		stopTurn();
		cancelAnimationFrame(frame);
		observer.disconnect();
		stage.removeEventListener('pointerdown', onDown);
		stage.removeEventListener('pointermove', onMove);
		stage.removeEventListener('pointerup', onUp);
		stage.removeEventListener('pointercancel', onCancel);
		for (const item of [...geometries, ...textures, ...materials, ringTexture, ringMaterial]) item.dispose();
		renderer.dispose();
	};

	return { setSide, setMarker, dispose };
}
