"""Sound effects and ambience for The Guild, made from noise and oscillators
(plus a few FluidR3 instrument notes for the musical stingers).

Writes:
  out/sfx.ogg       every effect in one mono file, with gaps between
  out/sfx.json      name -> [start s, length s]
  out/amb-*.ogg     ambience loops (stereo)
"""
import json, numpy as np
from scipy.signal import butter, sosfilt, fftconvolve
from engine import SR, bank, midi, make_ir, write, lowpass, highpass, repitch, master

rng = np.random.default_rng(2026)


def t_(d):
    return np.arange(int(d * SR)) / SR


def noise(d, color='white'):
    n = rng.normal(0, 1, int(d * SR))
    if color == 'pink':
        n = lowpass(n, 1200, 1) * 2 + n * 0.25
    elif color == 'brown':
        n = np.cumsum(n)
        n = highpass(n, 20, 1)
        n /= np.abs(n).max() + 1e-9
    return n


def bp(x, lo, hi, order=2):
    sos = butter(order, [lo, hi], 'band', fs=SR, output='sos')
    return sosfilt(sos, x)


def lp(x, hz, order=2):
    return lowpass(x, hz, order)


def hp(x, hz, order=2):
    return highpass(x, hz, order)


def env(d, attack=0.002, tau=0.1):
    t = t_(d)
    e = np.exp(-t / tau)
    a = int(attack * SR)
    if a > 0:
        e[:a] *= np.linspace(0, 1, a)
    return e


def blwave(freq, shape='saw'):
    """Band-limited saw or square from a frequency per sample (no aliasing)."""
    ph = 2 * np.pi * np.cumsum(freq) / SR
    top = int((SR / 2 - 500) / max(1.0, float(np.max(freq))))
    out = np.zeros_like(ph)
    for k in range(1, max(2, top) + 1):
        if shape == 'square' and k % 2 == 0:
            continue
        out += np.sin(k * ph) / k
    return out * (2 / np.pi if shape == 'saw' else 4 / np.pi)


def sweep(f0, f1, d, shape='sine', curve='exp'):
    t = t_(d)
    if curve == 'exp':
        f = f0 * (f1 / f0) ** (t / d)
    else:
        f = f0 + (f1 - f0) * t / d
    if shape in ('saw', 'square'):
        return blwave(f, shape)
    return np.sin(2 * np.pi * np.cumsum(f) / SR)


def pad(x, d):
    n = int(round(d * SR))
    return np.pad(x, (0, max(0, n - len(x))))[:n]


def mix(*parts):
    n = max(len(p) for p in parts)
    out = np.zeros(n)
    for p in parts:
        out[:len(p)] += p
    return out


def at(x, sec, total):
    out = np.zeros(int(total * SR))
    s = int(sec * SR)
    e = min(len(out), s + len(x))
    out[s:e] += x[:e - s]
    return out


_irs = {}


def verb(x, rt=0.8, wet=0.25, seed=3, predelay=0.012, tail=None):
    key = (rt, seed, predelay)
    if key not in _irs:
        _irs[key] = make_ir(rt, seed=seed, predelay=predelay)[:, 0]
    ir = _irs[key]
    y = fftconvolve(x, ir)[: len(x) + int((tail if tail is not None else rt) * SR)]
    out = np.pad(x, (0, max(0, len(y) - len(x))))[: len(y)] + hp(y, 150) * wet * 0.35
    return out


def fade_end(x, d=0.02):
    k = min(len(x), int(d * SR))
    x = x.copy()
    x[-k:] *= np.linspace(1, 0, k)
    return x


def norm(x, peak_db=-3.0):
    p = np.abs(x).max() + 1e-12
    return x / p * 10 ** (peak_db / 20)


def sample(inst, note, d, gain=1.0, rel=0.3, det=0):
    a = bank(inst)[midi(note)].mean(1)
    if det:
        a = repitch(np.stack([a, a], 1), 2 ** (det / 1200))[:, 0]
    n = int(d * SR)
    a = a[:n].copy() if n <= len(a) else np.pad(a, (0, n - len(a)))
    k = int(rel * SR)
    a[-k:] *= np.exp(-np.linspace(0, 6, k))
    return a * gain


# ---------------------------------------------------------------- UI

def s_tap():
    click = hp(noise(0.012), 2500) * env(0.012, 0.0005, 0.002)
    body = np.sin(2 * np.pi * 1650 * t_(0.04)) * env(0.04, 0.0005, 0.008) * 0.4
    return norm(mix(click * 0.6, body), -10)


def s_tab():
    x = bp(noise(0.09), 1500, 6000) * env(0.09, 0.012, 0.025)
    thump = np.sin(2 * np.pi * 220 * t_(0.05)) * env(0.05, 0.001, 0.012) * 0.5
    return norm(mix(x, thump), -11)


def s_open():
    d = 0.22
    t = t_(d)
    x = noise(d)
    out = np.zeros_like(x)
    # A rising band of noise, like a sheet of paper drawn across a table.
    for i in range(8):
        s, e = i * len(x) // 8, (i + 1) * len(x) // 8
        f = 700 * (3.0 ** (i / 7))
        out[s:e] = bp(x, f * 0.7, f * 1.4)[s:e]
    w = np.sin(np.pi * t / d) ** 2
    return norm(lp(out * w, 6000), -12)


def s_nope():
    t = t_(0.24)
    a = np.sin(2 * np.pi * 130 * t) * env(0.24, 0.002, 0.05)
    b = at(np.sin(2 * np.pi * 110 * t_(0.14)) * env(0.14, 0.002, 0.05), 0.09, 0.24)
    return norm(lp(a + b, 900), -8)


def s_paper():
    d = 0.5
    x = noise(d)
    crinkle = np.zeros_like(x)
    for _ in range(26):
        p = int(rng.uniform(0, d - 0.03) * SR)
        k = int(rng.uniform(0.004, 0.02) * SR)
        crinkle[p:p + k] += rng.normal(0, 1, k) * np.exp(-np.linspace(0, 5, k)) * rng.uniform(0.3, 1)
    body = bp(x, 2000, 7000) * np.sin(np.pi * t_(d) / d) ** 2 * 0.25
    return norm(mix(hp(crinkle, 1800), body), -10)


# ---------------------------------------------------------------- game

def creak(d=0.8, f=95, bright=1.0):
    """A hinge: stick-slip pulses, their rate wandering."""
    t = t_(d)
    rate = f * (1 + 0.35 * np.sin(2 * np.pi * 1.3 * t + 1) + 0.25 * np.sin(2 * np.pi * 3.7 * t))
    ph = np.cumsum(rate) / SR
    pulses = (np.diff(np.floor(ph), prepend=0) > 0).astype(float)
    pulses *= rng.uniform(0.5, 1, len(pulses))
    ring = np.zeros(int(0.02 * SR))
    tt = t_(0.02)
    for fr in (820, 1460, 2310):
        ring += np.sin(2 * np.pi * fr * bright * tt) * np.exp(-tt / 0.004)
    x = np.convolve(pulses, ring)[: len(t)]
    w = np.sin(np.pi * np.clip(t / d, 0, 1)) ** 0.7
    return x * w


