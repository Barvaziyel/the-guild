"""Fight: E minor, 112 bpm. Taiko, a string and bass ostinato, horns.

The drums are the first edition's, note for note (Aviel, 16:01: "The original first
edition had drums that to me sounded good if only they were louder and reverberating"),
only now a song of their own in a bigger hall, set louder against the music as a phone
plays them. After three other tries (an ensemble with a sub, synthesized skins, sparse
booms) that he didn't like: keep these sounds; change only how loud and how much hall.

16:26, on that version ("Good"): "there are two kinds of drums now, the constant low one and
the once in a while high one. The low one we can get rid of, and the high one we can make hit
a bit harder". So the taiko groove is gone; the tom fills (and the timpani) stay, harder.
"""
from engine import *

S = Song(bpm=112, bars=40, seed=31, rt=1.9, tail=5, damp=0.45)
# The drums' own hall: longer than the music's, its low end kept out of it so it rings without mud.
D = Song(bpm=112, bars=40, seed=31, rt=3.2, tail=6, damp=0.45, predelay=0.03, verb_hp=250, wet=1.0)
tom = D.track('melodic_tom', gain=0.8, pan=0.2, reverb=0.55, humanize=0.004, bright=False)
timp = D.track('timpani', gain=0.9, pan=-0.1, reverb=0.65, humanize=0.003, bright=False)
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

def fill(bar):
    b0 = bar * 4 + 2
    for i, p in enumerate(['D3', 'C3', 'A2', 'G2', 'F2', 'E2', 'D2', 'C2']):
        tom.n(p, b0 + i * 0.25, 0.5, min(127, 88 + i * 5))

def roll(bar, beats, v0, v1, note='E2'):
    n = int(beats * 6)
    for i in range(n):
        timp.n(note, bar * 4 + (4 - beats) + i / 6, 0.3, v0 + (v1 - v0) * i / n)

for bar, c in enumerate(PROG):
    sec = bar // 8
    if sec in (0, 1, 2, 4):
        ostinato(bar, c)
        if bar % 4 == 3:
            fill(bar)
        if bar % 8 == 0:
            timp.n('E2' if c == 'Em' else ROOT[c], bar * 4, 2, 110)
        trem.n(TREM[c], bar * 4, 3.95, 60 if sec == 0 else 52)
    else:
        # Breakdown: pizzicato only, the drum on one, strings swelling, a roll into the climax.
        ostinato(bar, c, full=bar >= 28)
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

# The drums' and the hall's levels in the version he liked (16:26), measured then (the drums 4 LU over the
# music through a phone, the hall 6 under them) and kept as they were: worked out again from drums that are
# now silent most of the time, they would come out far louder.
DRUMS_GAIN = 19.75
HALL_GAIN = 12.45

meter = pyloudnorm.Meter(SR)
at = lambda x, lufs: x * 10 ** ((lufs - meter.integrated_loudness(x)) / 20)

def phone(x):
    """Roughly what a phone's speaker plays: little below 300 Hz."""
    return lowpass(highpass(x, 300, 4), 8000, 2)

def by_phone(x, lufs):
    return x * 10 ** ((lufs - meter.integrated_loudness(phone(x))) / 20)

music = at(S.render(loop=True, normalize=False), -22)
drums, hall = D.render(loop=True, normalize=False, split=True)
# A phone plays nothing much under 300 Hz, and those lows are most of a taiko's weight: left in, they take all
# the room before the drums get loud where a phone can hear them. So they come down 12 dB, and what a phone
# plays of these drums (all that was heard of them on one) is the same sound, only far louder.
def eq_loop(x):
    # Filtered as a loop (its own end in front), so the seam stays seamless.
    pad = 2 * SR
    y = np.concatenate([x[-pad:], x])
    return (highpass(y, 250, 2) + lowpass(y, 250, 2) * 0.25)[pad:]

drums = eq_loop(drums)
drums = drums * DRUMS_GAIN
hall = hall * HALL_GAIN
# The fills, louder, would have the limiter take 8-10 dB off every hit and pull the music down under them.
# A soft clip on the drums alone takes the spike off each hit instead (about 5 dB), which makes them land harder.
top = 0.4 * np.abs(drums).max()
drums = top * np.tanh(drums / top)
# The clip's own fizz above 11 kHz goes (filtered as a loop, so the seam stays clean).
drums = lowpass(np.concatenate([drums[-SR:], drums]), 11000, 2)[SR:]
mix = music + drums + hall
# Limited as a loop (its own end in front), so the seam doesn't jump where the limiter would start fresh.
pad = 3 * SR
# Its start after its end too, so the limiter sees the hit at the top of the loop coming.
mix = limit(np.concatenate([mix[-pad:], mix, mix[:pad]]), release=0.15)[pad:pad + len(mix)]
for name, x in [('music', music), ('drums', drums), ('hall', hall)]:
    print(f'{name}: full {meter.integrated_loudness(x):.1f} LUFS, through a phone {meter.integrated_loudness(phone(x)):.1f}')
print(stats(mix))
write(mix, 'out/fight.ogg', 96)
write(mix, 'out/fight.mp3', 160)
