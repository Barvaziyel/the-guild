"""Render every piece of music, the sound effects and the ambience, copy them
into public/audio/, and write src/ui/sounds.ts (the effects' places in the
sprite and the music's loop lengths).

    python3 tools/audio/build.py            # everything
    python3 tools/audio/build.py sfx        # just the effects and ambience

Needs numpy, scipy, pyloudnorm and matplotlib (pip), ffmpeg with libopus, and
the FluidR3_GM samples decoded by decode.py (see README.md).
"""
import json, os, runpy, shutil, sys
HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.abspath(os.path.join(HERE, '..', '..'))
os.chdir(HERE)
os.makedirs('out', exist_ok=True)
sys.path.insert(0, HERE)
from engine import SR  # noqa: E402

MUSIC = ['depot', 'night', 'fight', 'haven', 'truth']
what = sys.argv[1:] or ['music', 'sfx']
if 'music' in what:
    for m in MUSIC:
        runpy.run_path(f'{m}.py', run_name='__main__')
if 'sfx' in what:
    sys.argv = ['sfx.py', '--amb']
    runpy.run_path('sfx.py', run_name='__main__')

dest = os.path.join(REPO, 'public', 'audio')
os.makedirs(dest, exist_ok=True)
names = [f'{m}.ogg' for m in MUSIC] + ['sfx.ogg'] + [f'amb-{a}.ogg' for a in ['wind', 'fire', 'crickets', 'birds']]
for n in names:
    shutil.copy(os.path.join('out', n), os.path.join(dest, n))


def seconds(path):
    import subprocess
    out = subprocess.run(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', path], capture_output=True, text=True).stdout
    return float(out.strip())


# The music's exact loop lengths, from the scores (bars x beats x 60 / bpm), not the files.
loops = {}
for m in MUSIC:
    src = open(f'{m}.py').read()
    import re
    bpm = float(re.search(r'bpm=(\d+(?:\.\d+)?)', src).group(1))
    bars = int(re.search(r'bars=(\d+)', src).group(1))
    loops[m] = round(round(bars * 4 * 60 / bpm * SR) / SR, 5)
sprite = json.load(open('out/sfx.json'))
amb = json.load(open('out/amb.json'))

lines = [
    '/**',
    ' * The sound files in public/audio, written by tools/audio/build.py: do not edit by hand.',
    ' * Music is FluidR3_GM instruments (Frank Wen, CC BY 3.0); the effects and ambience are synthesized.',
    ' */',
    '',
    '/** Each piece of music and the length of its loop, in seconds. */',
    'export const MUSIC = {',
    *[f"  {m}: {loops[m]}," for m in MUSIC],
    '} as const;',
    '',
    '/** Each ambience loop and its length, in seconds. */',
    'export const AMBIENCE = {',
    *[f"  {a}: {amb[a]}," for a in amb],
    '} as const;',
    '',
    '/** Every effect in sfx.ogg: where it starts and how long it is, in seconds. */',
    'export const SPRITE = {',
    *[f"  {k}: [{v[0]}, {v[1]}]," for k, v in sprite.items()],
    '} as const;',
    '',
    'export type MusicId = keyof typeof MUSIC;',
    'export type AmbienceId = keyof typeof AMBIENCE;',
    'export type SoundId = keyof typeof SPRITE;',
    '',
]
open(os.path.join(REPO, 'src', 'ui', 'sounds.ts'), 'w').write('\n'.join(lines))
print('wrote public/audio and src/ui/sounds.ts')