def step(gravel=True):
    d = 0.16
    x = noise(d)
    crunch = np.zeros_like(x)
    for _ in range(14):
        p = int(rng.uniform(0, 0.08) * SR)
        k = int(rng.uniform(0.002, 0.012) * SR)
        crunch[p:p + k] += rng.normal(0, 1, k) * np.exp(-np.linspace(0, 4, k)) * rng.uniform(0.2, 1)
    thud = np.sin(2 * np.pi * 70 * t_(d)) * env(d, 0.003, 0.03)
    return mix(hp(crunch, 1200) * (0.8 if gravel else 0.2), lp(x, 500) * env(d, 0.003, 0.03) * 0.7, thud * 0.8)


def s_send():
    total = 2.2
    g = creak(0.9, 85) * 0.35
    out = at(g, 0.0, total)
    for i in range(6):
        out += at(step() * (0.9 - i * 0.12), 0.55 + i * 0.27 + rng.normal(0, 0.015), total)
    return norm(fade_end(verb(out, 0.9, 0.3))[: int(total * SR)], -6)


def s_engine():
    total = 2.4
    t = t_(total)
    # Starter whine, a catch, then the idle rising and pulling away.
    starter = sweep(18, 22, 0.55, 'saw') * (0.5 + 0.5 * np.sign(np.sin(2 * np.pi * 9 * t_(0.55))))
    starter = lp(starter, 1500) * 0.25
    rpm = np.interp(t, [0, 0.6, 0.75, 1.1, 1.6, 2.4], [0, 0, 32, 26, 48, 40])
    ph = 2 * np.pi * np.cumsum(rpm) / SR
    firing = (np.sin(ph) > 0.6).astype(float) * rng.uniform(0.6, 1, len(t))
    burst = np.convolve(firing, np.exp(-t_(0.02) / 0.004))[: len(t)]
    body = lp(burst * noise(total) * 0.5 + burst, 700)
    body *= np.interp(t, [0, 0.6, 0.7, 2.0, 2.4], [0, 0, 1, 0.8, 0])
    out = at(starter, 0, total) + body * 0.8
    return norm(fade_end(verb(out, 0.6, 0.2))[: int(total * SR)], -5)


def strum(inst, notes, gap=0.025, d=2.6, vel=1.0, rel=0.8):
    out = np.zeros(int((d + gap * len(notes)) * SR))
    for i, n in enumerate(notes):
        s = sample(inst, n, d, (0.75 + 0.25 * (i / len(notes))) * vel, rel)
        out[int(i * gap * SR): int(i * gap * SR) + len(s)] += s
    return out


def s_home():
    a = strum('acoustic_guitar_steel', ['D3', 'A3', 'D4', 'E4', 'A4'], 0.03, 2.2)
    b = strum('acoustic_guitar_steel', ['D3', 'A3', 'D4', 'Gb4', 'A4'], 0.025, 2.4, 0.8)
    out = at(a, 0, 3.2) + at(b, 0.75, 3.2)
    return norm(fade_end(verb(out, 1.6, 0.4)[: int(3.2 * SR)], 0.4), -6)


def s_recruit():
    out = np.zeros(int(2.6 * SR))
    for i, (n, w) in enumerate([('A3', 0), ('D4', 0.22), ('Gb4', 0.44), ('A4', 0.66)]):
        out += at(sample('acoustic_guitar_nylon', n, 1.8, 0.9, 0.6), w, 2.6)
    return norm(fade_end(verb(out, 1.6, 0.4)[: int(2.6 * SR)], 0.3), -7)


def metal_hit(f0=420, d=0.5, damp=0.12, hard=1.0):
    t = t_(d)
    ratios = [1, 2.32, 4.25, 6.63, 9.38]
    x = sum(np.sin(2 * np.pi * f0 * r * t + rng.uniform(0, 6)) * np.exp(-t / (damp / (1 + i * 0.6))) / (1 + i * 0.5)
            for i, r in enumerate(ratios))
    click = hp(noise(0.006), 3000) * env(0.006, 0.0002, 0.0015) * hard
    return mix(x * 0.5, click)


def s_loot():
    total = 0.9
    out = np.zeros(int(total * SR))
    for i in range(6):
        out += at(metal_hit(rng.uniform(500, 1400), 0.35, rng.uniform(0.03, 0.08)) * rng.uniform(0.4, 1), 0.02 + i * rng.uniform(0.04, 0.09) + i * 0.03, total)
    return norm(fade_end(verb(out, 0.5, 0.2)[: int(total * SR)]), -8)


def hammer(on='wood'):
    d = 0.35
    t = t_(d)
    if on == 'wood':
        knock = sum(np.sin(2 * np.pi * f * t) * np.exp(-t / dd) for f, dd in [(180, 0.04), (410, 0.02), (980, 0.01)])
        return mix(knock, hp(noise(0.01), 1500) * env(0.01, 0.0002, 0.002) * 0.8)
    return metal_hit(620, d, 0.09)


def s_build():
    total = 1.6
    out = np.zeros(int(total * SR))
    for i, w in enumerate([0, 0.33, 0.62, 1.0]):
        out += at(hammer('wood') * (1 - 0.1 * i), w, total)
    out += at(metal_hit(300, 0.8, 0.15) * 0.25, 1.0, total)
    return norm(fade_end(verb(out, 0.7, 0.3)[: int(total * SR)]), -6)


def s_craft():
    total = 1.2
    out = at(metal_hit(780, 0.7, 0.18), 0, total) + at(metal_hit(760, 0.6, 0.15) * 0.8, 0.28, total)
    rasp = bp(noise(0.4), 2500, 7000) * (0.5 + 0.5 * np.sign(np.sin(2 * np.pi * 7 * t_(0.4)))) * 0.25
    out += at(rasp * np.sin(np.pi * t_(0.4) / 0.4), 0.62, total)
    return norm(fade_end(verb(out, 0.6, 0.25)[: int(total * SR)]), -6)


def bell(f0, d=3.0, tau=1.2, gain=1.0):
    t = t_(d)
    partials = [(0.5, 1.0), (1.0, 0.9), (1.19, 0.6), (1.56, 0.5), (2.0, 0.45), (2.51, 0.25), (3.01, 0.2), (4.1, 0.1)]
    x = sum(a * np.sin(2 * np.pi * f0 * r * t + i) * np.exp(-t / (tau / (1 + 0.5 * i))) for i, (r, a) in enumerate(partials))
    x = mix(x, hp(noise(0.01), 2000) * env(0.01, 0.0002, 0.002) * 0.3)
    return pad(x, d) * gain


def s_death():
    total = 4.6
    cel = sample('cello', 'D2', 3.6, 1.0, 1.4)
    cel[: int(0.3 * SR)] *= np.linspace(0, 1, int(0.3 * SR))
    out = at(cel * 1.6, 0, total) + at(bell(196, 4.2, 1.6, 0.35), 0.15, total)
    return norm(fade_end(verb(out, 2.5, 0.5)[: int(total * SR)], 0.6), -6)


def s_alarm():
    total = 2.4
    out = np.zeros(int(total * SR))
    t0 = 0.0
    i = 0
    while t0 < 1.9:
        out += at(bell(930, 0.6, 0.25, 0.7 + 0.3 * (i % 2)), t0, total)
        t0 += 0.13 + rng.uniform(-0.01, 0.015)
        i += 1
    return norm(fade_end(verb(out, 1.2, 0.35)[: int(total * SR)], 0.3), -5)


