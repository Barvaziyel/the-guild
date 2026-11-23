"""The road east (Haven): C minor, a detuned music box lullaby over a bowed drone, a heartbeat."""
from engine import *

S = Song(bpm=64, bars=24, seed=47, rt=4.0, tail=9, damp=0.4, predelay=0.04)
box = S.track('music_box', gain=0.7, pan=0.3, reverb=0.7, humanize=0.025, detune=-30)
pad = S.track('pad_5_bowed', gain=0.6, pan=-0.1, reverb=0.6, attack=2.0, lp=2200)
drone = S.track('contrabass', gain=0.6, pan=0.0, reverb=0.4, attack=1.5, lp=900)
choir = S.track('voice_oohs', gain=0.5, pan=-0.3, reverb=0.9, attack=1.8, lp=3000)
cel = S.track('cello', gain=0.6, pan=-0.25, reverb=0.6, attack=0.3, lp=3000)
heart = S.track('taiko_drum', gain=0.7, pan=0.0, reverb=0.2, humanize=0.002, bright=False, lp=400)
trem = S.track('tremolo_strings', gain=0.22, pan=0.4, reverb=0.8, attack=2.0, hp=500)
rev = S.track('reverse_cymbal', gain=0.35, pan=0.0, reverb=0.5, bright=False)
atmo = S.track('fx_4_atmosphere', gain=0.3, pan=0.2, reverb=0.8, attack=2.5, lp=4000)

LULLABY = [
    [('G5', 0, 1), ('Eb5', 1, 1), ('C5', 2, 1), ('Eb5', 3, 1)],
    [('D5', 0, 1.5), ('C5', 1.5, .5), ('B4', 2, 2)],
    [('C5', 0, 1), ('Eb5', 1, 1), ('G5', 2, 1), ('Ab5', 3, 1)],
    [('G5', 0, 3)],
    [('F5', 0, 1), ('Eb5', 1, 1), ('D5', 2, 1), ('C5', 3, 1)],
    [('B4', 0, 1), ('C5', 1, 1), ('D5', 2, 2)],
    [('Eb5', 0, 1), ('D5', 1, 1), ('C5', 2, 1), ('B4', 3, 1)],
    [('C5', 0, 3)],
]
PADS = {'Cm': ['C3', 'Eb3', 'G3'], 'G': ['B2', 'D3', 'G3'], 'Fm': ['C3', 'F3', 'Ab3'],
        'Ab': ['C3', 'Eb3', 'Ab3'], 'Db': ['Db3', 'F3', 'Ab3']}
PROG = (['Cm', 'G', 'Cm', 'Ab', 'Fm', 'G', 'Ab', 'Cm'] +
        ['Cm', 'Db', 'Cm', 'Db', 'Fm', 'Db', 'G', 'G'] +
        ['Cm', 'G', 'Cm', 'Ab', 'Fm', 'G', 'Ab', 'Cm'])

for bar, c in enumerate(PROG):
    b0 = bar * 4
    pad.n(PADS[c], b0, 4.1, 50 if bar < 8 else 58)
    if bar % 2 == 0:
        drone.n('C2' if c != 'Db' else 'Db2', b0, 8.1, 55)
        atmo.n('C4', b0, 8, 40) if bar in (4, 12, 18) else None

# The lullaby: twice through the first part, once (with cello far below) in the last.
for i, ns in enumerate(LULLABY):
    for p, b, d in ns:
        box.n(p, i * 4 + b, d, 70)
        if i >= 4:
            pass
        box.n(p, (16 + i) * 4 + b, d, 64)
        cel.n(midi(p) - 24, (16 + i) * 4 + b, d * 0.95, 58)
# Fragments of it in the middle, slower and lower, as if remembered.
for bar, (p, b, d) in [(9, ('G4', 0, 2)), (9, ('Eb4', 2, 2)), (11, ('D4', 0, 2)), (11, ('B3', 2, 2)),
                       (13, ('F4', 0, 2)), (13, ('Eb4', 2, 2)), (15, ('D4', 0, 4))]:
    box.n(p, bar * 4 + b, d, 52)

# Choir in the middle.
for bar, notes in [(8, ['Eb4', 'G4']), (10, ['Eb4', 'G4']), (12, ['F4', 'Ab4']), (14, ['D4', 'G4'])]:
    choir.n(notes, bar * 4, 7.8, 50)
choir.n(['D4', 'B4'], 15 * 4, 3.8, 46)

# Heartbeat from bar 8 to 21.
for beat in range(8 * 4, 22 * 4):
    v = 60 + 25 * min(1, (beat - 32) / 24)
    heart.n('C2', beat, 0.5, v)
    heart.n('C2', beat + 0.32, 0.5, v * 0.65)

trem.n(['B4', 'C5'], 12 * 4, 15.5, 50)
trem.n(['Gb5', 'G5'], 16 * 4, 12, 40)
# Swells into the sections (a reversed cymbal ends where it would have started).
for bar in (8, 16):
    rev.n('C4', bar * 4 - 1.38 * 64 / 60, 1.45 * 64 / 60, 80)

mix = S.render(loop=True, target_lufs=-19)
print(stats(mix))
write(mix, 'out/haven.ogg', 96)
write(mix, 'out/haven.mp3', 160)
