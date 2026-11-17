type Mode = 'off' | 'beat' | 'demo';
type Voice = { source: AudioBufferSourceNode; gain: GainNode; group: string; when: number; automatic: boolean };
let dispose: (() => void) | undefined;
export function unmount() { dispose?.(); dispose = undefined; }
export function mount() {
  unmount();
  const root = document.querySelector<HTMLElement>('[data-launchpad]');
  if (!root) return;
  const strings = JSON.parse(root.dataset.strings!);
  const bassUrl = root.dataset.bass!;
  const pads = [...root.querySelectorAll<HTMLButtonElement>('[data-code]')];
  const byKey = new Map(pads.map(pad => [pad.dataset.code!.slice(3), pad]));
  const status = root.querySelector<HTMLElement>('[data-status]')!;
  const now = root.querySelector<HTMLOutputElement>('[data-now]')!;
  const volume = root.querySelector<HTMLInputElement>('[data-volume]')!;
  const tempo = root.querySelector<HTMLInputElement>('[data-tempo]')!;
  const start = root.querySelector<HTMLButtonElement>('[data-start]')!;
  const beatButton = root.querySelector<HTMLButtonElement>('[data-beat]')!;
  const demoButton = root.querySelector<HTMLButtonElement>('[data-demo]')!;
  const steps = [...root.querySelectorAll<HTMLElement>('[data-step]')];
  const events = new AbortController();
  let context: AudioContext | undefined;
  let master: GainNode;
  let loading: Promise<void> | undefined;
  let dead = false;
  let generation = 0;
  let mode: Mode = 'off';
  let nextTime = 0;
  let step = 0;
  let timer: ReturnType<typeof setInterval> | undefined;
  let frame = 0;
  const buffers = new Map<string, AudioBuffer>();
  const voices = new Set<Voice>();
  const lights: { key?: string; step?: number; section?: string; time: number }[] = [];
  const section = root.querySelector<HTMLElement>('[data-section]')!;
  const litUntil = new Map<string, number>();
  // Two bars, sixteenth-note positions. An illustrative arrangement of the opening motif.
  const melody = new Map([[0,'Q'],[4,'Q'],[8,'Q'],[12,'Q'],[16,'Q'],[19,'W'],[22,'E'],[24,'Q'],[28,'Q']]);
  const vocalScore = new Map<number,{ key: string; delay: number }>();
  for (const entry of [28, 92, 252, 316, 380, 444]) {
    ['Z','X','C','V'].forEach((key,i) => {
      const offset = [0, 1.88, 3.36, 5.63][i] * 127 / 60 * 4;
      vocalScore.set(entry + Math.floor(offset), { key, delay: offset % 1 });
    });
  }

  async function init() {
    if (!context) {
      context = new AudioContext({ latencyHint: 'interactive' });
      master = context.createGain();
      master.gain.value = Number(volume.value) / 100;
      const limiter = context.createDynamicsCompressor();
      limiter.threshold.value = -8;
      limiter.ratio.value = 12;
      master.connect(limiter);
      limiter.connect(context.destination);
    }
    if (context.state !== 'running') await context.resume();
    if (!loading) {
      status.textContent = strings.loading;
      const assets = pads.map(pad => ({ key: pad.dataset.code!.slice(3), url: pad.dataset.url! }));
      assets.push({ key: 'bass', url: bassUrl });
      loading = Promise.all(assets.map(async asset => {
        const response = await fetch(asset.url, { signal: events.signal });
        if (!response.ok) throw new Error('Audio download failed');
        const buffer = await context!.decodeAudioData(await response.arrayBuffer());
        buffers.set(asset.key, buffer);
      })).then(() => {
        if (dead) return;
        status.textContent = strings.ready;
        start.textContent = strings.loaded;
        start.disabled = true;
      }).catch(error => { loading = undefined; throw error; });
    }
    await loading;
  }
  function release(voice: Voice, when: number) {
    voice.gain.gain.cancelScheduledValues(when);
    voice.gain.gain.setValueAtTime(voice.gain.gain.value, when);
    voice.gain.gain.linearRampToValueAtTime(0, when + .006);
    voice.source.stop(when + .007);
  }
  function trigger(key: string, when: number, automatic = false, velocity = 1) {
    if (!context || dead) return;
    const pad = byKey.get(key)!;
    // Only vocals choke each other. Melody tails and different drum hits can overlap.
    const group = pad.dataset.group === 'vocal' ? 'vocal' : key;
    for (const voice of voices) {
      if (voice.group === group && voice.when <= when) release(voice, when);
    }
    const source = context.createBufferSource();
    source.buffer = buffers.get(key)!;
    if (automatic && pad.dataset.group === 'vocal') source.playbackRate.value = Number(tempo.value) / 127;
    const gain = context.createGain();
    gain.gain.value = velocity * (pad.dataset.group === 'drum' ? .65 : pad.dataset.group === 'vocal' ? 1.1 : .75);
    source.connect(gain);
    gain.connect(master);
    const voice = { source, gain, group, when, automatic };
    voices.add(voice);
    source.onended = () => { source.disconnect(); gain.disconnect(); voices.delete(voice); };
    source.start(when);
    lights.push({ key, time: when });
    lights.sort((a,b) => a.time-b.time);
  }
  function paint() {
    if (dead) return;
    const time = context?.currentTime ?? 0;
    while (lights.length && lights[0].time <= time) {
      const light = lights.shift()!;
      if (light.key) {
        litUntil.set(light.key, time + .12);
        now.textContent = byKey.get(light.key)!.dataset.label!;
      }
      if (light.section) section.textContent = light.section;
      if (light.step !== undefined) {
        steps.forEach((el,i) => el.classList.toggle('on', i === Math.floor(light.step! / 2) % 16));
      }
    }
    for (const [key,pad] of byKey) pad.classList.toggle('active', (litUntil.get(key) ?? 0) > time);
    frame = requestAnimationFrame(paint);
  }
  function bass(when: number) {
    const source = context!.createBufferSource();
    const gain = context!.createGain();
    source.buffer = buffers.get('bass')!;
    source.playbackRate.value = Number(tempo.value) / 127;
    gain.gain.value = .7;
    source.connect(gain); gain.connect(master);
    const voice = { source, gain, group: 'bass', when, automatic: true };
    voices.add(voice);
    source.onended = () => { source.disconnect(); gain.disconnect(); voices.delete(voice); };
    source.start(when);
  }
  function schedule() {
    if (!context || mode === 'off') return;
    while (nextTime < context.currentTime + .1) {
      const position = step % 32;
      const song = step % 512;
      const bar = Math.floor(song / 16);
      const intro = mode === 'demo' && bar < 2;
      const instrumental = mode === 'demo' && bar >= 10 && bar < 14;
      const breakdown = mode === 'demo' && bar >= 14 && bar < 16;
      const final = mode === 'demo' && bar >= 24;
      // Bring the full rhythm section in after the two-bar intro.
      if (!intro || song >= 16) {
        if (position === 0 || position === 6 || position === 16 || position === 22 || position === 30) trigger('A', nextTime, true);
        if (position % 8 === 4) trigger('S', nextTime, true, .9);
        if (position % 2 === 0) trigger('D', nextTime, true, position % 4 === 0 ? .6 : .35);
        if (final && position % 8 === 4) trigger('F', nextTime, true, .35);
      }
      if (mode === 'demo') {
        const note = melody.get(position);
        if (note && !breakdown) trigger(note, nextTime, true, intro ? 1 : .8);
        if (position === 0 && !intro && !breakdown) bass(nextTime);
        const vocal = vocalScore.get(song);
        if (vocal) trigger(vocal.key, nextTime + vocal.delay * 60 / Number(tempo.value) / 4, true);
        if (breakdown && song >= 248 && song % 2 === 0) trigger('S', nextTime, true, .35 + (song-248)*.06);
        if (song % 16 === 0) {
          const name = intro ? strings.intro : instrumental ? strings.instrumental : breakdown ? strings.breakdown : final ? strings.finale : strings.hook;
          lights.push({ section: `${name} · ${bar+1}/32`, time: nextTime });
        }
      }
      lights.push({ step: position, time: nextTime });
      lights.sort((a,b) => a.time-b.time);
      step++;
      nextTime += 60 / Number(tempo.value) / 4;
    }
  }
  function transport(next: Mode) {
    clearInterval(timer);
    for (const voice of voices) if (voice.automatic) voice.source.stop();
    lights.length = 0;
    litUntil.clear();
    mode = next;
    section.textContent = mode === 'off' ? strings.freeplay : mode === 'beat' ? strings.beat : strings.intro;
    beatButton.setAttribute('aria-pressed', String(mode !== 'off'));
    demoButton.setAttribute('aria-pressed', String(mode === 'demo'));
    steps.forEach(el => el.classList.remove('on'));
    if (mode !== 'off' && context) {
      step = 0;
      nextTime = context.currentTime + .035;
      schedule();
      timer = setInterval(schedule, 25);
    }
  }
  function stop() {
    generation++;
    transport('off');
    for (const voice of voices) voice.source.stop();
    pads.forEach(pad => pad.classList.remove('active'));
    now.textContent = strings.idle;
  }
  function run(action: () => void) {
    const token = generation;
    void init().then(() => { if (!dead && token === generation) action(); })
      .catch(() => { if (!dead) status.textContent = strings.error; });
  }
  function play(pad: HTMLButtonElement) { run(() => trigger(pad.dataset.code!.slice(3), context!.currentTime)); }
  for (const pad of pads) {
    pad.addEventListener('pointerdown', event => {
      if (event.button !== 0) return;
      event.preventDefault();
      pad.focus({ preventScroll: true });
      play(pad);
    }, { signal: events.signal });
    pad.addEventListener('click', event => { if (event.detail === 0) play(pad); }, { signal: events.signal });
  }
  start.addEventListener('click', () => run(() => {}), { signal: events.signal });
  beatButton.addEventListener('click', () => run(() => transport(mode === 'off' ? 'beat' : 'off')), { signal: events.signal });
  demoButton.addEventListener('click', () => run(() => transport(mode === 'demo' ? 'off' : 'demo')), { signal: events.signal });
  root.querySelector('[data-stop]')!.addEventListener('click', stop, { signal: events.signal });
  volume.addEventListener('input', () => { if (context) master.gain.setTargetAtTime(Number(volume.value)/100, context.currentTime, .01); }, { signal: events.signal });
  tempo.addEventListener('input', () => {
    root.querySelector('[data-tempo-out]')!.textContent = tempo.value;
    if (mode !== 'off') transport(mode);
  }, { signal: events.signal });
  document.addEventListener('keydown', event => {
    const target = event.target;
    if (event.code === 'Escape') { stop(); return; }
    if (event.ctrlKey || event.metaKey || event.altKey || event.repeat) return;
    if (target instanceof HTMLElement && target.closest('input, textarea, select, [contenteditable]')) return;
    const pad = pads.find(pad => pad.dataset.code === event.code);
    if (pad) { event.preventDefault(); play(pad); }
  }, { signal: events.signal });
  document.addEventListener('visibilitychange', () => { if (document.hidden) stop(); }, { signal: events.signal });
  window.addEventListener('blur', stop, { signal: events.signal });
  frame = requestAnimationFrame(paint);
  dispose = () => { dead = true; stop(); cancelAnimationFrame(frame); events.abort(); void context?.close(); };
}
