# The Guild's sound

Everything in `public/audio/` is made here, offline, in Python. Nothing is downloaded at play time.

| File | What | Script |
|---|---|---|
| `depot.ogg` | The Depot by day: fingerpicked guitar, cello, a distant harmonica (D minor, 76 bpm, 32 bars) | `depot.py` |
| `night.ogg` | Night at the Depot: nylon guitar, a warm pad, a low cello line (60 bpm, 24 bars) | `night.py` |
| `fight.ogg` | Fights and raids: a taiko ensemble in a big hall (its own section, bus-compressed, with a sub boom), a string and bass ostinato, horns (E minor, 112 bpm, 40 bars) | `fight.py` |
| `haven.ogg` | The road east, hopeful: guitar, pad, a horn singing the tune, strings and a fiddle lifting it, a music box at the end (C major, 84 bpm, 32 bars) | `haven.py` |
| `truth.ogg` | After the road east: the same tune as an out-of-tune music box lullaby over a drone and a heartbeat (C minor, 64 bpm, 24 bars) | `truth.py` |
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
python3 tools/audio/build.py sfx     # just the effects and ambience (it needs the music already in tools/audio/out: copy it from public/audio)
python3 tools/audio/look.py tools/audio/out/depot.ogg   # a spectrogram and loudness plot in /tmp/look.png
```

`engine.py` is the sampler and mixer: notes on tracks, held notes looped from the middle of their sample, synthesized sounds placed like notes (`Song.sound`), a synthetic reverb, loudness to a target (music −15.5 to −19 LUFS). A score is a plain Python file that puts notes on tracks; `fight.py` renders its drums as a second song, dry and hall apart (`render(normalize=False, split=True)`), brings the dry drums close up (`punch`), sets music, drums and hall by K-weighted loudness, and finishes with the look-ahead `limit`.

**Adding effects without changing the old ones.** The sprite is the effects in order, then the enemy voices (`v_`, 3.4.1), then the radio (`RADIO`, 3.11.0), then the elites (`e_`, `ELITE`, 3.12.0, each set to a loudness of its own in `ELITE_LOUDNESS`), each group after the first on random numbers of its own, so adding to a group never moves or changes the sounds before it. A new effect that should leave every earlier one as it is goes in a new group at the end, the same way; a new `s_` effect changes every `s_` sound after it that uses random numbers, and the ambience. Check by decoding the old and new `sfx.ogg` and comparing the samples up to where the new sounds start.

**The elites' calls** (3.13.1): the Red Hand's whistle and the Matron's claps are real recordings made for the game (Aviel, 2026-11-28), and Old Mother's howl is "Wolf Howl 2" by Dragon Studio on [Pixabay](https://pixabay.com/service/license/) (free to use and change without credit; credited here all the same). `recorded.py <folder with the recordings>` cuts each one, quiets the hiss, speeds or slows it (`CALLS`: the whistle 7/4 as fast, so it's shrill; the howl a little slower and lower) and writes `voices/calls/`, dry; `sfx.py` (`recorded`, `e_whistle`, `e_clap`, `e_howl`) puts each in its room and sets its loudness. Only `voices/calls/` is committed.

**The voices on the radio** (3.11.0) are real recordings, a man's and a woman's, made for the game. `radio_voice.py <folder with the recordings>` muffles them past understanding and writes `voices/radio/` (the lines as Opus, and where each breaks up in `drops.json`); `sfx.py` puts the squelch and static round them. The clear recordings stay out of the repo: only `voices/radio/` is committed. To change how muffled they are, change the numbers at the top of `radio_voice.py` and run it again on the recordings (Aviel has them), then `build.py sfx`. To add a line, record it, add it to `LINES` and to `RADIO` in `sfx.py`.
