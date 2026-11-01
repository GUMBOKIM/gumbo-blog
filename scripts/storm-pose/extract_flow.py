"""Crowd motion as a dense optical-flow field on a grid, anchored to the lead's shirt.

usage: python extract_flow.py <video> <start> <end> <out.json> [--fps 12] [--cols 12 --rows 7]

Pose estimation can't see the crowd (bodies leaning 45-90 degrees, navy on navy), so the
crowd's motion is taken as a velocity field instead: Farneback flow between sampled frames,
with the camera's own zoom removed (a global similarity fit), averaged per grid cell, in units
of the lead's shirt height per second. The shirt (the only white one) gives a per-frame anchor
so a doll's spot relative to the lead maps onto a cell regardless of the zoom.

Per cell and frame the output holds a leaky integral of the flow (how far that patch of crowd
has been displaced lately: down = bowing, up = rearing back, sideways = swaying) and the
incoherent part of the speed (shaking), quantised to integers.
"""
import argparse, json, math, sys
import cv2, numpy as np

ap = argparse.ArgumentParser()
ap.add_argument("video"); ap.add_argument("start", type=float); ap.add_argument("end", type=float); ap.add_argument("out")
ap.add_argument("--fps", type=float, default=12); ap.add_argument("--cols", type=int, default=12); ap.add_argument("--rows", type=int, default=7)
ap.add_argument("--tau", type=float, default=0.7, help="displacement leak time constant (s)")
args = ap.parse_args()

cap = cv2.VideoCapture(args.video)
src_fps = cap.get(cv2.CAP_PROP_FPS)
W = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH)); H = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
SW, SH = 480, 270
step = src_fps / args.fps
fi = round(args.start * src_fps); end = round(args.end * src_fps)
cap.set(cv2.CAP_PROP_POS_FRAMES, fi)