def s_radio():
    total = 1.1
    st = bp(noise(0.55), 600, 4500) * (0.6 + 0.4 * rng.uniform(0, 1, int(0.55 * SR)))
    st *= np.interp(t_(0.55), [0, 0.03, 0.45, 0.55], [0, 1, 0.9, 0])
    beep = np.sin(2 * np.pi * 1180 * t_(0.12)) * np.interp(t_(0.12), [0, 0.01, 0.11, 0.12], [0, 1, 1, 0])
    beep2 = np.sin(2 * np.pi * 880 * t_(0.12)) * np.interp(t_(0.12), [0, 0.01, 0.11, 0.12], [0, 1, 1, 0])
    squelch = hp(noise(0.06), 1500) * env(0.06, 0.001, 0.02)
    out = at(st * 0.5, 0, total) + at(squelch * 0.6, 0.55, total) + at(beep * 0.35, 0.65, total) + at(beep2 * 0.35, 0.82, total)
    return norm(fade_end(out), -8)


def s_decision():
    total = 2.0
    p = s_paper() * 0.6
    g = sample('acoustic_guitar_steel', 'D2', 1.8, 1.0, 0.7) + sample('acoustic_guitar_steel', 'A2', 1.8, 0.7, 0.7)
    out = at(p, 0, total) + at(g, 0.2, total)
    return norm(fade_end(verb(out, 1.4, 0.35)[: int(total * SR)], 0.3), -7)


def s_clue():
    total = 2.6
    out = np.zeros(int(total * SR))
    for n, w in [('C5', 0), ('Eb5', 0.32), ('G5', 0.64), ('Gb5', 1.0)]:
        out += at(sample('music_box', n, 1.5, 0.8, 0.8, det=-35), w, total)
    return norm(fade_end(verb(out, 2.0, 0.6)[: int(total * SR)], 0.3), -8)


def s_trade():
    total = 0.9
    sack = lp(noise(0.12), 900) * env(0.12, 0.004, 0.03)
    out = at(sack, 0, total)
    for i in range(3):
        out += at(metal_hit(rng.uniform(1800, 2600), 0.3, 0.05) * 0.5, 0.12 + i * 0.09, total)
    return norm(fade_end(verb(out, 0.5, 0.2)[: int(total * SR)]), -8)


def s_reward():
    total = 2.4
    out = np.zeros(int(total * SR))
    for n, w in [('D4', 0), ('A4', 0.12), ('D5', 0.24), ('E5', 0.36)]:
        out += at(sample('acoustic_guitar_steel', n, 1.8, 0.8, 0.6), w, total)
    return norm(fade_end(verb(out, 1.5, 0.4)[: int(total * SR)], 0.3), -7)


def s_victory():
    total = 3.0
    out = np.zeros(int(total * SR))
    for n, w, d in [('E3', 0, 0.35), ('B3', 0.3, 0.35), ('E4', 0.6, 1.8)]:
        h = sample('french_horn', n, d + 0.3, 1.0, 0.25)
        out += at(h, w, total)
    out += at(sample('timpani', 'E2', 2.0, 1.0, 1.0) * 1.2, 0.6, total)
    out += at(sample('string_ensemble_1', 'E4', 1.6, 0.5, 0.8) + sample('string_ensemble_1', 'B4', 1.6, 0.4, 0.8), 0.62, total)
    return norm(fade_end(verb(out, 1.8, 0.45)[: int(total * SR)], 0.5), -5)


def s_defeat():
    total = 3.0
    out = np.zeros(int(total * SR))
    for n, w in [('B2', 0), ('Bb2', 0.5), ('A2', 1.0)]:
        out += at(sample('cello', n, 0.9 if n != 'A2' else 1.7, 1.2, 0.4), w, total)
    out += at(sample('timpani', 'A1', 2.0, 0.8, 1.0), 1.0, total)
    return norm(fade_end(verb(out, 1.8, 0.45)[: int(total * SR)], 0.5), -6)


# ---------------------------------------------------------------- fights

def gun(power=1.0, d=0.6, body_hz=1800, thump_hz=80, rt=0.7, tail=0.35):
    """A shot: a crack, a burst of noise, a thump, and the yard sending it back."""
    crack = hp(noise(0.004), 2000) * env(0.004, 0.0001, 0.0008) * 1.2
    b = noise(0.12)
    body = lp(b, body_hz) * env(0.12, 0.0003, 0.018 * power)
    thump = sweep(thump_hz * 1.8, thump_hz, 0.12) * env(0.12, 0.0005, 0.03 * power)
    x = mix(crack, body * 1.1, thump * 0.9 * power)
    x = np.tanh(x * 1.5)
    y = verb(pad(x, d), rt, tail, seed=5, predelay=0.03)
    return norm(fade_end(y[: int(d * SR)]), -2)


def s_pistol():
    return gun(0.8, 0.55, 2600, 110, 0.6, 0.3)


def s_pistol2():
    return gun(0.75, 0.55, 2200, 120, 0.6, 0.3)


def s_rifle():
    return gun(1.3, 0.9, 1600, 70, 1.1, 0.45)


def s_shotgun():
    x = gun(1.6, 0.8, 1100, 55, 0.9, 0.4)
    return x


def s_crossbow():
    total = 0.45
    t = t_(0.25)
    twang = (sweep(160, 150, 0.25, 'saw') * np.exp(-t / 0.05))
    twang = bp(twang, 200, 2500)
    click = hp(noise(0.004), 2000) * env(0.004, 0.0001, 0.001)
    whoosh = bp(noise(0.2), 800, 3000) * np.sin(np.pi * t_(0.2) / 0.2) ** 2 * 0.4
    out = at(mix(twang, click), 0, total) + at(whoosh, 0.05, total)
    return norm(fade_end(out), -4)


def s_zap():
    total = 0.45
    t = t_(0.4)
    buzz = sweep(120, 90, 0.4, 'saw') * (0.6 + 0.4 * np.sign(np.sin(2 * np.pi * 37 * t)))
    crackle = np.zeros_like(t)
    for _ in range(40):
        p = int(rng.uniform(0, 0.38) * SR)
        crackle[p:p + 60] += rng.normal(0, 1, 60) * np.exp(-np.linspace(0, 4, 60))
    out = (bp(buzz, 100, 4000) * 0.5 + hp(crackle, 2000)) * np.interp(t, [0, 0.01, 0.3, 0.4], [0, 1, 0.6, 0])
    return norm(pad(out, total), -5)


def s_laser():
    total = 0.4
    x = sweep(1900, 420, 0.25, 'square') * env(0.25, 0.002, 0.12)
    x = lp(x, 5000) * 0.6 + sweep(1900, 420, 0.25) * env(0.25, 0.002, 0.12) * 0.4
    return norm(pad(verb(x, 0.4, 0.2), total), -6)


