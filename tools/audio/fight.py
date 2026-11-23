"""Fight: E minor, 112 bpm. A taiko ensemble in a big hall, a string and bass ostinato, horns.

The drums are a song of their own (a longer, darker hall, a sub boom under the
big hits, three players on each drum, bus compression), mixed in under the
music. Aviel, 2026-11-23: "make the drums fuller, deeper, more epic".
"""
from engine import *

S = Song(bpm=112, bars=40, seed=31, rt=1.9, tail=5, damp=0.45)
D = Song(bpm=112, bars=40, seed=32, rt=3.9, tail=6.5, damp=0.4, predelay=0.045, verb_hp=40, wet=1.0)
odaiko = D.track('taiko_drum', gain=1.25, pan=0.0, reverb=0.7, humanize=0.003, bright=False)
PLAYERS = [D.track('taiko_drum', gain=0.75, pan=p, reverb=0.6, humanize=0.006, bright=False) for p in (-0.45, 0.0, 0.45)]
high = D.track('taiko_drum', gain=0.5, pan=0.25, reverb=0.6, humanize=0.004, bright=False)
tom = D.track('melodic_tom', gain=0.75, pan=-0.2, reverb=0.75, humanize=0.004, bright=False)
timp = D.track('timpani', gain=1.0, pan=-0.1, reverb=0.8, humanize=0.003, bright=False)
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

def boom(d=1.4, f0=78, f1=46):
    """A sub boom under a big hit: a sine falling in pitch, with a soft thump on top."""
    t = np.arange(int(d * SR)) / SR
    f = f1 + (f0 - f1) * np.exp(-t / 0.11)
    body = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 0.5) * (1 - np.exp(-t / 0.003))
    thump = lowpass(np.random.default_rng(7).normal(0, 1, len(t)), 180, 2) * np.exp(-t / 0.05) * 0.6
    return (body + thump) * 0.55

BOOM = boom()

def skin(f0, d=0.55, slap=1.0, seed=0, dark=False):
    """
    A drum hit a phone can hear (Aviel, 15:35: the drums were "still super quiet";
    the taiko samples have almost nothing above 300 Hz, where a phone speaker
    starts): the skin's modes falling in pitch at the strike, the slap of the
    hand, the click of the stick, a little grit.
    """
    rng = np.random.default_rng(seed)
    t = np.arange(int(d * SR)) / SR
    body = np.zeros_like(t)
    for ratio, amp, tau in [(1.0, 1.0, 0.2), (1.59, 0.6, 0.11), (2.14, 0.4, 0.07), (2.65, 0.25, 0.045), (3.16, 0.15, 0.03)]:
        f = f0 * ratio * (1 + 0.45 * np.exp(-t / 0.025))
        body += amp * np.sin(2 * np.pi * np.cumsum(f) / SR + rng.uniform(0, 6)) * np.exp(-t / tau)
    noise = rng.normal(0, 1, len(t))
    # A dark skin (the low hits) thuds rather than cracks: its slap stays under 1 kHz, its click is faint.
    slap_ = lowpass(highpass(noise, 250 if dark else 350, 2), 1000 if dark else 3000, 2) * np.exp(-t / (0.06 if dark else 0.04)) * 1.6 * slap
    click = lowpass(highpass(noise, 2500, 2), 7000, 2) * np.exp(-t / 0.007) * (0.12 if dark else 0.5) * slap
    x = (body + slap_ + click) * (1 - np.exp(-t / 0.0012))
    x = np.tanh(2.0 * x / np.abs(x).max())
    return lowpass(x, 9000, 2) / np.abs(x).max()

# A few of each, so no two hits are quite the same.
SKINS = {
    # Low and round, for the build and the boom (15:44: "less drums but lower sounding").
    'low': [skin(72, 1.0, 0.75, 40 + k, dark=True) for k in range(4)],
    'boom': [skin(56, 1.6, 0.85, 50 + k, dark=True) for k in range(3)],
    'big': [skin(92, 0.8, 1.0, k) for k in range(4)],
    'mid': [skin(150, 0.55, 0.95, 10 + k) for k in range(4)],
    'high': [skin(230, 0.4, 0.85, 20 + k) for k in range(4)],
    'top': [skin(330, 0.3, 0.7, 30 + k) for k in range(3)],
}
NOTE_SKIN = {'C2': 'big', 'G2': 'mid', 'C3': 'high', 'A2': 'mid', 'E2': 'big', 'D2': 'big', 'A1': 'big', 'G1': 'big'}
PANS = (-0.45, 0.0, 0.45)
_turn = [0]

def slap(kind, beat, v, k=1):
    """One player's skin on top of their drum."""
    _turn[0] += 1
    sounds = SKINS[kind]
    D.sound(sounds[_turn[0] % len(sounds)], beat, gain=(v / 127) ** 1.4, pan=PANS[k % 3], reverb=0.45)

