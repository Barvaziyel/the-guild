"""An elite's name (4c, 3.16.0): a sting, once, as the name is stamped down in its first sight.

Aviel, 2026-11-28: "it would be cool to have some epic exciting music come on when the elites name is
shown in the cutscene". E minor, the fight music's key, 96 bpm, about eight seconds. Two beats of pickup
(a timpani roll and tremolo strings swelling, a reversed cymbal sucked up into it) land on the hit with
the stamp: brass, trombones, tuba, low strings, choir, timpani and a big taiko, all at once. Then the brass
calls (E, up to C over the sixth, down through D) over taiko, a string run climbs into the second hit,
bigger, and the chord rings out. Played once, not looped: `SoundSystem.sting`.
"""
from engine import *

BPM = 96
# The hit lands this many beats in: the scene starts the sting that much before the stamp.
HIT = 2
S = Song(bpm=BPM, bars=3, seed=97, rt=2.6, tail=3.5, damp=0.45, wet=0.55)
brass = S.track('brass_section', gain=0.95, pan=-0.1, reverb=0.4, attack=0.01, humanize=0.003)
tpt = S.track('trumpet', gain=0.7, pan=0.2, reverb=0.45, attack=0.01, humanize=0.003)
horn = S.track('french_horn', gain=0.9, pan=-0.25, reverb=0.5, attack=0.03, humanize=0.003)
bone = S.track('trombone', gain=0.85, pan=0.15, reverb=0.4, attack=0.01, humanize=0.003)
tuba = S.track('tuba', gain=0.9, pan=0.0, reverb=0.3, attack=0.01)
cb = S.track('contrabass', gain=0.9, pan=0.05, reverb=0.3, release=0.4)
strs = S.track('string_ensemble_1', gain=0.8, pan=0.1, reverb=0.5, attack=0.02, humanize=0.003)
trem = S.track('tremolo_strings', gain=0.75, pan=-0.05, reverb=0.5)
choir = S.track('choir_aahs', gain=0.7, pan=0.0, reverb=0.65, attack=0.08)
timp = S.track('timpani', gain=1.0, pan=-0.1, reverb=0.55, humanize=0.002, bright=False)
taiko = S.track('taiko_drum', gain=1.0, pan=0.05, reverb=0.5, humanize=0.002, bright=False)
tom = S.track('melodic_tom', gain=0.7, pan=0.2, reverb=0.5, humanize=0.002, bright=False)
cym = S.track('reverse_cymbal', gain=0.55, pan=0.0, reverb=0.5, bright=False)

# The pickup: the roll from nothing, the strings swelling, and the reversed cymbal (its swell peaks
# 1.3 s into its sample) timed to peak on the hit.
for i in range(HIT * 8):
    timp.n('E2', i / 8, 0.2, 28 + 92 * (i / (HIT * 8)) ** 1.6)
trem.n(['E3', 'B3', 'E4'], 0, HIT, 60, attack=S.dur(HIT) * 0.9)
cym.n('E4', HIT - 1.297 * BPM / 60, 3, 100)

# Chords: Em on the hit, C, D, then Em again, bigger.
CHORDS = [(HIT, 2, 'E', ['E3', 'G3', 'B3', 'E4', 'G4']), (HIT + 2, 1, 'C', ['C3', 'G3', 'C4', 'E4', 'G4']),
          (HIT + 3, 1, 'D', ['D3', 'A3', 'D4', 'Gb4', 'A4']), (HIT + 4, 3.5, 'E', ['E3', 'B3', 'E4', 'G4', 'B4'])]
for b, d, root, notes in CHORDS:
    last = b == HIT + 4
    v = 124 if last or b == HIT else 108
    brass.n(notes[1:4], b, min(d, 1.5) if not last else d, v)
    bone.n([f'{root}2', midi(f'{root}2') + 7], b, d * 0.95, v)
    tuba.n(f'{root}1' if root != 'D' else 'D2', b, d * 0.95, v - 4)
    cb.n(f'{root}1' if root != 'D' else 'D2', b, d * 0.95, v - 10)
    strs.n(notes, b, d * 0.95, v - 8)
    trem.n(notes[2:], b, d * 0.95, 70 if not last else 84)
    choir.n(notes[2:] + ([midi(notes[-1]) + 5] if last else []), b, d, 96 if last else 84)
    timp.n(f'{root}2', b, 1, 127 if last or b == HIT else 112)

# The brass call over it: E, up through G and B to C over the sixth, down through A and F sharp, home.
CALL = [('E4', 0, 1), ('G4', 1, 0.5), ('B4', 1.5, 0.5), ('C5', 2, 0.75), ('B4', 2.75, 0.25), ('A4', 3, 0.5), ('Gb4', 3.5, 0.5), ('E4', 4, 3.5)]
for p, b, d in CALL:
    tpt.n(p, HIT + b, d * 0.95, 116 if b == 4 else 104)
    horn.n(midi(p) - 12, HIT + b, d * 0.95, 112 if b == 4 else 100)
# Trumpets an octave up on the last note, for the top of it.
tpt.n('E5', HIT + 4, 3.3, 100)

# A string run up into the second hit.
for i, p in enumerate(['D4', 'E4', 'Gb4', 'G4', 'A4', 'B4', 'C5', 'D5']):
    strs.n(p, HIT + 3 + i * 0.125, 0.14, 84 + i * 4)

# The drums under the call, and a roll into the second hit.
for b, v in [(0, 127), (1, 96), (1.5, 88), (2, 116), (3, 108), (3.5, 92), (3.75, 100), (4, 127), (5, 96), (5.5, 84)]:
    taiko.n('C2', HIT + b, 1, v)
for i, p in enumerate(['A2', 'G2', 'E2', 'D2']):
    tom.n(p, HIT + 3.5 + i * 0.125, 0.4, 96 + i * 7)
for i in range(4):
    timp.n('D2', HIT + 3.5 + i / 8, 0.2, 70 + i * 12)

meter = pyloudnorm.Meter(SR)


def phone(x):
    """Roughly what a phone's speaker plays: little below 300 Hz."""
    return lowpass(highpass(x, 300, 4), 8000, 2)


mix = S.render(loop=False, normalize=False)
# Ends once it has rung out (the render's own tail is longer than it needs).
env = np.convolve(np.abs(mix).max(1), np.ones(2205) / 2205, 'same')
end = min(len(mix), int(np.nonzero(env > env.max() * 0.004)[0][-1]) + int(0.3 * SR))
mix = mix[:end]
k = int(0.6 * SR)
mix[-k:] *= np.linspace(1, 0, k)[:, None] ** 2
# Louder than the music it plays over, as a hit should be; limited so the hit lands without clipping.
mix = mix * 10 ** ((-15.5 - meter.integrated_loudness(mix)) / 20)
mix = limit(mix, release=0.2)
print(stats(mix), 'through a phone', round(meter.integrated_loudness(phone(mix)), 1), 'hit at', round(S.t(HIT), 3), 's')
write(mix, 'out/elite.ogg', 96)
write(mix, '/tmp/elite.wav')
