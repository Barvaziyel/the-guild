"""The road east (Haven): hopeful. C major, 84 bpm, 32 bars.

Aviel, 2026-11-23: the road to Haven should sound like the road to a
beautiful, safe place; you only find out later what they are. Fingerpicked
guitar and a warm pad set out, a horn sings the tune, strings and a fiddle
lift it, and at the end a music box plays it softly, in tune. The tune is
the same lullaby the truth (truth.py) later plays in minor, out of tune.
"""
from engine import *

S = Song(bpm=84, bars=32, seed=53, rt=2.8, tail=8, damp=0.5)
gtr = S.track('acoustic_guitar_steel', gain=0.85, pan=-0.2, reverb=0.4, humanize=0.009)
harp = S.track('orchestral_harp', gain=0.55, pan=0.35, reverb=0.6, humanize=0.006)
pad = S.track('string_ensemble_1', gain=0.42, pan=0.0, reverb=0.7, attack=1.4, lp=4000)
bass = S.track('acoustic_bass', gain=0.75, pan=0.05, reverb=0.25, humanize=0.006)
horn = S.track('french_horn', gain=0.8, pan=-0.1, reverb=0.6, attack=0.06)
fiddle = S.track('fiddle', gain=0.55, pan=0.25, reverb=0.7, attack=0.08, lp=6000)
strs = S.track('string_ensemble_1', gain=0.6, pan=-0.05, reverb=0.6, attack=0.15)
box = S.track('music_box', gain=0.55, pan=0.3, reverb=0.75, humanize=0.012)
drum = S.track('taiko_drum', gain=0.45, pan=0.0, reverb=0.35, humanize=0.004, bright=False, lp=900)
rev = S.track('reverse_cymbal', gain=0.3, pan=0.0, reverb=0.5, bright=False)

# Bass, alternate bass, three treble notes; a pad voicing.
CH = {
    'C': ('C3', 'G2', ['G3', 'C4', 'E4'], ['E4', 'G4', 'C5']),
    'G/B': ('B2', 'G2', ['G3', 'B3', 'D4'], ['D4', 'G4', 'B4']),
    'G': ('G2', 'D3', ['G3', 'B3', 'D4'], ['D4', 'G4', 'B4']),
    'Gsus': ('G2', 'D3', ['G3', 'C4', 'D4'], ['D4', 'G4', 'C5']),
    'Am': ('A2', 'E3', ['A3', 'C4', 'E4'], ['E4', 'A4', 'C5']),
    'F': ('F2', 'C3', ['A3', 'C4', 'F4'], ['F4', 'A4', 'C5']),
    'Em': ('E2', 'B2', ['G3', 'B3', 'E4'], ['E4', 'G4', 'B4']),
}
ROOT = {'C': 'C2', 'G/B': 'B1', 'G': 'G1', 'Gsus': 'G1', 'Am': 'A1', 'F': 'F1', 'Em': 'E2'}

A = ['C', 'G/B', 'Am', 'F', 'C', 'G', 'F', ('Gsus', 'G')]
B = ['C', 'G', 'C', 'Em', 'F', 'G', ('Am', 'G'), 'C']
C = ['F', 'G', 'Em', 'Am', 'F', 'G', 'C', 'C']
D = ['C', 'G', 'C', 'Em', 'F', 'G', ('Am', 'G'), ('C', 'Gsus')]
PROG = A + B + C + D

def chords(bar):
    ch = PROG[bar]
    return ch if isinstance(ch, tuple) else (ch,)

def pick(bar, ch, half=None, vel=1.0):
    """Fingerpicking in eighths: bass, up the chord, alternate bass, back down."""
    b0 = bar * 4
    bass_, alt, (t1, t2, t3), _ = CH[ch]
    pat = [(bass_, 70), (t1, 50), (t2, 56), (t3, 64), (alt, 62), (t3, 58), (t2, 52), (t1, 50)]
    for i in (range(8) if half is None else range(half * 4, half * 4 + 4)):
        p, v = pat[i]
        gtr.n(p, b0 + i * 0.5, 1.6 if p in (bass_, alt) else 1.3, v * vel)

