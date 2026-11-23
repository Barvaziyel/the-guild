/**
 * The game's sound (3.1.0), played with Web Audio: one piece of music at a
 * time, crossfaded and looped without a gap; the yard's ambience as layered
 * loops; and effects cut from one sprite file. Nothing plays until the player
 * first touches the screen (phones won't allow it), while the game is in the
 * background, or with sound turned off. What to play is decided in
 * `sound-view.ts`; the files and their lengths are in `sounds.ts`.
 */
import { AMBIENCE, MUSIC, SPRITE, type AmbienceId, type MusicId } from './sounds.ts';
import { gainOf, type AmbienceMix, type Cue } from './sound-view.ts';

export interface Volumes {
  on: boolean;
  /** 0–1, as the sliders in Settings set them. */
  music: number;
  sound: number;
  ambience: number;
}

const BASE = 'audio/';
/** Seconds for music to fade across, and for ambience to follow the hour. */
const MUSIC_FADE = 2.4;
const AMBIENCE_FADE = 1.5;
/** How loud each layer sits against the others at full volume. */
const MIX = { music: 0.85, sound: 1, ambience: 0.75 };

interface Playing {
  id: MusicId;
  src: AudioBufferSourceNode;
  gain: GainNode;
  /** The context time the track's start would have played at. */
  zero: number;
}

interface Layer {
  src: AudioBufferSourceNode;
  gain: GainNode;
}

type Ctor = typeof AudioContext;

export class SoundSystem {
  private ctx: AudioContext | null = null;
  private bus: { master: GainNode; music: GainNode; sound: GainNode; ambience: GainNode } | null = null;
  private files = new Map<string, Promise<AudioBuffer | null>>();
  private sprite: AudioBuffer | null = null;
  private music: Playing | null = null;
  private wantMusic: MusicId | null = null;
  /** Where each piece was when it was last faded out, to pick up there. */
  private left: Partial<Record<MusicId, number>> = {};
  private switching = 0;
  private layers = new Map<AmbienceId, Layer>();
  private wantAmbience: AmbienceMix | null = null;
  private volumes: Volumes = { on: true, music: 0.6, sound: 0.8, ambience: 0.5 };
  private hidden = false;

  /** From a touch or a key: start the audio, or wake it. */
  unlock(): void {
    if (!this.volumes.on || this.hidden) return;
    if (!this.ctx) this.create();
    if (this.ctx?.state === 'suspended') void this.ctx.resume().catch(() => undefined);
  }

  setVolumes(v: Volumes): void {
    this.volumes = v;
    if (!this.ctx || !this.bus) return;
    const t = this.ctx.currentTime;
    this.bus.master.gain.setTargetAtTime(v.on ? 1 : 0, t, 0.05);
    this.bus.music.gain.setTargetAtTime(gainOf(v.music) * MIX.music, t, 0.05);
    this.bus.sound.gain.setTargetAtTime(gainOf(v.sound) * MIX.sound, t, 0.05);
    this.bus.ambience.gain.setTargetAtTime(gainOf(v.ambience) * MIX.ambience, t, 0.05);
    // Silence costs nothing: let the phone's audio rest.
    const silent = !v.on || (v.music === 0 && v.sound === 0 && v.ambience === 0);
    if (silent) void this.ctx.suspend().catch(() => undefined);
    else if (!this.hidden) void this.ctx.resume().catch(() => undefined);
  }

  setMusic(id: MusicId | null): void {
    if (id === this.wantMusic && (this.music?.id === id || !this.ctx)) return;
    this.wantMusic = id;
    if (this.ctx) void this.switchMusic(id);
  }

  setAmbience(mix: AmbienceMix): void {
    this.wantAmbience = mix;
    if (!this.ctx) return;
    for (const id of Object.keys(AMBIENCE) as AmbienceId[]) void this.layer(id, mix[id]);
  }

  play(cue: Cue): void {
    const ctx = this.ctx;
    if (!ctx || !this.bus || !this.sprite || this.hidden || !this.volumes.on || this.volumes.sound === 0) return;
    const [start, length] = SPRITE[cue.id];
    const src = ctx.createBufferSource();
    src.buffer = this.sprite;
    // A little variation, so the same shot twice doesn't sound copied.
    src.playbackRate.value = cue.rate ?? 1 + (Math.random() - 0.5) * 0.06;
    const gain = ctx.createGain();
    gain.gain.value = cue.gain ?? 1;
    let tail: AudioNode = gain;
    if (cue.pan && typeof ctx.createStereoPanner === 'function') {
      const pan = ctx.createStereoPanner();
      pan.pan.value = cue.pan;
      gain.connect(pan);
      tail = pan;
    }
    src.connect(gain);
    tail.connect(this.bus.sound);
    src.start(ctx.currentTime + (cue.delay ?? 0), start, length);
  }