def big(beat, v=118, sub=True):
    """Every drum at once: the big drum, three players, and a boom under it."""
    odaiko.n('G1', beat, 2, v)
    for k, pl in enumerate(PLAYERS):
        pl.n('C2', beat + (k - 1) * 0.012, 1.5, v - 6, detune=(k - 1) * 14)
        slap('big', beat + (k - 1) * 0.012, v - 4, k)
    if sub:
        D.sound(BOOM, beat, gain=v / 127, reverb=0.5)

def hit(beat, v, note='G2', players=(0, 1, 2)):
    for k in players:
        PLAYERS[k].n(note, beat + (k - 1) * 0.01, 1, v - abs(k - 1) * 6, detune=(k - 1) * 12)
        slap(NOTE_SKIN.get(note, 'mid'), beat + (k - 1) * 0.01, v - abs(k - 1) * 6, k)

def ghost(beat, v, k=1):
    PLAYERS[k % 3].n('C3', beat, 0.6, v)
    slap('high', beat, v - 6, k)

def roll(start, beats, v0, v1, note='C3', step=0.25):
    n = int(beats / step)
    for i in range(n):
        hit(start + i * step, v0 + (v1 - v0) * i / max(1, n - 1), note, players=(i % 3,))

def drive(bar, v=46):
    """The high drum on every eighth, pushing it along."""
    for i in range(8):
        high.n('C4' if i % 2 == 0 else 'G3', bar * 4 + i * 0.5, 0.4, v + (12 if i % 2 == 0 else 0))
        slap('top', bar * 4 + i * 0.5, v + 30 + (12 if i % 2 == 0 else 0), i)

def bar_a(bar, lift=0):
    b = bar * 4
    big(b, 118 + lift)
    ghost(b + 0.5, 50, 0)
    hit(b + 1, 72 + lift, 'C3')
    big(b + 1.5, 104 + lift, sub=False)
    hit(b + 2, 96 + lift, 'G2')
    ghost(b + 2.5, 54, 2)
    hit(b + 3, 102 + lift, 'C2')
    hit(b + 3.5, 90 + lift, 'G2')

def bar_b(bar, lift=0):
    b = bar * 4
    big(b, 118 + lift)
    ghost(b + 0.5, 50, 2)
    hit(b + 1, 72 + lift, 'C3')
    big(b + 1.5, 106 + lift, sub=False)
    hit(b + 2, 98 + lift, 'G2')
    roll(b + 3, 1, 62 + lift, 112 + lift)

