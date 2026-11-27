"""The voices on the radio (3.11.0): real recordings, made impossible to make out.

    python3 tools/audio/radio_voice.py <folder with the recordings>

The recordings (made for the game on 2026-11-27, a man's and a woman's voice) are
not kept in the repo: only what this writes, which nobody can make words out of.
For each line it takes the stretch in LINES, shortens long pauses, keeps only
what a cheap radio would (a band of about 400-1,900 Hz, overdriven), and lets
it swell, fade and break up. It writes:

- voices/radio/<voice>_<kind>_<n>.ogg, mono, ready for sfx.py to put static round;
- voices/radio/drops.json, where each one breaks up (seconds, and how far it
  drops), so the static can surge into the gaps.

Then `python3 tools/audio/build.py sfx`. Needs numpy, scipy and ffmpeg.
"""
import glob, json, os, subprocess, sys
import numpy as np
from scipy.ndimage import uniform_filter1d
from scipy.signal import butter, sosfilt

SR = 44100
HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, 'voices', 'radio')

# Each line: the recording, and where in it the line is (seconds).
# m = the man's voice, f = the woman's. Calls 1-4 are calm, excited, tense and uneasy.
LINES = {
    'm_call_1': ('male_1', 0.70, 4.45),
    'm_call_2': ('male_2', 1.45, 5.05),
    'm_call_3': ('male_3', 0.60, 8.35),
    'm_call_4': ('male_4', 0.95, 7.20),
    'm_reply_1': ('male_replies', 1.00, 1.62),
    'm_reply_2': ('male_replies', 3.95, 6.12),
    'm_reply_3': ('male_replies', 8.15, 9.48),
    'f_call_1': ('female_1', 0.92, 3.62),
    'f_call_2': ('female_2', 0.78, 4.28),
    'f_call_3': ('female_3', 0.52, 4.62),
    'f_call_4': ('female_4', 0.82, 5.62),
    'f_reply_1': ('female_replies', 0.82, 1.30),
    'f_reply_2': ('female_replies', 3.22, 5.08),
    'f_reply_3': ('female_replies', 6.38, 7.52),
}

CUT = 1200        # Hz: nothing above this survives, and with it go the consonants.
DRIVE = 5.0       # how hard the receiver is overdriven
DROPS = 6.0       # times a second the signal breaks up
FLUTTER = 0.35    # how far it fades as it swells and fades
GAP = 0.2         # longest pause kept, in seconds


def sos(kind, hz, order):
    return butter(order, hz, kind, fs=SR, output='sos')


def read(path):
    pcm = subprocess.run(['ffmpeg', '-v', 'quiet', '-i', path, '-f', 'f32le', '-ac', '1', '-ar', str(SR), 'pipe:1'],
                         capture_output=True).stdout
    return np.frombuffer(pcm, dtype='<f4').astype(float)


def levels(x, w):
    n = int(w * SR)
    k = len(x) // n
    e = np.sqrt((x[:k * n].reshape(k, n) ** 2).mean(1)) + 1e-9
    return 20 * np.log10(e), n


def tighten(x):
    """Shorten every pause longer than GAP to GAP."""
    e, n = levels(x, 0.01)
    on = e > e.max() - 32
    keep = np.ones(len(e), bool)
    i = 0
    while i < len(e):
        if on[i]:
            i += 1
            continue
        j = i
        while j < len(e) and not on[j]:
            j += 1
        if (j - i) * 0.01 > GAP:
            keep[i + int(GAP / 0.02):j - int(GAP / 0.02)] = False
        i = j
    runs, run = [], []
    for idx, k in enumerate(keep):
        if k:
            run.append(x[idx * n:(idx + 1) * n])
        elif run:
            runs.append(np.concatenate(run))
            run = []
    if run:
        runs.append(np.concatenate(run))
    f = int(0.008 * SR)
    y = runs[0]
    for s in runs[1:]:
        ramp = np.linspace(0, 1, f)
        y = np.concatenate([y[:-f], y[-f:] * (1 - ramp) + s[:f] * ramp, s[f:]])
    return y


def gate(x):
    """Quiet the room under the words."""
    e, n = levels(x, 0.02)
    g = np.repeat(np.clip((e - (e.max() - 45)) / 12, 0, 1), n)
    g = np.concatenate([g, np.full(len(x) - len(g), g[-1])])
    return x * uniform_filter1d(g, int(0.02 * SR))


def radio(x, rng):
    """Through a cheap receiver, then the signal comes and goes. Returns the voice and where it dropped."""
    x = x / (np.sqrt(np.mean(x ** 2)) + 1e-9) * 0.12
    y = sosfilt(sos('high', 380, 4), x)
    y = sosfilt(sos('low', CUT, 6), y)
    y = np.tanh(y * DRIVE)
    y = np.repeat(y[::7], 7)[:len(x)]
    y = sosfilt(butter(3, [400, CUT * 1.6], 'band', fs=SR, output='sos'), y)
    d = len(y) / SR
    t = np.arange(len(y)) / SR
    pts = max(4, int(d * 9))
    y *= np.interp(t, np.linspace(0, d, pts), rng.uniform(1 - FLUTTER, 1, pts))
    mask = np.ones(len(y))
    drops = []
    for _ in range(int(d * DROPS)):
        a = rng.uniform(0, d)
        b = a + rng.uniform(0.035, 0.13)
        depth = rng.uniform(0.0, 0.25)
        mask[int(a * SR):int(b * SR)] = depth
        drops.append([round(a, 4), round(min(b, d), 4), round(1 - depth, 3)])
    y *= uniform_filter1d(mask, int(0.006 * SR))
    return y / (np.abs(y).max() + 1e-9) * 0.9, sorted(drops)


def write(x, path):
    pcm = (np.clip(x, -1, 1) * 32767).astype('<i2').tobytes()
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-f', 's16le', '-ar', str(SR), '-ac', '1', '-i', 'pipe:0',
                    '-c:a', 'libopus', '-b:a', '48k', path], input=pcm, check=True)


if __name__ == '__main__':
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    src = sys.argv[1]
    os.makedirs(OUT, exist_ok=True)
    found = {os.path.splitext(os.path.basename(p))[0].split('-')[-1]: p for p in glob.glob(os.path.join(src, '*'))}
    drops = {}
    for name, (rec, a, b) in LINES.items():
        x = read(found[rec])[int(a * SR):int(b * SR)]
        voice, drops[name] = radio(gate(tighten(x)), np.random.default_rng(sum(map(ord, name))))
        write(voice, os.path.join(OUT, f'{name}.ogg'))
        print(name, round(len(voice) / SR, 2), 's')
    json.dump(drops, open(os.path.join(OUT, 'drops.json'), 'w'), indent=1)
