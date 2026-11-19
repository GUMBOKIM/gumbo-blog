/**
 * Runs the forced dark demos: repaints the sample page per color role, explains the element
 * the reader picks, compares one color across roles, and probes the reader's own browser.
 */
import {
	SMALL_BOX_PX,
	brightness,
	chromium,
	luma,
	parseHex,
	samsung,
	samsungLuma,
	toHex,
	type RGB,
	type Role,
	shapeRole,
} from './engine';
import measured from './measured.json';

type Mode = 'original' | 'samsung' | 'chromium' | 'invert';

interface Strings {
	roles: Record<string, string>;
	props: Record<string, string>;
	luma: string;
	flipped: string;
	kept: string;
	imageSamsung: string;
	imageChromium: string;
	canvas: string;
	invert: string;
	original: string;
	empty: string;
	detected: string;
	clean: string;
	notSamsung: string;
	failed: string;
	live: string;
	rampRoles: Record<string, string>;
	cubeFailed: string;
}

interface Slot {
	prop: string;
	role: Role;
	value: string;
}

const COLOR = /rgba?\(([^)]+)\)/g;

function parseColor(body: string) {
	const [r, g, b, a = 1] = body.split(/[\s,/]+/).filter(Boolean).map(Number);
	return { rgb: [r, g, b] as RGB, alpha: a };
}

const convert = (mode: Mode, rgb: RGB, role: Role): RGB =>
	mode === 'samsung' ? samsung(rgb, role) : mode === 'chromium' ? chromium(rgb, role) : rgb;

function repaint(value: string, role: Role, mode: Mode) {
	return value.replace(COLOR, (_, body: string) => {
		const { rgb, alpha } = parseColor(body);
		const [r, g, b] = convert(mode, rgb, role);
		return alpha === 1 ? `rgb(${r}, ${g}, ${b})` : `rgba(${r}, ${g}, ${b}, ${alpha})`;
	});
}

function backgroundRole(el: Element): Role {
	// The sample is an ordinary box inside this page, so even its outermost element is a plain background.
	if (el.tagName === 'BUTTON') return 'button';
	if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') return 'field';
	if (el.tagName === 'SELECT') return 'button';
	const box = el.getBoundingClientRect();
	// Measured: a box up to 20 CSS px in both directions is painted like text.
	return box.width <= SMALL_BOX_PX && box.height <= SMALL_BOX_PX ? 'text' : 'background';
}

/** Reads the colors an element paints, tagged with the role a browser would paint them under */
function readSlots(el: Element): Slot[] {
	const css = getComputedStyle(el);
	const slots: Slot[] = [];
	const add = (prop: string, role: Role, value: string) => {
		if (value && COLOR.test(value)) slots.push({ prop, role, value });
		COLOR.lastIndex = 0;
	};

	if (el instanceof SVGElement) {
		if (el.tagName !== 'svg') {
			const box = el.getBoundingClientRect();
			const role = shapeRole(el.tagName, box.width, box.height);
			add('fill', role, css.fill);
			add('stroke', role, css.stroke);
		}
		return slots;
	}

	add('color', 'text', css.color);
	add('background-color', backgroundRole(el), css.backgroundColor);
	if (css.backgroundImage.includes('gradient')) add('background-image', 'gradient', css.backgroundImage);
	for (const side of ['top', 'right', 'bottom', 'left']) {
		if (parseFloat(css.getPropertyValue(`border-${side}-width`)) > 0) {
			add(`border-${side}-color`, 'border', css.getPropertyValue(`border-${side}-color`));
		}
	}
	if (css.boxShadow !== 'none') add('box-shadow', 'shadow', css.boxShadow);
	if (el.tagName === 'INPUT') add('--dl-placeholder', 'text', getComputedStyle(el, '::placeholder').color);
	return slots;
}

const isVisible = (value: string) => {
	COLOR.lastIndex = 0;
	const match = COLOR.exec(value);
	COLOR.lastIndex = 0;
	return match !== null && parseColor(match[1]).alpha > 0;
};

const firstColor = (value: string) => {
	COLOR.lastIndex = 0;
	const match = COLOR.exec(value);
	COLOR.lastIndex = 0;
	return match ? parseColor(match[1]).rgb : null;
};

