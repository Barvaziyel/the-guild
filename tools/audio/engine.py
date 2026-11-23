"""A small sampler and mixer for rendering The Guild's music offline.

Samples: FluidR3_GM (CC BY 3.0), decoded by decode.py into samples/<inst>.npz,
one 3.14 s stereo recording per note A0..C8, held notes with no release.
"""
import numpy as np, subprocess, os
from scipy.signal import fftconvolve, butter, sosfilt, lfilter
import pyloudnorm

SR = 44100
HERE = os.path.dirname(os.path.abspath(__file__))
PCS = {'C': 0, 'Db': 1, 'D': 2, 'Eb': 3, 'E': 4, 'F': 5, 'Gb': 6, 'G': 7, 'Ab': 8, 'A': 9, 'Bb': 10, 'B': 11}
ALIAS = {'C#': 'Db', 'D#': 'Eb', 'F#': 'Gb', 'G#': 'Ab', 'A#': 'Bb'}


def midi(n):
    if isinstance(n, (int, np.integer)):
        return int(n)
    name, octv = (n[:2], n[2:]) if len(n) > 2 and n[1] in 'b#' else (n[:1], n[1:])
    name = ALIAS.get(name, name)
    return 12 * (int(octv) + 1) + PCS[name]


def note_name(m):
    names = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B']
    return f'{names[m % 12]}{m // 12 - 1}'


_cache = {}


def bank(inst):
    if inst not in _cache:
        z = np.load(f'{HERE}/samples/{inst}.npz')
        _cache[inst] = {midi(k): z[k].astype(np.float64) for k in z.files}
    return _cache[inst]


# How each instrument behaves: sustained (loop the middle for long notes) or plucked,
# the release after the note ends, a default gain, and the trimmed onset.
INST = {
    'acoustic_guitar_steel': dict(kind='pluck', release=0.5, gain=1.0),
    'acoustic_guitar_nylon': dict(kind='pluck', release=0.5, gain=1.1),
    'orchestral_harp': dict(kind='pluck', release=0.8, gain=1.0),
    'music_box': dict(kind='pluck', release=1.0, gain=0.9),
    'acoustic_grand_piano': dict(kind='pluck', release=0.6, gain=0.9),
    'pizzicato_strings': dict(kind='pluck', release=0.3, gain=1.2),
    'acoustic_bass': dict(kind='pluck', release=0.3, gain=1.0),
    'taiko_drum': dict(kind='pluck', release=1.5, gain=1.0),
    'melodic_tom': dict(kind='pluck', release=1.0, gain=1.0),
    'timpani': dict(kind='pluck', release=1.5, gain=1.0),
    'synth_drum': dict(kind='pluck', release=0.6, gain=1.0),
    'woodblock': dict(kind='pluck', release=0.3, gain=1.0),
    'reverse_cymbal': dict(kind='pluck', release=0.2, gain=1.0),
    'gunshot': dict(kind='pluck', release=0.5, gain=1.0),
    'cello': dict(kind='held', release=0.7, gain=1.4),
    'contrabass': dict(kind='held', release=0.6, gain=1.4),
    'string_ensemble_1': dict(kind='held', release=1.0, gain=1.4),
    'tremolo_strings': dict(kind='held', release=0.8, gain=1.4),
    'pad_2_warm': dict(kind='held', release=1.5, gain=1.3),
    'pad_5_bowed': dict(kind='held', release=1.5, gain=1.3),
    'choir_aahs': dict(kind='held', release=1.2, gain=1.4),
    'voice_oohs': dict(kind='held', release=1.2, gain=1.4),
    'french_horn': dict(kind='held', release=0.6, gain=1.0),
    'harmonica': dict(kind='held', release=0.35, gain=1.2),
    'fiddle': dict(kind='held', release=0.5, gain=1.2),
    'fx_4_atmosphere': dict(kind='held', release=2.0, gain=1.2),
}


def raw(inst, m):
    b = bank(inst)
    if m in b:
        return b[m]
    # Outside the bank: resample the nearest note.
    near = min(b, key=lambda k: abs(k - m))
    return repitch(b[near], 2 ** ((m - near) / 12))


def repitch(a, ratio):
    n = int(len(a) / ratio)
    x = np.arange(n) * ratio
    return np.stack([np.interp(x, np.arange(len(a)), a[:, c]) for c in range(2)], 1)


