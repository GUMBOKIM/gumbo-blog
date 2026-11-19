/**
 * Color math for the forced dark mode post. Pure functions only, so the numbers can be
 * checked against real measurements outside the browser.
 *
 * `samsung` uses the luma shift Daniel Aleksandersen documented for Samsung Internet 11
 * (ctrl.blog, 2020), with ranges re-measured on Samsung Internet 31.0. `chromium` is a port of
 * Blink's dark_mode_filter.cc, dark_mode_color_filter.cc and dark_mode_lab_color_space.h.
 */

export type RGB = readonly [number, number, number];

export type Role =
	| 'root'
	| 'background'
	| 'button'
	| 'field'
	| 'gradient'
	| 'border'
	| 'outline'
	| 'shadow'
	| 'svg'
	| 'svgSmall'
	| 'text'
	| 'image'
	| 'bgimage';

interface Range {
	min: number;
	max: number;
	invert: boolean;
}

/** Output luma range per paint role, measured with 256 gray levels on Samsung Internet 31.0 */
export const SAMSUNG_RANGES: Record<Role, Range> = {
	root: { min: 0.004, max: 0.08, invert: false },
	background: { min: 0.004, max: 0.12, invert: false },
	button: { min: 0.15, max: 0.29, invert: false },
	field: { min: 0.067, max: 0.165, invert: false },
	gradient: { min: 0.02, max: 0.12, invert: false },
	border: { min: 0.27, max: 0.33, invert: false },
	outline: { min: 0.14, max: 0.2, invert: false },
	shadow: { min: 0.28, max: 0.33, invert: false },
	svg: { min: 0.5, max: 0.7, invert: false },
	svgSmall: { min: 0.5, max: 0.7, invert: true },
	text: { min: 0.29, max: 1, invert: true },
	image: { min: 0, max: 0.7, invert: false },
	bgimage: { min: 0, max: 0.5, invert: false },
};

/** Text at or above this luma keeps its direction: measured 216 → 102 but 217 → 228 */
const TEXT_KEEP_LUMA = 0.85;

/** Boxes no larger than this in both directions are painted like text (CSS px, measured) */
export const SMALL_BOX_PX = 20;

