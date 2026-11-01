/**
 * The crowd's routine in the class-photo scene, as keyframes read off the video.
 *
 * The whole-frame optical flow of the shot is one clean waveform, so the crowd is in unison:
 *  - 278.9 s: everyone folds forward (head down), rears back 0.7 s later (face to the sky),
 *    settles, folds again. Period 1.72 s, four cycles.
 *  - from 284.7 s: still rearing and folding every 1.75 s but shallower, with a side-to-side
 *    sway at exactly double that rate (period 0.875 s).
 *  - from 293 s: upright, fists at the chest, trembling, small nods.
 * Times are seconds into the shot (shot starts at 270.7 s of the video).
 */

export interface Pose {
	bend: number; // forward bow at the hips in radians, negative rears back
	head: number; // nod of the head on top of the bend, negative throws it back
	arms: number; // 0 arms hang, 1 fists at the chest
	sway: number; // sideways lean in radians, positive leans to the viewer's left
	shake: number; // trembling amplitude 0..1
}

type Key = [g: number, bend: number, head: number, arms: number];

const keys: Key[] = [
	[0, 0, 0, 0],
	[7.0, 0, 0, 0],
	[8.1, 0.05, 0.05, 0.6], // the shiver starts, fists come up
	[8.4, 0, -0.2, 0.9],
];
// Deep fold/rear cycles: the bottom of each fold at these times
for (const B of [9.0, 10.7, 12.45, 13.95]) {
	if (B !== 9.0) keys.push([B - 0.6, -0.15, -0.4, 0.8]);
	keys.push([B, 1.5, 0.7, 0.15], [B + 0.7, -0.6, -1.15, 1.0], [B + 0.95, -0.3, -0.7, 0.9]);
}
// Shallower cycles under the sway
for (const B of [15.65, 17.4, 19.15, 20.9]) {
	if (B !== 15.65) keys.push([B - 0.6, -0.5, -0.9, 1.0]);
	keys.push([B, 0.7, 0.4, 0.6], [B + 0.75, -0.7, -1.1, 1.0], [B + 1.0, -0.5, -0.9, 1.0]);
}
// Upright with fists, nodding
keys.push(
	[22.3, -0.35, -0.8, 1.0],
	[22.7, 0.3, 0.3, 1.0],
	[23.15, -0.2, -0.4, 1.0],
	[23.5, 0.3, 0.3, 1.0],
	[24.05, -0.35, -0.7, 1.0],
	[24.4, 0.2, 0.2, 1.0],
);

const shakeKeys: [number, number][] = [
	[0, 0],
	[7.0, 0],
	[7.8, 0.4],
	[8.3, 1],
	[8.9, 0.8],
	[9.2, 0.2],
	[14.5, 0.25],
	[15.0, 0.4],
	[22.0, 0.4],
	[22.4, 1],
	[24.4, 1],
];

const smooth = (t: number) => t * t * (3 - 2 * t);

function lookup(table: number[][], g: number, out: number[]) {
	let i = 0;
	while (i < table.length - 1 && table[i + 1][0] <= g) i++;
	const a = table[i];
	const b = table[Math.min(i + 1, table.length - 1)];
	const span = b[0] - a[0];
	const k = span > 0 ? smooth(Math.max(0, Math.min(1, (g - a[0]) / span))) : 0;
	for (let j = 1; j < a.length; j++) out[j - 1] = a[j] + (b[j] - a[j]) * k;
}

const tmp = [0, 0, 0];

/** The unison pose at `g` seconds into the shot */
export function choreo(g: number, out: Pose) {
	lookup(keys, g, tmp);
	out.bend = tmp[0];
	out.head = tmp[1];
	out.arms = tmp[2];
	lookup(shakeKeys, g, tmp);
	out.shake = tmp[0];
	// Side-to-side sway from 284.7 s, fading as the shot widens
	const s = g - 14.0;
	if (s > -0.4 && g < 22.3) {
		const amp = (0.5 - 0.3 * Math.max(0, Math.min(1, (g - 14) / 8))) * Math.min(1, (s + 0.4) / 0.4) * Math.min(1, (22.3 - g) / 0.4);
		out.sway = amp * Math.cos((2 * Math.PI * s) / 0.875);
	} else out.sway = 0;
	return out;
}