def shirt_blob(bgr, prev):
    small = cv2.resize(bgr, (W // 4, H // 4))
    hsv = cv2.cvtColor(small, cv2.COLOR_BGR2HSV)
    mask = ((hsv[:, :, 2] > 165) & (hsv[:, :, 1] < 70)).astype(np.uint8)
    mask = cv2.morphologyEx(mask, cv2.MORPH_OPEN, np.ones((3, 3), np.uint8))
    n, labels, stats, cents = cv2.connectedComponentsWithStats(mask)
    best = None; bs = -1
    for k in range(1, n):
        x, y, w, h, area = stats[k]
        if area < 25: continue
        if y == 0 and w > small.shape[1] * 0.6: continue
        cx, cy = cents[k]
        score = area
        if prev is not None:
            d = ((cx * 4 - prev[0]) ** 2 + (cy * 4 - prev[1]) ** 2) ** 0.5 / H
            score *= max(0.15, 1 - d * 2)
        if score > bs: bs, best = score, (cx * 4, cy * 4, w * 4, h * 4)
    return best

frames = []
prev = None; nxt = fi
while fi <= end:
    ok, bgr = cap.read()
    if not ok: break
    if fi >= nxt:
        nxt += step
        blob = shirt_blob(bgr, prev)
        if blob: prev = blob[:2]
        gray = cv2.cvtColor(cv2.resize(bgr, (SW, SH), interpolation=cv2.INTER_AREA), cv2.COLOR_BGR2GRAY)
        frames.append((fi / src_fps, gray, blob))
    fi += 1
n = len(frames)

# anchors: shirt centre and height, smoothed (the zoom is slow, the blob jitters)
raw = [(f[2][0] / W, f[2][1] / H, max(f[2][3], 40) / H) if f[2] else None for f in frames]
idx = [i for i, a in enumerate(raw) if a]
anch = []
for i in range(n):
    if raw[i]: anch.append(list(raw[i])); continue
    lo = max([j for j in idx if j < i], default=None); hi = min([j for j in idx if j > i], default=None)
    if lo is None: anch.append(list(raw[hi]))
    elif hi is None: anch.append(list(raw[lo]))
    else:
        t = (i - lo) / (hi - lo); anch.append([raw[lo][k] * (1 - t) + raw[hi][k] * t for k in range(3)])
A = np.array(anch)
k = 7
A = np.stack([np.convolve(np.pad(A[:, c], (k // 2, k // 2), mode="edge"), np.ones(k) / k, mode="valid") for c in range(3)], axis=1)
# the shirt height follows a slow zoom-out that never zooms back in; a wide median kills
# tracking hiccups (collar hands, occluding neighbours) and a non-increasing fit the rest
med = np.array([np.median(A[max(0, i - 18):i + 19, 2]) for i in range(n)])
# pool-adjacent-violators for a non-increasing sequence
blocks = []  # [sum, count]
for v in med:
    blocks.append([v, 1])
    while len(blocks) > 1 and blocks[-2][0] / blocks[-2][1] < blocks[-1][0] / blocks[-1][1]:
        b = blocks.pop(); blocks[-1][0] += b[0]; blocks[-1][1] += b[1]
A[:, 2] = np.concatenate([[s_ / c_] * c_ for s_, c_ in blocks])

ys, xs = np.mgrid[0:SH, 0:SW]
cell_r = (ys * args.rows // SH).ravel(); cell_c = (xs * args.cols // SW).ravel(); cell = cell_r * args.cols + cell_c
counts = np.bincount(cell, minlength=args.cols * args.rows)

C = args.cols * args.rows
disp = np.zeros((C, 2)); vel_s = np.zeros((C, 2)); speed_s = np.zeros(C)
decay = math.exp(-1 / (args.fps * args.tau)); dt = 1 / args.fps
out_frames = []
for i in range(n):
    if i == 0:
        v = np.zeros((C, 2))
    else:
        fl = cv2.calcOpticalFlowFarneback(frames[i - 1][1], frames[i][1], None, 0.5, 3, 21, 3, 5, 1.2, 0)
        fx = fl[:, :, 0].ravel(); fy = fl[:, :, 1].ravel()
        # remove the camera: least-squares similarity (zoom s, translation t) on all pixels
        px = xs.ravel() - SW / 2; py = ys.ravel() - SH / 2
        M = np.stack([px, np.ones_like(px), np.zeros_like(px)], axis=1)
        # solve [s, tx] from fx and [s, ty] from fy jointly
        X = np.concatenate([np.stack([px, np.ones_like(px), np.zeros_like(px)], 1), np.stack([py, np.zeros_like(py), np.ones_like(py)], 1)])
        Y = np.concatenate([fx, fy])
        s, tx, ty = np.linalg.lstsq(X, Y, rcond=None)[0]
        fx = fx - (s * px + tx); fy = fy - (s * py + ty)
        unit_px = A[i, 2] * SH
        v = np.stack([np.bincount(cell, fx, C) / counts, np.bincount(cell, fy, C) / counts], 1) / unit_px * args.fps
    disp = disp * decay + v * dt
    vel_s = vel_s * 0.6 + v * 0.4
    speed_s = speed_s * 0.6 + np.linalg.norm(v, axis=1) * 0.4
    jitter = np.maximum(0, speed_s - np.linalg.norm(vel_s, axis=1))
    q = lambda x, s_: int(max(-127, min(127, round(x * s_))))
    out_frames.append([[q(disp[c, 0], 100), q(disp[c, 1], 100), q(jitter[c], 40)] for c in range(C)])
    if i % 24 == 0:
        print(f"t={frames[i][0]:.1f} unit={A[i,2]:.3f} |disp|max={np.abs(disp).max():.2f} jitter mean={jitter.mean():.2f}", file=sys.stderr)

json.dump({"fps": args.fps, "t0": round(frames[0][0], 3), "cols": args.cols, "rows": args.rows,
           "anchor": [[round(float(a), 4) for a in A[i]] for i in range(n)],
           "cells": out_frames}, open(args.out, "w"), separators=(",", ":"))
print(f"{n} frames x {C} cells -> {args.out}")
