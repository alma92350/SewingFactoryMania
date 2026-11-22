/**
 * "The line is the music" (PRD D9), placeholder version.
 * Every working station plays its own 16-step percussion pattern on a shared clock.
 * A balanced line grooves; a starved or broken station drops out of the beat.
 * All sound is synthesised with WebAudio: no audio files to download.
 */

import { SONGS } from '../data/cosmetics';

const BPM = 112;
const STEP = 60 / BPM / 4; // 16th note in seconds
const LOOKAHEAD = 0.12;

// x = hit. Stations take patterns in turn so the layers interlock.
const PATTERNS = [
  'x...x...x...x...',
  'x.x...x.x.x...x.',
  '..x...x...x..xx.',
  'x..x..x..x..x.x.',
  '.x.x.x...x.x.x..',
  'x...x.x.x...x.x.',
  '....x.......x...',
  '.x...x...x...x..',
  'x.....x.x.....x.',
  '..x.x...x.x.....',
].map((p) => [...p].map((c) => c === 'x'));

const PITCH: Record<string, number[]> = {
  lockstitch: [2600, 2100, 3000, 1800, 2400, 2800],
  overlock: [900, 1100, 1300],
  buttonhole: [600],
  qc: [],
};

export class LineAudio {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  private nextTime = 0;
  private stepIndex = 0;
  private timer: number | null = null;
  private song: (typeof SONGS)[string] | null = null;
  private songPos = 0;
  enabled = true;

  constructor(
    private isStationWorking: (i: number) => boolean,
    private machineOf: (i: number) => string,
    private running: () => boolean,
  ) {}

  /** Must be called from a user gesture (browser autoplay rules). */
  unlock(): void {
    if (this.ctx) {
      void this.ctx.resume();
      return;
    }
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.5;
    this.master.connect(this.ctx.destination);
    const len = Math.floor(this.ctx.sampleRate * 0.05);
    this.noise = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = this.noise.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    this.nextTime = this.ctx.currentTime + 0.05;
    this.timer = window.setInterval(() => this.schedule(), 25);
  }

  /** The factory radio: an original melody in time with the line (null = off). */
  setSong(id: string | null): void {
    const next = id ? (SONGS[id] ?? null) : null;
    if (next !== this.song) this.songPos = 0;
    this.song = next;
  }

  setEnabled(on: boolean): void {
    this.enabled = on;
    if (this.master) this.master.gain.value = on ? 0.5 : 0;
  }

  private schedule(): void {
    const ctx = this.ctx;
    if (!ctx) return;
    if (this.nextTime < ctx.currentTime) this.nextTime = ctx.currentTime + 0.02;
    while (this.nextTime < ctx.currentTime + LOOKAHEAD) {
      if (this.enabled && this.running()) {
        for (let i = 0; i < 16; i++) {
          if (!PATTERNS[i % PATTERNS.length]![this.stepIndex] || !this.isStationWorking(i)) continue;
          const m = this.machineOf(i);
          const pitches = PITCH[m] ?? [];
          if (pitches.length) this.tick(this.nextTime, pitches[i % pitches.length]!, m !== 'lockstitch');
        }
        if (this.song && this.stepIndex % 2 === 0) {
          const notes = this.song.notes;
          const n = notes[this.songPos % notes.length]!;
          if (n >= 0) this.radio(this.nextTime, this.song.root * 2 ** (n / 12), 0.05, STEP * 1.8);
          if (this.songPos % 8 === 0) {
            const b = this.song.bass[(this.songPos / 8) % this.song.bass.length]!;
            this.radio(this.nextTime, (this.song.root / 2) * 2 ** (b / 12), 0.06, STEP * 7);
          }
          this.songPos += 1;
        }
      }
      this.stepIndex = (this.stepIndex + 1) % 16;
      this.nextTime += STEP;
    }
  }

  private tick(at: number, freq: number, overlock: boolean): void {
    const ctx = this.ctx!;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = freq;
    filter.Q.value = overlock ? 4 : 9;
    const g = ctx.createGain();
    g.gain.setValueAtTime(overlock ? 0.5 : 0.7, at);
    g.gain.exponentialRampToValueAtTime(0.001, at + (overlock ? 0.06 : 0.03));
    src.connect(filter).connect(g).connect(this.master!);
    src.start(at);
    src.stop(at + 0.07);
  }

  /** A soft radio note: a small, slightly muffled transistor radio. */
  private radio(at: number, freq: number, vol: number, dur: number): void {
    const ctx = this.ctx!;
    const o = ctx.createOscillator();
    o.type = 'triangle';
    o.frequency.value = freq;
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = 2400;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, at);
    g.gain.exponentialRampToValueAtTime(vol, at + 0.015);
    g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
    o.connect(f).connect(g).connect(this.master!);
    o.start(at);
    o.stop(at + dur + 0.02);
  }

  /** Low thunk: a finished bundle drops into the carton. */
  thunk(): void {
    this.tone(95, 0.18, 'sine', 0.6);
  }

  /** Twang: a needle snapped. */
  twang(): void {
    this.tone(1760, 0.25, 'square', 0.12);
    this.tone(1850, 0.25, 'square', 0.1);
  }

  /** Fax machine screech: a new order. */
  fax(): void {
    this.tone(1200, 0.12, 'sawtooth', 0.08);
    this.tone(2100, 0.18, 'sawtooth', 0.06, 0.12);
    this.tone(1650, 0.25, 'square', 0.05, 0.3);
  }

  /** Cash register: an order shipped. */
  cash(): void {
    this.tone(1320, 0.08, 'triangle', 0.3);
    this.tone(1760, 0.3, 'triangle', 0.3, 0.08);
  }

  /** Two notes: the machine runs again. */
  fixed(): void {
    this.tone(660, 0.1, 'triangle', 0.3);
    this.tone(990, 0.14, 'triangle', 0.3, 0.1);
  }

  private tone(freq: number, dur: number, type: OscillatorType, vol: number, delay = 0): void {
    const ctx = this.ctx;
    if (!ctx || !this.enabled) return;
    const at = ctx.currentTime + delay;
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, at);
    g.gain.exponentialRampToValueAtTime(0.001, at + dur);
    o.connect(g).connect(this.master!);
    o.start(at);
    o.stop(at + dur + 0.02);
  }

  dispose(): void {
    if (this.timer !== null) window.clearInterval(this.timer);
  }
}
