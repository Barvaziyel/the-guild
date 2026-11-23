"""The Depot: day theme. D minor, fingerpicked steel guitar, cello, a distant harmonica."""
from engine import *

S = Song(bpm=76, bars=32, seed=11, rt=2.6, tail=7)
gtr = S.track('acoustic_guitar_steel', gain=0.9, pan=-0.15, reverb=0.35, humanize=0.010)
gtr2 = S.track('acoustic_guitar_nylon', gain=0.55, pan=0.35, reverb=0.45, humanize=0.012)
cel = S.track('cello', gain=0.75, pan=0.2, reverb=0.45, attack=0.12, lp=5000)
cbass = S.track('contrabass', gain=0.55, pan=0.0, reverb=0.3, attack=0.25, lp=2500)
harm = S.track('harmonica', gain=0.42, pan=0.45, reverb=0.9, attack=0.06, lp=4500, hp=300)
pad = S.track('string_ensemble_1', gain=0.38, pan=-0.05, reverb=0.7, attack=1.2, lp=3500)

# Bass, alternate bass, three treble notes.
CH = {
    'Dm':    ('D3', 'A2', ['A3', 'D4', 'F4']),
    'Dm/C':  ('C3', 'A2', ['A3', 'D4', 'F4']),
    'Bb':    ('Bb2', 'F3', ['A3', 'D4', 'F4']),    # Bbmaj7
    'C':     ('C3', 'G2', ['G3', 'D4', 'E4']),     # Cadd9
    'F':     ('F2', 'C3', ['A3', 'C4', 'F4']),
    'Gm':    ('G2', 'D3', ['Bb3', 'D4', 'G4']),
    'Asus':  ('A2', 'E3', ['A3', 'D4', 'E4']),
    'A':     ('A2', 'E3', ['A3', 'Db4', 'E4']),
}
ROOT = {'Dm': 'D2', 'Dm/C': 'C2', 'Bb': 'Bb1', 'C': 'C2', 'F': 'F1', 'Gm': 'G1', 'Asus': 'A1', 'A': 'A1'}

def pick(bar, chord, half=None, style='roll', vel=1.0):
    """One bar (or half) of fingerpicking. Beats are eighths: B1 T1 T2 T3 B2 T2 T1 T2."""
    b0 = bar * 4
    bass, alt, (t1, t2, t3) = CH[chord]
    if style == 'roll':
        pat = [(bass, 72), (t1, 52), (t2, 56), (t3, 62), (alt, 64), (t2, 54), (t1, 50), (t2, 55)]
    elif style == 'pinch':
        pat = [((bass, t3), 70), (t1, 50), (t2, 54), (t1, 48), (alt, 62), ((t2, t3), 56), (t1, 48), (t2, 52)]
    else:  # sparse: bass and a chord
        pat = [((bass, t1, t2, t3), 60), None, None, None, (alt, 52), None, (t3, 46), None]
    rng = range(8) if half is None else (range(0, 4) if half == 0 else range(4, 8))
    for i in rng:
        if pat[i] is None:
            continue
        p, v = pat[i]
        p = p if isinstance(p, tuple) else (p,)
        for k, q in enumerate(p):
            # Strummed pinches roll slightly.
            gtr.n(q, b0 + i * 0.5 + k * 0.012, 1.6 if q in (bass, alt) else 1.2, v * vel)

PROG = (['Dm', 'Dm', 'Bb', 'C', 'Dm', 'Dm', 'Gm', ('Asus', 'A')] +
        ['F', 'C', 'Dm', 'Bb', 'F', 'C', 'Gm', 'A'] +
        ['Bb', 'F', 'C', 'Dm', 'Bb', 'F', ('Gm', 'A'), 'Dm'] +
        ['Dm', 'Bb', 'F', 'C', 'Dm', 'Bb', 'Gm', ('Asus', 'A')])