def fill(bar, lift=0):
    b = bar * 4
    big(b, 120 + lift)
    hit(b + 0.75, 84 + lift, 'G2')
    big(b + 1.5, 112 + lift)
    for i, p in enumerate(['C3', 'A2', 'G2', 'E2', 'D2', 'C2', 'A1', 'G1']):
        tom.n(p, b + 2 + i * 0.25, 0.6, 80 + i * 5 + lift)
        slap(['high', 'high', 'mid', 'mid', 'mid', 'big', 'big', 'big'][i], b + 2 + i * 0.25, 86 + i * 5 + lift, i)
        if i % 2 == 0:
            hit(b + 2 + i * 0.25, 78 + i * 4 + lift, 'G2', players=(i // 2 % 3,))
    timp.n('E2', b + 3.5, 1, 110)

def phrase(first, lift=0, drive_v=None):
    """Four bars: the groove, an answer, the groove, a fill."""
    for i, play in enumerate([bar_a, bar_b, bar_a, fill]):
        play(first + i, lift)
        if drive_v:
            drive(first + i, drive_v)
    timp.n('E2', first * 4, 2, 112)

def roll_t(bar, beats, v0, v1, note='E2'):
    n = int(beats * 6)
    for i in range(n):
        timp.n(note, bar * 4 + (4 - beats) + i / 6, 0.3, v0 + (v1 - v0) * i / n)

def boo(beat, v):
    """One of the build's hits: the big drum and the three players, low, no boom yet."""
    odaiko.n('G1', beat, 2, v)
    for k, pl in enumerate(PLAYERS):
        pl.n('G1', beat + (k - 1) * 0.012, 2, v - 8, detune=(k - 1) * 14)
        slap('low', beat + (k - 1) * 0.012, v - 4, k)

def booom(beat, v=127):
    """The hit it was all building to: every drum, the boom under it, the timpani, and then nothing but the hall."""
    odaiko.n('C1', beat, 3, v)
    for k, pl in enumerate(PLAYERS):
        pl.n('C1', beat + (k - 1) * 0.015, 3, v - 4, detune=(k - 1) * 16)
        slap('boom', beat + (k - 1) * 0.015, v, k)
    D.sound(BOOM, beat, gain=0.45, reverb=0.6)
    timp.n('E2', beat, 3, 120)

def build(bar, hits=(0, 1, 2, 3), v0=78, v1=116):
    """Boo, boo, boo, boo: getting louder, into the boom at the next bar."""
    for i, b in enumerate(hits):
        boo(bar * 4 + b, v0 + (v1 - v0) * i / max(1, len(hits) - 1))

# Aviel, 15:44: "less drums but lower sounding... no drums no drums, boo boo boo boo booom,
# epic style but make the drums worth it, savor them". So the drums only come in to build to
# a boom at the top of each part, and then leave the hall ringing.
for top in (8, 16, 24, 32):
    booom(top * 4)
build(7)
build(15)
build(23, hits=(0, 1, 2, 2.5, 3, 3.5), v0=74, v1=118)
# Into the climax, the longest build: slow, then quicker.
build(30, hits=(0, 2), v0=70, v1=82)
build(31, hits=(0, 1, 2, 2.5, 3, 3.25, 3.5, 3.75), v0=86, v1=124)
roll_t(31, 2, 50, 118, 'B1')
# The climax lands a second boom halfway; the last bars build back into the top of the loop.
booom(36 * 4, 120)
build(39, hits=(0, 1, 2, 3, 3.5), v0=84, v1=122)
booom(0)

for bar, c in enumerate(PROG):
    sec = bar // 8
    if sec in (0, 1, 2, 4):
        ostinato(bar, c)
        trem.n(TREM[c], bar * 4, 3.95, 60 if sec == 0 else 52)
    else:
        # Breakdown: pizzicato only, strings swelling into the climax.
        ostinato(bar, c, full=bar >= 28)
        trem.n(TREM[c], bar * 4, 3.95, 50 + (bar - 24) * 5, attack=1.5)

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

def punch(loop):
    """
    The drums close up (Aviel: "like they are in another hall next door... triple
    or quadruple the strength"): weight between 55 and 140 Hz, fast compression
    so every hit lands as hard, the stick on the skin brought forward, a little
    saturation. Run on the loop with its own end in front, so the seam stays seamless.
    """
    pad = 3 * SR
    x = np.concatenate([loop[-pad:], loop])
    attack = highpass(x, 1200, 2)
    body = x + (lowpass(x, 140, 2) - lowpass(x, 55, 2)) * 0.4
    env = np.sqrt(np.maximum(lowpass(np.mean(body ** 2, 1), 40, 1), 1e-12))
    thr = np.percentile(env, 75)
    comp = body * np.where(env > thr, (thr / env) ** (1 - 1 / 4), 1.0)[:, None]
    comp *= np.sqrt(np.mean(body ** 2) / np.mean(comp ** 2))
    x = 0.4 * body + 0.7 * comp + attack * 0.9
    # The low end's overtones, so a phone, which can't play the boom itself, still hears how low it is:
    # drive what's under 150 Hz hard and keep only the harmonics that come out above 250 Hz.
    low = lowpass(x, 150, 4)
    overtones = highpass(np.tanh(6 * low / np.abs(low).max()), 250, 4)
    x = x + overtones * np.abs(x).max() * 0.6
    peak = np.abs(x).max()
    # Driven hard into a soft clip, as big film drums are: the hits keep their weight but lose their spikes.
    x = np.tanh(3.0 * x / peak) / np.tanh(3.0) * peak
    return x[pad:]

DRUMS_OVER = 9  # dB over the music at each boom, through a phone speaker
BOOMS = [b * 4 for b in (0, 8, 16, 24, 32, 36)]
meter = pyloudnorm.Meter(SR)
music = S.render(loop=True, normalize=False)
drums, hall = D.render(loop=True, normalize=False, split=True)
drums = punch(drums)
at = lambda x, lufs: x * 10 ** ((lufs - meter.integrated_loudness(x)) / 20)

def phone(x):
    """Roughly what a phone's speaker plays: little below 300 Hz."""
    return lowpass(highpass(x, 300, 4), 8000, 2)

music = at(music, -22)  # where the music sits in the end: about where the other pieces sit

def at_booms(x):
    """How loud something is through a phone in the first 150 ms of each boom."""
    y = phone(x).mean(1)
    spb = 60 / 112
    return 20 * np.log10(np.sqrt(np.mean([np.mean(y[int(b * spb * SR):int(b * spb * SR) + int(0.15 * SR)] ** 2) for b in BOOMS])))

# Each boom stands well over the music through a phone, with its hall ringing on after it.
drums = drums * 10 ** ((at_booms(music) + DRUMS_OVER - at_booms(drums)) / 20)
hall = hall * 10 ** ((at_booms(drums) - 9 - at_booms(hall)) / 20)
# No loudness normalizing after this: the booms would pull the music down under them.
mix = music + drums + hall
# Limited as a loop (its own end in front), so the seam doesn't jump where the limiter would start fresh.
pad = 3 * SR
mix = limit(np.concatenate([mix[-pad:], mix]), release=0.25)[pad:]
for name, x in [('music', music), ('drums', drums), ('hall', hall)]:
    print(f'{name}: full {meter.integrated_loudness(x):.1f} LUFS, through a phone {meter.integrated_loudness(phone(x)):.1f}')
print(stats(mix))
write(mix, 'out/fight.ogg', 96)
write(mix, 'out/fight.mp3', 160)
