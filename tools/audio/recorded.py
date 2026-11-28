"""Real recordings (3.13.1): the elites' calls (the Red Hand's whistle, the Matron's claps, Old Mother's howl),
and since 3.15.0 the scenes' sounds, the splashes and the plate, and the wind (EFFECTS).

    python3 tools/audio/recorded.py <folder with the recordings> [names...]

With names, only those are written (the rest keep their files, so nothing else changes).

The whistle and the claps were recorded for the game by Aviel (2026-11-28, a phone's
voice memos); the howl is "Wolf Howl 2" by Dragon Studio on Pixabay (free to use and
change, no credit needed; credited in the README all the same). They aren't kept in the
repo: only what this writes, the cut and shaped sounds, dry. `sfx.py` puts each one in
its room and sets its loudness. It writes voices/calls/<name>.ogg, mono.

Then `python3 tools/audio/build.py sfx`. Needs numpy, scipy and ffmpeg.
"""
import glob, os, subprocess, sys
import numpy as np
from scipy.signal import butter, resample_poly, sosfilt

SR = 44100
HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, 'voices', 'calls')

# Each sound: the recording, where in it (seconds), how much faster to play it (higher too, or slower and
# lower), as a fraction up/down for resampling, and how long to fade it out.
CALLS = {
    # A mouth whistle around 1.2-1.65 kHz, four seconds of it: played 7/4 as fast it's a shrill signal
    # whistle, up and a fall, in about a second and a half.
    'whistle': ('whistle', 0.70, 3.50, (4, 7), 0.25),
    # Two flat-palmed claps a third of a second apart.
    'claps': ('claps', 1.20, 1.95, (1, 1), 0.10),
    # A wolf's howl, up, held and falling: a little slower and lower for a hound the size of Old Mother.
    'howl': ('howl', 1.00, 3.75, (25, 22), 0.55),
}

# Sounds for the scenes and the stage (3.15.0), from free sounds on Pixabay that Aviel picked (2026-11-28; see the
# README for whose). Each: the file (a part of its name), where in it, the resampling, fade in and out, the lowest
# frequency kept, and whether it's kept in stereo (the wind, for the ambience). Written to recorded/, not gated:
# what's under a footstep or a splash is part of it.
EFFECTS = {
    # Two takes of one person walking on gravel: sfx.py layers them into a group.
    'gravel_1': ('footsteps-on-gravel-1', 0.0, 4.72, (1, 1), 0.01, 0.15, 30, False),
    'gravel_2': ('footsteps-on-gravel-2', 0.0, 4.15, (1, 1), 0.01, 0.15, 30, False),
    # Running on gravel: a stretch of a long take.
    'running': ('running-on-gravel', 20.0, 23.2, (1, 1), 0.3, 0.3, 30, False),
    # A heavy iron gate swinging open on its hinges (its slam shut is left out).
    'gate': ('gate-heavy', 0.05, 5.5, (1, 1), 0.02, 0.6, 30, False),
    # A match struck and burning: the third of four strikes, which flares longest.
    'match': ('match-strike', 10.45, 13.4, (1, 1), 0.005, 0.5, 60, False),
    # Screams, a woman's and a man's.
    'scream_f': ('girl-scream', 0.0, 1.36, (1, 1), 0.01, 0.25, 90, False),
    'scream_m': ('man-pain-scream', 0.0, 2.05, (1, 1), 0.01, 0.3, 90, False),
    # A boulder hitting the ground.
    'thud': ('boulder-thud', 0.25, 1.6, (1, 1), 0.002, 0.4, 20, False),
    # A rifle shot and its echo.
    'shot': ('gun-shot-and-echo', 0.0, 5.0, (1, 1), 0.001, 1.2, 30, False),
    # An old car coming up the road, braking and idling.
    'pull_up': ('car-pulling-up', 2.0, 10.8, (1, 1), 0.5, 0.8, 30, False),
    # Something heavy going into water; something coming up out of it.
    'splash_in': ('water-splash-02', 0.05, 2.4, (1, 1), 0.005, 0.6, 40, False),
    'splash_up': ('water-splash-199583', 0.1, 1.9, (1, 1), 0.02, 0.5, 40, False),
    # Metal cracking: a plate knocked off.
    'metal': ('metal-crack', 0.0, 1.07, (1, 1), 0.001, 0.25, 60, False),
    # A fire crackling: the first fire in the opening (the yard's everyday fire stays the made one: Aviel liked it).
    'campfire': ('fire-crackling', 0.0, 15.5, (1, 1), 0.05, 2.0, 60, False),
    # Wind: a hard one across open ground for the scenes, a soft one for the yard's ambience.
    'gale': ('harsh-wind', 0.6, 12.9, (1, 1), 1.2, 1.5, 30, False),
    'breeze': ('soft-wind', 0.0, 8.0, (1, 1), 0.05, 0.05, 25, True),
}
EFFECTS_OUT = os.path.join(HERE, 'recorded')