  /** The game went into the background, or came back. */
  pause(): void {
    this.hidden = true;
    void this.ctx?.suspend().catch(() => undefined);
  }

  resume(): void {
    this.hidden = false;
    if (this.ctx && this.volumes.on) void this.ctx.resume().catch(() => undefined);
  }

  // ---------------------------------------------------------------- inside

  private create(): void {
    const w = window as unknown as { AudioContext?: Ctor; webkitAudioContext?: Ctor };
    const Make = w.AudioContext ?? w.webkitAudioContext;
    if (!Make) return;
    const ctx = new Make();
    const node = (): GainNode => ctx.createGain();
    const bus = { master: node(), music: node(), sound: node(), ambience: node() };
    bus.music.connect(bus.master);
    bus.sound.connect(bus.master);
    bus.ambience.connect(bus.master);
    bus.master.connect(ctx.destination);
    this.ctx = ctx;
    this.bus = bus;
    this.setVolumes(this.volumes);
    void this.load('sfx').then((b) => {
      this.sprite = b;
    });
    if (this.wantMusic) void this.switchMusic(this.wantMusic);
    if (this.wantAmbience) this.setAmbience(this.wantAmbience);
  }

  private load(name: string): Promise<AudioBuffer | null> {
    const ctx = this.ctx;
    if (!ctx) return Promise.resolve(null);
    let p = this.files.get(name);
    if (!p) {
      p = fetch(`${BASE}${name}.ogg`)
        .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(r.statusText))))
        .then((data) => ctx.decodeAudioData(data))
        .catch(() => {
          // A file that won't load or decode just stays quiet; try again next time it's wanted.
          this.files.delete(name);
          return null;
        });
      this.files.set(name, p);
    }
    return p;
  }

  private async switchMusic(id: MusicId | null): Promise<void> {
    const ctx = this.ctx;
    if (!ctx || !this.bus) return;
    const turn = ++this.switching;
    const buffer = id ? await this.load(id) : null;
    // Something else was asked for while this one loaded.
    if (turn !== this.switching || !this.ctx) return;
    const t = ctx.currentTime;
    const old = this.music;
    if (old && old.id === id) return;
    if (old) {
      this.left[old.id] = (t - old.zero) % MUSIC[old.id];
      old.gain.gain.cancelScheduledValues(t);
      old.gain.gain.setValueAtTime(old.gain.gain.value, t);
      old.gain.gain.linearRampToValueAtTime(0, t + MUSIC_FADE);
      old.src.stop(t + MUSIC_FADE + 0.05);
      // Keep the piece just left and the one playing decoded; let go of the rest.
      for (const name of Object.keys(MUSIC)) if (name !== old.id && name !== id) this.files.delete(name);
    }
    this.music = null;
    if (!id || !buffer) return;
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    src.loop = true;
    src.loopStart = 0;
    src.loopEnd = MUSIC[id];
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(1, t + MUSIC_FADE);
    src.connect(gain).connect(this.bus.music);
    const at = this.left[id] ?? 0;
    src.start(t, at);
    this.music = { id, src, gain, zero: t - at };
  }

  private async layer(id: AmbienceId, level: number): Promise<void> {
    const ctx = this.ctx;
    if (!ctx || !this.bus) return;
    let layer = this.layers.get(id);
    if (!layer) {
      if (level <= 0) return;
      const buffer = await this.load(`amb-${id}`);
      if (!buffer || !this.bus || this.layers.has(id)) return;
      const src = ctx.createBufferSource();
      src.buffer = buffer;
      src.loop = true;
      src.loopEnd = AMBIENCE[id];
      const gain = ctx.createGain();
      gain.gain.value = 0;
      src.connect(gain).connect(this.bus.ambience);
      // Start each layer somewhere in its loop, so they don't line up the same way every time.
      src.start(ctx.currentTime, Math.random() * AMBIENCE[id]);
      layer = { src, gain };
      this.layers.set(id, layer);
      level = this.wantAmbience?.[id] ?? level;
    }
    layer.gain.gain.setTargetAtTime(level, ctx.currentTime, AMBIENCE_FADE / 3);
  }
}
