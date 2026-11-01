# storm-pose

Offline scripts that produced `src/components/storm/dance.json` (the lead) and
`src/components/storm/crowd.json` (the crowd). Not part of the build.

```bash
uv venv --python 3.12 .venv && uv pip install --python .venv/bin/python mediapipe opencv-python-headless numpy
curl -LO https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_full/float16/latest/pose_landmarker_full.task
.venv/bin/python extract.py <video-1080p.mp4> 258 295 raw.json --fps 15 --debug-dir dbg
.venv/bin/python clean.py raw.json ../../src/components/storm/dance.json 258.0-261.3 270.7-295.0
.venv/bin/python extract_flow.py <video-1080p.mp4> 270.7 295 ../../src/components/storm/crowd.json
```

`extract.py` finds the one person in a white shirt (largest bright, unsaturated blob per frame),
crops a body-sized window around it, upscales, runs MediaPipe Pose Landmarker and keeps the pose
whose torso sits on the shirt. It writes 2D image landmarks and 3D world landmarks per frame.
`clean.py` drops frames where the tracker hopped, interpolates gaps, corrects the camera tilt
(median hips→shoulders direction becomes vertical), smooths, keeps 17 joints and quantises to
millimetres in a compact JSON.

`extract_flow.py` is for the crowd, which pose estimation can't see once it folds over. It computes
Farneback optical flow between sampled frames, removes the camera's own zoom (a global
zoom-plus-translation fitted by least squares), averages the flow on a 12×7 grid in units of the
shirt's height, integrates it with a leak into a per-cell displacement, keeps the incoherent part
of the speed as "shaking", and records the shirt's position and size per frame so the widget can
map a figure's spot onto a cell and reproduce the zoom-out.
