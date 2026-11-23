"""Fight: E minor, 112 bpm. Taiko, a string and bass ostinato, horns."""
from engine import *

S = Song(bpm=112, bars=40, seed=31, rt=1.9, tail=5, damp=0.45)
taiko = S.track('taiko_drum', gain=1.0, pan=0.0, reverb=0.25, humanize=0.004, bright=False)
tom = S.track('melodic_tom', gain=0.8, pan=0.2, reverb=0.25, humanize=0.004, bright=False)
timp = S.track('timpani', gain=0.9, pan=-0.1, reverb=0.35, humanize=0.003, bright=False)
pizz = S.track('pizzicato_strings', gain=1.1, pan=-0.25, reverb=0.25, humanize=0.004)
cb = S.track('contrabass', gain=0.9, pan=0.1, reverb=0.2, humanize=0.004, release=0.08, lp=3000)
mute = S.track('acoustic_guitar_steel', gain=0.55, pan=0.3, reverb=0.15, humanize=0.004, release=0.05, lp=1800)
trem = S.track('tremolo_strings', gain=0.55, pan=0.0, reverb=0.45, attack=0.4)
horn = S.track('french_horn', gain=0.85, pan=-0.2, reverb=0.45, attack=0.04)
horn2 = S.track('french_horn', gain=0.55, pan=0.3, reverb=0.5, attack=0.05)
strs = S.track('string_ensemble_1', gain=0.75, pan=0.15, reverb=0.45, attack=0.08)

ROOT = {'Em': 'E2', 'C': 'C2', 'D': 'D2', 'Am': 'A1', 'B': 'B1'}
FIFTH = {'Em': 7, 'C': 7, 'D': 7, 'Am': 7, 'B': 7}
TREM = {'Em': ['E4', 'G4', 'B4'], 'C': ['E4', 'G4', 'C5'], 'D': ['D4', 'Gb4', 'A4'],
        'Am': ['E4', 'A4', 'C5'], 'B': ['Eb4', 'Gb4', 'B4']}
MAIN = ['Em', 'Em', 'C', 'D', 'Em', 'Em', 'Am', 'B']
BREAK = ['C', 'C', 'Am', 'Am', 'C', 'D', 'B', 'B']
PROG = MAIN + MAIN + MAIN + BREAK + MAIN

def ostinato(bar, c, full=True):
    r = midi(ROOT[c])
    pat = [0, 0, 12, 0, 0, 12, FIFTH[c], 0]
    acc = [100, 70, 85, 70, 95, 75, 85, 70]
    for i, off in enumerate(pat):
        b = bar * 4 + i * 0.5
        pizz.n(r + off + 12, b, 0.4, acc[i])
        if full:
            cb.n(r + off, b, 0.35, acc[i] - 5)
            mute.n(r + off + 12, b, 0.2, acc[i] - 20)

def groove(bar, big=True):
    b0 = bar * 4
    hits = [(0, 'C2', 115), (0.75, 'C3', 55), (1, 'G2', 80), (1.5, 'C2', 90), (2, 'C2', 110),
            (2.75, 'C3', 55), (3, 'G2', 85), (3.5, 'C3', 70)]
    if not big:
        hits = [(0, 'C2', 100), (2, 'G2', 70)]
    for b, p, v in hits:
        taiko.n(p, b0 + b, 1, v)

def fill(bar):
    b0 = bar * 4 + 2
    for i, p in enumerate(['D3', 'C3', 'A2', 'G2', 'F2', 'E2', 'D2', 'C2']):
        tom.n(p, b0 + i * 0.25, 0.5, 70 + i * 5)

def roll(bar, beats, v0, v1, note='E2'):
    n = int(beats * 6)
    for i in range(n):
        timp.n(note, bar * 4 + (4 - beats) + i / 6, 0.3, v0 + (v1 - v0) * i / n)

for bar, c in enumerate(PROG):
    sec = bar // 8
    if sec in (0, 1, 2, 4):
        ostinato(bar, c)
        groove(bar)
        if bar % 4 == 3:
            fill(bar)
        if bar % 8 == 0:
            timp.n('E2' if c == 'Em' else ROOT[c], bar * 4, 2, 110)
        trem.n(TREM[c], bar * 4, 3.95, 60 if sec == 0 else 52)
    else:
        # Breakdown: pizzicato only, the drum on one, strings swelling, a roll into the climax.
        ostinato(bar, c, full=bar >= 28)
        groove(bar, big=False)
        trem.n(TREM[c], bar * 4, 3.95, 50 + (bar - 24) * 5, attack=1.5)
        if bar == 31:
            roll(bar, 4, 40, 120, 'B1')
            tom.n('C2', bar * 4 + 3.5, 0.5, 120)

MEL = [
    [('E3', 0, 1), ('G3', 1, .5), ('B3', 1.5, 2.5)],
    [('A3', 0, 1), ('G3', 1, 1), ('Gb3', 2, 1), ('G3', 3, 1)],
    [('E3', 0, 1.5), ('G3', 1.5, .5), ('C4', 2, 2)],
    [('B3', 0, 1), ('A3', 1, 1), ('D4', 2, 2)],
    [('E4', 0, 2), ('D4', 2, 1), ('B3', 3, 1)],
    [('G3', 0, 1), ('A3', 1, 1), ('B3', 2, 2)],
    [('C4', 0, 1.5), ('B3', 1.5, .5), ('A3', 2, 1), ('E3', 3, 1)],
    [('Gb3', 0, 1), ('B3', 1, 1), ('Eb4', 2, 2)],
]
for i, ns in enumerate(MEL):
    for p, b, d in ns:
        horn.n(p, (8 + i) * 4 + b, d * 0.95, 92)                 # B: horns
        strs.n(midi(p) + 12, (16 + i) * 4 + b, d * 0.95, 90)     # C: strings, an octave up
        strs.n(midi(p), (16 + i) * 4 + b, d * 0.95, 70)
        horn.n(p, (32 + i) * 4 + b, d * 0.95, 100)               # E: both
        strs.n(midi(p) + 12, (32 + i) * 4 + b, d * 0.95, 95)
# Low horns hold the roots under C and E.
for bar in list(range(16, 24)) + list(range(32, 40)):
    c = PROG[bar]
    horn2.n(midi(ROOT[c]) + 12, bar * 4, 3.8, 75)

mix = S.render(loop=True, target_lufs=-16)
print(stats(mix))
write(mix, 'out/fight.ogg', 96)
write(mix, 'out/fight.mp3', 160)
