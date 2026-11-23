"""Night at the Depot: slower, nylon guitar and a warm pad, a low cello line."""
from engine import *

S = Song(bpm=60, bars=24, seed=23, rt=3.2, tail=8)
gtr = S.track('acoustic_guitar_nylon', gain=1.0, pan=-0.2, reverb=0.45, humanize=0.012)
hi = S.track('acoustic_guitar_nylon', gain=0.45, pan=0.4, reverb=0.8, humanize=0.015)
pad = S.track('pad_2_warm', gain=0.5, pan=0.0, reverb=0.6, attack=1.5, lp=2500)
cel = S.track('cello', gain=0.7, pan=0.25, reverb=0.55, attack=0.25, lp=4000)
cb = S.track('contrabass', gain=0.5, pan=0.0, reverb=0.3, attack=0.6, lp=1500)

CH = {
    'Dm9':   ('D2', ['A2', 'F3', 'A3', 'E4'], ['F3', 'A3', 'C4', 'E4']),
    'Bbmaj7':('Bb1', ['F2', 'D3', 'A3', 'D4'], ['D3', 'F3', 'A3', 'D4']),
    'Fmaj7': ('F2', ['C3', 'A3', 'C4', 'E4'], ['A3', 'C4', 'E4']),
    'C/E':   ('E2', ['G2', 'E3', 'G3', 'D4'], ['E3', 'G3', 'D4']),
    'Gm9':   ('G1', ['D3', 'Bb3', 'F4', 'A4'], ['Bb3', 'F4', 'A4']),
    'Asus':  ('A1', ['E3', 'A3', 'D4', 'E4'], ['A3', 'D4', 'E4']),
    'A':     ('A1', ['E3', 'A3', 'Db4', 'E4'], ['A3', 'Db4', 'E4']),
}
PROG = ['Dm9', 'Dm9', 'Bbmaj7', 'Bbmaj7', 'Fmaj7', 'Fmaj7', 'C/E', 'C/E',
        'Dm9', 'Dm9', 'Gm9', 'Gm9', 'Bbmaj7', 'Bbmaj7', 'Asus', 'A',
        'Dm9', 'Dm9', 'Bbmaj7', 'Bbmaj7', 'Gm9', 'Gm9', 'Asus', 'A']

for bar, c in enumerate(PROG):
    b0 = bar * 4
    root, arp, padv = CH[c]
    first = bar == 0 or PROG[bar - 1] != c
    if first:
        cb.n(root, b0, 7.8 if bar + 1 < len(PROG) and PROG[bar + 1] == c else 3.9, 48)
        pad.n(padv, b0, 7.9 if bar + 1 < len(PROG) and PROG[bar + 1] == c else 3.95, 40)
        # Up the chord, letting each note ring.
        gtr.n(arp[0], b0, 3.5, 62)
        gtr.n(arp[1], b0 + 1, 3, 52)
        gtr.n(arp[2], b0 + 2, 2.5, 55)
        gtr.n(arp[3], b0 + 3, 2.5, 58)
    else:
        gtr.n(arp[3], b0, 2, 50)
        gtr.n(arp[2], b0 + 1.5, 2, 46)
        gtr.n(arp[1], b0 + 2.5, 1.5, 44)
        if bar >= 16:
            gtr.n(arp[2], b0 + 3.5, 1, 40)

# Cello line through the middle.
line = [(8, [('A3', 0, 3), ('G3', 3, 1)]), (9, [('F3', 0, 4)]),
        (10, [('Bb3', 0, 3), ('A3', 3, 1)]), (11, [('G3', 0, 2), ('D4', 2, 2)]),
        (12, [('C4', 0, 3), ('Bb3', 3, 1)]), (13, [('A3', 0, 4)]),
        (14, [('G3', 0, 2), ('E3', 2, 2)]), (15, [('E3', 0, 3.5)])]
for bar, ns in line:
    for p, b, d in ns:
        cel.n(p, bar * 4 + b, d, 64)

# High answers in the last part, like stars.
for bar, notes in [(16, ['A5', 'E5']), (18, ['F5', 'D5']), (20, ['D5', 'A4']), (22, ['E5', 'Db5'])]:
    hi.n(notes[0], bar * 4 + 2, 2.5, 46)
    hi.n(notes[1], bar * 4 + 2.75, 2.5, 40)
for bar, notes in [(2, ['A5']), (6, ['G5']), (12, ['D5'])]:
    hi.n(notes[0], bar * 4 + 3, 3, 38)

mix = S.render(loop=True, target_lufs=-19)
print(stats(mix))
write(mix, 'out/night.ogg', 96)
write(mix, 'out/night.mp3', 160)