/** A canvas chip, because forced dark leaves canvas pixels alone and CSS colors would be repainted */
function swatch(rgb: RGB) {
	const hex = toHex(rgb);
	const chip = document.createElement('canvas');
	chip.className = 'dl-chip';
	chip.width = chip.height = 1;
	const ctx = chip.getContext('2d');
	if (ctx) {
		ctx.fillStyle = hex;
		ctx.fillRect(0, 0, 1, 1);
	}
	const label = document.createElement('code');
	label.textContent = hex;
	const wrap = document.createElement('span');
	wrap.className = 'dl-swatch';
	wrap.append(chip, label);
	return wrap;
}

function mountLab(root: HTMLElement, t: Strings) {
	const sample = root.querySelector<HTMLElement>('[data-sample]')!;
	const report = root.querySelector<HTMLElement>('[data-report]')!;
	const buttons = [...root.querySelectorAll<HTMLButtonElement>('[data-mode]')];
	const nodes = [sample, ...sample.querySelectorAll<HTMLElement>('*')];
	const slots = new Map<Element, Slot[]>(nodes.map((el) => [el, readSlots(el)]));
	let mode: Mode = 'samsung';
	let picked: Element | null = sample.querySelector('[data-start]');

	const note = (text: string) => {
		const p = document.createElement('p');
		p.className = 'dl-note';
		p.textContent = text;
		return p;
	};

	const explain = (rgb: RGB, role: Role) => {
		if (mode === 'samsung') {
			return t.luma.replace('{from}', luma(rgb).toFixed(2)).replace('{to}', samsungLuma(rgb, role).toFixed(2));
		}
		if (mode === 'chromium') {
			const same = toHex(chromium(rgb, role)) === toHex(rgb);
			return (same ? t.kept : t.flipped).replace('{n}', String(brightness(rgb)));
		}
		return '';
	};

	const renderReport = () => {
		report.replaceChildren();
		if (!picked) {
			report.append(note(t.empty));
			return;
		}
		if (mode === 'invert') return report.append(note(t.invert));
		if (mode === 'original') return report.append(note(t.original));
		if (picked.tagName === 'IMG') return report.append(note(mode === 'samsung' ? t.imageSamsung : t.imageChromium));
		if (picked.tagName === 'CANVAS') return report.append(note(t.canvas));

		const seen = new Set<string>();
		for (const slot of slots.get(picked) ?? []) {
			const rgb = firstColor(slot.value);
			const key = `${slot.role}:${slot.value}`;
			if (!rgb || !isVisible(slot.value) || seen.has(key)) continue;
			seen.add(key);
			const row = document.createElement('div');
			row.className = 'dl-row';
			const title = document.createElement('strong');
			const prop = slot.prop.startsWith('border') ? 'border' : slot.prop;
			title.textContent = `${t.props[prop] ?? prop} · ${t.roles[slot.role]}`;
			const change = document.createElement('div');
			change.className = 'dl-change';
			const arrow = document.createElement('span');
			arrow.textContent = '→';
			arrow.setAttribute('aria-hidden', 'true');
			change.append(swatch(rgb), arrow, swatch(convert(mode, rgb, slot.role)));
			const why = document.createElement('small');
			why.textContent = explain(rgb, slot.role);
			row.append(title, change, why);
			report.append(row);
		}
		if (!report.childElementCount) report.append(note(t.empty));
	};

	const apply = () => {
		sample.classList.toggle('dl-inverted', mode === 'invert');
		const painted = mode === 'samsung' || mode === 'chromium';
		for (const [el, list] of slots) {
			const style = (el as HTMLElement).style;
			for (const slot of list) {
				if (painted) style.setProperty(slot.prop, repaint(slot.value, slot.role, mode));
				else style.removeProperty(slot.prop);
			}
			if (el.tagName === 'IMG') style.filter = mode === 'samsung' ? 'brightness(0.7)' : '';
		}
		for (const button of buttons) button.setAttribute('aria-pressed', String(button.dataset.mode === mode));
		renderReport();
	};

	const pick = (el: Element) => {
		picked?.removeAttribute('data-picked');
		picked = el;
		el.setAttribute('data-picked', '');
		renderReport();
	};

	for (const button of buttons) {
		button.addEventListener('click', () => {
			mode = button.dataset.mode as Mode;
			apply();
		});
	}
	// Capture and stop here so tapping the sample photo inspects it instead of opening the site lightbox.
	sample.addEventListener(
		'click',
		(event) => {
			event.preventDefault();
			event.stopPropagation();
			if (event.target instanceof Element) pick(event.target.closest('svg') ?? event.target);
		},
		true,
	);
	sample.addEventListener('keydown', (event) => {
		if ((event.key === 'Enter' || event.key === ' ') && event.target instanceof Element) {
			event.preventDefault();
			pick(event.target);
		}
	});

	// The sample photo must be a bitmap: forced dark repaints SVG shapes but only dims bitmaps.
	const photo = sample.querySelector('img');
	const painter = document.createElement('canvas');
	painter.width = 640;
	painter.height = 300;
	const paint = painter.getContext('2d');
	if (photo && paint) {
		const wall = paint.createLinearGradient(0, 0, 640, 300);
		wall.addColorStop(0, '#f7e3c4');
		wall.addColorStop(1, '#d9a766');
		paint.fillStyle = wall;
		paint.fillRect(0, 0, 640, 300);
		paint.fillStyle = 'rgba(255, 255, 255, 0.85)';
		paint.beginPath();
		paint.ellipse(320, 236, 250, 44, 0, 0, Math.PI * 2);
		paint.fill();
		for (const [x, y, rx, ry] of [
			[224, 176, 124, 76],
			[410, 184, 112, 66],
		]) {
			const crust = paint.createRadialGradient(x - 40, y - 30, 10, x, y, rx);
			crust.addColorStop(0, '#f2c078');
			crust.addColorStop(0.7, '#c47a2c');
			crust.addColorStop(1, '#8a4f1a');
			paint.fillStyle = crust;
			paint.beginPath();
			paint.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
			paint.fill();
		}
		photo.src = painter.toDataURL('image/png');
	}

	const chart = sample.querySelector('canvas');
	const ctx = chart?.getContext('2d');
	if (chart && ctx) {
		ctx.fillStyle = '#ffffff';
		ctx.fillRect(0, 0, chart.width, chart.height);
		[34, 52, 44, 70, 62, 88, 80].forEach((h, i) => {
			ctx.fillStyle = i === 5 ? '#ff5714' : '#ffd8c7';
			ctx.fillRect(10 + i * 40, 100 - h, 28, h);
		});
	}

	if (picked) picked.setAttribute('data-picked', '');
	apply();

	// On a phone with forced dark on, the browser already converts this page, so converting it
	// again would apply the filter twice. Show the original and let the browser do the work.
	void readWhite().then((sample) => {
		if (sample === null || sample >= FORCED_BELOW || !/SamsungBrowser/i.test(navigator.userAgent)) return;
		mode = 'original';
		apply();
		const live = root.querySelector<HTMLElement>('[data-live]');
		if (live) {
			live.textContent = t.live;
			live.hidden = false;
		}
	});
}

