"""Rebuild one-shot pads: uv run --with numpy --with scipy python scripts/launchpad/prepare.py SOURCE.wav VOCALS.wav [--vocals-only]
The source is the linked Tokyo Drift recording; it is not stored in the repository.
Drums are synthesized here, not extracted stems or samples from the cover artist.
"""
import argparse, json, subprocess, tempfile
from pathlib import Path
import numpy as np
from scipy.io import wavfile
from scipy.signal import butter, sosfilt

parser = argparse.ArgumentParser(description='Build launchpad samples from mix and time-aligned separated vocals.')
parser.add_argument('source')
parser.add_argument('vocals', help='Demucs vocals.wav, aligned to the start of the original recording')
parser.add_argument('--vocals-only', action='store_true')
parser.add_argument('--bass', help='Optional time-aligned Demucs bass.wav for the demo loop')
args = parser.parse_args()

out = Path(__file__).resolve().parents[2] / 'src/content/blog/launchpad/assets'
sr = 44100
rng = np.random.default_rng(127)
clips = [
    ('Q', 'B♭', 'lead', .363, .598, 1),
    ('W', 'B', 'lead', 2.59, 2.917, 1),
    ('E', 'E♭', 'lead', 2.94, 3.164, 1),
    ('R', 'LOW B♭', 'bass', .363, .598, .5),
    ('Z', 'HOOK 1', 'vocal', 11.22, 13.1, 1),
    ('X', 'HOOK 2', 'vocal', 13.1, 14.58, 1),
    ('C', 'HOOK 3', 'vocal', 14.58, 16.85, 1),
    ('V', 'HOOK 4', 'vocal', 16.85, 18.7, 1),
]
manifest=[]
for key,label,group,start,end,rate in clips:
    source = args.vocals if group == 'vocal' else args.source
    entry = dict(key=key,label=label,group=group,start=start,end=end,rate=rate)
    if group == 'vocal':
        entry['source'] = 'MelBand RoFormer vocals + anvuew dereverb'
    manifest.append(entry)
    if args.vocals_only and group != 'vocal':
        continue
    duration=(end-start)/rate
    filters=f'aresample=48000,asetrate=48000*{rate},aresample=44100,afade=t=in:d=0.002,afade=t=out:st={duration-.018}:d=0.018'
    subprocess.run(['ffmpeg','-v','error','-y','-ss',str(start),'-t',str(end-start),'-i',source,'-ar','48000','-af',filters,'-map_metadata','-1','-b:a','160k',str(out/f'{key}.mp3')],check=True)

for key,label,duration in [('A','KICK',.42),('S','SNARE',.24),('D','HAT',.09),('F','CLAP',.25)]:
    manifest.append(dict(key=key,label=label,group='drum',source='synthesized'))
    if args.vocals_only:
        continue
    t=np.arange(int(sr*duration))/sr
    noise=rng.standard_normal(len(t))
    bright=sosfilt(butter(2,2500,fs=sr,btype='highpass',output='sos'),noise)
    if key=='A':
        phase=2*np.pi*(48*t+100*.025*(1-np.exp(-t/.025)))
        y=np.sin(phase)*np.exp(-t*12)+.08*bright*np.exp(-t*170)
    elif key=='S':
        y=.55*bright*np.exp(-t*22)+.4*np.sin(2*np.pi*185*t)*np.exp(-t*27)
    elif key=='D':
        y=bright*np.exp(-t*65)
    else:
        env=sum(np.where(t>=d,np.exp(-np.maximum(0,t-d)*100),0) for d in [0,.012,.024])
        y=bright*(env+.4*np.exp(-t*23))
    y*=np.minimum(t/.001,1)*np.minimum((duration-t)/.012,1)
    y=y/max(abs(y))*.8
    with tempfile.NamedTemporaryFile(suffix='.wav') as f:
        wavfile.write(f.name,sr,(y*32767).astype(np.int16))
        subprocess.run(['ffmpeg','-v','error','-y','-i',f.name,'-map_metadata','-1','-b:a','160k',str(out/f'{key}.mp3')],check=True)
manifest.sort(key=lambda c:'QWERASDFZXCV'.index(c['key']))
(out/'samples.json').write_text(json.dumps(manifest,indent=2)+'\n')

if args.bass:
    beat = 60 / 127
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-ss', str(.363 + 24 * beat), '-t', str(8 * beat),
                    '-i', args.bass, '-af', f'afade=t=in:d=0.004,afade=t=out:st={8*beat-.005}:d=0.005',
                    '-map_metadata', '-1', '-b:a', '160k', str(out/'bass-loop.mp3')], check=True)