def whoosh(d=0.24, lo=400, hi=2400, peak=0.45):
    t = t_(d)
    x = noise(d)
    centre = lo * (hi / lo) ** np.sin(np.pi * t / d)
    out = np.zeros_like(x)
    seg = 12
    for i in range(seg):
        s, e = i * len(x) // seg, (i + 1) * len(x) // seg
        c = centre[(s + e) // 2]
        out[s:e] = bp(x, c * 0.6, min(c * 1.6, SR / 2 - 200))[s:e]
    w = np.interp(t, [0, d * peak, d], [0, 1, 0]) ** 1.5
    return out * w


def s_swing():
    return norm(whoosh(0.24, 300, 1800), -8)


def s_swing2():
    return norm(whoosh(0.2, 400, 2400, 0.55), -8)


def body_hit(power=1.0):
    d = 0.3
    t = t_(d)
    thud = sweep(140, 55, d) * env(d, 0.001, 0.05 * power)
    slap = bp(noise(0.03), 600, 3500) * env(0.03, 0.0005, 0.008)
    crunch = lp(noise(d), 1200) * env(d, 0.001, 0.025)
    return mix(thud * 1.0 * power, slap * 0.7, crunch * 0.6)


def s_blunt():
    total = 0.4
    out = at(whoosh(0.12, 400, 1500) * 0.4, 0, total) + at(body_hit(1.2), 0.08, total)
    return norm(fade_end(verb(out, 0.4, 0.15)[: int(total * SR)]), -3)


def s_blade():
    total = 0.4
    slice_ = hp(noise(0.08), 3000) * env(0.08, 0.002, 0.02)
    out = at(whoosh(0.14, 900, 4000) * 0.6, 0, total) + at(mix(slice_ * 0.8, body_hit(0.7) * 0.7), 0.1, total)
    return norm(fade_end(verb(out, 0.4, 0.15)[: int(total * SR)]), -3)


def s_punch():
    total = 0.3
    out = at(whoosh(0.08, 500, 1500) * 0.3, 0, total) + at(body_hit(0.8), 0.05, total)
    return norm(fade_end(out[: int(total * SR)]), -4)


def s_hurt():
    return norm(fade_end(body_hit(1.0)), -3)


def s_ricochet():
    total = 0.5
    p = sweep(3200, 1300, 0.35) * env(0.35, 0.001, 0.12)
    click = hp(noise(0.005), 3000) * env(0.005, 0.0001, 0.001)
    out = at(click, 0, total) + at(p * 0.35, 0.01, total)
    return norm(fade_end(verb(out, 0.6, 0.2)[: int(total * SR)]), -8)


def s_fall():
    total = 0.8
    a = body_hit(1.4)
    gravel = hp(noise(0.3), 1200) * env(0.3, 0.005, 0.07) * 0.4
    out = at(a, 0, total) + at(gravel, 0.03, total) + at(body_hit(0.6) * 0.5, 0.17, total)
    return norm(fade_end(verb(out, 0.6, 0.2)[: int(total * SR)]), -3)


def growl(d=0.6, f=70, rough=1.0):
    t = t_(d)
    pitch = f * (1 + 0.15 * np.sin(2 * np.pi * 5 * t)) * np.interp(t, [0, d * 0.3, d], [0.9, 1.2, 0.8])
    src = blwave(pitch)
    am = 0.6 + 0.4 * np.sin(2 * np.pi * 31 * t + rng.uniform(0, 6)) * rough
    x = src * am + noise(d) * 0.3 * rough
    out = bp(x, 250, 900) * 1.0 + bp(x, 1000, 2400) * 0.5
    return out * np.interp(t, [0, 0.05, d * 0.7, d], [0, 1, 0.8, 0])


def s_bite():
    total = 0.55
    snap = mix(hp(noise(0.02), 1500) * env(0.02, 0.0005, 0.004), body_hit(0.5) * 0.6)
    out = at(growl(0.35, 95) * 0.6, 0, total) + at(snap, 0.25, total)
    return norm(fade_end(out), -4)


def s_snarl():
    return norm(fade_end(growl(0.6, 80, 1.2)), -6)


def s_groan():
    total = 1.0
    t = t_(0.9)
    pitch = 85 * np.interp(t, [0, 0.4, 0.9], [1.0, 1.15, 0.8]) * (1 + 0.03 * rng.normal(0, 1, len(t)).cumsum() / 200)
    src = blwave(pitch) + noise(0.9) * 0.15
    # Vowel "oh" sliding to "uh".
    out = bp(src, 350, 650) * 1.0 + bp(src, 800, 1200) * 0.5 + bp(src, 2300, 2900) * 0.15
    out *= np.interp(t, [0, 0.15, 0.6, 0.9], [0, 1, 0.8, 0])
    return norm(pad(verb(out, 1.0, 0.3), total), -5)


def s_servo():
    total = 0.5
    t = t_(0.45)
    whirr = sweep(300, 520, 0.45, 'square') * 0.3 + sweep(600, 1040, 0.45) * 0.3
    whirr = bp(whirr, 200, 3000) * np.interp(t, [0, 0.05, 0.38, 0.45], [0, 1, 1, 0])
    clank = metal_hit(260, 0.3, 0.05) * 0.8
    out = at(whirr, 0, total) + at(clank, 0.35, total)
    return norm(pad(out, total), -5)


def s_heal():
    total = 0.9
    rustle = bp(noise(0.4), 1200, 6000) * np.sin(np.pi * t_(0.4) / 0.4) ** 2 * 0.3
    chime = sample('music_box', 'A5', 0.8, 0.6, 0.5) + sample('music_box', 'E6', 0.8, 0.4, 0.5)
    out = at(rustle, 0, total) + at(chime, 0.25, total)
    return norm(fade_end(verb(out, 1.0, 0.3)[: int(total * SR)]), -8)


def s_shuffle():
    total = 0.35
    x = bp(noise(0.3), 400, 3000) * np.interp(t_(0.3), [0, 0.05, 0.12, 0.2, 0.3], [0, 1, 0.4, 0.8, 0])
    return norm(pad(x, total), -12)


def s_run():
    total = 0.9
    out = np.zeros(int(total * SR))
    for i in range(5):
        out += at(step() * (1 - i * 0.16), i * 0.15, total)
    return norm(fade_end(out), -6)


def s_door():
    total = 0.9
    slam = mix(body_hit(1.6), hammer('wood') * 0.7)
    out = at(slam, 0, total) + at(creak(0.4, 140, 0.8) * 0.15, 0.1, total)
    return norm(fade_end(verb(out, 0.8, 0.3)[: int(total * SR)]), -3)


def s_work():
    total = 0.8
    out = np.zeros(int(total * SR))
    for i in range(4):
        out += at(metal_hit(rng.uniform(900, 1600), 0.2, 0.03) * rng.uniform(0.3, 0.7), i * 0.16 + rng.uniform(0, 0.03), total)
    out += at(lp(noise(0.5), 1500) * env(0.5, 0.05, 0.2) * 0.2, 0.05, total)
    return norm(fade_end(out), -9)


def s_stare():
    total = 1.4
    h = sample('french_horn', 'E2', 1.0, 1.0, 0.4) + sample('french_horn', 'B2', 1.0, 0.5, 0.4)
    out = at(h, 0, total)
    return norm(fade_end(verb(out, 1.2, 0.3)[: int(total * SR)]), -7)


def s_bark():
    total = 0.6
    out = np.zeros(int(total * SR))
    for w in (0, 0.22):
        d = 0.14
        t = t_(d)
        pitch = np.interp(t, [0, 0.03, d], [380, 520, 300])
        src = blwave(pitch) + noise(d) * 0.4
        x = bp(src, 500, 1400) + bp(src, 1600, 3000) * 0.6
        x *= np.interp(t, [0, 0.01, 0.06, d], [0, 1, 0.7, 0])
        out += at(x, w, total)
    return norm(fade_end(verb(out, 0.6, 0.25)[: int(total * SR)]), -5)


SOUNDS = {name[2:]: fn for name, fn in globals().items() if name.startswith('s_') and callable(fn)}


# ---------------------------------------------------------------- voices (3.4.1)
# A player fought eight hollows and they all groaned the same, eight times in a row. Each kind of
# enemy now has three voices (the first is the sound above), and the game gives each enemy in a fight
# one of them at a pitch of its own. Made after everything else with the random state put back, so
# the sounds above and the ambience come out exactly as before.

def groan_voice(base, contour, vowels, d):
    total = d + 0.15
    t = t_(d)
    pitch = base * np.interp(t, np.linspace(0, d, len(contour)), contour) * (1 + 0.03 * rng.normal(0, 1, len(t)).cumsum() / 200)
    src = blwave(pitch) + noise(d) * 0.18
    out = sum(bp(src, lo, hi) * w for lo, hi, w in vowels)
    out *= np.interp(t, [0, 0.12 * d, 0.65 * d, d], [0, 1, 0.8, 0])
    return norm(pad(verb(out, 1.0, 0.3), total), -5)


def v_groan2():
    # Lower and longer, an "aah" that sags.
    return groan_voice(68, [1.0, 1.2, 1.1, 0.7], [(500, 900, 1.0), (1000, 1400, 0.5), (2400, 3000, 0.12)], 1.15)


def v_groan3():
    # Higher and short, an "ooh" with a catch in it.
    return groan_voice(104, [0.95, 1.1, 0.85, 1.05, 0.8], [(250, 450, 1.0), (600, 900, 0.6), (2100, 2600, 0.1)], 0.7)


def v_snarl2():
    return norm(fade_end(growl(0.45, 98, 1.0)), -6)


def v_snarl3():
    return norm(fade_end(growl(0.75, 64, 1.4)), -6)


def servo_voice(f0, f1, d, clank_f):
    total = d + 0.08
    t = t_(d)
    whirr = sweep(f0, f1, d, 'square') * 0.3 + sweep(2 * f0, 2 * f1, d) * 0.3
    whirr = bp(whirr, 200, 3000) * np.interp(t, [0, 0.05, d - 0.07, d], [0, 1, 1, 0])
    out = at(whirr, 0, total) + at(metal_hit(clank_f, 0.3, 0.05) * 0.8, d - 0.1, total)
    return norm(pad(out, total), -5)


def v_servo2():
    return servo_voice(240, 410, 0.55, 200)


def v_servo3():
    return servo_voice(380, 720, 0.34, 340)


def v_hurt2():
    return norm(fade_end(body_hit(0.8)), -3)


def v_hurt3():
    return norm(fade_end(mix(body_hit(1.2), hp(noise(0.04), 2000) * env(0.04, 0.0005, 0.01) * 0.4)), -3)


VOICES = {name[2:]: fn for name, fn in globals().items() if name.startswith('v_') and callable(fn)}


# ---------------------------------------------------------------- the radio (3.11.0)
# Aviel (2026-11-26): "the crackling static of the radio". A crew calling home opens on a squelch,
# static with crackle, and a real voice too far gone to make out (recorded for the game, then
# muffled by radio_voice.py); answering keys the mic and a word comes back through the crackle.
# Made after the voices on random numbers of their own, so every sound above and the ambience
# come out exactly as before. Kept in 400 Hz - 4 kHz: it's heard through a phone's speaker.

def radio_static(d, level=1.0):
    """Hiss in the radio's band, fluttering, with crackles."""
    st = bp(noise(d), 500, 3800) * 0.5
    flutter = 0.65 + 0.35 * np.interp(t_(d), np.linspace(0, d, 12), rng.uniform(0, 1, 12))
    st *= flutter
    crackle = np.zeros(int(d * SR))
    for _ in range(int(d * 28)):
        i = int(rng.uniform(0, d) * SR)
        k = int(rng.uniform(0.0008, 0.004) * SR)
        crackle[i:i + k] += rng.uniform(-1, 1, len(crackle[i:i + k])) * rng.uniform(0.6, 1.6)
    return (st + bp(crackle, 700, 4200) * 0.9) * level


def squelch(d=0.07):
    return bp(noise(d), 1200, 4500) * env(d, 0.001, 0.025)


def radio_voice(name):
    """A line from voices/radio (made by radio_voice.py from real recordings), and where it breaks up."""
    import os, subprocess
    here = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'voices', 'radio')
    pcm = subprocess.run(['ffmpeg', '-v', 'quiet', '-i', os.path.join(here, f'{name}.ogg'), '-f', 'f32le', '-ac', '1',
                          '-ar', str(SR), 'pipe:1'], capture_output=True, check=True).stdout
    v = np.frombuffer(pcm, dtype='<f4').astype(float)
    drops = json.load(open(os.path.join(here, 'drops.json')))[name]
    return v / (np.sqrt(np.mean(v ** 2)) + 1e-9) * 0.18, drops


