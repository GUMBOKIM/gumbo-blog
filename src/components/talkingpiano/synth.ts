/**
 * A small additive piano: a handful of slightly stretched partials per string, a decay that is
 * longer in the bass, a hammer thump, and dampers that drop when the next chord comes.
 * It renders straight into a Float32Array so the browser can play the result as one buffer
 * (no scheduling hundreds of oscillators) and Node can render the same thing for testing.
 */
import { keyFreq, type Chord } from './analysis.ts';

const PARTIALS = 8;
/** String stiffness: partial n sits at n·f·√(1 + B·n²) */
const INHARMONIC = 0.0004;

export function render(chords: Chord[], fps: number, rate: number): Float32Array {
	const last = chords.length ? chords[chords.length - 1].time : 0;
	const out = new Float32Array(Math.ceil((last + 1 / fps + 0.4) * rate));
	const hold = 1 / fps; // the damper falls when the next chord is struck
	const release = 0.06;
	let seed = 1;
	const noise = () => ((seed = (seed * 16807) % 2147483647) / 2147483647) * 2 - 1;

	for (const chord of chords) {
		const start = Math.round(chord.time * rate);
		for (const { key, vel } of chord.notes) {
			const f = keyFreq(key);
			const amp = 0.08 * vel ** 1.6;
			// Harder strikes are brighter
			const rolloff = 1.6 - 0.8 * vel;
			const decay = 0.25 + 2.5 * 2 ** (-(key - 20) / 14);
			const len = Math.round((hold + release) * rate);
			const holdLen = hold * rate;
			for (let n = 1; n <= PARTIALS; n++) {
				const fn = n * f * Math.sqrt(1 + INHARMONIC * n * n);
				if (fn > rate * 0.45) break;
				const a = amp / n ** rolloff;
				const w = (2 * Math.PI * fn) / rate;
				// Rotate a phasor instead of calling sin() per sample; the decay is folded into the rotation
				const d = Math.exp(-1 / ((rate * decay) / (1 + 0.3 * n)));
				const rc = Math.cos(w) * d;
				const rs = Math.sin(w) * d;
				const attackLen = 0.002 * rate;
				const dampStep = Math.exp(-1 / (0.012 * rate));
				let re = a;
				let im = 0;
				let damp = 1;
				for (let i = 0; i < len && start + i < out.length; i++) {
					if (i >= holdLen) damp *= dampStep;
					out[start + i] += im * damp * (i < attackLen ? i / attackLen : 1);
					const t = re * rc - im * rs;
					im = re * rs + im * rc;
					re = t;
				}
			}
			// Hammer: a few milliseconds of filtered noise
			let lp = 0;
			const thump = Math.round(0.006 * rate);
			for (let i = 0; i < thump && start + i < out.length; i++) {
				lp += 0.3 * (noise() - lp);
				out[start + i] += lp * amp * 0.6 * (1 - i / thump);
			}
		}
	}
	// Soft clip so dense chords don't wrap around
	let peak = 0;
	for (const v of out) peak = Math.max(peak, Math.abs(v));
	const gain = peak > 0 ? 0.9 / peak : 1;
	for (let i = 0; i < out.length; i++) out[i] = Math.tanh(out[i] * gain * 1.2) / Math.tanh(1.2);
	return out;
}