for bar, ch in enumerate(PROG):
    style = 'roll'
    if 16 <= bar < 24:
        style = 'pinch'
    if bar in (0, 28):
        style = 'roll'
    vel = 0.85 if bar < 4 else 1.0
    if bar >= 28:
        vel = 0.85
    if isinstance(ch, tuple):
        pick(bar, ch[0], half=0, style=style, vel=vel)
        pick(bar, ch[1], half=1, style=style, vel=vel)
    else:
        pick(bar, ch, style=style, vel=vel)

# Nylon guitar: high harmonics-like answers, sparse, from bar 4.
for bar, ch in enumerate(PROG):
    if bar < 4 or bar % 2 == 0:
        continue
    c = ch[-1] if isinstance(ch, tuple) else ch
    t = CH[c][2]
    top = midi(t[2]) + 12
    gtr2.n(top, bar * 4 + 3, 2, 42)
    gtr2.n(midi(t[1]) + 12, bar * 4 + 3.5, 2, 36)

# Cello: long bass notes in B, the melody in C, a pedal in D.
for bar in range(8, 16):
    ch = PROG[bar]
    c = ch[-1] if isinstance(ch, tuple) else ch
    cel.n(midi(ROOT[c]) + 12, bar * 4, 3.8, 58)
melody_c = [
    [('D4', 0, 1.5), ('C4', 1.5, .5), ('Bb3', 2, 1), ('A3', 3, 1)],
    [('A3', 0, 2), ('C4', 2, 1), ('F4', 3, 1)],
    [('E4', 0, 1.5), ('D4', 1.5, .5), ('C4', 2, 1), ('G3', 3, 1)],
    [('A3', 0, 3), ('D4', 3, 1)],
    [('F4', 0, 1.5), ('E4', 1.5, .5), ('D4', 2, 1), ('Bb3', 3, 1)],
    [('C4', 0, 2), ('A3', 2, 1), ('C4', 3, 1)],
    [('Bb3', 0, 1), ('D4', 1, 1), ('Db4', 2, 1), ('E4', 3, 1)],
    [('D4', 0, 3.5)],
]
for i, bar_notes in enumerate(melody_c):
    for p, b, d in bar_notes:
        cel.n(p, (16 + i) * 4 + b, d * 0.95, 76 if d >= 1 else 64)
for bar in range(24, 32):
    ch = PROG[bar]
    c = ch[-1] if isinstance(ch, tuple) else ch
    if bar in (24, 25, 26, 27):
        cbass.n(ROOT[c], bar * 4, 3.9, 50)
cel.n('A2', 30 * 4, 7.5, 52)

# Harmonica: calls in B, the rising fifth in D.
harm_b = {
    8: [('C5', 1, 1.4), ('A4', 2.5, .5), ('C5', 3, 1)],
    9: [('D5', 0, 1.4), ('C5', 1.5, .5), ('G4', 2, 1.8)],
    12: [('C5', 0, 1.4), ('A4', 1.5, .5), ('F4', 2, .9), ('G4', 3, .9)],
    13: [('E4', 0, 1.8), ('G4', 2, 1.8)],
    14: [('D4', 0, .9), ('F4', 1, .9), ('G4', 2, .9), ('Bb4', 3, .9)],
    15: [('A4', 0, 3)],
    24: [('D4', 0, .9), ('A4', 1, 2.5)],
    25: [('A4', 0, .5), ('Bb4', .5, .5), ('A4', 1, 1), ('G4', 2, .9), ('F4', 3, .9)],
    26: [('E4', 0, 1.5), ('F4', 1.5, .5), ('C4', 2, 2)],
    27: [('D4', 0, 3)],
}
for bar, ns in harm_b.items():
    for p, b, d in ns:
        harm.n(p, bar * 4 + b, d, 70)

# String pad under C and the second half of A.
for bar in list(range(4, 8)) + list(range(16, 24)):
    ch = PROG[bar]
    c = ch[-1] if isinstance(ch, tuple) else ch
    bass, alt, t = CH[c]
    pad.n([t[0], t[1]], bar * 4, 4.2, 44 if bar < 8 else 52)

mix = S.render(loop=True, target_lufs=-17)
print(stats(mix))
write(mix, 'out/depot.ogg', 96)
write(mix, 'out/depot.mp3', 160)
