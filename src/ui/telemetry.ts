/**
 * Opt-in, local-only play log (PRD §21.10): nothing leaves the device. The player can export it
 * as JSON. It is used to measure session length and day-1 return (D1) in playtests.
 */
export interface LogEvent {
  t: number;
  e: 'session' | 'chapterStart' | 'shiftEnd' | 'chapterEnd';
  ch?: string;
  day?: number;
  stars?: number;
}

const KEY = 'sfm.log.v1';

export function readLog(): LogEvent[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '[]') as LogEvent[];
  } catch {
    return [];
  }
}

export function logEvent(enabled: boolean, e: Omit<LogEvent, 't'>): void {
  if (!enabled) return;
  try {
    const log = readLog();
    log.push({ t: Date.now(), ...e });
    localStorage.setItem(KEY, JSON.stringify(log.slice(-2000)));
  } catch {
    /* storage unavailable */
  }
}

export function clearLog(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}

const dayKey = (t: number) => new Date(t).toISOString().slice(0, 10);

/** Share of play days that were followed by play on the next calendar day. */
export function d1Return(log: LogEvent[]): { days: number; returned: number } {
  const days = [...new Set(log.filter((e) => e.e === 'session').map((e) => dayKey(e.t)))].sort();
  let returned = 0;
  for (const d of days) {
    const next = new Date(`${d}T00:00:00Z`);
    next.setUTCDate(next.getUTCDate() + 1);
    if (days.includes(next.toISOString().slice(0, 10))) returned += 1;
  }
  return { days: days.length, returned };
}

export function exportLog(): void {
  const blob = new Blob([JSON.stringify(readLog(), null, 1)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'sewingfactorymania-playlog.json';
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
