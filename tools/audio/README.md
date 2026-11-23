# The Guild's sound

Everything in `public/audio/` is made here, offline, in Python. Nothing is downloaded at play time.

| File | What | Script |
|---|---|---|
| `depot.ogg` | The Depot by day: fingerpicked guitar, cello, a distant harmonica (D minor, 76 bpm, 32 bars) | `depot.py` |
| `night.ogg` | Night at the Depot: nylon guitar, a warm pad, a low cello line (60 bpm, 24 bars) | `night.py` |
| `fight.ogg` | Fights and raids: taiko, a string and bass ostinato, horns (E minor, 112 bpm, 40 bars) | `fight.py` |
| `haven.ogg` | The road east: a slightly out-of-tune music box lullaby over a drone and a heartbeat (C minor, 64 bpm, 24 bars) | `haven.py` |
| `sfx.ogg` | Every effect in one file; `src/ui/sounds.ts` says where each one is | `sfx.py` |
| `amb-*.ogg` | The yard's ambience: wind, the fire, crickets, birds | `sfx.py` |

Each piece of music loops without a gap: it is rendered with its reverb tail, and the tail is folded back onto its start. `src/ui/sounds.ts` holds each loop's exact length, which `audio.ts` uses as the loop point.

## Making it again

```bash
pip install numpy scipy pyloudnorm matplotlib   # and ffmpeg with libopus
# The instruments: FluidR3_GM from github.com/gleitz/midi-js-soundfonts (CC BY 3.0).
# Check out FluidR3_GM/<instrument>-mp3.js for the instruments the scripts use into ext/sf, then:
python3 tools/audio/decode.py        # writes tools/audio/samples/<instrument>.npz (git-ignored)
python3 tools/audio/build.py         # renders everything, copies it to public/audio, writes src/ui/sounds.ts
python3 tools/audio/build.py sfx     # just the effects and ambience
python3 tools/audio/look.py tools/audio/out/depot.ogg   # a spectrogram and loudness plot in /tmp/look.png
```

`engine.py` is the sampler and mixer: notes on tracks, held notes looped from the middle of their sample, a synthetic reverb, loudness to a target (music −16 to −19 LUFS). A score is a plain Python file that puts notes on tracks.