def on_the_radio(name, answer):
    """Someone on the radio: a squelch (or the mic keyed), static with crackle that surges as the voice breaks up, the voice, a squelch."""
    voice, drops = radio_voice(name)
    lead = 0.12 if answer else 0.35
    d = lead + len(voice) / SR + 0.25
    total = d + 0.15
    out = at(hp(noise(0.004), 1800) * 0.35 if answer else squelch(), 0.0, total)
    st = radio_static(d + 0.01, 1.0)[:int(d * SR)]
    level = np.full(len(st), 0.3)
    for a, b, depth in drops:
        level[int((lead + a) * SR):int((lead + b) * SR)] += depth * 0.55
    level = np.convolve(level, np.ones(int(0.006 * SR)) / int(0.006 * SR), 'same')
    st *= level * np.interp(np.arange(len(st)) / SR, [0, 0.04, d - 0.12, d], [0, 1, 1, 0])
    out += at(st, 0.03, total)
    out += at(voice, lead, total)
    out += at(squelch(0.08) * 0.8, d + 0.02, total)
    # Even loudness across the lines, however loud each was said.
    return fade_end(master(out, -24.0 if answer else -23.0), 0.03)


# A crew calling home, in the caller's voice (m or f) and mood (1 calm, 2 excited, 3 tense, 4 uneasy),
# and the word back when the player answers (three of each).
RADIO = {}
for _who in ('m', 'f'):
    for _n in (1, 2, 3, 4):
        RADIO[f'radio_call_{_who}{_n}'] = (lambda w=_who, n=_n: on_the_radio(f'{w}_call_{n}', False))
    for _n in (1, 2, 3):
        RADIO[f'radio_answer_{_who}{_n}'] = (lambda w=_who, n=_n: on_the_radio(f'{w}_reply_{n}', True))


# ---------------------------------------------------------------- the elites (3.12.0)
# What each elite does that no other enemy does: a plate knocked off, going under and coming up,
# calling more in (a howl, a bell, claps, a siren, a whistle), a gun's sweep and glass that chimes.
# After the radio, on random numbers of their own, so no earlier sound changes.

def made_clang():
    """The made plate (3.12.0), no longer heard."""
    total = 0.9
    t = t_(0.7)
    ring = sum(a * np.sin(2 * np.pi * f * t + i) * np.exp(-t / tau) for i, (f, a, tau) in enumerate([(612, 1.0, 0.18), (1340, 0.7, 0.12), (2210, 0.5, 0.08), (3170, 0.3, 0.05)]))
    hit = hp(noise(0.01), 1500) * env(0.01, 0.0001, 0.002) * 1.4
    out = at(mix(ring, hit), 0, total)
    for k, when in enumerate([0.32, 0.44, 0.52]):
        tt = t_(0.12)
        clink = sum(np.sin(2 * np.pi * f * tt) * np.exp(-tt / 0.04) for f in (900 + 120 * k, 2100 + 90 * k)) * (0.35 - 0.08 * k)
        out += at(clink, when, total)
    return norm(fade_end(verb(out, 0.6, 0.25)[: int(total * SR)]), -4)


