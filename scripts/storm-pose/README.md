# storm-pose

Offline scripts behind `src/components/storm/`. Not part of the build.

```bash
uv venv --python 3.12 .venv && uv pip install --python .venv/bin/python mediapipe opencv-python-headless numpy
curl -LO https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_full/float16/latest/pose_landmarker_full.task
.venv/bin/python extract.py <video-1080p.mp4> 258 295 raw.json --fps 15 --debug-dir dbg
.venv/bin/python clean.py raw.json ../../src/components/storm/dance.json 258.0-261.3 270.7-295.0
.venv/bin/python extract_flow.py <video-1080p.mp4> 270.7 295 flow.json --camera ../../src/components/storm/camera.json
```

`extract.py` finds the one person in a white shirt (largest bright, unsaturated blob per frame),
crops a body-sized window around it, upscales, runs MediaPipe Pose Landmarker and keeps the pose
whose torso sits on the shirt. It writes 2D image landmarks and 3D world landmarks per frame.
`clean.py` drops frames where the tracker hopped, interpolates gaps, corrects the camera tilt
(median hips→shoulders direction becomes vertical), smooths, keeps 17 joints and quantises to
millimetres in a compact JSON. The widget retargets these onto a fixed spine (`dance.json`).

`extract_flow.py` is the analysis tool for the crowd, which pose estimation can't see once it
folds over. It computes Farneback optical flow between sampled frames, removes the camera's own
zoom (a global zoom-plus-translation fitted by least squares) and averages the flow on a grid in
units of the shirt's height. The whole-frame mean of that flow is one clean waveform, which is
how the crowd's routine (fold, rear back, sway, tremble, and their timings) was read off and
written as keyframes in `choreo.ts`. With `--camera` it also writes the shirt's position and
size per frame (`camera.json`), which the widget's camera follows to reproduce the zoom-out.
