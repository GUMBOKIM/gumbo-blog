"""Extract 2D pose landmarks from a video segment with MediaPipe Pose Landmarker.

usage: python extract.py <video> <start_sec> <end_sec> <out.json> [--fps 15] [--max-poses 1]

Writes normalized (0..1) x, y and visibility for the 33 MediaPipe landmarks per frame,
plus the fps. Only the pose closest to the frame centre (largest when tied) is kept.
"""
import argparse
import json
import sys

import cv2
import mediapipe as mp
from mediapipe.tasks import python as mp_python
from mediapipe.tasks.python import vision

ap = argparse.ArgumentParser()
ap.add_argument("video")
ap.add_argument("start", type=float)
ap.add_argument("end", type=float)
ap.add_argument("out")
ap.add_argument("--fps", type=float, default=15)
ap.add_argument("--max-poses", type=int, default=3)
ap.add_argument("--model", default="pose_landmarker_full.task")
ap.add_argument("--debug-dir", default=None, help="write annotated frames here")
args = ap.parse_args()

options = vision.PoseLandmarkerOptions(
    base_options=mp_python.BaseOptions(model_asset_path=args.model),
    running_mode=vision.RunningMode.VIDEO,
    num_poses=args.max_poses,
    min_pose_detection_confidence=0.5,
    min_tracking_confidence=0.5,
)
landmarker = vision.PoseLandmarker.create_from_options(options)

cap = cv2.VideoCapture(args.video)
src_fps = cap.get(cv2.CAP_PROP_FPS)
width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
step = src_fps / args.fps
frame_index = round(args.start * src_fps)
end_index = round(args.end * src_fps)

frames = []
last = None
last_age = 99
next_sample = frame_index
cap.set(cv2.CAP_PROP_POS_FRAMES, frame_index)
while frame_index <= end_index:
    ok, bgr = cap.read()
    if not ok:
        break
    if frame_index >= next_sample:
        next_sample += step
        rgb = cv2.cvtColor(bgr, cv2.COLOR_BGR2RGB)
        image = mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb)
        ts_ms = int(frame_index / src_fps * 1000)
        result = landmarker.detect_for_video(image, ts_ms)
        chosen = None
        best = None
        for pose in result.pose_landmarks:
            cx = (pose[11].x + pose[12].x) / 2
            cy = (pose[11].y + pose[12].y) / 2
            size = abs(pose[11].x - pose[12].x)
            # prefer big poses near the centre of the frame...
            score = size - abs(cx - 0.5) * 0.3
            # ...and strongly prefer the person we were following a moment ago
            if last is not None and last_age < 8:
                dist = ((cx - last[0]) ** 2 + (cy - last[1]) ** 2) ** 0.5
                score += 0.3 - min(dist, 0.3)
            if best is None or score > best:
                best = score
                chosen = pose
        if chosen is not None:
            last = ((chosen[11].x + chosen[12].x) / 2, (chosen[11].y + chosen[12].y) / 2)
            last_age = 0
        else:
            last_age += 1
        if chosen is None:
            frames.append(None)
        else:
            frames.append([[round(p.x, 4), round(p.y, 4), round(p.visibility, 2)] for p in chosen])
        if args.debug_dir and chosen is not None:
            for p in chosen:
                cv2.circle(bgr, (int(p.x * width), int(p.y * height)), 3, (0, 255, 0), -1)
            cv2.imwrite(f"{args.debug_dir}/{len(frames):04d}.jpg", bgr)
        if len(frames) % 50 == 0:
            print(f"{len(frames)} frames, t={frame_index / src_fps:.1f}s", file=sys.stderr)
    frame_index += 1

found = sum(1 for f in frames if f is not None)
json.dump({"fps": args.fps, "width": width, "height": height, "start": args.start, "frames": frames}, open(args.out, "w"))
print(f"{len(frames)} frames sampled, {found} with a pose -> {args.out}")