def e_clang():
    """A steel plate knocked off (3.15.0: real metal cracking). The made one is still made, and dropped, so the
    random numbers the elites' sounds after it draw stay the same."""
    made_clang()
    return verb(taken('metal'), 0.5, 0.15)


def e_splash():
    """Something big going under (3.15.0: a real splash). The made one is still made, and dropped, so the random
    numbers the elites' sounds after it draw stay the same."""
    made_splash()
    return verb(taken('splash_in'), 0.4, 0.12)


def made_splash():
    """The made splash (3.12.0), no longer heard."""
    total = 1.1
    body = lp(noise(0.7), 2200) * np.interp(t_(0.7), [0, 0.03, 0.25, 0.7], [0, 1, 0.45, 0])
    spray = bp(noise(0.5), 2500, 7000) * np.interp(t_(0.5), [0, 0.02, 0.2, 0.5], [0, 0.6, 0.2, 0])
    out = at(body, 0, total) + at(spray, 0.02, total)
    for _ in range(9):
        f = rng.uniform(500, 1400)
        d = rng.uniform(0.03, 0.07)
        bub = sweep(f, f * 1.8, d) * env(d, 0.002, d / 3) * rng.uniform(0.15, 0.3)
        out += at(bub, rng.uniform(0.2, 0.85), total)
    return norm(fade_end(out, 0.1), -4)


def taken(name):
    """A sound from recorded/ (cut by recorded.py from a free sound Aviel picked, 3.15.0): mono, or stereo for the wind."""
    import os, subprocess
    path = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'recorded', f'{name}.ogg')
    probe = subprocess.run(['ffprobe', '-v', 'quiet', '-show_entries', 'stream=channels', '-of', 'csv=p=0', path],
                           capture_output=True, text=True).stdout.strip()
    ch = int(probe or 1)
    pcm = subprocess.run(['ffmpeg', '-v', 'quiet', '-i', path, '-f', 'f32le', '-ac', str(ch), '-ar', str(SR), 'pipe:1'],
                         capture_output=True, check=True).stdout
    x = np.frombuffer(pcm, dtype='<f4').astype(float)
    return x.reshape(-1, ch) if ch > 1 else x


def speed(x, rate):
    """Played faster (higher) or slower (lower)."""
    if rate == 1:
        return x
    n = int(len(x) / rate)
    return np.interp(np.arange(n) * rate, np.arange(len(x)), x)


def recorded(name):
    """One of the elites' calls from voices/calls (made by recorded.py from real recordings, 3.13.1), dry."""
    import os, subprocess
    here = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'voices', 'calls')
    pcm = subprocess.run(['ffmpeg', '-v', 'quiet', '-i', os.path.join(here, f'{name}.ogg'), '-f', 'f32le', '-ac', '1',
                          '-ar', str(SR), 'pipe:1'], capture_output=True, check=True).stdout
    return np.frombuffer(pcm, dtype='<f4').astype(float)


def e_howl():
    """Old Mother's howl: a real wolf's, up, held and falling away, lower and a little rough for her size."""
    x = recorded('howl')
    x = x + bp(np.tanh(x * 5), 300, 2400) * 0.12
    total = len(x) / SR + 0.35
    return norm(fade_end(verb(at(x, 0, total), 1.6, 0.3)[: int(total * SR)], 0.2), -5)


def e_bell():
    """The Conductor's hand bell: two short, one long."""
    total = 2.0
    out = np.zeros(int(total * SR))
    for when, tau in [(0.0, 0.18), (0.22, 0.18), (0.55, 0.7)]:
        out += at(bell(1180, 1.2, tau, 0.8), when, total)
    return norm(fade_end(verb(out, 1.4, 0.45)[: int(total * SR)], 0.2), -5)


def e_clap():
    """The Matron's two sharp claps (recorded), in an empty ward."""
    x = recorded('claps')
    total = len(x) / SR + 0.5
    return norm(fade_end(verb(at(x, 0, total), 1.5, 0.7)[: int(total * SR)], 0.2), -4)


def e_klaxon():
    """The Warden's siren: a single whoop, up and over."""
    total = 1.2
    d = 0.9
    t = t_(d)
    f = np.interp(t, [0, 0.55, 0.9], [480, 1050, 900])
    x = blwave(f, 'square') * np.interp(t, [0, 0.04, 0.7, 0.9], [0, 1, 1, 0])
    x = bp(x, 400, 3500)
    return norm(fade_end(verb(at(x, 0, total), 1.0, 0.35)[: int(total * SR)], 0.15), -6)


def e_whistle():
    """The Red Hand's whistle (recorded, played faster so it's shrill): up, held, and a fall."""
    x = recorded('whistle')
    total = len(x) / SR + 0.35
    return norm(fade_end(verb(at(x, 0, total), 1.2, 0.4)[: int(total * SR)], 0.15), -6)


def e_burst():
    """Bravo Six's gun raking a line: five heavy shots, quick."""
    total = 1.4
    out = np.zeros(int(total * SR))
    for k in range(5):
        shot = gun(1.2, 0.5, 1400, 65, 0.6, 0.25) * (0.9 + 0.1 * rng.uniform(-1, 1))
        out += at(shot, k * 0.085, total)
    return norm(fade_end(out, 0.2), -2)


def e_chime():
    """Glass ringing where the Glass Man walks: high, clear and a little wrong."""
    total = 1.6
    out = np.zeros(int(total * SR))
    for k, f in enumerate([2350, 3110, 2790, 3720]):
        out += at(bell(f, 1.2, 0.5, 0.5 - 0.08 * k), 0.06 * k + rng.uniform(0, 0.02), total)
    return norm(fade_end(verb(out, 1.8, 0.5)[: int(total * SR)], 0.2), -8)


# Loudness for each (LUFS), so a whistle doesn't drown a clang: set by ear through a phone's speaker.
def e_surface():
    """Something big coming up out of the water (3.15.0, a real splash). Last of the elites' sounds, so none moves."""
    return verb(taken('splash_up'), 0.4, 0.12)


ELITE_LOUDNESS = {'surface': -21, 'clang': -21, 'splash': -21, 'howl': -23, 'bell': -21, 'clap': -19, 'klaxon': -24, 'whistle': -24, 'burst': -19, 'chime': -22}

ELITE = {name[2:]: (lambda fn=fn, name=name: master(fn(), ELITE_LOUDNESS[name[2:]])) for name, fn in globals().items() if name.startswith('e_') and callable(fn)}


# ---------------------------------------------------------------- scenes (3.14.0)
# Sounds for the scenes: the opening, Haven's gate, the elites' first sight. Made on random numbers of
# their own (313), after the elites, so nothing earlier moves. The sounds Aviel hasn't recorded yet
# (the small door, the stamp) are made here until he does: see claude/recordings.md. No voices: words are
# heard only over the radio (Aviel, 2026-11-28). A made one that sounded wrong (a gate's hinge "like a dog
# crying", a match like static) is left out until it's recorded.


def layered(parts, total):
    """Takes laid over each other: (sound, when, gain, rate)."""
    out = np.zeros(int(total * SR))
    for x, when, gain, rate in parts:
        out += at(speed(x, rate) * gain, when, total)
    return out


