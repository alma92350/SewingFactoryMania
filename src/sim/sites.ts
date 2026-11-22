/**
 * Part II, Chapter 9 ("Two Cities", 2005): a factory in Saigon and another in Hà Nội.
 * The director can only be in one city at a time. Where you are, you seat people, change jobs,
 * fix machines and hire. The other city runs on its line leaders, its mechanics and the office.
 * A flight takes three hours and costs $40.
 */
import type { GameState, Station, Worker } from './types';

export const SITE_NAME: Record<string, string> = { saigon: 'Saigon', hanoi: 'Hà Nội' };
export const FLIGHT_MINUTES = 180;
export const FLIGHT_COST = 40;
/** Hà Nội: newer workers, lower wages. */
export const HANOI_WAGE = 0.85;

export function hasSites(s: GameState): boolean {
  return s.systems.includes('sites') && !!s.director;
}

export function siteOfLine(s: GameState, line: number): string {
  return s.lines[line]?.site ?? 'main';
}

export function siteOfStation(s: GameState, st: Station | number): string {
  const station = typeof st === 'number' ? s.stations[st] : st;
  return station ? siteOfLine(s, station.line) : 'main';
}

export function siteOfWorker(s: GameState, w: Worker): string {
  if (w.station !== null) return siteOfStation(s, w.station);
  return w.site ?? s.lines[0]?.site ?? 'main';
}

/** Where the director is right now ('air' while flying). */
export function directorSite(s: GameState): string {
  if (!s.director) return 'main';
  return s.director.flightUntil > 0 ? 'air' : s.director.site;
}

/** Can the player act on this station right now? Always true without sites. */
export function presentAt(s: GameState, site: string): boolean {
  return !hasSites(s) || directorSite(s) === site;
}

export function sites(s: GameState): string[] {
  return [...new Set(s.lines.map((l) => l.site ?? 'main'))];
}

/** Book a flight: the director leaves now and lands three hours later. */
export function travel(s: GameState, site: string): string | null {
  if (!hasSites(s) || !s.director) return 'There is only one factory.';
  if (!sites(s).includes(site)) return 'Unknown city.';
  if (s.director.flightUntil > 0) return 'You are already in the air.';
  if (s.director.site === site) return `You are already in ${SITE_NAME[site] ?? site}.`;
  if (s.phase !== 'shift') return 'Flights leave during the day.';
  if (s.cash < FLIGHT_COST) return `Not enough cash: a ticket costs $${FLIGHT_COST}.`;
  s.cash -= FLIGHT_COST;
  s.ledger.freight += FLIGHT_COST;
  s.director.site = site;
  s.director.flightUntil = s.minute + FLIGHT_MINUTES;
  s.stats.flights = (s.stats.flights ?? 0) + 1;
  const d = s.agents.find((a) => a.kind === 'director');
  if (d) {
    d.target = null;
    d.task = null;
    d.until = 0;
    d.pos = -1;
  }
  s.repairQueue = s.repairQueue.filter((i) => siteOfStation(s, i) !== 'nowhere');
  return null;
}

/** Every minute: land when the flight is over. Overnight flights land at the start of the next shift. */
export function stepTravel(s: GameState): boolean {
  if (!s.director || s.director.flightUntil <= 0) return false;
  if (s.minute >= s.director.flightUntil) {
    s.director.flightUntil = 0;
    return true;
  }
  return false;
}
