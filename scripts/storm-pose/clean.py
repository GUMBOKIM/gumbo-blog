"""Compact 3D clip for the widget from extract_shirt.py output.

usage: python clean3d.py <raw.json> <out.json> <t0-t1> [<t0-t1> ...]

Keeps 17 joints of the MediaPipe world landmarks (metres, hip-centred), drops frames whose
2D shoulder centre jumps, interpolates gaps linearly, smooths with a 3-frame window and
quantises to millimetres. Visibility comes from the image landmarks.
"""
import json, sys
JOINTS = [0, 2, 5, 7, 8, 11, 12, 13, 14, 15, 16, 23, 24, 25, 26, 27, 28]
NAMES = ["nose", "eyeL", "eyeR", "earL", "earR", "shoulderL", "shoulderR", "elbowL", "elbowR", "wristL", "wristR",
         "hipL", "hipR", "kneeL", "kneeR", "ankleL", "ankleR"]
src, out = sys.argv[1], sys.argv[2]
ranges = [tuple(map(float, r.split('-'))) for r in sys.argv[3:]]
d = json.load(open(src)); fps = d['fps']; start = d['start']; F = d['frames']

def clip(t0, t1):
    a, b = round((t0 - start) * fps), round((t1 - start) * fps)
    fr = [F[i] for i in range(a, min(b, len(F)))]
    prev = None
    for i, f in enumerate(fr):
        if f is None: continue
        c = ((f['i'][11][0] + f['i'][12][0]) / 2, (f['i'][11][1] + f['i'][12][1]) / 2)
        if prev is not None and abs(c[0] - prev[0]) + abs(c[1] - prev[1]) > 0.08:
            fr[i] = None; continue
        prev = c
    idx = [i for i, f in enumerate(fr) if f is not None]
    if not idx: return None
    def vec(f):  # 17 joints x [X, Y, Z, vis]
        return [[f['w'][k][0], f['w'][k][1], f['w'][k][2], f['i'][k][2]] for k in JOINTS]
    V = [vec(f) if f else None for f in fr]
    for i in range(len(V)):
        if V[i] is None:
            lo = max([j for j in idx if j < i], default=None); hi = min([j for j in idx if j > i], default=None)
            if lo is None: V[i] = V[hi]
            elif hi is None: V[i] = V[lo]
            else:
                t = (i - lo) / (hi - lo)
                V[i] = [[V[lo][k][m] * (1 - t) + V[hi][k][m] * t for m in range(4)] for k in range(len(JOINTS))]
    # MediaPipe world coordinates are camera-aligned, so a camera looking down tilts everyone.
    # Standing dominates these clips, so rotate the clip until the median hips->shoulders
    # direction points straight up (y down in MediaPipe space).
    import math
    ups = []
    for f in V:
        sc = [(f[5][m] + f[6][m]) / 2 for m in range(3)]; hc = [(f[11][m] + f[12][m]) / 2 for m in range(3)]
        u = [sc[m] - hc[m] for m in range(3)]; n = math.sqrt(sum(x * x for x in u)) or 1
        ups.append([x / n for x in u])
    med = [sorted(u[m] for u in ups)[len(ups) // 2] for m in range(3)]
    n = math.sqrt(sum(x * x for x in med)) or 1; a = [x / n for x in med]; b = [0.0, -1.0, 0.0]
    v = [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]
    c = sum(a[m] * b[m] for m in range(3)); s_ = math.sqrt(sum(x * x for x in v))
    if s_ > 1e-6:
        k = (1 - c) / (s_ * s_)
        K = [[0, -v[2], v[1]], [v[2], 0, -v[0]], [-v[1], v[0], 0]]
        R = [[(1 if i == j else 0) + K[i][j] + k * sum(K[i][t] * K[t][j] for t in range(3)) for j in range(3)] for i in range(3)]
        for f in V:
            for jnt in f:
                x, y, z = jnt[0], jnt[1], jnt[2]
                jnt[0], jnt[1], jnt[2] = (R[0][0] * x + R[0][1] * y + R[0][2] * z, R[1][0] * x + R[1][1] * y + R[1][2] * z, R[2][0] * x + R[2][1] * y + R[2][2] * z)
        print(f'clip {t0}: tilt corrected by {math.degrees(math.acos(max(-1, min(1, c)))):.1f} deg')
    sm = []
    for i in range(len(V)):
        win = [V[j] for j in range(max(0, i - 1), min(len(V), i + 2))]
        sm.append([[sum(w[k][m] for w in win) / len(win) for m in range(4)] for k in range(len(JOINTS))])
    flat = []
    for f in sm:
        for X, Y, Z, vis in f:
            flat += [round(X * 1000), round(Y * 1000), round(Z * 1000), round(max(0, min(1, vis)) * 100)]
    return {"n": len(sm), "d": flat, "t0": t0}

clips = [c for c in (clip(*r) for r in ranges) if c]
json.dump({"fps": fps, "joints": NAMES, "clips": clips}, open(out, 'w'), separators=(',', ':'))
print(out, [c['n'] for c in clips], 'frames;', round(sum(c['n'] for c in clips) / fps, 1), 's')