def c_gravel_walk():
    """Four people walking the rail line's gravel, not quite in step: two takes of one walker (3.15.0), laid over
    each other at different speeds."""
    a, b = taken('gravel_1'), taken('gravel_2')
    out = layered([(a, 0.0, 1.0, 1.0), (b, 0.3, 0.8, 1.0), (a, 0.55, 0.55, 1.06), (b, 0.12, 0.5, 0.94)], 5.1)
    return fade_end(verb(out, 0.5, 0.08), 0.4)


def c_run_gravel():
    """Someone running on gravel, coming closer (3.15.0, real)."""
    x = taken('running')
    return x * np.linspace(0.45, 1.0, len(x))


def c_creak():
    """The old depot's gate swung open as the founders come in: a real iron gate (3.15.0), a little lighter and
    further off than Haven's."""
    x = speed(taken('gate')[: int(2.6 * SR)], 1.12)
    return fade_end(verb(x, 0.8, 0.18), 0.6)


def c_match():
    """A match struck, flaring, burning (3.15.0, real): the first fire."""
    return fade_end(verb(taken('match'), 0.4, 0.1), 0.3)


def c_campfire():
    """The first fire, catching after the match and crackling on through the end of the opening (3.15.0, real)."""
    x = taken('campfire')
    grow = np.clip(np.arange(len(x)) / (2.2 * SR), 0.25, 1.0)
    return x * grow


def c_scream_f():
    """A woman screaming the truth at Haven's gate, out on the road (3.15.0, real; no words)."""
    return fade_end(verb(lp(taken('scream_f'), 6000), 1.6, 0.3), 0.6)


def c_scream_m():
    """A man screaming the truth at Haven's gate, out on the road (3.15.0, real; no words)."""
    return fade_end(verb(lp(taken('scream_m'), 6000), 1.6, 0.3), 0.6)


def c_stamp():
    """A heavy stamp coming down on paper: the guild's name."""
    total = 1.0
    thud = sweep(110, 48, 0.3) * env(0.3, 0.001, 0.08)
    slap = bp(noise(0.05), 600, 4000) * env(0.05, 0.0005, 0.01)
    return fade_end(verb(at(thud * 1.2, 0, total) + at(slap * 0.7, 0, total), 0.8, 0.25), 0.2)


def c_door_bang():
    """A door in a wall thrown open, banging back."""
    total = 1.1
    hitx = at(lp(noise(0.12), 1600) * env(0.12, 0.0005, 0.03), 0, total) + at(sweep(140, 70, 0.2) * env(0.2, 0.001, 0.05) * 0.8, 0, total)
    rattle = bp(noise(0.25), 900, 3000) * env(0.25, 0.002, 0.06) * 0.3
    return fade_end(verb(hitx + at(rattle, 0.03, total), 1.4, 0.4), 0.2)


def c_shot_far():
    """A rifle from the top of a wall, and its echo (3.15.0, real)."""
    return fade_end(taken('shot'), 0.6)


def c_body_fall():
    """Someone going down in the road (3.15.0: a real thud, lighter than the boulder it was)."""
    return fade_end(verb(speed(taken('thud'), 1.3), 0.5, 0.12), 0.2)


def c_stomp():
    """One of the Shepherd's steps: the same thud, slower, lower and in the dam's echo."""
    return fade_end(verb(speed(taken('thud'), 0.72), 1.6, 0.3), 0.4)


def c_gate_groan():
    """Haven's gate opening: a real iron gate (3.15.0), slower and lower for its size, in the dam's echo."""
    return fade_end(verb(speed(taken('gate'), 0.82), 1.8, 0.35), 0.6)


def c_pull_up():
    """The Vultures' trucks coming up the road and braking (3.15.0, a real old car): over before they come on
    (Aviel, 2026-11-28), so the engine is cut short of its idling."""
    x = taken('pull_up')[int(1.4 * SR):int(5.2 * SR)]
    x = x * np.clip(np.arange(len(x)) / (0.6 * SR), 0, 1)
    return fade_end(x, 0.9)


def c_gale():
    """Wind across open ground, hard (3.15.0, real): the rail line, the dam."""
    return taken('gale')


# Loudness for each (LUFS), so a footstep doesn't drown a line.
SCENE_LOUDNESS = {'gravel_walk': -25, 'run_gravel': -23, 'creak': -26, 'match': -19, 'campfire': -24, 'scream_f': -20, 'scream_m': -20, 'stamp': -18, 'door_bang': -20, 'shot_far': -17, 'body_fall': -20, 'stomp': -19, 'gate_groan': -21, 'pull_up': -27, 'gale': -26}

SCENE = {name[2:]: (lambda fn=fn, name=name: master(fn(), SCENE_LOUDNESS[name[2:]])) for name, fn in globals().items() if name.startswith('c_') and callable(fn)}


# ---------------------------------------------------------------- ambience (stereo loops)

def loop_xfade(x, fade):
    """Make x loop: its last `fade` seconds blended into its start."""
    k = int(fade * SR)
    body = x[:-k].copy()
    w = np.linspace(0, np.pi / 2, k)
    if body.ndim == 2:
        w = w[:, None]
    body[:k] = body[:k] * np.sin(w) + x[-k:] * np.cos(w)
    return body


def a_wind(d=32.0):
    """The wind (3.15.0: real wind, the soft take with a little of the hard one under it), as a loop: copies
    of each laid round a circle at even steps, each from a different place in it, each faded in and out, so
    they add up to a steady wind with no seam and no swell coming back on the beat. The made wind is still
    made and dropped, so the ambience after it draws the same random numbers."""
    made_wind()
    pick = np.random.default_rng(315)
    n = int(d * SR)
    out = np.zeros((n, 2))
    for take, step, gain in (('breeze', 4.0, 1.0), ('gale', 8.0, 0.12)):
        x = taken(take)
        x = x if x.ndim == 2 else np.stack([x, x], 1)
        for k, start in enumerate(np.arange(0, d, step)):
            y = np.roll(x, int(pick.uniform(0, len(x))), axis=0)
            rate = pick.uniform(0.92, 1.08)
            y = np.stack([speed(y[:, c], rate) for c in range(2)], 1)
            if k % 2:
                y = y[:, ::-1]
            y = y[: int(2 * step * SR)] * np.sin(np.linspace(0, np.pi, min(len(y), int(2 * step * SR))))[:, None] ** 2
            where = (int(start * SR) + np.arange(len(y))) % n
            np.add.at(out, where, y * gain)
    # Even it out: gusts come and go, but none jumps out of the yard (round the loop, so the seam stays smooth).
    level = np.sqrt(np.convolve(np.tile((out ** 2).mean(1), 3), np.ones(SR) / SR, 'same')[n:2 * n]) + 1e-6
    out = out * np.clip((np.median(level) / level) ** 0.6, 0.5, 2.0)[:, None]
    return hp(out, 30)


def made_wind(d=46.0):
    """The made wind (3.1.0), no longer heard."""
    n = int(d * SR)
    t = np.arange(n) / SR
    out = np.zeros((n, 2))
    for c in range(2):
        b = noise(d, 'brown')
        gust = 0.55 + 0.25 * np.sin(2 * np.pi * t / 11.3 + c) + 0.2 * np.sin(2 * np.pi * t / 4.7 + 2 * c)
        gust = np.clip(gust + 0.15 * lp(rng.normal(0, 1, n), 0.5, 1) * 30, 0.15, 1.2)
        # The band moves with the gust, so stronger gusts sound higher.
        low = lp(b, 380) * gust
        whistle = bp(noise(d), 600, 1100) * np.clip(gust - 0.85, 0, None) * 0.4
        out[:, c] = low + whistle
    out = hp(out, 40)
    return loop_xfade(out, 4.0)


