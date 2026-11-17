# Launchpad audio

Working source/stem WAV files stay outside the repository. Pads and the short
bass loop are the only shipped audio. Start with the recording linked in the
post, retaining its leading silence. Every stem must be aligned to its start.

1. Use the first 24 seconds: `ffmpeg -i SOURCE.wav -t 24 separation-input.wav`.
2. Separate vocals using `audio-separator` model `vocals_mel_band_roformer.ckpt`.
3. Process that vocal stem with model
   `dereverb_mel_band_roformer_anvuew_sdr_19.1729.ckpt`; use **noreverb** output.
4. Separate the same source with Demucs `htdemucs` (four stems) for `bass.wav`.
5. Generate assets:

```sh
uv run --with numpy --with scipy python scripts/launchpad/prepare.py SOURCE.wav NOREVERB.wav --bass BASS.wav
```

The installed tools were run in isolated environments:

```sh
uv run --python 3.11 --with 'audio-separator[cpu]' --with 'torch<2.9' --with 'torchaudio<2.9' audio-separator separation-input.wav --model_filename vocals_mel_band_roformer.ckpt --output_dir vocals --output_format WAV
uv run --python 3.11 --with 'audio-separator[cpu]' --with 'torch<2.9' --with 'torchaudio<2.9' audio-separator VOCALS.wav --model_filename dereverb_mel_band_roformer_anvuew_sdr_19.1729.ckpt --output_dir dry --output_format WAV
uv run --python 3.11 --with demucs --with numpy --with soundfile --with 'torch<2.9' --with 'torchaudio<2.9' demucs -n htdemucs -d cpu --shifts 1 -o stems separation-input.wav
```

`--vocals-only` rebuilds ZXCV without touching the other pads. Drums are
synthesized with a fixed random seed. Model separation is not an official stem.
The public Acapella Library extraction (YouTube `oKQneGIcC_Y`) was compared but
is not used. Its uploader explicitly describes it as an extraction.

The demo is 32 bars at 127 BPM (about 60 seconds): two-bar intro, eight-bar
hook, four-bar instrumental, two-bar break, eight-bar returning hook, and
eight-bar final hook. Vocals enter a beat ahead of the hook downbeat. Phrase
starts follow source offsets 11.22, 13.10, 14.58, 16.85 seconds. When editing
these cuts, update `vocalScore` offsets in `widget.ts` too. Vocal and bass
playback rates follow tempo, so changing tempo also changes their pitch.
