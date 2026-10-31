# storm-pose

Offline scripts that produced `src/components/storm/dance.json`. Not part of the build.

```bash
uv venv --python 3.12 .venv && uv pip install --python .venv/bin/python mediapipe opencv-python-headless
curl -LO https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_full/float16/latest/pose_landmarker_full.task
.venv/bin/python extract.py <video.mp4> 326 370 raw.json --fps 15 --max-poses 4
.venv/bin/python clean.py raw.json ../../src/components/storm/dance.json 329.1-345.7
```

`extract.py` runs MediaPipe Pose Landmarker over a time range and keeps, per frame, the pose
nearest the centre of the shot that is also closest to the previous frame's pick.
`clean.py` drops frames where the tracker hopped to someone else, interpolates gaps, smooths,
keeps 15 joints and quantises to a compact JSON.