/** The role an SVG shape is painted under, from its tag and painted size (CSS px, measured) */
export function shapeRole(tag: string, width: number, height: number): Role {
	if (width < 20 && height < 20) return 'svgSmall';
	const primitive = tag === 'rect' || tag === 'circle' || tag === 'ellipse';
	return primitive && Math.max(width, height) >= 90 ? 'button' : 'svg';
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const to8 = (v: number) => Math.round(clamp(v, 0, 255));

/** BT.601 luma, 0 to 1 */
export const luma = ([r, g, b]: RGB) => (0.299 * r + 0.587 * g + 0.114 * b) / 255;

/** The luma Samsung maps a color to, before chroma is added back */
export function samsungLuma(rgb: RGB, role: Role) {
	const y = luma(rgb);
	const { min, max, invert } = SAMSUNG_RANGES[role];
	const flip = invert && y < TEXT_KEEP_LUMA;
	return min + (flip ? 1 - y : y) * (max - min);
}

/**
 * Moves luma and keeps Cb and Cr. In RGB that is the same offset added to all three channels,
 * and the channels that fall below 0 are what turn yellow into brown.
 */
export function samsung(rgb: RGB, role: Role): RGB {
	// Bitmaps are dimmed as a whole: 0.7 for <img>, 0.5 for CSS background images.
	if (role === 'image' || role === 'bgimage') {
		const k = SAMSUNG_RANGES[role].max;
		return [to8(rgb[0] * k), to8(rgb[1] * k), to8(rgb[2] * k)];
	}
	const delta = (samsungLuma(rgb, role) - luma(rgb)) * 255;
	return [to8(rgb[0] + delta), to8(rgb[1] + delta), to8(rgb[2] + delta)];
}

/* Chromium: CIELAB lightness inversion ------------------------------------------------ */

type Vec3 = [number, number, number];
type Mat3 = [Vec3, Vec3, Vec3];

const mul = (m: Mat3, v: Vec3 | RGB): Vec3 => [
	m[0][0] * v[0] + m[0][1] * v[1] + m[0][2] * v[2],
	m[1][0] * v[0] + m[1][1] * v[1] + m[1][2] * v[2],
	m[2][0] * v[0] + m[2][1] * v[1] + m[2][2] * v[2],
];
const compose = (a: Mat3, b: Mat3): Mat3 => {
	const col = (i: 0 | 1 | 2): Vec3 => [b[0][i], b[1][i], b[2][i]];
	const [c0, c1, c2] = [mul(a, col(0)), mul(a, col(1)), mul(a, col(2))];
	return [
		[c0[0], c1[0], c2[0]],
		[c0[1], c1[1], c2[1]],
		[c0[2], c1[2], c2[2]],
	];
};
function invert3(m: Mat3): Mat3 {
	const [[a, b, c], [d, e, f], [g, h, i]] = m;
	const A = e * i - f * h;
	const B = f * g - d * i;
	const C = d * h - e * g;
	const det = a * A + b * B + c * C;
	return [
		[A / det, (c * h - b * i) / det, (b * f - c * e) / det],
		[B / det, (a * i - c * g) / det, (c * d - a * f) / det],
		[C / det, (b * g - a * h) / det, (a * e - b * d) / det],
	];
}

const D50: Vec3 = [0.964212, 1, 0.825188];
const D65: Vec3 = [0.95042855, 1, 1.0889004];
const BRADFORD: Mat3 = [
	[0.8951, 0.2664, -0.1614],
	[-0.7502, 1.7135, 0.0367],
	[0.0389, 0.0685, 1.0296],
];
const SRGB_TO_XYZ_D65: Mat3 = [
	[0.41238642, 0.3575915, 0.18045056],
	[0.21263677, 0.715183, 0.07218022],
	[0.019330615, 0.11919712, 0.95037293],
];

const srcLms = mul(BRADFORD, D65);
const dstLms = mul(BRADFORD, D50);
const ADAPT = compose(
	invert3(BRADFORD),
	compose(
		[
			[dstLms[0] / srcLms[0], 0, 0],
			[0, dstLms[1] / srcLms[1], 0],
			[0, 0, dstLms[2] / srcLms[2]],
		],
		BRADFORD,
	),
);
const TO_XYZ = compose(ADAPT, SRGB_TO_XYZ_D65);
const FROM_XYZ = invert3(TO_XYZ);

const SIGMA = 6 / 29;
const SIGMA2 = 36 / 841;
const SIGMA3 = 216 / 24389;

const eotf = (u: number) => clamp(u < 0.04045 ? u / 12.92 : ((u + 0.055) / 1.055) ** 2.4, 0, 1);
const oetf = (u: number) => clamp(u < 0.0031308 ? 12.92 * u : 1.055 * u ** (1 / 2.4) - 0.055, 0, 1);

function invertLightness(rgb: RGB): RGB {
	const xyz = mul(TO_XYZ, [eotf(rgb[0] / 255), eotf(rgb[1] / 255), eotf(rgb[2] / 255)]);
	const f = (x: number) => (x > SIGMA3 ? Math.cbrt(x) : x / (3 * SIGMA2) + 4 / 29);
	const [fx, fy, fz] = [f(xyz[0] / D50[0]), f(xyz[1] / D50[1]), f(xyz[2] / D50[2])];
	const L = clamp(116 * fy - 16, 0, 100);
	const a = clamp(500 * (fx - fy), -128, 128);
	const b = clamp(200 * (fy - fz), -128, 128);

	const next = Math.min(110 - L, 100);
	const inv = (x: number) => (x > SIGMA ? x * x * x : 3 * SIGMA2 * (x - 4 / 29));
	const fy2 = (next + 16) / 116;
	const linear = mul(FROM_XYZ, [inv(fy2 + a * 0.002) * D50[0], inv(fy2) * D50[1], inv(fy2 - b * 0.005) * D50[2]]);
	const out: RGB = [to8(oetf(linear[0]) * 255), to8(oetf(linear[1]) * 255), to8(oetf(linear[2]) * 255)];

	// AdjustGray: dark grays snap to the Material dark surface color.
	if (out[0] === out[1] && out[1] === out[2] && out[0] < 32 && out[0] > 18) return [18, 18, 18];
	return out;
}

/** W3C AERT brightness, which Blink uses to decide whether a color gets inverted */
export const brightness = ([r, g, b]: RGB) => Math.floor((r * 299 + g * 587 + b * 114) / 1000);

const FOREGROUND_THRESHOLD = 150;
const BACKGROUND_THRESHOLD = 205;

function relativeLuminance([r, g, b]: RGB) {
	return 0.2126 * eotf(r / 255) + 0.7152 * eotf(g / 255) + 0.0722 * eotf(b / 255);
}
function contrast(a: RGB, b: RGB) {
	const [hi, lo] = [relativeLuminance(a), relativeLuminance(b)].sort((x, y) => y - x);
	return (hi + 0.05) / (lo + 0.05);
}

/** Color::Dark() in Blink */
function darker(rgb: RGB): RGB {
	if (rgb[0] === 255 && rgb[1] === 255 && rgb[2] === 255) return [171, 171, 171];
	const v = Math.max(...rgb) / 255;
	const k = v === 0 ? 0 : Math.max(0, (v - 0.33) / v);
	return [to8(rgb[0] * k), to8(rgb[1] * k), to8(rgb[2] * k)];
}

const SURFACE: RGB = [18, 18, 18];

export function chromium(rgb: RGB, role: Role): RGB {
	if (role === 'image' || role === 'bgimage') return rgb;
	const foreground = role === 'text' || role === 'svg' || role === 'svgSmall' || role === 'border';
	const flip = foreground ? brightness(rgb) < FOREGROUND_THRESHOLD : brightness(rgb) > BACKGROUND_THRESHOLD;
	let out = flip ? invertLightness(rgb) : rgb;
	if (role === 'border') {
		// AdjustDarkenColor: borders are darkened until they stop competing with the text.
		while (!(out[0] === 0 && out[1] === 0 && out[2] === 0) && contrast(out, SURFACE) >= 4.5) out = darker(out);
	}
	return out;
}

export const toHex = ([r, g, b]: RGB) =>
	`#${[r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('')}`;

export function parseHex(hex: string): RGB {
	const n = parseInt(hex.replace('#', ''), 16);
	return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