const PROBE_ROLES: Role[] = ['background', 'field', 'button', 'border', 'text', 'svg', 'image', 'bgimage'];

function mountProbe(root: HTMLElement, t: Strings) {
	const input = root.querySelector<HTMLInputElement>('input[type=color]')!;
	const value = root.querySelector<HTMLElement>('[data-value]')!;
	const body = root.querySelector<HTMLElement>('tbody')!;

	const render = () => {
		const rgb = parseHex(input.value);
		value.textContent = input.value.toUpperCase();
		body.replaceChildren(
			...PROBE_ROLES.map((role) => {
				const row = document.createElement('tr');
				const name = document.createElement('th');
				name.scope = 'row';
				name.textContent = t.roles[role];
				const left = document.createElement('td');
				left.append(swatch(samsung(rgb, role)));
				const right = document.createElement('td');
				right.append(swatch(chromium(rgb, role)));
				row.append(name, left, right);
				return row;
			}),
		);
	};
	input.addEventListener('input', render);
	render();
}

const FORCED_BELOW = 250;

const WHITE_SVG =
	'data:image/svg+xml,' +
	encodeURIComponent(
		'<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"><rect width="1" height="1" fill="#fff"/></svg>',
	);

/** Draws a white SVG into a canvas and reads it back; 255 means nothing dimmed it */
function readWhite() {
	return new Promise<number | null>((resolve) => {
		const image = new Image();
		const timer = setTimeout(() => resolve(null), 2000);
		image.onload = () => {
			clearTimeout(timer);
			try {
				const canvas = document.createElement('canvas');
				canvas.width = canvas.height = 1;
				const ctx = canvas.getContext('2d');
				if (!ctx) return resolve(null);
				ctx.drawImage(image, 0, 0, 1, 1);
				resolve(ctx.getImageData(0, 0, 1, 1).data[0]);
			} catch {
				resolve(null);
			}
		};
		image.onerror = () => {
			clearTimeout(timer);
			resolve(null);
		};
		image.src = WHITE_SVG;
	});
}

