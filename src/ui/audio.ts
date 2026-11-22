/**
 * "The line is the music" (PRD D9), placeholder version.
 * Every working station plays its own 16-step percussion pattern on a shared clock.
 * A balanced line grooves; a starved or broken station drops out of the beat.
 * All sound is synthesised with WebAudio: no audio files to download.
 */

const BPM = 112;
const STEP = 60 / BPM / 4; // 16th note in seconds
const LOOKAHEAD = 0.12;

// x = hit. Each station gets a different rhythm so the layers interlock.
const PATTERNS = [
  'x...x...x...x...', // join (overlock): steady pulse
  'x.x...x.x.x...x.', // side seams
  '..x...x...x..xx.', // pocket
  'x..x..x..x..x.x.', // spare
  '.x.x.x...x.x.x..', // waistband
  'x...x.x.x...x.x.', // elastic (overlock)
  '....x.......x...', // hem: backbeat
].map((p) => [...p].map((c) => c === 'x'));

const PITCH = [900, 2600, 2100, 1800, 3000, 1100, 1500];

export class LineAudio {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  private nextTime = 0;
  private stepIndex = 0;
  private timer: number | null = null;
  enabled = true;

  constructor(private isStationWorking: (i: number) => boolean, private running: () => boolean) {}

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
        for (let i = 0; i < PATTERNS.length; i++) {
          if (PATTERNS[i]![this.stepIndex] && this.isStationWorking(i)) this.tick(this.nextTime, PITCH[i]!, i === 0 || i === 5);
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

  /** Low thunk: a finished bundle drops into the carton. */
  thunk(): void {
    this.tone(95, 0.18, 'sine', 0.6);
  }

  /** Twang: a needle snapped. */
  twang(): void {
    this.tone(1760, 0.25, 'square', 0.12);
    this.tone(1850, 0.25, 'square', 0.1);
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
