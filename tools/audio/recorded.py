"""Real recordings (3.13.1): the elites' calls (the Red Hand's whistle, the Matron's claps, Old Mother's howl).

    python3 tools/audio/recorded.py <folder with the recordings>

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
    pcm = (np.clip(x, -1, 1) * 32767).astype('<i2').tobytes()
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-f', 's16le', '-ar', str(SR), '-ac', '1', '-i', 'pipe:0',
                    '-c:a', 'libopus', '-b:a', '64k', path], input=pcm, check=True)


if __name__ == '__main__':
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    os.makedirs(OUT, exist_ok=True)
    for name, (src, a, b, ratio, fade) in CALLS.items():
        try:
            x = read(sys.argv[1], src)
        except SystemExit as missing:
            print(missing)
            continue
        y = shape(x, (a, b, ratio), fade)
        write(y, os.path.join(OUT, f'{name}.ogg'))
        print(f'{name}: {len(y) / SR:.2f} s')