for bar in range(32):
    cs = chords(bar)
    vel = 0.85 if bar < 4 else 1.0
    for k, ch in enumerate(cs):
        pick(bar, ch, None if len(cs) == 1 else k, vel)
        length = 4 / len(cs)
        start = bar * 4 + k * length
        bass.n(ROOT[ch], start, length * 0.9, 74)
        if bar >= 4:
            pad.n(CH[ch][3], start, length + 0.1, 40 if bar < 16 else 50)
    # A soft walking pulse on the road, from the tune on.
    if 8 <= bar < 24:
        drum.n('C3', bar * 4, 1, 52)
        drum.n('C3', bar * 4 + 2, 1, 40)
        if bar >= 16:
            drum.n('G3', bar * 4 + 3.5, 0.5, 34)
    # Harp shimmer under the strings.
    if 16 <= bar < 24:
        for i, n in enumerate(CH[cs[0]][3] + [midi(CH[cs[0]][3][0]) + 12]):
            harp.n(n, bar * 4 + i * 0.5, 2, 58 - i * 3)

# The tune (the lullaby, in major): the horn sings it in B, the music box plays it softly in D.
TUNE = [
    [('G4', 0, 1), ('E4', 1, 1), ('C4', 2, 1), ('E4', 3, 1)],
    [('D4', 0, 1.5), ('C4', 1.5, .5), ('B3', 2, 2)],
    [('C4', 0, 1), ('E4', 1, 1), ('G4', 2, 1), ('A4', 3, 1)],
    [('G4', 0, 3.5)],
    [('F4', 0, 1), ('E4', 1, 1), ('D4', 2, 1), ('C4', 3, 1)],
    [('B3', 0, 1), ('C4', 1, 1), ('D4', 2, 2)],
    [('E4', 0, 1), ('D4', 1, 1), ('C4', 2, 1), ('B3', 3, 1)],
    [('C4', 0, 3.5)],
]
for i, ns in enumerate(TUNE):
    for p, b, d in ns:
        horn.n(p, (8 + i) * 4 + b, d * 0.95, 84)
        box.n(midi(p) + 12, (24 + i) * 4 + b, d, 60)

# The answer, higher: strings and the fiddle lift it.
LIFT = [
    [('A4', 0, 2), ('C5', 2, 1), ('F5', 3, 1)],
    [('E5', 0, 1.5), ('D5', 1.5, .5), ('B4', 2, 2)],
    [('B4', 0, 1), ('E5', 1, 1), ('G5', 2, 2)],
    [('E5', 0, 3), ('C5', 3, 1)],
    [('F5', 0, 1), ('E5', 1, 1), ('C5', 2, 1), ('A4', 3, 1)],
    [('B4', 0, 1.5), ('C5', 1.5, .5), ('D5', 2, 2)],
    [('C5', 0, 1), ('E5', 1, 1), ('G5', 2, 2)],
    [('E5', 0, 3.5)],
]
for i, ns in enumerate(LIFT):
    for p, b, d in ns:
        fiddle.n(p, (16 + i) * 4 + b, d * 0.95, 80)
        strs.n(midi(p) - 12, (16 + i) * 4 + b, d * 0.95, 70)
# The horn answers underneath.
for bar, p in [(16, 'C4'), (17, 'B3'), (18, 'G3'), (19, 'A3'), (20, 'A3'), (21, 'B3'), (22, 'C4'), (23, 'G3')]:
    horn.n(p, bar * 4, 3.8, 62)

# A swell into the lift.
rev.n('C4', 16 * 4 - 1.38 * 84 / 60, 1.45 * 84 / 60, 80)

mix = S.render(loop=True, target_lufs=-18)
print(stats(mix))
write(mix, 'out/haven.ogg', 96)
write(mix, 'out/haven.mp3', 160)