def sos(kind, hz, order):
    return butter(order, hz, kind, fs=SR, output='sos')


def read(folder, name):
    paths = [p for p in glob.glob(os.path.join(folder, '*')) if os.path.splitext(os.path.basename(p))[0].split('-', 1)[-1].startswith(name)]
    paths = paths or glob.glob(os.path.join(folder, f'*{name}*'))
    if not paths:
        sys.exit(f'no recording named {name} in {folder}')
    pcm = subprocess.run(['ffmpeg', '-v', 'quiet', '-i', paths[0], '-f', 'f32le', '-ac', '1', '-ar', str(SR), 'pipe:1'],
                         capture_output=True).stdout
    return np.frombuffer(pcm, dtype='<f4').astype(float)


def gate(x, below=50):
    """Quiet whatever is more than `below` dB under the loudest moment: the hiss between."""
    n = int(0.01 * SR)
    k = len(x) // n
    e = 20 * np.log10(np.sqrt((x[:k * n].reshape(k, n) ** 2).mean(1)) + 1e-9)
    g = np.repeat(np.clip((e - (e.max() - below)) / 10, 0, 1), n)
    g = np.concatenate([g, np.full(len(x) - len(g), g[-1])])
    return x * np.convolve(g, np.ones(n) / n, 'same')


def shape(x, cut, fade):
    a, b, (up, down), out = cut[0], cut[1], cut[2], fade
    y = x[int(a * SR):int(b * SR)].copy()
    y = sosfilt(sos('high', 120, 2), y)
    y = gate(y)
    if (up, down) != (1, 1):
        y = resample_poly(y, up, down)
    y[: int(0.008 * SR)] *= np.linspace(0, 1, int(0.008 * SR))
    k = int(out * SR)
    y[-k:] *= np.linspace(1, 0, k) ** 2
    return y / (np.abs(y).max() + 1e-9) * 0.9


def write(x, path):
    channels = 1 if x.ndim == 1 else x.shape[1]
    pcm = (np.clip(x, -1, 1) * 32767).astype('<i2').tobytes()
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-f', 's16le', '-ar', str(SR), '-ac', str(channels), '-i', 'pipe:0',
                    '-c:a', 'libopus', '-b:a', f'{64 * channels}k', path], input=pcm, check=True)


def read_stereo(folder, name):
    path = glob.glob(os.path.join(folder, f'*{name}*'))[0]
    pcm = subprocess.run(['ffmpeg', '-v', 'quiet', '-i', path, '-f', 'f32le', '-ac', '2', '-ar', str(SR), 'pipe:1'],
                         capture_output=True).stdout
    return np.frombuffer(pcm, dtype='<f4').astype(float).reshape(-1, 2)


def effect(x, a, b, ratio, fade_in, fade_out, low):
    """A stretch of a recording, as it is: the rumble under `low` Hz taken off, faded in and out, peak 0.9."""
    y = x[int(a * SR):int(b * SR)].copy()
    y = sosfilt(sos('high', low, 2), y, axis=0)
    if ratio != (1, 1):
        y = resample_poly(y, ratio[0], ratio[1], axis=0)
    i, o = int(fade_in * SR), int(fade_out * SR)
    ramp = np.linspace(0, 1, i) if y.ndim == 1 else np.linspace(0, 1, i)[:, None]
    y[:i] *= ramp
    ramp = np.linspace(1, 0, o) ** 2 if y.ndim == 1 else (np.linspace(1, 0, o) ** 2)[:, None]
    y[-o:] *= ramp
    return y / (np.abs(y).max() + 1e-9) * 0.9


if __name__ == '__main__':
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    os.makedirs(OUT, exist_ok=True)
    for name, (src, a, b, ratio, fade) in CALLS.items():
        if sys.argv[2:] and name not in sys.argv[2:]:
            continue
        try:
            x = read(sys.argv[1], src)
        except SystemExit as missing:
            print(missing)
            continue
        y = shape(x, (a, b, ratio), fade)
        write(y, os.path.join(OUT, f'{name}.ogg'))
        print(f'{name}: {len(y) / SR:.2f} s')
    os.makedirs(EFFECTS_OUT, exist_ok=True)
    only = sys.argv[2:]
    for name, (src, a, b, ratio, fade_in, fade_out, low, stereo) in EFFECTS.items():
        if only and name not in only:
            continue
        if not glob.glob(os.path.join(sys.argv[1], f'*{src}*')):
            print(f'no recording named {src}')
            continue
        x = read_stereo(sys.argv[1], src) if stereo else read(sys.argv[1], src)
        y = effect(x, a, b, ratio, fade_in, fade_out, low)
        write(y, os.path.join(EFFECTS_OUT, f'{name}.ogg'))
        print(f'{name}: {len(y) / SR:.2f} s')
