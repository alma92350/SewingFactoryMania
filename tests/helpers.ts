import { answer, makeBot, type BotConfig } from '../src/sim/autopilot';
import { applyCommand } from '../src/sim/commands';
import { runChapter } from '../src/sim/sim';
import { createChapter, type ChapterOptions } from '../src/sim/state';
import type { GameState } from '../src/sim/types';

export const SEEDS = Array.from({ length: 8 }, (_, i) => i + 1);

/** "Doing nothing": answers the cards the game cannot continue without, and nothing else. */
export function idle(s: GameState): void {
  for (const d of [...s.decisions]) {
    let opt = d.options[0]!.id;
    if (d.kind === 'sample') opt = 'skip';
    if (d.kind === 'marker') opt = 'auto';
    if (d.kind === 'fabric') opt = 'skip';
    if (d.kind === 'fax') opt = d.options.some((o) => o.id === 'decline') ? 'decline' : d.options.some((o) => o.id === '1') ? '1' : '0';
    applyCommand(s, { type: 'decide', decision: d.id, option: opt });
  }
}

/** Answer every open card with the bot's choices. */
export function answerAll(s: GameState, cfg: BotConfig = {}): void {
  // answering one card can open another (a fax opens the marker card), so loop
  for (let i = 0; i < 10 && s.decisions.length; i++) {
    for (const d of [...s.decisions]) applyCommand(s, { type: 'decide', decision: d.id, option: answer(s, d.id, cfg) });
  }
}

export function playChapter(chapter: string, seed: number, cfg: BotConfig | 'idle' = {}, opts: ChapterOptions = {}): GameState {
  const s = createChapter(chapter, seed, opts);
  runChapter(s, cfg === 'idle' ? idle : makeBot(cfg));
  return s;
}