def a_fire(d=24.0):
    n = int(d * SR)
    out = np.zeros((n, 2))
    roar = lp(noise(d, 'brown'), 300)
    for c in range(2):
        out[:, c] = roar * 0.25
    # Crackles: many small ones and a few pops.
    for _ in range(int(d * 9)):
        p = int(rng.uniform(0, d - 0.05) * SR)
        k = int(rng.uniform(0.001, 0.008) * SR)
        a = rng.pareto(2.5) * 0.15
        burst = hp(rng.normal(0, 1, k), 1500) * np.exp(-np.linspace(0, 5, k)) * a
        pan = rng.uniform(-0.6, 0.6)
        out[p:p + k, 0] += burst * (1 - pan) / 2
        out[p:p + k, 1] += burst * (1 + pan) / 2
    for _ in range(int(d * 0.8)):
        p = int(rng.uniform(0, d - 0.1) * SR)
        x = mix(body_hit(0.3)[: int(0.06 * SR)] * 0.12, hp(noise(0.02), 800) * env(0.02, 0.0002, 0.004) * 0.3)
        out[p:p + len(x)] += x[:, None]
    return loop_xfade(out, 1.0)


def a_crickets(d=30.0):
    n = int(d * SR)
    out = np.zeros((n, 2))
    for k in range(5):
        f = rng.uniform(3900, 5200)
        rate = rng.uniform(1.4, 2.6)          # chirps a second
        pulses = int(rng.integers(2, 5))
        pan = rng.uniform(-0.8, 0.8)
        level = rng.uniform(0.25, 0.6)
        chirp = np.zeros(int(0.12 * SR))
        tt = np.arange(int(0.018 * SR)) / SR
        for p in range(pulses):
            s = int(p * 0.025 * SR)
            chirp[s:s + len(tt)] += np.sin(2 * np.pi * f * tt) * np.sin(np.pi * tt / tt[-1])
        t0 = rng.uniform(0, 1)
        while t0 < d - 0.2:
            s = int(t0 * SR)
            g = level * rng.uniform(0.7, 1)
            out[s:s + len(chirp), 0] += chirp * g * (1 - pan) / 2
            out[s:s + len(chirp), 1] += chirp * g * (1 + pan) / 2
            t0 += 1 / rate * rng.uniform(0.9, 1.1)
            if rng.uniform() < 0.05:
                t0 += rng.uniform(1, 3)    # a pause now and then
    out = verb2(out, 1.2, 0.5)
    return loop_xfade(out, 1.5)


def verb2(x, rt, wet):
    ir = make_ir(rt, seed=9, predelay=0.02)
    y = np.stack([fftconvolve(x[:, c], ir[:, c])[: len(x)] for c in range(2)], 1)
    return x + hp(y, 200) * wet * 0.35


def a_birds(d=40.0):
    n = int(d * SR)
    out = np.zeros((n, 2))
    t0 = rng.uniform(0.5, 2)
    while t0 < d - 2:
        pan = rng.uniform(-0.9, 0.9)
        f = rng.uniform(2200, 3800)
        song = np.zeros(int(1.4 * SR))
        w = 0.0
        for i in range(int(rng.integers(2, 6))):
            dd = rng.uniform(0.05, 0.14)
            f1 = f * rng.uniform(0.8, 1.3)
            note = sweep(f1, f1 * rng.uniform(0.7, 1.4), dd) * np.sin(np.pi * t_(dd) / dd) ** 2
            s = int(w * SR)
            song[s:s + len(note)] += note[: len(song) - s]
            w += dd + rng.uniform(0.03, 0.12)
            if w > 1.2:
                break
        g = rng.uniform(0.08, 0.2)
        s = int(t0 * SR)
        out[s:s + len(song), 0] += song * g * (1 - pan) / 2
        out[s:s + len(song), 1] += song * g * (1 + pan) / 2
        t0 += rng.uniform(2.5, 7)
    out = verb2(lp(out, 6000), 1.8, 0.8)
    return loop_xfade(out, 2.0)


AMB = {'wind': a_wind, 'fire': a_fire, 'crickets': a_crickets, 'birds': a_birds}

if __name__ == '__main__':
    import sys
    gap = 0.08
    parts, index, pos = [], {}, 0.0
    for name, fn in SOUNDS.items():
        x = np.asarray(fn(), dtype=float)
        x = fade_end(x, 0.01)
        index[name] = [round(pos, 4), round(len(x) / SR, 4)]
        parts.append(x)
        parts.append(np.zeros(int(gap * SR)))
        pos += len(x) / SR + gap
        # Keep starts on whole samples.
        pos = sum(len(p) for p in parts) / SR
    # The voices go after the rest, on random numbers of their own, so nothing above changes (3.4.1).
    kept = rng.bit_generator.state
    rng.bit_generator.state = np.random.default_rng(341).bit_generator.state
    for name, fn in VOICES.items():
        x = fade_end(np.asarray(fn(), dtype=float), 0.01)
        index[name] = [round(sum(len(p) for p in parts) / SR, 4), round(len(x) / SR, 4)]
        parts.append(x)
        parts.append(np.zeros(int(gap * SR)))
    # The radio after them, on its own random numbers too (3.11.0).
    rng.bit_generator.state = np.random.default_rng(311).bit_generator.state
    for name, fn in RADIO.items():
        x = fade_end(np.asarray(fn(), dtype=float), 0.01)
        index[name] = [round(sum(len(p) for p in parts) / SR, 4), round(len(x) / SR, 4)]
        parts.append(x)
        parts.append(np.zeros(int(gap * SR)))
    # The elites after them, on their own random numbers (3.12.0).
    rng.bit_generator.state = np.random.default_rng(312).bit_generator.state
    for name, fn in ELITE.items():
        x = fade_end(np.asarray(fn(), dtype=float), 0.01)
        index[name] = [round(sum(len(p) for p in parts) / SR, 4), round(len(x) / SR, 4)]
        parts.append(x)
        parts.append(np.zeros(int(gap * SR)))
    rng.bit_generator.state = np.random.default_rng(313).bit_generator.state
    for name, fn in SCENE.items():
        x = fade_end(np.asarray(fn(), dtype=float), 0.01)
        index[name] = [round(sum(len(p) for p in parts) / SR, 4), round(len(x) / SR, 4)]
        parts.append(x)
        parts.append(np.zeros(int(gap * SR)))
    rng.bit_generator.state = kept
    sprite = np.concatenate(parts)
    write(sprite[:, None], 'out/sfx.ogg', 64)
    write(sprite[:, None], 'out/sfx.wav')
    json.dump(index, open('out/sfx.json', 'w'), indent=1)
    print(len(SOUNDS), 'sounds,', round(len(sprite) / SR, 1), 's')
    if '--amb' in sys.argv:
        levels = {'wind': -27, 'fire': -26, 'crickets': -30, 'birds': -30}
        lengths = {}
        for name, fn in AMB.items():
            x = fn()
            x = master(x, levels[name])
            write(x, f'out/amb-{name}.ogg', 48)
            lengths[name] = round(len(x) / SR, 5)
            print(name, round(len(x) / SR, 1), 's')
        json.dump(lengths, open('out/amb.json', 'w'))