def extend(a, n):
    """Lengthen a held sample to n samples by crossfading its middle into itself."""
    if n <= len(a) - SR // 20:
        return a[:n]
    lo, hi, fade = int(0.9 * SR), int(3.0 * SR), int(0.35 * SR)
    seg = a[lo:hi]
    out = a[:hi].copy()
    t = np.linspace(0, np.pi / 2, fade)[:, None]
    fin, fout = np.sin(t), np.cos(t)
    rng = np.random.default_rng(len(a) + n)
    while len(out) < n:
        # Start each repeat at a slightly different place so the loop doesn't pulse.
        off = int(rng.integers(0, SR // 3))
        piece = a[lo + off:hi]
        joined = out[-fade:] * fout + piece[:fade] * fin
        out = np.concatenate([out[:-fade], joined, piece[fade:]])
    return out[:n]


def lowpass(a, hz, order=1):
    sos = butter(order, min(hz, SR / 2 - 100), 'low', fs=SR, output='sos')
    return sosfilt(sos, a, axis=0)


def highpass(a, hz, order=2):
    sos = butter(order, hz, 'high', fs=SR, output='sos')
    return sosfilt(sos, a, axis=0)


def pan_gains(p):
    ang = (p + 1) * np.pi / 4
    return np.array([np.cos(ang), np.sin(ang)]) * np.sqrt(2)


class Track:
    def __init__(self, song, inst, gain=1.0, pan=0.0, reverb=0.3, lp=None, hp=None,
                 humanize=0.008, detune=0.0, release=None, attack=0.0, bright=True):
        self.song, self.inst = song, inst
        self.spec = INST[inst]
        self.gain, self.pan, self.reverb = gain * self.spec['gain'], pan, reverb
        self.lp, self.hp, self.humanize, self.detune = lp, hp, humanize, detune
        self.release = release if release is not None else self.spec['release']
        self.attack, self.bright = attack, bright
        self.notes = []

    def n(self, pitch, beat, dur, vel=80, **kw):
        """A note: pitch name or midi, start beat (from 0), length in beats, velocity 1..127."""
        if isinstance(pitch, (list, tuple)):
            for p in pitch:
                self.n(p, beat, dur, vel, **kw)
            return self
        self.notes.append((midi(pitch), beat, dur, vel, kw))
        return self

    def render(self, total):
        out = np.zeros((total, 2))
        rng = self.song.rng
        for m, beat, dur, vel, kw in self.notes:
            t0 = self.song.t(beat) + (rng.normal(0, self.humanize) if self.humanize else 0)
            start = max(0, int(t0 * SR))
            secs = self.song.dur(dur)
            rel = kw.get('release', self.release)
            v = np.clip(vel + (rng.normal(0, 4) if self.humanize else 0), 1, 127) / 127
            a = raw(self.inst, m)
            det = kw.get('detune', self.detune)
            if det:
                a = repitch(a, 2 ** (det / 1200))
            body = int(secs * SR)
            need = body + int(rel * SR)
            if self.spec['kind'] == 'held':
                s = extend(a, need)
            else:
                s = a[:need]
            s = s.copy()
            atk = kw.get('attack', self.attack)
            if atk:
                k = min(len(s), int(atk * SR))
                s[:k] *= np.linspace(0, 1, k)[:, None] ** 1.5
            # Release: fade from the note's end.
            if len(s) > body:
                k = len(s) - body
                s[body:] *= np.exp(-np.linspace(0, 6, k))[:, None]
            # Never end on a cut.
            k = min(len(s), 256)
            s[-k:] *= np.linspace(1, 0, k)[:, None]
            if self.bright:
                s = lowpass(s, 900 + 9000 * v ** 2)
            s *= v ** 1.6 * kw.get('gain', 1.0)
            p = kw.get('pan', self.pan)
            s *= pan_gains(p)
            end = min(total, start + len(s))
            out[start:end] += s[:end - start]
        if self.hp:
            out = highpass(out, self.hp)
        if self.lp:
            out = lowpass(out, self.lp, 2)
        return out * self.gain


def make_ir(rt, seed=1, predelay=0.02, damp=0.5, width=1.0):
    rng = np.random.default_rng(seed)
    n = int(rt * 1.3 * SR)
    t = np.arange(n) / SR
    ir = np.zeros((n, 2))
    for c in range(2):
        noise = rng.normal(0, 1, n)
        lowb = lowpass(noise, 500, 2)
        midb = lowpass(noise, 4000, 2) - lowb
        highb = noise - lowb - midb
        ir[:, c] = (lowb * np.exp(-6.9 * t / (rt * 1.15)) + midb * np.exp(-6.9 * t / rt)
                    + highb * np.exp(-6.9 * t / (rt * damp)))
    m = ir.mean(1, keepdims=True)
    ir = m + (ir - m) * width
    ir[: int(0.004 * SR)] *= np.linspace(0, 1, int(0.004 * SR))[:, None]
    ir = np.concatenate([np.zeros((int(predelay * SR), 2)), ir])
    return ir / np.sqrt((ir ** 2).sum() / 2)


class Song:
    def __init__(self, bpm, bars, beats_per_bar=4, seed=7, rt=2.4, tail=7.0, predelay=0.025, damp=0.5, verb_hp=120):
        self.bpm, self.bars, self.bpb = bpm, bars, beats_per_bar
        self.rng = np.random.default_rng(seed)
        self.tracks = []
        self.raws = []
        self.verb_hp = verb_hp
        self.rt, self.tail, self.predelay, self.damp = rt, tail, predelay, damp
        self.tempo_map = None  # optional function beat -> seconds

    def t(self, beat):
        return self.tempo_map(beat) if self.tempo_map else beat * 60 / self.bpm

    def dur(self, beats):
        return beats * 60 / self.bpm

    @property
    def beats(self):
        return self.bars * self.bpb

    @property
    def length(self):
        return self.t(self.beats)

    def track(self, inst, **kw):
        tr = Track(self, inst, **kw)
        self.tracks.append(tr)
        return tr

    def sound(self, sig, beat, gain=1.0, pan=0.0, reverb=0.3):
        """A synthesized sound (mono array) placed at a beat, like a note."""
        self.raws.append((sig, beat, gain, pan, reverb))

    def render(self, loop=True, target_lufs=-18.0, stems=False, normalize=True):
        L = int(round(self.length * SR))
        total = L + int(self.tail * SR)
        dry = np.zeros((total, 2))
        wet = np.zeros((total, 2))
        parts = {}
        for tr in self.tracks:
            a = tr.render(total)
            parts[tr.inst + str(id(tr))] = a
            dry += a
            wet += a * tr.reverb
        for sig, beat, gain, pan, rev in self.raws:
            start = max(0, int(self.t(beat) * SR))
            end = min(total, start + len(sig))
            st = sig[: end - start, None] * pan_gains(pan) * gain
            dry[start:end] += st
            wet[start:end] += st * rev
        ir = make_ir(self.rt, predelay=self.predelay, damp=self.damp)
        verb = np.stack([fftconvolve(wet[:, c], ir[:, c])[:total] for c in range(2)], 1)
        verb = highpass(verb, self.verb_hp)
        mix = dry + verb * 0.5
        mix = highpass(mix, 28, 2)
        if loop:
            tail = mix[L:]
            mix = mix[:L].copy()
            k = min(len(tail), L)
            mix[:k] += tail[:k]
        else:
            # Let it ring out, then fade the last bit.
            k = int(0.5 * SR)
            mix[-k:] *= np.linspace(1, 0, k)[:, None]
        return master(mix, target_lufs) if normalize else mix


def master(mix, target_lufs=-18.0, ceiling=0.89):
    meter = pyloudnorm.Meter(SR)
    lufs = meter.integrated_loudness(mix)
    mix = mix * 10 ** ((target_lufs - lufs) / 20)
    # Soft knee: only the loudest peaks are touched.
    peak = np.abs(mix).max()
    if peak > ceiling:
        thr = ceiling * 0.8
        over = np.abs(mix) > thr
        mix[over] = np.sign(mix[over]) * (thr + (ceiling - thr) * np.tanh((np.abs(mix[over]) - thr) / (ceiling - thr)))
    return mix


def stats(mix):
    meter = pyloudnorm.Meter(SR)
    return dict(seconds=round(len(mix) / SR, 2), lufs=round(meter.integrated_loudness(mix), 1),
                peak_db=round(20 * np.log10(np.abs(mix).max()), 1))


def write(mix, path, kbps=96):
    """Write Ogg Opus (and a wav next to it for checking)."""
    pcm = (np.clip(mix, -1, 1) * 32767).astype('<i2').tobytes()
    ch = mix.shape[1] if mix.ndim > 1 else 1
    args = ['ffmpeg', '-v', 'error', '-y', '-f', 's16le', '-ar', str(SR), '-ac', str(ch), '-i', 'pipe:0']
    if path.endswith('.ogg') or path.endswith('.opus'):
        args += ['-c:a', 'libopus', '-b:a', f'{kbps}k', '-vbr', 'on', '-application', 'audio', path]
    elif path.endswith('.mp3'):
        args += ['-c:a', 'libmp3lame', '-b:a', f'{kbps}k', path]
    else:
        args += [path]
    subprocess.run(args, input=pcm, check=True)