async function mountMine(root: HTMLElement, t: Strings) {
	const output = root.querySelector<HTMLElement>('[data-mine]')!;
	const sample = await readWhite();
	const samsungBrowser = /SamsungBrowser/i.test(navigator.userAgent);
	const message =
		sample === null ? t.failed : !samsungBrowser ? t.notSamsung : sample < FORCED_BELOW ? t.detected : t.clean;
	output.textContent = message.replace('{n}', String(sample));
	root.toggleAttribute('data-hit', samsungBrowser && sample !== null && sample < FORCED_BELOW);
}

/** Every paint target in the cube grid, with the key of its measured gray curve */
const CUBE_CELLS: readonly { key: string; role: Role | null }[] = [
	{ key: 'identity', role: null },
	{ key: 'background', role: 'background' },
	{ key: 'input', role: 'field' },
	{ key: 'button', role: 'button' },
	{ key: 'gradient', role: 'gradient' },
	{ key: 'outline', role: 'outline' },
	{ key: 'border', role: 'border' },
	{ key: 'shadow', role: 'shadow' },
	{ key: 'svg-rect', role: 'svg' },
	{ key: 'text', role: 'text' },
	{ key: 'img-png', role: 'image' },
	{ key: 'bg-png', role: 'bgimage' },
];

const CUBE_PRESETS = ['#000000', '#808080', '#ffffff', '#fee500', '#ff5714', '#1a73e8'];

function paintStrip(canvas: HTMLCanvasElement, values: readonly number[]) {
	const ctx = canvas.getContext('2d');
	if (!ctx) return;
	values.forEach((v, x) => {
		ctx.fillStyle = `rgb(${v}, ${v}, ${v})`;
		ctx.fillRect(x, 0, 1, 1);
	});
}

function paintChip(chip: HTMLCanvasElement, hex: string) {
	const ctx = chip.getContext('2d');
	if (!ctx) return;
	ctx.fillStyle = hex;
	ctx.fillRect(0, 0, 1, 1);
}

