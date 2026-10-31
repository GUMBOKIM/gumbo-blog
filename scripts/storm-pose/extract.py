"""3D pose of the one person in a white shirt, tracked by the shirt first.

usage: python extract_shirt.py <video> <start> <end> <out.json> [--fps 15] [--debug-dir d]

Per frame: find the largest bright, unsaturated blob (the white shirt in a crowd of dark
blazers), crop a body-sized window around it, upscale, run MediaPipe Pose Landmarker on the
crop and keep the pose whose torso sits on the blob. Output per frame: 33 x [x, y, vis]
(image, normalised to the full frame) and 33 x [X, Y, Z] (world, metres, hip-centred).
"""
import argparse, json, sys
import cv2, numpy as np
import mediapipe as mp
from mediapipe.tasks import python as mp_python
from mediapipe.tasks.python import vision

ap = argparse.ArgumentParser()
ap.add_argument("video"); ap.add_argument("start", type=float); ap.add_argument("end", type=float); ap.add_argument("out")
ap.add_argument("--fps", type=float, default=15)
ap.add_argument("--model", default="pose_landmarker_full.task")
ap.add_argument("--debug-dir", default=None)
args = ap.parse_args()

landmarker = vision.PoseLandmarker.create_from_options(vision.PoseLandmarkerOptions(
    base_options=mp_python.BaseOptions(model_asset_path=args.model),
    running_mode=vision.RunningMode.IMAGE, num_poses=3,
    min_pose_detection_confidence=0.3, min_pose_presence_confidence=0.3))

cap = cv2.VideoCapture(args.video)
src_fps = cap.get(cv2.CAP_PROP_FPS)
W = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH)); H = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
step = src_fps / args.fps
fi = round(args.start * src_fps); end = round(args.end * src_fps)
cap.set(cv2.CAP_PROP_POS_FRAMES, fi)

def shirt_blob(bgr, prev):
    """Largest white blob, biased toward the previous one. Returns (cx, cy, w, h) in pixels."""
    small = cv2.resize(bgr, (W // 4, H // 4))
    hsv = cv2.cvtColor(small, cv2.COLOR_BGR2HSV)
    mask = ((hsv[:, :, 2] > 165) & (hsv[:, :, 1] < 70)).astype(np.uint8)
    mask = cv2.morphologyEx(mask, cv2.MORPH_OPEN, np.ones((3, 3), np.uint8))
    n, labels, stats, cents = cv2.connectedComponentsWithStats(mask)
    best = None; bs = -1
    for k in range(1, n):
        x, y, w, h, area = stats[k]
        if area < 25: continue
        cx, cy = cents[k]
        score = area
        if prev is not None:
            d = ((cx * 4 - prev[0]) ** 2 + (cy * 4 - prev[1]) ** 2) ** 0.5 / H
            score *= max(0.15, 1 - d * 2)
        # the sky/background can be bright too: ignore blobs touching the top edge that are very wide
        if y == 0 and w > small.shape[1] * 0.6: continue
        if score > bs: bs, best = score, (cx * 4, cy * 4, w * 4, h * 4)
    return best

frames = []; prev = None; nxt = fi
while fi <= end:
    ok, bgr = cap.read()
    if not ok: break
    if fi >= nxt:
        nxt += step
        blob = shirt_blob(bgr, prev)
        entry = None
        if blob:
            cx, cy, bw, bh = blob
            prev = (cx, cy)
            # body window: about 1.6 shirt-heights above the shirt centre, 2.4 below
            full = bh > H * 0.22 or bw > W * 0.3
            if full:
                # close-up: the shirt fills the frame, so look at all of it
                x0, y0, x1, y1 = 0, 0, W, H
            else:
                half_w = max(bw * 1.1, bh * 0.9, 100)
                x0, x1 = int(max(0, cx - half_w)), int(min(W, cx + half_w))
                y0, y1 = int(max(0, cy - bh * 1.6 - 20)), int(min(H, cy + bh * 2.4 + 20))
            crop = bgr[y0:y1, x0:x1]
            if crop.size:
                scale = max(1.0, 640 / max(1, crop.shape[0]))
                if scale > 1: crop = cv2.resize(crop, None, fx=scale, fy=scale, interpolation=cv2.INTER_CUBIC)
                rgb = cv2.cvtColor(crop, cv2.COLOR_BGR2RGB)
                res = landmarker.detect(mp.Image(image_format=mp.ImageFormat.SRGB, data=np.ascontiguousarray(rgb)))
                cw, ch = x1 - x0, y1 - y0
                best = None; bd = 1e9
                for lms, wlms in zip(res.pose_landmarks, res.pose_world_landmarks):
                    img = [(x0 + p.x * cw, y0 + p.y * ch, p.visibility) for p in lms]
                    tx = sum(img[i][0] for i in (11, 12, 23, 24)) / 4; ty = sum(img[i][1] for i in (11, 12, 23, 24)) / 4
                    sw = abs(img[11][0] - img[12][0])
                    if full:
                        # in a close-up the subject is simply the biggest body in the frame
                        d = -sw
                    else:
                        # the torso must sit on the shirt and be about as wide as it
                        if not (0.35 * bw < sw < 2.2 * bw + 40): continue
                        d = ((tx - cx) ** 2 + (ty - cy) ** 2) ** 0.5
                    if d < bd: bd, best = d, (img, [(p.x, p.y, p.z) for p in wlms])
                if best and (full or bd < max(bh * 1.0, 60)):
                    img, world = best
                    entry = {"blob": [round(cx / W, 3), round(cy / H, 3), round(bh / H, 3)],
                             "i": [[round(x / W, 4), round(y / H, 4), round(v, 2)] for x, y, v in img],
                             "w": [[round(x, 3), round(y, 3), round(z, 3)] for x, y, z in world]}
            if args.debug_dir:
                dbg = bgr.copy()
                cv2.rectangle(dbg, (x0, y0), (x1, y1), (255, 160, 0), 3)
                if entry:
                    for x, y, v in img:
                        cv2.circle(dbg, (int(x), int(y)), 5, (0, 255, 0) if v > 0.5 else (0, 0, 255), -1)
                cv2.imwrite(f"{args.debug_dir}/{len(frames) + 1:04d}.jpg", cv2.resize(dbg, (960, 540)))
        frames.append(entry)
        if len(frames) % 50 == 0: print(f"{len(frames)} frames t={fi / src_fps:.1f}", file=sys.stderr)
    fi += 1

json.dump({"fps": args.fps, "width": W, "height": H, "start": args.start, "frames": frames}, open(args.out, "w"))
print(f"{len(frames)} sampled, {sum(f is not None for f in frames)} with pose -> {args.out}")
