"""Turn raw MediaPipe frames into the compact clip format the widget loads.

- keeps 15 joints, drops frames whose nose jumps (tracker hopped to a neighbour)
- fills gaps of up to 8 frames by linear interpolation, smooths with a 3-frame window
- x, y quantised to 0..1000 of the video frame, visibility to 0..100
"""
import json, sys
JOINTS = [0, 7, 8, 11, 12, 13, 14, 15, 16, 23, 24, 25, 26, 27, 28]
NAMES = ["nose","earL","earR","shoulderL","shoulderR","elbowL","elbowR","wristL","wristR","hipL","hipR","kneeL","kneeR","ankleL","ankleR"]
src, out = sys.argv[1], sys.argv[2]
ranges = [tuple(map(float, r.split('-'))) for r in sys.argv[3:]]
d = json.load(open(src)); fps = d['fps']; start = d['start']; F = d['frames']

def clip(t0, t1):
    a, b = round((t0 - start) * fps), round((t1 - start) * fps)
    frames = [F[i] for i in range(a, b)]
    # drop tracker hops: shoulder centre moves more than 8% of the frame in one step
    prev = None
    for i, f in enumerate(frames):
        if f is None: continue
        c = ((f[11][0] + f[12][0]) / 2, (f[11][1] + f[12][1]) / 2)
        hip = ((f[23][0] + f[24][0]) / 2, (f[23][1] + f[24][1]) / 2)
        # not upright, or far from the centre of the shot: the tracker is on someone else
        if c[1] > hip[1] - 0.05 or abs(c[0] - 0.5) > 0.3:
            frames[i] = None; continue
        if prev is not None and abs(c[0] - prev[0]) + abs(c[1] - prev[1]) > 0.08:
            frames[i] = None; continue
        prev = c
    # interpolate gaps
    idx = [i for i, f in enumerate(frames) if f is not None]
    if not idx: return None
    for i in range(len(frames)):
        if frames[i] is None:
            lo = max([j for j in idx if j < i], default=None); hi = min([j for j in idx if j > i], default=None)
            if lo is None: frames[i] = frames[hi]
            elif hi is None: frames[i] = frames[lo]
            else:
                t = (i - lo) / (hi - lo)
                frames[i] = [[frames[lo][k][m] * (1 - t) + frames[hi][k][m] * t for m in range(3)] for k in range(33)]
    # light smoothing
    sm = []
    for i in range(len(frames)):
        win = [frames[j] for j in range(max(0, i - 1), min(len(frames), i + 2))]
        sm.append([[sum(w[k][m] for w in win) / len(win) for m in range(3)] for k in range(33)])
    flat = []
    for f in sm:
        for k in JOINTS:
            x, y, v = f[k]
            flat += [round(max(0, min(1, x)) * 1000), round(max(0, min(1, y)) * 1000), round(max(0, min(1, v)) * 100)]
    return {"n": len(sm), "d": flat}

clips = [c for c in (clip(*r) for r in ranges) if c]
json.dump({"fps": fps, "aspect": round(d['width'] / d['height'], 4), "joints": NAMES, "clips": clips}, open(out, 'w'), separators=(',', ':'))
print(out, [c['n'] for c in clips], 'frames;', sum(c['n'] for c in clips) / fps, 's')