function mountCube(root: HTMLElement, t: Strings) {
	const stage = root.querySelector<HTMLElement>('[data-stage]')!;
	const canvas = root.querySelector<HTMLCanvasElement>('[data-gl]')!;
	const grid = root.querySelector<HTMLElement>('[data-grid]')!;
	const picker = root.querySelector<HTMLInputElement>('input[type=color]')!;
	const value = root.querySelector<HTMLElement>('[data-value]')!;
	const presetBox = root.querySelector<HTMLElement>('[data-presets]')!;
	const status = root.querySelector<HTMLElement>('[data-status]')!;
	const sides = [...root.querySelectorAll<HTMLButtonElement>('[data-side]')];
	const curves = measured as Record<string, number[]>;
	const identity = Array.from({ length: 256 }, (_, v) => v);

	const convertFor = (role: Role | null) => (rgb: RGB) => (role ? samsung(rgb, role) : rgb);

	const cells = CUBE_CELLS.map(({ key, role }) => {
		const figure = document.createElement('figure');
		figure.className = 'dl-cube-cell';
		const view = document.createElement('div');
		view.className = 'dl-cube-view';
		const caption = document.createElement('figcaption');
		const name = document.createElement('b');
		name.textContent = t.rampRoles[key];
		const chip = document.createElement('canvas');
		chip.className = 'dl-chip';
		chip.width = chip.height = 1;
		const hex = document.createElement('code');
		const out = document.createElement('span');
		out.className = 'dl-swatch';
		out.append(chip, hex);
		caption.append(name, out);
		const strip = document.createElement('canvas');
		strip.className = 'dl-cube-strip';
		strip.width = 256;
		strip.height = 1;
		strip.setAttribute('aria-hidden', 'true');
		const curve = role ? curves[key] : identity;
		paintStrip(strip, curve);
		figure.append(view, caption, strip);
		grid.append(figure);
		return { view, chip, hex, curve, convert: convertFor(role) };
	});

	const presets = CUBE_PRESETS.map((color) => {
		const button = document.createElement('button');
		button.type = 'button';
		button.className = 'dl-cube-preset';
		button.setAttribute('aria-label', color.toUpperCase());
		button.title = color.toUpperCase();
		const chip = document.createElement('canvas');
		chip.className = 'dl-chip';
		chip.width = chip.height = 1;
		paintChip(chip, color);
		button.append(chip);
		button.addEventListener('click', () => select(parseHex(color)));
		presetBox.append(button);
		return { button, color };
	});

	let handle: Awaited<ReturnType<typeof loadCube>> | null = null;
	let selected: RGB = parseHex(picker.value);

	function select(rgb: RGB) {
		selected = rgb;
		const hex = toHex(rgb);
		picker.value = hex;
		value.textContent = hex.toUpperCase();
		const gray = rgb[0] === rgb[1] && rgb[1] === rgb[2];
		for (const cell of cells) {
			// Grays were measured directly, so show the measured value instead of the formula's.
			const out: RGB = gray ? [cell.curve[rgb[0]], cell.curve[rgb[0]], cell.curve[rgb[0]]] : cell.convert(rgb);
			const outHex = toHex(out);
			paintChip(cell.chip, outHex);
			cell.hex.textContent = outHex;
		}
		for (const { button, color } of presets) button.setAttribute('aria-pressed', String(color === hex));
		handle?.setMarker(rgb);
	}

	const pressSide = (side: string | null) => {
		for (const button of sides) button.setAttribute('aria-pressed', String(button.dataset.side === side));
	};

	const loadCube = async () => {
		const { startCube } = await import('./cube3d');
		return startCube({
			stage,
			canvas,
			cells: cells.map(({ view, convert }) => ({ view, convert })),
			onPick: select,
			onRotate: () => pressSide(null),
		});
	};

	picker.addEventListener('input', () => select(parseHex(picker.value)));
	for (const button of sides) {
		button.addEventListener('click', () => {
			const side = button.dataset.side === 'black' ? 'black' : 'white';
			pressSide(side);
			handle?.setSide(side);
		});
	}
	pressSide('white');
	select(selected);

	const start = () => {
		loadCube()
			.then((cube) => {
				handle = cube;
				cube.setMarker(selected);
				document.addEventListener('astro:before-swap', () => cube.dispose(), { once: true });
			})
			.catch(() => {
				canvas.hidden = true;
				status.textContent = t.cubeFailed;
				status.hidden = false;
			});
	};

	// three.js is only fetched once the reader gets near the demo.
	const watcher = new IntersectionObserver(
		(entries) => {
			if (!entries.some((entry) => entry.isIntersecting)) return;
			watcher.disconnect();
			start();
		},
		{ rootMargin: '400px' },
	);
	watcher.observe(root);
}

export function mountAll() {
	for (const root of document.querySelectorAll<HTMLElement>('[data-darklab]')) {
		if (root.dataset.ready) continue;
		root.dataset.ready = 'true';
		const t = JSON.parse(root.dataset.strings ?? '{}') as Strings;
		if (root.dataset.darklab === 'lab') mountLab(root, t);
		if (root.dataset.darklab === 'probe') mountProbe(root, t);
		if (root.dataset.darklab === 'mine') void mountMine(root, t);
		if (root.dataset.darklab === 'cube') mountCube(root, t);
	}
}
